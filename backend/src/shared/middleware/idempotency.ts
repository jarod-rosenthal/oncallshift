import { Request, Response, NextFunction } from 'express';
import { getDataSource } from '../db/data-source';
import { IdempotencyKey } from '../models/IdempotencyKey';
import { logger } from '../utils/logger';

// Header name for idempotency key (following Stripe's pattern)
const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

// Idempotency key expiration time (24 hours in milliseconds)
const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000;

// Methods that support idempotency
const IDEMPOTENT_METHODS = ['POST', 'PUT', 'PATCH'];

// Response body capture interface
interface CapturedResponse {
  statusCode: number;
  body: unknown;
}

/**
 * Idempotency middleware for safe request retries.
 *
 * Follows Stripe's idempotency implementation pattern:
 * - Client provides Idempotency-Key header (typically a UUID)
 * - For POST/PUT/PATCH requests, the response is cached
 * - Subsequent requests with the same key return the cached response
 * - Keys are unique per organization and expire after 24 hours
 *
 * Race condition handling:
 * - Uses database-level unique constraint and advisory locks
 * - First request to acquire the lock processes the request
 * - Concurrent requests with the same key wait or return cached result
 *
 * @example
 * // Apply to all routes that need idempotency
 * app.use('/api/v1/incidents', idempotencyMiddleware);
 *
 * // Client usage:
 * fetch('/api/v1/incidents', {
 *   method: 'POST',
 *   headers: {
 *     'Idempotency-Key': 'unique-request-id-123',
 *     'Content-Type': 'application/json'
 *   },
 *   body: JSON.stringify({ ... })
 * });
 */
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip for methods that don't need idempotency
  if (!IDEMPOTENT_METHODS.includes(req.method)) {
    return next();
  }

  // Get idempotency key from header
  const idempotencyKey = req.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()] as string;

  // If no idempotency key provided, proceed normally
  if (!idempotencyKey) {
    return next();
  }

  // Validate key length (prevent excessively long keys)
  if (idempotencyKey.length > 255) {
    return res.status(400).json({
      error: 'Invalid Idempotency-Key',
      message: 'Idempotency-Key must be 255 characters or less',
    });
  }

  // Get orgId from authenticated request
  const orgId = req.orgId || req.user?.orgId;

  if (!orgId) {
    // Can't use idempotency without an organization context
    // Proceed without idempotency (let auth middleware handle the 401)
    return next();
  }

  // Process the idempotent request
  processIdempotentRequest(req, res, next, idempotencyKey, orgId);
}

/**
 * Store idempotency key in database
 */
async function storeIdempotencyKey(
  orgId: string,
  key: string,
  requestPath: string,
  requestMethod: string,
  responseStatus: number,
  responseBody: unknown,
  ttlMs: number
): Promise<void> {
  const dataSource = await getDataSource();
  const idempotencyRepo = dataSource.getRepository(IdempotencyKey);
  const expiresAt = new Date(Date.now() + ttlMs);

  const idempotencyRecord = new IdempotencyKey();
  idempotencyRecord.orgId = orgId;
  idempotencyRecord.key = key;
  idempotencyRecord.requestPath = requestPath;
  idempotencyRecord.requestMethod = requestMethod;
  idempotencyRecord.responseStatus = responseStatus;
  idempotencyRecord.responseBody = responseBody as Record<string, unknown>;
  idempotencyRecord.expiresAt = expiresAt;

  await idempotencyRepo.save(idempotencyRecord);
}

/**
 * Process a request with idempotency key handling
 */
