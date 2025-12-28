import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Organization } from './Organization';
import { DeviceToken } from './DeviceToken';
import { Notification } from './Notification';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'cognito_sub', type: 'varchar', length: 255, unique: true })
  cognitoSub: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  fullName: string | null;

  @Column({ type: 'varchar', length: 50, default: 'member' })
  role: 'admin' | 'member';

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'inactive';

  @Column({ name: 'phone_number', type: 'varchar', length: 50, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, org => org.users)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @OneToMany(() => DeviceToken, token => token.user)
  deviceTokens: DeviceToken[];

  @OneToMany(() => Notification, notification => notification.user)
  notifications: Notification[];
}
