import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { Service } from './Service';
import { User } from './User';
import { MatchType } from './AlertRoutingRule';

export type RuleAction = 'continue' | 'suppress' | 'route';

export type TransformConditionOperator =
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
  | 'not_exists'
  | 'greater_than'
  | 'less_than';

export interface TransformRuleCondition {
  field: string;
  operator: TransformConditionOperator;
  value: string | string[] | number | boolean | null;
}

export type TransformationType =
  | 'set_field'
  | 'copy_field'
  | 'regex_replace'
  | 'append'
  | 'prepend'
  | 'extract'
  | 'delete_field'
  | 'enrich';

export interface Transformation {
  type: TransformationType;
  field: string;
  value?: string | number | boolean | Record<string, any>;
  source?: string;
  pattern?: string;
  replacement?: string;
}

@Entity('event_transform_rules')
export class EventTransformRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'rule_order', type: 'int', default: 0 })
  ruleOrder: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', default: [] })
  conditions: TransformRuleCondition[];

  @Column({ name: 'match_type', type: 'varchar', length: 10, default: 'all' })
  matchType: MatchType;

  @Column({ type: 'jsonb', default: [] })
  transformations: Transformation[];

  @Column({ type: 'varchar', length: 20, default: 'continue' })
  action: RuleAction;

  @Column({ name: 'route_to_service_id', type: 'uuid', nullable: true })
  routeToServiceId: string | null;

  @Column({ name: 'events_matched', type: 'int', default: 0 })
  eventsMatched: number;

  @Column({ name: 'last_matched_at', type: 'timestamp with time zone', nullable: true })
  lastMatchedAt: Date | null;

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

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @ManyToOne(() => Service, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'route_to_service_id' })
  routeToService: Service | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  /**
   * Evaluate conditions against an event payload
   */
  evaluate(payload: Record<string, any>): boolean {
    if (!this.conditions || this.conditions.length === 0) {
      return true; // No conditions means always match
    }

    const results = this.conditions.map(condition => this.evaluateCondition(condition, payload));

    return this.matchType === 'all'
      ? results.every(r => r)
      : results.some(r => r);
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: TransformRuleCondition, payload: Record<string, any>): boolean {
    const value = this.getNestedValue(payload, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'not_equals':
        return value !== condition.value;

      case 'contains':
        return typeof value === 'string' && typeof condition.value === 'string'
          && value.toLowerCase().includes(condition.value.toLowerCase());

      case 'not_contains':
        return typeof value === 'string' && typeof condition.value === 'string'
          && !value.toLowerCase().includes(condition.value.toLowerCase());

      case 'starts_with':
        return typeof value === 'string' && typeof condition.value === 'string'
          && value.toLowerCase().startsWith(condition.value.toLowerCase());

      case 'ends_with':
        return typeof value === 'string' && typeof condition.value === 'string'
          && value.toLowerCase().endsWith(condition.value.toLowerCase());

      case 'regex':
        try {
          const regex = new RegExp(condition.value as string, 'i');
          return typeof value === 'string' && regex.test(value);
        } catch {
          return false;
        }

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);

      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);

      case 'exists':
        return value !== undefined && value !== null;

      case 'not_exists':
        return value === undefined || value === null;

      case 'greater_than':
        return typeof value === 'number' && typeof condition.value === 'number'
          && value > condition.value;

      case 'less_than':
        return typeof value === 'number' && typeof condition.value === 'number'
          && value < condition.value;

      default:
        return false;
    }
  }

  /**
   * Apply transformations to an event payload
   */
  applyTransformations(payload: Record<string, any>): Record<string, any> {
    const result = { ...payload };

    for (const transform of this.transformations) {
      this.applyTransformation(transform, result);
    }

    return result;
  }

  /**
   * Apply a single transformation
   */
  private applyTransformation(transform: Transformation, payload: Record<string, any>): void {
    switch (transform.type) {
      case 'set_field':
        this.setNestedValue(payload, transform.field, transform.value);
        break;

      case 'copy_field':
        if (transform.source) {
          const sourceValue = this.getNestedValue(payload, transform.source);
          if (sourceValue !== undefined) {
            this.setNestedValue(payload, transform.field, sourceValue);
          }
        }
        break;

      case 'regex_replace':
        if (transform.pattern && transform.replacement !== undefined) {
          const currentValue = this.getNestedValue(payload, transform.field);
          if (typeof currentValue === 'string') {
            try {
              const regex = new RegExp(transform.pattern, 'gi');
              const newValue = currentValue.replace(regex, transform.replacement);
              this.setNestedValue(payload, transform.field, newValue);
            } catch {
              // Invalid regex, skip
            }
          }
        }
        break;

      case 'append':
        if (typeof transform.value === 'string') {
          const currentValue = this.getNestedValue(payload, transform.field);
          if (typeof currentValue === 'string') {
            this.setNestedValue(payload, transform.field, currentValue + transform.value);
          }
        }
        break;

      case 'prepend':
        if (typeof transform.value === 'string') {
          const currentValue = this.getNestedValue(payload, transform.field);
          if (typeof currentValue === 'string') {
            this.setNestedValue(payload, transform.field, transform.value + currentValue);
          }
        }
        break;

      case 'extract':
        if (transform.source && transform.pattern) {
          const sourceValue = this.getNestedValue(payload, transform.source);
          if (typeof sourceValue === 'string') {
            try {
              const regex = new RegExp(transform.pattern);
              const match = sourceValue.match(regex);
              if (match && match[1]) {
                this.setNestedValue(payload, transform.field, match[1]);
              }
            } catch {
              // Invalid regex, skip
            }
          }
        }
        break;

      case 'delete_field':
        this.deleteNestedValue(payload, transform.field);
        break;

      case 'enrich':
        // Add static data to the payload
        if (transform.value && typeof transform.value === 'object') {
          const existingDetails = this.getNestedValue(payload, transform.field) || {};
          this.setNestedValue(payload, transform.field, { ...existingDetails, ...transform.value });
        }
        break;
    }
  }

  /**
   * Get a nested value from an object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set a nested value in an object using dot notation
   */
  private setNestedValue(obj: Record<string, any>, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;

    let current = obj;
    for (const key of keys) {
      if (current[key] === undefined || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[lastKey] = value;
  }

  /**
   * Delete a nested value from an object using dot notation
   */
  private deleteNestedValue(obj: Record<string, any>, path: string): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;

    let current = obj;
    for (const key of keys) {
      if (current[key] === undefined) {
        return; // Path doesn't exist
      }
      current = current[key];
    }

    delete current[lastKey];
  }

  /**
   * Get action label
   */
  getActionLabel(): string {
    switch (this.action) {
      case 'continue':
        return 'Continue Processing';
      case 'suppress':
        return 'Suppress Event';
      case 'route':
        return 'Route to Service';
      default:
        return 'Unknown';
    }
  }
}
