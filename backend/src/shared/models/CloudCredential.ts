import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';

export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'anthropic' | 'openai' | 'google';
export type AIProvider = 'anthropic' | 'openai' | 'google';
export type CloudPermissionLevel = 'read_only' | 'read_write';

export interface AnthropicCredentials {
  api_key: string;
}

export interface OpenAICredentials {
  api_key: string;
  organization_id?: string; // Optional org ID for OpenAI
}

export interface GoogleAICredentials {
  api_key: string;
}

export interface AWSCredentials {
  // Access key based authentication
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  // Role-based authentication (recommended)
  aws_role_arn?: string;
  external_id?: string;
  // Common
  aws_region: string;
}

export interface AzureCredentials {
  client_id: string;
  client_secret: string;
  tenant_id: string;
  subscription_id: string;
}

export interface GCPCredentials {
  // Service account key JSON
  service_account_json: string;
  project_id: string;
}

export type CloudCredentialData =
  | AWSCredentials
  | AzureCredentials
  | GCPCredentials
  | AnthropicCredentials
  | OpenAICredentials
  | GoogleAICredentials;

@Entity('cloud_credentials')
export class CloudCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  // Cloud provider
  @Column({ type: 'varchar', length: 20 })
  provider: CloudProvider;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Credential data (encrypted)
  @Column({ name: 'credentials_encrypted', type: 'text' })
  credentialsEncrypted: string;

  // Access control
  @Column({ name: 'permission_level', type: 'varchar', length: 20, default: 'read_only' })
  permissionLevel: CloudPermissionLevel;

  @Column({ name: 'allowed_services', type: 'jsonb', default: '[]' })
  allowedServices: string[];

  // Time-based restrictions
  @Column({ name: 'max_session_duration_minutes', type: 'int', default: 60 })
  maxSessionDurationMinutes: number;

  @Column({ name: 'require_approval_for_write', type: 'boolean', default: true })
  requireApprovalForWrite: boolean;

  // Audit trail
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'last_used_by', type: 'uuid', nullable: true })
  lastUsedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'last_used_by' })
  lastUsedBy: User | null;

  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount: number;

  // Status
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Helper method to get provider display name
  getProviderDisplayName(): string {
    switch (this.provider) {
      case 'aws':
        return 'Amazon Web Services';
      case 'azure':
        return 'Microsoft Azure';
      case 'gcp':
        return 'Google Cloud Platform';
      case 'anthropic':
        return 'Anthropic (Claude AI)';
      case 'openai':
        return 'OpenAI (GPT)';
      case 'google':
        return 'Google AI (Gemini)';
      default:
        return this.provider;
    }
  }

  // Check if credential supports role-based access (more secure)
  isRoleBased(): boolean {
    if (this.provider === 'aws') {
      // We can't check the actual credentials since they're encrypted
      // This would be determined at decryption time
      return true; // Assume role-based for display purposes
    }
    return false; // Azure and GCP use service principals/accounts
  }
}
