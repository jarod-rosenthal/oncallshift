import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
} from "./problem-details.js";

describe("Problem Details error classes", () => {
  describe("AppError", () => {
    it("creates error with correct properties", () => {
      const err = new AppError(422, "Unprocessable", "Bad data", {
        field: "email",
      });

      expect(err.status).toBe(422);
      expect(err.title).toBe("Unprocessable");
      expect(err.detail).toBe("Bad data");
      expect(err.type).toBe(
        "https://oncallshift.com/problems/unprocessable",
      );
      expect(err.extensions).toEqual({ field: "email" });
      expect(err.message).toBe("Bad data");
    });

    it("toProblemDetail returns RFC 9457 object", () => {
      const err = new AppError(400, "Bad Request", "Missing field");
      const pd = err.toProblemDetail("/api/v1/users");

      expect(pd.type).toBe(
        "https://oncallshift.com/problems/bad-request",
      );
      expect(pd.title).toBe("Bad Request");
      expect(pd.status).toBe(400);
      expect(pd.detail).toBe("Missing field");
      expect(pd.instance).toBe("/api/v1/users");
    });
  });

  describe("NotFoundError", () => {
    it("formats message with resource and id", () => {
      const err = new NotFoundError("Team", "abc");
      expect(err.status).toBe(404);
      expect(err.detail).toBe("Team with id 'abc' not found");
    });

    it("formats message without id", () => {
      const err = new NotFoundError("Schedule");
      expect(err.detail).toBe("Schedule not found");
    });
  });

  describe("ValidationError", () => {
    it("includes field-level errors", () => {
      const err = new ValidationError("Invalid", {
        name: ["too short"],
      });
      expect(err.status).toBe(400);
      const pd = err.toProblemDetail();
      expect(pd.errors).toEqual({ name: ["too short"] });
    });
  });

  describe("UnauthorizedError", () => {
    it("defaults to 401", () => {
      const err = new UnauthorizedError();
      expect(err.status).toBe(401);
      expect(err.detail).toBe("Authentication required");
    });
  });

  describe("ForbiddenError", () => {
    it("defaults to 403", () => {
      const err = new ForbiddenError();
      expect(err.status).toBe(403);
    });
  });

  describe("ConflictError", () => {
    it("returns 409", () => {
      const err = new ConflictError("Duplicate email");
      expect(err.status).toBe(409);
      expect(err.detail).toBe("Duplicate email");
    });
  });

  describe("RateLimitError", () => {
    it("returns 429 with retry-after", () => {
      const err = new RateLimitError(60);
      expect(err.status).toBe(429);
      const pd = err.toProblemDetail();
      expect(pd.retryAfter).toBe(60);
    });
  });
});
