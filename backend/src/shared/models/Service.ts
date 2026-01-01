import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, BeforeInsert } from 'typeorm';
import { Organization } from './Organization';
import { Team } from './Team';
import { Schedule } from './Schedule';
import { Incident } from './Incident';
import { EscalationPolicy } from './EscalationPolicy';
import { BusinessService } from './BusinessService';
import { ServiceDependency } from './ServiceDependency';
import { v4 as uuidv4 } from 'uuid';

export type ServiceUrgency = 'high' | 'low' | 'dynamic';

export interface SupportHours {
  enabled: boolean;
  timezone: string;
  days: number[];  // 0 = Sunday, 6 = Saturday
  startTime: string;  // HH:mm format
  endTime: string;    // HH:mm format
}

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'api_key', type: 'varchar', length: 255, unique: true })
  apiKey: string;

  @Column({ name: 'email_address', type: 'varchar', length: 255, nullable: true, unique: true })
  emailAddress: string | null; // For email-to-incident (Phase 2)

  @Column({ name: 'webhook_secret', type: 'varchar', length: 255, nullable: true })
  webhookSecret: string | null; // HMAC-SHA256 secret for webhook signature verification

  @Column({ name: 'schedule_id', type: 'uuid', nullable: true })
  scheduleId: string | null;

  @Column({ name: 'escalation_policy_id', type: 'uuid', nullable: true })
  escalationPolicyId: string | null;

  @Column({ name: 'business_service_id', type: 'uuid', nullable: true })
  businessServiceId: string | null;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'inactive' | 'maintenance';

  @Column({ name: 'auto_resolve_timeout', type: 'int', nullable: true })
  autoResolveTimeout: number | null; // Minutes

  // Urgency determines notification behavior
  // high = always high urgency, low = always low urgency, dynamic = based on support hours
  @Column({ type: 'varchar', length: 20, default: 'high' })
  urgency: ServiceUrgency;

  // Support hours for dynamic urgency - incidents during support hours are high urgency
  @Column({ name: 'support_hours', type: 'jsonb', nullable: true })
  supportHours: SupportHours | null;

  // Acknowledgement timeout - auto-unack if not resolved within this time (seconds)
  @Column({ name: 'ack_timeout_seconds', type: 'int', nullable: true })
  ackTimeoutSeconds: number | null;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any> | null;

  /**
   * External integration keys from PagerDuty/Opsgenie for zero-config migration.
   * Allows webhooks to be received using original integration keys without reconfiguration.
   * Format: { pagerduty?: string, opsgenie?: string }
   */
  @Column({ name: 'external_keys', type: 'jsonb', nullable: true })
  externalKeys: {
    pagerduty?: string;
    opsgenie?: string;
  } | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, org => org.services)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @ManyToOne(() => Schedule, { nullable: true })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule | null;

  @ManyToOne(() => EscalationPolicy, policy => policy.services, { nullable: true })
  @JoinColumn({ name: 'escalation_policy_id' })
  escalationPolicy: EscalationPolicy | null;

  @OneToMany(() => Incident, incident => incident.service)
  incidents: Incident[];

  @ManyToOne(() => BusinessService, businessService => businessService.services, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'business_service_id' })
  businessService: BusinessService | null;

  // Services this service depends on (this service is the dependent)
  @OneToMany(() => ServiceDependency, dep => dep.dependentService)
  dependsOn: ServiceDependency[];

  // Services that depend on this service (this service is the supporting service)
  @OneToMany(() => ServiceDependency, dep => dep.supportingService)
  dependents: ServiceDependency[];

  @BeforeInsert()
  generateApiKey() {
    if (!this.apiKey) {
      this.apiKey = `svc_${uuidv4().replace(/-/g, '')}`;
    }
  }

  /**
   * Get the effective urgency for an incident on this service
   * If urgency is 'dynamic', check support hours to determine urgency
   */
  getEffectiveUrgency(atTime: Date = new Date()): 'high' | 'low' {
    if (this.urgency === 'high') return 'high';
    if (this.urgency === 'low') return 'low';

    // Dynamic: check if within support hours
    if (this.supportHours?.enabled) {
      return this.isWithinSupportHours(atTime) ? 'high' : 'low';
    }

    // Default to high if no support hours configured
    return 'high';
  }

  /**
   * Check if a given time is within the configured support hours
   */
  isWithinSupportHours(atTime: Date = new Date()): boolean {
    if (!this.supportHours?.enabled) return true;

    const { timezone, days, startTime, endTime } = this.supportHours;

    // Convert to service timezone
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };

    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(atTime);

    const weekdayPart = parts.find(p => p.type === 'weekday');
    const hourPart = parts.find(p => p.type === 'hour');
    const minutePart = parts.find(p => p.type === 'minute');

    if (!weekdayPart || !hourPart || !minutePart) return true;

    // Map weekday string to number (0 = Sunday)
    const weekdayMap: Record<string, number> = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    const dayOfWeek = weekdayMap[weekdayPart.value] ?? 0;

    // Check if this day is a support day
    if (!days.includes(dayOfWeek)) return false;

    // Check if time is within support hours
    const currentTime = `${hourPart.value}:${minutePart.value}`;
    return currentTime >= startTime && currentTime <= endTime;
  }
}
