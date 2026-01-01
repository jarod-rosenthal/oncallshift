import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { Service } from './Service';
import { User } from './User';

export type MatchType = 'all' | 'any';
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

export interface RoutingCondition {
  field: string; // e.g., "source", "summary", "severity", "details.environment"
  operator: ConditionOperator;
  value: string | string[] | boolean | null; // Type depends on operator
}

@Entity('alert_routing_rules')
export class AlertRoutingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'rule_order', type: 'int', default: 0 })
  ruleOrder: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'match_type', type: 'varchar', length: 20, default: 'all' })
  matchType: MatchType;

  @Column({ type: 'jsonb', default: [] })
  conditions: RoutingCondition[];

  @Column({ name: 'target_service_id', type: 'uuid', nullable: true })
  targetServiceId: string | null;

  @Column({ name: 'set_severity', type: 'varchar', length: 20, nullable: true })
  setSeverity: 'info' | 'warning' | 'error' | 'critical' | null;

  // Action: suppress alerts matching this rule (no incident created, no notifications)
  @Column({ type: 'boolean', default: false })
  suppress: boolean;

  // Optional: suspend alerts (create alert but hold incident creation for manual review)
  @Column({ type: 'boolean', default: false })
  suspend: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Service, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'target_service_id' })
  targetService: Service | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  /**
   * Evaluate this rule against an incoming alert payload
   */
  evaluate(alert: Record<string, any>): boolean {
    if (!this.conditions || this.conditions.length === 0) {
      return true; // No conditions = always matches
    }

    const results = this.conditions.map(condition => this.evaluateCondition(condition, alert));

    if (this.matchType === 'all') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  /**
   * Evaluate a single condition against the alert
   */
  private evaluateCondition(condition: RoutingCondition, alert: Record<string, any>): boolean {
    const fieldValue = this.getNestedValue(alert, condition.field);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;

      case 'not_equals':
        return fieldValue !== condition.value;

      case 'contains':
        if (typeof fieldValue !== 'string' || typeof condition.value !== 'string') return false;
        return fieldValue.toLowerCase().includes(condition.value.toLowerCase());

      case 'not_contains':
        if (typeof fieldValue !== 'string' || typeof condition.value !== 'string') return true;
        return !fieldValue.toLowerCase().includes(condition.value.toLowerCase());

      case 'starts_with':
        if (typeof fieldValue !== 'string' || typeof condition.value !== 'string') return false;
        return fieldValue.toLowerCase().startsWith(condition.value.toLowerCase());

      case 'ends_with':
        if (typeof fieldValue !== 'string' || typeof condition.value !== 'string') return false;
        return fieldValue.toLowerCase().endsWith(condition.value.toLowerCase());

      case 'regex':
        if (typeof fieldValue !== 'string' || typeof condition.value !== 'string') return false;
        try {
          const regex = new RegExp(condition.value, 'i');
          return regex.test(fieldValue);
        } catch {
          return false;
        }

      case 'in':
        if (!Array.isArray(condition.value)) return false;
        return condition.value.includes(fieldValue);

      case 'not_in':
        if (!Array.isArray(condition.value)) return true;
        return !condition.value.includes(fieldValue);

      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;

      default:
        return false;
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

  /**
   * Get a human-readable description of this rule
   */
  getDescription(): string {
    if (!this.conditions || this.conditions.length === 0) {
      return 'Match all alerts';
    }

    const conditionDescriptions = this.conditions.map(c => {
      const valueStr = Array.isArray(c.value) ? c.value.join(', ') : String(c.value);
      return `${c.field} ${c.operator.replace('_', ' ')} "${valueStr}"`;
    });

    const connector = this.matchType === 'all' ? ' AND ' : ' OR ';
    return conditionDescriptions.join(connector);
  }
}
