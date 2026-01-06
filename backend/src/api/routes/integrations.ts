import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { authenticateRequest } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Integration, IntegrationType, Service } from '../../shared/models';
import { getIntegrationService } from '../../shared/services/integration-service';
import { createSlackIntegration } from '../../shared/services/slack-integration';
import { logger } from '../../shared/utils/logger';
import { parsePaginationParams, paginatedResponse, validateSortField } from '../../shared/utils/pagination';
import { paginationValidators } from '../../shared/validators/pagination';
import { notFound, internalError } from '../../shared/utils/problem-details';

const router = Router();

// ==================== Slack Signature Verification ====================

/**
 * Verify Slack request signature using HMAC-SHA256.
 *
 * Slack signs requests with a timestamp and signature in headers.
 * This prevents spoofing attacks where someone pretends to be Slack.
 *
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
function verifySlackSignature(req: Request): { valid: boolean; error?: string } {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    // Security: Fail closed when signing secret is not configured
    // This prevents accepting unsigned requests from potential attackers
    logger.error('SLACK_SIGNING_SECRET not configured - rejecting request for security');
    return { valid: false, error: 'Slack signing secret not configured' };
  }

  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const slackSignature = req.headers['x-slack-signature'] as string;

  // Check for required headers
  if (!timestamp || !slackSignature) {
    return { valid: false, error: 'Missing Slack signature headers' };
  }

  // Prevent replay attacks - reject requests older than 5 minutes
  const requestTimestamp = parseInt(timestamp, 10);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const fiveMinutesInSeconds = 5 * 60;

  if (Math.abs(currentTimestamp - requestTimestamp) > fiveMinutesInSeconds) {
    return { valid: false, error: 'Request timestamp too old (possible replay attack)' };
  }

  // Get raw body for signature verification
  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    logger.error('Raw body not available for Slack signature verification');
    return { valid: false, error: 'Internal error: raw body not available' };
  }

  // Create the signature base string: v0:timestamp:body
  const sigBaseString = `v0:${timestamp}:${rawBody.toString()}`;

  // Calculate expected signature using HMAC-SHA256
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBaseString)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(slackSignature)
    );

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true };
  } catch {
    // timingSafeEqual throws if buffers have different lengths
    return { valid: false, error: 'Invalid signature format' };
  }
}

// ==================== Webhook for Slack Interactive Components ====================
// NOTE: This endpoint must be BEFORE authenticateUser middleware since Slack
// doesn't send JWT tokens - it uses signature verification instead.

/**
 * POST /api/v1/integrations/slack/interactions
 * Handle Slack interactive components (buttons, etc.)
 * Note: This endpoint needs to be added to Slack app configuration
 */
router.post('/slack/interactions', async (req: Request, res: Response) => {
  try {
    // Verify Slack signature to prevent spoofing attacks
    const signatureResult = verifySlackSignature(req);
    if (!signatureResult.valid) {
      logger.warn('Slack signature verification failed', {
        error: signatureResult.error,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return res.status(401).json({ error: 'Unauthorized: ' + signatureResult.error });
    }

    // Slack sends payload as form-urlencoded with a 'payload' field
    const payload = JSON.parse(req.body.payload || '{}');

    if (!payload.type) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    if (payload.type === 'block_actions') {
      const dataSource = await getDataSource();
      const slackIntegration = createSlackIntegration(dataSource);
      const result = await slackIntegration.handleInteraction(payload);

      return res.json(result);
    }

    return res.json({ ok: true });
  } catch (error) {
    logger.error('Error handling Slack interaction:', error);
    return internalError(res);
  }
});

// All routes below require authentication (supports JWT, service API key, and org API key)
router.use(authenticateRequest);

/**
 * GET /api/v1/integrations
 * List all integrations for the org
 */
router.get('/', [...paginationValidators], async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const type = req.query.type as IntegrationType | undefined;
    const pagination = parsePaginationParams(req.query);
    const sortField = validateSortField('integrations', pagination.sort, 'createdAt');
    const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';

    const dataSource = await getDataSource();
    const integrationRepo = dataSource.getRepository(Integration);

    const where: any = { orgId };
    if (type) {
      where.type = type;
    }

    const [integrations, total] = await integrationRepo.findAndCount({
      where,
      order: { [sortField]: sortOrder },
      skip: pagination.offset,
      take: pagination.limit,
    });

    const lastItem = integrations[integrations.length - 1];
    return res.json(paginatedResponse(
      integrations.map(formatIntegration),
      total,
      pagination,
      lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
      'integrations'
    ));
  } catch (error) {
    logger.error('Error fetching integrations:', error);
    return internalError(res);
  }
});

