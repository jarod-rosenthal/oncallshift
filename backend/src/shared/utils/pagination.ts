/**
 * Pagination utilities for OnCallShift API
 * Supports both offset-based and cursor-based pagination (Stripe/PagerDuty pattern)
 */

import { SelectQueryBuilder } from 'typeorm';

// ============================================
// Types
// ============================================

export interface PaginationParams {
  limit: number;
  offset?: number;
  cursor?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

export interface CursorData {
  id: string;
  sortValue: string;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

// ============================================
// Constants
// ============================================

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;
export const MAX_OFFSET = 10000; // PagerDuty-style limit to prevent deep pagination

// ============================================
// Offset-Based Pagination
// ============================================

/**
 * Parse pagination parameters from request query
 */
export function parsePaginationParams(query: Record<string, any>): PaginationParams {
  const limit = Math.min(
    Math.max(parseInt(query.limit as string) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  const offset = Math.min(
    Math.max(parseInt(query.offset as string) || 0, 0),
    MAX_OFFSET
  );

  const order = query.order === 'asc' ? 'asc' : 'desc';

  return {
    limit,
    offset,
    cursor: query.cursor as string | undefined,
    sort: query.sort as string | undefined,
    order,
  };
}

/**
 * Build pagination metadata for response
 */
export function buildPaginationMeta(
  total: number,
  limit: number,
  offset: number,
  lastItem?: { id: string; createdAt?: Date; triggeredAt?: Date }
): PaginationMeta {
  const hasMore = offset + limit < total;

  const meta: PaginationMeta = {
    total,
    limit,
    offset,
    hasMore,
  };

  // Include cursor for next page if there are more results
  if (hasMore && lastItem) {
    const sortValue = lastItem.triggeredAt?.toISOString() ||
                      lastItem.createdAt?.toISOString() ||
                      new Date().toISOString();
    meta.nextCursor = encodeCursor({
      id: lastItem.id,
      sortValue,
      offset: offset + limit,
    });
  }

  return meta;
}

/**
 * Create a paginated response
 * @param data - Array of items
 * @param total - Total count of items
 * @param params - Pagination parameters
 * @param lastItem - Last item for cursor generation
 * @param legacyKey - Optional legacy key name for backwards compatibility (e.g., 'users', 'teams')
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
  lastItem?: { id: string; createdAt?: Date; triggeredAt?: Date },
  legacyKey?: string
): PaginatedResult<T> & { [key: string]: unknown } {
  const response: PaginatedResult<T> & { [key: string]: unknown } = {
    data,
    pagination: buildPaginationMeta(total, params.limit, params.offset || 0, lastItem),
  };

  // Include legacy key for backwards compatibility with existing frontend code
  if (legacyKey) {
    response[legacyKey] = data;
  }

  return response;
}

// ============================================
// Cursor-Based Pagination
// ============================================

/**
 * Encode cursor data to base64url string
 */
export function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decode cursor string to cursor data
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    return null;
  }
}

/**
 * Apply cursor pagination to a TypeORM query builder
 * Uses the keyset pagination pattern for stable results
 */
export async function cursorPaginate<T extends { id: string }>(
  queryBuilder: SelectQueryBuilder<T>,
  params: {
    cursor?: string;
    limit: number;
    sortField: string;
    sortOrder: 'ASC' | 'DESC';
    alias?: string;
  }
): Promise<CursorPaginatedResult<T>> {
  const { cursor, limit, sortField, sortOrder, alias } = params;
  const entityAlias = alias || queryBuilder.alias;

  // Apply cursor condition if provided
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      const operator = sortOrder === 'DESC' ? '<' : '>';
      queryBuilder.andWhere(
        `(${entityAlias}.${sortField} ${operator} :cursorValue OR ` +
        `(${entityAlias}.${sortField} = :cursorValue AND ${entityAlias}.id ${operator} :cursorId))`,
        { cursorValue: cursorData.sortValue, cursorId: cursorData.id }
      );
    }
  }

  // Fetch one extra item to determine if there are more results
  const items = await queryBuilder
    .orderBy(`${entityAlias}.${sortField}`, sortOrder)
    .addOrderBy(`${entityAlias}.id`, sortOrder)
    .take(limit + 1)
    .getMany();

  const hasMore = items.length > limit;
  if (hasMore) {
    items.pop(); // Remove the extra item
  }

  const lastItem = items[items.length - 1] as any;
  const firstItem = items[0] as any;

  // Build cursors
  let nextCursor: string | undefined;
  let prevCursor: string | undefined;

  if (hasMore && lastItem) {
    const sortValue = lastItem[sortField]?.toISOString?.() ||
                      String(lastItem[sortField]);
    nextCursor = encodeCursor({
      id: lastItem.id,
      sortValue,
      offset: 0,
    });
  }

  if (cursor && firstItem) {
    const sortValue = firstItem[sortField]?.toISOString?.() ||
                      String(firstItem[sortField]);
    prevCursor = encodeCursor({
      id: firstItem.id,
      sortValue,
      offset: 0,
    });
  }

  return {
    data: items,
    pagination: {
      limit,
      hasMore,
      nextCursor,
      prevCursor,
    },
  };
}

// ============================================
// Sorting Helpers
// ============================================

/** Valid sort fields per entity type */
export const VALID_SORT_FIELDS: Record<string, string[]> = {
  incidents: ['triggeredAt', 'createdAt', 'updatedAt', 'severity', 'state'],
  users: ['fullName', 'email', 'createdAt', 'status'],
  teams: ['name', 'createdAt'],
  services: ['name', 'createdAt', 'status'],
  schedules: ['name', 'createdAt'],
  runbooks: ['title', 'createdAt', 'updatedAt'],
  escalationPolicies: ['name', 'createdAt'],
  integrations: ['name', 'type', 'createdAt'],
  notifications: ['createdAt', 'status', 'channel'],
  incidentEvents: ['createdAt', 'type'],
};

/**
 * Validate and get sort field
 */
export function validateSortField(
  entityType: string,
  requestedSort?: string,
  defaultSort: string = 'createdAt'
): string {
  const validFields = VALID_SORT_FIELDS[entityType] || ['createdAt'];

  if (requestedSort && validFields.includes(requestedSort)) {
    return requestedSort;
  }

  return defaultSort;
}

/**
 * Convert camelCase sort field to snake_case for SQL
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
