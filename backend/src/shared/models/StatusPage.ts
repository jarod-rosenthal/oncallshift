import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { StatusPageService } from './StatusPageService';
import { StatusPageSubscriber } from './StatusPageSubscriber';

export type StatusPageVisibility = 'internal' | 'public';

@Entity('status_pages')
export class StatusPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 20, default: 'internal' })
  visibility: StatusPageVisibility;

  @Column({ name: 'custom_domain', type: 'varchar', length: 255, nullable: true })
  customDomain: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ name: 'favicon_url', type: 'varchar', length: 500, nullable: true })
  faviconUrl: string | null;

  @Column({ name: 'primary_color', type: 'varchar', length: 7, default: '#007bff' })
  primaryColor: string;

  @Column({ name: 'show_uptime_history', type: 'boolean', default: true })
  showUptimeHistory: boolean;

  @Column({ name: 'uptime_history_days', type: 'int', default: 90 })
  uptimeHistoryDays: number;

  @Column({ name: 'allow_subscriptions', type: 'boolean', default: true })
  allowSubscriptions: boolean;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @OneToMany(() => StatusPageService, sps => sps.statusPage)
  services: StatusPageService[];

  @OneToMany(() => StatusPageSubscriber, sub => sub.statusPage)
  subscribers: StatusPageSubscriber[];
}
