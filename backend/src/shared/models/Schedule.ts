import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './Organization';

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, default: 'manual' })
  type: 'manual' | 'daily' | 'weekly'; // MVP: manual only, Phase 3: daily/weekly rotations

  @Column({ name: 'timezone', type: 'varchar', length: 100, default: 'UTC' })
  timezone: string;

  @Column({ name: 'current_oncall_user_id', type: 'uuid', nullable: true })
  currentOncallUserId: string | null; // MVP: manually set

  @Column({ name: 'override_user_id', type: 'uuid', nullable: true })
  overrideUserId: string | null; // For "take on-call" feature

  @Column({ name: 'override_until', type: 'timestamp', nullable: true })
  overrideUntil: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  rotation_config: Record<string, any> | null; // For Phase 3: rotation rules

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  // Helper method to get current on-call user ID
  getCurrentOncallUserId(): string | null {
    // Check for override first
    if (this.overrideUserId && this.overrideUntil && this.overrideUntil > new Date()) {
      return this.overrideUserId;
    }
    return this.currentOncallUserId;
  }
}
