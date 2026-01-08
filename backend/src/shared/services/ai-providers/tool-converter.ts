/**
 * Tool Format Converter
 *
 * Converts between unified AITool format and provider-specific formats.
 * - Anthropic: Uses input_schema directly
 * - OpenAI: Wraps in { type: 'function', function: {...} }
 * - Gemini: Uses functionDeclarations array
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AITool, AIToolCall, AIToolResult, AIContentBlock } from './types';

// ============================================================================
// To Provider Format
// ============================================================================

/**
 * Convert unified tools to Anthropic format
 */
export function toAnthropicTools(tools: AITool[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object' as const,
      properties: tool.inputSchema.properties,
      required: tool.inputSchema.required || [],
    },
  }));
}

/**
 * Convert unified tools to OpenAI format
 */
export function toOpenAITools(
  tools: AITool[]
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required || [],
      },
    },
  }));
}

/**
 * Convert unified tools to Gemini format
 */
export function toGeminiTools(tools: AITool[]): any[] {
  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required || [],
        },
      })),
    },
  ];
}

// ============================================================================
// From Provider Format - Tool Calls
// ============================================================================

/**
 * Convert Anthropic tool use blocks to unified format
 */
export function fromAnthropicToolCalls(
  blocks: Anthropic.ContentBlock[]
): AIToolCall[] {
  return blocks
    .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
    .map((block) => ({
      id: block.id,
      name: block.name,
      input: block.input as Record<string, unknown>,
    }));
}

/**
 * Convert OpenAI tool calls to unified format
 */
export function fromOpenAIToolCalls(
  toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] | undefined
): AIToolCall[] {
  if (!toolCalls) return [];

  return toolCalls
    .filter((call) => call.type === 'function' && call.function)
    .map((call) => ({
      id: call.id,
      name: (call as any).function.name,
      input: JSON.parse((call as any).function.arguments || '{}'),
    }));
}

/**
 * Convert Gemini function calls to unified format
 */
export function fromGeminiFunctionCalls(parts: any[]): AIToolCall[] {
  const calls: AIToolCall[] = [];

  for (const part of parts) {
    if (part.functionCall) {
      calls.push({
        id: `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: part.functionCall.name,
        input: part.functionCall.args || {},
      });
    }
  }

  return calls;
}

// ============================================================================
// To Provider Format - Tool Results
// ============================================================================

/**
 * Convert unified tool results to Anthropic format
 */
export function toAnthropicToolResults(
  results: AIToolResult[]
): Anthropic.ToolResultBlockParam[] {
  return results.map((result) => ({
    type: 'tool_result' as const,
    tool_use_id: result.toolUseId,
    content: result.content,
    is_error: result.isError,
  }));
}

/**
 * Convert unified tool results to OpenAI format
 */
export function toOpenAIToolResults(
  results: AIToolResult[]
): OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] {
  return results.map((result) => ({
    role: 'tool' as const,
    tool_call_id: result.toolUseId,
    content: result.content,
  }));
}

/**
 * Convert unified tool results to Gemini format
 */
export function toGeminiToolResults(results: AIToolResult[]): any {
  return {
    role: 'function',
    parts: results.map((result) => ({
      functionResponse: {
        name: result.toolUseId, // Gemini uses function name, but we store ID
        response: {
          content: result.content,
          error: result.isError || false,
        },
      },
    })),
  };
}

// ============================================================================
// Content Block Conversion
// ============================================================================

/**
 * Convert unified content blocks to Anthropic format
 */
export function toAnthropicContent(
  content: string | AIContentBlock[]
): Anthropic.ContentBlockParam[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content.map((block) => {
    switch (block.type) {
      case 'text':
        return { type: 'text' as const, text: block.text };
      case 'image':
        if (block.source.type === 'base64') {
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: (block.source.mediaType || 'image/png') as
                | 'image/jpeg'
                | 'image/png'
                | 'image/gif'
                | 'image/webp',
              data: block.source.data || '',
            },
          };
        }
        // URL images - convert to base64 would be needed
        return { type: 'text' as const, text: `[Image: ${block.source.url}]` };
      case 'tool_use':
        return {
          type: 'tool_use' as const,
          id: block.id,
          name: block.name,
          input: block.input,
        };
      case 'tool_result':
        return {
          type: 'tool_result' as const,
          tool_use_id: block.toolUseId,
          content: block.content,
          is_error: block.isError,
        };
      default:
        return { type: 'text' as const, text: '' };
    }
  });
}

/**
 * Convert Anthropic content blocks to unified format
 */
export function fromAnthropicContent(
  blocks: Anthropic.ContentBlock[]
): AIContentBlock[] {
  return blocks.map((block) => {
    switch (block.type) {
      case 'text':
        return { type: 'text', text: block.text };
      case 'tool_use':
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      default:
        return { type: 'text', text: '' };
    }
  });
}

/**
 * Extract text from content blocks
 */
export function extractText(content: string | AIContentBlock[]): string {
  if (typeof content === 'string') return content;

  return content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('');
}
