import type { Request, Response, NextFunction } from "express";

/**
 * Simple in-memory rate limiter.
 * Replace with Redis-backed rate limiter in production.
 */

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function rateLimiter(options: RateLimitOptions = { windowMs: 60_000, max: 100 }) {
  const requestCounts = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || "unknown";
    const now = Date.now();

    const entry = requestCounts.get(key);
    if (!entry || now > entry.resetAt) {
      requestCounts.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    entry.count++;
    if (entry.count > options.max) {
      res.status(429).type("application/problem+json").json({
        type: "https://oncallshift.com/problems/rate-limit-exceeded",
        title: "Rate Limit Exceeded",
        status: 429,
        detail: "Too many requests. Please try again later.",
      });
      return;
    }

    next();
  };
}
