/**
 * Core Type Definitions for OnCallShift API
 *
 * This module defines the fundamental types and interfaces used throughout
 * the application, including user context, API requests, and authentication.
 */

import { Request } from 'express';
import { User } from '../models/User';
import { Service } from '../models/Service';
import { OrganizationApiKey } from '../models/OrganizationApiKey';

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * Supported authentication methods for API requests
 */
export type AuthMethod = 'jwt' | 'api_key' | 'service_key';

/**
 * Union type for authenticated subjects (user, service, or org key)
 */
export type AuthenticatedSubject = User | Service | OrganizationApiKey;

// ============================================================================
// User-Related Types
// ============================================================================

/**
 * Base roles for RBAC (Role-Based Access Control)
 * Defines the hierarchy of permissions within an organization
 */
export type BaseRole = 'owner' | 'admin' | 'manager' | 'responder' | 'observer' | 'restricted_access' | 'limited_stakeholder';

/**
 * Platform-level roles (separate from organization base roles)
 * Used for system-wide access control
 */
export type PlatformRole = 'super_admin' | 'admin' | 'member';

/**
 * User account status
 */
export type UserStatus = 'active' | 'inactive';

/**
 * User-facing view of their own profile
 * Excludes sensitive information like credentials and hashes
 */
export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  profilePictureUrl: string | null;
  role: PlatformRole;
  baseRole: BaseRole;
  status: UserStatus;
  settings: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
  };
  // Credential configuration status (not the actual credentials)
  aiCredentials?: {
    configured: boolean;
    type?: 'api_key' | 'oauth';
    hint?: string;
    updatedAt?: Date;
  };
  // DND (Do Not Disturb) settings
  dndEnabled: boolean;
  dndStartTime: string | null;
  dndEndTime: string | null;
  dndTimezone: string | null;
}

/**
 * Minimal user info for API responses and lists
 * Contains only non-sensitive user identification
 */
export interface UserInfo {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  baseRole: BaseRole;
  status: UserStatus;
}

/**
 * Request body for creating a new user
 */
export interface CreateUserRequest {
  email: string;
  fullName?: string;
  phoneNumber?: string;
  baseRole?: BaseRole;
}

/**
 * Request body for updating user profile
 */
export interface UpdateUserRequest {
  fullName?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  settings?: Record<string, any>;
  dndEnabled?: boolean;
  dndStartTime?: string;
  dndEndTime?: string;
  dndTimezone?: string;
}

/**
 * Request body for assigning/changing user role
 */
export interface UpdateUserRoleRequest {
  baseRole: BaseRole;
}

// ============================================================================
// API Request Context Types
// ============================================================================

/**
 * Authentication context attached to Express Request
 * Indicates which authentication method was used
 */
export interface AuthContext {
  method: AuthMethod;
  subject: AuthenticatedSubject;
  scopes?: string[]; // Only for org API keys
}

/**
 * Organization context that must be present on all requests
 * Enforces multi-tenant isolation
 */
export interface OrganizationContext {
  id: string; // orgId
}

/**
 * Complete context required for authenticated API requests
 * Extends Express Request with OnCallShift-specific properties
 */
export interface AuthenticatedRequest extends Request {
  /**
   * Authenticated user (present for JWT auth)
   */
  user?: User;

  /**
   * Service entity (present for service API key auth)
   */
  service?: Service;

  /**
   * Organization API key (present for org API key auth)
   */
  organizationApiKey?: OrganizationApiKey;

  /**
   * Organization ID (always present on authenticated requests)
   * Derived from user.orgId, service.orgId, or apiKey.orgId
   */
  orgId?: string;

  /**
   * API key scopes (only present for organization API keys)
   * Empty array [] or undefined for JWT and service key auth (full access)
   */
  apiKeyScopes?: string[];

  /**
   * Authentication method used for this request
   */
  authMethod?: AuthMethod;
}

/**
 * Type guard to check if request is authenticated with a user JWT
 */
export function isUserAuthenticated(req: AuthenticatedRequest): req is AuthenticatedRequest & { user: User; orgId: string } {
  return req.user !== undefined && req.orgId !== undefined && req.authMethod === 'jwt';
}

/**
 * Type guard to check if request is authenticated with a service API key
 */
export function isServiceAuthenticated(req: AuthenticatedRequest): req is AuthenticatedRequest & { service: Service; orgId: string } {
  return req.service !== undefined && req.orgId !== undefined && req.authMethod === 'service_key';
}

/**
 * Type guard to check if request is authenticated with an organization API key
 */
export function isOrgApiKeyAuthenticated(req: AuthenticatedRequest): req is AuthenticatedRequest & { organizationApiKey: OrganizationApiKey; orgId: string } {
  return req.organizationApiKey !== undefined && req.orgId !== undefined && req.authMethod === 'api_key';
}

