/**
 * CRUD Operation Type Definitions
 *
 * Generic types for standardized CRUD request/response patterns.
 * These types help ensure consistency across all route handlers.
 */

/**
 * Standard list query parameters for CRUD endpoints
 */
export interface CrudListQuery {
  /** Maximum number of items to return (1-100, default: 25) */
  limit?: number | string;

  /** Number of items to skip (default: 0) */
  offset?: number | string;

  /** Field to sort by (must be in validFields) */
  sort?: string;

  /** Sort direction (asc or desc, default: desc) */
  order?: 'asc' | 'desc';

  /** Search/filter string */
  search?: string;

  /** Cursor for pagination (for cursor-based pagination) */
  cursor?: string;

  /** Additional filter parameters (resource-specific) */
  [key: string]: any;
}

/**
 * Standard list response pagination metadata
 */
export interface CrudPaginationMeta {
  /** Total count of items matching the query */
  total: number;

  /** Items returned in this page */
  limit: number;

  /** Items skipped from the beginning */
  offset: number;

  /** Whether there are more items available */
  hasMore: boolean;

  /** Cursor for next page (if using cursor-based pagination) */
  nextCursor?: string;

  /** Cursor for previous page (if using cursor-based pagination) */
  prevCursor?: string;
}

/**
 * Standard list response format
 *
 * @example
 * ```typescript
 * const response: CrudListResponse<Team> = {
 *   data: [...teams],
 *   pagination: { total: 100, limit: 25, offset: 0, hasMore: true }
 * };
 * ```
 */
export interface CrudListResponse<T> {
  /** Array of items */
  data: T[];

  /** Pagination metadata */
  pagination: CrudPaginationMeta;

  /** Optional legacy key for backwards compatibility */
  [legacyKey: string]: T[] | CrudPaginationMeta;
}

/**
 * Standard single item response format
 */
export interface CrudItemResponse<T> {
  /** Item data */
  data: T;
}

/**
 * Standard create response
 */
export interface CrudCreateResponse<T> {
  /** Success message */
  message: string;

  /** Created item */
  data: T;

  /** HTTP status code (should be 201) */
  statusCode?: number;
}

/**
 * Standard update response
 */
export interface CrudUpdateResponse<T> {
  /** Success message */
  message: string;

  /** Updated item */
  data: T;
}

/**
 * Standard delete response
 */
export interface CrudDeleteResponse {
  /** Success message */
  message: string;

  /** Whether deletion was successful */
  success: true;

  /** Optional deleted resource ID */
  id?: string;
}

/**
 * Standard error response (RFC 9457 Problem Details)
 */
export interface CrudErrorResponse {
  /** Error type URL */
  type?: string;

  /** Human-readable error title */
  title: string;

  /** HTTP status code */
  status: number;

  /** Detailed error description */
  detail?: string;

  /** The API endpoint that caused the error */
  instance?: string;

  /** Additional error details (validation errors, etc.) */
  errors?: CrudErrorDetail[];
}

/**
 * Individual error detail
 */
export interface CrudErrorDetail {
  /** Field name (for validation errors) */
  field: string;

  /** Error message */
  message: string;

  /** Error code */
  code?: string;
}

/**
 * Validation error response (400 Bad Request)
 */
export interface CrudValidationErrorResponse extends CrudErrorResponse {
  status: 400;
  title: 'Validation Error';
  errors: CrudErrorDetail[];
}

/**
 * Not found error response (404 Not Found)
 */
export interface CrudNotFoundErrorResponse extends CrudErrorResponse {
  status: 404;
  title: 'Resource Not Found';
}

/**
 * Conflict error response (409 Conflict - duplicate key, etc.)
 */
export interface CrudConflictErrorResponse extends CrudErrorResponse {
  status: 409;
  title: 'Conflict';
}

/**
 * Generic CRUD request body for creation
 *
 * Should be extended with resource-specific fields:
 * ```typescript
 * interface CreateTeamRequest extends CrudCreateRequest<Team> {
 *   name: string;
 *   slug: string;
 *   description?: string;
 * }
 * ```
 */
export interface CrudCreateRequest<T> {
  [key: string]: any;
}

/**
 * Generic CRUD request body for updates
 *
 * Should be extended with resource-specific fields:
 * ```typescript
 * interface UpdateTeamRequest extends CrudUpdateRequest<Team> {
 *   name?: string;
 *   slug?: string;
 *   description?: string;
 * }
 * ```
 */
export interface CrudUpdateRequest<T> {
  [key: string]: any;
}

/**
 * Filter configuration for applying filters to queries
 */
export interface CrudFilterConfig {
  /** Database field name */
  field: string;

  /** Filter operator */
  operator?: 'eq' | 'like' | 'in' | 'lt' | 'lte' | 'gt' | 'gte' | 'between';

  /** Whether filter is case-sensitive */
  caseSensitive?: boolean;

  /** Whether to treat as boolean */
  isBoolean?: boolean;

  /** Custom filter function */
  custom?: (qb: any, value: any, alias: string) => void;
}

/**
 * Resource with timestamp metadata
 */
export interface CrudTimestampedResource {
  /** When the resource was created */
  createdAt: Date;

  /** When the resource was last updated */
  updatedAt: Date;

  /** When the resource was deleted (soft delete) */
  deletedAt?: Date | null;
}

/**
 * Resource with user tracking
 */
export interface CrudUserTrackedResource extends CrudTimestampedResource {
  /** User who created the resource */
  createdBy?: string;

  /** User who last modified the resource */
  updatedBy?: string;

  /** User who deleted the resource */
  deletedBy?: string;
}

/**
 * Standard pagination options for list queries
 */
export interface CrudPaginationOptions {
  /** Maximum items to return (1-100) */
  limit?: number;

  /** Items to skip */
  offset?: number;

  /** Field to sort by */
  sort?: string;

  /** Sort direction */
  order?: 'asc' | 'desc';
}

/**
 * Standard query building options
 */
export interface CrudQueryOptions {
  /** Relations to load */
  relations?: string[];

  /** Fields to select */
  select?: string[];

  /** Soft delete filter */
  includeSoftDeleted?: boolean;

  /** Cache query results */
  cache?: boolean | number;

  /** Custom where conditions */
  where?: Record<string, any>;
}

/**
 * Standard bulk operation options
 */
export interface CrudBulkOperationOptions {
  /** Use transaction for safety */
  transaction?: boolean;

  /** Skip validation */
  skipValidation?: boolean;

  /** Maximum items per batch */
  batchSize?: number;
}

/**
 * Result of a bulk operation
 */
export interface CrudBulkOperationResult<T> {
  /** Items that were successfully processed */
  successful: T[];

  /** Items that failed processing */
  failed: Array<{ item: T; error: string }>;

  /** Total items processed */
  total: number;

  /** Number of successful operations */
  successCount: number;

  /** Number of failed operations */
  failureCount: number;
}

/**
 * Type guard for checking if a response is a list response
 */
export function isCrudListResponse<T>(value: any): value is CrudListResponse<T> {
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.data) &&
    value.pagination &&
    typeof value.pagination.total === 'number'
  );
}

/**
 * Type guard for checking if a response is an error response
 */
export function isCrudErrorResponse(value: any): value is CrudErrorResponse {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.status === 'number' &&
    value.status >= 400
  );
}

/**
 * Type guard for checking if a response is a validation error
 */
export function isCrudValidationErrorResponse(
  value: any
): value is CrudValidationErrorResponse {
  return isCrudErrorResponse(value) && value.status === 400 && Array.isArray(value.errors);
}
