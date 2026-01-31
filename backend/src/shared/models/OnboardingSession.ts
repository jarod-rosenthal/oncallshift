import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';

/**
 * Onboarding stage definitions
 */
export type OnboardingStage =
  | 'discovery'
  | 'team_setup'
  | 'schedule_setup'
  | 'integration'
  | 'verification'
  | 'complete';

/**
 * Information collected during onboarding
 */
export interface OnboardingCollectedInfo {
  // Discovery stage
  teamCount?: number;
  teamNames?: string[];
  teamStructure?: string; // e.g., "by-function", "by-product", "by-region"
  estimatedTeamSize?: number;

  // Team setup stage
  members?: Array<{
    email: string;
    name: string;
    teamName: string;
    role?: string;
  }>;
  createdTeamIds?: string[];

  // Schedule setup stage
  timezone?: string;
  rotationType?: 'daily' | 'weekly' | 'custom';
  rotationStartDay?: number; // 0 = Sunday
  rotationStartTime?: string; // HH:mm format
  handoffTime?: string; // HH:mm format
  createdScheduleIds?: string[];

  // Integration stage
  integrations?: Array<{
    type: 'datadog' | 'cloudwatch' | 'prometheus' | 'custom_webhook' | 'email';
    configured: boolean;
    serviceId?: string;
  }>;
  createdServiceIds?: string[];

  // Verification stage
  testAlertSent?: boolean;
  testAlertReceived?: boolean;
  verificationIncidentId?: string;
}

/**
 * A conversation message in the onboarding session
 */
export interface OnboardingMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  stage: OnboardingStage;
}

/**
 * Pending questions that need answers
 */
export interface PendingQuestion {
  id: string;
  question: string;
  field: keyof OnboardingCollectedInfo;
  type: 'text' | 'number' | 'select' | 'multi-select' | 'email-list';
  options?: string[];
  required: boolean;
}

@Entity('onboarding_sessions')
export class OnboardingSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'org_id' })
  orgId!: string;

  @Column({ name: 'admin_user_id' })
  adminUserId!: string;

  @Column({ name: 'admin_email', type: 'varchar', length: 255 })
  adminEmail!: string;

  @Column({
    name: 'current_stage',
    type: 'varchar',
    length: 50,
    default: 'discovery',
  })
  currentStage!: OnboardingStage;

  @Column({ name: 'collected_info', type: 'jsonb', default: {} })
  collectedInfo!: OnboardingCollectedInfo;

  @Column({ name: 'messages', type: 'jsonb', default: [] })
  messages!: OnboardingMessage[];

  @Column({ name: 'pending_questions', type: 'jsonb', default: [] })
  pendingQuestions!: PendingQuestion[];

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status!: 'active' | 'completed' | 'abandoned';

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization?: Organization;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'admin_user_id' })
  adminUser?: User;

  /**
   * Check if onboarding is complete
   */
  isComplete(): boolean {
    return this.currentStage === 'complete' || this.status === 'completed';
  }

  /**
   * Get progress percentage
   */
  getProgressPercentage(): number {
    const stageOrder: OnboardingStage[] = [
      'discovery',
      'team_setup',
      'schedule_setup',
      'integration',
      'verification',
      'complete',
    ];
    const currentIndex = stageOrder.indexOf(this.currentStage);
    return Math.round((currentIndex / (stageOrder.length - 1)) * 100);
  }

  /**
   * Get stage display name
   */
  static getStageDisplayName(stage: OnboardingStage): string {
    const names: Record<OnboardingStage, string> = {
      discovery: 'Getting to Know You',
      team_setup: 'Team Setup',
      schedule_setup: 'Schedule Configuration',
      integration: 'Connecting Integrations',
      verification: 'Verification',
      complete: 'Complete',
    };
    return names[stage];
  }

  /**
   * Add a message to the conversation
   */
  addMessage(role: 'assistant' | 'user', content: string): OnboardingMessage {
    const message: OnboardingMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      role,
      content,
      timestamp: new Date(),
      stage: this.currentStage,
    };
    this.messages.push(message);
    return message;
  }
}
