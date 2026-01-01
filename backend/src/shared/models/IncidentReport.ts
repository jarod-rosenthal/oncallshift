import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';

export type ReportSchedule = 'manual' | 'daily' | 'weekly' | 'monthly';
export type ReportFormat = 'summary' | 'detailed' | 'executive';
export type DeliveryChannel = 'email' | 'slack' | 'teams' | 'webhook';

/**
 * Report Configuration
 */
export interface ReportConfig {
  includeRCA: boolean;
  includeSeverityBreakdown: boolean;
  includeServiceBreakdown: boolean;
  includeTeamBreakdown: boolean;
  includeResponderMetrics: boolean;
  includeTrendAnalysis: boolean;
  severityFilter?: string[]; // Filter by severity
  serviceFilter?: string[];  // Filter by service IDs
  teamFilter?: string[];     // Filter by team IDs
}

/**
 * Delivery Configuration
 */
export interface DeliveryConfig {
  channels: DeliveryChannel[];
  emailRecipients?: string[];
  slackChannelId?: string;
  teamsChannelId?: string;
  webhookUrl?: string;
}

/**
 * IncidentReport - Configurable incident summary reports
 *
 * Enables automated or on-demand reporting of incident data over time periods.
 * Reports can include RCA summaries, metrics, and trends.
 *
 * Example use cases:
 * - Weekly incident summary sent to leadership via email
 * - Monthly post-mortem report with all RCAs
 * - Daily operational report posted to Slack
 */
@Entity('incident_reports')
export class IncidentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  schedule: ReportSchedule;

  @Column({ type: 'varchar', length: 20, default: 'summary' })
  format: ReportFormat;

  // For scheduled reports: day of week (0=Sunday) or day of month (1-31)
  @Column({ name: 'schedule_day', type: 'int', nullable: true })
  scheduleDay: number | null;

  // For scheduled reports: hour of day (0-23)
  @Column({ name: 'schedule_hour', type: 'int', default: 9 })
  scheduleHour: number;

  // Report configuration
  @Column({ type: 'jsonb', default: {} })
  config: ReportConfig;

  // Delivery configuration
  @Column({ name: 'delivery_config', type: 'jsonb', default: {} })
  deliveryConfig: DeliveryConfig;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'last_run_at', type: 'timestamp', nullable: true })
  lastRunAt: Date | null;

  @Column({ name: 'next_run_at', type: 'timestamp', nullable: true })
  nextRunAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  // Helper methods

  isManual(): boolean {
    return this.schedule === 'manual';
  }

  isScheduled(): boolean {
    return this.schedule !== 'manual';
  }

  shouldRunNow(): boolean {
    if (!this.enabled || !this.nextRunAt) {
      return false;
    }
    return new Date() >= this.nextRunAt;
  }

  /**
   * Calculate next run time based on schedule
   */
  calculateNextRun(): Date | null {
    if (this.schedule === 'manual') {
      return null;
    }

    const now = new Date();
    const next = new Date();

    if (this.schedule === 'daily') {
      next.setDate(now.getDate() + 1);
      next.setHours(this.scheduleHour, 0, 0, 0);

      // If schedule hour hasn't passed today, run today
      if (now.getHours() < this.scheduleHour) {
        next.setDate(now.getDate());
      }
    } else if (this.schedule === 'weekly') {
      const dayOfWeek = this.scheduleDay ?? 1; // Default Monday
      const daysUntilNext = (dayOfWeek - now.getDay() + 7) % 7 || 7;

      next.setDate(now.getDate() + daysUntilNext);
      next.setHours(this.scheduleHour, 0, 0, 0);

      // If it's the same day but hour hasn't passed, run today
      if (daysUntilNext === 7 && now.getHours() < this.scheduleHour) {
        next.setDate(now.getDate());
      }
    } else if (this.schedule === 'monthly') {
      const dayOfMonth = this.scheduleDay ?? 1; // Default 1st of month

      next.setDate(dayOfMonth);
      next.setHours(this.scheduleHour, 0, 0, 0);

      // If we've already passed this day this month, go to next month
      if (now.getDate() > dayOfMonth || (now.getDate() === dayOfMonth && now.getHours() >= this.scheduleHour)) {
        next.setMonth(next.getMonth() + 1);
      }
    }

    return next;
  }

  /**
   * Get human-readable schedule description
   */
  getScheduleDescription(): string {
    if (this.schedule === 'manual') {
      return 'Manual (on-demand only)';
    }

    const hour = this.scheduleHour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);

    if (this.schedule === 'daily') {
      return `Daily at ${displayHour}:00 ${ampm}`;
    }

    if (this.schedule === 'weekly') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const day = days[this.scheduleDay ?? 1];
      return `Weekly on ${day} at ${displayHour}:00 ${ampm}`;
    }

    if (this.schedule === 'monthly') {
      const day = this.scheduleDay ?? 1;
      const suffix = day === 1 ? 'st' : (day === 2 ? 'nd' : (day === 3 ? 'rd' : 'th'));
      return `Monthly on the ${day}${suffix} at ${displayHour}:00 ${ampm}`;
    }

    return 'Unknown schedule';
  }
}