/**
 * GET /api/v1/integrations/:id
 * Get a single integration
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const integrationService = getIntegrationService(dataSource);

    const integration = await integrationService.getIntegration(id, orgId);

    if (!integration) {
      return notFound(res, 'Integration', id);
    }

    return res.json({ integration: formatIntegration(integration) });
  } catch (error) {
    logger.error('Error fetching integration:', error);
    return internalError(res);
  }
});

/**
 * POST /api/v1/integrations
 * Create a new integration
 */
router.post(
  '/',
  [
    body('type').isIn(['slack', 'teams', 'jira', 'servicenow', 'webhook', 'pagerduty_import']),
    body('name').isString().trim().notEmpty(),
    body('config').optional().isObject(),
    body('features').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const { type, name, config, features } = req.body;

      const dataSource = await getDataSource();
      const integrationService = getIntegrationService(dataSource);

      const integration = await integrationService.createIntegration({
        orgId,
        type,
        name,
        createdBy: userId,
        config,
        features,
      });

      logger.info('Integration created', { integrationId: integration.id, type, orgId });

      return res.status(201).json({
        integration: formatIntegration(integration),
        message: 'Integration created successfully',
      });
    } catch (error) {
      logger.error('Error creating integration:', error);
      return internalError(res);
    }
  }
);

/**
 * PUT /api/v1/integrations/:id
 * Update an integration
 */
router.put(
  '/:id',
  [
    body('name').optional().isString().trim().notEmpty(),
    body('config').optional().isObject(),
    body('features').optional().isObject(),
    body('status').optional().isIn(['active', 'disabled']),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { name, config, features, status } = req.body;

      const dataSource = await getDataSource();
      const integrationService = getIntegrationService(dataSource);

      const integration = await integrationService.updateIntegration(id, orgId, {
        name,
        config,
        features,
        status,
      });

      if (!integration) {
        return notFound(res, 'Integration', id);
      }

      logger.info('Integration updated', { integrationId: id, orgId });

      return res.json({
        integration: formatIntegration(integration),
        message: 'Integration updated successfully',
      });
    } catch (error) {
      logger.error('Error updating integration:', error);
      return internalError(res);
    }
  }
);

/**
 * DELETE /api/v1/integrations/:id
 * Delete an integration
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const integrationService = getIntegrationService(dataSource);

    const deleted = await integrationService.deleteIntegration(id, orgId);

    if (!deleted) {
      return notFound(res, 'Integration', id);
    }

    logger.info('Integration deleted', { integrationId: id, orgId });

    return res.json({ message: 'Integration deleted successfully' });
  } catch (error) {
    logger.error('Error deleting integration:', error);
    return internalError(res);
  }
});

/**
 * GET /api/v1/integrations/:id/events
 * Get recent events for an integration
 */
