/**
 * Unified AI Provider Types
 *
 * This module defines provider-agnostic interfaces for AI chat, streaming,
 * and tool calling that work across Anthropic, OpenAI, and Google Gemini.
 */

import { AIProvider } from '../../models/CloudCredential';

// ============================================================================
// Message Types
// ============================================================================

export type AIRole = 'system' | 'user' | 'assistant';

export interface AITextContent {
  type: 'text';
  text: string;
}

export interface AIImageContent {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    mediaType?: string;
    data?: string;
    url?: string;
  };
}

export interface AIToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AIToolResultContent {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type AIContentBlock =
  | AITextContent
  | AIImageContent
  | AIToolUseContent
  | AIToolResultContent;

export interface AIMessage {
  role: AIRole;
  content: string | AIContentBlock[];
}

// ============================================================================
// Tool Types (Anthropic-style as canonical format)
// ============================================================================

export interface AIToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: AIToolParameter;
  properties?: Record<string, AIToolParameter>;
  required?: string[];
}

export interface AITool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, AIToolParameter>;
    required?: string[];
  };
}

export interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AIToolResult {
  toolUseId: string;
  content: string;
  isError?: boolean;
}

// ============================================================================
// Streaming Event Types
// ============================================================================

export interface AIStreamTextEvent {
  type: 'text';
  content: string;
}

export interface AIStreamToolCallStartEvent {
  type: 'tool_call_start';
  id: string;
  name: string;
}

export interface AIStreamToolCallDeltaEvent {
  type: 'tool_call_delta';
  id: string;
  inputDelta: string;
}

export interface AIStreamToolCallEndEvent {
  type: 'tool_call_end';
  id: string;
  input: Record<string, unknown>;
}

export interface AIStreamDoneEvent {
  type: 'done';
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage?: AIUsage;
}

export interface AIStreamErrorEvent {
  type: 'error';
  error: string;
}

export type AIStreamEvent =
  | AIStreamTextEvent
  | AIStreamToolCallStartEvent
  | AIStreamToolCallDeltaEvent
  | AIStreamToolCallEndEvent
  | AIStreamDoneEvent
  | AIStreamErrorEvent;

// ============================================================================
// Response Types
// ============================================================================

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AIResponse {
  content: AIContentBlock[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage: AIUsage;
  model: string;
}

// ============================================================================
// Request Options
// ============================================================================

export interface AIChatOptions {
  model: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  system?: string;
  tools?: AITool[];
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface AIProviderAdapter {
  /**
   * Provider identifier
   */
  readonly provider: AIProvider;

  /**
   * Non-streaming chat completion
   */
  chat(messages: AIMessage[], options: AIChatOptions): Promise<AIResponse>;

  /**
   * Streaming chat completion
   */
  streamChat(
    messages: AIMessage[],
    options: AIChatOptions
  ): AsyncGenerator<AIStreamEvent>;

  /**
   * Validate an API key
   */
  validateKey(apiKey: string): Promise<boolean>;

  /**
   * Get available models for this provider
   */
  getModels(): AIModelInfo[];
}

// ============================================================================
// Model Information
// ============================================================================

export interface AIModelInfo {
  id: string;
  name: string;
  provider: AIProvider;
  capabilities: AICapability[];
  contextWindow: number;
  maxOutputTokens: number;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
}

export type AICapability = 'chat' | 'code' | 'vision' | 'embeddings' | 'tools';

// ============================================================================
// Factory Types
// ============================================================================

export interface ProviderWithModel {
  adapter: AIProviderAdapter;
  modelId: string;
}
