import 'dotenv/config';
import { getDataSource } from '../shared/db/data-source';
import { processQueue, AlertMessage, sendNotificationMessage } from '../shared/queues/sqs-client';
import { Incident, IncidentEvent, Service, MaintenanceWindow, AlertRoutingRule } from '../shared/models';
import { logger } from '../shared/utils/logger';
import { LessThanOrEqual, MoreThan } from 'typeorm';

const QUEUE_URL = process.env.ALERTS_QUEUE_URL;

type Severity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Infer severity from alert summary keywords when not explicitly set
 * Returns suggested severity based on keyword analysis
 */
function inferSeverityFromSummary(summary: string, currentSeverity?: Severity): Severity {
  // If severity is already set to something specific, respect it
  if (currentSeverity && currentSeverity !== 'info' && currentSeverity !== 'warning') {
    return currentSeverity;
  }

  const lowerSummary = summary.toLowerCase();

  // Critical indicators
  const criticalPatterns = [
    'critical', 'fatal', 'emergency', 'outage', 'down', 'unreachable',
    'database down', 'service down', 'cluster down', 'complete failure',
    'data loss', 'security breach', 'production down', '500 error rate',
    'disk full', '100% cpu', 'out of memory', 'oom', 'unresponsive',
  ];

  // Error indicators
  const errorPatterns = [
    'error', 'failed', 'failure', 'exception', 'crash', 'crashed',
    'timeout', 'connection refused', 'connection lost', '5xx',
    'unhealthy', 'degraded', 'high latency', 'slow response',
    'disk space low', 'memory high', 'cpu high', 'rate limit',
  ];

  // Warning indicators
  const warningPatterns = [
    'warning', 'warn', 'alert', 'elevated', 'increasing', 'growing',
    'approaching', 'threshold', 'spike', 'anomaly', 'unusual',
    'retry', 'retrying', 'delayed', 'queue backed up',
  ];

  // Check patterns in order of severity
  for (const pattern of criticalPatterns) {
    if (lowerSummary.includes(pattern)) {
      return 'critical';
    }
  }

  for (const pattern of errorPatterns) {
    if (lowerSummary.includes(pattern)) {
      return 'error';
    }
  }

  for (const pattern of warningPatterns) {
    if (lowerSummary.includes(pattern)) {
      return 'warning';
    }
  }

  // Default to provided severity or 'warning' if none
  return currentSeverity || 'warning';
}

/**
 * Clean up alert summaries by removing monitoring tool prefixes and noise
 * Examples:
 *   "[FIRING:1] High CPU" -> "High CPU"
 *   "[AlertManager] Memory Alert" -> "Memory Alert"
 *   "[RESOLVED] Disk Space" -> "Disk Space"
 *   "ALERT: Database Down" -> "Database Down"
 */
