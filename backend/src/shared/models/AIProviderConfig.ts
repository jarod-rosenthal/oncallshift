import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { AIProvider } from './CloudCredential';

export type AICapability = 'chat' | 'code' | 'vision' | 'embeddings';

export interface CapabilityOverrides {
  chat?: AIProvider;
  code?: AIProvider;
  vision?: AIProvider;
  embeddings?: AIProvider;
}

export interface ModelPreferences {
  [provider: string]: {
    [capability: string]: string;
  };
}

@Entity('ai_provider_configs')
export class AIProviderConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ name: 'default_provider', type: 'varchar', length: 20, default: 'anthropic' })
  defaultProvider: AIProvider;

  @Column({ name: 'capability_overrides', type: 'jsonb', default: '{}' })
  capabilityOverrides: CapabilityOverrides;

  @Column({ name: 'model_preferences', type: 'jsonb', default: '{}' })
  modelPreferences: ModelPreferences;

  @Column({ name: 'fallback_chain', type: 'jsonb', default: '[]' })
  fallbackChain: AIProvider[];

  @Column({ name: 'enable_fallback', type: 'boolean', default: false })
  enableFallback: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Get the provider for a specific capability
   */
  getProviderForCapability(capability: AICapability): AIProvider {
    return this.capabilityOverrides[capability] || this.defaultProvider;
  }

  /**
   * Get the preferred model for a provider and capability
   */
  getPreferredModel(provider: AIProvider, capability: AICapability): string | null {
    return this.modelPreferences[provider]?.[capability] || null;
  }

  /**
   * Get default model for a provider if no preference set
   */
  static getDefaultModel(provider: AIProvider, capability: AICapability): string {
    const defaults: Record<AIProvider, Record<AICapability, string>> = {
      anthropic: {
        chat: 'claude-sonnet-4-20250514',
        code: 'claude-sonnet-4-20250514',
        vision: 'claude-sonnet-4-20250514',
        embeddings: 'claude-sonnet-4-20250514',
      },
      openai: {
        chat: 'gpt-4o',
        code: 'gpt-4o',
        vision: 'gpt-4o',
        embeddings: 'text-embedding-3-small',
      },
      google: {
        chat: 'gemini-1.5-pro',
        code: 'gemini-1.5-pro',
        vision: 'gemini-1.5-pro',
        embeddings: 'text-embedding-004',
      },
    };
    return defaults[provider]?.[capability] || defaults.anthropic.chat;
  }
}
