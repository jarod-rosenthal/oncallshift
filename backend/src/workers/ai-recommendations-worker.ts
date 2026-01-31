import 'dotenv/config';
import { initSentry } from '../shared/config/sentry';

// Initialize Sentry for this worker
initSentry({ workerName: 'ai-recommendations-worker' });

import { getDataSource } from '../shared/db/data-source';
import {
  Organization,
  Incident,
  Service,
  Runbook,
  Schedule,
  User,
} from '../shared/models';
import { AIRecommendation, RecommendationType, RecommendationSeverity } from '../shared/models/AIRecommendation';
import { logger } from '../shared/utils/logger';
import { LessThan } from 'typeorm';

// Default: run every 6 hours (configurable via env var)
const CHECK_INTERVAL_MS = parseInt(process.env.AI_RECOMMENDATIONS_INTERVAL_MS || String(6 * 60 * 60 * 1000), 10);

// Expiration for recommendations (default 7 days)
const RECOMMENDATION_EXPIRY_DAYS = parseInt(process.env.RECOMMENDATION_EXPIRY_DAYS || '7', 10);

interface AnalysisContext {
  orgId: string;
  now: Date;
  thirtyDaysAgo: Date;
  sevenDaysAgo: Date;
}

/**
 * AI Recommendations Worker
 *
 * Analyzes organization data and generates proactive recommendations
 * for improving incident management practices.
 */

/**
 * Main analysis function - runs all analyzers for each organization
 */
async function analyzeOrganizations(): Promise<void> {
  try {
    const dataSource = await getDataSource();
    const orgRepo = dataSource.getRepository(Organization);

    // Get all active organizations
    const organizations = await orgRepo.find({
      where: { status: 'active' },
    });

    if (organizations.length === 0) {
      logger.debug('No active organizations to analyze');
      return;
    }

    logger.info(`Analyzing ${organizations.length} organizations for recommendations`);

    for (const org of organizations) {
      try {
        await analyzeOrganization(org.id);
      } catch (error) {
        logger.error('Error analyzing organization:', {
          orgId: org.id,
          error,
        });
      }
    }
  } catch (error) {
    logger.error('Error in AI recommendations analysis:', error);
  }
}

/**
 * Analyze a single organization and generate recommendations
 */
