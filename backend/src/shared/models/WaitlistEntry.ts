import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type WaitlistStatus = 'pending' | 'invited' | 'registered';

@Entity('waitlist_entries')
export class WaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  fullName: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  plan: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: WaitlistStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
