import express from "express";
import cors from "cors";
import helmet from "helmet";
import { requestId } from "../shared/middleware/request-id.js";
import { rateLimiter } from "../shared/middleware/rate-limiter.js";
import { logger } from "../shared/utils/logger.js";
import { internalError } from "../shared/utils/problem-details.js";

export function createApp(): express.Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS — whitelist origins from env
  const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173").split(",");
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  // Request ID
  app.use(requestId);

  // Body parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting
  app.use(rateLimiter({ windowMs: 60_000, max: 200 }));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info("Request completed", {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  });

  // Routes will be registered here
  // Example: app.use("/api/v1/incidents", incidentsRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).type("application/problem+json").json({
      type: "https://oncallshift.com/problems/not-found",
      title: "Not Found",
      status: 404,
      detail: `No route matches ${req.method} ${req.path}`,
      instance: req.path,
    });
  });

  // Global error handler (RFC 9457)
  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error("Unhandled error", {
        requestId: req.requestId,
        error: err.message,
        stack: err.stack,
      });
      internalError(res);
    },
  );

  return app;
}
