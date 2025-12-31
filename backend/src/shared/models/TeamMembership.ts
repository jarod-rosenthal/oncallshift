import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Team } from './Team';
import { User } from './User';

export type TeamRole = 'manager' | 'member';

@Entity('team_memberships')
export class TeamMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'team_id', type: 'uuid' })
  teamId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 50, default: 'member' })
  role: TeamRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Team, team => team.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Helper methods

  /**
   * Check if this membership has manager role
   */
  isManager(): boolean {
    return this.role === 'manager';
  }

  /**
   * Check if this membership has member role
   */
  isMember(): boolean {
    return this.role === 'member';
  }
}
