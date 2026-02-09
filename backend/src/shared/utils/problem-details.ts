import { Response } from "express";

/**
 * RFC 9457 Problem Details for HTTP APIs
 * @see https://www.rfc-editor.org/rfc/rfc9457
 */
export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export function sendProblem(res: Response, problem: ProblemDetails): void {
  res.status(problem.status).type("application/problem+json").json({
    type: problem.type || "about:blank",
    title: problem.title,
    status: problem.status,
    detail: problem.detail,
    instance: problem.instance,
    ...Object.fromEntries(
      Object.entries(problem).filter(
        ([key]) => !["type", "title", "status", "detail", "instance"].includes(key),
      ),
    ),
  });
}

export function notFound(res: Response, detail?: string): void {
  sendProblem(res, {
    title: "Not Found",
    status: 404,
    detail: detail || "The requested resource was not found.",
  });
}

export function badRequest(res: Response, detail: string): void {
  sendProblem(res, {
    title: "Bad Request",
    status: 400,
    detail,
  });
}

export function unauthorized(res: Response, detail?: string): void {
  sendProblem(res, {
    title: "Unauthorized",
    status: 401,
    detail: detail || "Authentication is required.",
  });
}

export function forbidden(res: Response, detail?: string): void {
  sendProblem(res, {
    title: "Forbidden",
    status: 403,
    detail: detail || "You do not have permission to perform this action.",
  });
}

export function conflict(res: Response, detail: string): void {
  sendProblem(res, {
    title: "Conflict",
    status: 409,
    detail,
  });
}

export function internalError(res: Response, detail?: string): void {
  sendProblem(res, {
    title: "Internal Server Error",
    status: 500,
    detail: detail || "An unexpected error occurred.",
  });
}