router.get('/:id/events', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const dataSource = await getDataSource();
    const integrationService = getIntegrationService(dataSource);

    // Verify integration belongs to org
    const integration = await integrationService.getIntegration(id, orgId);
    if (!integration) {
      return notFound(res, 'Integration', id);
    }

    const events = await integrationService.getRecentEvents(id, limit);

    return res.json({
      events: events.map(e => ({
        id: e.id,
        eventType: e.eventType,
        direction: e.direction,
        status: e.status,
        errorMessage: e.errorMessage,
        incidentId: e.incidentId,
        externalId: e.externalId,
        externalUrl: e.externalUrl,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching integration events:', error);
    return internalError(res);
  }
});

// ==================== Slack-specific Routes ====================

/**
 * GET /api/v1/integrations/:id/slack/oauth-url
 * Get Slack OAuth URL for connecting
 */
router.get('/:id/slack/oauth-url', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const redirectUri = req.query.redirect_uri as string;

    if (!redirectUri) {
      return res.status(400).json({ error: 'redirect_uri is required' });
    }

    const dataSource = await getDataSource();
    const integrationService = getIntegrationService(dataSource);

    const integration = await integrationService.getIntegration(id, orgId);
    if (!integration || integration.type !== 'slack') {
      return notFound(res, 'Slack integration', id);
    }

    const slackIntegration = createSlackIntegration(dataSource);
    const oauthUrl = slackIntegration.getOAuthUrl(id, redirectUri);

    return res.json({ oauthUrl });
  } catch (error) {
    logger.error('Error getting Slack OAuth URL:', error);
    return internalError(res);
  }
});

/**
 * POST /api/v1/integrations/:id/slack/oauth-callback
 * Handle Slack OAuth callback
 */
router.post(
  '/:id/slack/oauth-callback',
  [
    body('code').isString().notEmpty(),
    body('redirect_uri').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { code, redirect_uri } = req.body;

      const dataSource = await getDataSource();
      const integrationService = getIntegrationService(dataSource);

      // Verify integration belongs to org
      const existing = await integrationService.getIntegration(id, orgId);
      if (!existing || existing.type !== 'slack') {
        return notFound(res, 'Slack integration', id);
      }

      const slackIntegration = createSlackIntegration(dataSource);
      const integration = await slackIntegration.handleOAuthCallback(code, id, redirect_uri);

      if (!integration) {
        return res.status(400).json({ error: 'OAuth callback failed' });
      }

      logger.info('Slack OAuth completed', { integrationId: id, orgId });

      return res.json({
        integration: formatIntegration(integration),
        message: 'Slack connected successfully',
      });
    } catch (error: any) {
      logger.error('Error handling Slack OAuth callback:', error);
      return res.status(500).json({ error: error.message || 'OAuth callback failed' });
    }
  }
);

/**
 * GET /api/v1/integrations/:id/slack/channels
 * List available Slack channels
 */
router.get('/:id/slack/channels', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const integrationService = getIntegrationService(dataSource);

    const integration = await integrationService.getIntegration(id, orgId);
    if (!integration || integration.type !== 'slack' || integration.status !== 'active') {
      return notFound(res, 'Active Slack integration', id);
    }

    const slackIntegration = createSlackIntegration(dataSource);
    const channels = await slackIntegration.listChannels(integration);

    return res.json({ channels });
  } catch (error) {
    logger.error('Error listing Slack channels:', error);
    return internalError(res);
  }
});

/**
 * POST /api/v1/integrations/:id/slack/test
 * Send a test message to Slack
 */
router.post(
  '/:id/slack/test',
  [body('channel_id').isString().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { channel_id } = req.body;

      const dataSource = await getDataSource();
      const integrationService = getIntegrationService(dataSource);

      const integration = await integrationService.getIntegration(id, orgId);
      if (!integration || integration.type !== 'slack' || integration.status !== 'active') {
        return notFound(res, 'Active Slack integration', id);
      }

      // Create a mock incident for testing
      const mockIncident = {
        id: 'test-' + Date.now(),
        incidentNumber: 999,
        summary: 'Test notification from OnCallShift',
        severity: 'info',
        state: 'triggered',
        triggeredAt: new Date(),
        details: { test: true, message: 'This is a test notification' },
        serviceId: 'test',
      } as any;

      const mockService = {
        id: 'test',
        name: 'Test Service',
      } as any;

      const slackIntegration = createSlackIntegration(dataSource);
      const result = await slackIntegration.sendIncidentNotification(
        integration,
        mockIncident,
        mockService,
        channel_id
      );

      if (result.success) {
        return res.json({ message: 'Test message sent successfully', messageTs: result.messageTs });
      } else {
        return res.status(400).json({ error: 'Failed to send test message' });
      }
    } catch (error) {
      logger.error('Error sending Slack test:', error);
      return internalError(res);
    }
  }
);

