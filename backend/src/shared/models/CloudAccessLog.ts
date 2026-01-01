import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { CloudCredential } from './CloudCredential';
import { Incident } from './Incident';
import { User } from './User';

export interface CommandExecuted {
  command: string;
  timestamp: string;
  success: boolean;
  duration_ms: number;
  output_summary?: string;
  error?: string;
}

export interface AnalysisRecommendation {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  command?: string;
  requires_approval: boolean;
  expected_impact?: string;
  rollback_plan?: string;
  executed?: boolean;
  executed_at?: string;
  executed_by?: string;
}

@Entity('cloud_access_logs')
export class CloudAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ name: 'credential_id', type: 'uuid' })
  credentialId: string;

  @ManyToOne(() => CloudCredential, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'credential_id' })
  credential: CloudCredential;

  @Column({ name: 'incident_id', type: 'uuid', nullable: true })
  incidentId: string | null;

  @ManyToOne(() => Incident, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident | null;

  // Who triggered the access
  @Column({ name: 'triggered_by', type: 'uuid' })
  triggeredById: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'triggered_by' })
  triggeredBy: User;

  // What was accessed
  @Column({ type: 'varchar', length: 20 })
  provider: string;

  @Column({ name: 'commands_executed', type: 'jsonb', default: '[]' })
  commandsExecuted: CommandExecuted[];

  // Analysis results
  @Column({ name: 'analysis_summary', type: 'text', nullable: true })
  analysisSummary: string | null;

  @Column({ name: 'root_cause', type: 'text', nullable: true })
  rootCause: string | null;

  @Column({ name: 'ai_confidence', type: 'varchar', length: 20, nullable: true })
  aiConfidence: 'high' | 'medium' | 'low' | null;

  @Column({ name: 'affected_resources', type: 'jsonb', default: '[]' })
  affectedResources: string[];

  @Column({ type: 'jsonb', default: '[]' })
  evidence: string[];

  @Column({ type: 'jsonb', default: '[]' })
  recommendations: AnalysisRecommendation[];

  // Results
  @Column({ type: 'boolean', default: true })
  success: boolean;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  // Status
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'analyzing' | 'completed' | 'failed';

  // Timing
  @Column({ name: 'session_started_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  sessionStartedAt: Date;

  @Column({ name: 'session_ended_at', type: 'timestamp', nullable: true })
  sessionEndedAt: Date | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Helper to calculate duration
  calculateDuration(): number | null {
    if (this.sessionStartedAt && this.sessionEndedAt) {
      return Math.floor(
        (this.sessionEndedAt.getTime() - this.sessionStartedAt.getTime()) / 1000
      );
    }
    return null;
  }

  // Mark session as complete
  complete(success: boolean, errorMessage?: string): void {
    this.sessionEndedAt = new Date();
    this.durationSeconds = this.calculateDuration();
    this.success = success;
    this.status = success ? 'completed' : 'failed';
    if (errorMessage) {
      this.errorMessage = errorMessage;
    }
  }
}
