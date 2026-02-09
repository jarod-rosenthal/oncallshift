import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("Health routes", () => {
  describe("GET /health", () => {
    it("returns 200 with status ok", async () => {
      const res = await request(app).get("/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptime).toBeTypeOf("number");
    });
  });

  describe("GET /version", () => {
    it("returns 200 with version info", async () => {
      const res = await request(app).get("/version");

      expect(res.status).toBe(200);
      expect(res.body.version).toBeDefined();
      expect(res.body.node).toBeDefined();
      expect(res.body.environment).toBeDefined();
    });
  });

  describe("GET /health/detailed", () => {
    it("returns health status with service checks", async () => {
      const res = await request(app).get("/health/detailed");

      // Without AWS credentials, services will be unconfigured/errored
      expect([200, 503]).toContain(res.status);
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptime).toBeTypeOf("number");
      expect(res.body.startedAt).toBeDefined();
      expect(res.body.services).toBeDefined();
    });
  });
});
