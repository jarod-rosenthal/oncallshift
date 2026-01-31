import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';

@Entity('organization_api_keys')
export class OrganizationApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string; // e.g., "terraform-provider", "ci-cd-pipeline"

  @Column({ name: 'key_hash', type: 'varchar', length: 255 })
  keyHash: string; // bcrypt hash, never store plaintext

  @Column({ name: 'key_prefix', type: 'varchar', length: 12 })
  keyPrefix: string; // First 12 chars for identification: "org_abc1..."

  @Column({ name: 'scopes', type: 'jsonb', default: '["*"]' })
  scopes: string[]; // ["*"] or ["incidents:read", "services:write"]

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Check if the API key has expired
   */
  isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return this.expiresAt < new Date();
  }

  /**
   * Check if the API key has a specific scope or wildcard access
   */
  hasScope(scope: string): boolean {
    if (this.scopes.includes('*')) {
      return true;
    }
    return this.scopes.includes(scope);
  }

  /**
   * Check if the API key has read access for a resource type
   */
  canRead(resource: string): boolean {
    return this.hasScope('*') || this.hasScope(`${resource}:read`) || this.hasScope(`${resource}:write`);
  }

  /**
   * Check if the API key has write access for a resource type
   */
  canWrite(resource: string): boolean {
    return this.hasScope('*') || this.hasScope(`${resource}:write`);
  }
}
