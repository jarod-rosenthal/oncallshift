import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../shared/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { createApp } from "./app.js";
import request from "supertest";

describe("Express App", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it("returns 404 with RFC 9457 Problem Details for unknown routes", async () => {
    const res = await request(app).get("/api/v1/nonexistent");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({
      type: "https://oncallshift.com/problems/not-found",
      title: "Not Found",
      status: 404,
    });
  });

  it("sets security headers via helmet", async () => {
    const res = await request(app).get("/anything");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("sets x-request-id header", async () => {
    const res = await request(app).get("/anything");

    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("echoes back client-provided x-request-id", async () => {
    const customId = "custom-request-id-123";
    const res = await request(app)
      .get("/anything")
      .set("x-request-id", customId);

    expect(res.headers["x-request-id"]).toBe(customId);
  });

  it("handles CORS preflight", async () => {
    const res = await request(app)
      .options("/api/v1/test")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET");

    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("parses JSON body", async () => {
    // We can't test with a real route yet, but verify middleware doesn't crash
    const res = await request(app)
      .post("/api/v1/test")
      .send({ key: "value" })
      .set("Content-Type", "application/json");

    // Should get 404 (no route), not a parsing error
    expect(res.status).toBe(404);
  });
});
