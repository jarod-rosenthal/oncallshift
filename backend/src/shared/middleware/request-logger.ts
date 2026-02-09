import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

/**
 * Logs every HTTP request/response with timing info and correlation ID.
 * Must be mounted AFTER requestIdMiddleware.
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const meta = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      contentLength: res.getHeader("content-length"),
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error("Request completed with server error", meta);
    } else if (res.statusCode >= 400) {
      logger.warn("Request completed with client error", meta);
    } else {
      logger.info("Request completed", meta);
    }
  });

  next();
}
