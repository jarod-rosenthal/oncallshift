import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { Integration } from './Integration';
import { Incident } from './Incident';
import { Service } from './Service';

export type IntegrationEventType =
  | 'incident.synced'
  | 'incident.updated'
  | 'incident.resolved'
  | 'channel.created'
  | 'channel.archived'
  | 'message.sent'
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.resolved'
  | 'webhook.sent'
  | 'webhook.received'
  | 'oauth.refreshed'
  | 'error';

export type IntegrationEventDirection = 'inbound' | 'outbound';
export type IntegrationEventStatus = 'success' | 'failed' | 'pending' | 'retrying';

@Entity('integration_events')
export class IntegrationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'integration_id', type: 'uuid' })
  integrationId: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType: IntegrationEventType | string;

  @Column({ type: 'varchar', length: 20, default: 'outbound' })
  direction: IntegrationEventDirection;

  @Column({ name: 'incident_id', type: 'uuid', nullable: true })
  incidentId: string | null;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  response: Record<string, any> | null;

  @Column({ type: 'varchar', length: 50, default: 'success' })
  status: IntegrationEventStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @Column({ name: 'external_url', type: 'varchar', length: 2000, nullable: true })
  externalUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Integration)
  @JoinColumn({ name: 'integration_id' })
  integration: Integration;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Incident, { nullable: true })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident | null;

  @ManyToOne(() => Service, { nullable: true })
  @JoinColumn({ name: 'service_id' })
  service: Service | null;

  // Helper methods
  isSuccess(): boolean {
    return this.status === 'success';
  }

  isFailed(): boolean {
    return this.status === 'failed';
  }

  canRetry(): boolean {
    return this.status === 'failed' && this.retryCount < 3;
  }

  markRetrying(): void {
    this.status = 'retrying';
    this.retryCount += 1;
  }

  markSuccess(response?: Record<string, any>): void {
    this.status = 'success';
    if (response) {
      this.response = response;
    }
  }

  markFailed(error: string): void {
    this.status = 'failed';
    this.errorMessage = error;
  }
}
