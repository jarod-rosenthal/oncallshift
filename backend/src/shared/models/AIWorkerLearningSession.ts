import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Organization } from "./Organization";
import { AIWorkerTask } from "./AIWorkerTask";

export type LearningTrigger =
  | "task_completion"
  | "error_threshold"
  | "manual"
  | "scheduled";
export type LearningSessionStatus =
  | "pending"
  | "analyzing"
  | "completed"
  | "failed";

export interface LearningAnalysisResponse {
  patterns?: Array<{
    type: "error_recovery" | "best_practice" | "anti_pattern";
    tool_name: string;
    error_type?: string;
    title: string;
    description: string;
    recommended_approach: string;
  }>;
  directive_suggestions?: Array<{
    directive_path: string;
    section: string;
    content: string;
    reason: string;
  }>;
  environment_suggestions?: Array<{
    type: "dockerfile" | "execution_script" | "tool_install";
    file_path: string;
    change: string;
    reason: string;
  }>;
  summary?: string;
}

@Entity("ai_worker_learning_sessions")
@Index(["taskId"])
@Index(["orgId"])
@Index(["status"])
export class AIWorkerLearningSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "task_id", type: "uuid" })
  taskId: string;

  @Column({ name: "org_id", type: "uuid" })
  orgId: string;

  // Analysis metadata
  @Column({ name: "triggered_by", type: "varchar", length: 30 })
  triggeredBy: LearningTrigger;

  @Column({ name: "analysis_model", type: "varchar", length: 50 })
  analysisModel: string;

  // Analysis results
  @Column({ name: "tool_events_analyzed", type: "int" })
  toolEventsAnalyzed: number;

  @Column({ name: "retry_sequences_found", type: "int", default: 0 })
  retrySequencesFound: number;

  @Column({ name: "patterns_extracted", type: "int", default: 0 })
  patternsExtracted: number;

  @Column({ name: "directive_updates_suggested", type: "int", default: 0 })
  directiveUpdatesSuggested: number;

  @Column({ name: "environment_updates_suggested", type: "int", default: 0 })
  environmentUpdatesSuggested: number;

  // Raw analysis
  @Column({ name: "analysis_prompt", type: "text", nullable: true })
  analysisPrompt: string | null;

  @Column({ name: "analysis_response", type: "jsonb", nullable: true })
  analysisResponse: LearningAnalysisResponse | null;

  // Actions taken
  @Column({ name: "patterns_created", type: "uuid", array: true, default: [] })
  patternsCreated: string[];

  @Column({
    name: "directive_prs_created",
    type: "text",
    array: true,
    default: [],
  })
  directivePrsCreated: string[];

  @Column({
    name: "environment_prs_created",
    type: "text",
    array: true,
    default: [],
  })
  environmentPrsCreated: string[];

  // Cost tracking
  @Column({ name: "input_tokens", type: "int", default: 0 })
  inputTokens: number;

  @Column({ name: "output_tokens", type: "int", default: 0 })
  outputTokens: number;

  // Status
  @Column({ type: "varchar", length: 20, default: "pending" })
  status: LearningSessionStatus;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage: string | null;

  @Column({ name: "started_at", type: "timestamp with time zone", nullable: true })
  startedAt: Date | null;

  @Column({
    name: "completed_at",
    type: "timestamp with time zone",
    nullable: true,
  })
  completedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  // Relations
  @ManyToOne(() => AIWorkerTask, { onDelete: "CASCADE" })
  @JoinColumn({ name: "task_id" })
  task: AIWorkerTask;

  @ManyToOne(() => Organization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "org_id" })
  organization: Organization;

  // Helper methods
  isComplete(): boolean {
    return this.status === "completed" || this.status === "failed";
  }

  hasLearnings(): boolean {
    return (
      this.patternsExtracted > 0 ||
      this.directiveUpdatesSuggested > 0 ||
      this.environmentUpdatesSuggested > 0
    );
  }

  getDurationMs(): number | null {
    if (!this.startedAt || !this.completedAt) return null;
    return this.completedAt.getTime() - this.startedAt.getTime();
  }

  calculateCost(): number {
    // Haiku pricing per 1K tokens
    const inputCostPer1K = 0.0008;
    const outputCostPer1K = 0.004;

    return (
      (this.inputTokens / 1000) * inputCostPer1K +
      (this.outputTokens / 1000) * outputCostPer1K
    );
  }

  start(): void {
    this.status = "analyzing";
    this.startedAt = new Date();
  }

  complete(response: LearningAnalysisResponse): void {
    this.status = "completed";
    this.completedAt = new Date();
    this.analysisResponse = response;
    this.patternsExtracted = response.patterns?.length || 0;
    this.directiveUpdatesSuggested = response.directive_suggestions?.length || 0;
    this.environmentUpdatesSuggested =
      response.environment_suggestions?.length || 0;
  }

  fail(error: string): void {
    this.status = "failed";
    this.completedAt = new Date();
    this.errorMessage = error;
  }
}
