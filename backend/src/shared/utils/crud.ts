/**
 * CRUD Utilities for OnCallShift API
 *
 * Provides standardized, type-safe helpers for implementing Create, Read, Update, Delete operations.
 * These utilities eliminate boilerplate and ensure consistency across all route handlers.
 *
 * Usage:
 * ```typescript
 * import { buildListQuery, applyPagination, applySorting, applyFilters } from '../utils/crud';
 *
 * router.get('/', async (req: AuthenticatedRequest, res: Response) => {
 *   const qb = buildListQuery(Team, req, 'team');
 *   const { data, pagination } = await applyPagination(qb, req.query, 'teams');
 *   res.json(formatListResponse(data, pagination));
 * });
 * ```
 */

import { SelectQueryBuilder, Repository, ObjectLiteral } from 'typeorm';
import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { PaginationParams, PaginationMeta } from './pagination';
import { logger } from './logger';

// ============================================
// Query Building Helpers
// ============================================

/**
 * Build a safe list query with organization isolation
 *
 * @param repo - TypeORM repository instance
 * @param alias - Query alias (e.g., 'team', 'user')
 * @param orgId - Organization ID for multi-tenant isolation
 * @returns QueryBuilder ready for filtering, sorting, pagination
 *
 * @example
 * ```typescript
 * const qb = buildListQuery(dataSource.getRepository(Team), 'team', req.orgId!);
 * qb.where('team.status = :status', { status: 'active' });
 * ```
 */
export function buildListQuery<T extends { org_id?: string; orgId?: string }>(
  repo: Repository<T>,
  alias: string,
  orgId: string
): SelectQueryBuilder<T> {
  const qb = repo.createQueryBuilder(alias);

  // Add org_id or orgId filter based on column name convention
  qb.where(`${alias}.org_id = :orgId OR ${alias}.orgId = :orgId`, { orgId });

  return qb;
}

/**
 * Build a safe single-item query with organization isolation
 *
 * @param repo - TypeORM repository instance
 * @param id - Item ID
 * @param orgId - Organization ID
 * @param options - Query options (relations, etc.)
 * @returns Single item or null
 *
 * @example
 * ```typescript
 * const team = await findOneById(teamRepo, id, orgId, {
 *   relations: ['memberships', 'memberships.user'],
 * });
 * ```
 */
export async function findOneById<T extends { id: string; org_id?: string; orgId?: string }>(
  repo: Repository<T>,
  id: string,
  orgId: string,
  options?: { relations?: string[] }
): Promise<T | null> {
  return repo.findOne({
    where: {
      id,
      ...buildOrgFilter(orgId),
    } as any,
    relations: options?.relations,
  });
}

/**
 * Build organization filter object for TypeORM queries
 * Handles both org_id and orgId column naming conventions
 *
 * @param orgId - Organization ID
 * @returns Filter object compatible with TypeORM where clause
 */
export function buildOrgFilter(orgId: string): Record<string, string> {
  return { orgId } as any;
}

// ============================================
// Filtering & Sorting Helpers
// ============================================

/**
 * Filter configuration for list endpoints
 */
export interface FilterConfig {
  field: string;
  operator?: 'eq' | 'like' | 'in' | 'lt' | 'lte' | 'gt' | 'gte' | 'between';
  caseSensitive?: boolean;
}

/**
 * Apply filters to a query builder
 *
 * @param qb - TypeORM QueryBuilder
 * @param filters - Filter values from request
 * @param filterMap - Mapping of filter names to database fields
 * @param alias - Query alias
 *
 * @example
 * ```typescript
 * const filterMap: Record<string, FilterConfig> = {
 *   status: { field: 'status', operator: 'eq' },
 *   search: { field: 'name', operator: 'like' },
 * };
 * applyFilters(qb, req.query, filterMap, 'team');
 * ```
 */
