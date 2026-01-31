# createApiClient Factory Documentation

## Overview

The `createApiClient` factory function provides a reusable, type-safe way to create Axios instances with standardized authentication, error handling, and interceptor patterns. This eliminates code duplication and provides a single source of truth for API client configuration across the application.

## Problem It Solves

Previously, API client creation was duplicated across the codebase:
- `api-client.ts`: 2,432 lines with ~25 API endpoint groups
- `semanticImportApi.ts`: Repeated auth/error interceptor setup

This factory consolidates the common pattern into a single, testable, reusable function.

## Basic Usage

### Default Configuration

```typescript
import { createApiClient } from '@/lib/create-api-client';

// Creates client with /api/v1 base URL, auth, and error handling
const client = createApiClient();

// Use it
const response = await client.get<User>('/users/1');
const data = await client.post<LoginResponse>('/auth/login', credentials);
```

### Custom Base URL

```typescript
const apiV2 = createApiClient({ baseURL: '/api/v2' });
const semanticApi = createApiClient({ baseURL: '/api/v1/semantic-import' });
```

### Custom Headers

```typescript
const client = createApiClient({
  headers: {
    'X-API-Version': '2.0',
    'X-Client-ID': 'web-app',
  },
});
```

## Advanced Configuration

### Disabling Features

```typescript
// Disable auth for public endpoints
const publicApi = createApiClient({ enableAuth: false });

// Disable error handling for custom 401 logic
const customErrorApi = createApiClient({ enableErrorHandling: false });

// Both
const bareApi = createApiClient({
  enableAuth: false,
  enableErrorHandling: false,
});
```

### Custom Token Key

If you need to use a different token storage key:

```typescript
const client = createApiClient({
  tokenKey: 'myOrgToken',  // Uses localStorage['myOrgToken']
});
```

### Custom Request Interceptors

Add preprocessing to all requests:

```typescript
const client = createApiClient({
  requestInterceptors: [
    (config) => {
      // Add request ID for tracing
      config.headers['X-Request-ID'] = generateUUID();
      return config;
    },
    (config) => {
      // Add timestamp
      config.headers['X-Request-Time'] = new Date().toISOString();
      return config;
    },
  ],
});
```

### Custom Response Interceptors

Process responses or handle specific status codes:

```typescript
const client = createApiClient({
  responseInterceptors: [
    (response) => {
      // Log successful responses
      console.log(`${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
      return response;
    },
    (response) => {
      // Transform response data
      response.data = {
        ...response.data,
        timestamp: new Date(),
      };
      return response;
    },
  ],
});
```

### Handling Rate Limiting

```typescript
class RateLimitError extends Error {
  constructor(public remaining: number, public resetAt?: Date) {
    super('Rate limit exceeded');
  }
}

const client = createApiClient({
  responseInterceptors: [
    (response) => {
      // Parse rate limit headers
      const remaining = response.headers['x-ratelimit-remaining'];
      if (remaining !== undefined) {
        response.data._rateLimit = {
          remaining: parseInt(remaining),
        };
      }
      return response;
    },
  ],
});

// Handle rate limits
try {
  await client.post('/analyze', data);
} catch (error) {
  if (error.response?.status === 429) {
    const remaining = error.response.headers['x-ratelimit-remaining'];
    throw new RateLimitError(parseInt(remaining || '0'));
  }
  throw error;
}
```

## Real-World Example: Feature-Specific API Client

Refactoring `semanticImportApi.ts`:

**Before:**
```typescript
// 55 lines of boilerplate (interceptors, validation, etc.)
const apiClient = axios.create({ baseURL: '/api/v1' });
apiClient.interceptors.request.use(/* auth logic */);
apiClient.interceptors.response.use(/* error handling */);

export const semanticImportAPI = {
  analyzeScreenshot: async (request: AnalyzeScreenshotRequest) => {
    // ...
  },
};
```

**After:**
```typescript
import { createApiClient } from '@/lib/create-api-client';

const apiClient = createApiClient();

// Custom rate limit error handling
class RateLimitError extends Error {
  constructor(public remaining: number, public resetAt?: Date) {
    super('Rate limit exceeded');
  }
}

export const semanticImportAPI = {
  analyzeScreenshot: async (request: AnalyzeScreenshotRequest) => {
    try {
      const response = await apiClient.post<AnalyzeScreenshotResponse>(
        '/semantic-import/analyze',
        request
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        throw new RateLimitError(
          parseInt(error.response.headers['x-ratelimit-remaining'] || '0'),
          new Date(error.response.headers['x-ratelimit-reset'] || '')
        );
      }
      throw error;
    }
  },
};
```

**Reduction:** ~55 lines → ~35 lines (36% less boilerplate)

## Type Safety

The factory is fully typed with TypeScript:

```typescript
import { createApiClient, CreateApiClientConfig } from '@/lib/create-api-client';
import type { AxiosInstance } from 'axios';

// Create with full type inference
const client = createApiClient({
  baseURL: '/api/v1',
  headers: { 'X-Custom': 'value' },
  enableAuth: true,
  tokenKey: 'accessToken',
});

// Use with response types
interface User {
  id: string;
  name: string;
  email: string;
}

