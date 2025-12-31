import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './User';
import { UserNotificationRule } from './UserNotificationRule';

export type ContactMethodType = 'email' | 'sms' | 'phone' | 'push';

@Entity('user_contact_methods')
export class UserContactMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  type: ContactMethodType;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ name: 'verification_code', type: 'varchar', length: 10, nullable: true })
  verificationCode: string | null;

  @Column({ name: 'verification_sent_at', type: 'timestamptz', nullable: true })
  verificationSentAt: Date | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => UserNotificationRule, rule => rule.contactMethod)
  notificationRules: UserNotificationRule[];

  /**
   * Get display name for this contact method
   */
  getDisplayName(): string {
    if (this.label) return this.label;

    switch (this.type) {
      case 'email':
        return this.address;
      case 'sms':
      case 'phone':
        return `${this.type.toUpperCase()}: ${this.address}`;
      case 'push':
        return 'Push Notification';
      default:
        return this.address;
    }
  }

  /**
   * Check if this contact method can receive notifications
   */
  canReceiveNotifications(): boolean {
    // Push notifications don't require verification
    if (this.type === 'push') return true;
    return this.verified;
  }

  /**
   * Generate a verification code
   */
  generateVerificationCode(): string {
    const code = Math.random().toString().substr(2, 6);
    this.verificationCode = code;
    this.verificationSentAt = new Date();
    return code;
  }

  /**
   * Verify with a code
   */
  verify(code: string): boolean {
    if (!this.verificationCode) return false;
    if (this.verificationCode === code) {
      this.verified = true;
      this.verificationCode = null;
      this.verificationSentAt = null;
      return true;
    }
    return false;
  }
}
