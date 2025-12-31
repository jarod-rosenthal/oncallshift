import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { Service } from './Service';
import { Incident } from './Incident';

export type AlertStatus = 'triggered' | 'suppressed' | 'grouped';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @Column({ name: 'incident_id', type: 'uuid', nullable: true })
  incidentId: string | null;

  @Column({ name: 'dedup_key', type: 'varchar', length: 500, nullable: true })
  dedupKey: string | null;

  @Column({ name: 'alert_key', type: 'varchar', length: 500, nullable: true })
  alertKey: string | null;

  @Column({ type: 'varchar', length: 1000 })
  summary: string;

  @Column({ type: 'varchar', length: 20 })
  severity: AlertSeverity;

  @Column({ type: 'varchar', length: 255, nullable: true })
  source: string | null;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'triggered' })
  status: AlertStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @ManyToOne(() => Incident, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident | null;

  /**
   * Generate a content hash for similarity comparison
   */
  getContentHash(): string {
    const content = {
      summary: this.summary?.toLowerCase().trim(),
      severity: this.severity,
      source: this.source,
    };
    return JSON.stringify(content);
  }

  /**
   * Check if this alert is similar to another alert
   */
  isSimilarTo(other: Alert, fields?: string[]): boolean {
    if (fields && fields.length > 0) {
      // Content-based comparison using specific fields
      for (const field of fields) {
        const thisValue = this.getNestedValue(field);
        const otherValue = other.getNestedValue(field);
        if (thisValue !== otherValue) {
          return false;
        }
      }
      return true;
    }

    // Default: compare summaries for similarity (simple approach)
    return this.getContentHash() === other.getContentHash();
  }

  /**
   * Get a nested value from payload using dot notation
   */
  private getNestedValue(path: string): any {
    // Check top-level fields first
    if (path === 'summary') return this.summary;
    if (path === 'severity') return this.severity;
    if (path === 'source') return this.source;
    if (path === 'dedupKey') return this.dedupKey;

    // Check payload for nested fields
    const parts = path.replace('details.', '').split('.');
    let current: any = this.payload;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }
}
