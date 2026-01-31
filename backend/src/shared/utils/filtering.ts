/**
 * Filtering utilities for OnCallShift API
 * Provides consistent filtering patterns across all list endpoints
 */

import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

// ============================================
// Types
// ============================================

export interface BaseFilterParams {
  search?: string;
  since?: Date;
  until?: Date;
}

export interface IncidentFilterParams extends BaseFilterParams {
  state?: 'triggered' | 'acknowledged' | 'resolved';
  severity?: 'critical' | 'error' | 'warning' | 'info';
  serviceId?: string;
  teamId?: string;
  assignedTo?: string;
}

export interface UserFilterParams extends BaseFilterParams {
  status?: 'active' | 'inactive' | 'pending';
  role?: 'owner' | 'admin' | 'member' | 'viewer';
  teamId?: string;
}

export interface ServiceFilterParams extends BaseFilterParams {
  status?: 'active' | 'inactive' | 'warning' | 'critical' | 'maintenance';
  teamId?: string;
}

export interface NotificationFilterParams extends BaseFilterParams {
  status?: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened';
  channel?: 'push' | 'sms' | 'voice' | 'email';
  incidentId?: string;
  userId?: string;
}

export interface GenericFilterParams extends BaseFilterParams {
  status?: string;
  teamId?: string;
  serviceId?: string;
  userId?: string;
  tags?: string[];
}

// ============================================
// Filter Parsers
// ============================================

/**
 * Parse base filter parameters from request query
 */
export function parseBaseFilters(query: Record<string, any>): BaseFilterParams {
  return {
    search: query.search?.trim() || query.query?.trim(),
    since: query.since ? new Date(query.since) : undefined,
    until: query.until ? new Date(query.until) : undefined,
  };
}

/**
 * Parse incident-specific filter parameters
 */
export function parseIncidentFilters(query: Record<string, any>): IncidentFilterParams {
  return {
    ...parseBaseFilters(query),
    state: query.state,
    severity: query.severity,
    serviceId: query.service_id,
    teamId: query.team_id,
    assignedTo: query.assigned_to,
  };
}

/**
 * Parse user-specific filter parameters
 */
export function parseUserFilters(query: Record<string, any>): UserFilterParams {
  return {
    ...parseBaseFilters(query),
    status: query.status,
    role: query.role,
    teamId: query.team_id,
  };
}

/**
 * Parse service-specific filter parameters
 */
export function parseServiceFilters(query: Record<string, any>): ServiceFilterParams {
  return {
    ...parseBaseFilters(query),
    status: query.status,
    teamId: query.team_id,
  };
}

/**
 * Parse notification-specific filter parameters
 */
export function parseNotificationFilters(query: Record<string, any>): NotificationFilterParams {
  return {
    ...parseBaseFilters(query),
    status: query.status,
    channel: query.channel,
    incidentId: query.incident_id,
    userId: query.user_id,
  };
}

/**
 * Parse generic filter parameters
 */
export function parseGenericFilters(query: Record<string, any>): GenericFilterParams {
  return {
    ...parseBaseFilters(query),
    status: query.status,
    teamId: query.team_id,
    serviceId: query.service_id,
    userId: query.user_id,
    tags: query.tags?.split(',').map((t: string) => t.trim()).filter(Boolean),
  };
}

// ============================================
// Filter Appliers
// ============================================

/**
 * Apply base filters to a query builder
 */
export function applyBaseFilters<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  filters: BaseFilterParams,
  alias: string,
  searchFields: string[] = ['name']
): SelectQueryBuilder<T> {
  // Search filter (ILIKE for case-insensitive search)
  if (filters.search && searchFields.length > 0) {
    const searchConditions = searchFields
      .map(field => `${alias}.${field} ILIKE :search`)
      .join(' OR ');
    queryBuilder.andWhere(`(${searchConditions})`, { search: `%${filters.search}%` });
  }

  // Date range filters
  if (filters.since) {
    queryBuilder.andWhere(`${alias}.createdAt >= :since`, { since: filters.since });
  }

  if (filters.until) {
    queryBuilder.andWhere(`${alias}.createdAt <= :until`, { until: filters.until });
  }

  return queryBuilder;
}

/**
 * Apply incident filters to a query builder
 */
