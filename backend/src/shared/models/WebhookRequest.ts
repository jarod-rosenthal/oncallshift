import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Service } from './Service';

export type WebhookRequestStatus = 'accepted' | 'processing' | 'completed' | 'failed';

/**
 * WebhookRequest - Tracks async webhook request status
 *
 * Opsgenie API returns requestId for async operations.
 * Clients can poll GET /requests/:requestId to check status.
 * Records are automatically cleaned up after TTL expires.
 *
 * Compatible with Opsgenie Request Status API.
 */
@Entity('webhook_requests')
export class WebhookRequest {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'varchar', length: 20, default: 'accepted' })
  status: WebhookRequestStatus;

  @Column({ type: 'boolean', default: false })
  processed: boolean;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message: string | null;

  @Column({ name: 'alert_id', type: 'varchar', length: 255, nullable: true })
  alertId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  // Relations
  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;
}
