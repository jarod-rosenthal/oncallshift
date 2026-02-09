import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      /** Unique request/correlation ID for tracing */
      requestId: string;
    }
  }
}

const HEADER = "x-request-id";

/**
 * Assigns a unique request ID to every request.
 * If the client sends an x-request-id header, it is reused (for distributed tracing).
 * Otherwise a new UUID v4 is generated.
 * The ID is set on both req.requestId and the response header.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id =
    (typeof req.headers[HEADER] === "string" && req.headers[HEADER]) ||
    randomUUID();
  req.requestId = id;
  res.setHeader(HEADER, id);
  next();
}
