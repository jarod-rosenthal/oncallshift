import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Service } from './Service';
import { Organization } from './Organization';
import { User } from './User';

@Entity('maintenance_windows')
export class MaintenanceWindow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'suppress_alerts', type: 'boolean', default: true })
  suppressAlerts: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  // Helper methods

  /**
   * Check if this maintenance window is currently active
   */
  isActive(): boolean {
    const now = new Date();
    return now >= this.startTime && now < this.endTime;
  }

  /**
   * Check if this maintenance window is in the future
   */
  isFuture(): boolean {
    return new Date() < this.startTime;
  }

  /**
   * Check if this maintenance window has ended
   */
  hasEnded(): boolean {
    return new Date() >= this.endTime;
  }

  /**
   * Check if a given time falls within this maintenance window
   */
  coversTime(time: Date): boolean {
    return time >= this.startTime && time < this.endTime;
  }

  /**
   * Get the remaining time in milliseconds (0 if ended or not started)
   */
  getRemainingTime(): number {
    const now = new Date();
    if (now < this.startTime || now >= this.endTime) {
      return 0;
    }
    return this.endTime.getTime() - now.getTime();
  }

  /**
   * Get a human-readable duration string
   */
  getDurationString(): string {
    const hours = (this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60 * 60);
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    }
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    }
    const days = Math.round(hours / 24);
    return `${days}d`;
  }
}
