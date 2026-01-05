import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from "typeorm";
import { Organization } from "./Organization";
import { AIWorkerTask } from "./AIWorkerTask";
import { AIWorkerPatternApplication } from "./AIWorkerPatternApplication";

export type PatternType = "error_recovery" | "best_practice" | "anti_pattern";
export type PatternStatus = "active" | "deprecated" | "pending_review";

export interface TriggerConditions {
  error_contains?: string[];
  command_contains?: string[];
  platform?: string;
  [key: string]: unknown;
}

@Entity("ai_worker_tool_patterns")
@Index(["orgId"])
@Index(["toolName"])
@Index(["status"])
export class AIWorkerToolPattern {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "org_id", type: "uuid", nullable: true })
  orgId: string | null; // null = global pattern

  // Pattern identification
  @Column({ name: "pattern_type", type: "varchar", length: 30 })
  patternType: PatternType;

  @Column({ name: "tool_name", type: "varchar", length: 100 })
  toolName: string;

  @Column({ name: "error_type", type: "varchar", length: 50, nullable: true })
  errorType: string | null;

  // Pattern content
  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ name: "trigger_conditions", type: "jsonb", default: {} })
  triggerConditions: TriggerConditions;

  @Column({ name: "recommended_approach", type: "text" })
  recommendedApproach: string;

  // Effectiveness tracking
  @Column({
    name: "effectiveness_score",
    type: "decimal",
    precision: 3,
    scale: 2,
    default: 0,
  })
  effectivenessScore: number;

  @Column({ name: "times_applied", type: "int", default: 0 })
  timesApplied: number;

  @Column({ name: "times_succeeded", type: "int", default: 0 })
  timesSucceeded: number;

  // Lifecycle
  @Column({ type: "varchar", length: 20, default: "active" })
  status: PatternStatus;

  @Column({ name: "source_task_id", type: "uuid", nullable: true })
  sourceTaskId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "org_id" })
  organization: Organization | null;

  @ManyToOne(() => AIWorkerTask, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "source_task_id" })
  sourceTask: AIWorkerTask | null;

  @OneToMany(() => AIWorkerPatternApplication, (app) => app.pattern)
  applications: AIWorkerPatternApplication[];

  // Helper methods
  isGlobal(): boolean {
    return this.orgId === null;
  }

  isActive(): boolean {
    return this.status === "active";
  }

  isEffective(): boolean {
    return this.effectivenessScore >= 0.5;
  }

  updateEffectiveness(): void {
    if (this.timesApplied === 0) {
      this.effectivenessScore = 0;
    } else {
      this.effectivenessScore = this.timesSucceeded / this.timesApplied;
    }
  }

  recordApplication(succeeded: boolean): void {
    this.timesApplied++;
    if (succeeded) {
      this.timesSucceeded++;
    }
    this.updateEffectiveness();

    // Auto-deprecate if effectiveness drops below 50% after 10+ applications
    if (this.timesApplied >= 10 && this.effectivenessScore < 0.5) {
      this.status = "deprecated";
    }
  }

  matchesContext(context: {
    toolName?: string;
    errorMessage?: string;
    command?: string;
    platform?: string;
  }): boolean {
    // Must match tool name
    if (context.toolName && this.toolName !== context.toolName) {
      return false;
    }

    const conditions = this.triggerConditions;

    // Check error_contains
    if (conditions.error_contains && context.errorMessage) {
      const matches = conditions.error_contains.some((phrase) =>
        context.errorMessage!.toLowerCase().includes(phrase.toLowerCase()),
      );
      if (!matches) return false;
    }

    // Check command_contains
    if (conditions.command_contains && context.command) {
      const matches = conditions.command_contains.some((phrase) =>
        context.command!.toLowerCase().includes(phrase.toLowerCase()),
      );
      if (!matches) return false;
    }

    // Check platform
    if (conditions.platform && context.platform) {
      if (conditions.platform !== context.platform) return false;
    }

    return true;
  }

  toMarkdown(): string {
    const effectiveness = Math.round(this.effectivenessScore * 100);
    return `### ${this.title}
${this.description}

**Recommended approach:** ${this.recommendedApproach}

*(Effectiveness: ${effectiveness}%)*`;
  }
}
