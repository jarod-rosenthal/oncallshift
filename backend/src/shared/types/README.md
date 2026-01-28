# Core Type Definitions

This module defines the fundamental types and interfaces used throughout the OnCallShift API, including user context, authentication, and API request/response patterns.

## Table of Contents

1. [Authentication Types](#authentication-types)
2. [User Types](#user-types)
3. [API Request Types](#api-request-types)
4. [API Response Types](#api-response-types)
5. [Usage Examples](#usage-examples)
6. [Permission & Scope Types](#permission--scope-types)

## Authentication Types

### `AuthMethod`

Represents the three supported authentication methods:

```typescript
type AuthMethod = 'jwt' | 'api_key' | 'service_key';
```

- **`jwt`**: Cognito JWT token from mobile/web app (user login)
- **`api_key`**: Organization API key (`Bearer org_*` prefix) for programmatic access
- **`service_key`**: Service-specific API key (deprecated, for backwards compatibility)

### `AuthenticatedSubject`

Union type representing the different entities that can authenticate:

```typescript
type AuthenticatedSubject = User | Service | OrganizationApiKey;
```

## User Types

### `BaseRole`

Organizational role hierarchy for RBAC:

```typescript
type BaseRole = 'owner' | 'admin' | 'manager' | 'responder' | 'observer' | 'restricted_access' | 'limited_stakeholder';
```

**Hierarchy (most to least privileged):**
- `owner` - Full control of organization
- `admin` - Most administrative functions
- `manager` - Can create/manage resources and users
- `responder` - Can handle incidents and be on-call
- `observer` - Read-only access to incidents
- `restricted_access` - Limited access to specific resources
- `limited_stakeholder` - External stakeholder with minimal access

### `PlatformRole`

Platform-level roles (separate from organizational roles):

```typescript
type PlatformRole = 'super_admin' | 'admin' | 'member';
```

- `super_admin` - OnCallShift internal admin (AI Workers Control Center access)
- `admin` - Organization administrator
- `member` - Regular organization member

### `UserProfile`

Complete user profile data returned to the user:

```typescript
interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  profilePictureUrl: string | null;
  role: PlatformRole;
  baseRole: BaseRole;
  status: UserStatus;
  settings: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
  };
  aiCredentials?: {
    configured: boolean;
    type?: 'api_key' | 'oauth';
    hint?: string;
    updatedAt?: Date;
  };
  dndEnabled: boolean;
  dndStartTime: string | null;
  dndEndTime: string | null;
  dndTimezone: string | null;
}
```

### `UserInfo`

Minimal user information for list responses:

```typescript
interface UserInfo {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  baseRole: BaseRole;
  status: UserStatus;
}
```

## API Request Types

### `AuthenticatedRequest`

Extended Express Request with authentication context:

```typescript
interface AuthenticatedRequest extends Request {
  user?: User;                    // Present for JWT auth
  service?: Service;              // Present for service key auth
  organizationApiKey?: OrganizationApiKey;  // Present for org API key auth
  orgId?: string;                 // Always present (from user/service/key)
  apiKeyScopes?: string[];        // Only for org API keys
  authMethod?: AuthMethod;        // Which auth method was used
}
```

### Type Guards

Helper functions to safely check request authentication type:

```typescript
// Check if request is authenticated as a user (JWT)
if (isUserAuthenticated(req)) {
  const user: User = req.user; // TypeScript knows user is present
}

// Check if request is authenticated as a service
if (isServiceAuthenticated(req)) {
  const service: Service = req.service;
}

// Check if request is authenticated with org API key
if (isOrgApiKeyAuthenticated(req)) {
  const key: OrganizationApiKey = req.organizationApiKey;
}

// Check if request is authenticated (any method)
if (isAuthenticated(req)) {
  const orgId: string = req.orgId;
}
```

### Helper Functions

Extract context safely from requests:

```typescript
// Get organization ID (throws if not authenticated)
const orgId = getOrgId(req);

// Get user (throws if not authenticated as user)
const user = getUser(req);

// Get the authenticated subject (user, service, or key)
const subject = getAuthSubject(req);
```

## API Response Types

### `ApiResponse<T>`

Standard success response wrapper:

```typescript
interface ApiResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
    version: string;
  };
}
```

**Example:**
```typescript
router.get('/users/me', async (req: AuthenticatedRequest, res: Response) => {
  const user = getUser(req);
  res.json({
    data: user,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0'
    }
  } as ApiResponse<UserProfile>);
});
```

### `PaginatedApiResponse<T>`

Paginated list response:

```typescript
interface PaginatedApiResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
}
```

### `ErrorResponse`

Standard error format:

```typescript
interface ErrorResponse {
  error: string;        // Machine-readable error code
  message: string;      // Human-readable message
  code?: string;        // Optional error code
  details?: Record<string, any>;
  timestamp?: string;
}
```

## Usage Examples

### Route Handler with Proper Type Safety

```typescript
import { Router, Response } from 'express';
import { authenticateRequest } from '../../shared/auth/middleware';
import {
  AuthenticatedRequest,
  isUserAuthenticated,
  getUser,
  ApiResponse,
  UserProfile
} from '../../shared/types';

const router = Router();

// Type-safe route handler
router.get(
  '/users/me',
  authenticateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Type guard ensures user is present
      if (!isUserAuthenticated(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = getUser(req); // Type is User (not User | undefined)
      const orgId = req.orgId!; // We know it's present

      res.json({
        data: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          // ... other fields
        }
      } as ApiResponse<UserProfile>);
    } catch (error) {
      res.status(500).json({ error: 'internal_error', message: 'Failed to fetch profile' });
    }
  }
);
```

### Multi-Auth Endpoint

```typescript
router.post(
  '/webhooks/incident',
  authenticateRequest,  // Accepts JWT, service key, or org API key
  async (req: AuthenticatedRequest, res: Response) => {
    const orgId = getOrgId(req);

    // Handle different auth methods differently
    if (req.authMethod === 'jwt') {
      const user = getUser(req);
      logger.info('Incident webhook received from user', { userId: user.id });
    } else if (req.authMethod === 'api_key') {
      logger.info('Incident webhook received via org API key');
    } else {
      logger.info('Incident webhook received via service key');
    }

    // Proceed with webhook processing
    // ...
  }
);
```

### Enforcing Scope for API Keys

```typescript
import { requireScope } from '../../shared/auth/middleware';

// This endpoint requires 'services:write' scope
router.post(
  '/services',
  authenticateRequest,
  requireScope('services:write'),  // JWT auth bypasses; API keys must have scope
  async (req: AuthenticatedRequest, res: Response) => {
    const orgId = getOrgId(req);
    // Create service...
  }
);

// Check scope conditionally in handler
router.get(
  '/services',
  authenticateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    const { hasScope } = require('../../shared/auth/middleware');

    if (hasScope(req, 'services:write')) {
      // Include sensitive fields for users with write access
    }
  }
);
```

## Permission & Scope Types

### `ApiScope`

Scope format for organization API keys: `"resource:action"`

**Examples:**
```typescript
'services:read'      // Can read services
'services:write'     // Can create/update services (implies read)
'incidents:read'     // Can read incidents
'incidents:write'    // Can create/update/acknowledge incidents
'users:read'         // Can list users
'*'                  // Grant all permissions
```

**Scope Inference:**
- `write` scopes automatically grant `read` access
- Wildcard `*` grants everything

### Built-in Scopes

The following scopes are commonly used:

| Scope | Purpose |
|-------|---------|
| `incidents:read` | View incidents |
| `incidents:write` | Create, update, acknowledge incidents |
| `services:read` | View services |
| `services:write` | Create, update services |
| `schedules:read` | View on-call schedules |
| `schedules:write` | Create, update schedules |
| `users:read` | List organization users |
| `users:write` | Create, update, delete users |
| `webhooks:write` | Send webhooks (for external systems) |
| `*` | All permissions |

## Best Practices

### 1. Always Use Type Guards

```typescript
// ❌ AVOID - Type is unsafe
const orgId = req.orgId;

// ✅ PREFER - Use helper functions
const orgId = getOrgId(req);

// ✅ PREFER - Use type guards
if (isUserAuthenticated(req)) {
  const user = req.user; // Type is User (not User | undefined)
}
```

### 2. Separate User vs Service Logic

```typescript
// Handle user auth differently from service auth
if (isUserAuthenticated(req)) {
  // User-specific logic
  await logUserAction(req.user.id, action);
} else if (isServiceAuthenticated(req)) {
  // Service-specific logic
  await logServiceAction(req.service.id, action);
}
```

### 3. Use `authenticateRequest` for Multi-Auth

Always use `authenticateRequest` middleware instead of individual auth methods:

```typescript
// ❌ AVOID - Only accepts JWT
router.get('/users', authenticateUser, handler);

// ✅ PREFER - Accepts JWT, API keys, service keys
router.get('/users', authenticateRequest, handler);
```

### 4. Validate Scopes for API Key Access

```typescript
// For API key-authenticated endpoints, always check scopes
router.post(
  '/services',
  authenticateRequest,
  requireScope('services:write'),  // Enforces scope check
  handler
);
```

### 5. Multi-Tenant Isolation

Always scope queries by organization:

```typescript
const services = await repo.find({
  where: {
    orgId: getOrgId(req)  // Always required!
  }
});
```

## Migration Guide

### From Old Code

If migrating existing code to use these types:

```typescript
// Old
const user = req.user as User;
const orgId = req.orgId as string;

// New
const user = getUser(req);
const orgId = getOrgId(req);
```

```typescript
// Old
if (req.authMethod === 'jwt') { ... }

// New
if (isUserAuthenticated(req)) { ... }
```
