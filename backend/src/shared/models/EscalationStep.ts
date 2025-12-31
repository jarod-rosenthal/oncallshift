import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { EscalationPolicy } from './EscalationPolicy';
import { Schedule } from './Schedule';
import { EscalationTarget } from './EscalationTarget';

export type EscalationTargetType = 'schedule' | 'users';

@Entity('escalation_steps')
export class EscalationStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'escalation_policy_id', type: 'uuid' })
  escalationPolicyId: string;

  @Column({ name: 'step_order', type: 'int' })
  stepOrder: number;

  @Column({ name: 'target_type', type: 'varchar', length: 50 })
  targetType: EscalationTargetType;

  @Column({ name: 'schedule_id', type: 'uuid', nullable: true })
  scheduleId: string | null;

  @Column({ name: 'user_ids', type: 'jsonb', nullable: true })
  userIds: string[] | null; // Array of user UUIDs

  @Column({ name: 'timeout_seconds', type: 'int', default: 300 })
  timeoutSeconds: number; // Default 5 minutes

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => EscalationPolicy, policy => policy.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'escalation_policy_id' })
  escalationPolicy: EscalationPolicy;

  @ManyToOne(() => Schedule, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule | null;

  // New multi-target relation (Phase 2)
  @OneToMany(() => EscalationTarget, target => target.escalationStep, { cascade: true })
  targets: EscalationTarget[];

  // Helper methods
  isScheduleTarget(): boolean {
    return this.targetType === 'schedule';
  }

  isUsersTarget(): boolean {
    return this.targetType === 'users';
  }

  getTargetUserIds(): string[] {
    // First check new targets relation (Phase 2)
    if (this.targets && this.targets.length > 0) {
      return this.targets
        .filter(t => t.targetType === 'user' && t.userId)
        .map(t => t.userId!);
    }
    // Fall back to legacy userIds field
    if (this.isUsersTarget() && this.userIds) {
      return this.userIds;
    }
    return [];
  }

  /**
   * Get all targets for this step (Phase 2 multi-target support)
   */
  getAllTargets(): EscalationTarget[] {
    return this.targets || [];
  }

  /**
   * Check if this step has any targets configured
   */
  hasTargets(): boolean {
    // Check new targets relation first
    if (this.targets && this.targets.length > 0) {
      return true;
    }
    // Fall back to legacy fields
    return (this.targetType === 'schedule' && !!this.scheduleId) ||
           (this.targetType === 'users' && !!this.userIds && this.userIds.length > 0);
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.stepOrder < 1) {
      errors.push('Step order must be >= 1');
    }

    if (this.timeoutSeconds < 0) {
      errors.push('Timeout must be >= 0');
    }

    if (this.targetType === 'schedule' && !this.scheduleId) {
      errors.push('Schedule ID required when target type is "schedule"');
    }

    if (this.targetType === 'users' && (!this.userIds || this.userIds.length === 0)) {
      errors.push('At least one user ID required when target type is "users"');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
