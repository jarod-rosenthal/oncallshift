import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Organization } from './Organization';
import { EscalationStep } from './EscalationStep';
import { Service } from './Service';

@Entity('escalation_policies')
export class EscalationPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'repeat_enabled', type: 'boolean', default: false })
  repeatEnabled: boolean;

  @Column({ name: 'repeat_count', type: 'int', default: 0 })
  repeatCount: number; // 0 = infinite if repeatEnabled is true

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @OneToMany(() => EscalationStep, step => step.escalationPolicy, { cascade: true })
  steps: EscalationStep[];

  @OneToMany(() => Service, service => service.escalationPolicy)
  services: Service[];

  // Helper methods
  getStepByOrder(order: number): EscalationStep | undefined {
    return this.steps?.find(step => step.stepOrder === order);
  }

  getTotalSteps(): number {
    return this.steps?.length || 0;
  }

  hasMoreSteps(currentStep: number): boolean {
    return currentStep < this.getTotalSteps();
  }

  /**
   * Check if the policy should repeat after exhausting all levels
   */
  shouldRepeat(): boolean {
    return this.repeatEnabled;
  }

  /**
   * Check if the policy can repeat again (based on repeat count)
   * @param currentRepeatCount Number of times the policy has already repeated
   */
  canRepeatAgain(currentRepeatCount: number): boolean {
    if (!this.repeatEnabled) {
      return false;
    }
    // repeatCount of 0 means infinite repeats
    if (this.repeatCount === 0) {
      return true;
    }
    return currentRepeatCount < this.repeatCount;
  }

  /**
   * Get the repeat configuration summary for display
   */
  getRepeatSummary(): string {
    if (!this.repeatEnabled) {
      return 'No repeat';
    }
    if (this.repeatCount === 0) {
      return 'Repeats indefinitely';
    }
    return `Repeats ${this.repeatCount} time${this.repeatCount === 1 ? '' : 's'}`;
  }
}
