/**
 * Type definitions for AI Configuration API endpoints
 *
 * Provides strongly-typed request/response interfaces for:
 * - GET /api/v1/ai-config
 * - PUT /api/v1/ai-config
 * - GET /api/v1/ai-config/providers
 * - POST /api/v1/ai-config/test/:provider
 * - GET /api/v1/ai-config/models
 */

import { AIProvider } from '../../../shared/models/CloudCredential';
import { AICapability as ConfigAICapability } from '../../../shared/models/AIProviderConfig';
import { AICapability as ServiceAICapability } from '../../../shared/services/ai-providers';

/**
 * Request body for updating AI configuration
 * All fields are optional - only provided fields will be updated
 */
export interface UpdateAIConfigRequest {
  /** Default AI provider for the organization */
  default_provider?: AIProvider;

  /** Override which provider to use for specific capabilities */
  capability_overrides?: {
    chat?: AIProvider;
    code?: AIProvider;
    vision?: AIProvider;
    embeddings?: AIProvider;
  };

  /** Model preferences per provider and capability */
  model_preferences?: {
    [provider: string]: {
      [capability: string]: string;
    };
  };

  /** List of providers to try in fallback order */
  fallback_chain?: AIProvider[];

  /** Enable fallback to next provider if primary fails */
  enable_fallback?: boolean;
}

/**
 * Response body for GET /api/v1/ai-config
 * Returns current AI configuration for the organization
 */
export interface GetAIConfigResponse {
  /** Default provider to use when no override is specified */
  default_provider: AIProvider;

  /** Overrides for specific capabilities */
  capability_overrides: {
    chat?: AIProvider;
    code?: AIProvider;
    vision?: AIProvider;
    embeddings?: AIProvider;
  };

  /** Preferred models per provider and capability */
  model_preferences: {
    [provider: string]: {
      [capability: string]: string;
    };
  };

  /** Ordered list of fallback providers */
  fallback_chain: AIProvider[];

  /** Whether fallback is enabled */
  enable_fallback: boolean;

  /** List of providers the org has credentials for */
  configured_providers: AIProvider[];

  /** Whether ANTHROPIC_API_KEY env var is available as fallback */
  has_env_fallback: boolean;
}

/**
 * Response body for PUT /api/v1/ai-config
 * Returns updated AI configuration
 */
export interface UpdateAIConfigResponse {
  /** Default provider to use when no override is specified */
  default_provider: AIProvider;

  /** Overrides for specific capabilities */
  capability_overrides: {
    chat?: AIProvider;
    code?: AIProvider;
    vision?: AIProvider;
    embeddings?: AIProvider;
  };

  /** Preferred models per provider and capability */
  model_preferences: {
    [provider: string]: {
      [capability: string]: string;
    };
  };

  /** Ordered list of fallback providers */
  fallback_chain: AIProvider[];

  /** Whether fallback is enabled */
  enable_fallback: boolean;
}

/**
 * Model information in provider list response
 * Extends AIModelInfo with formatted field names for API consistency
 */
export interface ModelResponse {
  id: string;
  name: string;
  capabilities: ServiceAICapability[];
  context_window: number;
  max_output_tokens: number;
  input_price_per_million?: number;
  output_price_per_million?: number;
}

/**
 * Single provider information in providers list
 */
export interface ProviderResponse {
  id: AIProvider;
  name: string;
  models: ModelResponse[];
}

/**
 * Response body for GET /api/v1/ai-config/providers
 * Returns available providers and their models
 */
export interface GetProvidersResponse {
  providers: ProviderResponse[];
}

/**
 * Request body for POST /api/v1/ai-config/test/:provider
 * Tests an API key for a specific provider
 */
export interface TestProviderKeyRequest {
  /** API key to validate */
  api_key: string;
}

/**
 * Response body for POST /api/v1/ai-config/test/:provider
 * Result of API key validation
 */
export interface TestProviderKeyResponse {
  /** Provider being tested */
  provider: AIProvider;

  /** Whether the API key is valid */
  valid: boolean;

  /** Human-readable status message */
  message: string;
}

/**
 * Model information in models list response
 * Extends ModelResponse with provider information
 */
export interface ModelDetailResponse extends ModelResponse {
  provider: AIProvider;
  provider_name: string;
}

/**
 * Response body for GET /api/v1/ai-config/models
 * Returns all available models across configured providers
 */
export interface GetModelsResponse {
  models: ModelDetailResponse[];
}

/**
 * Error response for validation or system errors
 */
export interface ErrorResponse {
  error: string;
}
