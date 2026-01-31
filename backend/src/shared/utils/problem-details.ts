/**
 * RFC 9457 Problem Details for HTTP APIs
 * https://www.rfc-editor.org/rfc/rfc9457.html
 *
 * Provides standardized error responses that include:
 * - type: URI reference identifying the problem type
 * - title: Short, human-readable summary
 * - status: HTTP status code
 * - detail: Human-readable explanation specific to this occurrence
 * - instance: URI reference identifying the specific occurrence
 */

import { Response } from 'express';

// ============================================
// Types
// ============================================

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  // Extension members
  [key: string]: unknown;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

// ============================================
// Problem Type URIs
// ============================================

const BASE_URI = 'https://oncallshift.com/problems';

export const PROBLEM_TYPES = {
  // Client errors (4xx)
  BAD_REQUEST: `${BASE_URI}/bad-request`,
  VALIDATION_ERROR: `${BASE_URI}/validation-error`,
  UNAUTHORIZED: `${BASE_URI}/unauthorized`,
  FORBIDDEN: `${BASE_URI}/forbidden`,
  NOT_FOUND: `${BASE_URI}/not-found`,
  METHOD_NOT_ALLOWED: `${BASE_URI}/method-not-allowed`,
  CONFLICT: `${BASE_URI}/conflict`,
  GONE: `${BASE_URI}/gone`,
  UNPROCESSABLE_ENTITY: `${BASE_URI}/unprocessable-entity`,
  RATE_LIMITED: `${BASE_URI}/rate-limited`,
  IDEMPOTENCY_CONFLICT: `${BASE_URI}/idempotency-conflict`,

  // Server errors (5xx)
  INTERNAL_ERROR: `${BASE_URI}/internal-error`,
  NOT_IMPLEMENTED: `${BASE_URI}/not-implemented`,
  SERVICE_UNAVAILABLE: `${BASE_URI}/service-unavailable`,
  GATEWAY_TIMEOUT: `${BASE_URI}/gateway-timeout`,

  // Business logic errors
  QUOTA_EXCEEDED: `${BASE_URI}/quota-exceeded`,
  PAYMENT_REQUIRED: `${BASE_URI}/payment-required`,
  RESOURCE_LOCKED: `${BASE_URI}/resource-locked`,
  DEPENDENCY_FAILED: `${BASE_URI}/dependency-failed`,
} as const;

// ============================================
// Core Response Function
// ============================================

/**
 * Send an RFC 9457 Problem Details response
 * Maintains backwards compatibility by including 'error' field
 */
export function problemResponse(
  res: Response,
  status: number,
  type: string,
  title: string,
  detail?: string,
  extras?: Record<string, unknown>
): Response {
  // Set content type for problem details
  res.setHeader('Content-Type', 'application/problem+json');

  const problem: ProblemDetails = {
    type,
    title,
    status,
    ...(detail && { detail }),
    instance: res.req?.originalUrl,
    // Backwards compatibility: keep 'error' field for existing clients
    error: detail || title,
    ...extras,
  };

  return res.status(status).json(problem);
}

// ============================================
// Convenience Functions - Client Errors (4xx)
// ============================================

/**
 * 400 Bad Request - Generic client error
 */
export function badRequest(
  res: Response,
  detail: string,
  extras?: Record<string, unknown>
): Response {
  return problemResponse(
    res,
    400,
    PROBLEM_TYPES.BAD_REQUEST,
    'Bad Request',
    detail,
    extras
  );
}

/**
 * 400 Validation Error - With field-level details
 */
export function validationError(
  res: Response,
  errors: ValidationError[]
): Response {
  return problemResponse(
    res,
    400,
    PROBLEM_TYPES.VALIDATION_ERROR,
    'Validation Failed',
    'One or more fields failed validation',
    {
      errors,
      // Backwards compatibility
      validation_errors: errors,
    }
  );
}

/**
 * 401 Unauthorized - Authentication required
 */
export function unauthorized(
  res: Response,
  detail: string = 'Authentication is required to access this resource'
): Response {
  return problemResponse(
    res,
    401,
    PROBLEM_TYPES.UNAUTHORIZED,
    'Unauthorized',
    detail
  );
}

/**
 * 403 Forbidden - Insufficient permissions
 */
export function forbidden(
  res: Response,
  detail: string = 'You do not have permission to access this resource'
): Response {
  return problemResponse(
    res,
    403,
    PROBLEM_TYPES.FORBIDDEN,
    'Forbidden',
    detail
  );
}

/**
 * 404 Not Found - Resource not found
 */
export function notFound(
  res: Response,
  resource: string,
  id?: string
): Response {
  const detail = id
    ? `${resource} with ID '${id}' was not found`
    : `${resource} was not found`;

  return problemResponse(
    res,
    404,
    PROBLEM_TYPES.NOT_FOUND,
    'Resource Not Found',
    detail,
    { resource, ...(id && { resourceId: id }) }
  );
}

/**
 * 405 Method Not Allowed
 */
export function methodNotAllowed(
  res: Response,
  allowedMethods: string[]
): Response {
  res.setHeader('Allow', allowedMethods.join(', '));

  return problemResponse(
    res,
    405,
    PROBLEM_TYPES.METHOD_NOT_ALLOWED,
    'Method Not Allowed',
    `This endpoint does not support the requested HTTP method`,
    { allowedMethods }
  );
}

