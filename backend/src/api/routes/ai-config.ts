import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { getDataSource } from '../../shared/db/data-source';
import { AIProviderConfig, CloudCredential } from '../../shared/models';
import { AIProvider } from '../../shared/models/CloudCredential';
import {
  getAvailableProviders,
  validateProviderKey,
} from '../../shared/services/ai-providers';
import { logger } from '../../shared/utils/logger';
import { badRequest } from '../../shared/utils/problem-details';
import {
  UpdateAIConfigRequest,
  GetAIConfigResponse,
  UpdateAIConfigResponse,
  GetProvidersResponse,
  TestProviderKeyRequest,
  TestProviderKeyResponse,
  GetModelsResponse,
  ProviderResponse,
  ModelDetailResponse,
  ErrorResponse,
} from './types/ai-config.types';

const router = Router();

const AI_PROVIDERS: AIProvider[] = ['anthropic', 'openai', 'google'];

/**
 * Check if user has admin role for modifying AI configuration
 */
function isOrgAdmin(user: any): boolean {
  const role = user?.role;
  const baseRole = user?.baseRole;
  return role === 'super_admin' || role === 'admin' || baseRole === 'admin' || baseRole === 'owner';
}

/**
 * GET /api/v1/ai-config
 * Get AI configuration for the organization
 *
 * @returns {GetAIConfigResponse} Current AI configuration
 * @throws {401} If not authenticated
 * @throws {500} If database query fails
 */
router.get('/', async (req: Request, res: Response<GetAIConfigResponse | ErrorResponse>): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const dataSource = await getDataSource();
    const configRepo = dataSource.getRepository(AIProviderConfig);
    const credentialRepo = dataSource.getRepository(CloudCredential);

    // Get or create default config
    let config = await configRepo.findOne({ where: { orgId } });

    if (!config) {
      // Return default configuration
      config = new AIProviderConfig();
      config.orgId = orgId;
      config.defaultProvider = 'anthropic';
      config.capabilityOverrides = {};
      config.modelPreferences = {};
      config.fallbackChain = [];
      config.enableFallback = false;
    }

    // Get configured providers (which have credentials)
    const configuredProviders: AIProvider[] = [];
    for (const provider of AI_PROVIDERS) {
      const hasCredential = await credentialRepo.findOne({
        where: { orgId, provider: provider as any, enabled: true },
      });
      if (hasCredential) {
        configuredProviders.push(provider);
      }
    }

    // Check for env var fallback
    if (process.env.ANTHROPIC_API_KEY && !configuredProviders.includes('anthropic')) {
      configuredProviders.push('anthropic');
    }

    const response: GetAIConfigResponse = {
      default_provider: config.defaultProvider,
      capability_overrides: config.capabilityOverrides,
      model_preferences: config.modelPreferences,
      fallback_chain: config.fallbackChain,
      enable_fallback: config.enableFallback,
      configured_providers: configuredProviders,
      has_env_fallback: !!process.env.ANTHROPIC_API_KEY,
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Failed to get AI config', { error: error.message });
    res.status(500).json({ error: 'Failed to get AI configuration' });
  }
});

/**
 * PUT /api/v1/ai-config
 * Update AI configuration for the organization
 *
 * @requires Admin role (admin, owner, or super_admin)
 * @param {UpdateAIConfigRequest} req.body - Configuration updates (all fields optional)
 * @returns {UpdateAIConfigResponse} Updated configuration
 * @throws {401} If not authenticated
 * @throws {403} If not an admin
 * @throws {400} If validation fails
 * @throws {500} If database operation fails
 */
router.put(
  '/',
  [
    body('default_provider')
      .optional()
      .isIn(AI_PROVIDERS)
      .withMessage('default_provider must be one of: anthropic, openai, google'),
    body('capability_overrides')
      .optional()
      .isObject()
      .withMessage('capability_overrides must be an object'),
    body('model_preferences')
      .optional()
      .isObject()
      .withMessage('model_preferences must be an object'),
    body('fallback_chain')
      .optional()
      .isArray()
      .withMessage('fallback_chain must be an array'),
    body('enable_fallback')
      .optional()
      .isBoolean()
      .withMessage('enable_fallback must be a boolean'),
  ],
  async (req: Request<{}, {}, UpdateAIConfigRequest>, res: Response<UpdateAIConfigResponse | ErrorResponse>): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      badRequest(res, errors.array()[0].msg);
      return;
    }

    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.id;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check admin permissions
      if (!isOrgAdmin(req.user)) {
        res.status(403).json({ error: 'Admin role required to modify AI configuration' });
        return;
      }

      const dataSource = await getDataSource();
      const configRepo = dataSource.getRepository(AIProviderConfig);

      // Get or create config
      let config = await configRepo.findOne({ where: { orgId } });

      if (!config) {
        config = new AIProviderConfig();
        config.orgId = orgId;
      }

      // Update fields if provided
      if (req.body.default_provider) {
        config.defaultProvider = req.body.default_provider;
      }
      if (req.body.capability_overrides !== undefined) {
        config.capabilityOverrides = req.body.capability_overrides;
      }
      if (req.body.model_preferences !== undefined) {
        config.modelPreferences = req.body.model_preferences;
      }
      if (req.body.fallback_chain !== undefined) {
        config.fallbackChain = req.body.fallback_chain;
      }
      if (req.body.enable_fallback !== undefined) {
        config.enableFallback = req.body.enable_fallback;
      }

      await configRepo.save(config);

      logger.info('AI config updated', { orgId, userId, changes: Object.keys(req.body) });

      const response: UpdateAIConfigResponse = {
        default_provider: config.defaultProvider,
        capability_overrides: config.capabilityOverrides,
        model_preferences: config.modelPreferences,
        fallback_chain: config.fallbackChain,
        enable_fallback: config.enableFallback,
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Failed to update AI config', { error: error.message });
      res.status(500).json({ error: 'Failed to update AI configuration' });
    }
  }
);

