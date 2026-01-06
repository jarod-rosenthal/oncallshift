import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { AIRecommendation, RecommendationType, RecommendationStatus, AutoFixPayload } from '../../shared/models/AIRecommendation';
import { logger } from '../../shared/utils/logger';
import { In, LessThan } from 'typeorm';
import {
  autoFixService,
  AutoFixRecommendation,
  AutoFixPayload as ServiceAutoFixPayload,
  AutoFixType,
} from '../../shared/services/auto-fix-service';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/ai/recommendations
 * List recommendations for the organization
 */
router.get(
  '/recommendations',
  [
    query('status')
      .optional()
      .isIn(['pending', 'applied', 'dismissed', 'expired'])
      .withMessage('Invalid status'),
    query('type')
      .optional()
      .isIn([
        'oncall_fairness',
        'alert_noise',
        'runbook_coverage',
        'escalation_effectiveness',
        'mttr_trend',
        'schedule_gap',
        'service_health',
      ])
      .withMessage('Invalid type'),
    query('severity')
      .optional()
      .isIn(['info', 'warning', 'critical'])
      .withMessage('Invalid severity'),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const dataSource = await getDataSource();
      const recommendationRepo = dataSource.getRepository(AIRecommendation);

      const status = req.query.status as RecommendationStatus | undefined;
      const type = req.query.type as RecommendationType | undefined;
      const severity = req.query.severity as string | undefined;
      const limit = (req.query.limit as unknown as number) || 50;
      const offset = (req.query.offset as unknown as number) || 0;

      // Build where clause
      const where: Record<string, unknown> = { orgId };
      if (status) where.status = status;
      if (type) where.type = type;
      if (severity) where.severity = severity;

      // Fetch recommendations
      const [recommendations, total] = await recommendationRepo.findAndCount({
        where,
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
        relations: ['appliedByUser', 'dismissedByUser'],
      });

      // Mark expired recommendations
      const now = new Date();
      for (const rec of recommendations) {
        if (rec.status === 'pending' && rec.expiresAt && new Date(rec.expiresAt) < now) {
          rec.status = 'expired';
          await recommendationRepo.save(rec);
        }
      }

      return res.json({
        recommendations: recommendations.map(formatRecommendation),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + recommendations.length < total,
        },
      });
    } catch (error) {
      logger.error('Error fetching recommendations:', error);
      return res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
  }
);

/**
 * GET /api/v1/ai/recommendations/summary
 * Get summary counts of recommendations by status and type
 */
router.get('/recommendations/summary', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const recommendationRepo = dataSource.getRepository(AIRecommendation);

    // First, mark expired recommendations
    const now = new Date();
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

    // Get counts by status
    const statusCounts = await recommendationRepo
      .createQueryBuilder('rec')
      .select('rec.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('rec.org_id = :orgId', { orgId })
      .groupBy('rec.status')
      .getRawMany();

    // Get counts by type for pending recommendations
    const typeCounts = await recommendationRepo
      .createQueryBuilder('rec')
      .select('rec.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('rec.org_id = :orgId', { orgId })
      .andWhere('rec.status = :status', { status: 'pending' })
      .groupBy('rec.type')
      .getRawMany();

    // Get counts by severity for pending recommendations
    const severityCounts = await recommendationRepo
      .createQueryBuilder('rec')
      .select('rec.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('rec.org_id = :orgId', { orgId })
      .andWhere('rec.status = :status', { status: 'pending' })
      .groupBy('rec.severity')
      .getRawMany();

    // Format results
    const byStatus = Object.fromEntries(
      statusCounts.map((r: { status: string; count: string }) => [r.status, parseInt(r.count, 10)])
    );

    const byType = Object.fromEntries(
      typeCounts.map((r: { type: string; count: string }) => [r.type, parseInt(r.count, 10)])
    );

    const bySeverity = Object.fromEntries(
      severityCounts.map((r: { severity: string; count: string }) => [r.severity, parseInt(r.count, 10)])
    );

    return res.json({
      summary: {
        byStatus: {
          pending: byStatus.pending || 0,
          applied: byStatus.applied || 0,
          dismissed: byStatus.dismissed || 0,
          expired: byStatus.expired || 0,
        },
        byType,
        bySeverity: {
          info: bySeverity.info || 0,
          warning: bySeverity.warning || 0,
          critical: bySeverity.critical || 0,
        },
        totalPending: byStatus.pending || 0,
        totalActionable:
          typeCounts
            .map((r: { count: string }) => parseInt(r.count, 10))
            .reduce((a: number, b: number) => a + b, 0) || 0,
      },
    });
  } catch (error) {
    logger.error('Error fetching recommendations summary:', error);
    return res.status(500).json({ error: 'Failed to fetch recommendations summary' });
  }
});

/**
 * GET /api/v1/ai/recommendations/:id
 * Get a single recommendation by ID
 */
router.get(
  '/recommendations/:id',
  [param('id').isUUID().withMessage('Invalid recommendation ID')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const dataSource = await getDataSource();
      const recommendationRepo = dataSource.getRepository(AIRecommendation);

      const recommendation = await recommendationRepo.findOne({
        where: { id, orgId },
        relations: ['appliedByUser', 'dismissedByUser'],
      });

      if (!recommendation) {
        return res.status(404).json({ error: 'Recommendation not found' });
      }

      return res.json({ recommendation: formatRecommendation(recommendation) });
    } catch (error) {
      logger.error('Error fetching recommendation:', error);
      return res.status(500).json({ error: 'Failed to fetch recommendation' });
    }
  }
);

