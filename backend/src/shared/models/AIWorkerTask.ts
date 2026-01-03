import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Organization } from './Organization';
import { AIWorkerInstance } from './AIWorkerInstance';
import { AIWorkerTaskLog } from './AIWorkerTaskLog';
import { AIWorkerConversation } from './AIWorkerConversation';
import { AIWorkerApproval } from './AIWorkerApproval';

export type AIWorkerPersona = 'developer' | 'qa_engineer' | 'devops' | 'tech_writer' | 'support' | 'pm';

export type AIWorkerTaskStatus =
  | 'queued'           // Waiting in queue
  | 'claimed'          // Worker picked up task
  | 'environment_setup' // Fargate task starting
  | 'executing'        // Claude agent running
  | 'pr_created'       // PR created, awaiting review
  | 'review_pending'   // Waiting for human approval
  | 'review_approved'  // Approved, merging
  | 'review_rejected'  // Rejected, needs changes
  | 'completed'        // Successfully finished
  | 'failed'           // Error occurred
  | 'blocked'          // Cannot proceed (missing info, etc.)
  | 'cancelled';       // Manually cancelled

@Entity('ai_worker_tasks')
export class AIWorkerTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  // Jira task reference
  @Column({ name: 'jira_issue_key', type: 'varchar', length: 50 })
  jiraIssueKey: string;  // e.g., "OCS-123"

  @Column({ name: 'jira_issue_id', type: 'varchar', length: 50 })
  jiraIssueId: string;

  @Column({ name: 'jira_project_key', type: 'varchar', length: 20 })
  jiraProjectKey: string;

  @Column({ name: 'jira_project_type', type: 'varchar', length: 50 })
  jiraProjectType: string; // 'software', 'service_desk', 'business'

  @Column({ name: 'jira_issue_type', type: 'varchar', length: 50 })
  jiraIssueType: string;  // 'Story', 'Bug', 'Task', 'Epic', etc.

  // Task content from Jira
  @Column({ type: 'varchar', length: 500 })
  summary: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'jira_fields', type: 'jsonb', default: '{}' })
  jiraFields: Record<string, any>;  // Full Jira issue fields

  // Worker assignment
  @Column({ name: 'worker_persona', type: 'varchar', length: 50 })
  workerPersona: AIWorkerPersona;

  @Column({ name: 'assigned_worker_id', type: 'uuid', nullable: true })
  assignedWorkerId: string | null;

  // Execution state
  @Column({ type: 'varchar', length: 30, default: 'queued' })
  status: AIWorkerTaskStatus;

  @Column({ type: 'int', default: 3 })
  priority: number;  // 1=highest, 5=lowest

  // GitHub integration
  @Column({ name: 'github_repo', type: 'varchar', length: 255 })
  githubRepo: string;  // e.g., "owner/repo"

  @Column({ name: 'github_branch', type: 'varchar', length: 255, nullable: true })
  githubBranch: string | null;

  @Column({ name: 'github_pr_number', type: 'int', nullable: true })
  githubPrNumber: number | null;

  @Column({ name: 'github_pr_url', type: 'varchar', length: 500, nullable: true })
  githubPrUrl: string | null;

  // ECS task tracking (replaces Codespace)
  @Column({ name: 'ecs_task_arn', type: 'varchar', length: 500, nullable: true })
  ecsTaskArn: string | null;

  @Column({ name: 'ecs_task_id', type: 'varchar', length: 100, nullable: true })
  ecsTaskId: string | null;

  // Cost tracking
  @Column({ name: 'claude_input_tokens', type: 'int', default: 0 })
  claudeInputTokens: number;

  @Column({ name: 'claude_output_tokens', type: 'int', default: 0 })
  claudeOutputTokens: number;

  @Column({ name: 'ecs_task_seconds', type: 'int', default: 0 })
  ecsTaskSeconds: number;

  @Column({ name: 'estimated_cost_usd', type: 'decimal', precision: 10, scale: 4, default: 0 })
  estimatedCostUsd: number;

  // Execution metadata
  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', type: 'int', default: 3 })
  maxRetries: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => AIWorkerInstance, { nullable: true })
  @JoinColumn({ name: 'assigned_worker_id' })
  assignedWorker: AIWorkerInstance | null;

  @OneToMany(() => AIWorkerTaskLog, log => log.task)
  logs: AIWorkerTaskLog[];

  @OneToMany(() => AIWorkerConversation, conv => conv.task)
  conversations: AIWorkerConversation[];

  @OneToMany(() => AIWorkerApproval, approval => approval.task)
  approvals: AIWorkerApproval[];

  // Helper methods
  isActive(): boolean {
    return ['claimed', 'environment_setup', 'executing'].includes(this.status);
  }

  isComplete(): boolean {
    return ['completed', 'failed', 'cancelled'].includes(this.status);
  }

  canRetry(): boolean {
    return this.status === 'failed' && this.retryCount < this.maxRetries;
  }

  canCancel(): boolean {
    return !this.isComplete();
  }

  getDurationSeconds(): number | null {
    if (!this.startedAt) return null;
    const endTime = this.completedAt || new Date();
    return Math.floor((endTime.getTime() - this.startedAt.getTime()) / 1000);
  }

  calculateCost(): number {
    // Claude Sonnet pricing: $0.003/1K input, $0.015/1K output
    const claudeCost = (this.claudeInputTokens / 1000) * 0.003 +
                       (this.claudeOutputTokens / 1000) * 0.015;

    // Fargate Spot pricing: ~$0.04/hour for 2 vCPU, 4GB
    const ecsCost = (this.ecsTaskSeconds / 3600) * 0.04;

    return claudeCost + ecsCost;
  }
}
