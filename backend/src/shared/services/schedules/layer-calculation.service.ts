/**
 * Layer Calculation Service
 * Handles calculation of on-call users for rotation layers
 * Supports daily, weekly, and custom rotation types
 */

import { ScheduleLayer } from '../../models';
import { LayerCalculationResult, RotationIndexResult, HandoffResult } from '../../../api/routes/types/schedule-calculation.types';

export class LayerCalculationService {
  /**
   * Calculate who is on-call for a given layer at a specific time
   */
  static calculateLayerOncall(layer: ScheduleLayer, atTime: Date): LayerCalculationResult {
    const isActive = layer.isActiveAt(atTime);
    const withinRestrictions = layer.isWithinRestrictions(atTime);

    if (!isActive || !withinRestrictions) {
      return {
        layer,
        userId: null,
        isActive,
        withRestrictions: withinRestrictions,
      };
    }

    if (!layer.members || layer.members.length === 0) {
      return {
        layer,
        userId: null,
        isActive,
        withRestrictions: true,
      };
    }

    // Sort members by position
    const sortedMembers = [...layer.members].sort((a, b) => a.position - b.position);
    const memberCount = sortedMembers.length;

    // Calculate rotation index based on rotation type
    const rotationIndex = this.calculateRotationIndex(layer, atTime);
    const effectiveIndex = rotationIndex % memberCount;

    return {
      layer,
      userId: sortedMembers[effectiveIndex].userId,
      isActive,
      withRestrictions: true,
      rotationIndex,
      memberPosition: effectiveIndex,
    };
  }

  /**
   * Calculate the rotation index (how many rotation periods have passed since start)
   * Handles daily, weekly, and custom rotation types
   */
  static calculateRotationIndex(layer: ScheduleLayer, atTime: Date): number {
    // Parse handoff time
    const [handoffHours, handoffMinutes] = layer.handoffTime.split(':').map(Number);

    // Create a reference point at the start date with handoff time
    const startWithHandoff = new Date(layer.startDate);
    startWithHandoff.setHours(handoffHours, handoffMinutes, 0, 0);

    // If current time is before the first handoff, we're still on index 0
    if (atTime < startWithHandoff) return 0;

    const msElapsed = atTime.getTime() - startWithHandoff.getTime();
    const msPerDay = 24 * 60 * 60 * 1000;

    switch (layer.rotationType) {
      case 'daily':
        return Math.floor(msElapsed / msPerDay);

      case 'weekly': {
        const msPerWeek = 7 * msPerDay;
        return Math.floor(msElapsed / msPerWeek);
      }

      case 'custom': {
        const rotationMs = layer.rotationLength * msPerDay;
        return Math.floor(msElapsed / rotationMs);
      }

      default:
        return 0;
    }
  }

  /**
   * Get the rotation index result with effective index modulo calculation
   */
  static getRotationIndexResult(layer: ScheduleLayer, atTime: Date): RotationIndexResult {
    const rotationIndex = this.calculateRotationIndex(layer, atTime);
    const memberCount = layer.members?.length || 1;
    const effectiveIndex = rotationIndex % memberCount;

    return {
      rotationIndex,
      effectiveIndex,
      memberCount,
    };
  }

  /**
   * Get the next handoff time after the given time
   */
  static getNextHandoff(layer: ScheduleLayer, afterTime: Date): HandoffResult {
    const [handoffHours, handoffMinutes] = layer.handoffTime.split(':').map(Number);

    const next = new Date(afterTime);
    next.setHours(handoffHours, handoffMinutes, 0, 0);

    // If we're past today's handoff time, move to next rotation
    if (afterTime >= next) {
      switch (layer.rotationType) {
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          next.setDate(next.getDate() + 7);
          break;
        case 'custom':
          next.setDate(next.getDate() + layer.rotationLength);
          break;
      }
    }

    // Get current and next on-call users
    const current = this.calculateLayerOncall(layer, afterTime);
    const nextTime = new Date(next.getTime() + 60000); // 1 minute after handoff
    const nextUser = this.calculateLayerOncall(layer, nextTime);

    return {
      nextHandoff: next,
      currentOncall: current.userId,
      nextOncall: nextUser.userId,
    };
  }

