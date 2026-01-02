# Terraform Provider Prerequisites Implementation Plan

**Created:** January 2026
**Status:** Planning
**Goal:** Prepare OnCallShift API for Terraform provider development

---

## Executive Summary

This plan addresses the prerequisites needed before building a `terraform-provider-oncallshift`. Based on a comprehensive audit of the current API, four areas require work:

| Prerequisite | Current State | Readiness | Priority |
|--------------|---------------|-----------|----------|
| API Stability & Versioning | v1 API with consistent patterns | 80% | P2 |
| API Authentication | Service-scoped keys only | 30% | **P0** |
| API Documentation (OpenAPI) | 4% endpoint coverage | 10% | **P0** |
| CRUD Completeness | Users resource incomplete | 85% | P1 |

**Estimated Total Effort:** 6-8 weeks
**Critical Path:** Organization API Keys → OpenAPI Documentation → CRUD Gaps

---

## Current State Assessment

### 1. API Stability & Versioning ✅ Mostly Ready

**Strengths:**
- Consistent `/api/v1/` prefix across all 321 endpoints
- Predictable RESTful URL patterns (`/resources`, `/resources/:id`, `/resources/:id/action`)
- Structured error responses with appropriate HTTP status codes
- Input validation via express-validator
- Multi-tenancy enforced via `org_id` scoping

**Gaps:**
- No idempotency key support (critical for Terraform retry safety)
- No ETag/conditional requests (optimistic concurrency)
- No deprecation headers or strategy
- No `Location` header on POST responses

### 2. API Authentication ❌ Major Gap

**Current Implementation:**
- **User JWT (Cognito):** Used for all resource management endpoints
- **Service API Keys:** Format `svc_*`, scoped to individual services, used only for webhook ingestion

**Problem for Terraform:**
- Terraform provider needs organization-level programmatic access
- Cannot use Cognito JWT (requires user credentials)
- Service API keys are too narrow (tied to single service)
- No way to create API tokens programmatically

### 3. API Documentation ❌ Major Gap

**Current Implementation:**
- Swagger UI at `/api-docs` (configured but incomplete)
- Only 14 of 321 endpoints documented (4% coverage)
- Only 4 of 62 models have OpenAPI schemas
- No request/response schema documentation for most endpoints

**Problem for Terraform:**
- Cannot generate Go client from incomplete OpenAPI spec
- Manual client development required without schemas
- No contract for request/response validation

### 4. CRUD Completeness ⚠️ Minor Gaps

**Complete Resources (8/9):**
| Resource | List | Read | Create | Update | Delete |
|----------|:----:|:----:|:------:|:------:|:------:|
| Teams | ✓ | ✓ | ✓ | ✓ | ✓ |
| Services | ✓ | ✓ | ✓ | ✓ | ✓ (soft) |
| Escalation Policies | ✓ | ✓ | ✓ | ✓ | ✓ |
| Schedules | ✓ | ✓ | ✓ | ✓ | ✓ |
| Runbooks | ✓ | ✓ | ✓ | ✓ | ✓ (soft) |
| Integrations | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tags | ✓ | ✓ | ✓ | ✓ | ✓ |
| Heartbeats | ✓ | ✓ | ✓ | ✓ | ✓ |

**Incomplete Resource:**
| Resource | List | Read | Create | Update | Delete |
|----------|:----:|:----:|:------:|:------:|:------:|
| Users | ✓ | ❌ | ✓ (invite) | ✓ (partial) | ❌ |

---

## Implementation Plan

