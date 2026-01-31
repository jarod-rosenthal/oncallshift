/**
 * Shared Utilities Export Index
 *
 * Central point for importing common utilities across the application.
 * This reduces the need for deep imports from individual utility files.
 */

// ============================================================================
// Logger
// ============================================================================
export { logger } from './logger';

// ============================================================================
// Pagination
// ============================================================================
export {
  PaginationParams,
  PaginationMeta,
  CursorData,
  PaginatedResult,
  CursorPaginatedResult,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_OFFSET,
  parsePaginationParams,
  buildPaginationMeta,
  paginatedResponse,
  encodeCursor,
  decodeCursor,
  cursorPaginate,
  VALID_SORT_FIELDS,
  validateSortField,
  toSnakeCase,
} from './pagination';

// ============================================================================
// Filtering
// ============================================================================
export { parseBaseFilters, applyBaseFilters } from './filtering';

// ============================================================================
// Problem Details (RFC 9457)
// ============================================================================
export {
  ProblemDetails,
  ValidationError,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
  internalError,
} from './problem-details';

// ============================================================================
// ETag
// ============================================================================
export {
  generateETag,
  generateWeakETag,
  generateEntityETag,
  generateCollectionETag,
  parseETag,
  compareETags,
  matchesAnyETag,
} from './etag';

// ============================================================================
// Location Header
// ============================================================================
export { setLocationHeader } from './location-header';

// ============================================================================
// CRUD Utilities
// ============================================================================
export {
  buildListQuery,
  findOneById,
  buildOrgFilter,
  FilterConfig,
  applyFilters,
  applySorting,
  applyPagination,
  formatResource,
  formatListResponse,
  formatCreatedResponse,
  formatUpdatedResponse,
  ErrorDetails,
  handleCrudError,
  validateOwnership,
  checkIfMatch,
  applySoftDeleteFilter,
  softDelete,
  hardDelete,
  bulkCreate,
  bulkUpdate,
  bulkDelete,
} from './crud';