/**
 * POST /api/v1/ai/recommendations/:id/apply
 * Apply an auto-fix recommendation
 */
router.post(
  '/recommendations/:id/apply',
  [param('id').isUUID().withMessage('Invalid recommendation ID')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Only admins or super_admins can apply recommendations
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const userId = req.user!.id;
      const dataSource = await getDataSource();
      const recommendationRepo = dataSource.getRepository(AIRecommendation);

      const recommendation = await recommendationRepo.findOne({
        where: { id, orgId },
      });

      if (!recommendation) {
        return res.status(404).json({ error: 'Recommendation not found' });
      }

      if (recommendation.status !== 'pending') {
        return res.status(400).json({
          error: `Cannot apply recommendation with status "${recommendation.status}"`,
        });
      }

      if (recommendation.isExpired()) {
        recommendation.status = 'expired';
        await recommendationRepo.save(recommendation);
        return res.status(400).json({ error: 'Recommendation has expired' });
      }

      if (!recommendation.autoFixAvailable) {
        return res.status(400).json({
          error: 'This recommendation does not support auto-fix',
        });
      }

      // Execute auto-fix using the auto-fix service
      const autoFixPayload = recommendation.autoFixPayload;
      if (!autoFixPayload) {
        return res.status(400).json({
          error: 'Recommendation has no auto-fix payload',
        });
      }

      // Convert the stored payload to the service format
      const servicePayload = convertToServicePayload(recommendation.type, autoFixPayload);
      if (!servicePayload) {
        return res.status(400).json({
          error: `Unsupported recommendation type for auto-fix: ${recommendation.type}`,
        });
      }

      // Create an AutoFixRecommendation for the service
      const autoFixRecommendation: AutoFixRecommendation = {
        id: recommendation.id,
        type: servicePayload.type,
        title: recommendation.title,
        description: recommendation.description,
        impact: recommendation.severity === 'critical' ? 'high' : recommendation.severity === 'warning' ? 'medium' : 'low',
        payload: servicePayload,
        createdAt: recommendation.createdAt,
      };

      // Execute the auto-fix with transaction support
      const result = await autoFixService.executeAutoFix(orgId, userId, autoFixRecommendation);

      if (!result.success) {
        logger.error('Auto-fix failed', {
          recommendationId: id,
          type: recommendation.type,
          error: result.error,
        });
        return res.status(500).json({
          error: 'Auto-fix failed',
          message: result.message,
          details: result.error,
          changesApplied: result.changesApplied,
        });
      }

      // Mark recommendation as applied
      recommendation.apply(userId);
      await recommendationRepo.save(recommendation);

      logger.info('Recommendation applied', {
        recommendationId: id,
        type: recommendation.type,
        orgId,
        appliedBy: userId,
        changesApplied: result.changesApplied.length,
      });

      return res.json({
        recommendation: formatRecommendation(recommendation),
        message: result.message,
        changesApplied: result.changesApplied,
      });
    } catch (error) {
      logger.error('Error applying recommendation:', error);
      return res.status(500).json({ error: 'Failed to apply recommendation' });
    }
  }
);

/**
 * POST /api/v1/ai/recommendations/:id/dismiss
 * Dismiss a recommendation
 */
