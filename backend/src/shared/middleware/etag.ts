import { Request, Response, NextFunction } from 'express';
import { generateETag, generateWeakETag, matchesAnyETag } from '../utils/etag';
import { logger } from '../utils/logger';

/**
 * ETag middleware for HTTP conditional requests (RFC 7232)
 *
 * This middleware:
 * 1. Intercepts JSON responses and adds ETag headers
 * 2. Handles If-None-Match (GET/HEAD): Returns 304 Not Modified if cached
 * 3. Handles If-Match (PUT/PATCH/DELETE): Returns 412 Precondition Failed if stale
 *
 * Usage:
 * - Apply globally for automatic ETag generation on all GET responses
 * - Use etagResponseMiddleware() on specific routes for more control
 */

/**
 * Configuration options for ETag middleware
 */
export interface ETagMiddlewareOptions {
  /**
   * Use weak ETags for all responses (default: false)
   * Set to true for collections or when byte-for-byte comparison isn't needed
   */
  weak?: boolean;

  /**
   * Skip ETag generation for responses larger than this size in bytes
   * Default: 1MB (1048576 bytes)
   */
  threshold?: number;
}

/**
 * Express middleware that adds ETag headers to JSON responses
 * and handles conditional request validation
 *
 * @param options - Configuration options
 */
export function etagMiddleware(options: ETagMiddlewareOptions = {}) {
  const { weak = false, threshold = 1048576 } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Store the original json method
    const originalJson = res.json.bind(res);

    // Override res.json to intercept the response
    res.json = function (body: any): Response {
      // Skip for non-GET/HEAD methods that don't return ETags
      // (ETags on PUT/PATCH responses are handled differently)
      const shouldGenerateETag = ['GET', 'HEAD'].includes(req.method);

      if (shouldGenerateETag && body !== undefined && body !== null) {
        try {
          const bodyString = JSON.stringify(body);

          // Skip if response is too large
          if (bodyString.length <= threshold) {
            // Generate ETag
            const etag = weak ? generateWeakETag(body) : generateETag(body);

            // Set ETag header if not already set
            if (!res.get('ETag')) {
              res.set('ETag', etag);
            }

            // Handle If-None-Match for GET/HEAD requests
            const ifNoneMatch = req.get('If-None-Match');
            if (ifNoneMatch) {
              // Use weak comparison for If-None-Match (RFC 7232)
              if (matchesAnyETag(ifNoneMatch, etag, false)) {
                // Client's cached version is still valid
                logger.debug('ETag match, returning 304', {
                  path: req.path,
                  etag,
                  ifNoneMatch,
                });
                res.status(304);
                return res.end();
              }
            }
          }
        } catch (error) {
          // Don't fail the request if ETag generation fails
          logger.warn('ETag generation failed', { error, path: req.path });
        }
      }

      return originalJson(body);
    };

    // Handle If-Match for PUT/PATCH/DELETE requests
    // This is for optimistic concurrency control
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const ifMatch = req.get('If-Match');

      if (ifMatch) {
        // Store the If-Match header for route handlers to use
        // Route handlers should check this and compare with current entity ETag
        (req as any).ifMatch = ifMatch;
      }
    }

    next();
  };
}

/**
 * Validate If-Match header against current entity ETag
 * Returns 412 Precondition Failed if the ETags don't match
 *
 * Use this in PUT/PATCH/DELETE route handlers for optimistic concurrency control
 *
 * @param req - Express request
 * @param res - Express response
 * @param currentETag - Current ETag of the entity
 * @returns true if validation passes, false if 412 was sent
 */
export function validateIfMatch(
  req: Request,
  res: Response,
  currentETag: string
): boolean {
  const ifMatch = req.get('If-Match');

  // If no If-Match header, validation passes
  if (!ifMatch) {
    return true;
  }

  // Use strong comparison for If-Match (RFC 7232)
  if (matchesAnyETag(ifMatch, currentETag, true)) {
    return true;
  }

  // ETag mismatch - resource was modified since client last fetched it
  logger.info('If-Match precondition failed', {
    path: req.path,
    method: req.method,
    ifMatch,
    currentETag,
  });

  res.status(412).json({
    error: 'Precondition Failed',
    message: 'The resource has been modified since you last fetched it. Please refresh and try again.',
    currentETag,
  });

  return false;
}

/**
 * Set ETag header for a specific entity response
 * Use this for single-entity GET responses where you want more control
 *
 * @param res - Express response
 * @param etag - ETag value to set
 */
export function setETag(res: Response, etag: string): void {
  res.set('ETag', etag);
}

/**
 * Middleware for collection endpoints that should use weak ETags
 * Weak ETags indicate semantic equivalence rather than byte-for-byte identity
 */
export function weakEtagMiddleware() {
  return etagMiddleware({ weak: true });
}

/**
 * Response helper that sets ETag and checks If-None-Match
 * Returns true if 304 was sent (client should not continue)
 *
 * @param req - Express request
 * @param res - Express response
 * @param etag - ETag for the response
 * @returns true if 304 was sent
 */
export function checkETagAndRespond(
  req: Request,
  res: Response,
  etag: string
): boolean {
  res.set('ETag', etag);

  const ifNoneMatch = req.get('If-None-Match');
  if (ifNoneMatch && matchesAnyETag(ifNoneMatch, etag, false)) {
    res.status(304).end();
    return true;
  }

  return false;
}
