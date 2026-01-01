import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Organization } from './Organization';
import { DeviceToken } from './DeviceToken';
import { Notification } from './Notification';
import { UserContactMethod } from './UserContactMethod';
import { UserNotificationRule } from './UserNotificationRule';

export type BaseRole = 'owner' | 'admin' | 'manager' | 'responder' | 'observer' | 'restricted_access' | 'limited_stakeholder';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'cognito_sub', type: 'varchar', length: 255, unique: true })
  cognitoSub: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  fullName: string | null;

  @Column({ type: 'varchar', length: 50, default: 'member' })
  role: 'admin' | 'member'; // DEPRECATED: Use base_role instead

  @Column({ name: 'base_role', type: 'varchar', length: 30, default: 'responder' })
  baseRole: BaseRole;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'inactive';

  @Column({ name: 'phone_number', type: 'varchar', length: 50, nullable: true })
  phoneNumber: string | null;

  @Column({ name: 'profile_picture_url', type: 'varchar', length: 500, nullable: true })
  profilePictureUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any> | null;

  // Anthropic credential fields for AI Diagnosis (BYOK)
  @Column({ name: 'anthropic_credential_encrypted', type: 'text', nullable: true })
  anthropicCredentialEncrypted: string | null;

  @Column({ name: 'anthropic_credential_type', type: 'varchar', length: 10, nullable: true })
  anthropicCredentialType: 'api_key' | 'oauth' | null;

  @Column({ name: 'anthropic_credential_hint', type: 'varchar', length: 20, nullable: true })
  anthropicCredentialHint: string | null;

  @Column({ name: 'anthropic_refresh_token_encrypted', type: 'text', nullable: true })
  anthropicRefreshTokenEncrypted: string | null;

  @Column({ name: 'anthropic_credential_updated_at', type: 'timestamp', nullable: true })
  anthropicCredentialUpdatedAt: Date | null;

  // Do Not Disturb (DND) fields
  @Column({ name: 'dnd_enabled', type: 'boolean', default: false })
  dndEnabled: boolean;

  @Column({ name: 'dnd_start_time', type: 'time', nullable: true })
  dndStartTime: string | null; // HH:mm format (e.g., "22:00")

  @Column({ name: 'dnd_end_time', type: 'time', nullable: true })
  dndEndTime: string | null; // HH:mm format (e.g., "08:00")

  @Column({ name: 'dnd_timezone', type: 'varchar', length: 100, nullable: true })
  dndTimezone: string | null; // IANA timezone (e.g., "America/New_York")

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, org => org.users)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @OneToMany(() => DeviceToken, token => token.user)
  deviceTokens: DeviceToken[];

  @OneToMany(() => Notification, notification => notification.user)
  notifications: Notification[];

  @OneToMany(() => UserContactMethod, method => method.user)
  contactMethods: UserContactMethod[];

  @OneToMany(() => UserNotificationRule, rule => rule.user)
  notificationRules: UserNotificationRule[];

  // RBAC Helper Methods

  /**
   * Check if user has unrestricted access (owner or admin)
   * These roles bypass object-level permissions
   */
  hasUnrestrictedAccess(): boolean {
    return this.baseRole === 'owner' || this.baseRole === 'admin';
  }

  /**
   * Check if user is an owner (highest privilege)
   */
  isOwner(): boolean {
    return this.baseRole === 'owner';
  }

  /**
   * Check if user is an admin
   */
  isAdmin(): boolean {
    return this.baseRole === 'admin';
  }

  /**
   * Check if user can manage organization settings
   */
  canManageOrganization(): boolean {
    return this.baseRole === 'owner';
  }

  /**
   * Check if user can create/delete users
   */
  canManageUsers(): boolean {
    return this.baseRole === 'owner' || this.baseRole === 'admin';
  }

  /**
   * Check if user can assign roles
   * @param targetRole The role being assigned
   */
  canAssignRole(targetRole: BaseRole): boolean {
    if (this.baseRole === 'owner') {
      return true; // Owners can assign any role
    }
    if (this.baseRole === 'admin') {
      // Admins can assign up to admin (not owner)
      return targetRole !== 'owner';
    }
    if (this.baseRole === 'manager') {
      // Managers can assign responder/observer
      return targetRole === 'responder' || targetRole === 'observer';
    }
    return false;
  }

  /**
   * Check if user can be on-call
   */
  canBeOnCall(): boolean {
    return this.baseRole === 'owner' ||
           this.baseRole === 'admin' ||
           this.baseRole === 'manager' ||
           this.baseRole === 'responder';
  }

  /**
   * Check if user can acknowledge/resolve incidents
   */
  canHandleIncidents(): boolean {
    return this.baseRole !== 'observer' &&
           this.baseRole !== 'limited_stakeholder';
  }

  /**
   * Check if user can create resources (services, schedules, etc.)
   */
  canCreateResources(): boolean {
    return this.baseRole === 'owner' ||
           this.baseRole === 'admin' ||
           this.baseRole === 'manager';
  }

  /**
   * Check if user is subject to object-level permissions
   * Owners and admins bypass object permissions
   */
  requiresObjectPermissions(): boolean {
    return !this.hasUnrestrictedAccess();
  }

  /**
   * Get user role display label
   */
  getBaseRoleLabel(): string {
    const labels: Record<BaseRole, string> = {
      owner: 'Owner',
      admin: 'Admin',
      manager: 'Manager',
      responder: 'Responder',
      observer: 'Observer',
      restricted_access: 'Restricted Access',
      limited_stakeholder: 'Limited Stakeholder',
    };
    return labels[this.baseRole];
  }
}
