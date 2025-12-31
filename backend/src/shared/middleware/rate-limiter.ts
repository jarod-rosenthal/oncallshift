import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimiterOptions {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Max requests per window
  keyExtractor?: (req: Request) => string | null;
}

/**
 * In-memory rate limiter store
 * Tracks request counts per key within sliding time windows
 */
class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if key is within rate limit and increment counter
   * Returns remaining requests or -1 if limit exceeded
   */
  check(key: string, windowMs: number, maxRequests: number): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      // Start new window
      this.store.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowMs,
      };
    }

    // Within existing window
    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.windowStart + windowMs,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: entry.windowStart + windowMs,
    };
  }

  private cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > maxAge) {
        this.store.delete(key);
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Global store instance
const store = new RateLimitStore();

/**
 * Default key extractor - uses API key from request
 */
function defaultKeyExtractor(req: Request): string | null {
  // Use API key if available (set by authenticateApiKey middleware)
  if (req.service?.apiKey) {
    return `apikey:${req.service.apiKey}`;
  }

  // Fall back to X-API-Key header
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    return `apikey:${apiKey}`;
  }

  // Fall back to IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Create rate limiting middleware
 *
 * @param options - Rate limiter configuration
 * @returns Express middleware function
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    keyExtractor = defaultKeyExtractor,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyExtractor(req);

    if (!key) {
      // Can't identify client, allow request but log warning
      logger.warn('Rate limiter: Could not extract key from request');
      return next();
    }

    const result = store.check(key, windowMs, maxRequests);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        key,
        limit: maxRequests,
        windowMs,
      });

      res.setHeader('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000));
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      });
    }

    return next();
  };
}

/**
 * Pre-configured rate limiter for webhook endpoints
 * 100 requests per minute per API key
 */
export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 100,
});

// Export store for testing purposes
export { store as rateLimitStore };
