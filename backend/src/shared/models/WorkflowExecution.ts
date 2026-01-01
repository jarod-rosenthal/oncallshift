import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { IncidentWorkflow } from './IncidentWorkflow';
import { Incident } from './Incident';
import { User } from './User';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial';

export interface ActionResult {
  actionId: string;
  actionType: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
  error?: string;
  executedAt: string;
}

@Entity('workflow_executions')
export class WorkflowExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_id', type: 'uuid' })
  workflowId: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ExecutionStatus;

  // What triggered this execution
  @Column({ name: 'trigger_type', type: 'varchar', length: 50 })
  triggerType: 'manual' | 'automatic';

  @Column({ name: 'trigger_event', type: 'varchar', length: 100, nullable: true })
  triggerEvent: string | null; // e.g., 'incident.created'

  // Who triggered it (for manual triggers)
  @Column({ name: 'triggered_by', type: 'uuid', nullable: true })
  triggeredBy: string | null;

  // Results of each action
  @Column({ name: 'action_results', type: 'jsonb', default: [] })
  actionResults: ActionResult[];

  // Error message if overall execution failed
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  // Relations
  @ManyToOne(() => IncidentWorkflow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: IncidentWorkflow;

  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'triggered_by' })
  triggeredByUser: User | null;

  // Helper methods
  start(): void {
    this.status = 'running';
    this.startedAt = new Date();
  }

  complete(): void {
    this.status = 'completed';
    this.completedAt = new Date();
  }

  fail(message: string): void {
    this.status = 'failed';
    this.errorMessage = message;
    this.completedAt = new Date();
  }

  markPartial(): void {
    this.status = 'partial';
    this.completedAt = new Date();
  }

  addActionResult(result: ActionResult): void {
    this.actionResults.push(result);
  }

  getSuccessCount(): number {
    return this.actionResults.filter(r => r.status === 'success').length;
  }

  getFailureCount(): number {
    return this.actionResults.filter(r => r.status === 'failed').length;
  }

  getSkippedCount(): number {
    return this.actionResults.filter(r => r.status === 'skipped').length;
  }

  getDurationMs(): number | null {
    if (!this.startedAt || !this.completedAt) return null;
    return this.completedAt.getTime() - this.startedAt.getTime();
  }
}
