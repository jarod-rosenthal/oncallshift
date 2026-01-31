/**
 * Type definitions for Schedule Override functionality
 * Extracted from schedules.ts for reusability and maintainability
 */

import { ScheduleOverride, User } from '../../../shared/models';

/**
 * Request body for creating a new schedule override
 */
export interface CreateOverrideRequest {
  /** UUID of the user who will cover the shift */
  userId: string;
  /** ISO 8601 timestamp when the override starts */
  startTime: string;
  /** ISO 8601 timestamp when the override ends */
  endTime: string;
  /** Optional reason for the override */
  reason?: string;
}

/**
 * Request body for updating an existing schedule override
 */
export interface UpdateOverrideRequest {
  /** UUID of the user who will cover the shift */
  userId?: string;
  /** ISO 8601 timestamp when the override starts */
  startTime?: string;
  /** ISO 8601 timestamp when the override ends */
  endTime?: string;
  /** Optional reason for the override */
  reason?: string;
}

/**
 * Status of an override relative to current time
 */
export type OverrideStatus = 'active' | 'upcoming' | 'ended';

/**
 * Formatted user information for override responses
 */
export interface OverrideUserInfo {
  id: string;
  fullName: string | null;
  email: string;
}

/**
 * Formatted override response object
 */
export interface OverrideResponse {
  id: string;
  scheduleId: string;
  userId: string;
  user: OverrideUserInfo;
  startTime: Date;
  endTime: Date;
  reason: string | null;
  status?: OverrideStatus;
  createdBy?: OverrideUserInfo | null;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Response for listing overrides
 */
export interface ListOverridesResponse {
  schedule: {
    id: string;
    name: string;
  };
  overrides: OverrideResponse[];
  activeOverride: OverrideResponse | null;
}

/**
 * Response for creating an override
 */
export interface CreateOverrideResponse {
  message: string;
  override: OverrideResponse;
}

/**
 * Response for updating an override
 */
export interface UpdateOverrideResponse {
  message: string;
  override: OverrideResponse;
}

/**
 * Overlap detection result
 */
export interface OverlapDetectionResult {
  hasOverlap: boolean;
  conflictingOverride?: {
    id: string;
    startTime: Date;
    endTime: Date;
  };
}

/**
 * Override validation result
 */
export interface OverrideValidationResult {
  isValid: boolean;
  errors: string[];
}
