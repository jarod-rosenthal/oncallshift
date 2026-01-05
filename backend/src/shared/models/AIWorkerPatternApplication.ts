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
import { AIWorkerToolPattern } from "./AIWorkerToolPattern";

@Entity("ai_worker_pattern_applications")
@Index(["patternId"])
@Index(["taskId"])
export class AIWorkerPatternApplication {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "pattern_id", type: "uuid" })
  patternId: string;

  @Column({ name: "task_id", type: "uuid" })
  taskId: string;

  @Column({ name: "org_id", type: "uuid" })
  orgId: string;

  // Application context
  @Column({ name: "injected_at", type: "timestamp with time zone" })
  injectedAt: Date;

  // Effectiveness tracking (updated after task completes)
  @Column({ name: "task_completed", type: "boolean", default: false })
  taskCompleted: boolean;

  @Column({ name: "pattern_tool_used", type: "boolean", nullable: true })
  patternToolUsed: boolean | null;

  @Column({ name: "pattern_helped", type: "boolean", nullable: true })
  patternHelped: boolean | null;

  // Verification
  @Column({
    name: "verified_at",
    type: "timestamp with time zone",
    nullable: true,
  })
  verifiedAt: Date | null;

  @Column({ name: "verification_notes", type: "text", nullable: true })
  verificationNotes: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  // Relations
  @ManyToOne(() => AIWorkerToolPattern, (pattern) => pattern.applications, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "pattern_id" })
  pattern: AIWorkerToolPattern;

  @ManyToOne(() => AIWorkerTask, { onDelete: "CASCADE" })
  @JoinColumn({ name: "task_id" })
  task: AIWorkerTask;

  @ManyToOne(() => Organization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "org_id" })
  organization: Organization;

  // Helper methods
  isVerified(): boolean {
    return this.verifiedAt !== null;
  }

  isPending(): boolean {
    return !this.taskCompleted;
  }

  wasEffective(): boolean | null {
    if (!this.isVerified()) return null;
    return this.patternHelped === true;
  }

  verify(toolUsed: boolean, helped: boolean, notes?: string): void {
    this.taskCompleted = true;
    this.patternToolUsed = toolUsed;
    this.patternHelped = helped;
    this.verifiedAt = new Date();
    if (notes) {
      this.verificationNotes = notes;
    }
  }

  static async createForTask(
    taskId: string,
    orgId: string,
    patterns: AIWorkerToolPattern[],
  ): Promise<AIWorkerPatternApplication[]> {
    const now = new Date();
    return patterns.map((pattern) => {
      const app = new AIWorkerPatternApplication();
      app.patternId = pattern.id;
      app.taskId = taskId;
      app.orgId = orgId;
      app.injectedAt = now;
      app.taskCompleted = false;
      return app;
    });
  }
}
