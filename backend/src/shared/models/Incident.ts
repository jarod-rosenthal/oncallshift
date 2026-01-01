import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Organization } from './Organization';
import { Service } from './Service';
import { User } from './User';
import { IncidentEvent } from './IncidentEvent';
import { Notification } from './Notification';
import { Alert } from './Alert';
import { PriorityLevel } from './PriorityLevel';
import { IncidentResponder } from './IncidentResponder';

export type IncidentState = 'triggered' | 'acknowledged' | 'resolved';
export type IncidentSeverity = 'info' | 'warning' | 'error' | 'critical';
export type IncidentUrgency = 'high' | 'low';

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @Column({ name: 'incident_number', type: 'int' })
  incidentNumber: number; // Auto-incrementing per org

  @Column({ name: 'dedup_key', type: 'varchar', length: 255, nullable: true })
  dedupKey: string | null;

  @Column({ type: 'varchar', length: 500 })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any> | null;

  @Column({ type: 'varchar', length: 50, default: 'error' })
  severity: IncidentSeverity;

  @Column({ type: 'varchar', length: 50, default: 'triggered' })
  state: IncidentState;

  @Column({ type: 'varchar', length: 10, default: 'high' })
  urgency: IncidentUrgency;

  @Column({ name: 'triggered_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  triggeredAt: Date;

  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'event_count', type: 'int', default: 1 })
  eventCount: number; // Number of times this incident was triggered (deduplication)

  @Column({ name: 'last_event_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastEventAt: Date;

  @Column({ name: 'current_escalation_step', type: 'int', default: 0 })
  currentEscalationStep: number;

  @Column({ name: 'escalation_started_at', type: 'timestamp', nullable: true })
  escalationStartedAt: Date | null;

  // Assignment tracking
  @Column({ name: 'assigned_to_user_id', type: 'uuid', nullable: true })
  assignedToUserId: string | null;

  @Column({ name: 'assigned_at', type: 'timestamp', nullable: true })
  assignedAt: Date | null;

  // Merged incident tracking
  @Column({ name: 'merged_into_incident_id', type: 'uuid', nullable: true })
  mergedIntoIncidentId: string | null;

  // Priority level
  @Column({ name: 'priority_id', type: 'uuid', nullable: true })
  priorityId: string | null;

  // Snooze support
  @Column({ name: 'snoozed_until', type: 'timestamp', nullable: true })
  snoozedUntil: Date | null;

  @Column({ name: 'snoozed_by', type: 'uuid', nullable: true })
  snoozedBy: string | null;

  // Conference bridge for war room
  @Column({ name: 'conference_bridge_url', type: 'varchar', length: 500, nullable: true })
  conferenceBridgeUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Service, service => service.incidents)
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'acknowledged_by' })
  acknowledgedByUser: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolvedByUser: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to_user_id' })
  assignedToUser: User | null;


  @ManyToOne(() => Incident, { nullable: true })
  @JoinColumn({ name: 'merged_into_incident_id' })
  mergedIntoIncident: Incident | null;

  @ManyToOne(() => PriorityLevel, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'priority_id' })
  priority: PriorityLevel | null;

  @OneToMany(() => IncidentEvent, event => event.incident)
  events: IncidentEvent[];

  @OneToMany(() => Notification, notification => notification.incident)
  notifications: Notification[];

  @OneToMany(() => Alert, alert => alert.incident)
  alerts: Alert[];

  @OneToMany(() => IncidentResponder, responder => responder.incident)
  responders: IncidentResponder[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'snoozed_by' })
  snoozedByUser: User | null;

  // Helper methods
  isOpen(): boolean {
    return this.state === 'triggered' || this.state === 'acknowledged';
  }

  canAcknowledge(): boolean {
    return this.state === 'triggered';
  }

  canResolve(): boolean {
    return this.state !== 'resolved';
  }

  canReassign(): boolean {
    return this.state !== 'resolved';
  }


  canEscalate(): boolean {
    return this.state === 'triggered';
  }


  isMerged(): boolean {
    return this.mergedIntoIncidentId !== null;
  }

  isSnoozed(): boolean {
    return this.snoozedUntil !== null && new Date(this.snoozedUntil) > new Date();
  }

  canSnooze(): boolean {
    return this.state === 'acknowledged';
  }

  snooze(until: Date, byUserId: string): void {
    this.snoozedUntil = until;
    this.snoozedBy = byUserId;
  }

  unsnooze(): void {
    this.snoozedUntil = null;
    this.snoozedBy = null;
  }

  getSnoozeRemainingMs(): number | null {
    if (!this.snoozedUntil) return null;
    const remaining = new Date(this.snoozedUntil).getTime() - Date.now();
    return remaining > 0 ? remaining : 0;
  }
}
