import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { WebhookSubscription, Service, Team } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { deliverWebhookEvent } from '../../shared/services/webhook-delivery';
import { parsePaginationParams, paginatedResponse, validateSortField, VALID_SORT_FIELDS } from '../../shared/utils/pagination';
import { paginationValidators, searchFilterValidator, uuidFilterValidator } from '../../shared/validators/pagination';
import { badRequest, notFound, internalError, validationError, fromExpressValidator } from '../../shared/utils/problem-details';

// Add webhook subscriptions to valid sort fields
VALID_SORT_FIELDS.webhookSubscriptions = ['createdAt', 'updatedAt', 'url', 'scope'];

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/webhook-subscriptions
 * List webhook subscriptions with optional scope filtering
 * Supports pagination, filtering by scope, service_id, team_id, enabled, and search
 */
router.get(
  '/',
  [
    ...paginationValidators,
    query('scope').optional().isIn(['organization', 'service', 'team']),
    uuidFilterValidator('service_id'),
    uuidFilterValidator('team_id'),
    query('enabled').optional().isBoolean().withMessage('enabled must be a boolean'),
    searchFilterValidator,
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const pagination = parsePaginationParams(req.query);
      const sortField = validateSortField('webhookSubscriptions', pagination.sort, 'createdAt');
      const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';

      const { scope, service_id, team_id, enabled, search } = req.query;

      const dataSource = await getDataSource();
      const subscriptionRepo = dataSource.getRepository(WebhookSubscription);

      // Build where conditions
      const whereConditions: any = { orgId };

      if (scope) {
        whereConditions.scope = scope;
      }
      if (service_id) {
        whereConditions.serviceId = service_id;
      }
      if (team_id) {
        whereConditions.teamId = team_id;
      }
      if (enabled !== undefined) {
        whereConditions.enabled = String(enabled) === 'true';
      }

      // For search, we need to use QueryBuilder for ILIKE support
      let subscriptions: WebhookSubscription[];
      let total: number;

      if (search) {
        const queryBuilder = subscriptionRepo.createQueryBuilder('subscription')
          .leftJoinAndSelect('subscription.service', 'service')
          .leftJoinAndSelect('subscription.team', 'team')
          .where('subscription.orgId = :orgId', { orgId });

        if (scope) {
          queryBuilder.andWhere('subscription.scope = :scope', { scope });
        }

        if (service_id) {
          queryBuilder.andWhere('subscription.serviceId = :serviceId', { serviceId: service_id });
        }

        if (team_id) {
          queryBuilder.andWhere('subscription.teamId = :teamId', { teamId: team_id });
        }

        if (enabled !== undefined) {
          queryBuilder.andWhere('subscription.enabled = :enabled', { enabled: String(enabled) === 'true' });
        }

        queryBuilder.andWhere('(subscription.url ILIKE :search OR subscription.description ILIKE :search)', {
          search: `%${search}%`,
        });

        queryBuilder
          .orderBy(`subscription.${sortField}`, sortOrder)
          .skip(pagination.offset)
          .take(pagination.limit);

        [subscriptions, total] = await queryBuilder.getManyAndCount();
      } else {
        [subscriptions, total] = await subscriptionRepo.findAndCount({
          where: whereConditions,
          relations: ['service', 'team'],
          order: { [sortField]: sortOrder },
          skip: pagination.offset,
          take: pagination.limit,
        });
      }

      const lastItem = subscriptions[subscriptions.length - 1];
      return res.json(paginatedResponse(
        subscriptions.map(formatWebhookSubscription),
        total,
        pagination,
        lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
        'webhook_subscriptions'
      ));
    } catch (error) {
      logger.error('Error fetching webhook subscriptions:', error);
      return internalError(res);
    }
  }
);