async function analyzeOrganization(orgId: string): Promise<void> {
  const dataSource = await getDataSource();
  const recommendationRepo = dataSource.getRepository(AIRecommendation);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const context: AnalysisContext = { orgId, now, thirtyDaysAgo, sevenDaysAgo };

  logger.debug(`Analyzing organization ${orgId}`);

  // Run all analyzers in parallel
  const [
    oncallFairnessRecs,
    alertNoiseRecs,
    runbookCoverageRecs,
    escalationEffectivenessRecs,
    mttrTrendRecs,
    scheduleGapRecs,
    serviceHealthRecs,
  ] = await Promise.all([
    analyzeOncallFairness(context),
    analyzeAlertNoise(context),
    analyzeRunbookCoverage(context),
    analyzeEscalationEffectiveness(context),
    analyzeMttrTrends(context),
    analyzeScheduleGaps(context),
    analyzeServiceHealth(context),
  ]);

  // Combine all recommendations
  const allRecommendations = [
    ...oncallFairnessRecs,
    ...alertNoiseRecs,
    ...runbookCoverageRecs,
    ...escalationEffectivenessRecs,
    ...mttrTrendRecs,
    ...scheduleGapRecs,
    ...serviceHealthRecs,
  ];

  // Expire old pending recommendations
  await recommendationRepo.update(
    {
      orgId,
      status: 'pending',
      expiresAt: LessThan(now),
    },
    {
      status: 'expired',
    }
  );

  // Check for duplicates and save new recommendations
  for (const rec of allRecommendations) {
    // Check if a similar pending recommendation already exists
    const existing = await recommendationRepo.findOne({
      where: {
        orgId,
        type: rec.type,
        status: 'pending',
        title: rec.title,
      },
    });

    if (!existing) {
      const expiresAt = new Date(now.getTime() + RECOMMENDATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const recommendation = recommendationRepo.create({
        ...rec,
        orgId,
        expiresAt,
      });
      await recommendationRepo.save(recommendation);

      logger.info('Created recommendation', {
        orgId,
        type: rec.type,
        title: rec.title,
        severity: rec.severity,
      });
    }
  }
}

/**
 * Analyze on-call fairness - check for uneven page distribution
 */
async function analyzeOncallFairness(context: AnalysisContext): Promise<Partial<AIRecommendation>[]> {
  const { orgId, thirtyDaysAgo, now } = context;
  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);
  const userRepo = dataSource.getRepository(User);

  const recommendations: Partial<AIRecommendation>[] = [];

  // Get incident counts per user who acknowledged
  const result = await incidentRepo
    .createQueryBuilder('incident')
    .select('incident.acknowledged_by', 'userId')
    .addSelect('COUNT(*)', 'count')
    .where('incident.org_id = :orgId', { orgId })
    .andWhere('incident.acknowledged_at BETWEEN :start AND :end', {
      start: thirtyDaysAgo,
      end: now,
    })
    .andWhere('incident.acknowledged_by IS NOT NULL')
    .groupBy('incident.acknowledged_by')
    .getRawMany();

  if (result.length < 2) {
    return recommendations;
  }

  // Calculate distribution metrics
  const counts = result.map((r: { userId: string; count: string }) => parseInt(r.count, 10));
  const total = counts.reduce((a, b) => a + b, 0);
  const avg = total / counts.length;
  const max = Math.max(...counts);
  const min = Math.min(...counts);

  // Check for significant imbalance (someone handles >50% more than average)
  const imbalanceThreshold = avg * 1.5;
  const overloadedUsers = result.filter(
    (r: { userId: string; count: string }) => parseInt(r.count, 10) > imbalanceThreshold
  );

  if (overloadedUsers.length > 0) {
    // Get user names
    const userIds = overloadedUsers.map((u: { userId: string }) => u.userId);
    const users = await userRepo.findByIds(userIds);
    const userNames = users.map((u) => u.fullName || u.email).join(', ');

    recommendations.push({
      type: 'oncall_fairness' as RecommendationType,
      severity: 'warning' as RecommendationSeverity,
      title: 'Uneven on-call page distribution detected',
      description: `In the past 30 days, some team members have handled significantly more incidents than others. ${userNames} handled ${Math.round(max / avg * 100)}% of the average workload. Consider adjusting rotation schedules for better balance.`,
      suggestedAction: 'Review and adjust on-call schedules to distribute pages more evenly across team members.',
      autoFixAvailable: false,
      metadata: {
        period: '30 days',
        averageIncidents: Math.round(avg),
        maxIncidents: max,
        minIncidents: min,
        overloadedUsers: overloadedUsers.map((u: { userId: string; count: string }) => ({
          userId: u.userId,
          count: parseInt(u.count, 10),
        })),
      },
    });
  }

  return recommendations;
}

/**
 * Analyze alert noise - find frequently triggered but rarely actioned alerts
 */
async function analyzeAlertNoise(context: AnalysisContext): Promise<Partial<AIRecommendation>[]> {
  const { orgId, thirtyDaysAgo, now } = context;
  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);
  const serviceRepo = dataSource.getRepository(Service);

  const recommendations: Partial<AIRecommendation>[] = [];

  // Find incidents grouped by dedup_key with high trigger count but low resolution rate
  const result = await incidentRepo
    .createQueryBuilder('incident')
    .select('incident.dedup_key', 'dedupKey')
    .addSelect('incident.service_id', 'serviceId')
    .addSelect('COUNT(*)', 'totalCount')
    .addSelect('SUM(CASE WHEN incident.state = \'resolved\' THEN 1 ELSE 0 END)', 'resolvedCount')
    .addSelect('AVG(CASE WHEN incident.resolved_at IS NOT NULL THEN EXTRACT(EPOCH FROM (incident.resolved_at - incident.triggered_at)) ELSE NULL END)', 'avgResolutionSeconds')
    .where('incident.org_id = :orgId', { orgId })
    .andWhere('incident.triggered_at BETWEEN :start AND :end', {
      start: thirtyDaysAgo,
      end: now,
    })
    .andWhere('incident.dedup_key IS NOT NULL')
    .groupBy('incident.dedup_key')
    .addGroupBy('incident.service_id')
    .having('COUNT(*) >= :minCount', { minCount: 5 })
    .getRawMany();

  for (const r of result) {
    const totalCount = parseInt(r.totalCount, 10);
    const resolvedCount = parseInt(r.resolvedCount, 10);
    const avgResolutionSeconds = parseFloat(r.avgResolutionSeconds) || 0;

    // Check for auto-resolved or quickly resolved alerts (< 2 min avg resolution)
    const quickResolutionThreshold = 120; // 2 minutes
    if (avgResolutionSeconds > 0 && avgResolutionSeconds < quickResolutionThreshold && totalCount >= 10) {
      const service = await serviceRepo.findOne({ where: { id: r.serviceId } });
      const serviceName = service?.name || 'Unknown service';

      recommendations.push({
        type: 'alert_noise' as RecommendationType,
        severity: 'warning' as RecommendationSeverity,
        title: `High-frequency auto-resolving alerts from ${serviceName}`,
        description: `The alert "${r.dedupKey}" has triggered ${totalCount} times in 30 days with an average resolution time of ${Math.round(avgResolutionSeconds)}s. This may indicate flapping or overly sensitive thresholds.`,
        suggestedAction: 'Consider adjusting alert thresholds, adding hysteresis, or implementing alert grouping to reduce noise.',
        autoFixAvailable: false,
        metadata: {
          dedupKey: r.dedupKey,
          serviceId: r.serviceId,
          serviceName,
          totalCount,
          resolvedCount,
          avgResolutionSeconds: Math.round(avgResolutionSeconds),
        },
      });
    }
  }

  return recommendations;
}

