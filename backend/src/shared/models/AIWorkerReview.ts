import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AIWorkerTask } from './AIWorkerTask';
import { AIWorkerInstance } from './AIWorkerInstance';

export type ReviewDecision = 'approved' | 'rejected' | 'revision_needed';

@Entity('ai_worker_reviews')
export class AIWorkerReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId: string | null;

  @Column({ name: 'review_number', type: 'int', default: 1 })
  reviewNumber: number;

  @Column({ type: 'varchar', length: 30 })
  decision: ReviewDecision;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  // What was reviewed
  @Column({ name: 'pr_url', type: 'varchar', length: 500, nullable: true })
  prUrl: string | null;

  @Column({ name: 'pr_diff_summary', type: 'text', nullable: true })
  prDiffSummary: string | null;

  @Column({ name: 'files_reviewed', type: 'jsonb', default: '[]' })
  filesReviewed: string[];

  // AI analysis
  @Column({ name: 'code_quality_score', type: 'int', nullable: true })
  codeQualityScore: number | null;  // 1-10

  @Column({ name: 'test_coverage_assessment', type: 'text', nullable: true })
  testCoverageAssessment: string | null;

  @Column({ name: 'security_concerns', type: 'text', nullable: true })
  securityConcerns: string | null;

  @Column({ name: 'style_issues', type: 'text', nullable: true })
  styleIssues: string | null;

  // Token and cost tracking
  @Column({ name: 'claude_input_tokens', type: 'int', default: 0 })
  claudeInputTokens: number;

  @Column({ name: 'claude_output_tokens', type: 'int', default: 0 })
  claudeOutputTokens: number;

  @Column({ name: 'estimated_cost_usd', type: 'decimal', precision: 10, scale: 4, default: 0 })
  estimatedCostUsd: number;

  // Timing
  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => AIWorkerTask, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: AIWorkerTask;

  @ManyToOne(() => AIWorkerInstance, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_id' })
  manager: AIWorkerInstance | null;

  // Helper methods
  isApproved(): boolean {
    return this.decision === 'approved';
  }

  isRejected(): boolean {
    return this.decision === 'rejected';
  }

  needsRevision(): boolean {
    return this.decision === 'revision_needed';
  }

  calculateCost(): number {
    // Claude Opus 4.5 pricing: $0.015/1K input, $0.075/1K output
    return (this.claudeInputTokens / 1000) * 0.015 +
           (this.claudeOutputTokens / 1000) * 0.075;
  }

  getDurationMinutes(): number | null {
    if (!this.durationSeconds) return null;
    return Math.round(this.durationSeconds / 60);
  }
}
