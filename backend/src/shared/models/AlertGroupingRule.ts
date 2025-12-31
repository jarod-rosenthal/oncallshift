import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Service } from './Service';

export type GroupingType = 'intelligent' | 'time' | 'content' | 'disabled';

@Entity('alert_grouping_rules')
export class AlertGroupingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @Column({ name: 'grouping_type', type: 'varchar', length: 50, default: 'intelligent' })
  groupingType: GroupingType;

  @Column({ name: 'time_window_minutes', type: 'int', default: 5 })
  timeWindowMinutes: number;

  @Column({ name: 'content_fields', type: 'text', array: true, default: [] })
  contentFields: string[];

  @Column({ name: 'dedup_key_template', type: 'varchar', length: 500, nullable: true })
  dedupKeyTemplate: string | null;

  @Column({ name: 'max_alerts_per_incident', type: 'int', default: 1000 })
  maxAlertsPerIncident: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  /**
   * Generate dedup key from template and alert data
   */
  generateDedupKey(alertData: Record<string, any>): string | null {
    if (!this.dedupKeyTemplate) {
      return null;
    }

    let key = this.dedupKeyTemplate;

    // Replace ${field} placeholders with actual values
    const placeholders = key.match(/\$\{([^}]+)\}/g);
    if (placeholders) {
      for (const placeholder of placeholders) {
        const field = placeholder.slice(2, -1); // Remove ${ and }
        const value = this.getNestedValue(alertData, field);
        key = key.replace(placeholder, String(value || ''));
      }
    }

    return key;
  }

  /**
   * Check if grouping should be applied
   */
  shouldGroup(): boolean {
    return this.groupingType !== 'disabled';
  }

  /**
   * Get time window in milliseconds
   */
  getTimeWindowMs(): number {
    return this.timeWindowMinutes * 60 * 1000;
  }

  /**
   * Get description of the grouping configuration
   */
  getDescription(): string {
    switch (this.groupingType) {
      case 'intelligent':
        return `Intelligent grouping within ${this.timeWindowMinutes} minutes`;
      case 'time':
        return `Time-based grouping within ${this.timeWindowMinutes} minute windows`;
      case 'content':
        return `Content-based grouping by: ${this.contentFields.join(', ') || 'none'}`;
      case 'disabled':
        return 'Grouping disabled - each alert creates a new incident';
      default:
        return 'Unknown grouping type';
    }
  }

  /**
   * Get a nested value from an object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }
}
