import rateLimit from "express-rate-limit";

/**
 * Base rate limit: 100 requests per minute.
 */
export const baseRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: "about:blank",
    title: "Too Many Requests",
    status: 429,
    detail: "Rate limit exceeded. Try again later.",
  },
});

/**
 * Expensive rate limit: 20 requests per minute.
 * For operations that are computationally expensive or hit external services.
 */
export const expensiveRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: "about:blank",
    title: "Too Many Requests",
    status: 429,
    detail: "Rate limit exceeded. Try again later.",
  },
});

/**
 * Bulk rate limit: 5 requests per minute.
 * For bulk operations and imports.
 */
export const bulkRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: "about:blank",
    title: "Too Many Requests",
    status: 429,
    detail: "Rate limit exceeded. Try again later.",
  },
});
