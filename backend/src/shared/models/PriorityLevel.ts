import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';

export type PriorityUrgency = 'high' | 'low';

@Entity('priority_levels')
export class PriorityLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: '#6366f1' })
  color: string;

  @Column({ name: 'order_value', type: 'int', default: 0 })
  orderValue: number;

  @Column({ type: 'varchar', length: 20, default: 'high' })
  urgency: PriorityUrgency;

  @Column({ name: 'auto_escalate', type: 'boolean', default: false })
  autoEscalate: boolean;

  @Column({ name: 'escalate_after_minutes', type: 'int', default: 30 })
  escalateAfterMinutes: number;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  /**
   * Get display label (e.g., "P1 - Critical")
   */
  getDisplayLabel(): string {
    return this.name;
  }

  /**
   * Check if this is a high urgency priority
   */
  isHighUrgency(): boolean {
    return this.urgency === 'high';
  }

  /**
   * Get auto-escalation timeout in milliseconds
   */
  getEscalateAfterMs(): number {
    return this.escalateAfterMinutes * 60 * 1000;
  }
}
