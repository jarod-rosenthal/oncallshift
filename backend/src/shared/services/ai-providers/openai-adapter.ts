/**
 * OpenAI Provider Adapter
 *
 * Implements the AIProviderAdapter interface for OpenAI's GPT models.
 */

import OpenAI from 'openai';
import {
  AIProviderAdapter,
  AIMessage,
  AIChatOptions,
  AIResponse,
  AIStreamEvent,
  AIModelInfo,
  AIContentBlock,
} from './types';
import { toOpenAITools } from './tool-converter';
import { logger } from '../../utils/logger';

export class OpenAIAdapter implements AIProviderAdapter {
  readonly provider = 'openai' as const;
  private client: OpenAI;

  constructor(apiKey: string, organizationId?: string) {
    this.client = new OpenAI({
      apiKey,
      organization: organizationId,
    });
  }

  async chat(messages: AIMessage[], options: AIChatOptions): Promise<AIResponse> {
    const openaiMessages = this.convertMessages(messages, options.system);

    const response = await this.client.chat.completions.create({
      model: options.model,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature,
      top_p: options.topP,
      stop: options.stopSequences,
      tools: options.tools ? toOpenAITools(options.tools) : undefined,
      messages: openaiMessages,
    });

    const choice = response.choices[0];
    const content = this.extractContent(choice.message);

    return {
      content,
      stopReason: this.mapStopReason(choice.finish_reason),
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
      model: response.model,
    };
  }

  async *streamChat(
    messages: AIMessage[],
    options: AIChatOptions
  ): AsyncGenerator<AIStreamEvent> {
    const openaiMessages = this.convertMessages(messages, options.system);

    try {
      const stream = await this.client.chat.completions.create({
        model: options.model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
        top_p: options.topP,
        stop: options.stopSequences,
        tools: options.tools ? toOpenAITools(options.tools) : undefined,
        messages: openaiMessages,
        stream: true,
      });

      // Track tool calls being built
      const toolCalls: Map<
        number,
        { id: string; name: string; arguments: string }
      > = new Map();
      let finishReason: string | null = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        finishReason = chunk.choices[0]?.finish_reason || finishReason;

        // Handle text content
        if (delta?.content) {
          yield { type: 'text', content: delta.content };
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            const index = toolCall.index;

            if (!toolCalls.has(index)) {
              // New tool call starting
              toolCalls.set(index, {
                id: toolCall.id || `openai-${Date.now()}-${index}`,
                name: toolCall.function?.name || '',
                arguments: '',
              });

              if (toolCall.function?.name) {
                yield {
                  type: 'tool_call_start',
                  id: toolCalls.get(index)!.id,
                  name: toolCall.function.name,
                };
              }
            }

            // Accumulate arguments
            if (toolCall.function?.arguments) {
              const current = toolCalls.get(index)!;
              current.arguments += toolCall.function.arguments;

              yield {
                type: 'tool_call_delta',
                id: current.id,
                inputDelta: toolCall.function.arguments,
              };
            }
          }
        }
      }

      // Emit tool call end events
      for (const [, toolCall] of toolCalls) {
        try {
          const input = toolCall.arguments
            ? JSON.parse(toolCall.arguments)
            : {};
          yield {
            type: 'tool_call_end',
            id: toolCall.id,
            input,
          };
        } catch (e) {
          logger.warn('Failed to parse OpenAI tool arguments', {
            arguments: toolCall.arguments,
          });
          yield {
            type: 'tool_call_end',
            id: toolCall.id,
            input: {},
          };
        }
      }

