import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { Team } from './Team';
import { User } from './User';
import { Service } from './Service';

export type BusinessServiceStatus = 'operational' | 'degraded' | 'major_outage' | 'maintenance' | 'unknown';
export type ImpactTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';

@Entity('business_services')
export class BusinessService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'owner_team_id', type: 'uuid', nullable: true })
  ownerTeamId: string | null;

  @Column({ name: 'point_of_contact_id', type: 'uuid', nullable: true })
  pointOfContactId: string | null;

  @Column({ type: 'varchar', length: 50, default: 'operational' })
  status: BusinessServiceStatus;

  @Column({ name: 'impact_tier', type: 'varchar', length: 20, default: 'tier_3' })
  impactTier: ImpactTier;

  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @Column({ name: 'documentation_url', type: 'text', nullable: true })
  documentationUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_team_id' })
  ownerTeam: Team | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'point_of_contact_id' })
  pointOfContact: User | null;

  @OneToMany(() => Service, service => service.businessService)
  services: Service[];

  /**
   * Get impact tier label
   */
  getImpactTierLabel(): string {
    switch (this.impactTier) {
      case 'tier_1':
        return 'Critical';
      case 'tier_2':
        return 'High';
      case 'tier_3':
        return 'Medium';
      case 'tier_4':
        return 'Low';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get status display label
   */
  getStatusLabel(): string {
    switch (this.status) {
      case 'operational':
        return 'Operational';
      case 'degraded':
        return 'Degraded Performance';
      case 'major_outage':
        return 'Major Outage';
      case 'maintenance':
        return 'Under Maintenance';
      case 'unknown':
        return 'Unknown';
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if the service is in a healthy state
   */
  isHealthy(): boolean {
    return this.status === 'operational';
  }

  /**
   * Check if the service is in an unhealthy state
   */
  isUnhealthy(): boolean {
    return this.status === 'degraded' || this.status === 'major_outage';
  }
}
