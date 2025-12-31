import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { Team } from './Team';
import { ScheduleOverride } from './ScheduleOverride';
import { ScheduleLayer } from './ScheduleLayer';

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, default: 'manual' })
  type: 'manual' | 'daily' | 'weekly'; // MVP: manual only, Phase 3: daily/weekly rotations

  @Column({ name: 'timezone', type: 'varchar', length: 100, default: 'UTC' })
  timezone: string;

  @Column({ name: 'current_oncall_user_id', type: 'uuid', nullable: true })
  currentOncallUserId: string | null; // MVP: manually set

  @Column({ name: 'override_user_id', type: 'uuid', nullable: true })
  overrideUserId: string | null; // Legacy: For "take on-call" feature

  @Column({ name: 'override_until', type: 'timestamp', nullable: true })
  overrideUntil: Date | null; // Legacy: Simple override expiry

  @Column({ type: 'jsonb', nullable: true })
  rotation_config: Record<string, any> | null; // For Phase 3: rotation rules

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @OneToMany(() => ScheduleOverride, override => override.schedule)
  overrides: ScheduleOverride[];

  @OneToMany(() => ScheduleLayer, layer => layer.schedule)
  layers: ScheduleLayer[];

  /**
   * Get the effective on-call user ID using layers
   * Priority: 1. Active overrides, 2. Layers (by priority), 3. Legacy currentOncallUserId
   */
  getEffectiveOncallUserId(atTime?: Date): string | null {
    const now = atTime || new Date();

    // 1. Check for active overrides first
    if (this.overrides && this.overrides.length > 0) {
      const activeOverride = this.overrides.find(
        o => o.startTime <= now && o.endTime > now
      );
      if (activeOverride) {
        return activeOverride.userId;
      }
    }

    // Check legacy override
    if (this.overrideUserId && this.overrideUntil && this.overrideUntil > now) {
      return this.overrideUserId;
    }

    // 2. Check layers (sorted by priority - lower layerOrder = higher priority)
    if (this.layers && this.layers.length > 0) {
      const sortedLayers = [...this.layers].sort((a, b) => a.layerOrder - b.layerOrder);

      for (const layer of sortedLayers) {
        const oncallUserId = layer.calculateOncallUserId(now);
        if (oncallUserId) {
          return oncallUserId;
        }
      }
    }

    // 3. Fall back to legacy manual assignment
    return this.currentOncallUserId;
  }

  /**
   * Check if schedule has layers configured
   */
  hasLayers(): boolean {
    return this.layers && this.layers.length > 0;
  }

  /**
   * Get the current on-call user ID, checking overrides first
   * Note: For robust override checking with the new ScheduleOverride table,
   * use getEffectiveOncallUserId() which requires the overrides relation to be loaded
   */
  getCurrentOncallUserId(): string | null {
    // Check for legacy simple override first
    if (this.overrideUserId && this.overrideUntil && this.overrideUntil > new Date()) {
      return this.overrideUserId;
    }

    // Check for new-style overrides (if loaded)
    if (this.overrides && this.overrides.length > 0) {
      const now = new Date();
      const activeOverride = this.overrides.find(
        o => o.startTime <= now && o.endTime > now
      );
      if (activeOverride) {
        return activeOverride.userId;
      }
    }

    return this.currentOncallUserId;
  }

  /**
   * Get active override if one exists (for display purposes)
   */
  getActiveOverride(): ScheduleOverride | null {
    if (!this.overrides || this.overrides.length === 0) {
      return null;
    }
    const now = new Date();
    return this.overrides.find(o => o.startTime <= now && o.endTime > now) || null;
  }

  /**
   * Get upcoming overrides (not yet started)
   */
  getUpcomingOverrides(): ScheduleOverride[] {
    if (!this.overrides || this.overrides.length === 0) {
      return [];
    }
    const now = new Date();
    return this.overrides
      .filter(o => o.startTime > now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }
}
