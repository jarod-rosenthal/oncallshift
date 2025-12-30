import 'dotenv/config';
import { getDataSource } from '../shared/db/data-source';
import { sendNotificationMessage } from '../shared/queues/sqs-client';
import { Incident, IncidentEvent, Service, EscalationStep, Schedule } from '../shared/models';
import { logger } from '../shared/utils/logger';

const CHECK_INTERVAL_MS = parseInt(process.env.ESCALATION_CHECK_INTERVAL_MS || '30000', 10); // Default 30 seconds

/**
 * Escalation Timer Worker
 *
 * Checks for incidents that have exceeded their escalation timeout
 * and escalates them to the next step in the escalation policy.
 */
async function checkAndEscalateIncidents(): Promise<void> {
  try {
    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);
    const serviceRepo = dataSource.getRepository(Service);
    const scheduleRepo = dataSource.getRepository(Schedule);

    // Find all triggered incidents (not acknowledged or resolved)
    const triggeredIncidents = await incidentRepo.find({
      where: { state: 'triggered' },
      relations: ['service'],
    });

    if (triggeredIncidents.length === 0) {
      return;
    }

    logger.debug(`Checking ${triggeredIncidents.length} triggered incidents for escalation`);

    for (const incident of triggeredIncidents) {
      try {
        await processIncidentEscalation(
          incident,
          serviceRepo,
          scheduleRepo,
          incidentRepo,
          eventRepo
        );
      } catch (error) {
        logger.error('Error processing escalation for incident:', {
          incidentId: incident.id,
          error,
        });
      }
    }
  } catch (error) {
    logger.error('Error in escalation timer check:', error);
  }
}

