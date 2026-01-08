/**
 * Google Gemini Provider Adapter
 *
 * Implements the AIProviderAdapter interface for Google's Gemini models.
 */

import {
  GoogleGenerativeAI,
  GenerativeModel,
  Content,
  Part,
  FunctionDeclarationsTool,
} from '@google/generative-ai';
import {
  AIProviderAdapter,
  AIMessage,
  AIChatOptions,
  AIResponse,
  AIStreamEvent,
  AIModelInfo,
  AIContentBlock,
} from './types';
import { toGeminiTools } from './tool-converter';
import { logger } from '../../utils/logger';

export class GeminiAdapter implements AIProviderAdapter {
  readonly provider = 'google' as const;
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async chat(messages: AIMessage[], options: AIChatOptions): Promise<AIResponse> {
    const model = this.getModel(options);
    const geminiContents = this.convertMessages(messages);

    const result = await model.generateContent({
      contents: geminiContents,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 4096,
        temperature: options.temperature,
        topP: options.topP,
        stopSequences: options.stopSequences,
      },
    });

    const response = result.response;
    const content = this.extractContent(response);

    // Determine stop reason
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;

    return {
      content,
      stopReason: this.mapStopReason(finishReason),
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
      },
      model: options.model,
    };
  }

  async *streamChat(
    messages: AIMessage[],
    options: AIChatOptions
  ): AsyncGenerator<AIStreamEvent> {
    const model = this.getModel(options);
    const geminiContents = this.convertMessages(messages);

    try {
      const result = await model.generateContentStream({
        contents: geminiContents,
        generationConfig: {
          maxOutputTokens: options.maxTokens || 4096,
          temperature: options.temperature,
          topP: options.topP,
          stopSequences: options.stopSequences,
        },
      });

      let finishReason: string | undefined;
      const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

      for await (const chunk of result.stream) {
        const candidate = chunk.candidates?.[0];
        finishReason = candidate?.finishReason || finishReason;

        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if ('text' in part && part.text) {
              yield { type: 'text', content: part.text };
            }

            if ('functionCall' in part && part.functionCall) {
              const id = `gemini-${Date.now()}-${functionCalls.length}`;
              const name = part.functionCall.name;
              const args = (part.functionCall.args as Record<string, unknown>) || {};

              functionCalls.push({ name, args });

              yield {
                type: 'tool_call_start',
                id,
                name,
              };

              // Gemini sends function calls complete, not streamed
              yield {
                type: 'tool_call_end',
                id,
                input: args,
              };
            }
          }
        }
      }

      // Get final response for usage
      const finalResponse = await result.response;

      yield {
        type: 'done',
        stopReason: this.mapStopReason(finishReason),
        usage: {
          inputTokens: finalResponse.usageMetadata?.promptTokenCount || 0,
          outputTokens: finalResponse.usageMetadata?.candidatesTokenCount || 0,
        },
      };
    } catch (error: any) {
      logger.error('Gemini stream error', { error: error.message });
      yield { type: 'error', error: error.message };
    }
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const testClient = new GoogleGenerativeAI(apiKey);
      const model = testClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      // Make a minimal request to validate the key
      await model.generateContent('Hi');
      return true;
    } catch (error: any) {
      logger.warn('Gemini key validation failed', { error: error.message });
      return false;
    }
  }

  getModels(): AIModelInfo[] {
    return [
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        capabilities: ['chat', 'code', 'vision', 'tools'],
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0,
        outputPricePerMillion: 0,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        capabilities: ['chat', 'code', 'vision', 'tools'],
        contextWindow: 2000000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 1.25,
        outputPricePerMillion: 5,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'google',
        capabilities: ['chat', 'code', 'vision', 'tools'],
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.075,
        outputPricePerMillion: 0.3,
      },
      {
        id: 'gemini-1.5-flash-8b',
        name: 'Gemini 1.5 Flash 8B',
        provider: 'google',
        capabilities: ['chat', 'code', 'tools'],
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        inputPricePerMillion: 0.0375,
        outputPricePerMillion: 0.15,
      },
    ];
  }

  private getModel(options: AIChatOptions): GenerativeModel {
    const modelConfig: any = {
      model: options.model,
    };

    if (options.system) {
      modelConfig.systemInstruction = options.system;
    }

    if (options.tools && options.tools.length > 0) {
      modelConfig.tools = toGeminiTools(options.tools) as FunctionDeclarationsTool[];
    }

    return this.client.getGenerativeModel(modelConfig);
  }

  private convertMessages(messages: AIMessage[]): Content[] {
    const contents: Content[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // System messages are handled in model config
        continue;
      }

      const parts = this.convertContent(msg.content);

      // Handle tool results specially
      if (Array.isArray(msg.content)) {
        const toolResults = msg.content.filter((b) => b.type === 'tool_result');
        if (toolResults.length > 0) {
          // Gemini expects function responses in a specific format
          contents.push({
            role: 'function',
            parts: toolResults.map((tr) => ({
              functionResponse: {
                name: (tr as any).toolUseId,
                response: {
                  result: (tr as any).content,
                },
              },
            })),
          });
          continue;
        }
      }

      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts,
      });
    }

    return contents;
  }

  private convertContent(content: string | AIContentBlock[]): Part[] {
    if (typeof content === 'string') {
      return [{ text: content }];
    }

    const parts: Part[] = [];

    for (const block of content) {
      if (block.type === 'text') {
        parts.push({ text: block.text });
      } else if (block.type === 'image') {
        if (block.source.type === 'base64' && block.source.data) {
          parts.push({
            inlineData: {
              mimeType: block.source.mediaType || 'image/png',
              data: block.source.data,
            },
          });
        }
      } else if (block.type === 'tool_use') {
        parts.push({
          functionCall: {
            name: block.name,
            args: block.input,
          },
        });
      }
    }

    return parts;
  }

  private extractContent(response: any): AIContentBlock[] {
    const content: AIContentBlock[] = [];
    const candidate = response.candidates?.[0];

    if (!candidate?.content?.parts) {
      return content;
    }

    for (const part of candidate.content.parts) {
      if ('text' in part && part.text) {
        content.push({ type: 'text', text: part.text });
      }

      if ('functionCall' in part && part.functionCall) {
        content.push({
          type: 'tool_use',
          id: `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: part.functionCall.name,
          input: (part.functionCall.args as Record<string, unknown>) || {},
        });
      }
    }

    return content;
  }

  private mapStopReason(
    reason: string | undefined
  ): 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' {
    switch (reason) {
      case 'STOP':
        return 'end_turn';
      case 'MAX_TOKENS':
        return 'max_tokens';
      case 'SAFETY':
      case 'RECITATION':
      case 'OTHER':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }
}
