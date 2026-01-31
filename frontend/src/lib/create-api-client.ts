/**
 * Generic API Client Factory
 *
 * Provides a reusable factory function for creating type-safe Axios instances
 * with standard authentication, error handling, and interceptor patterns.
 *
 * Usage:
 *   const client = createApiClient({ baseURL: '/api/v1' });
 *   const response = await client.get<User>('/users/1');
 *
 * With custom interceptors:
 *   const client = createApiClient({
 *     baseURL: '/api/v1',
 *     requestInterceptors: [
 *       (config) => { config.headers['X-Custom'] = 'value'; return config; }
 *     ]
 *   });
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Configuration for creating an API client
 */
export interface CreateApiClientConfig {
  /**
   * Base URL for all requests (default: '/api/v1')
   */
  baseURL?: string;

  /**
   * Custom headers to add to all requests
   */
  headers?: Record<string, string>;

  /**
   * Custom request interceptor functions
   * Each interceptor receives the config and must return it (or Promise<config>)
   */
  requestInterceptors?: Array<
    (config: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>
  >;

  /**
   * Custom response interceptor functions
   * Each interceptor receives the response and must return it (or Promise<response>)
   */
  responseInterceptors?: Array<
    (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>
  >;

  /**
   * Whether to enable default authentication (Bearer token from localStorage)
   * Default: true
   */
  enableAuth?: boolean;

  /**
   * Whether to enable default error handling (401 redirect to /login)
   * Default: true
   */
  enableErrorHandling?: boolean;

  /**
   * Token storage key for authentication
   * Default: 'accessToken'
   */
  tokenKey?: string;
}

/**
 * Creates a configured Axios instance with standard authentication and error handling
 *
 * @param config Configuration options for the API client
 * @returns Configured Axios instance ready for use
 *
 * @example
 * // Basic usage with defaults
 * const api = createApiClient();
 *
 * @example
 * // With custom base URL
 * const api = createApiClient({ baseURL: '/api/v2' });
 *
 * @example
 * // With custom interceptors
 * const api = createApiClient({
 *   requestInterceptors: [
 *     (config) => {
 *       config.headers['X-Request-ID'] = generateId();
 *       return config;
 *     }
 *   ]
 * });
 */
export function createApiClient(config: CreateApiClientConfig = {}): AxiosInstance {
  const {
    baseURL = '/api/v1',
    headers = {},
    requestInterceptors = [],
    responseInterceptors = [],
    enableAuth = true,
    enableErrorHandling = true,
    tokenKey = 'accessToken',
  } = config;

  // Create Axios instance with base configuration
  const instance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  // Add default authentication interceptor if enabled
  if (enableAuth) {
    instance.interceptors.request.use(
      (requestConfig) => {
        const token = localStorage.getItem(tokenKey);
        if (token) {
          requestConfig.headers.Authorization = `Bearer ${token}`;
        }
        return requestConfig;
      },
      (error) => Promise.reject(error)
    );
  }

  // Add custom request interceptors
  requestInterceptors.forEach((interceptor) => {
    instance.interceptors.request.use(interceptor, (error) => Promise.reject(error));
  });

  // Add default error handling interceptor if enabled
  if (enableErrorHandling) {
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear all auth tokens
          localStorage.removeItem(tokenKey);
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('idToken');
          // Redirect to login
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Add custom response interceptors
  responseInterceptors.forEach((interceptor) => {
    instance.interceptors.response.use(interceptor, (error) => Promise.reject(error));
  });

  return instance;
}

export default createApiClient;
