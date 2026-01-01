import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { Service } from './Service';
import { Team } from './Team';

export type WebhookSubscriptionScope = 'organization' | 'service' | 'team';

export type WebhookEventType =
  | 'incident.triggered'
  | 'incident.acknowledged'
  | 'incident.resolved'
  | 'incident.reassigned'
  | 'incident.escalated'
  | 'incident.annotated'
  | 'incident.delegated'
  | 'incident.priority_updated'
  | 'incident.responders.added'
  | 'incident.responders.removed'
  | 'incident.status_update_published'
  | 'incident.reopened'
  | 'service.created'
  | 'service.updated'
  | 'service.deleted';

/**
 * WebhookSubscription - PagerDuty-compatible webhook v3 subscriptions
 *
 * Supports organization-wide, service-scoped, and team-scoped subscriptions.
 * Delivers webhook events with HMAC signature (x-pagerduty-signature).
 *
 * Compatible with PagerDuty Webhook Subscriptions API v3.
 */
@Entity('webhook_subscriptions')
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 50 })
  scope: WebhookSubscriptionScope;

  // Scope-specific IDs (nullable for organization scope)
  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ type: 'simple-array' })
  eventTypes: string[]; // Array of WebhookEventType values

  @Column({ type: 'varchar', length: 1000 })
  url: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  // Secret for HMAC signature generation
  @Column({ type: 'varchar', length: 255 })
  secret: string;

  // Delivery configuration
  @Column({ name: 'delivery_timeout_seconds', type: 'int', default: 10 })
  deliveryTimeoutSeconds: number;

  @Column({ name: 'max_retries', type: 'int', default: 3 })
  maxRetries: number;

  // Statistics
  @Column({ name: 'total_deliveries', type: 'int', default: 0 })
  totalDeliveries: number;

  @Column({ name: 'successful_deliveries', type: 'int', default: 0 })
  successfulDeliveries: number;

  @Column({ name: 'failed_deliveries', type: 'int', default: 0 })
  failedDeliveries: number;

  @Column({ name: 'last_delivery_at', type: 'timestamp', nullable: true })
  lastDeliveryAt: Date | null;

  @Column({ name: 'last_delivery_status', type: 'varchar', length: 20, nullable: true })
  lastDeliveryStatus: string | null; // 'success' | 'failed'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Service, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'service_id' })
  service: Service | null;

  @ManyToOne(() => Team, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;
}
