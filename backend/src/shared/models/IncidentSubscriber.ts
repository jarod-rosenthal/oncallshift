import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Incident } from './Incident';
import { User } from './User';

export type IncidentSubscriberChannel = 'email' | 'sms' | 'push' | 'slack' | 'webhook';
export type IncidentSubscriberRole = 'stakeholder' | 'observer' | 'responder';

/**
 * IncidentSubscriber - Tracks stakeholders who want to receive updates about an incident
 *
 * Similar to PagerDuty's Subscriber feature, this allows non-responders to:
 * - Receive status updates about an incident
 * - Get notified when the incident is resolved
 * - Stay informed without being in the escalation path
 */
@Entity('incident_subscribers')
@Unique(['incidentId', 'email'])
export class IncidentSubscriber {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  // Can be an internal user or external stakeholder
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  // Email for external subscribers or override for internal users
  @Column({ type: 'varchar', length: 255 })
  email: string;

  // Display name for the subscriber
  @Column({ name: 'display_name', type: 'varchar', length: 255, nullable: true })
  displayName: string | null;

  // Role determines what updates they receive
  @Column({ type: 'varchar', length: 20, default: 'stakeholder' })
  role: IncidentSubscriberRole;

  // Notification channel preference
  @Column({ type: 'varchar', length: 20, default: 'email' })
  channel: IncidentSubscriberChannel;

  // Optional webhook URL for webhook channel
  @Column({ name: 'webhook_url', type: 'varchar', length: 500, nullable: true })
  webhookUrl: string | null;

  // Optional Slack channel for Slack channel
  @Column({ name: 'slack_channel', type: 'varchar', length: 100, nullable: true })
  slackChannel: string | null;

  // Who added this subscriber
  @Column({ name: 'added_by', type: 'uuid', nullable: true })
  addedBy: string | null;

  // Whether the subscriber has confirmed their subscription (for external emails)
  @Column({ type: 'boolean', default: true })
  confirmed: boolean;

  // Whether the subscription is active
  @Column({ type: 'boolean', default: true })
  active: boolean;

  // Notification preferences
  @Column({ name: 'notify_on_status_update', type: 'boolean', default: true })
  notifyOnStatusUpdate: boolean;

  @Column({ name: 'notify_on_resolution', type: 'boolean', default: true })
  notifyOnResolution: boolean;

  @Column({ name: 'notify_on_escalation', type: 'boolean', default: false })
  notifyOnEscalation: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'added_by' })
  addedByUser: User | null;

  // Helper methods
  getDisplayName(): string {
    if (this.displayName) return this.displayName;
    if (this.user) return this.user.fullName || this.user.email;
    return this.email;
  }

  isInternal(): boolean {
    return this.userId !== null;
  }
}