### Phase 1: Organization API Keys (P0)
**Effort:** 1-2 weeks
**Blocked by:** Nothing
**Blocks:** Everything else (provider can't authenticate without this)

#### 1.1 Create OrganizationApiKey Model

```typescript
// backend/src/shared/models/OrganizationApiKey.ts
@Entity('organization_api_keys')
export class OrganizationApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;  // e.g., "terraform-provider", "ci-cd-pipeline"

  @Column({ name: 'key_hash', type: 'varchar', length: 255 })
  keyHash: string;  // bcrypt hash, never store plaintext

  @Column({ name: 'key_prefix', type: 'varchar', length: 12 })
  keyPrefix: string;  // First 8 chars for identification: "org_abc1..."

  @Column({ name: 'scopes', type: 'jsonb', default: '["*"]' })
  scopes: string[];  // ["*"] or ["incidents:read", "services:write"]

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;  // User who created the key

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;
}
```

#### 1.2 Create API Key Management Endpoints

```typescript
// backend/src/api/routes/api-keys.ts

// POST /api/v1/api-keys - Create new org API key (admin only)
// Returns: { apiKey: { id, name, keyPrefix, scopes, createdAt }, token: "org_..." }
// Note: token returned ONLY on creation, never again

// GET /api/v1/api-keys - List org API keys (admin only)
// Returns: { apiKeys: [{ id, name, keyPrefix, scopes, lastUsedAt, createdAt }] }

// DELETE /api/v1/api-keys/:id - Revoke API key (admin only)
// Returns: 204 No Content

// POST /api/v1/api-keys/:id/rotate - Rotate key (admin only)
// Returns: { apiKey: { id, name, keyPrefix }, token: "org_..." }
```

#### 1.3 Extend Authentication Middleware

```typescript
// backend/src/shared/auth/middleware.ts

export async function authenticateOrgApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer org_')) {
    return next(); // Fall through to other auth methods
  }

  const token = authHeader.slice(7);
  const keyPrefix = token.slice(0, 12);

  // Find by prefix, then verify full hash
  const apiKey = await apiKeyRepo.findOne({ where: { keyPrefix } });
  if (!apiKey || !await bcrypt.compare(token, apiKey.keyHash)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return res.status(401).json({ error: 'API key expired' });
  }

  // Update last used
  await apiKeyRepo.update(apiKey.id, { lastUsedAt: new Date() });

  req.orgId = apiKey.orgId;
  req.apiKeyScopes = apiKey.scopes;
  req.authMethod = 'api_key';
  return next();
}

// Update authenticateRequest to try multiple methods
export async function authenticateRequest(req, res, next) {
  // Try org API key first (for Terraform)
  await authenticateOrgApiKey(req, res, () => {});
  if (req.orgId) return next();

  // Try service API key (for webhooks)
  await authenticateApiKey(req, res, () => {});
  if (req.orgId) return next();

  // Fall back to user JWT
  return authenticateUser(req, res, next);
}
```

#### 1.4 Add Scope Checking Middleware

```typescript
// backend/src/shared/auth/scopes.ts

export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.authMethod !== 'api_key') {
      return next(); // User JWT has full access
    }

    const scopes = req.apiKeyScopes || [];
    if (scopes.includes('*') || scopes.includes(scope)) {
      return next();
    }

    return res.status(403).json({
      error: `API key missing required scope: ${scope}`
    });
  };
}

// Usage in routes:
router.get('/', requireScope('services:read'), async (req, res) => {});
router.post('/', requireScope('services:write'), async (req, res) => {});
```

#### 1.5 Database Migration

```sql
-- Create organization_api_keys table
CREATE TABLE organization_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(12) NOT NULL,
  scopes JSONB DEFAULT '["*"]',
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_key_prefix UNIQUE (key_prefix)
);

CREATE INDEX idx_org_api_keys_org_id ON organization_api_keys(org_id);
CREATE INDEX idx_org_api_keys_prefix ON organization_api_keys(key_prefix);
```

#### 1.6 Deliverables Checklist

- [ ] OrganizationApiKey TypeORM entity
- [ ] Database migration for organization_api_keys table
- [ ] POST /api/v1/api-keys endpoint
- [ ] GET /api/v1/api-keys endpoint
- [ ] DELETE /api/v1/api-keys/:id endpoint
- [ ] POST /api/v1/api-keys/:id/rotate endpoint
- [ ] authenticateOrgApiKey middleware
- [ ] Scope checking middleware
- [ ] Update all resource routes to accept API key auth
- [ ] Rate limiting for API key requests
- [ ] Audit logging for API key usage
- [ ] Unit tests for API key CRUD
- [ ] Integration tests for API key authentication

---

### Phase 2: OpenAPI Documentation (P0)
**Effort:** 2-3 weeks
**Blocked by:** Nothing (can run parallel to Phase 1)
**Blocks:** Go client generation

#### 2.1 Generate Schemas from TypeORM Entities

**Option A: Manual Schema Definition** (recommended for accuracy)
```typescript
// backend/src/api/schemas/index.ts

export const schemas = {
  Team: {
    type: 'object',
    required: ['id', 'name', 'orgId'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', maxLength: 255 },
      description: { type: 'string', nullable: true },
      orgId: { type: 'string', format: 'uuid' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  // ... 61 more models
};
```

**Option B: Auto-generate from TypeORM** (faster but less control)
```typescript
// Use typeorm-extension or custom script to extract column metadata
// Generate OpenAPI schemas from @Column decorators
```

#### 2.2 Document All Endpoints (Priority Order)

**Tier 1 - Core Resources (Week 1):**
| Route File | Endpoints | Priority |
|------------|-----------|----------|
| teams.ts | 10 | Document all |
| users.ts | 26 | Document all |
| services.ts | 23 | Document all |
| escalation-policies.ts | 10 | Document all |
| schedules.ts | 31 | Document all |

**Tier 2 - Feature Resources (Week 2):**
| Route File | Endpoints | Priority |
|------------|-----------|----------|
| runbooks.ts | 8 | Document all |
| integrations.ts | 15 | Document all |
| tags.ts | 13 | Document all |
| heartbeats.ts | 8 | Document all |
| routing-rules.ts | 8 | Document all |

**Tier 3 - Advanced Resources (Week 3):**
| Route File | Endpoints | Priority |
|------------|-----------|----------|
| status-pages.ts | 11 | Document all |
| webhook-subscriptions.ts | 7 | Document all |
| business-services.ts | 12 | Document all |
| workflows.ts | 9 | Document all |
| Remaining 20 files | ~150 | Document key endpoints |

#### 2.3 Swagger Annotation Template

```typescript
/**
 * @swagger
 * /api/v1/teams:
 *   get:
 *     summary: List all teams
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: List of teams
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teams:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Team'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', async (req, res) => { ... });
```

#### 2.4 Add Common Response Schemas

```typescript
// backend/src/api/swagger.ts - Add to components

responses: {
  Unauthorized: {
    description: 'Missing or invalid authentication',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Missing authorization header' }
          }
        }
      }
    }
  },
  Forbidden: {
    description: 'Insufficient permissions',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Admin access required' }
          }
        }
      }
    }
  },
  NotFound: {
    description: 'Resource not found',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Team not found' }
          }
        }
      }
    }
  },
  ValidationError: {
    description: 'Request validation failed',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }
},

schemas: {
  Pagination: {
    type: 'object',
    properties: {
      total: { type: 'integer' },
      limit: { type: 'integer' },
      offset: { type: 'integer' }
    }
  },
  // ... all 62 model schemas
}
```

#### 2.5 Generate Static OpenAPI File

```typescript
// backend/scripts/generate-openapi.ts

import swaggerJsdoc from 'swagger-jsdoc';
import { writeFileSync } from 'fs';
import { swaggerOptions } from '../src/api/swagger';

const spec = swaggerJsdoc(swaggerOptions);
writeFileSync('./openapi.json', JSON.stringify(spec, null, 2));
writeFileSync('./openapi.yaml', require('yaml').stringify(spec));

console.log('Generated openapi.json and openapi.yaml');
```

```json
// package.json
{
  "scripts": {
    "generate:openapi": "ts-node scripts/generate-openapi.ts"
  }
}
```

#### 2.6 Deliverables Checklist

- [ ] Define OpenAPI schemas for all 62 TypeORM models
- [ ] Add common response schemas (Unauthorized, Forbidden, NotFound, ValidationError)
- [ ] Add Pagination schema
- [ ] Document Tier 1 endpoints (teams, users, services, escalation-policies, schedules)
- [ ] Document Tier 2 endpoints (runbooks, integrations, tags, heartbeats, routing-rules)
- [ ] Document Tier 3 endpoints (status-pages, webhook-subscriptions, business-services, workflows)
- [ ] Add ApiKeyAuth security scheme
- [ ] Generate static openapi.json file
- [ ] Validate generated spec with swagger-cli or spectral
- [ ] Add OpenAPI generation to CI pipeline
- [ ] Host generated spec at /api-docs/openapi.json

---

### Phase 3: CRUD Gap Resolution (P1)
**Effort:** 1 week
**Blocked by:** Nothing
**Blocks:** Users resource in Terraform provider

#### 3.1 Add Missing User Endpoints

```typescript
// backend/src/api/routes/users.ts

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const user = await userRepo.findOne({
    where: { id, orgId: req.orgId },
    relations: ['teams', 'contactMethods', 'notificationRules']
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ user: formatUser(user) });
});

/**
 * @swagger
 * /api/v1/users/{id}:
 *   delete:
 *     summary: Delete user (soft delete - sets status to deleted)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: User deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Cannot delete - user has active assignments
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const user = await userRepo.findOne({
    where: { id, orgId: req.orgId }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check for active assignments
  const activeSchedules = await scheduleMemberRepo.count({
    where: { userId: id }
  });

  if (activeSchedules > 0) {
    return res.status(409).json({
      error: 'Cannot delete user with active schedule assignments',
      activeSchedules
    });
  }

  // Soft delete
  await userRepo.update(id, { status: 'deleted' });

  // Revoke Cognito access (optional)
  // await cognitoService.disableUser(user.cognitoSub);

  return res.status(204).send();
});
```

#### 3.2 Standardize User Update Endpoint

```typescript
// Consolidate PUT /:id/role and PUT /:id/status into single PUT /:id

/**
 * @swagger
 * /api/v1/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, user, responder]
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *               timezone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated user
 */
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { fullName, role, status, timezone } = req.body;

  const user = await userRepo.findOne({
    where: { id, orgId: req.orgId }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update allowed fields
  if (fullName !== undefined) user.fullName = fullName;
  if (role !== undefined) user.role = role;
  if (status !== undefined) user.status = status;
  if (timezone !== undefined) user.timezone = timezone;

  await userRepo.save(user);

  return res.json({ user: formatUser(user) });
});
```

#### 3.3 Add Direct User Creation (for Terraform)

```typescript
/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Create user directly (API key auth only)
 *     description: Creates user without invitation flow. Requires API key authentication.
 *     tags: [Users]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, fullName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, user, responder]
 *                 default: user
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/',
  requireScope('users:write'),
  [
    body('email').isEmail(),
    body('fullName').isString().notEmpty(),
    body('role').optional().isIn(['admin', 'user', 'responder'])
  ],
  async (req, res) => {
    // Only allow direct creation via API key (Terraform)
    if (req.authMethod !== 'api_key') {
      return res.status(403).json({
        error: 'Direct user creation requires API key authentication. Use POST /users/invite for user JWT auth.'
      });
    }

    const { email, fullName, role = 'user' } = req.body;

    // Check if user exists
    const existing = await userRepo.findOne({ where: { email, orgId: req.orgId } });
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Create user (without Cognito - they'll set password on first login)
    const user = userRepo.create({
      orgId: req.orgId,
      email,
      fullName,
      role,
      status: 'pending', // Requires password setup
    });

    await userRepo.save(user);

    return res.status(201).json({ user: formatUser(user) });
  }
);
```

#### 3.4 Deliverables Checklist

- [ ] GET /api/v1/users/:id endpoint
- [ ] DELETE /api/v1/users/:id endpoint (soft delete)
- [ ] PUT /api/v1/users/:id endpoint (consolidated update)
- [ ] POST /api/v1/users endpoint (direct creation for API key auth)
- [ ] Swagger documentation for all new endpoints
- [ ] Unit tests for new endpoints
- [ ] Integration tests for user CRUD lifecycle

---

### Phase 4: API Stability Enhancements (P2)
**Effort:** 1-2 weeks
**Blocked by:** Phases 1-3
**Blocks:** Production Terraform provider release

#### 4.1 Add Idempotency Support

```typescript
// backend/src/shared/middleware/idempotency.ts

const idempotencyCache = new Map<string, { response: any; status: number; expiresAt: Date }>();

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['idempotency-key'] as string;

  if (!idempotencyKey || req.method === 'GET') {
    return next();
  }

  const cacheKey = `${req.orgId}:${idempotencyKey}`;
  const cached = idempotencyCache.get(cacheKey);

  if (cached && cached.expiresAt > new Date()) {
    return res.status(cached.status).json(cached.response);
  }

  // Intercept response to cache it
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    idempotencyCache.set(cacheKey, {
      response: body,
      status: res.statusCode,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
    return originalJson(body);
  };

  return next();
}
```

#### 4.2 Add ETag Support for Optimistic Locking

```typescript
// backend/src/shared/middleware/etag.ts

export function etagMiddleware(req: Request, res: Response, next: NextFunction) {
  const ifMatch = req.headers['if-match'];
  const ifNoneMatch = req.headers['if-none-match'];

  // Store for later use in route handlers
  req.ifMatch = ifMatch;
  req.ifNoneMatch = ifNoneMatch;

  return next();
}

// In route handlers:
router.put('/:id', async (req, res) => {
  const resource = await repo.findOne({ where: { id: req.params.id } });
  const currentEtag = `"${resource.updatedAt.getTime()}"`;

  // Check If-Match for optimistic locking
  if (req.ifMatch && req.ifMatch !== currentEtag) {
    return res.status(412).json({
      error: 'Resource has been modified',
      currentEtag
    });
  }

  // ... update resource ...

  const newEtag = `"${updated.updatedAt.getTime()}"`;
  res.setHeader('ETag', newEtag);
  return res.json({ resource: updated });
});
```

#### 4.3 Add Location Headers on POST

```typescript
// In all POST handlers that create resources:
router.post('/', async (req, res) => {
  const created = await repo.save(newResource);

  res.setHeader('Location', `/api/v1/teams/${created.id}`);
  return res.status(201).json({ team: formatTeam(created) });
});
```

#### 4.4 Document API Stability Policy

```markdown
// docs/API_STABILITY.md

# OnCallShift API Stability Policy

## Versioning

The OnCallShift API uses URL-based versioning (`/api/v1/`).

## Stability Guarantees

For `/api/v1/` endpoints:
- No breaking changes without 6-month deprecation notice
- New fields may be added to responses (non-breaking)
- New optional parameters may be added to requests (non-breaking)
- New endpoints may be added (non-breaking)

## Breaking Changes

The following are considered breaking changes:
- Removing or renaming endpoints
- Removing or renaming response fields
- Changing required request parameters
- Changing authentication requirements
- Changing error response format

## Deprecation Process

1. Deprecated endpoints will include `Deprecation` header
2. Minimum 6-month notice before removal
3. Announced in changelog and API documentation
```

#### 4.5 Deliverables Checklist

- [ ] Idempotency-Key header support
- [ ] ETag generation for all resources
- [ ] If-Match / If-None-Match conditional request handling
- [ ] Location header on all POST responses
- [ ] Deprecation header support
- [ ] API_STABILITY.md documentation
- [ ] CHANGELOG.md for API changes

---

## Implementation Timeline

```
Week 1-2: Phase 1 (Org API Keys) + Phase 2 Start (OpenAPI Tier 1)
          ├── Create OrganizationApiKey model
          ├── API key management endpoints
          ├── Authentication middleware updates
          └── Begin documenting core endpoints

Week 3-4: Phase 2 Continue (OpenAPI Tier 2-3) + Phase 3 (CRUD Gaps)
          ├── Complete endpoint documentation
          ├── Generate OpenAPI schemas from models
          ├── Add missing User endpoints
          └── Validate OpenAPI spec

Week 5-6: Phase 4 (Stability) + Testing
          ├── Idempotency support
          ├── ETag support
          ├── Location headers
          ├── Integration testing
          └── Documentation finalization

Week 7-8: Buffer + Provider Development Start
          ├── Address issues found in testing
          ├── Begin terraform-provider-oncallshift scaffolding
          └── Generate Go client from OpenAPI
```

---

## Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| API Key Auth | Can authenticate to any endpoint with `Bearer org_*` token |
| OpenAPI Coverage | 100% of Terraform-relevant endpoints documented |
| CRUD Complete | All 9 core resources have full CRUD operations |
| Idempotency | POST/PUT/DELETE requests with Idempotency-Key return cached responses |
| Go Client | Successfully generate Go client from openapi.json |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenAPI documentation takes longer than estimated | Delays provider development | Prioritize Tier 1 resources, generate minimal viable spec first |
| Breaking existing service API key behavior | Existing webhook integrations break | Keep service API keys separate, add new org API key system |
| Cognito integration complexity for user management | User creation/deletion complex | Support both invite flow and direct creation, document differences |

---

## Next Steps After Prerequisites

Once prerequisites are complete:

1. **Scaffold Provider** - Use terraform-provider-scaffolding-framework
2. **Generate Go Client** - Use oapi-codegen or go-swagger from openapi.json
3. **Implement Core Resources** - Teams, Users, Services, Escalation Policies, Schedules
4. **Add Acceptance Tests** - Test against live API
5. **Publish to Registry** - terraform.io public registry

See `ROADMAP.md` Phase 8 for full Terraform provider implementation plan.
