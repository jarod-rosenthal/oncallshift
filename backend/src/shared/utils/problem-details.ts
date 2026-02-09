/**
 * RFC 9457 Problem Details for HTTP APIs.
 * Standard error format used across all API responses.
 */

export interface ProblemDetail {
  /** URI reference identifying the problem type */
  type: string;
  /** Short human-readable summary */
  title: string;
  /** HTTP status code */
  status: number;
  /** Human-readable explanation specific to this occurrence */
  detail?: string;
  /** URI reference identifying the specific occurrence */
  instance?: string;
  /** Extension members */
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly status: number;
  public readonly type: string;
  public readonly title: string;
  public readonly detail?: string;
  public readonly extensions: Record<string, unknown>;

  constructor(
    status: number,
    title: string,
    detail?: string,
    extensions: Record<string, unknown> = {},
  ) {
    super(detail || title);
    this.name = "AppError";
    this.status = status;
    this.type = `https://oncallshift.com/problems/${toKebab(title)}`;
    this.title = title;
    this.detail = detail;
    this.extensions = extensions;
  }

  toProblemDetail(instance?: string): ProblemDetail {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      ...(this.detail ? { detail: this.detail } : {}),
      ...(instance ? { instance } : {}),
      ...this.extensions,
    };
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      404,
      "Not Found",
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
    );
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(detail: string, errors?: Record<string, string[]>) {
    super(400, "Validation Error", detail, errors ? { errors } : {});
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail = "Authentication required") {
    super(401, "Unauthorized", detail);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(detail = "Insufficient permissions") {
    super(403, "Forbidden", detail);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(detail: string) {
    super(409, "Conflict", detail);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds?: number) {
    super(429, "Too Many Requests", "Rate limit exceeded", {
      ...(retryAfterSeconds ? { retryAfter: retryAfterSeconds } : {}),
    });
    this.name = "RateLimitError";
  }
}

function toKebab(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