  /**
   * Check if a time falls within layer restrictions
   */
  static isTimeWithinRestrictions(layer: ScheduleLayer, time: Date): boolean {
    if (!layer.restrictions || !layer.restrictions.intervals || layer.restrictions.intervals.length === 0) {
      return true; // No restrictions = always active
    }

    const dayOfWeek = time.getDay();
    const timeStr = time.toTimeString().substring(0, 5); // "HH:MM"

    for (const interval of layer.restrictions.intervals) {
      // Handle same-day intervals
      if (interval.startDay === interval.endDay) {
        if (dayOfWeek === interval.startDay) {
          if (timeStr >= interval.startTime && timeStr < interval.endTime) {
            return true;
          }
        }
      } else {
        // Handle multi-day intervals (e.g., Friday 17:00 to Monday 09:00)
        const isAfterStart =
          dayOfWeek > interval.startDay ||
          (dayOfWeek === interval.startDay && timeStr >= interval.startTime);
        const isBeforeEnd =
          dayOfWeek < interval.endDay ||
          (dayOfWeek === interval.endDay && timeStr < interval.endTime);

        if (interval.startDay < interval.endDay) {
          // Same week (e.g., Mon-Fri)
          if (isAfterStart && isBeforeEnd) return true;
        } else {
          // Wraps around week (e.g., Fri-Mon)
          if (isAfterStart || isBeforeEnd) return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a time falls within the layer's active period
   */
  static isLayerActive(layer: ScheduleLayer, time: Date): boolean {
    if (time < layer.startDate) return false;
    if (layer.endDate && time >= layer.endDate) return false;
    return true;
  }

  /**
   * Get the duration of a rotation in milliseconds
   */
  static getRotationDurationMs(layer: ScheduleLayer): number {
    const msPerDay = 24 * 60 * 60 * 1000;

    switch (layer.rotationType) {
      case 'daily':
        return msPerDay;
      case 'weekly':
        return 7 * msPerDay;
      case 'custom':
        return layer.rotationLength * msPerDay;
      default:
        return msPerDay;
    }
  }

  /**
   * Get the member count for the layer
   */
  static getMemberCount(layer: ScheduleLayer): number {
    return layer.members?.length || 0;
  }

  /**
   * Check if there's enough members for the rotation
   */
  static hasValidMemberCount(layer: ScheduleLayer): boolean {
    return (layer.members?.length || 0) > 0;
  }

  /**
   * Get all members for a layer in position order
   */
  static getOrderedMembers(layer: ScheduleLayer) {
    if (!layer.members || layer.members.length === 0) {
      return [];
    }
    return [...layer.members].sort((a, b) => a.position - b.position);
  }

  /**
   * Calculate who will be on-call for the next N rotations
   * Useful for forecasting
   */
  static getUpcomingRotations(layer: ScheduleLayer, count: number = 5) {
    const members = this.getOrderedMembers(layer);
    if (members.length === 0) return [];

    const rotations = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const futureTime = new Date(now.getTime() + i * this.getRotationDurationMs(layer));
      const result = this.calculateLayerOncall(layer, futureTime);
      rotations.push({
        rotationIndex: i,
        userId: result.userId,
        startTime: this.getRotationStartTime(layer, i),
      });
    }

    return rotations;
  }

  /**
   * Get the start time of a specific rotation index
   */
  static getRotationStartTime(layer: ScheduleLayer, rotationIndex: number): Date {
    const [handoffHours, handoffMinutes] = layer.handoffTime.split(':').map(Number);
    const startWithHandoff = new Date(layer.startDate);
    startWithHandoff.setHours(handoffHours, handoffMinutes, 0, 0);

    const rotationDurationMs = this.getRotationDurationMs(layer);
    const startTime = new Date(startWithHandoff.getTime() + rotationIndex * rotationDurationMs);

    return startTime;
  }
}
