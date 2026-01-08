/**
 * AI Provider Factory
 *
 * Routes requests to the appropriate provider based on organization configuration.
 * Handles credential resolution, fallback chains, and provider instantiation.
 */

import { getDataSource } from '../../db/data-source';
import {
  CloudCredential,
  AIProvider,
  AnthropicCredentials,
  OpenAICredentials,
  GoogleAICredentials,
} from '../../models/CloudCredential';
import { AIProviderConfig, AICapability } from '../../models/AIProviderConfig';
import { decryptCredentials } from '../credential-encryption';
import { logger } from '../../utils/logger';

import { AIProviderAdapter, ProviderWithModel, AIModelInfo } from './types';
import { AnthropicAdapter } from './anthropic-adapter';
import { OpenAIAdapter } from './openai-adapter';
import { GeminiAdapter } from './gemini-adapter';

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Get an AI provider adapter for an organization.
 *
 * Resolution order:
 * 1. Check org's AIProviderConfig for capability override
 * 2. Use org's default provider from AIProviderConfig
 * 3. Fall back to any available provider credential
 * 4. Fall back to environment variable (ANTHROPIC_API_KEY)
 */
export async function getAIProvider(
  orgId: string,
  capability: AICapability = 'chat'
): Promise<ProviderWithModel> {
  const dataSource = await getDataSource();
  const configRepo = dataSource.getRepository(AIProviderConfig);
  const credentialRepo = dataSource.getRepository(CloudCredential);

  // Load org config
  let config = await configRepo.findOne({ where: { orgId } });

  // Determine which provider to use
  const targetProvider = config?.getProviderForCapability(capability) || 'anthropic';

  // Try to get credentials for the target provider
  let adapter = await tryCreateAdapter(orgId, targetProvider, credentialRepo);

  if (adapter) {
    const modelId = getModelForProvider(targetProvider, capability, config);
    logger.info('Using org AI provider', { orgId, provider: targetProvider, capability, modelId });
    return { adapter, modelId };
  }

  // If fallback is enabled, try the fallback chain
  if (config?.enableFallback && config.fallbackChain.length > 0) {
    for (const fallbackProvider of config.fallbackChain) {
      if (fallbackProvider === targetProvider) continue;

      adapter = await tryCreateAdapter(orgId, fallbackProvider, credentialRepo);
      if (adapter) {
        const modelId = getModelForProvider(fallbackProvider, capability, config);
        logger.info('Using fallback AI provider', {
          orgId,
          originalProvider: targetProvider,
          fallbackProvider,
          capability,
          modelId,
        });
        return { adapter, modelId };
      }
    }
  }

  // Final fallback: environment variable for Anthropic
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) {
    logger.info('Using environment ANTHROPIC_API_KEY', { orgId, capability });
    return {
      adapter: new AnthropicAdapter(envKey),
      modelId: AIProviderConfig.getDefaultModel('anthropic', capability),
    };
  }

  throw new Error(
    `No AI provider configured for organization. Add an API key in Settings > Cloud Credentials.`
  );
}

/**
 * Get a specific provider adapter by name
 */
export async function getSpecificProvider(
  orgId: string,
  provider: AIProvider
): Promise<AIProviderAdapter | null> {
  const dataSource = await getDataSource();
  const credentialRepo = dataSource.getRepository(CloudCredential);
  return tryCreateAdapter(orgId, provider, credentialRepo);
}

/**
 * Get all available providers for an organization
 */
export async function getAvailableProviders(
  orgId: string
): Promise<{ provider: AIProvider; models: AIModelInfo[] }[]> {
  const dataSource = await getDataSource();
  const credentialRepo = dataSource.getRepository(CloudCredential);

  const aiProviders: AIProvider[] = ['anthropic', 'openai', 'google'];
  const available: { provider: AIProvider; models: AIModelInfo[] }[] = [];

  for (const provider of aiProviders) {
    const adapter = await tryCreateAdapter(orgId, provider, credentialRepo);
    if (adapter) {
      available.push({
        provider,
        models: adapter.getModels(),
      });
    }
  }

  // Check env var fallback for Anthropic
  if (
    process.env.ANTHROPIC_API_KEY &&
    !available.find((a) => a.provider === 'anthropic')
  ) {
    const adapter = new AnthropicAdapter(process.env.ANTHROPIC_API_KEY);
    available.push({
      provider: 'anthropic',
      models: adapter.getModels(),
    });
  }

  return available;
}

/**
 * Validate an API key for a specific provider
 */
export async function validateProviderKey(
  provider: AIProvider,
  apiKey: string
): Promise<boolean> {
  let adapter: AIProviderAdapter;

  switch (provider) {
    case 'anthropic':
      adapter = new AnthropicAdapter(apiKey);
      break;
    case 'openai':
      adapter = new OpenAIAdapter(apiKey);
      break;
    case 'google':
      adapter = new GeminiAdapter(apiKey);
      break;
    default:
      return false;
  }

  return adapter.validateKey(apiKey);
}

/**
 * Get the Anthropic API key for backward compatibility
 * @deprecated Use getAIProvider instead
 */
export async function getAnthropicApiKey(orgId: string): Promise<string | null> {
  try {
    const dataSource = await getDataSource();
    const credentialRepo = dataSource.getRepository(CloudCredential);

    const credential = await credentialRepo.findOne({
      where: { orgId, provider: 'anthropic', enabled: true },
    });

    if (credential) {
      const decrypted = decryptCredentials<AnthropicCredentials>(
        credential.credentialsEncrypted,
        orgId
      );
      if (decrypted.api_key) {
        return decrypted.api_key;
      }
    }
  } catch (error) {
    logger.warn('Failed to fetch org Anthropic credential', { orgId, error });
  }

  return process.env.ANTHROPIC_API_KEY || null;
}

// ============================================================================
// Internal Helpers
// ============================================================================

async function tryCreateAdapter(
  orgId: string,
  provider: AIProvider,
  credentialRepo: any
): Promise<AIProviderAdapter | null> {
  try {
    const credential = await credentialRepo.findOne({
      where: { orgId, provider, enabled: true },
    });

    if (!credential) {
      return null;
    }

    switch (provider) {
      case 'anthropic': {
        const creds = decryptCredentials<AnthropicCredentials>(
          credential.credentialsEncrypted,
          orgId
        );
        return new AnthropicAdapter(creds.api_key);
      }

      case 'openai': {
        const creds = decryptCredentials<OpenAICredentials>(
          credential.credentialsEncrypted,
          orgId
        );
        return new OpenAIAdapter(creds.api_key, creds.organization_id);
      }

      case 'google': {
        const creds = decryptCredentials<GoogleAICredentials>(
          credential.credentialsEncrypted,
          orgId
        );
        return new GeminiAdapter(creds.api_key);
      }

      default:
        return null;
    }
  } catch (error) {
    logger.warn('Failed to create AI provider adapter', { orgId, provider, error });
    return null;
  }
}

function getModelForProvider(
  provider: AIProvider,
  capability: AICapability,
  config: AIProviderConfig | null
): string {
  // Check config for model preference
  const preferredModel = config?.getPreferredModel(provider, capability);
  if (preferredModel) {
    return preferredModel;
  }

  // Use default model
  return AIProviderConfig.getDefaultModel(provider, capability);
}
