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
}
