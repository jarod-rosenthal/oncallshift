import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Integration } from './Integration';

@Entity('integration_oauth_tokens')
export class IntegrationOAuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'integration_id', type: 'uuid' })
  integrationId: string;

  @Column({ name: 'access_token_encrypted', type: 'text' })
  accessTokenEncrypted: string;

  @Column({ name: 'refresh_token_encrypted', type: 'text', nullable: true })
  refreshTokenEncrypted: string | null;

  @Column({ name: 'token_type', type: 'varchar', length: 50, default: 'Bearer' })
  tokenType: string;

  @Column({ type: 'text', nullable: true })
  scope: string | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'last_refreshed_at', type: 'timestamp', nullable: true })
  lastRefreshedAt: Date | null;

  @Column({ name: 'refresh_error', type: 'text', nullable: true })
  refreshError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Integration)
  @JoinColumn({ name: 'integration_id' })
  integration: Integration;

  // Helper methods
  isExpired(): boolean {
    if (!this.expiresAt) return false;
    // Consider expired if less than 5 minutes remaining
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return new Date(this.expiresAt) < fiveMinutesFromNow;
  }

  needsRefresh(): boolean {
    if (!this.refreshTokenEncrypted) return false;
    return this.isExpired();
  }
}
