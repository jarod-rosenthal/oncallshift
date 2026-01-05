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

export type ToolCategory = "file" | "shell" | "search" | "git" | "api" | "other";
export type ErrorType =
  | "permission"
  | "timeout"
  | "not_found"
  | "syntax"
  | "git"
  | "network"
  | "auth"
  | null;

@Entity("ai_worker_tool_events")
@Index(["taskId"])
@Index(["orgId"])
@Index(["toolName"])
export class AIWorkerToolEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "task_id", type: "uuid" })
  taskId: string;

  @Column({ name: "org_id", type: "uuid" })
  orgId: string;

  // Tool identification
  @Column({ name: "tool_name", type: "varchar", length: 100 })
  toolName: string;

  @Column({ name: "tool_category", type: "varchar", length: 50, nullable: true })
  toolCategory: ToolCategory | null;

  // Execution details
  @Column({ name: "input_summary", type: "text", nullable: true })
  inputSummary: string | null;

  @Column({ name: "input_hash", type: "varchar", length: 64, nullable: true })
  inputHash: string | null;

  @Column({ name: "output_summary", type: "text", nullable: true })
  outputSummary: string | null;

  // Result tracking
  @Column({ type: "boolean" })
  success: boolean;

  @Column({ name: "error_type", type: "varchar", length: 50, nullable: true })
  errorType: ErrorType;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage: string | null;

  // Sequencing
  @Column({ name: "sequence_number", type: "int" })
  sequenceNumber: number;

  @Column({ name: "attempt_number", type: "int", default: 1 })
  attemptNumber: number;

  // Timing
  @Column({ name: "started_at", type: "timestamp with time zone" })
  startedAt: Date;

  @Column({ name: "completed_at", type: "timestamp with time zone" })
  completedAt: Date;

  @Column({ name: "duration_ms", type: "int" })
  durationMs: number;

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
  isRetry(): boolean {
    return this.attemptNumber > 1;
  }

  getDurationSeconds(): number {
    return this.durationMs / 1000;
  }

  static classifyError(errorMessage: string): ErrorType {
    const lowerError = errorMessage.toLowerCase();

    if (
      lowerError.includes("permission denied") ||
      lowerError.includes("eacces") ||
      lowerError.includes("operation not permitted")
    ) {
      return "permission";
    }

    if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
      return "timeout";
    }

    if (
      lowerError.includes("not found") ||
      lowerError.includes("no such file") ||
      lowerError.includes("enoent") ||
      lowerError.includes("command not found")
    ) {
      return "not_found";
    }

    if (
      lowerError.includes("syntax error") ||
      lowerError.includes("unexpected token") ||
      lowerError.includes("parse error")
    ) {
      return "syntax";
    }

    if (
      lowerError.includes("git") ||
      lowerError.includes("fatal:") ||
      lowerError.includes("merge conflict")
    ) {
      return "git";
    }

    if (
      lowerError.includes("network") ||
      lowerError.includes("econnrefused") ||
      lowerError.includes("enotfound") ||
      lowerError.includes("connection refused")
    ) {
      return "network";
    }

    if (
      lowerError.includes("unauthorized") ||
      lowerError.includes("403") ||
      lowerError.includes("401") ||
      lowerError.includes("authentication")
    ) {
      return "auth";
    }

    return null;
  }

  static classifyToolCategory(toolName: string): ToolCategory {
    const fileTools = ["Read", "Write", "Edit", "NotebookEdit"];
    const shellTools = ["Bash", "KillShell"];
    const searchTools = ["Glob", "Grep", "WebSearch", "WebFetch"];
    const gitTools = ["Task"]; // Task often used for git operations

    if (fileTools.includes(toolName)) return "file";
    if (shellTools.includes(toolName)) return "shell";
    if (searchTools.includes(toolName)) return "search";
    if (gitTools.includes(toolName)) return "other";

    // Check for git commands in Bash
    return "other";
  }
}
