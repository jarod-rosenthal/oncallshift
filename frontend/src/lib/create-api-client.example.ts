/**
 * Examples of using the createApiClient factory
 *
 * This file demonstrates various patterns for creating and configuring API clients
 * in the OnCallShift application. These examples are for documentation purposes.
 *
 * @see CREATE_API_CLIENT.md for comprehensive documentation
 */

import { createApiClient } from './create-api-client';

/**
 * Example 1: Basic API client with defaults
 *
 * Uses:
 * - Base URL: /api/v1
 * - Auth: Enabled (reads from localStorage['accessToken'])
 * - Error handling: Enabled (401 redirects to /login)
 */
export function example1_basicClient() {
  const api = createApiClient();

  return api;
}

/**
 * Example 2: Feature-specific API client with custom base URL
 *
 * Use case: Creating a client for a specific feature's API endpoints
 */
export function example2_featureSpecificClient() {
  const semanticImportApi = createApiClient({
    baseURL: '/api/v1/semantic-import',
  });

  return semanticImportApi;
}

/**
 * Example 3: API client with custom headers
 *
 * Use case: Adding organization-specific headers or API version headers
 */
export function example3_customHeaders() {
  const api = createApiClient({
    headers: {
      'X-API-Version': '2.0',
      'X-Client-ID': 'web-app-v1',
      'X-Organization-ID': 'org-12345',
    },
  });

  return api;
}

/**
 * Example 4: Public API client (no authentication)
 *
 * Use case: Public endpoints that don't require authentication
 */
export function example4_publicApi() {
  const publicApi = createApiClient({
    baseURL: '/api/v1/public',
    enableAuth: false,
  });

  return publicApi;
}

/**
 * Example 5: API client with rate limit handling
 *
 * Use case: APIs that have rate limits and return specific headers
 */
export function example5_withRateLimitHandling() {
  class RateLimitError extends Error {
    remaining: number;
    resetAt?: Date;

    constructor(message: string, remaining: number, resetAt?: Date) {
      super(message);
      this.name = 'RateLimitError';
      this.remaining = remaining;
      this.resetAt = resetAt;
    }
  }

  const api = createApiClient({
    responseInterceptors: [
      (response) => {
        // Parse rate limit headers from successful response
        const remaining = response.headers['x-ratelimit-remaining'];
        if (remaining !== undefined) {
          response.data._rateLimit = {
            remaining: parseInt(remaining as string, 10),
          };
        }
        return response;
      },
    ],
  });

  // Usage:
  // try {
  //   const response = await api.post('/analyze', data);
  //   console.log('Requests remaining:', response.data._rateLimit?.remaining);
  // } catch (error) {
  //   if (axios.isAxiosError(error) && error.response?.status === 429) {
  //     const remaining = error.response.headers['x-ratelimit-remaining'];
  //     throw new RateLimitError(
  //       'Too many requests',
  //       parseInt(remaining as string, 10)
  //     );
  //   }
  //   throw error;
  // }

  return api;
}

/**
 * Example 6: API client with custom request tracking
 *
 * Use case: Adding request IDs or timing information for debugging
 */
export function example6_withRequestTracking() {
  const api = createApiClient({
    requestInterceptors: [
      (config) => {
        // Add request ID for tracing
        config.headers['X-Request-ID'] = generateUUID();
        // Store start time for duration calculation
        (config as any)._startTime = Date.now();
        return config;
      },
    ],
    responseInterceptors: [
      (response) => {
        // Calculate request duration
        const startTime = (response.config as any)._startTime;
        const duration = Date.now() - startTime;
        console.log(
          `[${response.config.method?.toUpperCase()}] ${response.config.url} ` +
          `${response.status} (${duration}ms)`
        );
        return response;
      },
    ],
  });

  return api;
}

/**
 * Example 7: API client with custom error handling
 *
 * Use case: More sophisticated error handling beyond default 401 redirect
 */
