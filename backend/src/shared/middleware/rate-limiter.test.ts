import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { rateLimiter } from "./rate-limiter.js";

function createMocks() {
  const req = { ip: "127.0.0.1" } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("rateLimiter middleware", () => {
  it("allows requests under the limit", () => {
    const limiter = rateLimiter({ windowMs: 60_000, max: 5 });
    const { req, res, next } = createMocks();

    limiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 429 when limit is exceeded", () => {
    const limiter = rateLimiter({ windowMs: 60_000, max: 2 });

    // First two should pass
    for (let i = 0; i < 2; i++) {
      const { req, res, next } = createMocks();
      limiter(req, res, next);
      expect(next).toHaveBeenCalled();
    }

    // Third should be rate limited
    const { req, res, next } = createMocks();
    limiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 429,
        title: "Rate Limit Exceeded",
      }),
    );
  });
});
