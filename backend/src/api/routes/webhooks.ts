import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { sendAlertMessage, AlertMessage } from '../../shared/queues/sqs-client';
import { getDataSource } from '../../shared/db/data-source';
import { Service } from '../../shared/models';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Webhooks
 *     description: |
 *       Webhook endpoints for receiving alerts from monitoring tools.
 *       These endpoints are compatible with PagerDuty and Opsgenie formats,
 *       allowing easy migration without reconfiguring your monitoring tools.
 *
 *       **Authentication:** Use your OnCallShift service API key as:
 *       - PagerDuty: `routing_key` in the payload
 *       - Opsgenie: `X-API-Key` header or `apiKey` in the payload
 *       - Generic: `X-API-Key` header
 */

/**
 * @swagger
 * /api/v1/webhooks/pagerduty:
 *   post:
 *     summary: PagerDuty Events API v2 Compatible Endpoint
 *     description: |
 *       Accepts events in PagerDuty Events API v2 format.
 *       Drop-in replacement for `https://events.pagerduty.com/v2/enqueue`.
 *
 *       **Migration:** Simply change the endpoint URL in your monitoring tool
 *       from PagerDuty to OnCallShift. Use your OnCallShift service API key
 *       as the `routing_key`.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - routing_key
 *               - event_action
 *             properties:
 *               routing_key:
 *                 type: string
 *                 description: OnCallShift service API key
 *                 example: "srv_abc123def456"
 *               event_action:
 *                 type: string
 *                 enum: [trigger, acknowledge, resolve]
 *                 description: Action to perform
 *               dedup_key:
 *                 type: string
 *                 description: Deduplication key for grouping alerts
 *                 example: "server-001/cpu-high"
 *               payload:
 *                 type: object
 *                 required:
 *                   - summary
 *                   - source
 *                   - severity
 *                 properties:
 *                   summary:
 *                     type: string
 *                     description: Alert summary
 *                     example: "CPU usage exceeded 90% on server-001"
 *                   source:
 *                     type: string
 *                     description: Source of the alert
 *                     example: "datadog"
 *                   severity:
 *                     type: string
 *                     enum: [critical, error, warning, info]
 *                   custom_details:
 *                     type: object
 *                     description: Additional context
 *     responses:
 *       202:
 *         description: Event accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                 dedup_key:
 *                   type: string
 *       400:
 *         description: Invalid event
 */

// ============================================================================
// PagerDuty Events API v2 Compatible Endpoint
// Accepts the same payload format as PagerDuty's /v2/enqueue endpoint
// ============================================================================

interface PagerDutyEvent {
  routing_key: string;
  event_action: 'trigger' | 'acknowledge' | 'resolve';
  dedup_key?: string;
  client?: string;
  client_url?: string;
  payload?: {
    summary: string;
    source: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    timestamp?: string;
    component?: string;
    group?: string;
    class?: string;
    custom_details?: Record<string, any>;
  };
  links?: Array<{ href: string; text?: string }>;
  images?: Array<{ src: string; href?: string; alt?: string }>;
}

/**
 * PagerDuty Events API v2 Compatible Webhook
 * POST /api/v1/webhooks/pagerduty
 *
 * Accepts events in PagerDuty Events API v2 format and creates incidents.
 * The routing_key should be the OnCallShift service's API key.
 */