async function processIdempotentRequest(
  req: Request,
  res: Response,
  next: NextFunction,
  idempotencyKey: string,
  orgId: string
) {
  const requestPath = req.path;
  const requestMethod = req.method;

  try {
    const dataSource = await getDataSource();
    const idempotencyRepo = dataSource.getRepository(IdempotencyKey);

    // Try to find existing idempotency key using a transaction with row-level locking
    const existingKey = await dataSource.transaction(async (transactionalEntityManager) => {
      // Use FOR UPDATE SKIP LOCKED to handle concurrent requests
      // If another transaction is processing this key, we skip it and proceed
      const result = await transactionalEntityManager
        .createQueryBuilder(IdempotencyKey, 'ik')
        .setLock('pessimistic_write_or_fail')
        .where('ik.org_id = :orgId', { orgId })
        .andWhere('ik.key = :key', { key: idempotencyKey })
        .getOne();

      return result;
    }).catch(() => null); // Return null if lock couldn't be acquired

    if (existingKey) {
      // Check if expired
      if (existingKey.isExpired()) {
        // Delete expired key and proceed with new request
        await idempotencyRepo.delete(existingKey.id);
        logger.debug('Deleted expired idempotency key', { key: idempotencyKey, orgId });
      } else {
        // Validate that request matches the original (path and method must match)
        if (!existingKey.matchesRequest(requestPath, requestMethod)) {
          return res.status(422).json({
            error: 'Idempotency key conflict',
            message: `Idempotency key was already used for a different request (${existingKey.requestMethod} ${existingKey.requestPath})`,
          });
        }

        // Return cached response
        logger.debug('Returning cached response for idempotency key', {
          key: idempotencyKey,
          orgId,
          originalStatus: existingKey.responseStatus,
        });

        // Set the idempotency key header in response
        res.setHeader(IDEMPOTENCY_KEY_HEADER, idempotencyKey);
        res.setHeader('Idempotent-Replayed', 'true');

        return res.status(existingKey.responseStatus).json(existingKey.responseBody);
      }
    }

    // Capture the response to store it
    const captured = await captureResponse(req, res, next);

    if (captured) {
      // Store the response for future idempotent requests
      try {
        await storeIdempotencyKey(
          orgId,
          idempotencyKey,
          requestPath,
          requestMethod,
          captured.statusCode,
          captured.body,
          IDEMPOTENCY_KEY_TTL_MS
        );

        logger.debug('Stored idempotency key', {
          key: idempotencyKey,
          orgId,
          status: captured.statusCode,
        });
      } catch (insertError: unknown) {
        // Handle race condition: another request might have inserted the key
        const errorMessage = insertError instanceof Error ? insertError.message : String(insertError);
        if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
          logger.debug('Idempotency key already exists (race condition handled)', {
            key: idempotencyKey,
            orgId,
          });
        } else {
          // Log but don't fail the request - the response was already sent
          logger.warn('Failed to store idempotency key', {
            key: idempotencyKey,
            orgId,
            error: errorMessage,
          });
        }
      }
    }
  } catch (error) {
    logger.error('Idempotency middleware error', {
      error: error instanceof Error ? error.message : String(error),
      key: idempotencyKey,
      orgId,
    });
    // Don't fail the request, just proceed without idempotency
    return next();
  }
}

/**
 * Capture the response body and status code
 * This intercepts the response to store it for idempotency
 */
function captureResponse(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<CapturedResponse | null> {
  return new Promise((resolve) => {
    // Store original methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    let captured: CapturedResponse | null = null;
    let responseSent = false;

    // Override json method
    res.json = function (body: unknown) {
      if (!responseSent) {
        responseSent = true;
        captured = {
          statusCode: res.statusCode,
          body: body as Record<string, unknown>,
        };

        // Set the idempotency key header
        const idempotencyKey = req.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()] as string;
        if (idempotencyKey) {
          res.setHeader(IDEMPOTENCY_KEY_HEADER, idempotencyKey);
        }

        // Send the response
        const result = originalJson(body);

        // Resolve with captured response
        resolve(captured);

        return result;
      }
      return originalJson(body);
    };

    // Override send method (for non-JSON responses, capture as wrapped object)
    res.send = function (body: unknown) {
      if (!responseSent) {
        responseSent = true;

        // Try to parse as JSON if it's a string
        let parsedBody: unknown = body;
        if (typeof body === 'string') {
          try {
            parsedBody = JSON.parse(body);
          } catch {
            parsedBody = { data: body };
          }
        }

        captured = {
          statusCode: res.statusCode,
          body: parsedBody as Record<string, unknown>,
        };

        // Set the idempotency key header
        const idempotencyKey = req.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()] as string;
        if (idempotencyKey) {
          res.setHeader(IDEMPOTENCY_KEY_HEADER, idempotencyKey);
        }

        const result = originalSend(body);
        resolve(captured);
        return result;
      }
      return originalSend(body);
    };

    // Override end method (for responses without body)
    const originalEndFn = res.end.bind(res);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).end = function (...args: unknown[]) {
      if (!responseSent) {
        responseSent = true;
        captured = {
          statusCode: res.statusCode,
          body: {},
        };
        resolve(captured);
      }
      return (originalEndFn as (...args: unknown[]) => Response).apply(res, args);
    };

    // Set a timeout to resolve if no response is sent (shouldn't happen normally)
    const timeout = setTimeout(() => {
      if (!responseSent) {
        resolve(null);
      }
    }, 30000); // 30 second timeout

    // Clean up timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeout);
      if (!responseSent) {
        resolve(null);
      }
    });

    // Call next to proceed with the request
    next();
  });
}

