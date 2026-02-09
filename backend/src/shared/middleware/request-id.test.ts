import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../api/app.js";

describe("Request ID middleware", () => {
  it("generates x-request-id header when none provided", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["x-request-id"]).toBeDefined();
    // UUID v4 format
    expect(res.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("preserves x-request-id header when provided by client", async () => {
    const clientId = "test-correlation-id-123";
    const res = await request(app)
      .get("/health")
      .set("x-request-id", clientId);

    expect(res.headers["x-request-id"]).toBe(clientId);
  });
});
