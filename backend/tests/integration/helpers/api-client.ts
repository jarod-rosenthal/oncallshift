/**
 * API Client for Integration Tests
 *
 * Axios-based HTTP client configured for the test environment.
 * Automatically handles authentication and provides meaningful error messages.
 */

import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';

// Get environment configuration
function getApiBaseUrl(): string {
  return process.env.__INTEGRATION_TEST_API_BASE_URL__ || process.env.API_BASE_URL || 'https://oncallshift.com/api';
}

function getAuthToken(): string | undefined {
  return process.env.__INTEGRATION_TEST_AUTH_TOKEN__;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  response?: any;
}


/**
 * Create an Axios instance configured for integration tests
 */
function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 30000, // 30 second timeout
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // Add auth token to all requests
  client.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Don't intercept errors - let axios throw native errors
  // This preserves error.response for tests that expect it

  return client;
}

// Singleton client instance
let clientInstance: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!clientInstance) {
    clientInstance = createClient();
  }
  return clientInstance;
}

/**
 * Reset the client (useful for tests that need a fresh client)
 */
export function resetClient(): void {
  clientInstance = null;
}

/**
 * GET request
 */
export async function get<T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response: AxiosResponse<T> = await getClient().get(url, config);
  return {
    data: response.data,
    status: response.status,
    headers: response.headers as Record<string, string>,
  };
}

/**
 * POST request
 */
export async function post<T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response: AxiosResponse<T> = await getClient().post(url, data, config);
  return {
    data: response.data,
    status: response.status,
    headers: response.headers as Record<string, string>,
  };
}

/**
 * PUT request
 */
export async function put<T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response: AxiosResponse<T> = await getClient().put(url, data, config);
  return {
    data: response.data,
    status: response.status,
    headers: response.headers as Record<string, string>,
  };
}

/**
 * PATCH request
 */
export async function patch<T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response: AxiosResponse<T> = await getClient().patch(url, data, config);
  return {
    data: response.data,
    status: response.status,
    headers: response.headers as Record<string, string>,
  };
}

/**
 * DELETE request
 */
export async function del<T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response: AxiosResponse<T> = await getClient().delete(url, config);
  return {
    data: response.data,
    status: response.status,
    headers: response.headers as Record<string, string>,
  };
}

/**
 * Check if an error is an API error with a specific status code
 */
export function isApiError(error: any, status?: number): boolean {
  const apiError = error?.apiError as ApiError | undefined;
  if (!apiError) return false;
  if (status !== undefined) {
    return apiError.status === status;
  }
  return true;
}

/**
 * Get the API error details from an error
 */
export function getApiErrorDetails(error: any): ApiError | undefined {
  return error?.apiError;
}

// Default export for convenience
export default {
  get,
  post,
  put,
  patch,
  delete: del,
  resetClient,
  isApiError,
  getApiErrorDetails,
};