export function applyFilters(
  qb: SelectQueryBuilder<any>,
  filters: Record<string, any>,
  filterMap: Record<string, FilterConfig>,
  alias: string
): void {
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;

    const config = filterMap[key];
    if (!config) return;

    const fieldPath = `${alias}.${config.field}`;
    const operator = config.operator || 'eq';
    const paramName = `${key}_${Math.random().toString(36).substr(2, 9)}`;

    switch (operator) {
      case 'eq':
        qb.andWhere(`${fieldPath} = :${paramName}`, { [paramName]: value });
        break;

      case 'like':
        qb.andWhere(`${fieldPath} ILIKE :${paramName}`, {
          [paramName]: `%${value}%`,
        });
        break;

      case 'in':
        const values = Array.isArray(value) ? value : [value];
        if (values.length > 0) {
          qb.andWhere(`${fieldPath} IN (:...${paramName})`, { [paramName]: values });
        }
        break;

      case 'lt':
        qb.andWhere(`${fieldPath} < :${paramName}`, { [paramName]: value });
        break;

      case 'lte':
        qb.andWhere(`${fieldPath} <= :${paramName}`, { [paramName]: value });
        break;

      case 'gt':
        qb.andWhere(`${fieldPath} > :${paramName}`, { [paramName]: value });
        break;

      case 'gte':
        qb.andWhere(`${fieldPath} >= :${paramName}`, { [paramName]: value });
        break;

      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          qb.andWhere(`${fieldPath} BETWEEN :${paramName}_start AND :${paramName}_end`, {
            [`${paramName}_start`]: value[0],
            [`${paramName}_end`]: value[1],
          });
        }
        break;
    }
  });
}

/**
 * Apply sorting to a query builder
 *
 * @param qb - TypeORM QueryBuilder
 * @param sortField - Field to sort by
 * @param sortOrder - Sort direction (ASC or DESC)
 * @param alias - Query alias
 * @param validFields - List of allowed sort fields (for security)
 *
 * @throws Error if sortField not in validFields
 *
 * @example
 * ```typescript
 * applySorting(qb, 'name', 'ASC', 'team', ['name', 'createdAt']);
 * ```
 */
export function applySorting(
  qb: SelectQueryBuilder<any>,
  sortField: string,
  sortOrder: 'ASC' | 'DESC',
  alias: string,
  validFields: string[]
): void {
  if (!validFields.includes(sortField)) {
    throw new Error(`Invalid sort field: ${sortField}`);
  }

  qb.orderBy(`${alias}.${sortField}`, sortOrder);
}

/**
 * Apply pagination to a query builder
 *
 * @param qb - TypeORM QueryBuilder (must have getCount and getManyAndCount or getMany)
 * @param pagination - Pagination parameters
 * @returns Paginated data and metadata
 *
 * @example
 * ```typescript
 * const { data, pagination: meta } = await applyPagination(qb, { limit: 25, offset: 0 });
 * ```
 */
