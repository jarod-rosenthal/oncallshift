import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AIWorkerTask } from './AIWorkerTask';

export type AIWorkerTaskRunOutcome = 'success' | 'failed' | 'timeout' | 'killed' | 'cancelled';

@Entity('ai_worker_task_runs')
export class AIWorkerTaskRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @Column({ name: 'run_number', type: 'int' })
  runNumber: number;

  @Column({ type: 'varchar', length: 30 })
  outcome: AIWorkerTaskRunOutcome;

  @Column({ name: 'started_at', type: 'timestamp', default: () => 'NOW()' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'error_category', type: 'varchar', length: 50, nullable: true })
  errorCategory: string | null;

  @Column({ name: 'captured_context', type: 'text', nullable: true })
  capturedContext: string | null;

  // ECS task tracking for this run
  @Column({ name: 'ecs_task_arn', type: 'varchar', length: 500, nullable: true })
  ecsTaskArn: string | null;

  @Column({ name: 'ecs_task_id', type: 'varchar', length: 100, nullable: true })
  ecsTaskId: string | null;

  // Cost tracking for this run
  @Column({ name: 'claude_input_tokens', type: 'int', default: 0 })
  claudeInputTokens: number;

  @Column({ name: 'claude_output_tokens', type: 'int', default: 0 })
  claudeOutputTokens: number;

  @Column({ name: 'ecs_task_seconds', type: 'int', default: 0 })
  ecsTaskSeconds: number;

  @Column({ name: 'estimated_cost_usd', type: 'decimal', precision: 10, scale: 4, default: 0 })
  estimatedCostUsd: number;

  // Files modified during this run
  @Column({ name: 'files_modified', type: 'jsonb', default: '[]' })
  filesModified: string[];

  // Git state at end of run
  @Column({ name: 'git_branch', type: 'varchar', length: 255, nullable: true })
  gitBranch: string | null;

  @Column({ name: 'git_commit_sha', type: 'varchar', length: 40, nullable: true })
  gitCommitSha: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => AIWorkerTask, task => task.runs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: AIWorkerTask;

  // Helper methods
  isSuccess(): boolean {
    return this.outcome === 'success';
  }

  isFailed(): boolean {
    return ['failed', 'timeout', 'killed'].includes(this.outcome);
  }

  calculateCost(): number {
    // Claude Sonnet pricing: $0.003/1K input, $0.015/1K output
    const claudeCost = (this.claudeInputTokens / 1000) * 0.003 +
                       (this.claudeOutputTokens / 1000) * 0.015;

    // Fargate Spot pricing: ~$0.04/hour for 2 vCPU, 4GB
    const ecsCost = (this.ecsTaskSeconds / 3600) * 0.04;

    return claudeCost + ecsCost;
  }

  getDurationFormatted(): string {
    if (!this.durationSeconds) return 'N/A';
    const minutes = Math.floor(this.durationSeconds / 60);
    const seconds = this.durationSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  }
}
