import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AIWorkerTask } from './AIWorkerTask';

export type AIWorkerLogType =
  | 'status_change'       // Task status changed
  | 'command_executed'    // Shell command was run
  | 'file_read'           // File was read
  | 'file_changed'        // File was created/modified
  | 'file_deleted'        // File was deleted
  | 'git_operation'       // Git command (commit, push, etc.)
  | 'pr_created'          // Pull request was created
  | 'pr_updated'          // Pull request was updated
  | 'test_run'            // Tests were executed
  | 'build_run'           // Build was executed
  | 'error'               // Error occurred
  | 'warning'             // Warning issued
  | 'approval_requested'  // Approval was requested
  | 'approval_response'   // Approval was granted/denied
  | 'jira_updated'        // Jira issue was updated
  | 'blocked'             // Task was blocked
  | 'retry'               // Task was retried
  | 'info';               // General information

export type AIWorkerLogSeverity = 'debug' | 'info' | 'warning' | 'error';

@Entity('ai_worker_task_logs')
export class AIWorkerTaskLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @Column({ type: 'varchar', length: 50 })
  type: AIWorkerLogType;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'varchar', length: 20, default: 'info' })
  severity: AIWorkerLogSeverity;

  // For command execution logs
  @Column({ type: 'text', nullable: true })
  command: string | null;

  @Column({ name: 'exit_code', type: 'int', nullable: true })
  exitCode: number | null;

  @Column({ type: 'text', nullable: true })
  stdout: string | null;

  @Column({ type: 'text', nullable: true })
  stderr: string | null;

  // For file operation logs
  @Column({ name: 'file_path', type: 'varchar', length: 500, nullable: true })
  filePath: string | null;

  // Duration of the operation in milliseconds
  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => AIWorkerTask, task => task.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: AIWorkerTask;

  // Helper for creating logs
  static create(
    taskId: string,
    type: AIWorkerLogType,
    message: string,
    options?: {
      severity?: AIWorkerLogSeverity;
      metadata?: Record<string, any>;
      command?: string;
      exitCode?: number;
      stdout?: string;
      stderr?: string;
      filePath?: string;
      durationMs?: number;
    }
  ): Partial<AIWorkerTaskLog> {
    return {
      taskId,
      type,
      message,
      severity: options?.severity || 'info',
      metadata: options?.metadata || null,
      command: options?.command || null,
      exitCode: options?.exitCode ?? null,
      stdout: options?.stdout || null,
      stderr: options?.stderr || null,
      filePath: options?.filePath || null,
      durationMs: options?.durationMs ?? null,
    };
  }
}
