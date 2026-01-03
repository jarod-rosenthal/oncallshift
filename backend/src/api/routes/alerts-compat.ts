import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { authenticateApiKey } from '../../shared/auth/middleware';
import { webhookRateLimiter } from '../../shared/middleware';
import { sendAlertMessage } from '../../shared/queues/sqs-client';
import { getDataSource } from '../../shared/db/data-source';
import { Incident, IncidentEvent } from '../../shared/models';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * Map PagerDuty severity to OnCallShift severity
 */
function mapPagerDutySeverity(severity: string): 'info' | 'warning' | 'error' | 'critical' {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
    default:
      return 'info';
  }
}

/**
 * Map OpsGenie priority to OnCallShift severity
 * P1 -> critical, P2 -> error, P3 -> warning, P4/P5 -> info
 */
function mapOpsGeniePriority(priority: string): 'info' | 'warning' | 'error' | 'critical' {
  switch (priority?.toUpperCase()) {
    case 'P1':
      return 'critical';
    case 'P2':
      return 'error';
    case 'P3':
      return 'warning';
    case 'P4':
    case 'P5':
    default:
      return 'info';
  }
}

/**
 * POST /api/v1/alerts/pagerduty
 * PagerDuty Events API v2 compatible endpoint
 *
 * Allows users migrating from PagerDuty to use the same webhook format
 * without changing their alerting tools.
 *
 * @example
 * POST /api/v1/alerts/pagerduty
 * X-API-Key: <service-api-key>
 * {
 *   "routing_key": "service-integration-key",  // Optional, ignored - we use X-API-Key
 *   "event_action": "trigger",                 // "trigger" | "acknowledge" | "resolve"
 *   "dedup_key": "unique-alert-id",           // Used for deduplication
 *   "payload": {
 *     "summary": "Alert summary",
 *     "severity": "critical",                  // "critical" | "error" | "warning" | "info"
 *     "source": "monitoring-tool",
 *     "custom_details": { ... }
 *   }
 * }
 */
router.post(
  '/pagerduty',
  authenticateApiKey,
  webhookRateLimiter,
  [
    body('event_action')
      .isIn(['trigger', 'acknowledge', 'resolve'])
      .withMessage('event_action must be trigger, acknowledge, or resolve'),
    body('dedup_key').optional().isString(),
    body('payload').optional().isObject(),
    body('payload.summary').optional().isString(),
    body('payload.severity').optional().isIn(['critical', 'error', 'warning', 'info']),
    body('payload.source').optional().isString(),
    body('payload.custom_details').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid request',
          errors: errors.array(),
        });
      }

      const { event_action, dedup_key, payload } = req.body;
      const service = req.service!;
      const orgId = req.orgId!;

      // Generate dedup_key if not provided
      const effectiveDedupKey = dedup_key || `pd-${uuidv4()}`;

      if (event_action === 'trigger') {
        // For trigger events, queue the alert for processing
        const summary = payload?.summary || 'Alert from PagerDuty';
        const severity = mapPagerDutySeverity(payload?.severity);

        await sendAlertMessage({
          serviceId: service.id,
          summary,
          severity,
          details: {
            source: payload?.source || 'pagerduty',
            ...payload?.custom_details,
          },
          dedupKey: effectiveDedupKey,
        });

        logger.info('PagerDuty-compat alert received and queued', {
          serviceId: service.id,
          serviceName: service.name,
          eventAction: event_action,
          dedupKey: effectiveDedupKey,
          severity,
        });

        return res.status(202).json({
          status: 'success',
          message: 'Event processed',
          dedup_key: effectiveDedupKey,
        });
      }

      // For acknowledge/resolve, find the incident by dedup_key
      if (!dedup_key) {
        return res.status(400).json({
          status: 'error',
          message: 'dedup_key is required for acknowledge and resolve events',
        });
      }

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);
      const eventRepo = dataSource.getRepository(IncidentEvent);

      // Find incident by dedup_key within the organization
      const incident = await incidentRepo.findOne({
        where: {
          dedupKey: dedup_key,
          orgId,
        },
        relations: ['service'],
      });

      if (!incident) {
        return res.status(404).json({
          status: 'error',
          message: `No incident found with dedup_key: ${dedup_key}`,
          dedup_key,
        });
      }

      if (event_action === 'acknowledge') {
        if (!incident.canAcknowledge()) {
          return res.status(200).json({
            status: 'success',
            message: 'Incident already acknowledged or resolved',
            dedup_key,
          });
        }

        incident.state = 'acknowledged';
        incident.acknowledgedAt = new Date();
        // API-initiated acknowledge has no user actor
        await incidentRepo.save(incident);

        // Create event
        const event = eventRepo.create({
          incidentId: incident.id,
          orgId,
          type: 'acknowledge',
          actorId: null,
          message: 'Incident acknowledged via PagerDuty-compatible API',
        });
        await eventRepo.save(event);

        logger.info('PagerDuty-compat: Incident acknowledged', {
          incidentId: incident.id,
          dedupKey: dedup_key,
        });

        return res.status(200).json({
          status: 'success',
          message: 'Event processed',
          dedup_key,
        });
      }

      if (event_action === 'resolve') {
        if (!incident.canResolve()) {
          return res.status(200).json({
            status: 'success',
            message: 'Incident already resolved',
            dedup_key,
          });
        }

        incident.state = 'resolved';
        incident.resolvedAt = new Date();
        // API-initiated resolve has no user actor
        await incidentRepo.save(incident);

        // Create event
        const event = eventRepo.create({
          incidentId: incident.id,
          orgId,
          type: 'resolve',
          actorId: null,
          message: 'Incident resolved via PagerDuty-compatible API',
        });
        await eventRepo.save(event);

        logger.info('PagerDuty-compat: Incident resolved', {
          incidentId: incident.id,
          dedupKey: dedup_key,
        });

        return res.status(200).json({
          status: 'success',
          message: 'Event processed',
          dedup_key,
        });
      }

      // Should never reach here due to validation
      return res.status(400).json({
        status: 'error',
        message: 'Invalid event_action',
      });
    } catch (error) {
      logger.error('Error processing PagerDuty-compat event:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to process event',
      });
    }
  }
);

