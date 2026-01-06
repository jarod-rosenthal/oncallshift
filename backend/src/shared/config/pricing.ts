/**
 * AI Worker Pricing Configuration
 *
 * SINGLE SOURCE OF TRUTH for all Claude API and ECS cost calculations.
 * All cost calculations in the codebase should import from this file.
 *
 * Pricing as of January 2025:
 * - Claude 3 Haiku: $0.25/M input, $1.25/M output
 * - Claude Sonnet 4.5: $3/M input, $15/M output
 * - Claude Opus 4: $15/M input, $75/M output
 * - Cache write: 25% premium on input rate
 * - Cache read: 10% of input rate
 */

// Per-token rates (divide by 1000 to get per-1K rate)
export const MODEL_PRICING = {
  // Full model names (as returned by Claude API)
  'claude-3-haiku-20240307': {
    input: 0.00025,
    output: 0.00125,
    cacheWrite: 0.0003125,
    cacheRead: 0.000025,
  },
  'claude-sonnet-4-5-20250929': {
    input: 0.003,
    output: 0.015,
    cacheWrite: 0.00375,
    cacheRead: 0.0003,
  },
  'claude-opus-4-20250514': {
    input: 0.015,
    output: 0.075,
    cacheWrite: 0.01875,
    cacheRead: 0.0015,
  },
  // Short aliases (used in AI Worker config)
  haiku: {
    input: 0.00025,
    output: 0.00125,
    cacheWrite: 0.0003125,
    cacheRead: 0.000025,
  },
  sonnet: {
    input: 0.003,
    output: 0.015,
    cacheWrite: 0.00375,
    cacheRead: 0.0003,
  },
  opus: {
    input: 0.015,
    output: 0.075,
    cacheWrite: 0.01875,
    cacheRead: 0.0015,
  },
} as const;

// ECS Fargate Spot pricing for 2 vCPU, 4GB memory (us-east-1)
export const ECS_FARGATE_SPOT_RATE_PER_HOUR = 0.015;

/**
 * Token usage structure for cost calculation
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

/**
 * Pricing rates structure
 */
export interface ModelPricingRates {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/**
 * Get pricing rates for a model
 * Falls back to sonnet pricing if model not found
 */
export function getModelPricing(model: string): ModelPricingRates {
  // Try exact match first
  if (model in MODEL_PRICING) {
    return MODEL_PRICING[model as keyof typeof MODEL_PRICING];
  }

  // Try to match by short name in the model string
  const modelLower = model.toLowerCase();
  if (modelLower.includes('haiku')) {
    return MODEL_PRICING.haiku;
  }
  if (modelLower.includes('opus')) {
    return MODEL_PRICING.opus;
  }

  // Default to sonnet
  return MODEL_PRICING.sonnet;
}

/**
 * Calculate Claude API cost from token usage
 */
export function calculateClaudeCost(tokens: TokenUsage, model: string): number {
  const rates = getModelPricing(model);

  const inputCost = (tokens.inputTokens / 1000) * rates.input;
  const outputCost = (tokens.outputTokens / 1000) * rates.output;
  const cacheWriteCost = (tokens.cacheCreationTokens / 1000) * rates.cacheWrite;
  const cacheReadCost = (tokens.cacheReadTokens / 1000) * rates.cacheRead;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * Calculate ECS Fargate compute cost from duration
 */
export function calculateEcsCost(durationSeconds: number): number {
  return (durationSeconds / 3600) * ECS_FARGATE_SPOT_RATE_PER_HOUR;
}

/**
 * Calculate total cost (Claude API + ECS compute)
 */
export function calculateTotalCost(
  tokens: TokenUsage,
  model: string,
  durationSeconds: number
): number {
  return calculateClaudeCost(tokens, model) + calculateEcsCost(durationSeconds);
}

/**
 * Format cost as USD string
 */
export function formatCostUsd(cost: number): string {
  return `$${cost.toFixed(4)}`;
}
