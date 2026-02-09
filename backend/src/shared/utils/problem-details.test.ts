import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";
import {
  problemResponse,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
  internalError,
} from "./problem-details.js";

function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe("problem-details", () => {
  it("sends RFC 9457 compliant response", () => {
    const res = createMockResponse();
    problemResponse(res, 400, "Bad Request", "Invalid email address");

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.type).toHaveBeenCalledWith("application/problem+json");
    expect(res.json).toHaveBeenCalledWith({
      type: "https://oncallshift.com/problems/bad-request",
      title: "Bad Request",
      status: 400,
      detail: "Invalid email address",
    });
  });

  it("includes extra fields when provided", () => {
    const res = createMockResponse();
    problemResponse(res, 400, "Validation Error", "Invalid input", {
      errors: [{ field: "email", message: "required" }],
    });

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [{ field: "email", message: "required" }],
      }),
    );
  });

  it("notFound sends 404", () => {
    const res = createMockResponse();
    notFound(res, "User not found");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("badRequest sends 400", () => {
    const res = createMockResponse();
    badRequest(res, "Missing field");
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("unauthorized sends 401", () => {
    const res = createMockResponse();
    unauthorized(res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("forbidden sends 403", () => {
    const res = createMockResponse();
    forbidden(res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("conflict sends 409", () => {
    const res = createMockResponse();
    conflict(res, "Already exists");
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("internalError sends 500", () => {
    const res = createMockResponse();
    internalError(res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
