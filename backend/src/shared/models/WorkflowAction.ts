import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { IncidentWorkflow } from './IncidentWorkflow';

export type ActionType =
  | 'add_responders'       // Add specific users as responders
  | 'add_on_call'          // Add current on-call from a schedule
  | 'subscribe_users'      // Subscribe users to incident updates
  | 'subscribe_team'       // Subscribe entire team to incident updates
  | 'set_conference_bridge' // Set a conference bridge URL
  | 'post_to_slack'        // Post to Slack channel
  | 'post_to_teams'        // Post to Microsoft Teams
  | 'webhook'              // Call external webhook
  | 'set_priority'         // Change incident priority
  | 'add_note';            // Add a note to the incident

// Type-specific configuration interfaces
export interface AddRespondersConfig {
  userIds: string[];
  message?: string;
}

export interface AddOnCallConfig {
  scheduleIds: string[];
  message?: string;
}

export interface SubscribeUsersConfig {
  userIds: string[];
}

export interface SubscribeTeamConfig {
  teamIds: string[];
}

export interface SetConferenceBridgeConfig {
  url: string;
  meetingId?: string;
  passcode?: string;
}

export interface PostToSlackConfig {
  integrationId: string; // Reference to Slack integration
  channel?: string;      // Optional: override default channel
  message?: string;      // Custom message template
}

export interface PostToTeamsConfig {
  integrationId: string; // Reference to Teams integration
  channel?: string;      // Optional: override default channel
  message?: string;      // Custom message template
}

export interface WorkflowWebhookConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  bodyTemplate?: string; // JSON template with placeholders
}

export interface SetPriorityConfig {
  priorityId: string;
}

export interface AddNoteConfig {
  noteTemplate: string; // Note content with placeholders
}

export type ActionConfig =
  | AddRespondersConfig
  | AddOnCallConfig
  | SubscribeUsersConfig
  | SubscribeTeamConfig
  | SetConferenceBridgeConfig
  | PostToSlackConfig
  | PostToTeamsConfig
  | WorkflowWebhookConfig
  | SetPriorityConfig
  | AddNoteConfig;

@Entity('workflow_actions')
export class WorkflowAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_id', type: 'uuid' })
  workflowId: string;

  @Column({ name: 'action_order', type: 'int', default: 0 })
  actionOrder: number;

  @Column({ name: 'action_type', type: 'varchar', length: 50 })
  actionType: ActionType;

  @Column({ type: 'jsonb' })
  config: ActionConfig;

  // Optional: condition to check before executing this specific action
  @Column({ name: 'condition_field', type: 'varchar', length: 255, nullable: true })
  conditionField: string | null;

  @Column({ name: 'condition_operator', type: 'varchar', length: 50, nullable: true })
  conditionOperator: string | null;

  @Column({ name: 'condition_value', type: 'varchar', length: 255, nullable: true })
  conditionValue: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => IncidentWorkflow, workflow => workflow.actions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: IncidentWorkflow;

  // Helper methods
  getActionLabel(): string {
    const labels: Record<ActionType, string> = {
      add_responders: 'Add Responders',
      add_on_call: 'Add On-Call',
      subscribe_users: 'Subscribe Users',
      subscribe_team: 'Subscribe Team',
      set_conference_bridge: 'Set Conference Bridge',
      post_to_slack: 'Post to Slack',
      post_to_teams: 'Post to Teams',
      webhook: 'Call Webhook',
      set_priority: 'Set Priority',
      add_note: 'Add Note',
    };
    return labels[this.actionType] || this.actionType;
  }

  /**
   * Replace placeholders in a template with incident values
   * Supported placeholders: {{incident.id}}, {{incident.summary}}, {{incident.severity}}, etc.
   */
  static interpolateTemplate(template: string, incident: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const parts = path.trim().split('.');
      let value: any = { incident };

      for (const part of parts) {
        if (value === null || value === undefined) {
          return match; // Return original placeholder if path not found
        }
        value = value[part];
      }

      return value !== null && value !== undefined ? String(value) : match;
    });
  }

  /**
   * Check if this action has a condition that needs evaluation
   */
  hasCondition(): boolean {
    return !!(this.conditionField && this.conditionOperator);
  }

  /**
   * Evaluate action-level condition
   */
  shouldExecute(incident: Record<string, any>): boolean {
    if (!this.hasCondition()) {
      return true;
    }

    const fieldValue = this.getNestedValue(incident, this.conditionField!);

    switch (this.conditionOperator) {
      case 'equals':
        return String(fieldValue) === this.conditionValue;
      case 'not_equals':
        return String(fieldValue) !== this.conditionValue;
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;
      default:
        return true;
    }
  }

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