/**
 * GET /api/v1/ai-config/providers
 * Get available providers with their models
 *
 * @returns {GetProvidersResponse} List of available providers and their models
 * @throws {401} If not authenticated
 * @throws {500} If operation fails
 */
router.get('/providers', async (req: Request, res: Response<GetProvidersResponse | ErrorResponse>): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const available = await getAvailableProviders(orgId);

    // Format response with provider details
    const providers: ProviderResponse[] = available.map(({ provider, models }) => ({
      id: provider,
      name: getProviderDisplayName(provider),
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        capabilities: m.capabilities,
        context_window: m.contextWindow,
        max_output_tokens: m.maxOutputTokens,
        input_price_per_million: m.inputPricePerMillion,
        output_price_per_million: m.outputPricePerMillion,
      })),
    }));

    // Add unconfigured providers for display
    for (const providerId of AI_PROVIDERS) {
      if (!providers.find((p) => p.id === providerId)) {
        providers.push({
          id: providerId,
          name: getProviderDisplayName(providerId),
          models: [],
        });
      }
    }

    const response: GetProvidersResponse = { providers };
    res.json(response);
  } catch (error: any) {
    logger.error('Failed to get AI providers', { error: error.message });
    res.status(500).json({ error: 'Failed to get AI providers' });
  }
});

/**
 * POST /api/v1/ai-config/test/:provider
 * Test an API key for a provider
 *
 * @param {string} provider - Provider ID (anthropic, openai, or google)
 * @param {TestProviderKeyRequest} req.body - API key to validate
 * @returns {TestProviderKeyResponse} Validation result
 * @throws {401} If not authenticated
 * @throws {400} If validation fails
 * @throws {500} If operation fails
 */
router.post(
  '/test/:provider',
  [body('api_key').notEmpty().withMessage('api_key is required')],
  async (req: Request<{ provider: string }, {}, TestProviderKeyRequest>, res: Response<TestProviderKeyResponse | ErrorResponse>): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      badRequest(res, errors.array()[0].msg);
      return;
    }

    try {
      const provider = req.params.provider as AIProvider;

      if (!AI_PROVIDERS.includes(provider)) {
        badRequest(res, `Invalid provider: ${provider}`);
        return;
      }

      const apiKey = req.body.api_key;
      const isValid = await validateProviderKey(provider, apiKey);

      const response: TestProviderKeyResponse = {
        provider,
        valid: isValid,
        message: isValid ? 'API key is valid' : 'API key validation failed',
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Failed to test API key', { error: error.message });
      res.status(500).json({ error: 'Failed to test API key' });
    }
  }
);

/**
 * GET /api/v1/ai-config/models
 * Get all available models across configured providers
 *
 * @returns {GetModelsResponse} List of all available models with provider information
 * @throws {401} If not authenticated
 * @throws {500} If operation fails
 */
router.get('/models', async (req: Request, res: Response<GetModelsResponse | ErrorResponse>): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const available = await getAvailableProviders(orgId);

    // Flatten all models
    const allModels: ModelDetailResponse[] = available.flatMap(({ models }) =>
      models.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        provider_name: getProviderDisplayName(m.provider),
        capabilities: m.capabilities,
        context_window: m.contextWindow,
        max_output_tokens: m.maxOutputTokens,
        input_price_per_million: m.inputPricePerMillion,
        output_price_per_million: m.outputPricePerMillion,
      }))
    );

    const response: GetModelsResponse = { models: allModels };
    res.json(response);
  } catch (error: any) {
    logger.error('Failed to get AI models', { error: error.message });
    res.status(500).json({ error: 'Failed to get AI models' });
  }
});

/**
 * Get human-readable display name for a provider
 */
function getProviderDisplayName(provider: AIProvider): string {
  switch (provider) {
    case 'anthropic':
      return 'Anthropic (Claude)';
    case 'openai':
      return 'OpenAI (GPT)';
    case 'google':
      return 'Google (Gemini)';
    default:
      const _exhaustive: never = provider;
      return _exhaustive;
  }
}

export default router;