router.post(
  '/recommendations/:id/dismiss',
  [
    param('id').isUUID().withMessage('Invalid recommendation ID'),
    body('reason').optional().isString().trim().isLength({ max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { reason } = req.body;
      const orgId = req.orgId!;
      const userId = req.user!.id;
      const dataSource = await getDataSource();
      const recommendationRepo = dataSource.getRepository(AIRecommendation);

      const recommendation = await recommendationRepo.findOne({
        where: { id, orgId },
      });

      if (!recommendation) {
        return res.status(404).json({ error: 'Recommendation not found' });
      }

      if (recommendation.status !== 'pending') {
        return res.status(400).json({
          error: `Cannot dismiss recommendation with status "${recommendation.status}"`,
        });
      }

      recommendation.dismiss(userId, reason);
      await recommendationRepo.save(recommendation);

      logger.info('Recommendation dismissed', {
        recommendationId: id,
        type: recommendation.type,
        orgId,
        dismissedBy: userId,
        reason,
      });

      return res.json({
        recommendation: formatRecommendation(recommendation),
        message: 'Recommendation dismissed',
      });
    } catch (error) {
      logger.error('Error dismissing recommendation:', error);
      return res.status(500).json({ error: 'Failed to dismiss recommendation' });
    }
  }
);

/**
 * POST /api/v1/ai/recommendations/dismiss-all
 * Dismiss multiple recommendations at once
 */
router.post(
  '/recommendations/dismiss-all',
  [
    body('ids').isArray({ min: 1, max: 100 }).withMessage('IDs array is required (max 100)'),
    body('ids.*').isUUID().withMessage('Invalid recommendation ID'),
    body('reason').optional().isString().trim().isLength({ max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ids, reason } = req.body;
      const orgId = req.orgId!;
      const userId = req.user!.id;
      const dataSource = await getDataSource();
      const recommendationRepo = dataSource.getRepository(AIRecommendation);

      const now = new Date();

      // Update all matching pending recommendations
      const result = await recommendationRepo.update(
        {
          id: In(ids),
          orgId,
          status: 'pending',
        },
        {
          status: 'dismissed',
          dismissedAt: now,
          dismissedBy: userId,
          dismissReason: reason || null,
        }
      );

      logger.info('Recommendations dismissed in bulk', {
        count: result.affected,
        orgId,
        dismissedBy: userId,
      });

      return res.json({
        message: `Dismissed ${result.affected} recommendation(s)`,
        dismissed: result.affected,
      });
    } catch (error) {
      logger.error('Error dismissing recommendations:', error);
      return res.status(500).json({ error: 'Failed to dismiss recommendations' });
    }
  }
);

/**
 * Format recommendation for API response
 */
function formatRecommendation(rec: AIRecommendation) {
  return {
    id: rec.id,
    type: rec.type,
    severity: rec.severity,
    title: rec.title,
    description: rec.description,
    suggestedAction: rec.suggestedAction,
    autoFixAvailable: rec.autoFixAvailable,
    status: rec.status,
    metadata: rec.metadata,
    isExpired: rec.isExpired(),
    isActionable: rec.isActionable(),
    canApply: rec.canApply(),
    appliedAt: rec.appliedAt,
    appliedBy: rec.appliedByUser
      ? {
          id: rec.appliedByUser.id,
          fullName: rec.appliedByUser.fullName,
          email: rec.appliedByUser.email,
        }
      : null,
    dismissedAt: rec.dismissedAt,
    dismissedBy: rec.dismissedByUser
      ? {
          id: rec.dismissedByUser.id,
          fullName: rec.dismissedByUser.fullName,
          email: rec.dismissedByUser.email,
        }
      : null,
    dismissReason: rec.dismissReason,
    expiresAt: rec.expiresAt,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

/**
 * Convert stored AutoFixPayload to the service-specific payload format
 */
function convertToServicePayload(
  recType: RecommendationType,
  payload: AutoFixPayload
): ServiceAutoFixPayload | null {
  // Map recommendation types to auto-fix types
  const typeMapping: Record<string, AutoFixType> = {
    oncall_fairness: 'oncall_balance',
    alert_noise: 'alert_noise',
    runbook_coverage: 'runbook_coverage',
    escalation_effectiveness: 'escalation_timeout',
    schedule_gap: 'oncall_balance', // Schedule gaps can be fixed by rebalancing
  };

  const autoFixType = typeMapping[recType];
  if (!autoFixType) {
    return null;
  }

  // Build the service payload based on the stored action and params
  const servicePayload: ServiceAutoFixPayload = {
    type: autoFixType,
  };

  // Map target IDs based on target type
  switch (payload.targetType) {
    case 'schedule':
      servicePayload.scheduleId = payload.targetId;
      break;
    case 'service':
      servicePayload.serviceId = payload.targetId;
      break;
    case 'escalation_policy':
      servicePayload.escalationPolicyId = payload.targetId;
      break;
  }

  // Copy over any additional params
  if (payload.params) {
    // On-call balance params
    if (payload.params.targetDistribution) {
      servicePayload.targetDistribution = payload.params.targetDistribution;
    }
    if (payload.params.weights) {
      servicePayload.weights = payload.params.weights;
    }

    // Alert noise params
    if (payload.params.newTimeWindowMinutes !== undefined) {
      servicePayload.newTimeWindowMinutes = payload.params.newTimeWindowMinutes;
    }
    if (payload.params.newGroupingType) {
      servicePayload.newGroupingType = payload.params.newGroupingType;
    }
    if (payload.params.suppressionRules) {
      servicePayload.suppressionRules = payload.params.suppressionRules;
    }

    // Escalation timeout params
    if (payload.params.newTimeoutSeconds !== undefined) {
      servicePayload.newTimeoutSeconds = payload.params.newTimeoutSeconds;
    }
    if (payload.params.stepTimeouts) {
      servicePayload.stepTimeouts = payload.params.stepTimeouts;
    }
  }

  return servicePayload;
}

export default router;
