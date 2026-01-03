import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';

export type RecommendationType =
  | 'oncall_fairness'
  | 'alert_noise'
  | 'runbook_coverage'
  | 'escalation_effectiveness'
  | 'mttr_trend'
  | 'schedule_gap'
  | 'service_health';

export type RecommendationSeverity = 'info' | 'warning' | 'critical';

export type RecommendationStatus = 'pending' | 'applied' | 'dismissed' | 'expired';

export interface AutoFixPayload {
  action: string;
  targetType: 'schedule' | 'service' | 'escalation_policy' | 'alert_routing_rule' | 'runbook';
  targetId?: string;
  params?: Record<string, any>;
}

@Entity('ai_recommendations')
export class AIRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 50 })
  type: RecommendationType;

  @Column({ type: 'varchar', length: 20, default: 'warning' })
  severity: RecommendationSeverity;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'suggested_action', type: 'text', nullable: true })
  suggestedAction: string | null;

  @Column({ name: 'auto_fix_available', type: 'boolean', default: false })
  autoFixAvailable: boolean;

  @Column({ name: 'auto_fix_payload', type: 'jsonb', nullable: true })
  autoFixPayload: AutoFixPayload | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: RecommendationStatus;

  // Supporting data for the recommendation
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  // Applied/dismissed tracking
  @Column({ name: 'applied_at', type: 'timestamp', nullable: true })
  appliedAt: Date | null;

  @Column({ name: 'applied_by', type: 'uuid', nullable: true })
  appliedBy: string | null;

  @Column({ name: 'dismissed_at', type: 'timestamp', nullable: true })
  dismissedAt: Date | null;

  @Column({ name: 'dismissed_by', type: 'uuid', nullable: true })
  dismissedBy: string | null;

  @Column({ name: 'dismiss_reason', type: 'text', nullable: true })
  dismissReason: string | null;

  // Expiration for time-sensitive recommendations
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'applied_by' })
  appliedByUser: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'dismissed_by' })
  dismissedByUser: User | null;

  // Helper methods
  isActionable(): boolean {
    return this.status === 'pending' && !this.isExpired();
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date(this.expiresAt) < new Date();
  }

  canApply(): boolean {
    return this.autoFixAvailable && this.status === 'pending' && !this.isExpired();
  }

  apply(userId: string): void {
    this.status = 'applied';
    this.appliedAt = new Date();
    this.appliedBy = userId;
  }

  dismiss(userId: string, reason?: string): void {
    this.status = 'dismissed';
    this.dismissedAt = new Date();
    this.dismissedBy = userId;
    this.dismissReason = reason || null;
  }

  expire(): void {
    this.status = 'expired';
  }
}
