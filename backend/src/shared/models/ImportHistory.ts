import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';

/**
 * Source type for imports
 */
export type ImportSourceType = 'pagerduty' | 'opsgenie' | 'screenshot' | 'natural_language';

/**
 * Content type being imported
 */
export type ImportContentType = 'schedule' | 'escalation' | 'team' | 'service' | 'auto' | 'mixed';

/**
 * Import status
 */
export type ImportStatus =
  | 'pending'
  | 'analyzing'
  | 'preview'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rolled_back';

/**
 * Input data stored for an import attempt
 */
export interface ImportInputData {
  imageMetadata?: {
    size: number;
    mimeType: string;
    dimensions?: { width: number; height: number };
  };
  naturalLanguageInput?: string;
  sourceType: ImportSourceType;
  contentType?: ImportContentType;
}

/**
 * Result of AI extraction from screenshot or natural language
 */
export interface ImportExtraction {
  confidence: number;
  sourceDetected: 'pagerduty' | 'opsgenie' | 'unknown';
  teams: Array<{
    name: string;
    members: Array<{ name: string; email?: string; role?: string }>;
  }>;
  schedules: Array<{
    name: string;
    teamName?: string;
    timezone?: string;
    rotationType: 'daily' | 'weekly' | 'custom';
    handoffTime?: string;
    handoffDay?: string;
    participants: Array<{ name: string; email?: string }>;
    layers?: Array<{
      name: string;
      rotationType: string;
      participants: string[];
    }>;
  }>;
  escalationPolicies: Array<{
    name: string;
    steps: Array<{
      delayMinutes: number;
      targets: Array<{ type: 'user' | 'schedule'; name: string }>;
    }>;
  }>;
  services: Array<{
    name: string;
    description?: string;
    escalationPolicyName?: string;
    teamName?: string;
  }>;
  warnings: string[];
  suggestions: string[];
}

/**
 * Result of import execution
 */
export interface ImportExecutionResult {
  success: boolean;
  createdResources: {
    teams: Array<{ id: string; name: string }>;
    users: Array<{ id: string; email: string }>;
    schedules: Array<{ id: string; name: string }>;
    escalationPolicies: Array<{ id: string; name: string }>;
    services: Array<{ id: string; name: string }>;
  };
  skippedResources: Array<{ type: string; name: string; reason: string }>;
  failedResources: Array<{ type: string; name: string; error: string }>;
  rollbackPerformed: boolean;
}

@Entity('import_history')
export class ImportHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'org_id' })
  orgId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({
    name: 'source_type',
    type: 'varchar',
    length: 50,
  })
  sourceType!: ImportSourceType;

  @Column({
    name: 'content_type',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  contentType?: ImportContentType;

  @Column({ name: 'input_data', type: 'jsonb', default: {} })
  inputData!: ImportInputData;

  @Column({ name: 'extraction_result', type: 'jsonb', nullable: true })
  extractionResult?: ImportExtraction;

  @Column({ name: 'execution_result', type: 'jsonb', nullable: true })
  executionResult?: ImportExecutionResult;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'pending',
  })
  status!: ImportStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization?: Organization;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /**
   * Check if the import is in a terminal state
   */
  isComplete(): boolean {
    return ['completed', 'failed', 'rolled_back'].includes(this.status);
  }

  /**
   * Check if the import can be executed (is in preview state)
   */
  canExecute(): boolean {
    return this.status === 'preview' && this.extractionResult != null;
  }

  /**
   * Get a summary of the extraction for display
   */
  getExtractionSummary(): string {
    if (!this.extractionResult) {
      return 'No extraction results available';
    }

    const parts: string[] = [];
    const { teams, schedules, escalationPolicies, services } = this.extractionResult;

    if (teams.length > 0) {
      parts.push(`${teams.length} team${teams.length > 1 ? 's' : ''}`);
    }
    if (schedules.length > 0) {
      parts.push(`${schedules.length} schedule${schedules.length > 1 ? 's' : ''}`);
    }
    if (escalationPolicies.length > 0) {
      parts.push(`${escalationPolicies.length} escalation polic${escalationPolicies.length > 1 ? 'ies' : 'y'}`);
    }
    if (services.length > 0) {
      parts.push(`${services.length} service${services.length > 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
      return 'No resources detected';
    }

    return `Detected: ${parts.join(', ')}`;
  }

  /**
   * Get a summary of the execution result
   */
  getExecutionSummary(): string {
    if (!this.executionResult) {
      return 'No execution results available';
    }

    const { createdResources, skippedResources, failedResources } = this.executionResult;
    const created =
      createdResources.teams.length +
      createdResources.users.length +
      createdResources.schedules.length +
      createdResources.escalationPolicies.length +
      createdResources.services.length;

    const parts: string[] = [];
    parts.push(`${created} created`);

    if (skippedResources.length > 0) {
      parts.push(`${skippedResources.length} skipped`);
    }
    if (failedResources.length > 0) {
      parts.push(`${failedResources.length} failed`);
    }

    return parts.join(', ');
  }
}