export async function applyPagination<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  pagination: { limit: number; offset?: number }
): Promise<{ data: T[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }> {
  const offset = pagination.offset || 0;
  const limit = pagination.limit;

  // Get total count
  const total = await qb.getCount();

  // Apply pagination
  qb.skip(offset).take(limit);

  // Get data
  const data = await qb.getMany();

  return {
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };
}

// ============================================
// Response Formatting Helpers
// ============================================

/**
 * Format a single resource response
 *
 * @param resource - Resource to format
 * @param options - Formatting options (excluded fields, etc.)
 * @returns Formatted resource
 *
 * @example
 * ```typescript
 * const response = formatResource(team, { excludeFields: ['internal_notes'] });
 * res.json(response);
 * ```
 */
export function formatResource<T extends Record<string, any>>(
  resource: T,
  options?: { excludeFields?: string[] }
): Partial<T> {
  if (!resource) return {};

  const formatted = { ...resource };

  if (options?.excludeFields) {
    options.excludeFields.forEach(field => {
      delete formatted[field];
    });
  }

  return formatted;
}

/**
 * Format a list response
 *
 * @param items - Items to include in response
 * @param total - Total count
 * @param pagination - Pagination parameters
 * @param options - Formatting options
 * @returns Formatted paginated response
 *
 * @example
 * ```typescript
 * const response = formatListResponse(teams, total, { limit: 25, offset: 0 });
 * res.json(response);
 * ```
 */
export function formatListResponse<T extends Record<string, any>>(
  items: T[],
  total: number,
  pagination: { limit: number; offset?: number },
  options?: { excludeFields?: string[]; legacyKey?: string }
): any {
  const offset = pagination.offset || 0;
  const limit = pagination.limit;

  const formatted = items.map(item => formatResource(item, { excludeFields: options?.excludeFields }));

  const response: any = {
    data: formatted,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  };

  // Support legacy key for backwards compatibility
  if (options?.legacyKey) {
    response[options.legacyKey] = formatted;
  }

  return response;
}

/**
 * Format a created resource response with 201 status
 *
 * @param resource - Created resource
 * @param options - Response options (statusCode, message, etc.)
 * @returns Response object
 *
 * @example
 * ```typescript
 * const response = formatCreatedResponse(team, { statusCode: 201 });
 * res.status(response.statusCode).json(response);
 * ```
 */
export function formatCreatedResponse<T>(
  resource: T,
  options?: { statusCode?: number; message?: string; excludeFields?: string[] }
): any {
  return {
    statusCode: options?.statusCode || 201,
    message: options?.message || 'Resource created successfully',
    data: formatResource(resource as any, { excludeFields: options?.excludeFields }),
  };
}

/**
 * Format an updated resource response
 *
 * @param resource - Updated resource
 * @param options - Response options
 * @returns Response object
 *
 * @example
 * ```typescript
 * const response = formatUpdatedResponse(team);
 * res.json(response);
 * ```
 */
export function formatUpdatedResponse<T>(
  resource: T,
  options?: { message?: string; excludeFields?: string[] }
): any {
  return {
    message: options?.message || 'Resource updated successfully',
    data: formatResource(resource as any, { excludeFields: options?.excludeFields }),
  };
}

// ============================================
// Error Handling Helpers
// ============================================

/**
 * Standard error response format
 */
export interface ErrorDetails {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
}

/**
 * Handle common CRUD errors with appropriate status codes and messages
 *
 * @param error - Error that occurred
 * @param operation - CRUD operation (read, create, update, delete)
 * @returns Error details with status code
 *
 * @example
 * ```typescript
 * try {
 *   const team = await teamRepo.save(newTeam);
 * } catch (error) {
 *   const errorDetails = handleCrudError(error, 'create');
 *   res.status(errorDetails.statusCode).json(errorDetails);
 * }
 * ```
 */
export function handleCrudError(
  error: any,
  operation: 'read' | 'create' | 'update' | 'delete'
): ErrorDetails {
  logger.error(`CRUD error during ${operation}:`, error);

  // Handle unique constraint violations
  if (error.code === '23505' || error.message?.includes('duplicate key')) {
    return {
      code: 'CONFLICT',
      message: 'A resource with this value already exists',
      statusCode: 409,
      details: { constraint: error.detail },
    };
  }

  // Handle foreign key violations
  if (error.code === '23503' || error.message?.includes('foreign key')) {
    return {
      code: 'INVALID_REFERENCE',
      message: 'Referenced resource does not exist',
      statusCode: 400,
      details: { constraint: error.detail },
    };
  }

  // Handle not found
  if (error.message?.includes('not found') || error.statusCode === 404) {
    return {
      code: 'NOT_FOUND',
      message: 'Resource not found',
      statusCode: 404,
    };
  }

  // Default: internal server error
  return {
    code: 'INTERNAL_ERROR',
    message: `Failed to ${operation} resource`,
    statusCode: 500,
  };
}

/**
 * Validate that a resource belongs to the authenticated user's organization
 *
 * @param resource - Resource to validate
 * @param reqOrgId - Organization ID from request
 * @param resourceOrgIdField - Field name for org_id in resource (default: 'orgId' or 'org_id')
 * @throws Error if organization doesn't match
 *
 * @example
 * ```typescript
 * const team = await teamRepo.findOne(id);
 * validateOwnership(team, req.orgId!);
 * ```
 */
export function validateOwnership(
  resource: any,
  reqOrgId: string,
  resourceOrgIdField: string = 'orgId'
): void {
  const resourceOrgId = resource?.[resourceOrgIdField] || resource?.['org_id'];

  if (!resourceOrgId || resourceOrgId !== reqOrgId) {
    throw new Error('Resource does not belong to your organization');
  }
}

/**
 * Check and validate ETag headers for conditional requests
 *
 * @param req - Express request
 * @param currentETag - Current resource ETag
 * @returns true if request should proceed, false if 304 was already sent
 *
 * @example
 * ```typescript
 * const etag = generateEntityETag(resource);
 * if (!checkIfMatch(req, etag)) {
 *   return; // 412 Precondition Failed already sent
 * }
 * ```
 */
export function checkIfMatch(req: any, currentETag: string): boolean {
  const ifMatch = req.headers['if-match'];

  if (ifMatch && ifMatch !== currentETag) {
    // ETag doesn't match - conflict
    return false;
  }

  return true;
}

// ============================================
// Soft Delete Helpers
// ============================================

/**
 * Apply soft delete filter to exclude deleted records
 *
 * @param qb - QueryBuilder
 * @param alias - Query alias
 * @param deletedAtField - Field name for deleted timestamp (default: 'deletedAt')
 *
 * @example
 * ```typescript
 * const qb = buildListQuery(teamRepo, 'team', orgId);
 * applySoftDeleteFilter(qb, 'team');
 * ```
 */
export function applySoftDeleteFilter(
  qb: SelectQueryBuilder<any>,
  alias: string,
  deletedAtField: string = 'deletedAt'
): void {
  qb.andWhere(`${alias}.${deletedAtField} IS NULL`);
}

/**
 * Soft delete a resource by updating its deletedAt timestamp
 *
 * @param repo - TypeORM repository
 * @param id - Resource ID
 * @param orgId - Organization ID for safety check
 *
 * @example
 * ```typescript
 * await softDelete(teamRepo, teamId, orgId);
 * ```
 */
export async function softDelete<T extends { id: string; orgId?: string; org_id?: string }>(
  repo: Repository<T>,
  id: string,
  orgId: string
): Promise<void> {
  const resource = await findOneById(repo, id, orgId);

  if (!resource) {
    throw new Error('Resource not found');
  }

  await repo.update(
    { id, ...buildOrgFilter(orgId) } as any,
    { deletedAt: new Date() } as any
  );
}

/**
 * Hard delete a resource (permanent deletion)
 *
 * @param repo - TypeORM repository
 * @param id - Resource ID
 * @param orgId - Organization ID for safety check
 *
 * @example
 * ```typescript
 * await hardDelete(teamRepo, teamId, orgId);
 * ```
 */
export async function hardDelete<T extends { id: string; orgId?: string; org_id?: string }>(
  repo: Repository<T>,
  id: string,
  orgId: string
): Promise<void> {
  const resource = await findOneById(repo, id, orgId);

  if (!resource) {
    throw new Error('Resource not found');
  }

  await repo.delete({ id, ...buildOrgFilter(orgId) } as any);
}

// ============================================
// Bulk Operation Helpers
// ============================================

/**
 * Create multiple resources in a transaction
 *
 * @param repo - TypeORM repository
 * @param items - Items to create
 * @param transform - Optional transform function for each item
 * @returns Created items
 *
 * @example
 * ```typescript
 * const teams = await bulkCreate(teamRepo, [
 *   { name: 'Team A', orgId },
 *   { name: 'Team B', orgId },
 * ]);
 * ```
 */
export async function bulkCreate<T extends ObjectLiteral>(
  repo: Repository<T>,
  items: Partial<T>[],
  transform?: (item: Partial<T>) => Partial<T>
): Promise<T[]> {
  const transformed = transform ? items.map(transform) : items;
  return repo.save(transformed as any);
}

/**
 * Update multiple resources matching criteria
 *
 * @param repo - TypeORM repository
 * @param criteria - Update criteria
 * @param values - Values to update
 * @returns Number of affected rows
 *
 * @example
 * ```typescript
 * const affected = await bulkUpdate(teamRepo, { orgId }, { status: 'active' });
 * ```
 */
export async function bulkUpdate<T extends ObjectLiteral>(
  repo: Repository<T>,
  criteria: Partial<T>,
  values: Partial<T>
): Promise<number> {
  const result = await repo.update(criteria as any, values as any);
  return result.affected || 0;
}

/**
 * Delete multiple resources matching criteria
 *
 * @param repo - TypeORM repository
 * @param criteria - Delete criteria
 * @returns Number of affected rows
 *
 * @example
 * ```typescript
 * const deleted = await bulkDelete(teamRepo, { orgId, status: 'archived' });
 * ```
 */
export async function bulkDelete<T extends ObjectLiteral>(
  repo: Repository<T>,
  criteria: Partial<T>
): Promise<number> {
  const result = await repo.delete(criteria as any);
  return result.affected || 0;
}
