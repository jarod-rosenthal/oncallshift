import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from './Organization';

@Entity('idempotency_keys')
@Index(['orgId', 'key'], { unique: true })
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ name: 'key', type: 'varchar', length: 255 })
  key: string;

  @Column({ name: 'request_path', type: 'varchar', length: 500 })
  requestPath: string;

  @Column({ name: 'request_method', type: 'varchar', length: 10 })
  requestMethod: string;

  @Column({ name: 'response_status', type: 'integer' })
  responseStatus: number;

  @Column({ name: 'response_body', type: 'jsonb' })
  responseBody: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  /**
   * Check if the idempotency key has expired
   */
  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  /**
   * Check if this key matches the incoming request
   */
  matchesRequest(path: string, method: string): boolean {
    return this.requestPath === path && this.requestMethod === method;
  }
}
