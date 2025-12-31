import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Schedule } from './Schedule';
import { ScheduleLayerMember } from './ScheduleLayerMember';

export type RotationType = 'daily' | 'weekly' | 'custom';

export interface LayerRestrictions {
  type: 'weekly';
  intervals: Array<{
    startDay: number; // 0=Sunday
    startTime: string; // "09:00"
    endDay: number;
    endTime: string; // "17:00"
  }>;
}

@Entity('schedule_layers')
export class ScheduleLayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'schedule_id', type: 'uuid' })
  scheduleId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'rotation_type', type: 'varchar', length: 50 })
  rotationType: RotationType;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @Column({ name: 'handoff_time', type: 'time', default: '09:00:00' })
  handoffTime: string;

  @Column({ name: 'handoff_day', type: 'int', nullable: true })
  handoffDay: number | null; // 0=Sunday, for weekly rotation

  @Column({ name: 'rotation_length', type: 'int', default: 1 })
  rotationLength: number; // For custom: number of days per rotation

  @Column({ name: 'layer_order', type: 'int', default: 0 })
  layerOrder: number; // Lower = higher priority

  @Column({ type: 'jsonb', nullable: true })
  restrictions: LayerRestrictions | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Schedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @OneToMany(() => ScheduleLayerMember, member => member.layer, { cascade: true })
  members: ScheduleLayerMember[];

  // Helper methods

  /**
   * Check if this layer is active at a given time
   */
  isActiveAt(time: Date): boolean {
    if (time < this.startDate) return false;
    if (this.endDate && time >= this.endDate) return false;
    return true;
  }

  /**
   * Check if the given time falls within the layer's restrictions
   */
  isWithinRestrictions(time: Date): boolean {
    if (!this.restrictions || !this.restrictions.intervals || this.restrictions.intervals.length === 0) {
      return true; // No restrictions = always active
    }

    const dayOfWeek = time.getDay();
    const timeStr = time.toTimeString().substring(0, 5); // "HH:MM"

    for (const interval of this.restrictions.intervals) {
      // Handle same-day intervals
      if (interval.startDay === interval.endDay) {
        if (dayOfWeek === interval.startDay) {
          if (timeStr >= interval.startTime && timeStr < interval.endTime) {
            return true;
          }
        }
      } else {
        // Handle multi-day intervals (e.g., Friday 17:00 to Monday 09:00)
        const isAfterStart = dayOfWeek > interval.startDay ||
          (dayOfWeek === interval.startDay && timeStr >= interval.startTime);
        const isBeforeEnd = dayOfWeek < interval.endDay ||
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
   * Calculate who's on-call for this layer at the given time
   */
  calculateOncallUserId(atTime: Date): string | null {
    if (!this.members || this.members.length === 0) return null;
    if (!this.isActiveAt(atTime)) return null;
    if (!this.isWithinRestrictions(atTime)) return null;

    // Sort members by position
    const sortedMembers = [...this.members].sort((a, b) => a.position - b.position);
    const memberCount = sortedMembers.length;
    if (memberCount === 0) return null;

    // Calculate rotation index based on rotation type
    const rotationIndex = this.calculateRotationIndex(atTime);
    const effectiveIndex = rotationIndex % memberCount;

    return sortedMembers[effectiveIndex].userId;
  }

  /**
   * Calculate the rotation index (how many rotations since start)
   */
  private calculateRotationIndex(atTime: Date): number {
    // Parse handoff time
    const [handoffHours, handoffMinutes] = this.handoffTime.split(':').map(Number);

    // Create a reference point at the start date with handoff time
    const startWithHandoff = new Date(this.startDate);
    startWithHandoff.setHours(handoffHours, handoffMinutes, 0, 0);

    // If current time is before the first handoff, we're still on index 0
    if (atTime < startWithHandoff) return 0;

    const msElapsed = atTime.getTime() - startWithHandoff.getTime();
    const msPerDay = 24 * 60 * 60 * 1000;

    switch (this.rotationType) {
      case 'daily':
        return Math.floor(msElapsed / msPerDay);

      case 'weekly': {
        const msPerWeek = 7 * msPerDay;
        return Math.floor(msElapsed / msPerWeek);
      }

      case 'custom': {
        const rotationMs = this.rotationLength * msPerDay;
        return Math.floor(msElapsed / rotationMs);
      }

      default:
        return 0;
    }
  }

  /**
   * Get the next handoff time after the given time
   */
  getNextHandoff(afterTime: Date): Date {
    const [handoffHours, handoffMinutes] = this.handoffTime.split(':').map(Number);

    const next = new Date(afterTime);
    next.setHours(handoffHours, handoffMinutes, 0, 0);

    // If we're past today's handoff time, move to next rotation
    if (afterTime >= next) {
      switch (this.rotationType) {
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          next.setDate(next.getDate() + 7);
          break;
        case 'custom':
          next.setDate(next.getDate() + this.rotationLength);
          break;
      }
    }

    return next;
  }

  /**
   * Get member count
   */
  getMemberCount(): number {
    return this.members?.length || 0;
  }
}
