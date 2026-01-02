import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Organization } from './Organization';
import { Runbook } from './Runbook';
import { Incident } from './Incident';
import { User } from './User';
import { AIConversation } from './AIConversation';

export type RunbookExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'requires_approval';

export type RunbookApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface StepResult {
  stepId: string;
  stepIndex: number;
  status: 'success' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  exitCode?: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface ExecutionContext {
  incidentId: string;
  incidentNumber: number;
  severity: string;
  serviceName?: string;
  credentialIds?: string[];
  environment?: Record<string, string>;
}

@Entity('runbook_executions')
export class RunbookExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'runbook_id', type: 'uuid' })
  runbookId: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  // Execution tracking
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: RunbookExecutionStatus;

  @Column({ name: 'current_step_index', type: 'int', default: 0 })
  currentStepIndex: number;

  // Executor information
  @Column({ name: 'started_by', type: 'uuid' })
  startedById: string;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  // Results
  @Column({ name: 'step_results', type: 'jsonb', default: '[]' })
  stepResults: StepResult[];

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  // Claude integration
  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId: string | null;

  // Metadata
  @Column({ name: 'execution_context', type: 'jsonb', nullable: true })
  executionContext: ExecutionContext | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Runbook, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'runbook_id' })
  runbook: Runbook;

  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'started_by' })
  startedBy: User;

  @ManyToOne(() => AIConversation, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: AIConversation | null;

  @OneToMany(() => RunbookExecutionApproval, approval => approval.execution)
  approvals: RunbookExecutionApproval[];

  // Helper method to check if execution is in progress
  isInProgress(): boolean {
    return this.status === 'running' || this.status === 'requires_approval';
  }

  // Helper method to check if execution is complete
  isComplete(): boolean {
    return this.status === 'completed' || this.status === 'failed' || this.status === 'cancelled';
  }

  // Calculate total duration
  getDurationMs(): number | null {
    if (!this.completedAt) return null;
    return this.completedAt.getTime() - this.startedAt.getTime();
  }
}

@Entity('runbook_execution_approvals')
export class RunbookExecutionApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'execution_id', type: 'uuid' })
  executionId: string;

  @Column({ name: 'step_index', type: 'int' })
  stepIndex: number;

  // Approval details
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: RunbookApprovalStatus;

  @Column({ name: 'requested_at', type: 'timestamp' })
  requestedAt: Date;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedById: string;

  @Column({ name: 'responded_at', type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'responded_by', type: 'uuid', nullable: true })
  respondedById: string | null;

  @Column({ name: 'response_notes', type: 'text', nullable: true })
  responseNotes: string | null;

  // Script details for approval
  @Column({ name: 'script_language', type: 'varchar', length: 50, nullable: true })
  scriptLanguage: string | null;

  @Column({ name: 'script_code', type: 'text', nullable: true })
  scriptCode: string | null;

  @Column({ name: 'script_description', type: 'text', nullable: true })
  scriptDescription: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => RunbookExecution, execution => execution.approvals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution: RunbookExecution;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by' })
  requestedBy: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'responded_by' })
  respondedBy: User | null;

  // Helper method to check if approval is pending
  isPending(): boolean {
    return this.status === 'pending';
  }
}
