import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';
import { WorkflowAction } from './WorkflowAction';

export type TriggerType = 'manual' | 'automatic';
export type TriggerEvent =
  | 'incident.created'
  | 'incident.acknowledged'
  | 'incident.escalated'
  | 'incident.reassigned'
  | 'incident.priority_changed'
  | 'incident.urgency_changed';

export type WorkflowMatchType = 'all' | 'any';
export type WorkflowConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than';

export interface WorkflowCondition {
  field: string; // e.g., "severity", "urgency", "service.name", "priority.name"
  operator: WorkflowConditionOperator;
  value: string | string[] | number | boolean | null;
}

@Entity('incident_workflows')
export class IncidentWorkflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'trigger_type', type: 'varchar', length: 20, default: 'manual' })
  triggerType: TriggerType;

  // For automatic workflows: which events trigger evaluation
  @Column({ name: 'trigger_events', type: 'jsonb', default: [] })
  triggerEvents: TriggerEvent[];

  // Conditions that must match for automatic trigger (empty = always matches)
  @Column({ name: 'match_type', type: 'varchar', length: 20, default: 'all' })
  matchType: WorkflowMatchType;

  @Column({ type: 'jsonb', default: [] })
  conditions: WorkflowCondition[];

  // Optional: limit to specific services
  @Column({ name: 'service_ids', type: 'jsonb', nullable: true })
  serviceIds: string[] | null;

  // Optional: limit to specific teams
  @Column({ name: 'team_ids', type: 'jsonb', nullable: true })
  teamIds: string[] | null;

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

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  @OneToMany(() => WorkflowAction, action => action.workflow, { cascade: true })
  actions: WorkflowAction[];

  // Helper methods
  isManual(): boolean {
    return this.triggerType === 'manual';
  }

  isAutomatic(): boolean {
    return this.triggerType === 'automatic';
  }

  /**
   * Check if this workflow should trigger for a given event and incident
   */
  shouldTrigger(event: TriggerEvent, incident: Record<string, any>): boolean {
    if (!this.enabled) return false;
    if (this.triggerType !== 'automatic') return false;
    if (!this.triggerEvents.includes(event)) return false;

    // Check service filter
    if (this.serviceIds && this.serviceIds.length > 0) {
      if (!this.serviceIds.includes(incident.serviceId)) {
        return false;
      }
    }

    // Check team filter (via service.teamId)
    if (this.teamIds && this.teamIds.length > 0) {
      const serviceTeamId = incident.service?.teamId;
      if (!serviceTeamId || !this.teamIds.includes(serviceTeamId)) {
        return false;
      }
    }

    // Evaluate conditions
    return this.evaluateConditions(incident);
  }

  /**
   * Evaluate all conditions against an incident
   */
  evaluateConditions(incident: Record<string, any>): boolean {
    if (!this.conditions || this.conditions.length === 0) {
      return true; // No conditions = always matches
    }

    const results = this.conditions.map(c => this.evaluateCondition(c, incident));

    if (this.matchType === 'all') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: WorkflowCondition, incident: Record<string, any>): boolean {
    const fieldValue = this.getNestedValue(incident, condition.field);

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

      case 'in':
        if (!Array.isArray(condition.value)) return false;
        return condition.value.includes(fieldValue);

      case 'not_in':
        if (!Array.isArray(condition.value)) return true;
        return !condition.value.includes(fieldValue);

      case 'greater_than':
        if (typeof fieldValue !== 'number' || typeof condition.value !== 'number') return false;
        return fieldValue > condition.value;

      case 'less_than':
        if (typeof fieldValue !== 'number' || typeof condition.value !== 'number') return false;
        return fieldValue < condition.value;

      default:
        return false;
    }
  }

  /**
   * Get nested value using dot notation
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
   * Get a human-readable description of trigger conditions
   */
  getTriggerDescription(): string {
    if (this.triggerType === 'manual') {
      return 'Manually triggered';
    }

    const parts: string[] = [];

    if (this.triggerEvents.length > 0) {
      parts.push(`On: ${this.triggerEvents.join(', ')}`);
    }

    if (this.conditions.length > 0) {
      const condStr = this.conditions.map(c => {
        const valueStr = Array.isArray(c.value) ? c.value.join(', ') : String(c.value);
        return `${c.field} ${c.operator.replace('_', ' ')} "${valueStr}"`;
      });
      const connector = this.matchType === 'all' ? ' AND ' : ' OR ';
      parts.push(`When: ${condStr.join(connector)}`);
    }

    return parts.join(' | ') || 'No conditions';
  }
}