function cleanupAlertSummary(summary: string): string {
  let cleaned = summary;

  // Remove common monitoring tool prefixes
  const prefixPatterns = [
    /^\[FIRING:\d+\]\s*/i,           // [FIRING:1], [FIRING:3]
    /^\[RESOLVED\]\s*/i,              // [RESOLVED]
    /^\[AlertManager\]\s*/i,          // [AlertManager]
    /^\[Prometheus\]\s*/i,            // [Prometheus]
    /^\[Grafana\]\s*/i,               // [Grafana]
    /^\[DataDog\]\s*/i,               // [DataDog]
    /^\[NewRelic\]\s*/i,              // [NewRelic]
    /^\[PagerDuty\]\s*/i,             // [PagerDuty]
    /^\[OpsGenie\]\s*/i,              // [OpsGenie]
    /^\[CloudWatch\]\s*/i,            // [CloudWatch]
    /^ALERT:\s*/i,                    // ALERT:
    /^WARNING:\s*/i,                  // WARNING:
    /^CRITICAL:\s*/i,                 // CRITICAL:
    /^ERROR:\s*/i,                    // ERROR:
    /^\[WARN\]\s*/i,                  // [WARN]
    /^\[ERROR\]\s*/i,                 // [ERROR]
    /^\[CRIT\]\s*/i,                  // [CRIT]
    /^\[INFO\]\s*/i,                  // [INFO]
  ];

  for (const pattern of prefixPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove trailing status indicators
  cleaned = cleaned.replace(/\s*\(firing\)$/i, '');
  cleaned = cleaned.replace(/\s*\(resolved\)$/i, '');
  cleaned = cleaned.replace(/\s*\(pending\)$/i, '');

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // If cleanup removed everything, return original
  return cleaned.length > 0 ? cleaned : summary;
}

async function handleAlertMessage(message: AlertMessage): Promise<void> {
  logger.info('Processing alert message', {
    serviceId: message.serviceId,
    summary: message.summary,
    severity: message.severity,
  });

  try {
    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);
    const serviceRepo = dataSource.getRepository(Service);

    // Get service with escalation policy
    const service = await serviceRepo.findOne({
      where: { id: message.serviceId },
      relations: ['organization', 'escalationPolicy', 'escalationPolicy.steps', 'escalationPolicy.steps.schedule'],
    });

    if (!service) {
      logger.error('Service not found', { serviceId: message.serviceId });
      return;
    }

    // Evaluate routing rules to potentially override service or severity
    const routingResult = await evaluateRoutingRules(
      service.orgId,
      message,
      dataSource
    );

    // If routing rule matched and specified a different target service, fetch it
    let targetService = service;
    let effectiveSeverity: Severity = message.severity as Severity;

    if (routingResult.matchedRule) {
      if (routingResult.targetServiceId && routingResult.targetServiceId !== service.id) {
        const newTargetService = await serviceRepo.findOne({
          where: { id: routingResult.targetServiceId, orgId: service.orgId },
          relations: ['organization', 'escalationPolicy', 'escalationPolicy.steps', 'escalationPolicy.steps.schedule'],
        });

        if (newTargetService) {
          targetService = newTargetService;
          logger.info('Alert routed to different service by routing rule', {
            originalServiceId: service.id,
            targetServiceId: targetService.id,
            ruleId: routingResult.matchedRule.id,
            ruleName: routingResult.matchedRule.name,
          });
        }
      }

      if (routingResult.setSeverity) {
        effectiveSeverity = routingResult.setSeverity as Severity;
        logger.info('Alert severity overridden by routing rule', {
          originalSeverity: message.severity,
          newSeverity: effectiveSeverity,
          ruleId: routingResult.matchedRule.id,
          ruleName: routingResult.matchedRule.name,
        });
      }
    }

    // Auto-infer severity from summary keywords if not explicitly set to critical/error
    const inferredSeverity = inferSeverityFromSummary(message.summary, effectiveSeverity);
    if (inferredSeverity !== effectiveSeverity) {
      logger.info('Alert severity inferred from summary keywords', {
        originalSeverity: effectiveSeverity,
        inferredSeverity,
        summary: message.summary,
      });
      effectiveSeverity = inferredSeverity;
    }

    // Check for active maintenance window with alert suppression
    const maintenanceWindowRepo = dataSource.getRepository(MaintenanceWindow);
    const now = new Date();
    const activeMaintenanceWindow = await maintenanceWindowRepo.findOne({
      where: {
        serviceId: targetService.id,
        suppressAlerts: true,
        startTime: LessThanOrEqual(now),
        endTime: MoreThan(now),
      },
    });

    if (activeMaintenanceWindow) {
      logger.info('Alert suppressed due to active maintenance window', {
        serviceId: targetService.id,
        maintenanceWindowId: activeMaintenanceWindow.id,
        summary: message.summary,
        severity: message.severity,
        maintenanceEnds: activeMaintenanceWindow.endTime,
      });
      return; // Suppress the alert - don't create incident
    }

    // Check for deduplication
    let incident: Incident | null = null;
    if (message.dedupKey) {
      incident = await incidentRepo.findOne({
        where: {
          serviceId: targetService.id,
          dedupKey: message.dedupKey,
          state: 'triggered', // Only match open incidents
        },
      });

      // Also check acknowledged incidents
      if (!incident) {
        incident = await incidentRepo.findOne({
          where: {
            serviceId: targetService.id,
            dedupKey: message.dedupKey,
            state: 'acknowledged',
          },
        });
      }
    }

    if (incident) {
      // Deduplicated - append to existing incident
      incident.eventCount += 1;
      incident.lastEventAt = new Date();
      await incidentRepo.save(incident);

      // Create alert event
      const event = eventRepo.create({
        incidentId: incident.id,
        type: 'alert',
        message: `New alert: ${message.summary}`,
        payload: message.details,
      });
      await eventRepo.save(event);

      logger.info('Alert deduplicated to existing incident', {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        eventCount: incident.eventCount,
      });
    } else {
      // Create new incident
      const incidentNumber = await getNextIncidentNumber(targetService.orgId);

      // Clean up the summary to remove monitoring tool prefixes
      const cleanedSummary = cleanupAlertSummary(message.summary);

      incident = incidentRepo.create({
        orgId: targetService.orgId,
        serviceId: targetService.id,
        incidentNumber,
        summary: cleanedSummary,
        details: message.details,
        severity: effectiveSeverity,
        state: 'triggered',
        dedupKey: message.dedupKey,
        eventCount: 1,
        currentEscalationStep: 1,
        escalationStartedAt: new Date(),
      });
      await incidentRepo.save(incident);

      // Create initial alert event
      const event = eventRepo.create({
        incidentId: incident.id,
        type: 'alert',
        message: `Incident created: ${message.summary}`,
        payload: {
          ...message.details,
          ...(routingResult.matchedRule ? {
            routedByRule: routingResult.matchedRule.name,
            originalServiceId: service.id !== targetService.id ? service.id : undefined,
            originalSeverity: message.severity !== effectiveSeverity ? message.severity : undefined,
          } : {}),
        },
      });
      await eventRepo.save(event);

      logger.info('New incident created', {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        serviceId: targetService.id,
        severity: effectiveSeverity,
        routedByRule: routingResult.matchedRule?.name,
      });

      // Trigger notifications to on-call user(s)
      await triggerNotifications(incident, targetService);
    }
  } catch (error) {
    logger.error('Error handling alert message:', error);
    throw error; // Let SQS retry
  }
}