/**
 * Analyze runbook coverage - find services without runbooks
 */
async function analyzeRunbookCoverage(context: AnalysisContext): Promise<Partial<AIRecommendation>[]> {
  const { orgId, thirtyDaysAgo, now } = context;
  const dataSource = await getDataSource();
  const serviceRepo = dataSource.getRepository(Service);
  const runbookRepo = dataSource.getRepository(Runbook);
  const incidentRepo = dataSource.getRepository(Incident);

  const recommendations: Partial<AIRecommendation>[] = [];

  // Get all active services
  const services = await serviceRepo.find({
    where: { orgId, status: 'active' },
  });

  // Get services that have runbooks
  const servicesWithRunbooks = await runbookRepo
    .createQueryBuilder('runbook')
    .select('DISTINCT runbook.service_id', 'serviceId')
    .where('runbook.org_id = :orgId', { orgId })
    .andWhere('runbook.is_active = true')
    .getRawMany();

  const servicesWithRunbookIds = new Set(servicesWithRunbooks.map((r: { serviceId: string }) => r.serviceId));

  // Get incident counts per service in the last 30 days
  const incidentCounts = await incidentRepo
    .createQueryBuilder('incident')
    .select('incident.service_id', 'serviceId')
    .addSelect('COUNT(*)', 'count')
    .where('incident.org_id = :orgId', { orgId })
    .andWhere('incident.triggered_at BETWEEN :start AND :end', {
      start: thirtyDaysAgo,
      end: now,
    })
    .groupBy('incident.service_id')
    .getRawMany();

  const incidentCountMap = new Map(
    incidentCounts.map((r: { serviceId: string; count: string }) => [r.serviceId, parseInt(r.count, 10)])
  );

  // Find high-incident services without runbooks
  const servicesNeedingRunbooks = services.filter((s) => {
    const incidentCount = incidentCountMap.get(s.id) || 0;
    const hasRunbook = servicesWithRunbookIds.has(s.id);
    return incidentCount >= 3 && !hasRunbook;
  });

  if (servicesNeedingRunbooks.length > 0) {
    for (const service of servicesNeedingRunbooks) {
      const incidentCount = incidentCountMap.get(service.id) || 0;

      recommendations.push({
        type: 'runbook_coverage' as RecommendationType,
        severity: incidentCount >= 10 ? 'critical' as RecommendationSeverity : 'warning' as RecommendationSeverity,
        title: `Service "${service.name}" has no runbooks`,
        description: `The service "${service.name}" has had ${incidentCount} incidents in the past 30 days but has no runbooks defined. Runbooks help responders resolve incidents faster and more consistently.`,
        suggestedAction: `Create a runbook for "${service.name}" documenting common issues and resolution steps.`,
        autoFixAvailable: false,
        metadata: {
          serviceId: service.id,
          serviceName: service.name,
          incidentCount,
        },
      });
    }
  }

  return recommendations;
}

/**
 * Analyze escalation effectiveness - check for high escalation rates
 */
