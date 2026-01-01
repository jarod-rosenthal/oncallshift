import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { Incident } from './Incident';
import { User } from './User';

export type PostmortemStatus = 'draft' | 'in_review' | 'published';

export interface PostmortemActionItem {
  id: string;
  description: string;
  assignedTo?: string; // User ID
  dueDate?: string; // ISO date string
  completed: boolean;
  completedAt?: string; // ISO date string
}

export interface PostmortemTimelineEntry {
  timestamp: string; // ISO date string
  event: string;
  description?: string;
}

/**
 * Postmortem - Incident retrospective documentation
 *
 * Captures root cause analysis, timeline, and action items for resolved incidents.
 * Compatible with PagerDuty Postmortems feature.
 */
@Entity('postmortems')
export class Postmortem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: PostmortemStatus;

  // Executive summary
  @Column({ type: 'text', nullable: true })
  summary: string | null;

  // Detailed timeline of events
  @Column({ type: 'jsonb', default: '[]' })
  timeline: PostmortemTimelineEntry[];

  // Root cause analysis
  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause: string | null;

  // Contributing factors (JSON array)
  @Column({ name: 'contributing_factors', type: 'jsonb', default: '[]' })
  contributingFactors: string[];

  // Impact assessment
  @Column({ type: 'text', nullable: true })
  impact: string | null;

  // What went well
  @Column({ name: 'what_went_well', type: 'text', nullable: true })
  whatWentWell: string | null;

  // What could be improved
  @Column({ name: 'what_could_be_improved', type: 'text', nullable: true })
  whatCouldBeImproved: string | null;

  // Action items to prevent recurrence
  @Column({ name: 'action_items', type: 'jsonb', default: '[]' })
  actionItems: PostmortemActionItem[];

  // Custom sections (for template-based postmortems)
  @Column({ name: 'custom_sections', type: 'jsonb', nullable: true })
  customSections: Record<string, string> | null;

  // Template used (if any)
  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId: string | null;

  // Creator
  @Column({ name: 'created_by', type: 'uuid' })
  createdById: string;

  // Publication tracking
  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'published_by' })
  publishedBy: User | null;
}
