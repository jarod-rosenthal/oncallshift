/**
 * Validation Error Middleware
 *
 * Automatically catches express-validator validation errors and returns
 * them in RFC 9457 Problem Details format.
 *
 * Usage:
 * - Add to route validation chain (before handler)
 * - Automatically extracts errors and returns standardized response
 * - Eliminates need to manually call validationResult() in every route
 *
 * Example:
 * ```typescript
 * router.post(
 *   '/',
 *   [
 *     body('email').isEmail(),
 *     body('name').notEmpty(),
 *   ],
 *   validationErrorMiddleware, // Add this middleware
 *   async (req, res) => {
 *     // Handler code - validation errors are already handled
 *     const { email, name } = req.body;
 *     // ...
 *   }
 * );
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError as ExpressValidationError } from 'express-validator';
import { validationError, fromExpressValidator } from '../utils/problem-details';
import { logger } from '../utils/logger';

/**
 * Middleware to automatically handle validation errors
 *
 * When express-validator detects validation errors, this middleware:
 * 1. Extracts errors from the request
 * 2. Converts them to RFC 9457 format using fromExpressValidator()
 * 3. Returns a standardized 400 response with field-level error details
 *
 * If no validation errors exist, passes control to the next handler.
 */
export function validationErrorMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Log validation errors for debugging
    logger.debug('Validation errors detected', {
      requestId: (req as any).requestId,
      endpoint: req.path,
      method: req.method,
      errorCount: errors.array().length,
      errors: errors.array().map(err => ({
        field: 'path' in err ? err.path : 'unknown',
        message: err.msg,
      })),
    });

    // Convert express-validator errors to RFC 9457 format
    const convertedErrors = fromExpressValidator(errors.array());

    // Attach request to response for problem-details to access originalUrl
    (res as any).req = req;

    // Return standardized validation error response
    validationError(res, convertedErrors);
    return;
  }

  // No validation errors, proceed to next handler
  next();
}

/**
 * Type-safe version that can be added to route handler arrays
 * for use with express-validator validation chains
 */
export const validationHandler = validationErrorMiddleware;
