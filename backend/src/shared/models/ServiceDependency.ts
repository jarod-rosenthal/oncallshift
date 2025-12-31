import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { Service } from './Service';

export type DependencyType = 'required' | 'optional' | 'runtime' | 'development';
export type DependencyImpactLevel = 'critical' | 'high' | 'medium' | 'low';

@Entity('service_dependencies')
export class ServiceDependency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'dependent_service_id', type: 'uuid' })
  dependentServiceId: string;

  @Column({ name: 'supporting_service_id', type: 'uuid' })
  supportingServiceId: string;

  @Column({ name: 'dependency_type', type: 'varchar', length: 50, default: 'required' })
  dependencyType: DependencyType;

  @Column({ name: 'impact_level', type: 'varchar', length: 20, default: 'high' })
  impactLevel: DependencyImpactLevel;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Service, service => service.dependsOn, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dependent_service_id' })
  dependentService: Service;

  @ManyToOne(() => Service, service => service.dependents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supporting_service_id' })
  supportingService: Service;

  /**
   * Get dependency type label
   */
  getDependencyTypeLabel(): string {
    switch (this.dependencyType) {
      case 'required':
        return 'Required';
      case 'optional':
        return 'Optional';
      case 'runtime':
        return 'Runtime';
      case 'development':
        return 'Development';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get impact level label
   */
  getImpactLevelLabel(): string {
    switch (this.impactLevel) {
      case 'critical':
        return 'Critical';
      case 'high':
        return 'High';
      case 'medium':
        return 'Medium';
      case 'low':
        return 'Low';
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if this is a critical dependency
   */
  isCritical(): boolean {
    return this.impactLevel === 'critical' || (this.dependencyType === 'required' && this.impactLevel === 'high');
  }
}