// ==================== Service Integration Mapping ====================

/**
 * GET /api/v1/integrations/:id/services
 * Get services linked to this integration
 */
router.get('/:id/services', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const integrationService = getIntegrationService(dataSource);

    const integration = await integrationService.getIntegration(id, orgId);
    if (!integration) {
      return notFound(res, 'Integration', id);
    }

    const serviceRepo = dataSource.getRepository(Service);
    const services = await serviceRepo
      .createQueryBuilder('s')
      .innerJoin('service_integrations', 'si', 'si.service_id = s.id')
      .where('si.integration_id = :integrationId', { integrationId: id })
      .andWhere('si.enabled = true')
      .getMany();

    return res.json({
      services: services.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
      })),
    });
  } catch (error) {
    logger.error('Error fetching integration services:', error);
    return internalError(res);
  }
});

/**
 * POST /api/v1/integrations/:id/services/:serviceId
 * Link a service to this integration
 */
router.post(
  '/:id/services/:serviceId',
  [body('config_overrides').optional().isObject()],
  async (req: Request, res: Response) => {
    try {
      const { id, serviceId } = req.params;
      const orgId = req.orgId!;
      const { config_overrides } = req.body;

      const dataSource = await getDataSource();
      const integrationService = getIntegrationService(dataSource);
      const serviceRepo = dataSource.getRepository(Service);

      // Verify integration belongs to org
      const integration = await integrationService.getIntegration(id, orgId);
      if (!integration) {
        return notFound(res, 'Integration', id);
      }

      // Verify service belongs to org
      const service = await serviceRepo.findOne({ where: { id: serviceId, orgId } });
      if (!service) {
        return notFound(res, 'Service', serviceId);
      }

      await integrationService.linkServiceToIntegration(serviceId, id, config_overrides);

      logger.info('Service linked to integration', { integrationId: id, serviceId, orgId });

      return res.json({ message: 'Service linked successfully' });
    } catch (error) {
      logger.error('Error linking service:', error);
      return internalError(res);
    }
  }
);

/**
 * DELETE /api/v1/integrations/:id/services/:serviceId
 * Unlink a service from this integration
 */
router.delete('/:id/services/:serviceId', async (req: Request, res: Response) => {
  try {
    const { id, serviceId } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const integrationService = getIntegrationService(dataSource);

    // Verify integration belongs to org
    const integration = await integrationService.getIntegration(id, orgId);
    if (!integration) {
      return notFound(res, 'Integration', id);
    }

    await integrationService.unlinkServiceFromIntegration(serviceId, id);

    logger.info('Service unlinked from integration', { integrationId: id, serviceId, orgId });

    return res.json({ message: 'Service unlinked successfully' });
  } catch (error) {
    logger.error('Error unlinking service:', error);
    return internalError(res);
  }
});

/**
 * Format integration for API response (hide sensitive data)
 */
function formatIntegration(integration: Integration) {
  return {
    id: integration.id,
    type: integration.type,
    name: integration.name,
    status: integration.status,
    config: integration.config,
    features: integration.features,
    // Slack-specific (non-sensitive)
    slackWorkspaceId: integration.slackWorkspaceId,
    slackWorkspaceName: integration.slackWorkspaceName,
    slackDefaultChannelId: integration.slackDefaultChannelId,
    // Jira-specific (non-sensitive)
    jiraSiteUrl: integration.jiraSiteUrl,
    jiraProjectKey: integration.jiraProjectKey,
    jiraIssueType: integration.jiraIssueType,
    // Webhook (partial - hide secret)
    webhookUrl: integration.webhookUrl,
    // Error info
    lastError: integration.lastError,
    lastErrorAt: integration.lastErrorAt,
    errorCount: integration.errorCount,
    // Metadata
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

export default router;