async function analyzeEscalationEffectiveness(context: AnalysisContext): Promise<Partial<AIRecommendation>[]> {
  const { orgId, thirtyDaysAgo, now } = context;
  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);
  const serviceRepo = dataSource.getRepository(Service);

  const recommendations: Partial<AIRecommendation>[] = [];

  // Get incidents grouped by service with escalation stats
  const result = await incidentRepo
    .createQueryBuilder('incident')
    .select('incident.service_id', 'serviceId')
    .addSelect('COUNT(*)', 'totalCount')
    .addSelect('SUM(CASE WHEN incident.current_escalation_step > 1 THEN 1 ELSE 0 END)', 'escalatedCount')
    .where('incident.org_id = :orgId', { orgId })
    .andWhere('incident.triggered_at BETWEEN :start AND :end', {
      start: thirtyDaysAgo,
      end: now,
    })
    .groupBy('incident.service_id')
    .having('COUNT(*) >= :minCount', { minCount: 5 })
    .getRawMany();

  for (const r of result) {
    const totalCount = parseInt(r.totalCount, 10);
    const escalatedCount = parseInt(r.escalatedCount, 10);
    const escalationRate = escalatedCount / totalCount;

    // Flag if > 40% of incidents escalate
    if (escalationRate > 0.4) {
      const service = await serviceRepo.findOne({ where: { id: r.serviceId } });
      const serviceName = service?.name || 'Unknown service';

      recommendations.push({
        type: 'escalation_effectiveness' as RecommendationType,
        severity: escalationRate > 0.6 ? 'critical' as RecommendationSeverity : 'warning' as RecommendationSeverity,
        title: `High escalation rate for "${serviceName}"`,
        description: `${Math.round(escalationRate * 100)}% of incidents for "${serviceName}" required escalation in the past 30 days (${escalatedCount}/${totalCount}). This may indicate issues with first-responder availability or training.`,
        suggestedAction: 'Review on-call schedules for coverage gaps, increase escalation timeouts, or provide additional training for first responders.',
        autoFixAvailable: false,
        metadata: {
          serviceId: r.serviceId,
          serviceName,
          totalCount,
          escalatedCount,
          escalationRate: Math.round(escalationRate * 100),
        },
      });
    }
  }

  return recommendations;
}

/**
 * Analyze MTTR trends - check for degrading response times
 */
async function analyzeMttrTrends(context: AnalysisContext): Promise<Partial<AIRecommendation>[]> {
  const { orgId, now } = context;
  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);

  const recommendations: Partial<AIRecommendation>[] = [];

  // Compare MTTR between last 7 days and previous 7 days
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get MTTR for previous week (8-14 days ago)
  const previousWeekMttr = await incidentRepo
    .createQueryBuilder('incident')
    .select('AVG(EXTRACT(EPOCH FROM (incident.resolved_at - incident.triggered_at)))', 'avgMttr')
    .addSelect('COUNT(*)', 'count')
    .where('incident.org_id = :orgId', { orgId })
    .andWhere('incident.resolved_at IS NOT NULL')
    .andWhere('incident.triggered_at BETWEEN :start AND :end', {
      start: fourteenDaysAgo,
      end: sevenDaysAgo,
    })
    .getRawOne();

  // Get MTTR for current week (last 7 days)
  const currentWeekMttr = await incidentRepo
    .createQueryBuilder('incident')
    .select('AVG(EXTRACT(EPOCH FROM (incident.resolved_at - incident.triggered_at)))', 'avgMttr')
    .addSelect('COUNT(*)', 'count')
    .where('incident.org_id = :orgId', { orgId })
    .andWhere('incident.resolved_at IS NOT NULL')
    .andWhere('incident.triggered_at BETWEEN :start AND :end', {
      start: sevenDaysAgo,
      end: now,
    })
    .getRawOne();

  const prevMttr = parseFloat(previousWeekMttr?.avgMttr) || 0;
  const currMttr = parseFloat(currentWeekMttr?.avgMttr) || 0;
  const prevCount = parseInt(previousWeekMttr?.count, 10) || 0;
  const currCount = parseInt(currentWeekMttr?.count, 10) || 0;

  // Only analyze if we have sufficient data
  if (prevCount >= 3 && currCount >= 3 && prevMttr > 0) {
    const mttrChange = (currMttr - prevMttr) / prevMttr;

    // Flag if MTTR increased by more than 25%
    if (mttrChange > 0.25) {
      const formatDuration = (seconds: number): string => {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        return `${(seconds / 3600).toFixed(1)}h`;
      };

      recommendations.push({
        type: 'mttr_trend' as RecommendationType,
        severity: mttrChange > 0.5 ? 'critical' as RecommendationSeverity : 'warning' as RecommendationSeverity,
        title: 'Mean Time to Resolve (MTTR) is increasing',
        description: `Your MTTR has increased by ${Math.round(mttrChange * 100)}% this week (${formatDuration(currMttr)}) compared to last week (${formatDuration(prevMttr)}). This indicates incidents are taking longer to resolve.`,
        suggestedAction: 'Review recent incidents for common blockers, ensure runbooks are up-to-date, and verify on-call responders have adequate access and training.',
        autoFixAvailable: false,
        metadata: {
          previousWeekMttrSeconds: Math.round(prevMttr),
          currentWeekMttrSeconds: Math.round(currMttr),
          previousWeekCount: prevCount,
          currentWeekCount: currCount,
          changePercent: Math.round(mttrChange * 100),
        },
      });
    }
  }

  return recommendations;
}

