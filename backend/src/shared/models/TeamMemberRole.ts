import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Team } from './Team';
import { User } from './User';

export type TeamMemberRoleType = 'manager' | 'responder' | 'observer';

/**
 * TeamMemberRole - Per-team role assignments
 *
 * Allows users to have different roles in different teams.
 * Example: Alice could be a manager in the Backend team but a responder in the Frontend team.
 *
 * This complements the base_role on User which is organization-wide.
 */
@Entity('team_member_roles')
@Unique(['teamId', 'userId'])
export class TeamMemberRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 30 })
  role: TeamMemberRoleType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Helper methods
  isManager(): boolean {
    return this.role === 'manager';
  }

  isResponder(): boolean {
    return this.role === 'responder';
  }

  isObserver(): boolean {
    return this.role === 'observer';
  }

  canManageTeam(): boolean {
    return this.role === 'manager';
  }

  canRespond(): boolean {
    return this.role === 'manager' || this.role === 'responder';
  }

  getRoleLabel(): string {
    const labels: Record<TeamMemberRoleType, string> = {
      manager: 'Team Manager',
      responder: 'Responder',
      observer: 'Observer',
    };
    return labels[this.role];
  }
}