/**
 * 409 Conflict - Resource conflict
 */
export function conflict(
  res: Response,
  detail: string,
  extras?: Record<string, unknown>
): Response {
  return problemResponse(
    res,
    409,
    PROBLEM_TYPES.CONFLICT,
    'Conflict',
    detail,
    extras
  );
}

/**
 * 410 Gone - Resource no longer available
 */
export function gone(
  res: Response,
  resource: string,
  detail?: string
): Response {
  return problemResponse(
    res,
    410,
    PROBLEM_TYPES.GONE,
    'Gone',
    detail || `The ${resource} has been permanently removed`,
    { resource }
  );
}

/**
 * 422 Unprocessable Entity - Semantic errors
 */
export function unprocessableEntity(
  res: Response,
  detail: string,
  extras?: Record<string, unknown>
): Response {
  return problemResponse(
    res,
    422,
    PROBLEM_TYPES.UNPROCESSABLE_ENTITY,
    'Unprocessable Entity',
    detail,
    extras
  );
}

/**
 * 429 Rate Limited - Too many requests
 */
export function rateLimited(
  res: Response,
  retryAfter: number
): Response {
  res.setHeader('Retry-After', retryAfter.toString());

  return problemResponse(
    res,
    429,
    PROBLEM_TYPES.RATE_LIMITED,
    'Rate Limit Exceeded',
    `Too many requests. Please retry after ${retryAfter} seconds.`,
    { retryAfter }
  );
}

/**
 * 409/422 Idempotency Conflict - Request hash mismatch
 */
export function idempotencyConflict(
  res: Response,
  detail: string = 'A request with this idempotency key was already processed with different parameters'
): Response {
  return problemResponse(
    res,
    422,
    PROBLEM_TYPES.IDEMPOTENCY_CONFLICT,
    'Idempotency Key Conflict',
    detail
  );
}

// ============================================
// Convenience Functions - Server Errors (5xx)
// ============================================

/**
 * 500 Internal Server Error
 * Note: Never expose internal details in production
 */
export function internalError(
  res: Response,
  requestId?: string
): Response {
  const detail = requestId
    ? `An unexpected error occurred. Reference ID: ${requestId}`
    : 'An unexpected error occurred. Please try again later.';

  return problemResponse(
    res,
    500,
    PROBLEM_TYPES.INTERNAL_ERROR,
    'Internal Server Error',
    detail,
    requestId ? { requestId } : undefined
  );
}

/**
 * 501 Not Implemented
 */
export function notImplemented(
  res: Response,
  feature: string
): Response {
  return problemResponse(
    res,
    501,
    PROBLEM_TYPES.NOT_IMPLEMENTED,
    'Not Implemented',
    `The ${feature} feature is not yet implemented`
  );
}

/**
 * 503 Service Unavailable
 */
export function serviceUnavailable(
  res: Response,
  retryAfter?: number,
  detail: string = 'The service is temporarily unavailable. Please try again later.'
): Response {
  if (retryAfter) {
    res.setHeader('Retry-After', retryAfter.toString());
  }

  return problemResponse(
    res,
    503,
    PROBLEM_TYPES.SERVICE_UNAVAILABLE,
    'Service Unavailable',
    detail,
    retryAfter ? { retryAfter } : undefined
  );
}

/**
 * 504 Gateway Timeout
 */
export function gatewayTimeout(
  res: Response,
  detail: string = 'The request timed out while waiting for an upstream service'
): Response {
  return problemResponse(
    res,
    504,
    PROBLEM_TYPES.GATEWAY_TIMEOUT,
    'Gateway Timeout',
    detail
  );
}

// ============================================
// Convenience Functions - Business Logic Errors
// ============================================

/**
 * 402 Payment Required / 403 Quota Exceeded
 */
export function quotaExceeded(
  res: Response,
  resource: string,
  limit: number,
  current: number
): Response {
  return problemResponse(
    res,
    403,
    PROBLEM_TYPES.QUOTA_EXCEEDED,
    'Quota Exceeded',
    `You have exceeded the ${resource} limit`,
    { resource, limit, current }
  );
}

/**
 * 423 Resource Locked
 */
export function resourceLocked(
  res: Response,
  resource: string,
  detail?: string
): Response {
  return problemResponse(
    res,
    423,
    PROBLEM_TYPES.RESOURCE_LOCKED,
    'Resource Locked',
    detail || `The ${resource} is currently locked and cannot be modified`,
    { resource }
  );
}

/**
 * 424 Dependency Failed
 */
export function dependencyFailed(
  res: Response,
  dependency: string,
  detail: string
): Response {
  return problemResponse(
    res,
    424,
    PROBLEM_TYPES.DEPENDENCY_FAILED,
    'Dependency Failed',
    detail,
    { dependency }
  );
}

// ============================================
// Express-Validator Integration
// ============================================

import { ValidationError as ExpressValidationError } from 'express-validator';

/**
 * Convert express-validator errors to RFC 9457 format
 */
export function fromExpressValidator(
  errors: ExpressValidationError[]
): ValidationError[] {
  return errors.map(err => {
    if (err.type === 'field') {
      return {
        field: err.path,
        message: err.msg,
        value: err.value,
      };
    }
    return {
      field: 'unknown',
      message: err.msg,
    };
  });
}
