import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { IncidentReport } from './IncidentReport';
import { User } from './User';

export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';

/**
 * Report Data Structure
 */
export interface ReportData {
  period: {
    start: string;
    end: string;
    durationDays: number;
  };
  summary: {
    totalIncidents: number;
    byState: Record<string, number>;
    bySeverity: Record<string, number>;
    avgTimeToAcknowledge: number; // seconds
    avgTimeToResolve: number;     // seconds
  };
  services?: Array<{
    id: string;
    name: string;
    incidentCount: number;
    avgResolutionTime: number;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    incidentCount: number;
    avgResolutionTime: number;
  }>;
  responders?: Array<{
    id: string;
    name: string;
    incidentsHandled: number;
    avgAcknowledgeTime: number;
    avgResolveTime: number;
  }>;
  rcas?: Array<{
    incidentId: string;
    incidentNumber: number;
    summary: string;
    severity: string;
    resolvedAt: string;
    rca: string;
    preventiveMeasures?: string;
  }>;
  trends?: {
    dailyCounts: Array<{ date: string; count: number }>;
    severityTrend: Array<{ date: string; severity: string; count: number }>;
  };
}

/**
 * ReportExecution - Tracks report generation runs
 *
 * Stores the output of each report run for historical reference
 * and audit purposes.
 */
@Entity('report_executions')
export class ReportExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ReportStatus;

  // Period covered by this report
  @Column({ name: 'period_start', type: 'timestamp' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamp' })
  periodEnd: Date;

  // Report data (JSON)
  @Column({ type: 'jsonb', nullable: true })
  data: ReportData | null;

  // Delivery status per channel
  @Column({ name: 'delivery_status', type: 'jsonb', default: {} })
  deliveryStatus: Record<string, { sent: boolean; sentAt?: string; error?: string }>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'triggered_by', type: 'uuid', nullable: true })
  triggeredBy: string | null; // User who manually triggered, or null for scheduled

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => IncidentReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: IncidentReport;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'triggered_by' })
  triggeredByUser: User | null;

  // Helper methods

  isComplete(): boolean {
    return this.status === 'completed';
  }

  isFailed(): boolean {
    return this.status === 'failed';
  }

  getDurationSeconds(): number | null {
    if (!this.startedAt || !this.completedAt) {
      return null;
    }
    return Math.floor((this.completedAt.getTime() - this.startedAt.getTime()) / 1000);
  }

  getPeriodDays(): number {
    return Math.floor((this.periodEnd.getTime() - this.periodStart.getTime()) / (24 * 60 * 60 * 1000));
  }

  wasTriggeredManually(): boolean {
    return this.triggeredBy !== null;
  }

  getDeliverySuccessRate(): number {
    const statuses = Object.values(this.deliveryStatus);
    if (statuses.length === 0) return 0;

    const successful = statuses.filter(s => s.sent).length;
    return Math.round((successful / statuses.length) * 100);
  }
}
