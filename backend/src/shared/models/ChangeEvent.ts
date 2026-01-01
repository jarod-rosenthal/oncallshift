import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Service } from './Service';

/**
 * ChangeEvent - Informational records for deployment/change tracking
 *
 * Unlike incidents, change events don't trigger alerts or escalations.
 * They provide context about recent changes that might be relevant
 * when investigating incidents.
 *
 * Compatible with PagerDuty Events API v2 change events.
 */
@Entity('change_events')
export class ChangeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @Column({ type: 'varchar', length: 1024 })
  summary: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  source: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  timestamp: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  customDetails: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  links: Array<{ href: string; text?: string }> | null;

  @Column({ name: 'routing_key', type: 'varchar', length: 255, nullable: true })
  routingKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;
}
