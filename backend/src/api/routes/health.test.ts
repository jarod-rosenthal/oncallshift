import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies
vi.mock("../../shared/db/connection.js", () => ({
  AppDataSource: {
    isInitialized: true,
    query: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}));

vi.mock("../../shared/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  return app;
}

describe("Health & Version endpoints", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { router } = await import("./health.js");
    app = createTestApp();
    app.use("/api/v1", router);
  });

  describe("GET /api/v1/health", () => {
    it("returns 200 when all checks pass", async () => {
      const res = await request(app).get("/api/v1/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
      expect(res.body.checks.database.status).toBe("ok");
      expect(res.body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("returns 503 when database is not initialized", async () => {
      const { AppDataSource } = await import(
        "../../shared/db/connection.js"
      );
      (AppDataSource as any).isInitialized = false;

      const res = await request(app).get("/api/v1/health");

      expect(res.status).toBe(503);
      expect(res.body.status).toBe("degraded");
      expect(res.body.checks.database.status).toBe("error");
      expect(res.body.checks.database.error).toBe("Not initialized");

      // Restore
      (AppDataSource as any).isInitialized = true;
    });

    it("returns 503 when database query fails", async () => {
      const { AppDataSource } = await import(
        "../../shared/db/connection.js"
      );
      (AppDataSource.query as any).mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      const res = await request(app).get("/api/v1/health");

      expect(res.status).toBe(503);
      expect(res.body.status).toBe("error");
      expect(res.body.checks.database.status).toBe("error");
      expect(res.body.checks.database.error).toBe("Connection refused");
    });
  });

  describe("GET /api/v1/version", () => {
    it("returns version information", async () => {
      const res = await request(app).get("/api/v1/version");

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("oncallshift-api");
      expect(res.body.version).toBeDefined();
      expect(res.body.environment).toBeDefined();
      expect(res.body.nodeVersion).toBeDefined();
      expect(res.body).toHaveProperty("buildTime");
      expect(res.body).toHaveProperty("commitSha");
    });

    it("returns the correct app name", async () => {
      const res = await request(app).get("/api/v1/version");

      expect(res.body.name).toBe("oncallshift-api");
    });
  });
});
