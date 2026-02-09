import rateLimit from "express-rate-limit";

/**
 * Tiered rate limiting as specified in the PRD.
 * - base: general API routes
 * - expensive: computationally expensive operations
 * - bulk: bulk/batch endpoints
 * - auth: authentication endpoints (strict)
 *
 * In production these should use a Redis store for distributed rate limiting.
 * For Phase 0.1 we use the in-memory store (single-process).
 */

/** Standard API rate limit: 100 requests per 15 minutes */
export const baseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: "https://oncallshift.com/problems/too-many-requests",
    title: "Too Many Requests",
    status: 429,
    detail: "Rate limit exceeded. Try again later.",
  },
});

/** Expensive operations: 20 requests per 15 minutes */
export const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: "https://oncallshift.com/problems/too-many-requests",
    title: "Too Many Requests",
    status: 429,
    detail: "Rate limit exceeded for expensive operation. Try again later.",
  },
});

/** Bulk operations: 10 requests per 15 minutes */
export const bulkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: "https://oncallshift.com/problems/too-many-requests",
    title: "Too Many Requests",
    status: 429,
    detail: "Rate limit exceeded for bulk operation. Try again later.",
  },
});

/** Auth endpoints: 5 requests per minute */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: "https://oncallshift.com/problems/too-many-requests",
    title: "Too Many Requests",
    status: 429,
    detail: "Too many authentication attempts. Try again later.",
  },
});
