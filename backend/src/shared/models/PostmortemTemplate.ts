import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';

export interface PostmortemTemplateSection {
  id: string;
  title: string;
  prompt: string; // Helper text / question to guide the user
  required: boolean;
  order: number;
}

/**
 * PostmortemTemplate - Reusable templates for postmortem structure
 *
 * Defines the sections and questions to guide postmortem creation.
 * Organizations can create custom templates or use defaults.
 */
@Entity('postmortem_templates')
export class PostmortemTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Sections define the structure of the postmortem
  @Column({ type: 'jsonb', default: '[]' })
  sections: PostmortemTemplateSection[];

  // Mark one template as default for the organization
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;
}
