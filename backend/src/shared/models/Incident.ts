import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Organization } from './Organization';
import { Service } from './Service';
import { User } from './User';
import { IncidentEvent } from './IncidentEvent';
import { Notification } from './Notification';

export type IncidentState = 'triggered' | 'acknowledged' | 'resolved';
export type IncidentSeverity = 'info' | 'warning' | 'error' | 'critical';

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

  @OneToMany(() => IncidentEvent, event => event.incident)
  events: IncidentEvent[];

  @OneToMany(() => Notification, notification => notification.incident)
  notifications: Notification[];

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
}
