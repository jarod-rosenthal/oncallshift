import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Integration, IntegrationType, Service } from '../../shared/models';
import { getIntegrationService } from '../../shared/services/integration-service';
import { createSlackIntegration } from '../../shared/services/slack-integration';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/integrations
 * List all integrations for the org
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const type = req.query.type as IntegrationType | undefined;

    const dataSource = await getDataSource();
    const integrationService = getIntegrationService(dataSource);

    const integrations = await integrationService.getIntegrationsByOrg(orgId, type);

    return res.json({
      integrations: integrations.map(formatIntegration),
    });
  } catch (error) {
    logger.error('Error fetching integrations:', error);
    return res.status(500).json({ error: 'Failed to fetch integrations' });
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
      return res.status(404).json({ error: 'Integration not found' });
    }

    return res.json({ integration: formatIntegration(integration) });
  } catch (error) {
    logger.error('Error fetching integration:', error);
    return res.status(500).json({ error: 'Failed to fetch integration' });
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
      return res.status(500).json({ error: 'Failed to create integration' });
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
        return res.status(404).json({ error: 'Integration not found' });
      }

      logger.info('Integration updated', { integrationId: id, orgId });

      return res.json({
        integration: formatIntegration(integration),
        message: 'Integration updated successfully',
      });
    } catch (error) {
      logger.error('Error updating integration:', error);
      return res.status(500).json({ error: 'Failed to update integration' });
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
      return res.status(404).json({ error: 'Integration not found' });
    }

    logger.info('Integration deleted', { integrationId: id, orgId });

    return res.json({ message: 'Integration deleted successfully' });
  } catch (error) {
    logger.error('Error deleting integration:', error);
    return res.status(500).json({ error: 'Failed to delete integration' });
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
      return res.status(404).json({ error: 'Integration not found' });
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
    return res.status(500).json({ error: 'Failed to fetch events' });
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
      return res.status(404).json({ error: 'Slack integration not found' });
    }

    const slackIntegration = createSlackIntegration(dataSource);
    const oauthUrl = slackIntegration.getOAuthUrl(id, redirectUri);

    return res.json({ oauthUrl });
  } catch (error) {
    logger.error('Error getting Slack OAuth URL:', error);
    return res.status(500).json({ error: 'Failed to generate OAuth URL' });
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
        return res.status(404).json({ error: 'Slack integration not found' });
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
      return res.status(404).json({ error: 'Active Slack integration not found' });
    }

    const slackIntegration = createSlackIntegration(dataSource);
    const channels = await slackIntegration.listChannels(integration);

    return res.json({ channels });
  } catch (error) {
    logger.error('Error listing Slack channels:', error);
    return res.status(500).json({ error: 'Failed to list channels' });
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
        return res.status(404).json({ error: 'Active Slack integration not found' });
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
      return res.status(500).json({ error: 'Failed to send test message' });
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
      return res.status(404).json({ error: 'Integration not found' });
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
    return res.status(500).json({ error: 'Failed to fetch services' });
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
        return res.status(404).json({ error: 'Integration not found' });
      }

      // Verify service belongs to org
      const service = await serviceRepo.findOne({ where: { id: serviceId, orgId } });
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      await integrationService.linkServiceToIntegration(serviceId, id, config_overrides);

      logger.info('Service linked to integration', { integrationId: id, serviceId, orgId });

      return res.json({ message: 'Service linked successfully' });
    } catch (error) {
      logger.error('Error linking service:', error);
      return res.status(500).json({ error: 'Failed to link service' });
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
      return res.status(404).json({ error: 'Integration not found' });
    }

    await integrationService.unlinkServiceFromIntegration(serviceId, id);

    logger.info('Service unlinked from integration', { integrationId: id, serviceId, orgId });

    return res.json({ message: 'Service unlinked successfully' });
  } catch (error) {
    logger.error('Error unlinking service:', error);
    return res.status(500).json({ error: 'Failed to unlink service' });
  }
});

// ==================== Webhook for Slack Interactive Components ====================

/**
 * POST /api/v1/integrations/slack/interactions
 * Handle Slack interactive components (buttons, etc.)
 * Note: This endpoint needs to be added to Slack app configuration
 */
router.post('/slack/interactions', async (req: Request, res: Response) => {
  try {
    // Slack sends payload as form-urlencoded with a 'payload' field
    const payload = JSON.parse(req.body.payload || '{}');

    if (!payload.type) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Verify Slack signature in production
    // TODO: Add Slack signature verification

    if (payload.type === 'block_actions') {
      const dataSource = await getDataSource();
      const slackIntegration = createSlackIntegration(dataSource);
      const result = await slackIntegration.handleInteraction(payload);

      return res.json(result);
    }

    return res.json({ ok: true });
  } catch (error) {
    logger.error('Error handling Slack interaction:', error);
    return res.status(500).json({ error: 'Failed to handle interaction' });
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
