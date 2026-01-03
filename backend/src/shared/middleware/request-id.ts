/**
 * Request ID Middleware
 *
 * Adds X-Request-Id header to all requests for request tracing and debugging.
 * Follows industry standards from Stripe, Twilio, and AWS.
 *
 * Features:
 * - Uses client-provided X-Request-Id if valid UUID
 * - Generates new UUID if not provided
 * - Adds request ID to response headers
 * - Makes request ID available throughout request lifecycle
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

// Extend Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

// ============================================
// Constants
// ============================================

export const REQUEST_ID_HEADER = 'x-request-id';
export const REQUEST_ID_RESPONSE_HEADER = 'X-Request-Id';

// ============================================
// Middleware
// ============================================

/**
 * Request ID middleware
 *
 * Usage:
 *   app.use(requestIdMiddleware);
 *
 * After applying:
 *   - req.requestId is available in all handlers
 *   - X-Request-Id header is added to all responses
 *   - Logger includes requestId in all log messages
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check for client-provided request ID
  const clientRequestId = req.headers[REQUEST_ID_HEADER] as string | undefined;

  // Use client ID if valid UUID, otherwise generate new one
  const requestId = clientRequestId && uuidValidate(clientRequestId)
    ? clientRequestId
    : uuidv4();

  // Attach to request object
  req.requestId = requestId;

  // Add to response headers
  res.setHeader(REQUEST_ID_RESPONSE_HEADER, requestId);

  // Add to logger context for this request
  // All logs within this request will include the requestId
  const childLogger = logger.child({ requestId });

  // Replace logger methods on request for this context
  (req as any).logger = childLogger;

  next();
}

/**
 * Get request ID from request object
 * Useful in places where you have access to req but not directly to requestId
 */
export function getRequestId(req: Request): string {
  return req.requestId || 'unknown';
}

/**
 * Create a logger with request context
 * Use this in route handlers for consistent logging
 */
export function getRequestLogger(req: Request) {
  return logger.child({ requestId: req.requestId });
}

// ============================================
// Error Handler Integration
// ============================================

/**
 * Error handler that includes request ID in error responses
 *
 * Usage:
 *   app.use(errorHandlerWithRequestId);
 */
export function errorHandlerWithRequestId(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';

  // Log the error with request context
  logger.error('Unhandled error', {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Don't expose internal errors in production
  const isProduction = process.env.NODE_ENV === 'production';

  res.setHeader('Content-Type', 'application/problem+json');
  res.status(500).json({
    type: 'https://oncallshift.com/problems/internal-error',
    title: 'Internal Server Error',
    status: 500,
    detail: isProduction
      ? `An unexpected error occurred. Reference ID: ${requestId}`
      : err.message,
    instance: req.originalUrl,
    requestId,
    error: 'An unexpected error occurred', // Backwards compatibility
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

// ============================================
// Async Handler Wrapper
// ============================================

/**
 * Async handler wrapper that catches errors and preserves request ID
 *
 * Usage:
 *   router.get('/items', asyncHandler(async (req, res) => {
 *     const items = await getItems();
 *     res.json(items);
 *   }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      // Log with request ID before passing to error handler
      logger.error('Async handler error', {
        requestId: req.requestId,
        error: err.message,
        path: req.path,
      });
      next(err);
    });
  };
}

export default requestIdMiddleware;
