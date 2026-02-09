import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requestId } from "./request-id.js";

function createMocks(requestIdHeader?: string) {
  const req = {
    headers: requestIdHeader ? { "x-request-id": requestIdHeader } : {},
  } as unknown as Request;
  const res = {
    setHeader: vi.fn(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("requestId middleware", () => {
  it("generates a UUID when no x-request-id header is present", () => {
    const { req, res, next } = createMocks();
    requestId(req, res, next);

    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", req.requestId);
    expect(next).toHaveBeenCalled();
  });

  it("uses the provided x-request-id header", () => {
    const { req, res, next } = createMocks("my-custom-id");
    requestId(req, res, next);

    expect(req.requestId).toBe("my-custom-id");
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "my-custom-id");
    expect(next).toHaveBeenCalled();
  });
});
