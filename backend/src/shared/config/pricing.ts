/**
 * AI Worker Pricing Configuration
 *
 * SINGLE SOURCE OF TRUTH for all Claude API and ECS cost calculations.
 * All cost calculations in the codebase should import from this file.
 *
 * Pricing as of January 2025 (from https://www.anthropic.com/pricing):
 * - Claude 3.5 Haiku: $0.80/M input, $4/M output
 * - Claude Haiku 4.5: $1/M input, $5/M output
 * - Claude Sonnet 4: $3/M input, $15/M output
 * - Claude Opus 4.5: $5/M input, $25/M output
 * - Cache write: 1.25x input rate
 * - Cache read: 0.1x input rate
 */

// Per-token rates (per 1K tokens - divide MTok rate by 1000)
export const MODEL_PRICING = {
  // Claude 3.5 Haiku ($0.80/M input, $4/M output)
  'claude-3-5-haiku-20241022': {
    input: 0.0008,
    output: 0.004,
    cacheWrite: 0.001,      // 1.25x input
    cacheRead: 0.00008,     // 0.1x input
  },
  // Claude Haiku 4.5 ($1/M input, $5/M output)
  'claude-haiku-4-5-20251001': {
    input: 0.001,
    output: 0.005,
    cacheWrite: 0.00125,    // 1.25x input
    cacheRead: 0.0001,      // 0.1x input
  },
  // Claude Sonnet 4 ($3/M input, $15/M output)
  'claude-sonnet-4-20250514': {
    input: 0.003,
    output: 0.015,
    cacheWrite: 0.00375,
    cacheRead: 0.0003,
  },
  // Claude Opus 4.5 ($5/M input, $25/M output)
  'claude-opus-4-5-20251101': {
    input: 0.005,
    output: 0.025,
    cacheWrite: 0.00625,
    cacheRead: 0.0005,
  },
  // Short aliases (default to latest versions)
  haiku: {
    input: 0.001,           // Haiku 4.5 pricing
    output: 0.005,
    cacheWrite: 0.00125,
    cacheRead: 0.0001,
  },
  sonnet: {
    input: 0.003,
    output: 0.015,
    cacheWrite: 0.00375,
    cacheRead: 0.0003,
  },
  opus: {
    input: 0.005,           // Opus 4.5 pricing
    output: 0.025,
    cacheWrite: 0.00625,
    cacheRead: 0.0005,
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
