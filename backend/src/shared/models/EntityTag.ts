import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { Tag } from './Tag';

export type EntityType =
  | 'service'
  | 'incident'
  | 'business_service'
  | 'schedule'
  | 'escalation_policy'
  | 'runbook'
  | 'user'
  | 'team';

@Entity('entity_tags')
export class EntityTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'tag_id', type: 'uuid' })
  tagId: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entityType: EntityType;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Tag, tag => tag.entityTags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag: Tag;

  /**
   * Get a human-readable entity type label
   */
  getEntityTypeLabel(): string {
    switch (this.entityType) {
      case 'service':
        return 'Service';
      case 'incident':
        return 'Incident';
      case 'business_service':
        return 'Business Service';
      case 'schedule':
        return 'Schedule';
      case 'escalation_policy':
        return 'Escalation Policy';
      case 'runbook':
        return 'Runbook';
      case 'user':
        return 'User';
      case 'team':
        return 'Team';
      default:
        return 'Unknown';
    }
  }
}
