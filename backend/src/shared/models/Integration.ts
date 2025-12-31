import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';

export type IntegrationType = 'slack' | 'teams' | 'jira' | 'servicenow' | 'webhook' | 'pagerduty_import';
export type IntegrationStatus = 'pending' | 'active' | 'error' | 'disabled';

export interface IntegrationFeatures {
  incident_sync?: boolean;
  bidirectional?: boolean;
  auto_create_channel?: boolean;
  auto_resolve?: boolean;
  sync_comments?: boolean;
  sync_status?: boolean;
}

export interface SlackConfig {
  default_channel_id?: string;
  notify_on_trigger?: boolean;
  notify_on_acknowledge?: boolean;
  notify_on_resolve?: boolean;
  create_channel_per_incident?: boolean;
}

export interface JiraConfig {
  project_key?: string;
  issue_type?: string;
  priority_mapping?: Record<string, string>;
  status_mapping?: Record<string, string>;
  custom_fields?: Record<string, any>;
}

export interface WebhookConfig {
  events?: string[];
  headers?: Record<string, string>;
  retry_count?: number;
  timeout_ms?: number;
}

@Entity('integrations')
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 50 })
  type: IntegrationType;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: IntegrationStatus;

  // Configuration (type-specific)
  @Column({ type: 'jsonb', default: {} })
  config: SlackConfig | JiraConfig | WebhookConfig | Record<string, any>;

  // Slack-specific
  @Column({ name: 'slack_workspace_id', type: 'varchar', length: 50, nullable: true })
  slackWorkspaceId: string | null;

  @Column({ name: 'slack_workspace_name', type: 'varchar', length: 255, nullable: true })
  slackWorkspaceName: string | null;

  @Column({ name: 'slack_bot_token_encrypted', type: 'text', nullable: true })
  slackBotTokenEncrypted: string | null;

  @Column({ name: 'slack_default_channel_id', type: 'varchar', length: 50, nullable: true })
  slackDefaultChannelId: string | null;

  // Teams-specific
  @Column({ name: 'teams_tenant_id', type: 'varchar', length: 50, nullable: true })
  teamsTenantId: string | null;

  @Column({ name: 'teams_team_id', type: 'varchar', length: 50, nullable: true })
  teamsTeamId: string | null;

  @Column({ name: 'teams_channel_id', type: 'varchar', length: 50, nullable: true })
  teamsChannelId: string | null;

  // Jira-specific
  @Column({ name: 'jira_site_url', type: 'varchar', length: 500, nullable: true })
  jiraSiteUrl: string | null;

  @Column({ name: 'jira_project_key', type: 'varchar', length: 20, nullable: true })
  jiraProjectKey: string | null;

  @Column({ name: 'jira_issue_type', type: 'varchar', length: 50, nullable: true })
  jiraIssueType: string | null;

  // ServiceNow-specific
  @Column({ name: 'servicenow_instance_url', type: 'varchar', length: 500, nullable: true })
  servicenowInstanceUrl: string | null;

  @Column({ name: 'servicenow_table_name', type: 'varchar', length: 100, nullable: true })
  servicenowTableName: string | null;

  // Webhook-specific
  @Column({ name: 'webhook_url', type: 'varchar', length: 2000, nullable: true })
  webhookUrl: string | null;

  @Column({ name: 'webhook_secret', type: 'varchar', length: 255, nullable: true })
  webhookSecret: string | null;

  @Column({ name: 'webhook_headers', type: 'jsonb', nullable: true })
  webhookHeaders: Record<string, string> | null;

  // Feature flags
  @Column({ type: 'jsonb', default: {} })
  features: IntegrationFeatures;

  // Error tracking
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'last_error_at', type: 'timestamp', nullable: true })
  lastErrorAt: Date | null;

  @Column({ name: 'error_count', type: 'int', default: 0 })
  errorCount: number;

  // Metadata
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  // Helper methods
  isActive(): boolean {
    return this.status === 'active';
  }

  isSlack(): boolean {
    return this.type === 'slack';
  }

  isJira(): boolean {
    return this.type === 'jira';
  }

  isWebhook(): boolean {
    return this.type === 'webhook';
  }

  hasFeature(feature: keyof IntegrationFeatures): boolean {
    return this.features[feature] === true;
  }

  recordError(error: string): void {
    this.lastError = error;
    this.lastErrorAt = new Date();
    this.errorCount += 1;
    if (this.errorCount >= 5) {
      this.status = 'error';
    }
  }

  clearError(): void {
    this.lastError = null;
    this.lastErrorAt = null;
    this.errorCount = 0;
    if (this.status === 'error') {
      this.status = 'active';
    }
  }
}