/**
 * Cleanup expired idempotency keys
 * Call this periodically (e.g., every hour) to remove expired entries
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  try {
    const dataSource = await getDataSource();
    const result = await dataSource
      .createQueryBuilder()
      .delete()
      .from(IdempotencyKey)
      .where('expires_at < :now', { now: new Date() })
      .execute();

    const deletedCount = result.affected || 0;

    if (deletedCount > 0) {
      logger.info('Cleaned up expired idempotency keys', { deletedCount });
    }

    return deletedCount;
  } catch (error) {
    logger.error('Failed to cleanup expired idempotency keys', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Create idempotency middleware for specific routes
 * Allows customization of TTL and other options
 */
export interface IdempotencyOptions {
  ttlMs?: number;  // Custom TTL in milliseconds (default: 24 hours)
  headerName?: string;  // Custom header name (default: 'Idempotency-Key')
}

export function createIdempotencyMiddleware(options: IdempotencyOptions = {}) {
  const {
    ttlMs = IDEMPOTENCY_KEY_TTL_MS,
    headerName = IDEMPOTENCY_KEY_HEADER,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip for methods that don't need idempotency
    if (!IDEMPOTENT_METHODS.includes(req.method)) {
      return next();
    }

    // Get idempotency key from custom header
    const idempotencyKey = req.headers[headerName.toLowerCase()] as string;

    if (!idempotencyKey) {
      return next();
    }

    if (idempotencyKey.length > 255) {
      return res.status(400).json({
        error: `Invalid ${headerName}`,
        message: `${headerName} must be 255 characters or less`,
      });
    }

    const orgId = req.orgId || req.user?.orgId;

    if (!orgId) {
      return next();
    }

    // Use custom TTL
    processIdempotentRequestWithOptions(req, res, next, idempotencyKey, orgId, ttlMs, headerName);
  };
}

/**
 * Process idempotent request with custom options
 */
async function processIdempotentRequestWithOptions(
  req: Request,
  res: Response,
  next: NextFunction,
  idempotencyKey: string,
  orgId: string,
  ttlMs: number,
  headerName: string
) {
  const requestPath = req.path;
  const requestMethod = req.method;

  try {
    const dataSource = await getDataSource();
    const idempotencyRepo = dataSource.getRepository(IdempotencyKey);

    const existingKey = await idempotencyRepo.findOne({
      where: { orgId, key: idempotencyKey },
    });

    if (existingKey) {
      if (existingKey.isExpired()) {
        await idempotencyRepo.delete(existingKey.id);
      } else {
        if (!existingKey.matchesRequest(requestPath, requestMethod)) {
          return res.status(422).json({
            error: 'Idempotency key conflict',
            message: `Idempotency key was already used for a different request`,
          });
        }

        res.setHeader(headerName, idempotencyKey);
        res.setHeader('Idempotent-Replayed', 'true');

        return res.status(existingKey.responseStatus).json(existingKey.responseBody);
      }
    }

    const captured = await captureResponse(req, res, next);

    if (captured) {
      try {
        await storeIdempotencyKey(
          orgId,
          idempotencyKey,
          requestPath,
          requestMethod,
          captured.statusCode,
          captured.body,
          ttlMs
        );
      } catch (insertError: unknown) {
        const errorMessage = insertError instanceof Error ? insertError.message : String(insertError);
        if (!errorMessage.includes('duplicate') && !errorMessage.includes('unique')) {
          logger.warn('Failed to store idempotency key', {
            key: idempotencyKey,
            orgId,
            error: errorMessage,
          });
        }
      }
    }
  } catch (error) {
    logger.error('Idempotency middleware error', {
      error: error instanceof Error ? error.message : String(error),
      key: idempotencyKey,
      orgId,
    });
    return next();
  }
}
