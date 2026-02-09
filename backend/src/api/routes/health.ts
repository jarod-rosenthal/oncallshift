import { Router } from "express";
import { checkStorageHealth } from "../../shared/services/storage.js";
import { checkQueueHealth } from "../../shared/services/queue.js";
import { checkAuthHealth } from "../../shared/services/auth.js";
import { checkEmailHealth } from "../../shared/services/email.js";
import { checkPushHealth } from "../../shared/services/push.js";
import { AppDataSource } from "../../shared/db/connection.js";
import { env } from "../../shared/config/env.js";
import { logger } from "../../shared/utils/logger.js";

const router = Router();

const startedAt = new Date().toISOString();

/**
 * GET /health — shallow health check for load balancers.
 * Always returns 200 if the process is running.
 */
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /health/detailed — deep health check that pings all AWS dependencies.
 * Returns 200 if all services are healthy, 503 if any are degraded.
 * Should NOT be used by load balancers (too slow); use for dashboards/alerting.
 */
router.get("/health/detailed", async (_req, res) => {
  const checks: Record<string, { status: string; latencyMs?: number }> = {};

  const checkService = async (
    name: string,
    fn: () => Promise<boolean>,
  ): Promise<void> => {
    const start = Date.now();
    try {
      const healthy = await fn();
      checks[name] = {
        status: healthy ? "ok" : "unconfigured",
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      logger.warn("Health check failed", { service: name });
      checks[name] = { status: "error", latencyMs: Date.now() - start };
    }
  };

  await Promise.all([
    checkService("database", async () => {
      if (!AppDataSource.isInitialized) return false;
      await AppDataSource.query("SELECT 1");
      return true;
    }),
    checkService("cognito", checkAuthHealth),
    checkService("sqs_alerts", () =>
      env.alertsQueueUrl
        ? checkQueueHealth(env.alertsQueueUrl)
        : Promise.resolve(false),
    ),
    checkService("sqs_notifications", () =>
      env.notificationsQueueUrl
        ? checkQueueHealth(env.notificationsQueueUrl)
        : Promise.resolve(false),
    ),
    checkService("s3", () => checkStorageHealth(env.s3UploadsBucket)),
    checkService("ses", checkEmailHealth),
    checkService("sns", checkPushHealth),
  ]);

  const allOk = Object.values(checks).every(
    (c) => c.status === "ok" || c.status === "unconfigured",
  );

  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    startedAt,
    services: checks,
  });
});

/**
 * GET /version — build and runtime info.
 */
router.get("/version", (_req, res) => {
  res.json({
    version: process.env.npm_package_version || "0.1.0",
    node: process.version,
    environment: env.nodeEnv,
  });
});

export default router;