router.post('/pagerduty', async (req: Request, res: Response) => {
  try {
    const event: PagerDutyEvent = req.body;

    // Validate required fields
    if (!event.routing_key) {
      return res.status(400).json({
        status: 'invalid event',
        message: 'routing_key is required',
        dedup_key: event.dedup_key,
      });
    }

    if (!event.event_action) {
      return res.status(400).json({
        status: 'invalid event',
        message: 'event_action is required (trigger, acknowledge, or resolve)',
        dedup_key: event.dedup_key,
      });
    }

    // For trigger events, payload is required
    if (event.event_action === 'trigger') {
      if (!event.payload) {
        return res.status(400).json({
          status: 'invalid event',
          message: 'payload is required for trigger events',
          dedup_key: event.dedup_key,
        });
      }

      if (!event.payload.summary || !event.payload.source || !event.payload.severity) {
        return res.status(400).json({
          status: 'invalid event',
          message: 'payload.summary, payload.source, and payload.severity are required',
          dedup_key: event.dedup_key,
        });
      }
    }

    // For acknowledge/resolve, dedup_key is required
    if ((event.event_action === 'acknowledge' || event.event_action === 'resolve') && !event.dedup_key) {
      return res.status(400).json({
        status: 'invalid event',
        message: 'dedup_key is required for acknowledge and resolve events',
      });
    }

    // Look up service by API key (routing_key)
    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    const service = await serviceRepo.findOne({
      where: { apiKey: event.routing_key },
    });

    if (!service) {
      return res.status(400).json({
        status: 'invalid event',
        message: 'Invalid routing_key - no service found',
        dedup_key: event.dedup_key,
      });
    }

    // Generate dedup_key if not provided for trigger events
    const dedupKey = event.dedup_key || crypto.randomUUID();

    if (event.event_action === 'trigger') {
      // Convert PagerDuty format to OnCallShift AlertMessage
      const alertMessage: AlertMessage = {
        serviceId: service.id,
        summary: event.payload!.summary.substring(0, 1024), // PagerDuty limit
        severity: mapPagerDutySeverity(event.payload!.severity),
        dedupKey,
        source: event.payload!.source,
        details: {
          ...event.payload!.custom_details,
          component: event.payload!.component,
          group: event.payload!.group,
          class: event.payload!.class,
          client: event.client,
          client_url: event.client_url,
          links: event.links,
          images: event.images,
          pagerduty_timestamp: event.payload!.timestamp,
          source_format: 'pagerduty_v2',
        },
      };

      // Send to alert processing queue
      await sendAlertMessage(alertMessage);

      logger.info('PagerDuty webhook processed - trigger', {
        serviceId: service.id,
        dedupKey,
        severity: alertMessage.severity,
        summary: alertMessage.summary.substring(0, 100),
      });

      return res.status(202).json({
        status: 'success',
        message: 'Event processed',
        dedup_key: dedupKey,
      });
    } else if (event.event_action === 'acknowledge') {
      // Handle acknowledge - update existing incident
      const updated = await updateIncidentState(service.id, dedupKey, 'acknowledged');

      logger.info('PagerDuty webhook processed - acknowledge', {
        serviceId: service.id,
        dedupKey,
        updated,
      });

      return res.status(202).json({
        status: updated ? 'success' : 'no matching incident',
        message: updated ? 'Incident acknowledged' : 'No open incident found with dedup_key',
        dedup_key: dedupKey,
      });
    } else if (event.event_action === 'resolve') {
      // Handle resolve - update existing incident
      const updated = await updateIncidentState(service.id, dedupKey, 'resolved');

      logger.info('PagerDuty webhook processed - resolve', {
        serviceId: service.id,
        dedupKey,
        updated,
      });

      return res.status(202).json({
        status: updated ? 'success' : 'no matching incident',
        message: updated ? 'Incident resolved' : 'No open incident found with dedup_key',
        dedup_key: dedupKey,
      });
    }

    return res.status(400).json({
      status: 'invalid event',
      message: `Unknown event_action: ${event.event_action}`,
      dedup_key: dedupKey,
    });
  } catch (error) {
    logger.error('Error processing PagerDuty webhook:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
});

// ============================================================================
// Opsgenie Alert API Compatible Endpoint
// Accepts the same payload format as Opsgenie's /v2/alerts endpoint
// ============================================================================

/**
 * @swagger
 * /api/v1/webhooks/opsgenie:
 *   post:
 *     summary: Opsgenie Alert API Compatible Endpoint
 *     description: |
 *       Accepts alerts in Opsgenie Alert API format.
 *       Drop-in replacement for `https://api.opsgenie.com/v2/alerts`.
 *
 *       **Migration from Opsgenie:** Simply change the endpoint URL and use
 *       your OnCallShift service API key in the `X-API-Key` header.
 *
 *       **Priority Mapping:**
 *       - P1 → critical
 *       - P2 → error
 *       - P3, P4 → warning
 *       - P5 → info
 *     tags: [Webhooks]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Alert message (max 130 chars)
 *                 example: "CPU usage exceeded 90%"
 *               alias:
 *                 type: string
 *                 description: Alert alias for deduplication
 *                 example: "server-001-cpu-alert"
 *               description:
 *                 type: string
 *                 description: Detailed alert description
 *               priority:
 *                 type: string
 *                 enum: [P1, P2, P3, P4, P5]
 *                 description: Alert priority
 *               source:
 *                 type: string
 *                 description: Source of the alert
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tags for categorization
 *               details:
 *                 type: object
 *                 description: Custom key-value pairs
 *     responses:
 *       202:
 *         description: Alert accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: "Request will be processed"
 *                 took:
 *                   type: number
 *                 requestId:
 *                   type: string
 *       401:
 *         description: API key missing or invalid
 *
 * /api/v1/webhooks/opsgenie/{identifier}/acknowledge:
 *   post:
 *     summary: Acknowledge Opsgenie Alert
 *     description: Acknowledge an alert by its alias or ID
 *     tags: [Webhooks]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert alias or ID
 *       - in: query
 *         name: identifierType
 *         schema:
 *           type: string
 *           enum: [alias, id]
 *           default: alias
 *     responses:
 *       202:
 *         description: Acknowledgment accepted
 *
 * /api/v1/webhooks/opsgenie/{identifier}/close:
 *   post:
 *     summary: Close Opsgenie Alert
 *     description: Close/resolve an alert by its alias or ID
 *     tags: [Webhooks]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert alias or ID
 *       - in: query
 *         name: identifierType
 *         schema:
 *           type: string
 *           enum: [alias, id]
 *           default: alias
 *     responses:
 *       202:
 *         description: Close request accepted
 */

interface OpsgenieAlert {
  message: string;
  alias?: string;
  description?: string;
  responders?: Array<{
    id?: string;
    name?: string;
    username?: string;
    type: 'team' | 'user' | 'escalation' | 'schedule';
  }>;
  visibleTo?: Array<{
    id?: string;
    name?: string;
    username?: string;
    type: 'team' | 'user';
  }>;
  actions?: string[];
  tags?: string[];
  details?: Record<string, any>;
  entity?: string;
  source?: string;
  priority?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  user?: string;
  note?: string;
}

/**
 * Opsgenie Alert API Compatible Webhook
 * POST /api/v1/webhooks/opsgenie
 *
 * Accepts alerts in Opsgenie Alert API format and creates incidents.
 * Requires X-API-Key header with the OnCallShift service's API key.
 */
router.post('/opsgenie', async (req: Request, res: Response) => {
  try {
    const alert: OpsgenieAlert = req.body;

    // Get API key from header (Opsgenie uses GenieKey or Authorization header)
    const apiKey = req.headers['x-api-key'] as string ||
      (req.headers.authorization?.replace('GenieKey ', '') as string);

    if (!apiKey) {
      return res.status(401).json({
        result: 'API key is missing',
        took: 0,
        requestId: crypto.randomUUID(),
      });
    }

    // Validate required fields
    if (!alert.message) {
      return res.status(400).json({
        result: 'message field is required',
        took: 0,
        requestId: crypto.randomUUID(),
      });
    }

    if (alert.message.length > 130) {
      return res.status(400).json({
        result: 'message must be at most 130 characters',
        took: 0,
        requestId: crypto.randomUUID(),
      });
    }

    // Look up service by API key
    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    const service = await serviceRepo.findOne({
      where: { apiKey },
    });

    if (!service) {
      return res.status(401).json({
        result: 'Invalid API key',
        took: 0,
        requestId: crypto.randomUUID(),
      });
    }

    // Generate alias if not provided (Opsgenie auto-generates if missing)
    const alias = alert.alias || crypto.randomUUID();

    // Convert Opsgenie format to OnCallShift AlertMessage
    const alertMessage: AlertMessage = {
      serviceId: service.id,
      summary: alert.message,
      severity: mapOpsgeniePriority(alert.priority || 'P3'),
      dedupKey: alias,
      source: alert.source,
      details: {
        ...alert.details,
        description: alert.description,
        entity: alert.entity,
        tags: alert.tags,
        actions: alert.actions,
        user: alert.user,
        note: alert.note,
        responders: alert.responders,
        visibleTo: alert.visibleTo,
        source_format: 'opsgenie',
      },
    };

    // Send to alert processing queue
    await sendAlertMessage(alertMessage);

    const requestId = crypto.randomUUID();

    logger.info('Opsgenie webhook processed', {
      serviceId: service.id,
      alias,
      priority: alert.priority,
      severity: alertMessage.severity,
      requestId,
    });

    // Return Opsgenie-compatible response
    return res.status(202).json({
      result: 'Request will be processed',
      took: 0.01,
      requestId,
    });
  } catch (error) {
    logger.error('Error processing Opsgenie webhook:', error);
    return res.status(500).json({
      result: 'Internal server error',
      took: 0,
      requestId: crypto.randomUUID(),
    });
  }
});

/**
 * Opsgenie Acknowledge Alert
 * POST /api/v1/webhooks/opsgenie/:identifier/acknowledge
 */
router.post('/opsgenie/:identifier/acknowledge', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    const apiKey = req.headers['x-api-key'] as string ||
      (req.headers.authorization?.replace('GenieKey ', '') as string);

    if (!apiKey) {
      return res.status(401).json({
        result: 'API key is missing',
        took: 0,
        requestId: crypto.randomUUID(),
      });
    }

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    const service = await serviceRepo.findOne({
      where: { apiKey },
    });

    if (!service) {
      return res.status(401).json({
        result: 'Invalid API key',
        took: 0,
        requestId: crypto.randomUUID(),
      });
    }

    const updated = await updateIncidentState(service.id, identifier, 'acknowledged');

    return res.status(202).json({
      result: updated ? 'Request will be processed' : 'Alert not found',
      took: 0.01,
      requestId: crypto.randomUUID(),
    });
  } catch (error) {
    logger.error('Error processing Opsgenie acknowledge:', error);
    return res.status(500).json({
      result: 'Internal server error',
      took: 0,
      requestId: crypto.randomUUID(),
    });
  }
});

