import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { StatusPage } from './StatusPage';
import { User } from './User';

export type UpdateStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type UpdateSeverity = 'none' | 'minor' | 'major' | 'critical';

@Entity('status_page_updates')
export class StatusPageUpdate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'status_page_id', type: 'uuid' })
  statusPageId: string;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 20 })
  status: UpdateStatus;

  @Column({ type: 'varchar', length: 20, default: 'none' })
  severity: UpdateSeverity;

  @Column({ name: 'affected_service_ids', type: 'jsonb', default: '[]' })
  affectedServiceIds: string[];

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId: string | null;

  @Column({ name: 'incident_id', type: 'uuid', nullable: true })
  incidentId: string | null; // Link to internal incident if applicable

  @Column({ name: 'is_scheduled', type: 'boolean', default: false })
  isScheduled: boolean; // For scheduled maintenance announcements

  @Column({ name: 'scheduled_start', type: 'timestamp', nullable: true })
  scheduledStart: Date | null;

  @Column({ name: 'scheduled_end', type: 'timestamp', nullable: true })
  scheduledEnd: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => StatusPage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'status_page_id' })
  statusPage: StatusPage;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'author_id' })
  author: User | null;
}
