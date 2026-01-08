/**
 * Anthropic Provider Adapter
 *
 * Implements the AIProviderAdapter interface for Anthropic's Claude models.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AIProviderAdapter,
  AIMessage,
  AIChatOptions,
  AIResponse,
  AIStreamEvent,
  AIModelInfo,
} from './types';
import {
  toAnthropicTools,
  toAnthropicContent,
  fromAnthropicContent,
} from './tool-converter';
import { logger } from '../../utils/logger';

export class AnthropicAdapter implements AIProviderAdapter {
  readonly provider = 'anthropic' as const;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(messages: AIMessage[], options: AIChatOptions): Promise<AIResponse> {
    const anthropicMessages = this.convertMessages(messages);

    const response = await this.client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature,
      top_p: options.topP,
      stop_sequences: options.stopSequences,
      system: options.system,
      tools: options.tools ? toAnthropicTools(options.tools) : undefined,
      messages: anthropicMessages,
    });

    return {
      content: fromAnthropicContent(response.content),
      stopReason: this.mapStopReason(response.stop_reason),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: response.model,
    };
  }

  async *streamChat(
    messages: AIMessage[],
    options: AIChatOptions
  ): AsyncGenerator<AIStreamEvent> {
    const anthropicMessages = this.convertMessages(messages);

    try {
      const stream = await this.client.messages.stream({
        model: options.model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
        top_p: options.topP,
        stop_sequences: options.stopSequences,
        system: options.system,
        tools: options.tools ? toAnthropicTools(options.tools) : undefined,
        messages: anthropicMessages,
      });

      // Track current tool use for streaming
      let currentToolId: string | null = null;
      let currentToolName: string | null = null;
      let toolInputJson = '';

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolId = event.content_block.id;
            currentToolName = event.content_block.name;
            toolInputJson = '';
            yield {
              type: 'tool_call_start',
              id: currentToolId,
              name: currentToolName,
            };
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'text', content: event.delta.text };
          } else if (event.delta.type === 'input_json_delta') {
            toolInputJson += event.delta.partial_json;
            if (currentToolId) {
              yield {
                type: 'tool_call_delta',
                id: currentToolId,
                inputDelta: event.delta.partial_json,
              };
            }
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolId && currentToolName) {
            try {
              const input = toolInputJson ? JSON.parse(toolInputJson) : {};
              yield {
                type: 'tool_call_end',
                id: currentToolId,
                input,
              };
            } catch (e) {
              logger.warn('Failed to parse tool input JSON', { toolInputJson });
              yield {
                type: 'tool_call_end',
                id: currentToolId,
                input: {},
              };
            }
            currentToolId = null;
            currentToolName = null;
            toolInputJson = '';
          }
        } else if (event.type === 'message_stop') {
          const finalMessage = await stream.finalMessage();
          yield {
            type: 'done',
            stopReason: this.mapStopReason(finalMessage.stop_reason),
            usage: {
              inputTokens: finalMessage.usage.input_tokens,
              outputTokens: finalMessage.usage.output_tokens,
            },
          };
        }
      }
    } catch (error: any) {
      logger.error('Anthropic stream error', { error: error.message });
      yield { type: 'error', error: error.message };
    }
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const testClient = new Anthropic({ apiKey });
      // Make a minimal request to validate the key
      await testClient.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return true;
    } catch (error: any) {
      logger.warn('Anthropic key validation failed', { error: error.message });
      return false;
    }
  }

  getModels(): AIModelInfo[] {
    return [
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        provider: 'anthropic',
        capabilities: ['chat', 'code', 'vision', 'tools'],
        contextWindow: 200000,
        maxOutputTokens: 32000,
        inputPricePerMillion: 15,
        outputPricePerMillion: 75,
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        capabilities: ['chat', 'code', 'vision', 'tools'],
        contextWindow: 200000,
        maxOutputTokens: 64000,
        inputPricePerMillion: 3,
        outputPricePerMillion: 15,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        capabilities: ['chat', 'code', 'tools'],
        contextWindow: 200000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.8,
        outputPricePerMillion: 4,
      },
    ];
  }

  private convertMessages(messages: AIMessage[]): Anthropic.MessageParam[] {
    return messages
      .filter((msg) => msg.role !== 'system') // System is handled separately
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: toAnthropicContent(msg.content),
      }));
  }

  private mapStopReason(
    reason: string | null
  ): 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' {
    switch (reason) {
      case 'end_turn':
        return 'end_turn';
      case 'tool_use':
        return 'tool_use';
      case 'max_tokens':
        return 'max_tokens';
      case 'stop_sequence':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }
}
