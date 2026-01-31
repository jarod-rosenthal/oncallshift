/**
 * Type definitions for Schedule On-Call and Layer Calculation functionality
 * Extracted from schedules.ts for reusability and maintainability
 */

import { Schedule, ScheduleLayer, ScheduleOverride } from '../../../shared/models';

/**
 * Result of calculating who is on-call at a given time
 */
export interface OnCallCalculationResult {
  /** UUID of the user currently on-call (null if no one assigned) */
  userId: string | null;
  /** Source of the on-call assignment */
  source: 'active_override' | 'legacy_override' | 'layer' | 'manual' | 'none';
  /** The layer that calculated the result (if source is 'layer') */
  layer?: ScheduleLayer;
  /** The override that matched (if source is 'active_override' or 'legacy_override') */
  override?: ScheduleOverride;
}

/**
 * Layer calculation context and result
 */
export interface LayerCalculationResult {
  /** The layer being calculated */
  layer: ScheduleLayer;
  /** UUID of the on-call user for this layer (null if no one matches) */
  userId: string | null;
  /** Whether the layer is active at the given time */
  isActive: boolean;
  /** Whether the time falls within layer restrictions */
  withRestrictions: boolean;
  /** Rotation index at the given time */
  rotationIndex?: number;
  /** Member position in the rotation */
  memberPosition?: number;
}

/**
 * Rotation type for layer calculations
 */
export type RotationType = 'daily' | 'weekly' | 'custom';

/**
 * Layer restrictions for time-of-week windows
 */
export interface LayerRestrictions {
  type: 'weekly';
  intervals: Array<{
    startDay: number; // 0=Sunday
    startTime: string; // "09:00"
    endDay: number;
    endTime: string; // "17:00"
  }>;
}

/**
 * Rotation index calculation result
 */
export interface RotationIndexResult {
  rotationIndex: number;
  effectiveIndex: number;
  memberCount: number;
}

/**
 * Handoff calculation result
 */
export interface HandoffResult {
  /** Next handoff time after the given time */
  nextHandoff: Date;
  /** Current on-call user before handoff */
  currentOncall: string | null;
  /** Next on-call user after handoff */
  nextOncall: string | null;
}

/**
 * Legacy rotation config used by older schedules
 */
export interface LegacyRotationConfig {
  userIds: string[];
  type: RotationType;
  rotationHour?: number;
  rotationMinute?: number;
  rotationDayOfWeek?: number; // 0=Sunday
}
