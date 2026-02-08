import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { errorHandler, notFoundHandler } from "./error-handler.js";
import { requestIdMiddleware } from "./request-id.js";
import {
  AppError,
  NotFoundError,
  ValidationError,
} from "../utils/problem-details.js";

function createTestApp(
  handler: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => void,
) {
  const app = express();
  app.use(requestIdMiddleware);
  app.get("/test", handler);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe("Error handler middleware", () => {
  it("converts AppError to RFC 9457 Problem Detail", async () => {
    const app = createTestApp((_req, _res, next) => {
      next(new AppError(422, "Unprocessable Entity", "Invalid data"));
    });

    const res = await request(app).get("/test");

    expect(res.status).toBe(422);
    expect(res.body.type).toBe(
      "https://oncallshift.com/problems/unprocessable-entity",
    );
    expect(res.body.title).toBe("Unprocessable Entity");
    expect(res.body.status).toBe(422);
    expect(res.body.detail).toBe("Invalid data");
    expect(res.body.instance).toBe("/test");
  });

  it("converts NotFoundError correctly", async () => {
    const app = createTestApp((_req, _res, next) => {
      next(new NotFoundError("User", "abc-123"));
    });

    const res = await request(app).get("/test");

    expect(res.status).toBe(404);
    expect(res.body.title).toBe("Not Found");
    expect(res.body.detail).toBe("User with id 'abc-123' not found");
  });

  it("converts ValidationError with field errors", async () => {
    const app = createTestApp((_req, _res, next) => {
      next(
        new ValidationError("Invalid input", {
          email: ["must be a valid email"],
        }),
      );
    });

    const res = await request(app).get("/test");

    expect(res.status).toBe(400);
    expect(res.body.title).toBe("Validation Error");
    expect(res.body.errors).toEqual({
      email: ["must be a valid email"],
    });
  });

  it("handles unknown errors as 500 without leaking details", async () => {
    const app = createTestApp((_req, _res, next) => {
      next(new Error("secret database password leak"));
    });

    const res = await request(app).get("/test");

    expect(res.status).toBe(500);
    expect(res.body.title).toBe("Internal Server Error");
    expect(res.body.detail).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
});

describe("Not found handler", () => {
  it("returns 404 for unmatched routes", async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(notFoundHandler);
    app.use(errorHandler);

    const res = await request(app).get("/nonexistent");

    expect(res.status).toBe(404);
    expect(res.body.title).toBe("Not Found");
    expect(res.body.detail).toContain("GET /nonexistent");
  });
});
