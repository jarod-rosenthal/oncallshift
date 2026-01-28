/**
 * Semantic Import API Client
 * Type-safe API wrapper for semantic import endpoints
 */
import axios from 'axios';
import { createApiClient } from '@/lib/create-api-client';
import type {
  AnalyzeScreenshotRequest,
  AnalyzeScreenshotResponse,
  NaturalLanguageImportRequest,
  NaturalLanguageImportResponse,
  PreviewImportRequest,
  PreviewImportResponse,
  ExecuteImportRequest,
  ExecuteImportResponse,
  ImportTemplatesResponse,
  ImportHistoryResponse,
  ImportHistoryFilters,
  ImportDetailResponse,
} from '../types';

// Create API client with built-in authentication and error handling
const apiClient = createApiClient();

// File validation constants
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Validate an image file before upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type "${file.type}". Allowed types: PNG, JPEG, WebP`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File too large (${sizeMB}MB). Maximum size is 10MB.`,
    };
  }

  return { valid: true };
}

/**
 * Convert a File to base64 string (without data URI prefix)
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URI prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Parse rate limit headers from response
 */
function parseRateLimitHeaders(headers: Record<string, string>): {
  remaining?: number;
  resetAt?: Date;
} {
  const remaining = headers['x-ratelimit-remaining'];
  const resetTimestamp = headers['x-ratelimit-reset'];

  return {
    remaining: remaining ? parseInt(remaining, 10) : undefined,
    resetAt: resetTimestamp ? new Date(parseInt(resetTimestamp, 10) * 1000) : undefined,
  };
}

/**
 * Custom error class for rate limit errors
 */
export class RateLimitError extends Error {
  remaining: number;
  resetAt?: Date;

  constructor(message: string, remaining: number, resetAt?: Date) {
    super(message);
    this.name = 'RateLimitError';
    this.remaining = remaining;
    this.resetAt = resetAt;
  }
}

/**
 * Semantic Import API
 */
export const semanticImportAPI = {
  /**
   * Analyze a screenshot using Claude Vision
   */
  analyzeScreenshot: async (
    request: AnalyzeScreenshotRequest
  ): Promise<AnalyzeScreenshotResponse> => {
    try {
      const response = await apiClient.post<AnalyzeScreenshotResponse>(
        '/semantic-import/analyze',
        request
      );

      const rateLimit = parseRateLimitHeaders(response.headers as Record<string, string>);
      return {
        ...response.data,
        rateLimitRemaining: rateLimit.remaining,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const rateLimit = parseRateLimitHeaders(error.response.headers as Record<string, string>);
        throw new RateLimitError(
          error.response.data?.error || 'Rate limit exceeded. Please try again later.',
          rateLimit.remaining || 0,
          rateLimit.resetAt
        );
      }
      throw error;
    }
  },

  /**
   * Analyze a screenshot from a File object
   */
  analyzeScreenshotFile: async (
    file: File,
    sourceType?: AnalyzeScreenshotRequest['sourceType'],
    contentType?: AnalyzeScreenshotRequest['contentType']
  ): Promise<AnalyzeScreenshotResponse> => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const base64 = await fileToBase64(file);
    return semanticImportAPI.analyzeScreenshot({
      image: base64,
      sourceType,
      contentType,
    });
  },

  /**
   * Import configuration from natural language description
   */
  naturalLanguageImport: async (
    request: NaturalLanguageImportRequest
  ): Promise<NaturalLanguageImportResponse> => {
    try {
      const response = await apiClient.post<NaturalLanguageImportResponse>(
        '/semantic-import/natural-language',
        request
      );
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const rateLimit = parseRateLimitHeaders(error.response.headers as Record<string, string>);
        throw new RateLimitError(
          error.response.data?.error || 'Rate limit exceeded. Please try again later.',
          rateLimit.remaining || 0,
          rateLimit.resetAt
        );
      }
      throw error;
    }
  },

  /**
   * Preview what will be created before executing import
   */
  previewImport: async (request: PreviewImportRequest): Promise<PreviewImportResponse> => {
    const response = await apiClient.post<PreviewImportResponse>(
      '/semantic-import/preview',
      request
    );
    return response.data;
  },

  /**
   * Execute the import
   */
  executeImport: async (request: ExecuteImportRequest): Promise<ExecuteImportResponse> => {
    const response = await apiClient.post<ExecuteImportResponse>(
      '/semantic-import/execute',
      request
    );
    return response.data;
  },

  /**
   * Get example templates for natural language import
   */
  getTemplates: async (): Promise<ImportTemplatesResponse> => {
    const response = await apiClient.get<ImportTemplatesResponse>('/semantic-import/templates');
    return response.data;
  },

  /**
   * Get import history
   */
  getHistory: async (filters?: ImportHistoryFilters): Promise<ImportHistoryResponse> => {
    const params: Record<string, string | number> = {};

    if (filters?.status) params.status = filters.status;
    if (filters?.sourceType) params.sourceType = filters.sourceType;
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.page) params.page = filters.page;
    if (filters?.pageSize) params.pageSize = filters.pageSize;

    const response = await apiClient.get<ImportHistoryResponse>('/semantic-import/history', {
      params,
    });
    return response.data;
  },

  /**
   * Get details of a specific import
   */
  getImportDetail: async (importId: string): Promise<ImportDetailResponse> => {
    const response = await apiClient.get<ImportDetailResponse>(`/semantic-import/${importId}`);
    return response.data;
  },
};

export default semanticImportAPI;
