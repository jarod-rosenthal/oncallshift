import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Organization } from './Organization';
import { AIWorkerTask, AIWorkerPersona } from './AIWorkerTask';

export type AIWorkerStatus = 'idle' | 'working' | 'paused' | 'disabled';

export interface AIWorkerConfig {
  maxConcurrentTasks?: number;
  allowedProjectKeys?: string[];
  allowedIssueTypes?: string[];
  requireApprovalFor?: string[];  // e.g., ['production', 'security', 'infrastructure']
  workingHours?: {
    start: number;   // Hour in 24h format
    end: number;
    timezone: string;
  };
  model?: string;  // Claude model to use (e.g., 'claude-sonnet-4-20250514')
  maxTurns?: number;  // Max Claude turns per task (default 50)
}

@Entity('ai_worker_instances')
export class AIWorkerInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 50 })
  persona: AIWorkerPersona;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName: string;  // e.g., "Alice (Senior Developer)"

  @Column({ type: 'text', nullable: true })
  description: string | null;  // Optional description of worker's specialization

  @Column({ type: 'varchar', length: 30, default: 'idle' })
  status: AIWorkerStatus;

  @Column({ name: 'current_task_id', type: 'uuid', nullable: true })
  currentTaskId: string | null;

  // Worker configuration
  @Column({ type: 'jsonb', default: '{}' })
  config: AIWorkerConfig;

  // Performance metrics
  @Column({ name: 'tasks_completed', type: 'int', default: 0 })
  tasksCompleted: number;

  @Column({ name: 'tasks_failed', type: 'int', default: 0 })
  tasksFailed: number;

  @Column({ name: 'tasks_cancelled', type: 'int', default: 0 })
  tasksCancelled: number;

  @Column({ name: 'avg_completion_time_seconds', type: 'int', nullable: true })
  avgCompletionTimeSeconds: number | null;

  @Column({ name: 'total_tokens_used', type: 'bigint', default: 0 })
  totalTokensUsed: number;

  @Column({ name: 'total_cost_usd', type: 'decimal', precision: 10, scale: 4, default: 0 })
  totalCostUsd: number;

  @Column({ name: 'last_task_at', type: 'timestamp', nullable: true })
  lastTaskAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => AIWorkerTask, { nullable: true })
  @JoinColumn({ name: 'current_task_id' })
  currentTask: AIWorkerTask | null;

  @OneToMany(() => AIWorkerTask, task => task.assignedWorker)
  tasks: AIWorkerTask[];

  // Helper methods
  isAvailable(): boolean {
    return this.status === 'idle' && !this.currentTaskId;
  }

  canTakeTask(): boolean {
    if (this.status === 'paused' || this.status === 'disabled') {
      return false;
    }
    if (this.currentTaskId) {
      return false;
    }
    // Check working hours if configured
    if (this.config.workingHours) {
      const now = new Date();
      const hour = now.getHours(); // TODO: Convert to configured timezone
      if (hour < this.config.workingHours.start || hour >= this.config.workingHours.end) {
        return false;
      }
    }
    return true;
  }

  getSuccessRate(): number {
    const total = this.tasksCompleted + this.tasksFailed;
    if (total === 0) return 0;
    return (this.tasksCompleted / total) * 100;
  }

  getPersonaDisplayName(): string {
    const names: Record<AIWorkerPersona, string> = {
      developer: 'Developer',
      qa_engineer: 'QA Engineer',
      devops: 'DevOps Engineer',
      tech_writer: 'Technical Writer',
      support: 'Support Engineer',
      pm: 'Project Manager',
    };
    return names[this.persona] || this.persona;
  }
}
