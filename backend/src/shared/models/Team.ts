import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { TeamMembership } from './TeamMembership';

export interface TeamSettings {
  defaultEscalationPolicyId?: string;
  defaultScheduleId?: string;
  slackChannelId?: string;
  teamsChannelId?: string;
}

export type TeamPrivacy = 'public' | 'private';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: 'public' })
  privacy: TeamPrivacy;

  @Column({ type: 'varchar', length: 100, nullable: true })
  slug: string | null;

  @Column({ type: 'jsonb', default: {} })
  settings: TeamSettings;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @OneToMany(() => TeamMembership, membership => membership.team)
  memberships: TeamMembership[];

  // Helper methods

  /**
   * Generate a URL-friendly slug from the team name
   */
  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
  }

  /**
   * Get all user IDs in this team
   */
  getMemberUserIds(): string[] {
    if (!this.memberships) return [];
    return this.memberships.map(m => m.userId);
  }

  /**
   * Get all manager user IDs in this team
   */
  getManagerUserIds(): string[] {
    if (!this.memberships) return [];
    return this.memberships
      .filter(m => m.role === 'manager')
      .map(m => m.userId);
  }

  /**
   * Check if a user is a member of this team
   */
  hasMember(userId: string): boolean {
    if (!this.memberships) return false;
    return this.memberships.some(m => m.userId === userId);
  }

  /**
   * Check if a user is a manager of this team
   */
  hasManager(userId: string): boolean {
    if (!this.memberships) return false;
    return this.memberships.some(m => m.userId === userId && m.role === 'manager');
  }

  /**
   * Get the member count
   */
  getMemberCount(): number {
    if (!this.memberships) return 0;
    return this.memberships.length;
  }

  /**
   * Check if team is private
   */
  isPrivate(): boolean {
    return this.privacy === 'private';
  }

  /**
   * Check if a user can view this team
   * Private teams are only visible to members (unless user is owner/admin)
   */
  canUserView(userId: string, userBaseRole: string): boolean {
    // Owners and admins can see all teams
    if (userBaseRole === 'owner' || userBaseRole === 'admin') {
      return true;
    }
    // Public teams are visible to everyone
    if (this.privacy === 'public') {
      return true;
    }
    // Private teams only visible to members
    return this.hasMember(userId);
  }
}
