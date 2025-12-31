import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Incident } from './Incident';
import { User } from './User';

export type IncidentEventType =
  | 'alert'           // New alert received
  | 'note'            // User added note
  | 'acknowledge'     // Incident acknowledged
  | 'resolve'         // Incident resolved
  | 'escalate'        // Escalation triggered
  | 'notification'    // Notification sent
  | 'state_change'    // State changed
  | 'reassign'        // Incident reassigned
  | 'ai_diagnosis';   // AI-powered diagnosis performed

@Entity('incident_events')
export class IncidentEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  @Column({ type: 'varchar', length: 50 })
  type: IncidentEventType;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null; // User who performed the action (null for system events)

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Incident, incident => incident.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor: User | null;
}