/**
 * Opsgenie Close Alert
 * POST /api/v1/webhooks/opsgenie/:identifier/close
 */
router.post('/opsgenie/:identifier/close', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    const apiKey = req.headers['x-api-key'] as string ||
      (req.headers.authorization?.replace('GenieKey ', '') as string);

    if (!apiKey) {
      return res.status(401).json({
        result: 'API key is missing',
        took: 0,
        requestId: crypto.randomUUID(),
      });
    }

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    const service = await serviceRepo.findOne({
      where: { apiKey },
    });

    if (!service) {
      return res.status(401).json({
        result: 'Invalid API key',
        took: 0,
        requestId: crypto.randomUUID(),
      });
    }

    const updated = await updateIncidentState(service.id, identifier, 'resolved');

    return res.status(202).json({
      result: updated ? 'Request will be processed' : 'Alert not found',
      took: 0.01,
      requestId: crypto.randomUUID(),
    });
  } catch (error) {
    logger.error('Error processing Opsgenie close:', error);
    return res.status(500).json({
      result: 'Internal server error',
      took: 0,
      requestId: crypto.randomUUID(),
    });
  }
});

// ============================================================================
// Generic Webhook Endpoint
// Accepts a simplified format for easy integration
// ============================================================================

/**
 * @swagger
 * /api/v1/webhooks/generic:
 *   post:
 *     summary: Generic Webhook Endpoint
 *     description: |
 *       Accepts a simplified alert format for easy integration with custom tools.
 *       Use this endpoint when you don't need PagerDuty or Opsgenie compatibility.
 *
 *       **Simple Integration:** Just send a POST request with your service API key
 *       and alert details.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               api_key:
 *                 type: string
 *                 description: Service API key (or use X-API-Key header)
 *                 example: "srv_abc123def456"
 *               title:
 *                 type: string
 *                 description: Alert title
 *                 example: "Database connection failed"
 *               description:
 *                 type: string
 *                 description: Alert description
 *               severity:
 *                 type: string
 *                 enum: [critical, error, warning, info]
 *                 default: warning
 *               dedup_key:
 *                 type: string
 *                 description: Deduplication key
 *               source:
 *                 type: string
 *                 description: Alert source
 *               details:
 *                 type: object
 *                 description: Additional context
 *     responses:
 *       202:
 *         description: Alert accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "accepted"
 *                 message:
 *                   type: string
 *                 incident_key:
 *                   type: string
 *       400:
 *         description: Invalid request
 */

