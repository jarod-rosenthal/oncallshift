import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { Service } from './Service';
import { User } from './User';

export type StepType = 'manual' | 'automated';
export type AutomationMode = 'server_sandbox' | 'claude_code_api' | 'hybrid';
export type ScriptLanguage = 'bash' | 'python' | 'javascript' | 'natural_language';

export interface ScriptDefinition {
  language: ScriptLanguage;
  code: string;
  naturalLanguageDescription?: string;
  generatedAt?: string;
  validatedAt?: string;
  version: number;
}

export interface StepAutomation {
  mode: AutomationMode;
  script?: ScriptDefinition;
  timeout: number; // in seconds
  requiresApproval: boolean;
  idempotencyKey?: string;
  credentialIds?: string[]; // Cloud credentials to inject
}

export interface RunbookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  isOptional: boolean;
  estimatedMinutes?: number;
  type: StepType;
  automation?: StepAutomation;
}

@Entity('runbooks')
export class Runbook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  steps: RunbookStep[];

  @Column({ type: 'varchar', array: true, default: '{}' })
  severity: string[]; // Which severities this applies to, empty = all

  @Column({ type: 'varchar', array: true, default: '{}' })
  tags: string[]; // Tags for matching

  @Column({ name: 'external_url', type: 'varchar', length: 2048, nullable: true })
  externalUrl: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdById: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;
}
