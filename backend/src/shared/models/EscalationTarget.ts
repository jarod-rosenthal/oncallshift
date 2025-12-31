import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EscalationStep } from './EscalationStep';
import { User } from './User';
import { Schedule } from './Schedule';

export type TargetType = 'user' | 'schedule';

@Entity('escalation_targets')
export class EscalationTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'escalation_step_id', type: 'uuid' })
  escalationStepId: string;

  @Column({ name: 'target_type', type: 'varchar', length: 50 })
  targetType: TargetType;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'schedule_id', type: 'uuid', nullable: true })
  scheduleId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => EscalationStep, step => step.targets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'escalation_step_id' })
  escalationStep: EscalationStep;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ManyToOne(() => Schedule, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule | null;

  // Helper methods
  isUserTarget(): boolean {
    return this.targetType === 'user';
  }

  isScheduleTarget(): boolean {
    return this.targetType === 'schedule';
  }

  /**
   * Get the target ID (either userId or scheduleId)
   */
  getTargetId(): string | null {
    return this.userId || this.scheduleId;
  }

  /**
   * Get a display name for this target
   */
  getDisplayName(): string {
    if (this.isUserTarget()) {
      return this.user?.fullName || this.userId || 'Unknown User';
    }
    return this.schedule?.name || this.scheduleId || 'Unknown Schedule';
  }
}
