import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Incident } from './Incident';
import { User } from './User';

export type StatusUpdateType = 'investigating' | 'identified' | 'monitoring' | 'update' | 'resolved';

/**
 * IncidentStatusUpdate - Status updates posted to an incident for stakeholders
 *
 * These updates are sent to all incident subscribers and provide a way for
 * the incident commander/responders to communicate status to stakeholders
 * without cluttering the incident timeline with notes.
 */
@Entity('incident_status_updates')
export class IncidentStatusUpdate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  // The user who posted the update
  @Column({ name: 'posted_by', type: 'uuid' })
  postedBy: string;

  // Type of update (maps to standard incident communication phases)
  @Column({ name: 'update_type', type: 'varchar', length: 20, default: 'update' })
  updateType: StatusUpdateType;

  // The main message content
  @Column({ type: 'text' })
  message: string;

  // Optional HTML-formatted message for email
  @Column({ name: 'message_html', type: 'text', nullable: true })
  messageHtml: string | null;

  // Whether this update has been sent to subscribers
  @Column({ name: 'notifications_sent', type: 'boolean', default: false })
  notificationsSent: boolean;

  // When notifications were sent
  @Column({ name: 'notifications_sent_at', type: 'timestamptz', nullable: true })
  notificationsSentAt: Date | null;

  // Count of subscribers notified
  @Column({ name: 'subscriber_count', type: 'int', default: 0 })
  subscriberCount: number;

  // Whether this is a public update (visible on status page)
  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'posted_by' })
  postedByUser: User;

  // Helper methods
  getTypeLabel(): string {
    switch (this.updateType) {
      case 'investigating':
        return 'Investigating';
      case 'identified':
        return 'Identified';
      case 'monitoring':
        return 'Monitoring';
      case 'resolved':
        return 'Resolved';
      case 'update':
      default:
        return 'Update';
    }
  }

  getTypeColor(): string {
    switch (this.updateType) {
      case 'investigating':
        return 'yellow';
      case 'identified':
        return 'orange';
      case 'monitoring':
        return 'blue';
      case 'resolved':
        return 'green';
      case 'update':
      default:
        return 'gray';
    }
  }
}
