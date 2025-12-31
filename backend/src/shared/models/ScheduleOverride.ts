import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Schedule } from './Schedule';
import { User } from './User';

@Entity('schedule_overrides')
export class ScheduleOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'schedule_id', type: 'uuid' })
  scheduleId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Schedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  // Helper methods

  /**
   * Check if this override is currently active
   */
  isActive(): boolean {
    const now = new Date();
    return now >= this.startTime && now < this.endTime;
  }

  /**
   * Check if this override is in the future
   */
  isFuture(): boolean {
    return new Date() < this.startTime;
  }

  /**
   * Check if this override has ended
   */
  hasEnded(): boolean {
    return new Date() >= this.endTime;
  }

  /**
   * Check if a given time falls within this override period
   */
  coversTime(time: Date): boolean {
    return time >= this.startTime && time < this.endTime;
  }

  /**
   * Get the duration of the override in hours
   */
  getDurationHours(): number {
    return (this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60 * 60);
  }
}