/**
 * Type guard to check if request is authenticated (any method)
 */
export function isAuthenticated(req: AuthenticatedRequest): req is AuthenticatedRequest & { orgId: string } {
  return req.orgId !== undefined && req.authMethod !== undefined;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard success response wrapper for single resource
 */
export interface ApiResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
    version: string;
  };
}

/**
 * Standard success response wrapper for paginated results
 */
export interface PaginatedApiResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: Record<string, any>;
  timestamp?: string;
}

/**
 * Validation error response
 */
export interface ValidationErrorResponse extends ErrorResponse {
  validationErrors: Array<{
    field: string;
    message: string;
  }>;
}

// ============================================================================
// Permission and Scope Types
// ============================================================================

/**
 * API key scope format: "resource:action"
 * Examples:
 *   - services:read
 *   - services:write
 *   - incidents:read
 *   - incidents:write
 *   - users:read (org-level)
 *   - * (grant all access)
 */
export type ApiScope = string;

/**
 * Resource permissions that can be assigned
 */
export interface ResourcePermission {
  resource: string;
  actions: ('read' | 'write' | 'delete')[];
}

/**
 * User permissions check result
 */
export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

// ============================================================================
// Request Context Helpers
// ============================================================================

/**
 * Helper to safely extract organization ID from any authenticated request
 */
export function getOrgId(req: AuthenticatedRequest): string {
  if (!req.orgId) {
    throw new Error('Request is not authenticated or organization ID is missing');
  }
  return req.orgId;
}

/**
 * Helper to safely extract authenticated user from request
 */
export function getUser(req: AuthenticatedRequest): User {
  if (!req.user) {
    throw new Error('Request is not authenticated as a user');
  }
  return req.user;
}

/**
 * Helper to get the subject of authentication (user, service, or org key)
 */
export function getAuthSubject(req: AuthenticatedRequest): AuthenticatedSubject {
  if (req.user) {
    return req.user;
  }
  if (req.service) {
    return req.service;
  }
  if (req.organizationApiKey) {
    return req.organizationApiKey;
  }
  throw new Error('Request is not authenticated');
}

// ============================================================================
// Notification-Related Types
// ============================================================================

/**
 * User contact method type
 */
export type ContactMethodType = 'email' | 'sms' | 'phone' | 'push';

/**
 * User notification preference
 */
export interface NotificationPreference {
  channel: ContactMethodType;
  enabled: boolean;
  quietHours?: {
    startTime: string;
    endTime: string;
    timezone: string;
  };
}

/**
 * User notification rule (e.g., "notify me only for critical incidents")
 */
export interface NotificationRule {
  id: string;
  userId: string;
  name: string;
  conditions: {
    severity?: string[];
    services?: string[];
    teams?: string[];
  };
  actions: {
    channels: ContactMethodType[];
    delaySeconds?: number;
  };
  enabled: boolean;
}

// ============================================================================
// Organization Types
// ============================================================================

/**
 * Organization status
 */
export type OrganizationStatus = 'active' | 'suspended' | 'deleted';

/**
 * Organization plan type
 */
export type OrganizationPlan = 'free' | 'professional' | 'enterprise';

/**
 * Minimal organization info for user context
 */
export interface OrganizationInfo {
  id: string;
  name: string;
  status: OrganizationStatus;
  plan: OrganizationPlan;
}

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Pagination query parameters
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination result metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Common filter operators for API list endpoints
 */
export type FilterOperator = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'nin' | 'contains' | 'exists';

/**
 * Filter condition for list queries
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: any;
}

// ============================================================================
// CRUD Type Exports
// ============================================================================

/**
 * Re-export CRUD types for convenient imports
 * Import from this module: import { CrudListResponse, CrudErrorResponse } from '../types';
 */
export {
  CrudListQuery,
  CrudPaginationMeta,
  CrudListResponse,
  CrudItemResponse,
  CrudCreateResponse,
  CrudUpdateResponse,
  CrudDeleteResponse,
  CrudErrorResponse,
  CrudErrorDetail,
  CrudValidationErrorResponse,
  CrudNotFoundErrorResponse,
  CrudConflictErrorResponse,
  CrudCreateRequest,
  CrudUpdateRequest,
  CrudFilterConfig,
  CrudTimestampedResource,
  CrudUserTrackedResource,
  CrudPaginationOptions,
  CrudQueryOptions,
  CrudBulkOperationOptions,
  CrudBulkOperationResult,
  isCrudListResponse,
  isCrudErrorResponse,
  isCrudValidationErrorResponse,
} from './crud.types';