const { data: user } = await client.get<User>('/users/1');
```

## Authentication Flow

The factory automatically handles authentication:

1. **Request Interceptor** (when `enableAuth: true`):
   - Reads token from `localStorage[tokenKey]` (default: `'accessToken'`)
   - Adds `Authorization: Bearer <token>` header to all requests
   - Only adds if token exists (optional auth)

2. **Response Interceptor** (when `enableErrorHandling: true`):
   - Detects 401 (Unauthorized) responses
   - Clears all auth tokens from localStorage
   - Redirects user to `/login`
   - Other errors pass through unchanged

## Error Handling

### Default Behavior

```typescript
const client = createApiClient({ enableErrorHandling: true });

try {
  await client.get('/protected-resource');
} catch (error) {
  if (error.response?.status === 401) {
    // Already handled by interceptor
    // User is redirected, tokens cleared
  } else if (error.response?.status === 404) {
    // Handle not found
  } else if (error.response?.status >= 500) {
    // Handle server error
  } else if (error.code === 'ECONNABORTED') {
    // Handle timeout
  }
}
```

### Custom Error Handling

```typescript
const client = createApiClient({
  enableErrorHandling: false,  // Disable default handler
  responseInterceptors: [
    (response) => response,
    (error) => {
      // Custom 401 logic
      if (error.response?.status === 401) {
        // Custom handling
      }
      return Promise.reject(error);
    },
  ],
});
```

## Migration Guide

### Converting Old API Clients to Use Factory

**Step 1:** Identify the old pattern
```typescript
const apiClient = axios.create({ baseURL: '/api/v1' });
apiClient.interceptors.request.use(/* auth */);
apiClient.interceptors.response.use(/* errors */);
```

**Step 2:** Replace with factory
```typescript
import { createApiClient } from '@/lib/create-api-client';
const apiClient = createApiClient();
```

**Step 3:** Add any custom interceptors
```typescript
const apiClient = createApiClient({
  requestInterceptors: [yourCustomInterceptor],
  responseInterceptors: [yourErrorHandler],
});
```

### Timeline for Integration

1. **Phase 1:** Use factory for new API clients
2. **Phase 2:** Refactor feature-specific clients (semantic-import, etc.)
3. **Phase 3:** Consider modularizing main api-client.ts by domain

## Testing

The factory includes comprehensive unit tests:

```bash
npm test -- --testPathPattern="create-api-client"
```

### Test Coverage

- ✅ Default configuration
- ✅ Custom base URL
- ✅ Custom headers
- ✅ Authentication interceptor
- ✅ Error handling (401 redirect)
- ✅ Custom request interceptors
- ✅ Custom response interceptors
- ✅ Multiple interceptors in order
- ✅ Configuration combinations
- ✅ Edge cases (empty config, undefined, etc.)

## API Reference

### `createApiClient(config?: CreateApiClientConfig): AxiosInstance`

Creates a configured Axios instance.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `config` | `CreateApiClientConfig` | `{}` | Configuration options |
| `config.baseURL` | `string` | `'/api/v1'` | Base URL for all requests |
| `config.headers` | `Record<string, string>` | `{}` | Custom headers to merge with defaults |
| `config.enableAuth` | `boolean` | `true` | Add Bearer token auth header |
| `config.enableErrorHandling` | `boolean` | `true` | Handle 401 with redirect |
| `config.tokenKey` | `string` | `'accessToken'` | localStorage key for token |
| `config.requestInterceptors` | `Array<(config) => config>` | `[]` | Request interceptors to apply |
| `config.responseInterceptors` | `Array<(response) => response>` | `[]` | Response interceptors to apply |

#### Returns

`AxiosInstance` - Configured Axios instance with all interceptors set up.

## Performance Considerations

- **Interceptor Order:** Auth interceptor runs before custom request interceptors
- **Error Handler:** Default error handler runs before custom response interceptors
- **Token Lookup:** Token is read from localStorage on every request (acceptable for web)
- **No Caching:** Factory creates new instance each call (create once, reuse)

## Security Considerations

- ✅ **Token Storage:** Uses localStorage (standard for web apps)
- ✅ **HTTPS Only:** Token added to all requests (ensure HTTPS in production)
- ✅ **401 Handling:** Clears all tokens on auth failure
- ✅ **No Secrets in Code:** Tokens read from storage, not hardcoded
- ⚠️ **XSS Risk:** localStorage is vulnerable to XSS (use CSP headers)

## Troubleshooting

### Tokens Not Being Added

```typescript
// Check 1: Token exists in localStorage
console.log(localStorage.getItem('accessToken'));

// Check 2: enableAuth is true
const client = createApiClient({ enableAuth: true });

// Check 3: Custom token key matches storage key
const client = createApiClient({ tokenKey: 'myTokenKey' });
```

### 401 Redirects Not Working

```typescript
// Check 1: enableErrorHandling is true
const client = createApiClient({ enableErrorHandling: true });

// Check 2: window.location is not mocked (common in tests)
// In tests, mock window.location before creating client

// Check 3: Server is actually returning 401
console.log('Response status:', error.response?.status);
```

### Custom Interceptors Not Running

```typescript
// Interceptors run in order added
const client = createApiClient({
  requestInterceptors: [
    (config) => { console.log('1'); return config; },
    (config) => { console.log('2'); return config; },
  ],
  // Logs: "1", then "2"
});
```

## Future Enhancements

Possible future improvements:

- [ ] Built-in retry logic with exponential backoff
- [ ] Request/response logging middleware
- [ ] Automatic request deduplication (avoid duplicate concurrent requests)
- [ ] Built-in timeout handling
- [ ] Response caching with TTL
- [ ] Request queuing for offline support