async function processIncidentEscalation(
  incident: Incident,
  serviceRepo: any,
  scheduleRepo: any,
  incidentRepo: any,
  eventRepo: any
): Promise<void> {
  // Check if snooze has expired
  if (incident.snoozedUntil !== null) {
    if (incident.isSnoozed()) {
      // Still snoozed - skip escalation
      logger.debug('Skipping escalation for snoozed incident', {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        snoozedUntil: incident.snoozedUntil,
      });
      return;
    } else {
      // Snooze expired - clear snooze and reset escalation timer
      logger.info('Snooze expired, resuming escalation', {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
      });

      // Create snooze expired event
      const snoozeExpiredEvent = eventRepo.create({
        incidentId: incident.id,
        type: 'unsnooze',
        message: 'Snooze expired, resuming escalation',
        payload: {
          expiredAt: incident.snoozedUntil,
          reason: 'expired',
        },
      });
      await eventRepo.save(snoozeExpiredEvent);

      // Clear snooze and reset escalation timer
      incident.snoozedUntil = null;
      incident.snoozedBy = null;
      incident.escalationStartedAt = new Date();
      await incidentRepo.save(incident);

      // Continue with escalation check but timeout resets
      return;
    }
  }

  // Get service with escalation policy
  const service = await serviceRepo.findOne({
    where: { id: incident.serviceId },
    relations: ['escalationPolicy', 'escalationPolicy.steps'],
  });

  if (!service?.escalationPolicy) {
    return; // No escalation policy, nothing to do
  }

  const escalationPolicy = service.escalationPolicy;
  const steps = escalationPolicy.steps.sort((a: EscalationStep, b: EscalationStep) => a.stepOrder - b.stepOrder);

  if (steps.length === 0) {
    return; // No steps configured
  }

  // Get current step
  const currentStepIndex = incident.currentEscalationStep - 1;
  if (currentStepIndex < 0 || currentStepIndex >= steps.length) {
    return; // Invalid step
  }

  const currentStep = steps[currentStepIndex];

  // Check if escalation started
  if (!incident.escalationStartedAt) {
    return; // Escalation not started yet
  }

  // Calculate timeout
  const timeoutMs = currentStep.timeoutSeconds * 1000;
  const escalationStartTime = new Date(incident.escalationStartedAt).getTime();
  const now = Date.now();
  const elapsed = now - escalationStartTime;

  if (elapsed < timeoutMs) {
    return; // Not timed out yet
  }

  // Check if there's a next step
  const nextStepIndex = currentStepIndex + 1;
  if (nextStepIndex >= steps.length) {
    // Final step reached, log and optionally create event
    logger.info('Final escalation step reached, no more escalations possible', {
      incidentId: incident.id,
      incidentNumber: incident.incidentNumber,
      currentStep: incident.currentEscalationStep,
      totalSteps: steps.length,
    });

    // Create final escalation event (optional)
    const finalEvent = eventRepo.create({
      incidentId: incident.id,
      type: 'escalate',
      message: `Final escalation step reached. No response after ${steps.length} escalation steps.`,
      payload: {
        finalStep: incident.currentEscalationStep,
        totalSteps: steps.length,
        reason: 'final_step_reached',
      },
    });
    await eventRepo.save(finalEvent);

    // Mark escalation as null to prevent repeated final events
    incident.escalationStartedAt = null;
    await incidentRepo.save(incident);
    return;
  }

  // Escalate to next step
  const nextStep = steps[nextStepIndex];
  const previousStep = incident.currentEscalationStep;

  logger.info('Escalating incident to next step', {
    incidentId: incident.id,
    incidentNumber: incident.incidentNumber,
    fromStep: previousStep,
    toStep: nextStepIndex + 1,
    timeoutSeconds: currentStep.timeoutSeconds,
  });

  // Update incident
  incident.currentEscalationStep = nextStepIndex + 1;
  incident.escalationStartedAt = new Date();
  await incidentRepo.save(incident);

  // Create escalation event
  const escalateEvent = eventRepo.create({
    incidentId: incident.id,
    type: 'escalate',
    message: `Incident escalated from step ${previousStep} to step ${nextStepIndex + 1} due to timeout`,
    payload: {
      fromStep: previousStep,
      toStep: nextStepIndex + 1,
      reason: 'timeout',
      timeoutSeconds: currentStep.timeoutSeconds,
    },
  });
  await eventRepo.save(escalateEvent);

  // Get target users for next step and send notifications
  const targetUserIds = await getStepTargetUsers(nextStep, scheduleRepo);

  if (targetUserIds.length === 0) {
    logger.warn('No target users found for escalation step', {
      incidentId: incident.id,
      step: nextStepIndex + 1,
      targetType: nextStep.targetType,
    });
    return;
  }

  // Determine priority based on incident severity
  const priority = incident.severity === 'critical' || incident.severity === 'error' ? 'high' : 'normal';

  // Send notifications to all target users
  for (const userId of targetUserIds) {
    // Send push notification
    await sendNotificationMessage({
      incidentId: incident.id,
      userId,
      channel: 'push',
      priority,
      incidentState: 'triggered',
    });

    // Send email notification
    await sendNotificationMessage({
      incidentId: incident.id,
      userId,
      channel: 'email',
      priority,
      incidentState: 'triggered',
    });

    // For critical/error incidents, also send SMS
    if (incident.severity === 'critical' || incident.severity === 'error') {
      await sendNotificationMessage({
        incidentId: incident.id,
        userId,
        channel: 'sms',
        priority: 'high',
        incidentState: 'triggered',
      });
    }
  }

  logger.info('Escalation notifications sent', {
    incidentId: incident.id,
    step: nextStepIndex + 1,
    targetUserCount: targetUserIds.length,
    channels: ['push', 'email', ...(incident.severity === 'critical' || incident.severity === 'error' ? ['sms'] : [])],
  });
}

async function getStepTargetUsers(
  step: EscalationStep,
  scheduleRepo: any
): Promise<string[]> {
  if (step.targetType === 'users' && step.userIds) {
    // Direct user targeting
    return step.userIds;
  }

  if (step.targetType === 'schedule' && step.scheduleId) {
    // Schedule-based targeting
    const schedule = await scheduleRepo.findOne({
      where: { id: step.scheduleId },
    });

    if (schedule) {
      const oncallUserId = schedule.getCurrentOncallUserId();
      if (oncallUserId) {
        return [oncallUserId];
      }
    }
  }

  return [];
}

async function startWorker() {
  try {
    logger.info('Starting escalation timer worker...');

    // Initialize database connection
    logger.info('Connecting to database...');
    await getDataSource();
    logger.info('Database connected successfully');

    logger.info(`Escalation timer worker started, checking every ${CHECK_INTERVAL_MS}ms`);

    // Run check loop
    while (true) {
      await checkAndEscalateIncidents();
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
    }
  } catch (error) {
    logger.error('Failed to start escalation timer worker:', error);
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