export function applyIncidentFilters<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  filters: IncidentFilterParams,
  alias: string = 'incident'
): SelectQueryBuilder<T> {
  // Incident model uses 'summary' for the title field
  // Apply search filter on summary field
  if (filters.search) {
    queryBuilder.andWhere(`${alias}.summary ILIKE :search`, { search: `%${filters.search}%` });
  }

  // Incidents use triggeredAt for date filtering instead of createdAt
  if (filters.since) {
    queryBuilder.andWhere(`${alias}.triggeredAt >= :since`, { since: filters.since });
  }

  if (filters.until) {
    queryBuilder.andWhere(`${alias}.triggeredAt <= :until`, { until: filters.until });
  }

  if (filters.state) {
    queryBuilder.andWhere(`${alias}.state = :state`, { state: filters.state });
  }

  if (filters.severity) {
    queryBuilder.andWhere(`${alias}.severity = :severity`, { severity: filters.severity });
  }

  if (filters.serviceId) {
    queryBuilder.andWhere(`${alias}.serviceId = :serviceId`, { serviceId: filters.serviceId });
  }

  if (filters.teamId) {
    queryBuilder.andWhere(`${alias}.teamId = :teamId`, { teamId: filters.teamId });
  }

  if (filters.assignedTo) {
    queryBuilder.andWhere(`${alias}.assignedToUserId = :assignedTo`, { assignedTo: filters.assignedTo });
  }

  return queryBuilder;
}

/**
 * Apply user filters to a query builder
 */
export function applyUserFilters<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  filters: UserFilterParams,
  alias: string = 'user'
): SelectQueryBuilder<T> {
  applyBaseFilters(queryBuilder, filters, alias, ['fullName', 'email']);

  if (filters.status) {
    queryBuilder.andWhere(`${alias}.status = :status`, { status: filters.status });
  }

  if (filters.role) {
    queryBuilder.andWhere(`${alias}.role = :role`, { role: filters.role });
  }

  if (filters.teamId) {
    queryBuilder.innerJoin(`${alias}.teamMemberships`, 'tm', 'tm.teamId = :teamId', { teamId: filters.teamId });
  }

  return queryBuilder;
}

/**
 * Apply service filters to a query builder
 */
export function applyServiceFilters<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  filters: ServiceFilterParams,
  alias: string = 'service'
): SelectQueryBuilder<T> {
  applyBaseFilters(queryBuilder, filters, alias, ['name', 'description']);

  if (filters.status) {
    queryBuilder.andWhere(`${alias}.status = :status`, { status: filters.status });
  }

  if (filters.teamId) {
    queryBuilder.andWhere(`${alias}.teamId = :teamId`, { teamId: filters.teamId });
  }

  return queryBuilder;
}

/**
 * Apply notification filters to a query builder
 */
export function applyNotificationFilters<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  filters: NotificationFilterParams,
  alias: string = 'notification'
): SelectQueryBuilder<T> {
  // Don't apply base search filters - notifications don't have name/description

  if (filters.since) {
    queryBuilder.andWhere(`${alias}.createdAt >= :since`, { since: filters.since });
  }

  if (filters.until) {
    queryBuilder.andWhere(`${alias}.createdAt <= :until`, { until: filters.until });
  }

  if (filters.status) {
    queryBuilder.andWhere(`${alias}.status = :status`, { status: filters.status });
  }

  if (filters.channel) {
    queryBuilder.andWhere(`${alias}.channel = :channel`, { channel: filters.channel });
  }

  if (filters.incidentId) {
    queryBuilder.andWhere(`${alias}.incidentId = :incidentId`, { incidentId: filters.incidentId });
  }

  if (filters.userId) {
    queryBuilder.andWhere(`${alias}.userId = :userId`, { userId: filters.userId });
  }

  return queryBuilder;
}

/**
 * Apply generic filters to a query builder
 */
export function applyGenericFilters<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  filters: GenericFilterParams,
  alias: string,
  searchFields: string[] = ['name']
): SelectQueryBuilder<T> {
  applyBaseFilters(queryBuilder, filters, alias, searchFields);

  if (filters.status) {
    queryBuilder.andWhere(`${alias}.status = :status`, { status: filters.status });
  }

  if (filters.teamId) {
    queryBuilder.andWhere(`${alias}.teamId = :teamId`, { teamId: filters.teamId });
  }

  if (filters.serviceId) {
    queryBuilder.andWhere(`${alias}.serviceId = :serviceId`, { serviceId: filters.serviceId });
  }

  if (filters.userId) {
    queryBuilder.andWhere(`${alias}.userId = :userId`, { userId: filters.userId });
  }

  return queryBuilder;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: Record<string, any>): boolean {
  return Object.values(filters).some(value => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });
}

/**
 * Sanitize search query to prevent SQL injection and handle special characters
 */
export function sanitizeSearchQuery(query: string): string {
  // Escape special PostgreSQL LIKE pattern characters
  return query
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}
