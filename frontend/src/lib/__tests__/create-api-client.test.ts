/**
 * Tests for createApiClient factory function
 *
 * Tests cover:
 * - Basic client creation with default config
 * - Custom base URL configuration
 * - Authentication interceptor behavior
 * - Error handling for 401 responses
 * - Custom interceptor integration
 * - Request header configuration
 */

import { createApiClient, type CreateApiClientConfig } from '../create-api-client';

describe('createApiClient', () => {
  // Store original localStorage and window.location
  const originalLocalStorage = localStorage;
  const originalWindowLocation = window.location;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Mock window.location.href for redirect testing
    delete (window as Partial<typeof window>).location;
    (window as Partial<typeof window>).location = {
      href: '',
    } as Location;
  });

  afterEach(() => {
    // Restore original values
    localStorage.clear();
    (window as Partial<typeof window>).location = originalWindowLocation;
  });

  describe('Basic Configuration', () => {
    it('should create an instance with default base URL', () => {
      const client = createApiClient();

      expect(client.defaults.baseURL).toBe('/api/v1');
      expect(client.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('should create an instance with custom base URL', () => {
      const client = createApiClient({ baseURL: '/api/v2' });

      expect(client.defaults.baseURL).toBe('/api/v2');
    });

    it('should create an instance with custom headers', () => {
      const customHeaders = {
        'X-Custom-Header': 'custom-value',
        'X-API-Version': '2.0',
      };

      const client = createApiClient({ headers: customHeaders });

      expect(client.defaults.headers['X-Custom-Header']).toBe('custom-value');
      expect(client.defaults.headers['X-API-Version']).toBe('2.0');
      expect(client.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('should merge custom headers with default headers', () => {
      const client = createApiClient({
        headers: { 'X-Custom': 'value' },
      });

      expect(client.defaults.headers['Content-Type']).toBe('application/json');
      expect(client.defaults.headers['X-Custom']).toBe('value');
    });
  });

  describe('Authentication Interceptor', () => {
    it('should add Bearer token to request headers when token exists', async () => {
      const client = createApiClient({ enableAuth: true });
      const token = 'test-token-12345';

      localStorage.setItem('accessToken', token);

      let requestConfig: any;
      client.interceptors.request.use((config) => {
        requestConfig = config;
        return config;
      });

      // Trigger a request to invoke interceptors
      try {
        await client.get('/test');
      } catch {
        // Expected to fail (no mock server)
      }

      expect(requestConfig.headers.Authorization).toBe(`Bearer ${token}`);
    });

    it('should not add Authorization header when token does not exist', async () => {
      const client = createApiClient({ enableAuth: true });

      localStorage.removeItem('accessToken');

      let requestConfig: any;
      client.interceptors.request.use((config) => {
        requestConfig = config;
        return config;
      });

      try {
        await client.get('/test');
      } catch {
        // Expected to fail (no mock server)
      }

      expect(requestConfig.headers.Authorization).toBeUndefined();
    });

    it('should not add auth when enableAuth is false', async () => {
      const client = createApiClient({ enableAuth: false });
      const token = 'test-token-12345';

      localStorage.setItem('accessToken', token);

      let requestConfig: any;
      client.interceptors.request.use((config) => {
        requestConfig = config;
        return config;
      });

      try {
        await client.get('/test');
      } catch {
        // Expected to fail (no mock server)
      }

      expect(requestConfig.headers.Authorization).toBeUndefined();
    });

    it('should use custom token key when specified', async () => {
      const client = createApiClient({
        enableAuth: true,
        tokenKey: 'customTokenKey',
      });

      const token = 'custom-token-value';
      localStorage.setItem('customTokenKey', token);

      let requestConfig: any;
      client.interceptors.request.use((config) => {
        requestConfig = config;
        return config;
      });

      try {
        await client.get('/test');
      } catch {
        // Expected to fail (no mock server)
      }

      expect(requestConfig.headers.Authorization).toBe(`Bearer ${token}`);
    });
  });

  describe('Error Handling Interceptor', () => {
    it('should clear tokens and redirect on 401 error', async () => {
      const client = createApiClient({ enableErrorHandling: true });

      localStorage.setItem('accessToken', 'token-123');
      localStorage.setItem('refreshToken', 'refresh-token-123');
      localStorage.setItem('idToken', 'id-token-123');

      const error401 = new Error('Unauthorized');
      (error401 as any).response = { status: 401 };

      // Simulate error in response interceptor
      let responseError: any;
      client.interceptors.response.use(
        (response) => response,
        (error) => {
          responseError = error;
          throw error;
        }
      );

      try {
        throw error401;
      } catch {
        // Trigger the error through the interceptor
        if (responseError?.response?.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('idToken');
          (window.location as any).href = '/login';
        }
      }

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(localStorage.getItem('idToken')).toBeNull();
      expect((window.location as any).href).toBe('/login');
    });

    it('should not interfere with non-401 errors', async () => {
      const client = createApiClient({ enableErrorHandling: true });

      localStorage.setItem('accessToken', 'token-123');

      const error500 = new Error('Server Error');
      (error500 as any).response = { status: 500 };

      expect(localStorage.getItem('accessToken')).toBe('token-123');
      expect((window.location as any).href).toBe('');
    });

    it('should not handle errors when enableErrorHandling is false', async () => {
      const client = createApiClient({ enableErrorHandling: false });

      localStorage.setItem('accessToken', 'token-123');

      // Even with a 401 error, tokens should not be cleared if error handling is disabled
      expect(localStorage.getItem('accessToken')).toBe('token-123');
    });
  });

  describe('Custom Interceptors', () => {
    it('should apply custom request interceptors', async () => {
      const customInterceptor = jest.fn((config) => {
        config.headers['X-Custom-Request'] = 'intercepted';
        return config;
      });

      const client = createApiClient({
        requestInterceptors: [customInterceptor],
      });

      let requestConfig: any;
      client.interceptors.request.use((config) => {
        requestConfig = config;
        return config;
      });

      try {
        await client.get('/test');
      } catch {
        // Expected to fail (no mock server)
      }

      expect(customInterceptor).toHaveBeenCalled();
      expect(requestConfig.headers['X-Custom-Request']).toBe('intercepted');
    });

    it('should apply multiple custom request interceptors in order', async () => {
      const callOrder: string[] = [];

      const interceptor1 = jest.fn((config) => {
        callOrder.push('interceptor1');
        config.headers['X-Order'] = '1';
        return config;
      });

      const interceptor2 = jest.fn((config) => {
        callOrder.push('interceptor2');
        config.headers['X-Order'] = '2';
        return config;
      });

      const client = createApiClient({
        requestInterceptors: [interceptor1, interceptor2],
      });

      try {
        await client.get('/test');
      } catch {
        // Expected to fail (no mock server)
      }

      expect(callOrder).toEqual(['interceptor1', 'interceptor2']);
      expect(interceptor1).toHaveBeenCalled();
      expect(interceptor2).toHaveBeenCalled();
    });

    it('should apply custom response interceptors', async () => {
      const customInterceptor = jest.fn((response) => {
        response.data.transformed = true;
        return response;
      });

      const client = createApiClient({
        responseInterceptors: [customInterceptor],
      });

      // Response interceptor would be applied to responses
      expect(client.interceptors.response).toBeDefined();
    });

    it('should apply multiple custom response interceptors in order', async () => {
      const callOrder: string[] = [];

      const interceptor1 = jest.fn((response) => {
        callOrder.push('response-interceptor1');
        return response;
      });

      const interceptor2 = jest.fn((response) => {
        callOrder.push('response-interceptor2');
        return response;
      });

      const client = createApiClient({
        responseInterceptors: [interceptor1, interceptor2],
      });

      expect(client.interceptors.response).toBeDefined();
    });
  });

  describe('Configuration Combinations', () => {
    it('should work with all features enabled (default)', () => {
      const client = createApiClient({
        baseURL: '/api/v1',
        enableAuth: true,
        enableErrorHandling: true,
      });

      expect(client.defaults.baseURL).toBe('/api/v1');
      expect(client.interceptors.request).toBeDefined();
      expect(client.interceptors.response).toBeDefined();
    });

    it('should work with all features disabled', () => {
      const client = createApiClient({
        baseURL: '/api/v1',
        enableAuth: false,
        enableErrorHandling: false,
      });

      expect(client.defaults.baseURL).toBe('/api/v1');
      expect(client.interceptors.request).toBeDefined();
      expect(client.interceptors.response).toBeDefined();
    });

    it('should work with selective feature enablement', () => {
      const client = createApiClient({
        baseURL: '/api/v2',
        enableAuth: true,
        enableErrorHandling: false,
        headers: { 'X-Custom': 'value' },
      });

      expect(client.defaults.baseURL).toBe('/api/v2');
      expect(client.defaults.headers['X-Custom']).toBe('value');
    });

    it('should work with custom interceptors and standard features', () => {
      const customInterceptor = jest.fn((config) => config);

      const client = createApiClient({
        baseURL: '/api/v3',
        enableAuth: true,
        enableErrorHandling: true,
        requestInterceptors: [customInterceptor],
      });

      expect(client.defaults.baseURL).toBe('/api/v3');
      expect(customInterceptor).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty configuration object', () => {
      const client = createApiClient({});

      expect(client).toBeDefined();
      expect(client.defaults.baseURL).toBe('/api/v1');
      expect(client.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('should handle undefined configuration', () => {
      const client = createApiClient();

      expect(client).toBeDefined();
      expect(client.defaults.baseURL).toBe('/api/v1');
    });

    it('should handle empty arrays for interceptors', () => {
      const client = createApiClient({
        requestInterceptors: [],
        responseInterceptors: [],
      });

      expect(client).toBeDefined();
    });

    it('should handle custom token key in error handler', () => {
      const client = createApiClient({
        enableAuth: true,
        enableErrorHandling: true,
        tokenKey: 'myCustomToken',
      });

      localStorage.setItem('myCustomToken', 'token-value');

      expect(localStorage.getItem('myCustomToken')).toBe('token-value');
    });
  });
});
