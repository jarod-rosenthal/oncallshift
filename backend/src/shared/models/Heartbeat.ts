import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert } from 'typeorm';
import { Organization } from './Organization';
import { Service } from './Service';
import { v4 as uuidv4 } from 'uuid';

export type HeartbeatStatus = 'healthy' | 'unhealthy' | 'expired' | 'unknown';

@Entity('heartbeats')
export class Heartbeat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Unique key for pinging this heartbeat.
   * Format: hb_<uuid> or preserved from Opsgenie import
   */
  @Column({ name: 'heartbeat_key', type: 'varchar', length: 255, unique: true })
  heartbeatKey: string;

  /**
   * Expected interval between pings in seconds.
   * If no ping is received within this interval, status becomes unhealthy.
   */
  @Column({ name: 'interval_seconds', type: 'int', default: 300 })
  intervalSeconds: number;

  /**
   * Number of missed intervals before triggering an incident.
   * Default is 1 (trigger immediately after first missed ping).
   */
  @Column({ name: 'alert_after_missed_count', type: 'int', default: 1 })
  alertAfterMissedCount: number;

  /**
   * Timestamp of the last successful ping.
   */
  @Column({ name: 'last_ping_at', type: 'timestamptz', nullable: true })
  lastPingAt: Date | null;

  /**
   * Current status of the heartbeat.
   * - healthy: Received ping within interval
   * - unhealthy: Missed one or more pings but not yet expired
   * - expired: Missed pings exceed alertAfterMissedCount, incident triggered
   * - unknown: Never received a ping
   */
  @Column({ type: 'varchar', length: 20, default: 'unknown' })
  status: HeartbeatStatus;

  /**
   * Number of consecutive missed pings.
   */
  @Column({ name: 'missed_count', type: 'int', default: 0 })
  missedCount: number;

  /**
   * Whether this heartbeat is actively monitored.
   */
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  /**
   * ID of the incident created when heartbeat expires (if any).
   * Cleared when heartbeat recovers.
   */
  @Column({ name: 'active_incident_id', type: 'uuid', nullable: true })
  activeIncidentId: string | null;

  /**
   * External ID from Opsgenie for import tracking.
   */
  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Service, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_id' })
  service: Service | null;

  @BeforeInsert()
  generateHeartbeatKey() {
    if (!this.heartbeatKey) {
      this.heartbeatKey = `hb_${uuidv4().replace(/-/g, '')}`;
    }
  }

  // Helper methods

  /**
   * Check if the heartbeat has expired based on interval and missed count threshold.
   */
  isExpired(): boolean {
    if (!this.lastPingAt) {
      return false; // Never received a ping, status is 'unknown'
    }
    const now = Date.now();
    const lastPing = this.lastPingAt.getTime();
    const missedIntervals = Math.floor((now - lastPing) / (this.intervalSeconds * 1000));
    return missedIntervals >= this.alertAfterMissedCount;
  }

  /**
   * Check if the heartbeat is healthy (received ping within interval).
   */
  isHealthy(): boolean {
    if (!this.lastPingAt) {
      return false;
    }
    const now = Date.now();
    const lastPing = this.lastPingAt.getTime();
    return (now - lastPing) < (this.intervalSeconds * 1000);
  }

  /**
   * Get the number of missed intervals since last ping.
   */
  getMissedIntervals(): number {
    if (!this.lastPingAt) {
      return 0;
    }
    const now = Date.now();
    const lastPing = this.lastPingAt.getTime();
    return Math.floor((now - lastPing) / (this.intervalSeconds * 1000));
  }

  /**
   * Get time until next expected ping in milliseconds.
   * Returns 0 if already overdue.
   */
  getTimeUntilNextPing(): number {
    if (!this.lastPingAt) {
      return 0;
    }
    const nextExpectedPing = this.lastPingAt.getTime() + (this.intervalSeconds * 1000);
    const remaining = nextExpectedPing - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Update status based on current state.
   */
  updateStatus(): HeartbeatStatus {
    if (!this.lastPingAt) {
      this.status = 'unknown';
    } else if (this.isHealthy()) {
      this.status = 'healthy';
      this.missedCount = 0;
    } else if (this.isExpired()) {
      this.status = 'expired';
      this.missedCount = this.getMissedIntervals();
    } else {
      this.status = 'unhealthy';
      this.missedCount = this.getMissedIntervals();
    }
    return this.status;
  }

  /**
   * Record a ping and update status.
   */
  recordPing(): void {
    this.lastPingAt = new Date();
    this.status = 'healthy';
    this.missedCount = 0;
  }
}