interface GenericAlert {
  api_key: string;
  title: string;
  description?: string;
  severity?: 'critical' | 'error' | 'warning' | 'info';
  dedup_key?: string;
  source?: string;
  details?: Record<string, any>;
}
router.post('/generic', async (req: Request, res: Response) => {
  try {
    const alert: GenericAlert = req.body;

    // API key can be in body or header
    const apiKey = alert.api_key || req.headers['x-api-key'] as string;

    if (!apiKey) {
      return res.status(400).json({
        error: 'api_key is required (in body or X-API-Key header)',
      });
    }

    if (!alert.title) {
      return res.status(400).json({
        error: 'title is required',
      });
    }

    // Look up service by API key
    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    const service = await serviceRepo.findOne({
      where: { apiKey },
    });

    if (!service) {
      return res.status(400).json({
        error: 'Invalid api_key - no service found',
      });
    }

    const dedupKey = alert.dedup_key || crypto.randomUUID();

    const alertMessage: AlertMessage = {
      serviceId: service.id,
      summary: alert.title.substring(0, 1024),
      severity: alert.severity || 'warning',
      dedupKey,
      source: alert.source,
      details: {
        ...alert.details,
        description: alert.description,
        source_format: 'generic',
      },
    };

    await sendAlertMessage(alertMessage);

    logger.info('Generic webhook processed', {
      serviceId: service.id,
      dedupKey,
      severity: alertMessage.severity,
    });

    return res.status(202).json({
      status: 'success',
      message: 'Alert received',
      dedup_key: dedupKey,
      incident_url: `https://oncallshift.com/incidents?dedup_key=${dedupKey}`,
    });
  } catch (error) {
    logger.error('Error processing generic webhook:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map PagerDuty severity to OnCallShift severity
 */
function mapPagerDutySeverity(pdSeverity: string): 'critical' | 'error' | 'warning' | 'info' {
  switch (pdSeverity.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'warning';
  }
}

/**
 * Map Opsgenie priority to OnCallShift severity
 */
function mapOpsgeniePriority(priority: string): 'critical' | 'error' | 'warning' | 'info' {
  switch (priority.toUpperCase()) {
    case 'P1':
      return 'critical';
    case 'P2':
      return 'error';
    case 'P3':
      return 'warning';
    case 'P4':
      return 'warning';
    case 'P5':
      return 'info';
    default:
      return 'warning';
  }
}

/**
 * Update incident state by dedup_key
 */
async function updateIncidentState(
  serviceId: string,
  dedupKey: string,
  newState: 'acknowledged' | 'resolved'
): Promise<boolean> {
  const dataSource = await getDataSource();
  const { Incident, IncidentEvent } = await import('../../shared/models');
  const incidentRepo = dataSource.getRepository(Incident);
  const eventRepo = dataSource.getRepository(IncidentEvent);

  // Find open incident with matching dedup_key
  const incident = await incidentRepo.findOne({
    where: [
      { serviceId, dedupKey, state: 'triggered' },
      { serviceId, dedupKey, state: 'acknowledged' },
    ],
  });

  if (!incident) {
    return false;
  }

  // Update incident state
  incident.state = newState;
  if (newState === 'acknowledged') {
    incident.acknowledgedAt = new Date();
  } else if (newState === 'resolved') {
    incident.resolvedAt = new Date();
  }
  await incidentRepo.save(incident);

  // Create event
  const event = eventRepo.create({
    incidentId: incident.id,
    type: newState === 'acknowledged' ? 'acknowledge' : 'resolve',
    message: `Incident ${newState} via webhook API`,
    payload: { source: 'webhook' },
  });
  await eventRepo.save(event);

  return true;
}

export default router;