export function example7_customErrorHandling() {
  const api = createApiClient({
    enableErrorHandling: false, // Disable default 401 handling
    responseInterceptors: [
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Custom 401 handling
          console.error('Unauthorized - redirecting to login');
          // Clear auth state from your store
          // useAuthStore.getState().clearAuth();
          window.location.href = '/login?reason=unauthorized';
        } else if (error.response?.status === 403) {
          // Handle forbidden
          console.error('Access forbidden');
        } else if (error.response?.status >= 500) {
          // Handle server errors
          console.error('Server error:', error.response.status);
          // Show error notification to user
        } else if (error.code === 'ECONNABORTED') {
          // Handle timeout
          console.error('Request timeout');
        }
        return Promise.reject(error);
      },
    ],
  });

  return api;
}

/**
 * Example 8: Multiple API clients for different services
 *
 * Use case: Application with multiple backend services
 */
export function example8_multipleServices() {
  // Primary API (on-call scheduling)
  const scheduleApi = createApiClient({
    baseURL: '/api/v1/schedules',
  });

  // Analytics service
  const analyticsApi = createApiClient({
    baseURL: '/api/v1/analytics',
  });

  // AI features
  const aiApi = createApiClient({
    baseURL: '/api/v1/ai',
    requestInterceptors: [
      (config) => {
        // AI requests might need special headers
        config.headers['X-AI-Client'] = 'web-v1';
        return config;
      },
    ],
  });

  return { scheduleApi, analyticsApi, aiApi };
}

/**
 * Example 9: API client with automatic retry logic
 *
 * Use case: Retry failed requests with exponential backoff
 */
export function example9_withRetryLogic() {
  let retryCount = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1000;

  const api = createApiClient({
    responseInterceptors: [
      (response) => response,
      (error) => {
        // Don't retry certain status codes
        if (error.response?.status === 401 || error.response?.status === 403) {
          return Promise.reject(error);
        }

        // Check if we should retry
        if (retryCount < MAX_RETRIES && isRetryableError(error)) {
          retryCount++;
          const delayMs = RETRY_DELAY_MS * Math.pow(2, retryCount - 1);
          console.log(`Retrying request (attempt ${retryCount}/${MAX_RETRIES}) in ${delayMs}ms`);

          return new Promise((resolve) => {
            setTimeout(() => {
              // In a real implementation, you'd use axios.request to retry
              resolve(null);
            }, delayMs);
          });
        }

        return Promise.reject(error);
      },
    ],
  });

  function isRetryableError(error: any): boolean {
    // Retry on network errors and 5xx status codes
    return (
      !error.response ||
      (error.response.status >= 500 && error.response.status < 600)
    );
  }

  return api;
}

/**
 * Example 10: API client with request deduplication
 *
 * Use case: Prevent duplicate concurrent requests for the same endpoint
 */
export function example10_withRequestDeduplication() {
  const pendingRequests = new Map<string, Promise<any>>();

  const api = createApiClient({
    requestInterceptors: [
      (config) => {
        // Create request key from method + URL
        const requestKey = `${config.method?.toUpperCase()}:${config.url}`;

        // If request is pending, return cached promise
        if (pendingRequests.has(requestKey)) {
          console.log(`Deduplicating request: ${requestKey}`);
          // In real implementation, would need to handle this differently
        }

        return config;
      },
    ],
    responseInterceptors: [
      (response) => {
        const requestKey = `${response.config.method?.toUpperCase()}:${response.config.url}`;
        pendingRequests.delete(requestKey);
        return response;
      },
    ],
  });

  return api;
}

/**
 * Helper: Generate UUID for request tracking
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Real-world refactoring example: Semantic Import API
 *
 * This shows how the old semanticImportApi.ts can be simplified
 */
export function exampleRealWorld_semanticImportApi() {
  const apiClient = createApiClient();

  // File validation
  export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
  export const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  export function validateImageFile(file: File) {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type "${file.type}"`,
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File too large (${sizeMB}MB)`,
      };
    }

    return { valid: true };
  }

  // API methods
  return {
    analyzeScreenshot: async (request: any) => {
      const response = await apiClient.post(
        '/semantic-import/analyze',
        request
      );
      return response.data;
    },

    naturalLanguageImport: async (request: any) => {
      const response = await apiClient.post(
        '/semantic-import/natural-language',
        request
      );
      return response.data;
    },
  };
}
