import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { StatusPage } from './StatusPage';

export type SubscriberChannel = 'email' | 'webhook' | 'slack';

@Entity('status_page_subscribers')
@Unique(['statusPageId', 'email'])
export class StatusPageSubscriber {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'status_page_id', type: 'uuid' })
  statusPageId: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 20, default: 'email' })
  channel: SubscriberChannel;

  @Column({ name: 'webhook_url', type: 'varchar', length: 500, nullable: true })
  webhookUrl: string | null;

  @Column({ name: 'slack_channel', type: 'varchar', length: 100, nullable: true })
  slackChannel: string | null;

  @Column({ type: 'boolean', default: true })
  confirmed: boolean;

  @Column({ name: 'confirmation_token', type: 'varchar', length: 100, nullable: true })
  confirmationToken: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => StatusPage, sp => sp.subscribers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'status_page_id' })
  statusPage: StatusPage;
}
