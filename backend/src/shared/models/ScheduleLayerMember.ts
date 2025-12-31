import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ScheduleLayer } from './ScheduleLayer';
import { User } from './User';

@Entity('schedule_layer_members')
export class ScheduleLayerMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'layer_id', type: 'uuid' })
  layerId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  position: number; // Rotation order (0, 1, 2, ...)

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => ScheduleLayer, layer => layer.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'layer_id' })
  layer: ScheduleLayer;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
