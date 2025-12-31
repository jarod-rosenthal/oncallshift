import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Compute HMAC-SHA256 signature for webhook payload
 *
 * @param payload - Raw request body as string or buffer
 * @param secret - Webhook secret key
 * @returns Hex-encoded signature
 */
export function computeSignature(payload: string | Buffer, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify HMAC-SHA256 signature using constant-time comparison
 *
 * @param payload - Raw request body
 * @param signature - Signature from X-Signature header
 * @param secret - Webhook secret key
 * @returns true if signature is valid
 */
export function verifySignature(payload: string | Buffer, signature: string, secret: string): boolean {
  const expectedSignature = computeSignature(payload, secret);

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    // timingSafeEqual throws if buffers have different lengths
    return false;
  }
}

/**
 * Middleware to verify webhook signature
 *
 * Requires:
 * - X-Signature header with HMAC-SHA256 signature
 * - req.service with webhookSecret property (set by authenticateApiKey)
 * - Raw body available in req.rawBody
 *
 * If service has no webhookSecret configured, signature verification is skipped.
 */
export function verifyWebhookSignature(req: Request, res: Response, next: NextFunction) {
  const service = req.service;

  if (!service) {
    logger.error('verifyWebhookSignature: No service on request. authenticateApiKey must run first.');
    return res.status(500).json({ error: 'Internal server error' });
  }

  // Skip verification if no webhook secret is configured
  const webhookSecret = (service as any).webhookSecret;
  if (!webhookSecret) {
    logger.debug('Webhook signature verification skipped - no secret configured', {
      serviceId: service.id,
    });
    return next();
  }

  // Get signature from header
  const signature = req.headers['x-signature'] as string;
  if (!signature) {
    logger.warn('Missing X-Signature header', { serviceId: service.id });
    return res.status(401).json({
      error: 'Missing signature',
      message: 'X-Signature header is required when webhook secret is configured',
    });
  }

  // Get raw body for signature verification
  // Express should store this via body-parser with verify option
  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    logger.error('Raw body not available for signature verification');
    return res.status(500).json({ error: 'Internal server error' });
  }

  // Verify signature
  if (!verifySignature(rawBody, signature, webhookSecret)) {
    logger.warn('Invalid webhook signature', {
      serviceId: service.id,
      providedSignature: signature.substring(0, 10) + '...',
    });
    return res.status(401).json({
      error: 'Invalid signature',
      message: 'The X-Signature header does not match the expected signature',
    });
  }

  logger.debug('Webhook signature verified', { serviceId: service.id });
  return next();
}

/**
 * Express body-parser verify function to capture raw body
 * Use with express.json({ verify: captureRawBody })
 */
export function captureRawBody(
  req: Request,
  _res: Response,
  buf: Buffer,
  _encoding: string
) {
  (req as any).rawBody = buf;
}
