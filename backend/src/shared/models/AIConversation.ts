import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Incident } from './Incident';
import { User } from './User';

@Entity('ai_conversations')
export class AIConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'org_id' })
  orgId!: string;

  @Column({ name: 'incident_id' })
  incidentId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ default: 'active' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization?: Organization;

  @ManyToOne(() => Incident)
  @JoinColumn({ name: 'incident_id' })
  incident?: Incident;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @OneToMany(() => AIConversationMessage, message => message.conversation)
  messages?: AIConversationMessage[];
}

@Entity('ai_conversation_messages')
export class AIConversationMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id' })
  conversationId!: string;

  @Column()
  role!: string; // 'user', 'assistant', 'tool_call', 'tool_result'

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({ name: 'tool_name', type: 'varchar', length: 100, nullable: true })
  toolName?: string | null;

  @Column({ name: 'tool_input', type: 'jsonb', nullable: true })
  toolInput?: Record<string, any> | null;

  @Column({ name: 'tool_output', type: 'jsonb', nullable: true })
  toolOutput?: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => AIConversation, conversation => conversation.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation?: AIConversation;
}
