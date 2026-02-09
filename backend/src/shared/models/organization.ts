import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("organizations")
export class Organization {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  name!: string;

  @Column({ type: "varchar", length: 50, default: "active" })
  status!: string;

  @Column({ type: "varchar", length: 50, default: "free" })
  plan!: string;

  @Column({ type: "jsonb", default: {} })
  settings!: Record<string, unknown>;

  @Column({ type: "varchar", length: 100, default: "America/New_York" })
  timezone!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
