import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { config } from "../shared/config/index.js";
import { requestId } from "../shared/middleware/request-id.js";
import { baseRateLimit } from "../shared/middleware/rate-limiter.js";
import { swaggerSpec } from "./swagger.js";
import { logger } from "../shared/utils/logger.js";
import { sendProblem } from "../shared/utils/problem-details.js";
import { router as healthRouter } from "./routes/health.js";

const app = express();

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  }),
);

// Request parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request ID
app.use(requestId);

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on("finish", () => {
    logger.info({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userAgent: req.headers["user-agent"],
    });
  });

  next();
});

// Rate limiting
app.use("/api", baseRateLimit);

// Swagger docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use("/api/v1", healthRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  sendProblem(res, {
    title: "Not Found",
    status: 404,
    detail: "The requested resource was not found.",
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    method: req.method,
    path: req.path,
  });

  sendProblem(res, {
    title: "Internal Server Error",
    status: 500,
    detail: config.isProduction ? "An unexpected error occurred." : err.message,
  });
});

export { app };
