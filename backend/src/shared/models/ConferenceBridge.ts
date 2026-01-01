import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Incident } from './Incident';
import { User } from './User';

export type ConferenceBridgeProvider = 'zoom' | 'google_meet' | 'microsoft_teams' | 'manual';
export type ConferenceBridgeStatus = 'creating' | 'active' | 'ended' | 'failed';

/**
 * ConferenceBridge - Tracks conference bridges for incident coordination
 *
 * Similar to PagerDuty's Conference Bridge feature, this allows:
 * - Auto-provisioning of Zoom/Meet/Teams meetings for incidents
 * - Manual entry of existing conference bridge details
 * - Tracking of meeting status and participants
 */
@Entity('conference_bridges')
export class ConferenceBridge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  // Provider type
  @Column({ type: 'varchar', length: 20 })
  provider: ConferenceBridgeProvider;

  // Current status
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: ConferenceBridgeStatus;

  // Meeting details
  @Column({ name: 'meeting_url', type: 'varchar', length: 500 })
  meetingUrl: string;

  @Column({ name: 'meeting_id', type: 'varchar', length: 100, nullable: true })
  meetingId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  passcode: string | null;

  // Dial-in details for phone participants
  @Column({ name: 'dial_in_number', type: 'varchar', length: 50, nullable: true })
  dialInNumber: string | null;

  @Column({ name: 'dial_in_pin', type: 'varchar', length: 20, nullable: true })
  dialInPin: string | null;

  // Provider-specific data (host key, start URL, etc.)
  @Column({ name: 'provider_data', type: 'jsonb', nullable: true })
  providerData: Record<string, any> | null;

  // Who created the bridge
  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  // Tracking
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'participant_count', type: 'int', default: 0 })
  participantCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  // Helper methods
  getProviderLabel(): string {
    switch (this.provider) {
      case 'zoom':
        return 'Zoom';
      case 'google_meet':
        return 'Google Meet';
      case 'microsoft_teams':
        return 'Microsoft Teams';
      case 'manual':
        return 'Manual';
      default:
        return this.provider;
    }
  }

  isActive(): boolean {
    return this.status === 'active';
  }

  getJoinInfo(): { url: string; dialIn?: string; passcode?: string } {
    return {
      url: this.meetingUrl,
      dialIn: this.dialInNumber || undefined,
      passcode: this.passcode || this.dialInPin || undefined,
    };
  }
}
