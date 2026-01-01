import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';

export type ObjectType = 'service' | 'schedule' | 'escalation_policy' | 'status_page';
export type SubjectType = 'user' | 'team';
export type PermissionLevel = 'view' | 'edit' | 'manage';

/**
 * ObjectPermission - Fine-grained access control for resources
 *
 * Grants specific users or teams permission to access resources.
 * This is how PagerDuty implements "who can see/edit this service".
 *
 * Permission levels:
 * - view: Can see the resource and its incidents
 * - edit: Can modify the resource configuration
 * - manage: Can delete the resource and grant permissions
 *
 * Examples:
 * - Grant "Backend Team" view access to "Database Service"
 * - Grant "Alice" (user) manage access to "On-Call Schedule"
 * - Grant "Engineering Team" edit access to "API Escalation Policy"
 */
@Entity('object_permissions')
@Unique(['objectType', 'objectId', 'subjectType', 'subjectId'])
export class ObjectPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'object_type', type: 'varchar', length: 50 })
  objectType: ObjectType;

  @Column({ name: 'object_id', type: 'uuid' })
  objectId: string;

  @Column({ name: 'subject_type', type: 'varchar', length: 20 })
  subjectType: SubjectType;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @Column({ name: 'permission_level', type: 'varchar', length: 30 })
  permissionLevel: PermissionLevel;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  // Helper methods
  isUserPermission(): boolean {
    return this.subjectType === 'user';
  }

  isTeamPermission(): boolean {
    return this.subjectType === 'team';
  }

  canView(): boolean {
    return true; // All permission levels include view
  }

  canEdit(): boolean {
    return this.permissionLevel === 'edit' || this.permissionLevel === 'manage';
  }

  canManage(): boolean {
    return this.permissionLevel === 'manage';
  }

  getPermissionLabel(): string {
    const labels: Record<PermissionLevel, string> = {
      view: 'Can View',
      edit: 'Can Edit',
      manage: 'Can Manage',
    };
    return labels[this.permissionLevel];
  }

  getObjectTypeLabel(): string {
    const labels: Record<ObjectType, string> = {
      service: 'Service',
      schedule: 'Schedule',
      escalation_policy: 'Escalation Policy',
      status_page: 'Status Page',
    };
    return labels[this.objectType];
  }
}