/**
 * Get next incident number for organization
 */
async function getNextIncidentNumber(orgId: string): Promise<number> {
  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);

  const lastIncident = await incidentRepo.findOne({
    where: { orgId },
    order: { incidentNumber: 'DESC' },
  });

  return (lastIncident?.incidentNumber || 0) + 1;
}

/**
 * Routing rule evaluation result
 */
interface RoutingResult {
  matchedRule: AlertRoutingRule | null;
  targetServiceId: string | null;
  setSeverity: 'info' | 'warning' | 'error' | 'critical' | null;
}

/**
 * Evaluate routing rules against an incoming alert
 * Rules are evaluated in order (by ruleOrder), first match wins
 */
async function evaluateRoutingRules(
  orgId: string,
  message: AlertMessage,
  dataSource: any
): Promise<RoutingResult> {
  try {
    const ruleRepo = dataSource.getRepository(AlertRoutingRule);

    // Get all enabled rules for the org, ordered by ruleOrder
    const rules = await ruleRepo.find({
      where: { orgId, enabled: true },
      order: { ruleOrder: 'ASC' },
    });

    if (rules.length === 0) {
      return { matchedRule: null, targetServiceId: null, setSeverity: null };
    }

    // Build alert payload object for rule evaluation
    const alertPayload = {
      summary: message.summary,
      severity: message.severity,
      source: message.source || 'api',
      dedupKey: message.dedupKey,
      serviceId: message.serviceId,
      ...message.details,
    };

    // Evaluate rules in order
    for (const rule of rules) {
      if (rule.evaluate(alertPayload)) {
        logger.info('Alert matched routing rule', {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleOrder: rule.ruleOrder,
          targetServiceId: rule.targetServiceId,
          setSeverity: rule.setSeverity,
        });

        return {
          matchedRule: rule,
          targetServiceId: rule.targetServiceId,
          setSeverity: rule.setSeverity,
        };
      }
    }

    // No rules matched
    return { matchedRule: null, targetServiceId: null, setSeverity: null };
  } catch (error) {
    logger.error('Error evaluating routing rules:', error);
    // On error, return no match - don't block alert processing
    return { matchedRule: null, targetServiceId: null, setSeverity: null };
  }
}

