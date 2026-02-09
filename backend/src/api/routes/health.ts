import { Router, Request, Response } from "express";
import { AppDataSource } from "../../shared/db/connection.js";
import { logger } from "../../shared/utils/logger.js";

export const router = Router();

interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: "ok" | "error"; latencyMs?: number; error?: string };
  };
}

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns service health status including database connectivity.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy
 */
router.get("/health", async (_req: Request, res: Response) => {
  const response: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: "ok" },
    },
  };

  // Check database connectivity
  try {
    if (AppDataSource.isInitialized) {
      const start = Date.now();
      await AppDataSource.query("SELECT 1");
      response.checks.database.latencyMs = Date.now() - start;
    } else {
      response.checks.database.status = "error";
      response.checks.database.error = "Not initialized";
      response.status = "degraded";
    }
  } catch (error) {
    response.checks.database.status = "error";
    response.checks.database.error =
      error instanceof Error ? error.message : "Unknown error";
    response.status = "error";
    logger.warn("Health check: database unreachable", {
      error: response.checks.database.error,
    });
  }

  const statusCode = response.status === "ok" ? 200 : 503;
  res.status(statusCode).json(response);
});

/**
 * @openapi
 * /version:
 *   get:
 *     summary: Version info
 *     description: Returns build and version information.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Version information
 */
router.get("/version", (_req: Request, res: Response) => {
  res.json({
    name: "oncallshift-api",
    version: process.env.npm_package_version || "0.1.0",
    environment: process.env.NODE_ENV || "development",
    nodeVersion: process.version,
    buildTime: process.env.BUILD_TIME || null,
    commitSha: process.env.COMMIT_SHA || null,
  });
});
