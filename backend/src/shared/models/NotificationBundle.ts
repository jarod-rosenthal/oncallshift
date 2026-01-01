import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';
import { Organization } from './Organization';

export type NotificationBundleStatus = 'pending' | 'sent' | 'cancelled';

/**
 * NotificationBundle groups low-urgency notifications together
 * to be sent as a digest every 30 minutes instead of immediately
 */
@Entity('notification_bundles')
export class NotificationBundle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: NotificationBundleStatus;

  @Column({ name: 'notification_count', type: 'integer', default: 0 })
  notificationCount: number;

  @Column({ name: 'incident_ids', type: 'jsonb', default: '[]' })
  incidentIds: string[];

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;
}
