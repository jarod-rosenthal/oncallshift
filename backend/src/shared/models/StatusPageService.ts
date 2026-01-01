import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { StatusPage } from './StatusPage';
import { Service } from './Service';

@Entity('status_page_services')
@Unique(['statusPageId', 'serviceId'])
export class StatusPageService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'status_page_id', type: 'uuid' })
  statusPageId: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @Column({ name: 'display_name', type: 'varchar', length: 200, nullable: true })
  displayName: string | null; // Optional override for public display

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'show_incidents', type: 'boolean', default: true })
  showIncidents: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => StatusPage, sp => sp.services, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'status_page_id' })
  statusPage: StatusPage;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;
}
