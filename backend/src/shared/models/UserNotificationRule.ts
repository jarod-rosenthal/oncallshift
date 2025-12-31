import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';
import { UserContactMethod } from './UserContactMethod';

export type NotificationUrgency = 'high' | 'low' | 'any';

@Entity('user_notification_rules')
export class UserNotificationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'contact_method_id', type: 'uuid' })
  contactMethodId: string;

  @Column({ type: 'varchar', length: 20 })
  urgency: NotificationUrgency;

  @Column({ name: 'start_delay_minutes', type: 'int', default: 0 })
  startDelayMinutes: number;

  @Column({ name: 'rule_order', type: 'int', default: 0 })
  ruleOrder: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => UserContactMethod, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_method_id' })
  contactMethod: UserContactMethod;

  /**
   * Check if this rule applies to a given urgency level
   */
  appliesTo(urgency: 'high' | 'low'): boolean {
    return this.urgency === 'any' || this.urgency === urgency;
  }

  /**
   * Get description for this rule
   */
  getDescription(): string {
    const urgencyText = this.urgency === 'any' ? 'all' : this.urgency;
    const delayText = this.startDelayMinutes === 0
      ? 'immediately'
      : `after ${this.startDelayMinutes} minute(s)`;

    return `For ${urgencyText} urgency incidents, notify ${delayText}`;
  }
}
