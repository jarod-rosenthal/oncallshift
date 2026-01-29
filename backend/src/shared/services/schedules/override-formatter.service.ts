/**
 * Override Formatter Service
 * Handles formatting and transformation of override data for API responses
 */

import { getDataSource } from '../../db/data-source';
import { Schedule, ScheduleOverride, User } from '../../models';
import {
  OverrideResponse,
  OverrideStatus,
  OverrideUserInfo,
  ListOverridesResponse,
} from '../../../api/routes/types/schedule-override.types';

export class OverrideFormatterService {
  /**
   * Determine the status of an override relative to current time
   */
  static getOverrideStatus(override: ScheduleOverride, atTime?: Date): OverrideStatus {
    const now = atTime || new Date();

    if (override.startTime > now) {
      return 'upcoming';
    }

    if (override.endTime <= now) {
      return 'ended';
    }

    return 'active';
  }

  /**
   * Format a user object for override responses
   */
  static formatUserInfo(user: User | null | undefined): OverrideUserInfo | null {
    if (!user) return null;

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
    };
  }

  /**
   * Format a single override for API response
   */
  static formatOverride(override: ScheduleOverride, user?: User | null, createdByUser?: User | null): OverrideResponse {
    return {
      id: override.id,
      scheduleId: override.scheduleId,
      userId: override.userId,
      user: this.formatUserInfo(user || null) || {
        id: override.userId,
        fullName: 'Unknown',
        email: '',
      },
      startTime: override.startTime,
      endTime: override.endTime,
      reason: override.reason,
      status: this.getOverrideStatus(override),
      createdBy: this.formatUserInfo(createdByUser || null),
      createdAt: override.createdAt,
      updatedAt: override.updatedAt,
    };
  }

  /**
   * Format a list of overrides for API response
   * Includes filtering for active, upcoming, and recent ended overrides
   */
  static async formatOverridesList(
    schedule: Schedule,
    overrides: ScheduleOverride[],
    includeHistoricalDays?: number
  ): Promise<ListOverridesResponse> {
    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);

    // Filter overrides based on status
    const now = new Date();
    const historyLookback = new Date(now.getTime() - (includeHistoricalDays || 7) * 24 * 60 * 60 * 1000);

    const filteredOverrides = overrides.filter(o => {
      // Include active overrides
      if (o.startTime <= now && o.endTime > now) return true;
      // Include upcoming overrides
      if (o.startTime > now) return true;
      // Include recent ended overrides (past 7 days by default)
      if (o.endTime > historyLookback && o.endTime <= now) return true;
      return false;
    });

    // Sort: active first, then upcoming, then recently ended
    filteredOverrides.sort((a, b) => {
      const statusA = this.getOverrideStatus(a);
      const statusB = this.getOverrideStatus(b);

      // Sort by status priority
      const statusPriority = { active: 0, upcoming: 1, ended: 2 };
      if (statusPriority[statusA] !== statusPriority[statusB]) {
        return statusPriority[statusA] - statusPriority[statusB];
      }

      // Within same status, sort by start time
      return a.startTime.getTime() - b.startTime.getTime();
    });

    // Get user information for all overrides
    const userIds = new Set(filteredOverrides.map(o => o.userId));
    if (filteredOverrides.some(o => o.createdBy)) {
      filteredOverrides.forEach(o => {
        if (o.createdBy) userIds.add(o.createdBy);
      });
    }

    const users = await userRepo.findByIds(Array.from(userIds));
    const userMap = new Map(users.map(u => [u.id, u]));

    // Format all overrides
    const formattedOverrides = filteredOverrides.map(o =>
      this.formatOverride(o, userMap.get(o.userId), userMap.get(o.createdBy || '') || null)
    );

    // Find active override
    const activeOverride = formattedOverrides.find(o => o.status === 'active') || null;

    return {
      schedule: {
        id: schedule.id,
        name: schedule.name,
      },
      overrides: formattedOverrides,
      activeOverride,
    };
  }

  /**
   * Format override for response after creation/update
   */
  static async formatOverrideForResponse(override: ScheduleOverride): Promise<OverrideResponse> {
    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);

    const user = await userRepo.findOne({ where: { id: override.userId } });
    const createdByUser = override.createdBy ? await userRepo.findOne({ where: { id: override.createdBy } }) : null;

    return this.formatOverride(override, user, createdByUser);
  }

  /**
   * Get summary of active and upcoming overrides for a schedule
   */
  static async getOverrideSummary(schedule: Schedule): Promise<{
    active: OverrideResponse | null;
    upcoming: OverrideResponse[];
    hasActiveOrUpcoming: boolean;
  }> {
    const now = new Date();
    let active: OverrideResponse | null = null;
    const upcoming: OverrideResponse[] = [];

    if (!schedule.overrides || schedule.overrides.length === 0) {
      return { active: null, upcoming: [], hasActiveOrUpcoming: false };
    }

    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);

    // Get all unique user IDs
    const userIds = new Set(schedule.overrides.map(o => o.userId));
    schedule.overrides.forEach(o => {
      if (o.createdBy) userIds.add(o.createdBy);
    });

    const users = await userRepo.findByIds(Array.from(userIds));
    const userMap = new Map(users.map(u => [u.id, u]));

    // Process overrides
    for (const override of schedule.overrides) {
      const formatted = this.formatOverride(override, userMap.get(override.userId), userMap.get(override.createdBy || '') || null);

      if (override.startTime <= now && override.endTime > now) {
        if (!active) active = formatted; // Take first active
      } else if (override.startTime > now) {
        upcoming.push(formatted);
      }
    }

    // Sort upcoming by start time
    upcoming.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    return {
      active,
      upcoming,
      hasActiveOrUpcoming: !!active || upcoming.length > 0,
    };
  }
}