/**
 * Trigger notifications to on-call users (PagerDuty-style with Escalation Policies)
 */
async function triggerNotifications(incident: Incident, service: Service): Promise<void> {
  try {
    // Check for escalation policy
    if (!service.escalationPolicy) {
      logger.warn('Service has no escalation policy assigned, no notifications sent', {
        serviceId: service.id,
        incidentId: incident.id,
      });
      return;
    }

    const escalationPolicy = service.escalationPolicy;

    // Get first escalation step
    if (!escalationPolicy.steps || escalationPolicy.steps.length === 0) {
      logger.warn('Escalation policy has no steps configured, no notifications sent', {
        escalationPolicyId: escalationPolicy.id,
        incidentId: incident.id,
      });
      return;
    }

    // Sort steps by order and get first step
    const firstStep = escalationPolicy.steps.sort((a, b) => a.stepOrder - b.stepOrder)[0];

    if (!firstStep) {
      logger.warn('No escalation steps found', {
        escalationPolicyId: escalationPolicy.id,
        incidentId: incident.id,
      });
      return;
    }

    // For MVP, only handle schedule-type escalation targets
    if (firstStep.targetType !== 'schedule' || !firstStep.schedule) {
      logger.warn('First escalation step is not a schedule or schedule not loaded', {
        escalationPolicyId: escalationPolicy.id,
        stepId: firstStep.id,
        targetType: firstStep.targetType,
        incidentId: incident.id,
      });
      return;
    }

    const schedule = firstStep.schedule;
    const oncallUserId = schedule.getCurrentOncallUserId();

    if (!oncallUserId) {
      logger.warn('No on-call user in schedule, no notifications sent', {
        scheduleId: schedule.id,
        incidentId: incident.id,
      });
      return;
    }

    const priority = incident.severity === 'critical' || incident.severity === 'error' ? 'high' : 'normal';

    // Send push notification
    await sendNotificationMessage({
      incidentId: incident.id,
      userId: oncallUserId,
      channel: 'push',
      priority,
      incidentState: 'triggered',
    });

    // Send email notification
    await sendNotificationMessage({
      incidentId: incident.id,
      userId: oncallUserId,
      channel: 'email',
      priority,
      incidentState: 'triggered',
    });

    // For critical/error incidents, also send SMS
    if (incident.severity === 'critical' || incident.severity === 'error') {
      await sendNotificationMessage({
        incidentId: incident.id,
        userId: oncallUserId,
        channel: 'sms',
        priority: 'high',
        incidentState: 'triggered',
      });
    }

    logger.info('Notifications queued for on-call user (via escalation policy)', {
      incidentId: incident.id,
      userId: oncallUserId,
      escalationPolicyId: escalationPolicy.id,
      scheduleId: schedule.id,
      channels: ['push', 'email', ...(incident.severity === 'critical' || incident.severity === 'error' ? ['sms'] : [])],
    });
  } catch (error) {
    logger.error('Error triggering notifications:', error);
    // Don't throw - incident is created, notification failure shouldn't fail alert processing
  }
}

async function startWorker() {
  try {
    logger.info('Starting alert processor worker...');

    if (!QUEUE_URL) {
      throw new Error('ALERTS_QUEUE_URL environment variable not set');
    }

    // Initialize database connection
    logger.info('Connecting to database...');
    await getDataSource();
    logger.info('Database connected successfully');

    logger.info(`Alert processor worker started, listening to queue: ${QUEUE_URL}`);

    // Start processing queue
    await processQueue<AlertMessage>(QUEUE_URL, handleAlertMessage, {
      batchSize: 1,
    });
  } catch (error) {
    logger.error('Failed to start alert processor worker:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the worker
startWorker();
