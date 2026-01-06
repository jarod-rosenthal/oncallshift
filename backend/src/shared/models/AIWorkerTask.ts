import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Organization } from "./Organization";
import { AIWorkerInstance } from "./AIWorkerInstance";
import { AIWorkerTaskLog } from "./AIWorkerTaskLog";
import { AIWorkerConversation } from "./AIWorkerConversation";
import { AIWorkerApproval } from "./AIWorkerApproval";
import { AIWorkerTaskRun } from "./AIWorkerTaskRun";
import {
  calculateTotalCost,
  type TokenUsage,
} from "../config/pricing";

export type AIWorkerPersona =
  | "frontend_developer"
  | "backend_developer"
  | "devops_engineer"
  | "security_engineer"
  | "qa_engineer"
  | "tech_writer"
  | "project_manager"
  | "manager";

export type AIWorkerTaskStatus =
  | "queued" // Waiting in queue
  | "dispatching" // Watcher spawning ECS task (transient, prevents duplicate spawns)
  | "claimed" // Worker picked up task
  | "environment_setup" // Fargate task starting
  | "executing" // Claude agent running
  | "pr_created" // PR created, awaiting review
  | "manager_review" // Virtual Manager reviewing PR
  | "revision_needed" // Manager requested changes, worker picks back up
  | "review_pending" // Waiting for human approval (fallback)
  | "review_approved" // Approved, merging
  | "review_rejected" // Rejected, needs changes
  | "completed" // Successfully finished
  | "failed" // Error occurred
  | "blocked" // Cannot proceed (missing info, etc.)
  | "cancelled"; // Manually cancelled

