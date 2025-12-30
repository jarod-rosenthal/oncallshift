import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, BeforeInsert } from 'typeorm';
import { Organization } from './Organization';
import { Schedule } from './Schedule';
import { Incident } from './Incident';
import { EscalationPolicy } from './EscalationPolicy';
import { v4 as uuidv4 } from 'uuid';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

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

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'inactive' | 'maintenance';

  @Column({ name: 'auto_resolve_timeout', type: 'int', nullable: true })
  autoResolveTimeout: number | null; // Minutes

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, org => org.services)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Schedule, { nullable: true })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule | null;

  @ManyToOne(() => EscalationPolicy, policy => policy.services, { nullable: true })
  @JoinColumn({ name: 'escalation_policy_id' })
  escalationPolicy: EscalationPolicy | null;

  @OneToMany(() => Incident, incident => incident.service)
  incidents: Incident[];

  @BeforeInsert()
  generateApiKey() {
    if (!this.apiKey) {
      this.apiKey = `svc_${uuidv4().replace(/-/g, '')}`;
    }
  }
}