/**
 * GET /api/v1/webhook-subscriptions/:id
 * Get a single webhook subscription by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const subscriptionRepo = dataSource.getRepository(WebhookSubscription);

    const subscription = await subscriptionRepo.findOne({
      where: { id, orgId },
      relations: ['service', 'team'],
    });

    if (!subscription) {
      return notFound(res, 'Webhook subscription', id);
    }

    return res.json({ webhook_subscription: formatWebhookSubscription(subscription) });
  } catch (error) {
    logger.error('Error fetching webhook subscription:', error);
    return internalError(res);
  }
});

/**
 * POST /api/v1/webhook-subscriptions
 * Create a new webhook subscription
 */
router.post(
  '/',
  [
    body('scope').isIn(['organization', 'service', 'team']),
    body('serviceId').optional({ nullable: true }).isUUID(),
    body('teamId').optional({ nullable: true }).isUUID(),
    body('eventTypes').isArray({ min: 1 }),
    body('eventTypes.*').isString(),
    body('url').isURL({ require_protocol: true }),
    body('description').optional().isString(),
    body('enabled').optional().isBoolean(),
    body('deliveryTimeoutSeconds').optional().isInt({ min: 1, max: 60 }),
    body('maxRetries').optional().isInt({ min: 0, max: 10 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const {
        scope,
        serviceId,
        teamId,
        eventTypes,
        url,
        description,
        enabled = true,
        deliveryTimeoutSeconds = 10,
        maxRetries = 3,
      } = req.body;

      // Validate scope-specific requirements
      if (scope === 'service' && !serviceId) {
        return badRequest(res, 'serviceId is required for service scope');
      }
      if (scope === 'team' && !teamId) {
        return badRequest(res, 'teamId is required for team scope');
      }
      if (scope === 'organization' && (serviceId || teamId)) {
        return badRequest(res, 'serviceId and teamId must be null for organization scope');
      }

      const dataSource = await getDataSource();
      const subscriptionRepo = dataSource.getRepository(WebhookSubscription);

      // Verify service/team belongs to org
      if (serviceId) {
        const serviceRepo = dataSource.getRepository(Service);
        const service = await serviceRepo.findOne({ where: { id: serviceId, orgId } });
        if (!service) {
          return notFound(res, 'Service', serviceId);
        }
      }

      if (teamId) {
        const teamRepo = dataSource.getRepository(Team);
        const team = await teamRepo.findOne({ where: { id: teamId, orgId } });
        if (!team) {
          return notFound(res, 'Team', teamId);
        }
      }

      // Generate a secure random secret for HMAC signatures
      const secret = crypto.randomBytes(32).toString('hex');

      const subscription = subscriptionRepo.create({
        id: uuidv4(),
        orgId,
        scope,
        serviceId: serviceId || null,
        teamId: teamId || null,
        eventTypes,
        url,
        description: description || null,
        enabled,
        secret,
        deliveryTimeoutSeconds,
        maxRetries,
      });

      await subscriptionRepo.save(subscription);

      // Fetch subscription with relations
      const createdSubscription = await subscriptionRepo.findOne({
        where: { id: subscription.id },
        relations: ['service', 'team'],
      });

      logger.info('Webhook subscription created', { subscriptionId: subscription.id, orgId, scope });

      return res.status(201).json({
        webhook_subscription: formatWebhookSubscription(createdSubscription!),
      });
    } catch (error) {
      logger.error('Error creating webhook subscription:', error);
      return internalError(res);
    }
  }
);

/**
 * PUT /api/v1/webhook-subscriptions/:id
 * Update a webhook subscription
 */
router.put(
  '/:id',
  [
    body('eventTypes').optional().isArray({ min: 1 }),
    body('eventTypes.*').optional().isString(),
    body('url').optional().isURL({ require_protocol: true }),
    body('description').optional().isString(),
    body('enabled').optional().isBoolean(),
    body('deliveryTimeoutSeconds').optional().isInt({ min: 1, max: 60 }),
    body('maxRetries').optional().isInt({ min: 0, max: 10 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { eventTypes, url, description, enabled, deliveryTimeoutSeconds, maxRetries } = req.body;

      const dataSource = await getDataSource();
      const subscriptionRepo = dataSource.getRepository(WebhookSubscription);

      const subscription = await subscriptionRepo.findOne({
        where: { id, orgId },
      });

      if (!subscription) {
        return notFound(res, 'Webhook subscription', id);
      }

      // Update fields
      if (eventTypes !== undefined) subscription.eventTypes = eventTypes;
      if (url !== undefined) subscription.url = url;
      if (description !== undefined) subscription.description = description;
      if (enabled !== undefined) subscription.enabled = enabled;
      if (deliveryTimeoutSeconds !== undefined) subscription.deliveryTimeoutSeconds = deliveryTimeoutSeconds;
      if (maxRetries !== undefined) subscription.maxRetries = maxRetries;

      await subscriptionRepo.save(subscription);

      // Fetch updated subscription with relations
      const updatedSubscription = await subscriptionRepo.findOne({
        where: { id },
        relations: ['service', 'team'],
      });

      logger.info('Webhook subscription updated', { subscriptionId: id, orgId });

      return res.json({
        webhook_subscription: formatWebhookSubscription(updatedSubscription!),
      });
    } catch (error) {
      logger.error('Error updating webhook subscription:', error);
      return internalError(res);
    }
  }
);

/**
 * DELETE /api/v1/webhook-subscriptions/:id
 * Delete a webhook subscription
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const subscriptionRepo = dataSource.getRepository(WebhookSubscription);

    const subscription = await subscriptionRepo.findOne({
      where: { id, orgId },
    });

    if (!subscription) {
      return notFound(res, 'Webhook subscription', id);
    }

    await subscriptionRepo.remove(subscription);

    logger.info('Webhook subscription deleted', { subscriptionId: id, orgId });

    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting webhook subscription:', error);
    return internalError(res);
  }
});

/**
 * POST /api/v1/webhook-subscriptions/:id/test
 * Send a test event to the webhook subscription
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const subscriptionRepo = dataSource.getRepository(WebhookSubscription);

    const subscription = await subscriptionRepo.findOne({
      where: { id, orgId },
      relations: ['service', 'team'],
    });

    if (!subscription) {
      return notFound(res, 'Webhook subscription', id);
    }

    // Create a test event payload
    const testEvent = {
      event: {
        id: uuidv4(),
        event_type: 'webhook.test',
        resource_type: 'webhook_subscription',
        occurred_at: new Date().toISOString(),
        agent: {
          id: req.user?.id || 'unknown',
          type: 'user',
        },
        data: {
          id: subscription.id,
          type: 'webhook_subscription',
          scope: subscription.scope,
          description: subscription.description || 'Test webhook',
        },
      },
    };

    // Attempt to deliver the test event
    try {
      await deliverWebhookEvent(subscription, testEvent);

      logger.info('Test webhook delivered successfully', { subscriptionId: id, orgId });

      return res.json({
        message: 'Test webhook sent successfully',
        status: 'delivered',
      });
    } catch (deliveryError: any) {
      logger.error('Test webhook delivery failed', { subscriptionId: id, error: deliveryError });

      return res.status(500).json({
        message: 'Test webhook delivery failed',
        status: 'failed',
        error: deliveryError.message,
      });
    }
  } catch (error) {
    logger.error('Error sending test webhook:', error);
    return internalError(res);
  }
});

/**
 * Format webhook subscription for API response
 */
function formatWebhookSubscription(subscription: WebhookSubscription) {
  return {
    id: subscription.id,
    scope: subscription.scope,
    service_id: subscription.serviceId,
    team_id: subscription.teamId,
    event_types: subscription.eventTypes,
    url: subscription.url,
    description: subscription.description,
    enabled: subscription.enabled,
    delivery_timeout_seconds: subscription.deliveryTimeoutSeconds,
    max_retries: subscription.maxRetries,
    statistics: {
      total_deliveries: subscription.totalDeliveries,
      successful_deliveries: subscription.successfulDeliveries,
      failed_deliveries: subscription.failedDeliveries,
      last_delivery_at: subscription.lastDeliveryAt,
      last_delivery_status: subscription.lastDeliveryStatus,
    },
    created_at: subscription.createdAt,
    updated_at: subscription.updatedAt,
    // Note: secret is intentionally not exposed in API responses
  };
}

export default router;
