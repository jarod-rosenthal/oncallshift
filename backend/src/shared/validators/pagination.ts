/**
 * Express-validator rules for pagination and filtering
 * Use these in route definitions for consistent validation
 */

import { query } from 'express-validator';
import { MAX_LIMIT, MAX_OFFSET } from '../utils/pagination';

// ============================================
// Pagination Validators
// ============================================

/**
 * Standard pagination query validators
 * Validates: limit, offset, cursor, sort, order
 */
export const paginationValidators = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: MAX_LIMIT })
    .withMessage(`limit must be between 1 and ${MAX_LIMIT}`)
    .toInt(),

  query('offset')
    .optional()
    .isInt({ min: 0, max: MAX_OFFSET })
    .withMessage(`offset must be between 0 and ${MAX_OFFSET}`)
    .toInt(),

  query('cursor')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Invalid cursor format'),

  query('sort')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z_]+$/)
    .withMessage('sort must be a valid field name'),

  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('order must be asc or desc'),
];

// ============================================
// Common Filter Validators
// ============================================

/**
 * Generic status filter
 */
export const statusFilterValidator = query('status')
  .optional()
  .isString()
  .isLength({ min: 1, max: 50 })
  .withMessage('Invalid status');

/**
 * Search/query filter with sanitization
 */
export const searchFilterValidator = query('search')
  .optional()
  .isString()
  .isLength({ max: 255 })
  .trim()
  .escape()
  .withMessage('Search query too long');

/**
 * Generic query (alias for search)
 */
export const queryFilterValidator = query('query')
  .optional()
  .isString()
  .isLength({ max: 255 })
  .trim()
  .escape()
  .withMessage('Query too long');

/**
 * Date range filter: since
 */
export const sinceFilterValidator = query('since')
  .optional()
  .isISO8601()
  .withMessage('since must be a valid ISO8601 date')
  .toDate();

/**
 * Date range filter: until
 */
export const untilFilterValidator = query('until')
  .optional()
  .isISO8601()
  .withMessage('until must be a valid ISO8601 date')
  .toDate();

/**
 * UUID filter for entity references
 */
export const uuidFilterValidator = (field: string) =>
  query(field)
    .optional()
    .isUUID()
    .withMessage(`${field} must be a valid UUID`);

// ============================================
// Entity-Specific Validators
// ============================================

/**
 * Incident-specific filters
 */
export const incidentFilterValidators = [
  ...paginationValidators,
  query('state')
    .optional()
    .isIn(['triggered', 'acknowledged', 'resolved'])
    .withMessage('state must be triggered, acknowledged, or resolved'),
  query('severity')
    .optional()
    .isIn(['critical', 'error', 'warning', 'info'])
    .withMessage('severity must be critical, error, warning, or info'),
  uuidFilterValidator('service_id'),
  uuidFilterValidator('team_id'),
  uuidFilterValidator('assigned_to'),
  sinceFilterValidator,
  untilFilterValidator,
];

/**
 * User-specific filters
 */
export const userFilterValidators = [
  ...paginationValidators,
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'pending'])
    .withMessage('status must be active, inactive, or pending'),
  query('role')
    .optional()
    .isIn(['owner', 'admin', 'member', 'viewer'])
    .withMessage('role must be owner, admin, member, or viewer'),
  uuidFilterValidator('team_id'),
  searchFilterValidator,
];

/**
 * Service-specific filters
 */
export const serviceFilterValidators = [
  ...paginationValidators,
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'warning', 'critical', 'maintenance'])
    .withMessage('Invalid service status'),
  uuidFilterValidator('team_id'),
  searchFilterValidator,
];

/**
 * Notification-specific filters
 */
export const notificationFilterValidators = [
  ...paginationValidators,
  query('status')
    .optional()
    .isIn(['pending', 'sent', 'delivered', 'failed', 'opened'])
    .withMessage('Invalid notification status'),
  query('channel')
    .optional()
    .isIn(['push', 'sms', 'voice', 'email'])
    .withMessage('Invalid notification channel'),
  uuidFilterValidator('incident_id'),
  uuidFilterValidator('user_id'),
  sinceFilterValidator,
  untilFilterValidator,
];