/**
 * Analyze schedule gaps - check for periods without on-call coverage
 */
async function analyzeScheduleGaps(context: AnalysisContext): Promise<Partial<AIRecommendation>[]> {
  const { orgId } = context;
  const dataSource = await getDataSource();
  const scheduleRepo = dataSource.getRepository(Schedule);

  const recommendations: Partial<AIRecommendation>[] = [];

  // Get all schedules
  const schedules = await scheduleRepo.find({
    where: { orgId },
    relations: ['layers', 'layers.members'],
  });

  for (const schedule of schedules) {
    // Check if schedule has any members
    const hasMembers = schedule.layers?.some((layer) => layer.members?.length > 0);
    const hasLegacyOncall = schedule.currentOncallUserId != null;

    if (!hasMembers && !hasLegacyOncall) {
      recommendations.push({
        type: 'schedule_gap' as RecommendationType,
        severity: 'critical' as RecommendationSeverity,
        title: `Schedule "${schedule.name}" has no on-call coverage`,
        description: `The schedule "${schedule.name}" has no members assigned. Any incidents routed through this schedule will have no one to notify.`,
        suggestedAction: `Add team members to the schedule "${schedule.name}" to ensure 24/7 coverage.`,
        autoFixAvailable: false,
        metadata: {
          scheduleId: schedule.id,
          scheduleName: schedule.name,
        },
      });
    }
  }

  return recommendations;
}

/**
 * Analyze service health - check for services with frequent critical incidents
 */
async function analyzeServiceHealth(context: AnalysisContext): Promise<Partial<AIRecommendation>[]> {
  const { orgId, sevenDaysAgo, now } = context;
  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);
  const serviceRepo = dataSource.getRepository(Service);

  const recommendations: Partial<AIRecommendation>[] = [];

  // Get critical incident counts per service in last 7 days
  const result = await incidentRepo
    .createQueryBuilder('incident')
    .select('incident.service_id', 'serviceId')
    .addSelect('COUNT(*)', 'count')
    .where('incident.org_id = :orgId', { orgId })
    .andWhere('incident.severity = :severity', { severity: 'critical' })
    .andWhere('incident.triggered_at BETWEEN :start AND :end', {
      start: sevenDaysAgo,
      end: now,
    })
    .groupBy('incident.service_id')
    .having('COUNT(*) >= :minCount', { minCount: 3 })
    .getRawMany();

  for (const r of result) {
    const count = parseInt(r.count, 10);
    const service = await serviceRepo.findOne({ where: { id: r.serviceId } });
    const serviceName = service?.name || 'Unknown service';

    recommendations.push({
      type: 'service_health' as RecommendationType,
      severity: count >= 5 ? 'critical' as RecommendationSeverity : 'warning' as RecommendationSeverity,
      title: `Service "${serviceName}" has frequent critical incidents`,
      description: `The service "${serviceName}" has had ${count} critical incidents in the past 7 days. This may indicate underlying infrastructure or code issues that need attention.`,
      suggestedAction: 'Investigate root causes, review recent deployments, check infrastructure metrics, and consider a postmortem if not already conducted.',
      autoFixAvailable: false,
      metadata: {
        serviceId: r.serviceId,
        serviceName,
        criticalIncidentCount: count,
        period: '7 days',
      },
    });
  }

  return recommendations;
}

/**
 * Start the worker
 */
async function startWorker(): Promise<void> {
  try {
    logger.info('Starting AI recommendations worker...');

    // Initialize database connection
    logger.info('Connecting to database...');
    await getDataSource();
    logger.info('Database connected successfully');

    const intervalMinutes = Math.round(CHECK_INTERVAL_MS / 1000 / 60);
    logger.info(`AI recommendations worker started, analyzing every ${intervalMinutes} minutes`);

    // Run initial analysis
    await analyzeOrganizations();

    // Run check loop
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS));
      await analyzeOrganizations();
    }
  } catch (error) {
    logger.error('Failed to start AI recommendations worker:', error);
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
