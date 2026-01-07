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

// ============================================
// Tiered Rate Limiting Configuration
// ============================================

/**
 * Rate limit tiers for different endpoint categories
 * Based on industry standards from PagerDuty, Stripe, and Twilio
 */
export const RATE_LIMIT_TIERS = {
  // Tier 1: Read-heavy endpoints (GET requests)
  // High limit for dashboard and list views
  read: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 1000,
    description: 'Read operations (GET requests)',
  },

  // Tier 2: Write endpoints (POST, PUT, PATCH, DELETE)
  // Moderate limit for mutations
  write: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 300,
    description: 'Write operations (POST, PUT, PATCH, DELETE)',
  },

  // Tier 3: Expensive operations (AI, analytics, reports)
  // Low limit for resource-intensive operations
  expensive: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 60,
    description: 'Expensive operations (AI, analytics, reports)',
  },

  // Tier 4: Webhook ingestion
  // Balanced limit for alert ingestion
  webhook: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100,
    description: 'Webhook/alert ingestion',
  },

  // Tier 5: Authentication endpoints
  // Reasonable limit to prevent brute force while allowing normal usage
  auth: {
    windowMs: 5 * 60 * 1000,  // 5 minutes
    maxRequests: 100,
    description: 'Authentication attempts',
  },

  // Tier 6: Search endpoints
  // Moderate limit for full-text search
  search: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 120,
    description: 'Search operations',
  },

  // Tier 7: Bulk operations
  // Low limit for bulk imports/exports
  bulk: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 10,
    description: 'Bulk operations (import/export)',
  },
} as const;

// ============================================
// Pre-configured Rate Limiters
// ============================================

/**
 * Rate limiter for read endpoints (GET requests)
 * 1000 requests per minute
 */
export const readRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_TIERS.read.windowMs,
  maxRequests: RATE_LIMIT_TIERS.read.maxRequests,
});

/**
 * Rate limiter for write endpoints (POST, PUT, PATCH, DELETE)
 * 300 requests per minute
 */
export const writeRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_TIERS.write.windowMs,
  maxRequests: RATE_LIMIT_TIERS.write.maxRequests,
});

/**
 * Rate limiter for expensive operations (AI, analytics, reports)
 * 60 requests per minute
 */
export const expensiveRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_TIERS.expensive.windowMs,
  maxRequests: RATE_LIMIT_TIERS.expensive.maxRequests,
});

/**
 * Pre-configured rate limiter for webhook endpoints
 * 100 requests per minute per API key
 */
export const webhookRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_TIERS.webhook.windowMs,
  maxRequests: RATE_LIMIT_TIERS.webhook.maxRequests,
});

/**
 * Rate limiter for authentication endpoints
 * 100 requests per 5 minutes
 */
export const authRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_TIERS.auth.windowMs,
  maxRequests: RATE_LIMIT_TIERS.auth.maxRequests,
});

/**
 * Rate limiter for search endpoints
 * 120 requests per minute
 */
export const searchRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_TIERS.search.windowMs,
  maxRequests: RATE_LIMIT_TIERS.search.maxRequests,
});

/**
 * Rate limiter for bulk operations
 * 10 requests per minute
 */
export const bulkRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_TIERS.bulk.windowMs,
  maxRequests: RATE_LIMIT_TIERS.bulk.maxRequests,
});

// ============================================
// Dynamic Rate Limiter Factory
// ============================================

/**
 * Create a rate limiter middleware that applies different limits
 * based on HTTP method
 */
export function methodBasedRateLimiter() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      return readRateLimiter(req, res, next);
    }
    return writeRateLimiter(req, res, next);
  };
}

// Export store for testing purposes
export { store as rateLimitStore };
