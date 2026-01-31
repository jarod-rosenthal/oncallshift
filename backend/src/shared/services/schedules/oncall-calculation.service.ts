/**
 * On-Call Calculation Service
 * Handles the core logic for determining who is on-call based on priority chain:
 * 1. Active overrides
 * 2. Layers (by priority order)
 * 3. Legacy manual assignment
 */

import { Schedule, ScheduleOverride, ScheduleLayer } from '../../models';
import { OnCallCalculationResult, HandoffResult } from '../../../api/routes/types/schedule-calculation.types';

export class OnCallCalculationService {
  /**
   * Calculate who is effectively on-call at a given time
   * Uses the priority chain: active overrides > layers > legacy manual
   */
  static calculateEffectiveOncall(schedule: Schedule, atTime: Date): OnCallCalculationResult {
    // 1. Check for active overrides first
    if (schedule.overrides && schedule.overrides.length > 0) {
      const activeOverride = schedule.overrides.find(
        o => o.startTime <= atTime && o.endTime > atTime
      );
      if (activeOverride) {
        return {
          userId: activeOverride.userId,
          source: 'active_override',
          override: activeOverride,
        };
      }
    }

    // 2. Check legacy override
    if (schedule.overrideUserId && schedule.overrideUntil && schedule.overrideUntil > atTime) {
      return {
        userId: schedule.overrideUserId,
        source: 'legacy_override',
      };
    }

    // 3. Check layers (sorted by priority - lower layerOrder = higher priority)
    if (schedule.layers && schedule.layers.length > 0) {
      const sortedLayers = [...schedule.layers].sort((a, b) => a.layerOrder - b.layerOrder);

      for (const layer of sortedLayers) {
        const oncallUserId = layer.calculateOncallUserId(atTime);
        if (oncallUserId) {
          return {
            userId: oncallUserId,
            source: 'layer',
            layer,
          };
        }
      }
    }

    // 4. Fall back to legacy manual assignment
    if (schedule.currentOncallUserId) {
      return {
        userId: schedule.currentOncallUserId,
        source: 'manual',
      };
    }

    return {
      userId: null,
      source: 'none',
    };
  }

  /**
   * Calculate current on-call user (convenience method for now)
   * Uses schedule.getCurrentOncallUserId() for backward compatibility
   */
  static calculateCurrentOncall(schedule: Schedule): OnCallCalculationResult {
    const result = this.calculateEffectiveOncall(schedule, new Date());
    return result;
  }

  /**
   * Calculate on-call user for a specific date
   * Used for schedule rendering and forecasting
   */
  static calculateOncallForDate(schedule: Schedule, targetDate: Date): string | null {
    // If schedule has layers, use them for calculation
    if (schedule.layers && schedule.layers.length > 0) {
      return this.calculateEffectiveOncall(schedule, targetDate).userId;
    }

    // Legacy: check old override first
    if (
      schedule.overrideUserId &&
      schedule.overrideUntil &&
      schedule.overrideUntil > targetDate
    ) {
      return schedule.overrideUserId;
    }

    // Otherwise fall back to current on-call
    return schedule.currentOncallUserId;
  }

  /**
   * Get next handoff information from the current time
   */
  static getNextHandoff(schedule: Schedule, fromTime?: Date): HandoffResult | null {
    const now = fromTime || new Date();

    if (!schedule.layers || schedule.layers.length === 0) {
      return null;
    }

    // Find the next handoff across all layers
    let nextHandoffTime: Date | null = null;
    let nextHandoffLayer: ScheduleLayer | null = null;

    for (const layer of schedule.layers) {
      const handoff = layer.getNextHandoff(now);
      if (!nextHandoffTime || handoff < nextHandoffTime) {
        nextHandoffTime = handoff;
        nextHandoffLayer = layer;
      }
    }

    if (!nextHandoffTime || !nextHandoffLayer) {
      return null;
    }

    const currentOncall = this.calculateEffectiveOncall(schedule, now);
    const afterHandoff = new Date(nextHandoffTime.getTime() + 60000); // 1 minute after
    const nextOncall = this.calculateEffectiveOncall(schedule, afterHandoff);

    return {
      nextHandoff: nextHandoffTime,
      currentOncall: currentOncall.userId,
      nextOncall: nextOncall.userId,
    };
  }

  /**
   * Check if there's a gap in coverage (no on-call assigned)
   */
  static hasCoverageGap(schedule: Schedule, timeWindow: { start: Date; end: Date }): boolean {
    const checkInterval = 60 * 60 * 1000; // Check every hour
    let currentTime = new Date(timeWindow.start);

    while (currentTime < timeWindow.end) {
      const result = this.calculateEffectiveOncall(schedule, currentTime);
      if (!result.userId) {
        return true; // Found a gap
      }
      currentTime = new Date(currentTime.getTime() + checkInterval);
    }

    return false;
  }

  /**
   * Get all possible on-call users for a given time period
   * Useful for forecasting and overlap detection
   */
  static getPossibleOncallUsers(schedule: Schedule, timeWindow: { start: Date; end: Date }): string[] {
    const users = new Set<string>();
    const checkInterval = 24 * 60 * 60 * 1000; // Check daily
    let currentTime = new Date(timeWindow.start);

    while (currentTime < timeWindow.end) {
      const result = this.calculateEffectiveOncall(schedule, currentTime);
      if (result.userId) {
        users.add(result.userId);
      }
      currentTime = new Date(currentTime.getTime() + checkInterval);
    }

    return Array.from(users);
  }
}
