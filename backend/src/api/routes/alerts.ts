import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateApiKey } from '../../shared/auth/middleware';
import { webhookRateLimiter, verifyWebhookSignature } from '../../shared/middleware';
import { sendAlertMessage } from '../../shared/queues/sqs-client';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * POST /api/v1/alerts/webhook
 * Receive webhook alert and queue for processing
 *
 * Security:
 * - API key authentication (X-API-Key header)
 * - Rate limiting (100 requests/minute per API key)
 * - Optional HMAC-SHA256 signature verification (X-Signature header)
 */
router.post(
  '/webhook',
  authenticateApiKey,
  webhookRateLimiter,
  verifyWebhookSignature,
  [
    body('summary').isString().notEmpty().withMessage('summary is required'),
    body('severity').isIn(['info', 'warning', 'error', 'critical']).withMessage('Invalid severity'),
    body('details').optional().isObject(),
    body('dedup_key').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { summary, severity, details, dedup_key } = req.body;
      const service = req.service!;

      // Queue alert for async processing
      await sendAlertMessage({
        serviceId: service.id,
        summary,
        severity: severity || 'error',
        details: details || {},
        dedupKey: dedup_key,
      });

      logger.info('Alert received and queued', {
        serviceId: service.id,
        serviceName: service.name,
        summary,
        severity,
      });

      // Return 202 Accepted immediately
      return res.status(202).json({
        message: 'Alert received and queued for processing',
        service: {
          id: service.id,
          name: service.name,
        },
      });
    } catch (error) {
      logger.error('Error processing webhook alert:', error);
      return res.status(500).json({ error: 'Failed to process alert' });
    }
  }
);

export default router;
