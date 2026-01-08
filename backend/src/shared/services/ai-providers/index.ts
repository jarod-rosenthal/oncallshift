/**
 * AI Providers Module
 *
 * Multi-provider AI abstraction layer supporting Anthropic, OpenAI, and Google Gemini.
 *
 * Usage:
 * ```typescript
 * import { getAIProvider, AIMessage, AIChatOptions } from './ai-providers';
 *
 * const { adapter, modelId } = await getAIProvider(orgId, 'chat');
 *
 * // Non-streaming
 * const response = await adapter.chat(messages, { model: modelId, system: '...' });
 *
 * // Streaming
 * for await (const event of adapter.streamChat(messages, { model: modelId })) {
 *   if (event.type === 'text') console.log(event.content);
 * }
 * ```
 */

// Types
export * from './types';

// Adapters
export { AnthropicAdapter } from './anthropic-adapter';
export { OpenAIAdapter } from './openai-adapter';
export { GeminiAdapter } from './gemini-adapter';

// Factory
export {
  getAIProvider,
  getSpecificProvider,
  getAvailableProviders,
  validateProviderKey,
  getAnthropicApiKey,
} from './provider-factory';

// Tool conversion utilities
export {
  toAnthropicTools,
  toOpenAITools,
  toGeminiTools,
  fromAnthropicToolCalls,
  fromOpenAIToolCalls,
  fromGeminiFunctionCalls,
  toAnthropicToolResults,
  toOpenAIToolResults,
  toGeminiToolResults,
  toAnthropicContent,
  fromAnthropicContent,
  extractText,
} from './tool-converter';