      yield {
        type: 'done',
        stopReason: this.mapStopReason(finishReason),
      };
    } catch (error: any) {
      logger.error('OpenAI stream error', { error: error.message });
      yield { type: 'error', error: error.message };
    }
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const testClient = new OpenAI({ apiKey });
      // List models to validate the key
      await testClient.models.list();
      return true;
    } catch (error: any) {
      logger.warn('OpenAI key validation failed', { error: error.message });
      return false;
    }
  }

  getModels(): AIModelInfo[] {
    return [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        capabilities: ['chat', 'code', 'vision', 'tools'],
        contextWindow: 128000,
        maxOutputTokens: 16384,
        inputPricePerMillion: 2.5,
        outputPricePerMillion: 10,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        capabilities: ['chat', 'code', 'vision', 'tools'],
        contextWindow: 128000,
        maxOutputTokens: 16384,
        inputPricePerMillion: 0.15,
        outputPricePerMillion: 0.6,
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        capabilities: ['chat', 'code', 'vision', 'tools'],
        contextWindow: 128000,
        maxOutputTokens: 4096,
        inputPricePerMillion: 10,
        outputPricePerMillion: 30,
      },
      {
        id: 'o1',
        name: 'o1',
        provider: 'openai',
        capabilities: ['chat', 'code'],
        contextWindow: 200000,
        maxOutputTokens: 100000,
        inputPricePerMillion: 15,
        outputPricePerMillion: 60,
      },
      {
        id: 'o1-mini',
        name: 'o1-mini',
        provider: 'openai',
        capabilities: ['chat', 'code'],
        contextWindow: 128000,
        maxOutputTokens: 65536,
        inputPricePerMillion: 3,
        outputPricePerMillion: 12,
      },
    ];
  }

  private convertMessages(
    messages: AIMessage[],
    systemPrompt?: string
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system message first
    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Skip system messages in the main array (handled above)
        continue;
      }

      if (msg.role === 'user') {
        result.push({
          role: 'user',
          content: this.convertContent(msg.content),
        });
      } else if (msg.role === 'assistant') {
        const assistantMsg: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam =
          {
            role: 'assistant',
            content: typeof msg.content === 'string' ? msg.content : null,
          };

        // Handle tool use in assistant messages
        if (Array.isArray(msg.content)) {
          const toolUses = msg.content.filter((b) => b.type === 'tool_use');
          if (toolUses.length > 0) {
            assistantMsg.tool_calls = toolUses.map((tu) => ({
              id: (tu as any).id,
              type: 'function' as const,
              function: {
                name: (tu as any).name,
                arguments: JSON.stringify((tu as any).input),
              },
            }));
          }

          // Extract text content
          const textBlocks = msg.content.filter((b) => b.type === 'text');
          if (textBlocks.length > 0) {
            assistantMsg.content = textBlocks
              .map((b) => (b as any).text)
              .join('');
          }

          // Handle tool results - they come as separate tool messages
          const toolResults = msg.content.filter(
            (b) => b.type === 'tool_result'
          );
          if (toolResults.length > 0) {
            // Push the assistant message first, then tool results
            if (assistantMsg.content || assistantMsg.tool_calls) {
              result.push(assistantMsg);
            }
            for (const tr of toolResults) {
              result.push({
                role: 'tool',
                tool_call_id: (tr as any).toolUseId,
                content: (tr as any).content,
              });
            }
            continue; // Skip the normal push
          }
        }

        result.push(assistantMsg);
      }
    }

    return result;
  }

  private convertContent(
    content: string | AIContentBlock[]
  ): string | OpenAI.Chat.Completions.ChatCompletionContentPart[] {
    if (typeof content === 'string') {
      return content;
    }

    const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

    for (const block of content) {
      if (block.type === 'text') {
        parts.push({ type: 'text', text: block.text });
      } else if (block.type === 'image') {
        if (block.source.type === 'base64') {
          parts.push({
            type: 'image_url',
            image_url: {
              url: `data:${block.source.mediaType || 'image/png'};base64,${block.source.data}`,
            },
          });
        } else if (block.source.url) {
          parts.push({
            type: 'image_url',
            image_url: { url: block.source.url },
          });
        }
      }
    }

    return parts.length === 1 && parts[0].type === 'text'
      ? parts[0].text
      : parts;
  }

  private extractContent(
    message: OpenAI.Chat.Completions.ChatCompletionMessage
  ): AIContentBlock[] {
    const content: AIContentBlock[] = [];

    if (message.content) {
      content.push({ type: 'text', text: message.content });
    }

    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function' && toolCall.function) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments || '{}'),
          });
        }
      }
    }

    return content;
  }

  private mapStopReason(
    reason: string | null
  ): 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' {
    switch (reason) {
      case 'stop':
        return 'end_turn';
      case 'tool_calls':
        return 'tool_use';
      case 'length':
        return 'max_tokens';
      case 'content_filter':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }
}
