/**
 * Override Validation Service
 * Handles validation logic for schedule overrides
 */

import { getDataSource } from '../../db/data-source';
import { Schedule, ScheduleOverride, User } from '../../models';
import { LessThanOrEqual, MoreThan } from 'typeorm';
import { OverlapDetectionResult, OverrideValidationResult } from '../../../api/routes/types/schedule-override.types';

export class OverrideValidationService {
  /**
   * Validate override time range
   * - End time must be after start time
   * - End time must be in the future
   */
  static validateTimeRange(startTime: Date, endTime: Date): OverrideValidationResult {
    const errors: string[] = [];

    if (endTime <= startTime) {
      errors.push('End time must be after start time');
    }

    if (endTime <= new Date()) {
      errors.push('Override end time must be in the future');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate that the covering user exists and belongs to the same organization
   */
  static async validateCoveringUser(userId: string, orgId: string): Promise<OverrideValidationResult> {
    const errors: string[] = [];

    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);

    const user = await userRepo.findOne({ where: { id: userId, orgId } });
    if (!user) {
      errors.push('User not found or not in your organization');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate that the schedule exists
   */
  static async validateScheduleExists(scheduleId: string, orgId: string): Promise<OverrideValidationResult> {
    const errors: string[] = [];

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);

    const schedule = await scheduleRepo.findOne({ where: { id: scheduleId, orgId } });
    if (!schedule) {
      errors.push('Schedule not found');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for overlapping overrides with the given time range
   * Excludes a specific override ID if provided (useful for updates)
   */
  static async detectOverlaps(
    scheduleId: string,
    startTime: Date,
    endTime: Date,
    excludeOverrideId?: string
  ): Promise<OverlapDetectionResult> {
    const dataSource = await getDataSource();
    const overrideRepo = dataSource.getRepository(ScheduleOverride);

    const query = overrideRepo
      .createQueryBuilder('override')
      .where('override.scheduleId = :scheduleId', { scheduleId })
      .andWhere('override.startTime <= :end', { end: endTime })
      .andWhere('override.endTime > :start', { start: startTime });

    if (excludeOverrideId) {
      query.andWhere('override.id != :excludeId', { excludeId: excludeOverrideId });
    }

    const overlapping = await query.getOne();

    if (overlapping) {
      return {
        hasOverlap: true,
        conflictingOverride: {
          id: overlapping.id,
          startTime: overlapping.startTime,
          endTime: overlapping.endTime,
        },
      };
    }

    return { hasOverlap: false };
  }

  /**
   * Validate override dates are ISO8601 strings
   */
  static validateDateFormats(startTimeStr: string, endTimeStr: string): OverrideValidationResult {
    const errors: string[] = [];

    const startTime = new Date(startTimeStr);
    if (isNaN(startTime.getTime())) {
      errors.push('Valid start date/time is required (ISO 8601 format)');
    }

    const endTime = new Date(endTimeStr);
    if (isNaN(endTime.getTime())) {
      errors.push('Valid end date/time is required (ISO 8601 format)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate reason field
   */
  static validateReason(reason: string | undefined): OverrideValidationResult {
    const errors: string[] = [];

    if (reason !== undefined) {
      if (typeof reason !== 'string') {
        errors.push('Reason must be a string');
      } else if (reason.length > 500) {
        errors.push('Reason must be under 500 characters');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate override exists
   */
  static async validateOverrideExists(
    overrideId: string,
    scheduleId: string,
    orgId: string
  ): Promise<OverrideValidationResult> {
    const errors: string[] = [];

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const overrideRepo = dataSource.getRepository(ScheduleOverride);

    // First verify the schedule exists
    const schedule = await scheduleRepo.findOne({ where: { id: scheduleId, orgId } });
    if (!schedule) {
      errors.push('Schedule not found');
      return { isValid: false, errors };
    }

    // Then verify the override exists for this schedule
    const override = await overrideRepo.findOne({
      where: { id: overrideId, scheduleId },
    });
    if (!override) {
      errors.push('Override not found');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
