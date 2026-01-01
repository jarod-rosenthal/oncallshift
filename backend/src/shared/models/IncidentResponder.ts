import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Incident } from './Incident';
import { User } from './User';

export type ResponderStatus = 'pending' | 'accepted' | 'declined';

@Entity('incident_responders')
@Unique(['incidentId', 'userId'])
export class IncidentResponder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'requested_by_id', type: 'uuid' })
  requestedById: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: ResponderStatus;

  @Column({ type: 'text', nullable: true })
  message: string | null; // Optional message when requesting help

  @Column({ name: 'responded_at', type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: User;

  // Helper methods
  isPending(): boolean {
    return this.status === 'pending';
  }

  hasAccepted(): boolean {
    return this.status === 'accepted';
  }

  hasDeclined(): boolean {
    return this.status === 'declined';
  }

  accept(): void {
    this.status = 'accepted';
    this.respondedAt = new Date();
  }

  decline(): void {
    this.status = 'declined';
    this.respondedAt = new Date();
  }
}