@Entity("ai_worker_tasks")
export class AIWorkerTask {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "org_id", type: "uuid" })
  orgId: string;

  // Jira task reference
  @Column({ name: "jira_issue_key", type: "varchar", length: 50 })
  jiraIssueKey: string; // e.g., "OCS-123"

  @Column({ name: "jira_issue_id", type: "varchar", length: 50 })
  jiraIssueId: string;

  @Column({ name: "jira_project_key", type: "varchar", length: 20 })
  jiraProjectKey: string;

  @Column({ name: "jira_project_type", type: "varchar", length: 50 })
  jiraProjectType: string; // 'software', 'service_desk', 'business'

  @Column({ name: "jira_issue_type", type: "varchar", length: 50 })
  jiraIssueType: string; // 'Story', 'Bug', 'Task', 'Epic', etc.

  // Task content from Jira
  @Column({ type: "varchar", length: 500 })
  summary: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ name: "jira_fields", type: "jsonb", default: "{}" })
  jiraFields: Record<string, any>; // Full Jira issue fields

  // Worker assignment
  @Column({ name: "worker_persona", type: "varchar", length: 50 })
  workerPersona: AIWorkerPersona;

  @Column({ name: "assigned_worker_id", type: "uuid", nullable: true })
  assignedWorkerId: string | null;

  // Execution state
  @Column({ type: "varchar", length: 30, default: "queued" })
  status: AIWorkerTaskStatus;

  @Column({ type: "int", default: 3 })
  priority: number; // 1=highest, 5=lowest

  // GitHub integration
  @Column({ name: "github_repo", type: "varchar", length: 255 })
  githubRepo: string; // e.g., "owner/repo"

  @Column({
    name: "github_branch",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  githubBranch: string | null;

  @Column({ name: "github_pr_number", type: "int", nullable: true })
  githubPrNumber: number | null;

  @Column({
    name: "github_pr_url",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  githubPrUrl: string | null;

  // ECS task tracking (replaces Codespace)
  @Column({
    name: "ecs_task_arn",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  ecsTaskArn: string | null;

  @Column({ name: "ecs_task_id", type: "varchar", length: 100, nullable: true })
  ecsTaskId: string | null;

  // Cost tracking
  @Column({ name: "claude_input_tokens", type: "int", default: 0 })
  claudeInputTokens: number;

  @Column({ name: "claude_output_tokens", type: "int", default: 0 })
  claudeOutputTokens: number;

  @Column({ name: "claude_cache_creation_tokens", type: "int", default: 0 })
  claudeCacheCreationTokens: number;

  @Column({ name: "claude_cache_read_tokens", type: "int", default: 0 })
  claudeCacheReadTokens: number;

  @Column({ name: "ecs_task_seconds", type: "int", default: 0 })
  ecsTaskSeconds: number;

  @Column({
    name: "estimated_cost_usd",
    type: "decimal",
    precision: 10,
    scale: 4,
    default: 0,
  })
  estimatedCostUsd: number;

  // Idempotency: prevent double-reporting of usage
  @Column({ name: "usage_reported_at", type: "timestamptz", nullable: true })
  usageReportedAt: Date | null;

  // Execution metadata
  @Column({ name: "started_at", type: "timestamp", nullable: true })
  startedAt: Date | null;

  @Column({ name: "completed_at", type: "timestamp", nullable: true })
  completedAt: Date | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage: string | null;

  @Column({ name: "retry_count", type: "int", default: 0 })
  retryCount: number;

  @Column({ name: "max_retries", type: "int", default: 3 })
  maxRetries: number;

  // Self-recovery fields
  @Column({ name: "last_heartbeat_at", type: "timestamp", nullable: true })
  lastHeartbeatAt: Date | null;

  @Column({ name: "previous_run_context", type: "text", nullable: true })
  previousRunContext: string | null;

  @Column({ name: "global_timeout_at", type: "timestamp", nullable: true })
  globalTimeoutAt: Date | null;

  @Column({ name: "next_retry_at", type: "timestamp", nullable: true })
  nextRetryAt: Date | null;

  @Column({ name: "retry_backoff_seconds", type: "int", default: 60 })
  retryBackoffSeconds: number;

  @Column({
    name: "failure_category",
    type: "varchar",
    length: 50,
    nullable: true,
  })
  failureCategory: string | null;

  @Column({ name: "watcher_notes", type: "text", nullable: true })
  watcherNotes: string | null;

  // Virtual Manager review fields
  @Column({ name: "review_requested_at", type: "timestamp", nullable: true })
  reviewRequestedAt: Date | null;

  @Column({ name: "reviewer_manager_id", type: "uuid", nullable: true })
  reviewerManagerId: string | null;

  @Column({ name: "review_feedback", type: "text", nullable: true })
  reviewFeedback: string | null;

  @Column({
    name: "review_decision",
    type: "varchar",
    length: 50,
    nullable: true,
  })
  reviewDecision: string | null; // 'approved', 'revision_needed', 'rejected'

  @Column({ name: "code_quality_score", type: "int", nullable: true })
  codeQualityScore: number | null; // 1-10 score from manager

  @Column({ name: "revision_count", type: "int", default: 0 })
  revisionCount: number;

  @Column({
    name: "worker_model",
    type: "varchar",
    length: 50,
    default: "claude-sonnet-4-20250514",
  })
  workerModel: string;

  @Column({
    name: "manager_review_model",
    type: "varchar",
    length: 50,
    nullable: true,
  })
  managerReviewModel: string | null;

  // Manager ECS task tracking (runs in ECS like workers)
  @Column({
    name: "manager_ecs_task_arn",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  managerEcsTaskArn: string | null;

  @Column({
    name: "manager_ecs_task_id",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  managerEcsTaskId: string | null;

  @Column({ name: "skip_manager_review", type: "boolean", default: true })
  skipManagerReview: boolean;

  @Column({ name: "self_anneal_count", type: "int", default: 0 })
  selfAnnealCount: number;

  // Learning system fields
  @Column({ name: "tool_error_count", type: "int", default: 0 })
  toolErrorCount: number;

  @Column({ name: "tool_retry_count", type: "int", default: 0 })
  toolRetryCount: number;

  @Column({ name: "learning_analyzed", type: "boolean", default: false })
  learningAnalyzed: boolean;

  @Column({ name: "patterns_applied", type: "jsonb", default: [] })
  patternsApplied: string[]; // Array of pattern IDs

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "org_id" })
  organization: Organization;

  @ManyToOne(() => AIWorkerInstance, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assigned_worker_id" })
  assignedWorker: AIWorkerInstance | null;

  @OneToMany(() => AIWorkerTaskLog, (log) => log.task)
  logs: AIWorkerTaskLog[];

  @OneToMany(() => AIWorkerConversation, (conv) => conv.task)
  conversations: AIWorkerConversation[];

  @OneToMany(() => AIWorkerApproval, (approval) => approval.task)
  approvals: AIWorkerApproval[];

  @OneToMany(() => AIWorkerTaskRun, (run) => run.task)
  runs: AIWorkerTaskRun[];

  // Helper methods
  isActive(): boolean {
    return ["claimed", "environment_setup", "executing"].includes(this.status);
  }

  isComplete(): boolean {
    return ["completed", "failed", "cancelled"].includes(this.status);
  }

  canRetry(): boolean {
    return this.status === "failed" && this.retryCount < this.maxRetries;
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
    // Use shared pricing config for consistent cost calculation
    const tokens: TokenUsage = {
      inputTokens: this.claudeInputTokens,
      outputTokens: this.claudeOutputTokens,
      cacheCreationTokens: this.claudeCacheCreationTokens,
      cacheReadTokens: this.claudeCacheReadTokens,
    };
    return calculateTotalCost(tokens, this.workerModel || "sonnet", this.ecsTaskSeconds);
  }

  /**
   * Get token usage as a structured object
   */
  getTokenUsage(): TokenUsage {
    return {
      inputTokens: this.claudeInputTokens,
      outputTokens: this.claudeOutputTokens,
      cacheCreationTokens: this.claudeCacheCreationTokens,
      cacheReadTokens: this.claudeCacheReadTokens,
    };
  }

  // Self-recovery helper methods
  isStuck(): boolean {
    if (!this.isActive() || !this.lastHeartbeatAt) return false;
    // 3-minute timeout for fast cleanup
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    return this.lastHeartbeatAt < threeMinutesAgo;
  }

  isGloballyTimedOut(): boolean {
    if (!this.globalTimeoutAt) return false;
    return new Date() > this.globalTimeoutAt;
  }

  isReadyForRetry(): boolean {
    if (!this.nextRetryAt) return false;
    return new Date() >= this.nextRetryAt && this.canRetry();
  }

  getNextBackoffSeconds(): number {
    // Exponential backoff: 60s, 120s, 240s, 480s, 960s, 1920s, 3600s (max 1hr)
    const nextBackoff = this.retryBackoffSeconds * 2;
    return Math.min(nextBackoff, 3600); // Cap at 1 hour
  }

  scheduleRetry(): { nextRetryAt: Date; backoffSeconds: number } {
    const backoffSeconds = this.getNextBackoffSeconds();
    const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);
    return { nextRetryAt, backoffSeconds };
  }

  // Virtual Manager helper methods
  needsManagerReview(): boolean {
    return this.status === "pr_created" && this.githubPrUrl !== null;
  }

  isUnderManagerReview(): boolean {
    return this.status === "manager_review";
  }

  needsRevision(): boolean {
    return this.status === "revision_needed";
  }

  requestManagerReview(): void {
    this.status = "manager_review";
    this.reviewRequestedAt = new Date();
  }

  approveByManager(managerId: string, feedback: string): void {
    this.status = "review_approved";
    this.reviewerManagerId = managerId;
    this.reviewFeedback = feedback;
  }

  requestRevision(managerId: string, feedback: string): void {
    this.status = "revision_needed";
    this.reviewerManagerId = managerId;
    this.reviewFeedback = feedback;
    this.revisionCount++;
  }

  rejectByManager(managerId: string, feedback: string): void {
    this.status = "review_rejected";
    this.reviewerManagerId = managerId;
    this.reviewFeedback = feedback;
  }

  // Learning system helper methods
  needsLearningAnalysis(): boolean {
    // Analyze tasks that had errors or retries, and haven't been analyzed yet
    return (
      !this.learningAnalyzed &&
      this.isComplete() &&
      (this.toolErrorCount > 0 || this.toolRetryCount > 0)
    );
  }

  hasJiraReviewLabel(): boolean {
    // Check if the Jira issue has the 'review' label (triggers PR review)
    const labels = this.jiraFields?.labels || [];
    return labels.includes("review");
  }

  hasJiraManagerLabel(): boolean {
    // Check if the Jira issue has the 'manager' label (triggers learning analysis)
    const labels = this.jiraFields?.labels || [];
    return labels.includes("manager");
  }
}
