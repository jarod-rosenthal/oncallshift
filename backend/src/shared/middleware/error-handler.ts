import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/problem-details.js";
import { logger } from "../utils/logger.js";

/**
 * Global error-handling middleware.
 * Converts AppError instances to RFC 9457 Problem Detail responses.
 * Unknown errors become 500 Internal Server Error without leaking stack traces.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const problem = err.toProblemDetail(req.originalUrl);
    if (err.status >= 500) {
      logger.error(err.message, { requestId: req.requestId });
    }
    res.status(err.status).json(problem);
    return;
  }

  // Unexpected error — log full stack, return generic response
  logger.error("Unhandled error", {
    requestId: req.requestId,
    stack: err.stack,
  });

  res.status(500).json({
    type: "https://oncallshift.com/problems/internal-server-error",
    title: "Internal Server Error",
    status: 500,
    instance: req.originalUrl,
  });
}

/**
 * Catch-all for routes that don't match.
 * Must be mounted AFTER all route handlers.
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  res.status(404).json({
    type: "https://oncallshift.com/problems/not-found",
    title: "Not Found",
    status: 404,
    detail: `No route matches ${req.method} ${req.path}`,
    instance: req.originalUrl,
  });
}
