/**
 * Semantic Import Types
 * Type definitions for the semantic import feature
 */

// Source types for imports
export type ImportSourceType = 'pagerduty' | 'opsgenie' | 'screenshot' | 'natural_language' | 'unknown';
export type ImportContentType = 'schedule' | 'escalation' | 'team' | 'service' | 'auto';
export type ImportStatus = 'pending' | 'analyzing' | 'previewing' | 'executing' | 'completed' | 'failed' | 'rolled_back';

// Team extraction
export interface ExtractedTeamMember {
  name: string;
  email?: string;
  role?: string;
}

export interface ExtractedTeam {
  name: string;
  members: ExtractedTeamMember[];
}

// Schedule extraction
export interface ExtractedScheduleLayer {
  name: string;
  rotationType: string;
  participants: string[];
}

export interface ExtractedScheduleParticipant {
  name: string;
  email?: string;
}

export interface ExtractedSchedule {
  name: string;
  teamName?: string;
  timezone?: string;
  rotationType: 'daily' | 'weekly' | 'custom';
  handoffTime?: string;
  handoffDay?: string;
  participants: ExtractedScheduleParticipant[];
  layers?: ExtractedScheduleLayer[];
}

// Escalation policy extraction
export interface ExtractedEscalationTarget {
  type: 'user' | 'schedule';
  name: string;
}

export interface ExtractedEscalationStep {
  delayMinutes: number;
  targets: ExtractedEscalationTarget[];
}

export interface ExtractedEscalationPolicy {
  name: string;
  steps: ExtractedEscalationStep[];
}

// Service extraction
export interface ExtractedService {
  name: string;
  description?: string;
  escalationPolicyName?: string;
  teamName?: string;
}

// Main extraction result from Claude Vision
export interface ImportExtraction {
  confidence: number; // 0-1
  sourceDetected: ImportSourceType;
  teams: ExtractedTeam[];
  schedules: ExtractedSchedule[];
  escalationPolicies: ExtractedEscalationPolicy[];
  services: ExtractedService[];
  warnings: string[];
  suggestions: string[];
}

// Preview result types
export interface PreviewCreatedItem {
  type: 'team' | 'user' | 'schedule' | 'escalation_policy' | 'service';
  name: string;
  details?: Record<string, unknown>;
}

export interface PreviewSkippedItem {
  type: string;
  name: string;
  reason: string;
}

export interface PreviewConflict {
  type: string;
  name: string;
  existingId: string;
  action: 'skip' | 'update' | 'error';
}

export interface ImportPreviewResult {
  willCreate: PreviewCreatedItem[];
  willSkip: PreviewSkippedItem[];
  conflicts: PreviewConflict[];
  warnings: string[];
  estimatedDuration: number; // seconds
}

// Execution result types
export interface ExecutionCreatedItem {
  type: string;
  name: string;
  id: string;
}

export interface ExecutionSkippedItem {
  type: string;
  name: string;
  reason: string;
}

export interface ExecutionFailedItem {
  type: string;
  name: string;
  error: string;
}

export interface ImportExecutionResult {
  success: boolean;
  created: ExecutionCreatedItem[];
  skipped: ExecutionSkippedItem[];
  failed: ExecutionFailedItem[];
  rollbackPerformed: boolean;
  errorMessage?: string;
}

// Import history entry
export interface ImportHistoryEntry {
  id: string;
  orgId: string;
  userId: string;
  userName?: string;
  sourceType: ImportSourceType;
  contentType?: ImportContentType;
  status: ImportStatus;
  inputSummary?: string; // Brief description of input (not the actual image)
  extractionResult?: ImportExtraction;
  executionResult?: ImportExecutionResult;
  entitiesCreated: number;
  entitiesSkipped: number;
  entitiesFailed: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

// API Request types
export interface AnalyzeScreenshotRequest {
  image: string; // base64-encoded image data
  sourceType?: ImportSourceType;
  contentType?: ImportContentType;
}

export interface NaturalLanguageImportRequest {
  description: string;
}

export interface PreviewImportRequest {
  extraction: ImportExtraction;
}

export interface ExecuteImportRequest {
  extraction: ImportExtraction;
  skipConflicts?: boolean;
}

// API Response types
export interface AnalyzeScreenshotResponse {
  success: boolean;
  extraction?: ImportExtraction;
  error?: string;
  rateLimitRemaining?: number;
}

export interface NaturalLanguageImportResponse {
  success: boolean;
  extraction?: ImportExtraction;
  error?: string;
}

export interface PreviewImportResponse {
  success: boolean;
  preview?: ImportPreviewResult;
  error?: string;
}

export interface ExecuteImportResponse {
  success: boolean;
  result?: ImportExecutionResult;
  importId?: string;
  error?: string;
}

export interface ImportTemplatesResponse {
  templates: ImportTemplate[];
}

export interface ImportTemplate {
  name: string;
  description: string;
  example: string;
  category?: string;
}

export interface ImportHistoryResponse {
  items: ImportHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ImportDetailResponse {
  import: ImportHistoryEntry;
}

// Filter types for history
export interface ImportHistoryFilters {
  status?: ImportStatus;
  sourceType?: ImportSourceType;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// UI state types
export interface ImportWizardState {
  step: 'input' | 'analyze' | 'preview' | 'execute' | 'complete';
  inputType: 'screenshot' | 'natural_language';
  extraction?: ImportExtraction;
  preview?: ImportPreviewResult;
  result?: ImportExecutionResult;
  importId?: string;
  error?: string;
  isLoading: boolean;
}
