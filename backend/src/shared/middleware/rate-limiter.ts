/**
 * Rate Limiting Middleware and Configuration
 *
 * This module implements a comprehensive rate limiting system for the OnCallShift API.
 * It uses an in-memory sliding window counter to track request counts per client.
 *
 * Architecture Overview:
 * =====================
 *
 * 1. CLIENT IDENTIFICATION (Key Extraction)
 *    - API Key (if authenticated via authenticateApiKey middleware)
 *    - X-API-Key header (for service-to-service calls)
 *    - IP address (fallback for unauthenticated requests)
 *
 * 2. RATE LIMIT TIERS (Seven categories with different limits)
 *    ┌─────────────────────────────────────────────────────────┐
 *    │ Tier      │ Window  │ Limit │ Use Case                  │
 *    ├─────────────────────────────────────────────────────────┤
 *    │ read      │ 1 min   │ 1000  │ GET requests              │
 *    │ write     │ 1 min   │ 300   │ POST/PUT/PATCH/DELETE     │
 *    │ expensive │ 1 min   │ 60    │ AI, analytics, reports    │
 *    │ webhook   │ 1 min   │ 100   │ Alert ingestion           │
 *    │ auth      │ 5 min   │ 100   │ Login/registration        │
 *    │ search    │ 1 min   │ 120   │ Full-text search          │
 *    │ bulk      │ 1 min   │ 10    │ Import/export             │
 *    └─────────────────────────────────────────────────────────┘
 *
 * 3. ENFORCEMENT LOCATIONS
 *    - Global: app.use('/api/v1', methodBasedRateLimiter()) applies read/write tiers
 *    - Expensive: /api/v1/ai-*, /api/v1/analytics (60 req/min)
 *    - Bulk: /api/v1/import, /api/v1/export, /api/v1/semantic-import (10 req/min)
 *    - Route-level: Individual routes can apply custom limiters
 *
 * 4. RESPONSE HEADERS (Standard rate limit headers)
 *    - X-RateLimit-Limit: Maximum requests allowed in window
 *    - X-RateLimit-Remaining: Requests remaining before limit
 *    - X-RateLimit-Reset: Unix timestamp when window resets
 *    - Retry-After: Seconds to wait (429 responses only)
 *
 * 5. ERROR RESPONSE (When limit exceeded)
 *    HTTP 429 Too Many Requests with:
 *    {
 *      "error": "Too many requests",
 *      "message": "Rate limit exceeded. Maximum N requests per M seconds.",
 *      "retryAfter": seconds_to_wait
 *    }
 *
 * 6. MEMORY MANAGEMENT (Automatic cleanup)
 *    - Entries older than 5 minutes are removed every 60 seconds
 *    - In-memory store only (not persisted to database)
 *    - Suitable for single-instance deployments
 *    - For multi-instance deployments, consider Redis backend
 *
 * Implementation Notes:
 * ====================
 *
 * - Uses sliding window counter algorithm (not fixed/token bucket)
 * - Key extraction is pluggable via custom keyExtractor function
 * - All timestamps use milliseconds for accuracy
 * - No external dependencies (pure Node.js Map)
 *
 * Testing Recommendations:
 * =======================
 * - Unit tests: RateLimitStore.check() with various edge cases
 * - Integration tests: Express middleware behavior with mock requests
 * - Load tests: Verify cleanup doesn't block under high concurrency
 * - E2E tests: Verify API returns 429 after exceeding limits
 *
 * Monitoring & Alerts:
 * ===================
 * - Log warnings when limits are exceeded (includes key, limit, window)
 * - Consider dashboard metrics for rate limit hit rates by tier
 * - Monitor for suspicious patterns (same key hitting limits repeatedly)
 *
 * Future Improvements:
 * ====================
 * - Redis backend for distributed deployments
 * - Configurable cleanup interval
 * - Per-user custom limits based on subscription tier
 * - Rate limit bypass for internal/trusted clients
 * - Graphite/Prometheus metrics export
 */

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
