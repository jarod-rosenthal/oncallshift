import type { Request, Response } from "express";

/**
 * RFC 9457 Problem Details for HTTP APIs
 * https://www.rfc-editor.org/rfc/rfc9457
 */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export function problemResponse(
  res: Response,
  status: number,
  title: string,
  detail?: string,
  extra?: Record<string, unknown>,
): void {
  const problem: ProblemDetail = {
    type: `https://oncallshift.com/problems/${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    status,
    ...(detail && { detail }),
    ...(extra && extra),
  };

  res.status(status).type("application/problem+json").json(problem);
}

export function notFound(res: Response, detail?: string): void {
  problemResponse(res, 404, "Not Found", detail || "The requested resource was not found.");
}

export function badRequest(res: Response, detail: string, extra?: Record<string, unknown>): void {
  problemResponse(res, 400, "Bad Request", detail, extra);
}

export function unauthorized(res: Response, detail?: string): void {
  problemResponse(res, 401, "Unauthorized", detail || "Authentication is required.");
}

export function forbidden(res: Response, detail?: string): void {
  problemResponse(res, 403, "Forbidden", detail || "You do not have permission to perform this action.");
}

export function conflict(res: Response, detail: string): void {
  problemResponse(res, 409, "Conflict", detail);
}

export function internalError(res: Response, detail?: string): void {
  problemResponse(res, 500, "Internal Server Error", detail || "An unexpected error occurred.");
}