/**
 * POST /api/v1/alerts/opsgenie
 * OpsGenie Alert API compatible endpoint
 *
 * Allows users migrating from OpsGenie to use the same webhook format
 * without changing their alerting tools.
 *
 * @example
 * POST /api/v1/alerts/opsgenie
 * X-API-Key: <service-api-key>
 * {
 *   "message": "Alert message",
 *   "alias": "unique-alert-id",
 *   "description": "Detailed description",
 *   "priority": "P1",           // "P1" | "P2" | "P3" | "P4" | "P5"
 *   "details": { ... }
 * }
 *
 * For acknowledge/close actions:
 * {
 *   "alias": "unique-alert-id",
 *   "action": "acknowledge" | "close"
 * }
 */
router.post(
  '/opsgenie',
  authenticateApiKey,
  webhookRateLimiter,
  [
    body('message').optional().isString(),
    body('alias').optional().isString(),
    body('description').optional().isString(),
    body('priority').optional().isIn(['P1', 'P2', 'P3', 'P4', 'P5']),
    body('details').optional().isObject(),
    body('action').optional().isIn(['acknowledge', 'close']),
  ],
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          result: 'Error',
          took: (Date.now() - startTime) / 1000,
          requestId,
          message: 'Invalid request',
          errors: errors.array(),
        });
      }

      const { message, alias, description, priority, details, action } = req.body;
      const service = req.service!;
      const orgId = req.orgId!;

      // Generate alias if not provided (for new alerts only)
      const effectiveAlias = alias || `og-${uuidv4()}`;

      // Handle acknowledge/close actions
      if (action === 'acknowledge' || action === 'close') {
        if (!alias) {
          return res.status(400).json({
            result: 'Error',
            took: (Date.now() - startTime) / 1000,
            requestId,
            message: 'alias is required for acknowledge and close actions',
          });
        }

        const dataSource = await getDataSource();
        const incidentRepo = dataSource.getRepository(Incident);
        const eventRepo = dataSource.getRepository(IncidentEvent);

        // Find incident by alias (dedup_key) within the organization
        const incident = await incidentRepo.findOne({
          where: {
            dedupKey: alias,
            orgId,
          },
          relations: ['service'],
        });

        if (!incident) {
          return res.status(404).json({
            result: 'Error',
            took: (Date.now() - startTime) / 1000,
            requestId,
            message: `No incident found with alias: ${alias}`,
          });
        }

        if (action === 'acknowledge') {
          if (!incident.canAcknowledge()) {
            return res.status(200).json({
              result: 'Request will be processed',
              took: (Date.now() - startTime) / 1000,
              requestId,
            });
          }

          incident.state = 'acknowledged';
          incident.acknowledgedAt = new Date();
          await incidentRepo.save(incident);

          const event = eventRepo.create({
            incidentId: incident.id,
            orgId,
            type: 'acknowledge',
            actorId: null,
            message: 'Incident acknowledged via OpsGenie-compatible API',
          });
          await eventRepo.save(event);

          logger.info('OpsGenie-compat: Incident acknowledged', {
            incidentId: incident.id,
            alias,
          });
        } else if (action === 'close') {
          if (!incident.canResolve()) {
            return res.status(200).json({
              result: 'Request will be processed',
              took: (Date.now() - startTime) / 1000,
              requestId,
            });
          }

          incident.state = 'resolved';
          incident.resolvedAt = new Date();
          await incidentRepo.save(incident);

          const event = eventRepo.create({
            incidentId: incident.id,
            orgId,
            type: 'resolve',
            actorId: null,
            message: 'Incident resolved via OpsGenie-compatible API',
          });
          await eventRepo.save(event);

          logger.info('OpsGenie-compat: Incident resolved', {
            incidentId: incident.id,
            alias,
          });
        }

        return res.status(200).json({
          result: 'Request will be processed',
          took: (Date.now() - startTime) / 1000,
          requestId,
        });
      }

      // Handle create alert (no action specified = trigger)
      if (!message) {
        return res.status(400).json({
          result: 'Error',
          took: (Date.now() - startTime) / 1000,
          requestId,
          message: 'message is required for creating alerts',
        });
      }

      const severity = mapOpsGeniePriority(priority || 'P3');

      await sendAlertMessage({
        serviceId: service.id,
        summary: message,
        severity,
        details: {
          description: description || undefined,
          source: 'opsgenie',
          priority: priority || 'P3',
          ...details,
        },
        dedupKey: effectiveAlias,
      });

      logger.info('OpsGenie-compat alert received and queued', {
        serviceId: service.id,
        serviceName: service.name,
        alias: effectiveAlias,
        priority: priority || 'P3',
        severity,
      });

      return res.status(202).json({
        result: 'Request will be processed',
        took: (Date.now() - startTime) / 1000,
        requestId,
      });
    } catch (error) {
      logger.error('Error processing OpsGenie-compat event:', error);
      return res.status(500).json({
        result: 'Error',
        took: (Date.now() - startTime) / 1000,
        requestId,
        message: 'Failed to process event',
      });
    }
  }
);

export default router;
