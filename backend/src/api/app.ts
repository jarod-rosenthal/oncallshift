import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { requestIdMiddleware } from "../shared/middleware/request-id.js";
import { requestLoggerMiddleware } from "../shared/middleware/request-logger.js";
import { errorHandler, notFoundHandler } from "../shared/middleware/error-handler.js";
import { baseLimiter } from "../shared/middleware/rate-limiter.js";
import { env } from "../shared/config/env.js";
import healthRouter from "./routes/health.js";

const app = express();

// --- Security & compression ---
app.use(helmet());
app.use(compression());

// --- CORS ---
app.use(
  cors({
    origin: env.corsOrigins.split(",").map((o) => o.trim()),
    credentials: true,
  }),
);

// --- Request ID (correlation / tracing) ---
app.use(requestIdMiddleware);

// --- Body parsing ---
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// --- Request logging ---
app.use(requestLoggerMiddleware);

// --- Rate limiting (global baseline) ---
app.use(baseLimiter);

// --- Routes ---
app.use("/", healthRouter);

// Future API routes mount here:
// app.use("/api/v1", apiRouter);

// --- 404 catch-all ---
app.use(notFoundHandler);

// --- Global error handler (must be last) ---
app.use(errorHandler);

export default app;
