# CRUD Patterns & Best Practices

Comprehensive guide for implementing Create, Read, Update, Delete operations in OnCallShift API routes using the standardized CRUD utilities and patterns.

## Table of Contents

1. [Overview](#overview)
2. [Standard CRUD Pattern](#standard-crud-pattern)
3. [List Endpoint Pattern](#list-endpoint-pattern)
4. [Get Single Item Pattern](#get-single-item-pattern)
5. [Create Endpoint Pattern](#create-endpoint-pattern)
6. [Update Endpoint Pattern](#update-endpoint-pattern)
7. [Delete Endpoint Pattern](#delete-endpoint-pattern)
8. [Error Handling](#error-handling)
9. [Type Safety](#type-safety)
10. [Multi-Tenancy](#multi-tenancy)
11. [Soft Deletes](#soft-deletes)
12. [Bulk Operations](#bulk-operations)
13. [Advanced Patterns](#advanced-patterns)
14. [Common Mistakes](#common-mistakes)

## Overview

The CRUD utilities provide a set of standardized helpers for implementing RESTful endpoints. They ensure:

- **Consistency** - All endpoints follow the same patterns
- **Type Safety** - Full TypeScript type checking
- **Security** - Multi-tenant isolation enforced
- **DRY** - Eliminate boilerplate code
- **Error Handling** - Standardized error responses (RFC 9457)

### Key Utilities

| Utility | Purpose | Example |
|---------|---------|---------|
| `buildListQuery()` | Create safe list query | `buildListQuery(repo, 'team', orgId)` |
| `applyFilters()` | Apply filters to query | `applyFilters(qb, filters, filterMap, 'team')` |
| `applySorting()` | Apply sorting to query | `applySorting(qb, 'name', 'ASC', 'team', ['name'])` |
| `applyPagination()` | Apply pagination to query | `const { data, pagination } = await applyPagination(qb, { limit: 25 })` |
| `formatListResponse()` | Format list response | `res.json(formatListResponse(items, total, pagination))` |
| `handleCrudError()` | Handle CRUD errors | `const err = handleCrudError(error, 'create')` |
| `findOneById()` | Safe single-item query | `const item = await findOneById(repo, id, orgId)` |

## Standard CRUD Pattern

A typical CRUD resource implementation follows this structure:

```typescript
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateRequest, requireAdmin } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Team } from '../../shared/models';
import {
  buildListQuery,
  applyFilters,
  applySorting,
  applyPagination,
  formatListResponse,
  findOneById,
  handleCrudError,
  validateOwnership,
} from '../../shared/utils/crud';
import { notFound, internalError } from '../../shared/utils/problem-details';
import { VALID_SORT_FIELDS } from '../../shared/utils/pagination';

const router = Router();
router.use(authenticateRequest);

// Type file: routes/types/teams.types.ts
import { CreateTeamRequest, UpdateTeamRequest, Team as TeamResponse } from './types/teams.types';

// List endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    const dataSource = await getDataSource();
    const repo = dataSource.getRepository(Team);

    // Build safe query with org isolation
    const qb = buildListQuery(repo, 'team', req.orgId!);

    // Apply filters
    const filterMap = {
      search: { field: 'name', operator: 'like' },
      status: { field: 'status', operator: 'eq' },
    };
    applyFilters(qb, req.query, filterMap, 'team');

    // Apply sorting
    const sortField = req.query.sort || 'createdAt';
    const validFields = VALID_SORT_FIELDS.teams;
    applySorting(qb, sortField, req.query.order === 'asc' ? 'ASC' : 'DESC', 'team', validFields);

    // Apply pagination
    const { data, pagination } = await applyPagination(qb, {
      limit: parseInt(req.query.limit as string) || 25,
      offset: parseInt(req.query.offset as string) || 0,
    });

    res.json(formatListResponse(data, pagination.total, pagination));
  } catch (error) {
    const err = handleCrudError(error, 'read');
    res.status(err.statusCode).json({ error: err.code, message: err.message });
  }
});

// Get single item
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const dataSource = await getDataSource();
    const repo = dataSource.getRepository(Team);

    const item = await findOneById(repo, req.params.id, req.orgId!);
    if (!item) {
      return notFound(res, 'Team', req.params.id);
    }

    res.json({ data: item });
  } catch (error) {
    const err = handleCrudError(error, 'read');
    res.status(err.statusCode).json({ error: err.code, message: err.message });
  }
});

// Create endpoint
router.post(
  '/',
  requireAdmin,
  [body('name').trim().isLength({ min: 1, max: 255 })],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const dataSource = await getDataSource();
      const repo = dataSource.getRepository(Team);

      const input: CreateTeamRequest = req.body;
      const item = repo.create({
        ...input,
        orgId: req.orgId!,
      });

      const created = await repo.save(item);
      res.status(201).json({ message: 'Team created', data: created });
    } catch (error) {
      const err = handleCrudError(error, 'create');
      res.status(err.statusCode).json({ error: err.code, message: err.message });
    }
  }
);

export default router;
```

## List Endpoint Pattern

Lists should support pagination, filtering, and sorting:

```typescript
/**
 * GET /api/v1/teams
 * List all teams with pagination, filtering, and sorting
 */
router.get(
  '/',
  [
    // Pagination validation
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('sort').optional().isString(),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const dataSource = await getDataSource();
      const repo = dataSource.getRepository(Team);

      // Build base query with org isolation
      const qb = buildListQuery(repo, 'team', req.orgId!);

      // Apply resource-specific filters
      applyFilters(
        qb,
        req.query,
        {
          search: { field: 'name', operator: 'like' },
          status: { field: 'status', operator: 'eq' },
          teamId: { field: 'id', operator: 'eq' },
        },
        'team'
      );

      // Apply sorting (with security check on valid fields)
      const sort = req.query.sort as string || 'createdAt';
      applySorting(qb, sort, req.query.order === 'asc' ? 'ASC' : 'DESC', 'team', [
        'name',
        'createdAt',
        'updatedAt',
        'status',
      ]);

      // Apply pagination
      const { data, pagination } = await applyPagination(qb, {
        limit: Math.min(parseInt(req.query.limit as string) || 25, 100),
        offset: parseInt(req.query.offset as string) || 0,
      });

      // Format response
      res.json(formatListResponse(data, pagination.total, pagination));
    } catch (error) {
      const err = handleCrudError(error, 'read');
      res.status(err.statusCode).json({
        type: 'https://api.oncallshift.com/errors/internal',
        title: err.message,
        status: err.statusCode,
      });
    }
  }
);
```

## Get Single Item Pattern

Single-item retrieval with proper error handling:

```typescript
/**
 * GET /api/v1/teams/:id
 * Get a single team by ID
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const dataSource = await getDataSource();
    const repo = dataSource.getRepository(Team);

    // Safe lookup with org isolation
    const item = await findOneById(repo, id, req.orgId!, {
      relations: ['memberships', 'memberships.user'],
    });

    if (!item) {
      return notFound(res, 'Team', id);
    }

    // Optional: Include ETag for caching
    const etag = generateEntityETag(item.id, item.updatedAt);
    res.set('ETag', etag);

    res.json({ data: item });
  } catch (error) {
    const err = handleCrudError(error, 'read');
    res.status(err.statusCode).json({
      type: 'https://api.oncallshift.com/errors/internal',
      title: err.message,
      status: err.statusCode,
    });
  }
});
```

## Create Endpoint Pattern

Creating resources with validation and proper response codes:

```typescript
/**
 * POST /api/v1/teams
 * Create a new team
 */
router.post(
  '/',
  requireAdmin,
  [
    body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Name is required'),
    body('slug').optional().matches(/^[a-z0-9-]+$/).withMessage('Invalid slug format'),
    body('description').optional().isString(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validation errors are handled by middleware
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          type: 'https://api.oncallshift.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          errors: errors.array().map(err => ({
            field: err.param,
            message: err.msg,
          })),
        });
      }

      const dataSource = await getDataSource();
      const repo = dataSource.getRepository(Team);

      // Create instance (not saved yet)
      const input: CreateTeamRequest = req.body;
      const item = repo.create({
        ...input,
        orgId: req.orgId!, // Always set org_id
      });

      // Save and return 201
      const created = await repo.save(item);

      // Set Location header
      res.set('Location', `/api/v1/teams/${created.id}`);
      res.status(201).json({
        message: 'Team created successfully',
        data: created,
      });
    } catch (error) {
      const err = handleCrudError(error, 'create');
      res.status(err.statusCode).json({
        type: 'https://api.oncallshift.com/errors/conflict',
        title: err.message,
        status: err.statusCode,
        details: err.details,
      });
    }
  }
);
```

## Update Endpoint Pattern

Updating resources with ETag support for optimistic locking:

```typescript
/**
 * PUT /api/v1/teams/:id
 * Update a team (full update)
 */
router.put(
  '/:id',
  requireAdmin,
  [
    body('name').optional().isLength({ min: 1, max: 255 }),
    body('description').optional().isString(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const dataSource = await getDataSource();
      const repo = dataSource.getRepository(Team);

      // Find existing item
      const item = await findOneById(repo, id, req.orgId!);
      if (!item) {
        return notFound(res, 'Team', id);
      }

      // Check If-Match ETag header
      const currentETag = generateEntityETag(item.id, item.updatedAt);
      const ifMatch = req.headers['if-match'];
      if (ifMatch && ifMatch !== currentETag) {
        return res.status(412).json({
          type: 'https://api.oncallshift.com/errors/precondition-failed',
          title: 'Precondition Failed',
          status: 412,
          detail: 'Resource was modified. Please refresh and try again.',
        });
      }

      // Update only provided fields
      const input: UpdateTeamRequest = req.body;
      Object.assign(item, input);

      const updated = await repo.save(item);

      // Return updated ETag
      const newETag = generateEntityETag(updated.id, updated.updatedAt);
      res.set('ETag', newETag);

      res.json({
        message: 'Team updated successfully',
        data: updated,
      });
    } catch (error) {
      const err = handleCrudError(error, 'update');
      res.status(err.statusCode).json({
        type: 'https://api.oncallshift.com/errors/internal',
        title: err.message,
        status: err.statusCode,
      });
    }
  }
);
```

## Delete Endpoint Pattern

Deleting resources with soft-delete support:

```typescript
/**
 * DELETE /api/v1/teams/:id
 * Delete a team (soft delete by default)
 */
router.delete('/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const dataSource = await getDataSource();
    const repo = dataSource.getRepository(Team);

    // Find existing item
    const item = await findOneById(repo, id, req.orgId!);
    if (!item) {
      return notFound(res, 'Team', id);
    }

    // Soft delete (mark as deleted)
    await softDelete(repo, id, req.orgId!);

    res.json({
      message: 'Team deleted successfully',
      success: true,
      id,
    });
  } catch (error) {
    const err = handleCrudError(error, 'delete');
    res.status(err.statusCode).json({
      type: 'https://api.oncallshift.com/errors/internal',
      title: err.message,
      status: err.statusCode,
    });
  }
});
```

## Error Handling

Standard error responses using RFC 9457 Problem Details format:

```typescript
// Not found (404)
return notFound(res, 'Team', id);
// Response: { type, title: 'Resource Not Found', status: 404, detail, instance }

// Conflict (409) - duplicate key
return conflict(res, 'Team with this slug already exists');
// Response: { type, title: 'Conflict', status: 409, detail }

// Bad request (400) - validation
return badRequest(res, 'Invalid team name');
// Response: { type, title: 'Bad Request', status: 400, detail }

// Internal error (500)
return internalError(res, 'Failed to create team');
// Response: { type, title: 'Internal Server Error', status: 500, detail }
```

## Type Safety

Each route should have a corresponding type file:

```typescript
// routes/types/teams.types.ts

import { CrudCreateRequest, CrudUpdateRequest } from '../../shared/types/crud.types';

export interface CreateTeamRequest extends CrudCreateRequest<Team> {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateTeamRequest extends CrudUpdateRequest<Team> {
  name?: string;
  slug?: string;
  description?: string;
}

export interface TeamResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Multi-Tenancy

Always enforce org_id isolation:

```typescript
// ✅ GOOD - Org isolation enforced
const item = await findOneById(repo, id, req.orgId!);

// ✅ GOOD - Org filter in query
const qb = buildListQuery(repo, 'team', req.orgId!);

// ❌ BAD - No org isolation
const item = await repo.findOne({ where: { id } });

// ❌ BAD - Missing org_id parameter
const item = await repo.findOne({ where: { id } });
```

## Soft Deletes

Support soft deletes where appropriate:

```typescript
// Apply soft delete filter to exclude deleted items
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const qb = buildListQuery(repo, 'team', req.orgId!);

  // Exclude soft-deleted items
  applySoftDeleteFilter(qb, 'team', 'deletedAt');

  // ... rest of handler
});

// Delete with soft delete
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  await softDelete(repo, req.params.id, req.orgId!);
  res.json({ success: true });
});

// Restore soft-deleted item
router.post('/:id/restore', async (req: AuthenticatedRequest, res: Response) => {
  const item = await repo.findOne({ where: { id: req.params.id, orgId: req.orgId } });
  if (!item) return notFound(res, 'Team', req.params.id);

  item.deletedAt = null;
  await repo.save(item);
  res.json({ data: item });
});
```

## Bulk Operations

Handle bulk operations safely:

```typescript
// Bulk create
router.post(
  '/bulk',
  [
    body('items').isArray(),
    body('items.*.name').isString(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const items = req.body.items.map((item: any) => ({
        ...item,
        orgId: req.orgId!,
      }));

      const created = await bulkCreate(repo, items);
      res.status(201).json({
        message: 'Teams created',
        data: created,
        count: created.length,
      });
    } catch (error) {
      const err = handleCrudError(error, 'create');
      res.status(err.statusCode).json({ error: err.code, message: err.message });
    }
  }
);

// Bulk update
router.patch(
  '/bulk',
  [
    body('ids').isArray(),
    body('updates').isObject(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const affected = await bulkUpdate(repo, { id: In(req.body.ids), orgId: req.orgId! }, req.body.updates);
      res.json({
        message: 'Teams updated',
        count: affected,
      });
    } catch (error) {
      const err = handleCrudError(error, 'update');
      res.status(err.statusCode).json({ error: err.code, message: err.message });
    }
  }
);
```

## Advanced Patterns

### Nested Resources

For resources that are children of parents:

```typescript
// GET /api/v1/teams/:teamId/members
router.get('/:teamId/members', async (req: AuthenticatedRequest, res: Response) => {
  const { teamId } = req.params;
  const dataSource = await getDataSource();
  const teamRepo = dataSource.getRepository(Team);

  // Verify team belongs to org
  const team = await findOneById(teamRepo, teamId, req.orgId!);
  if (!team) return notFound(res, 'Team', teamId);

  // Get nested resources
  const memberRepo = dataSource.getRepository(TeamMembership);
  const qb = buildListQuery(memberRepo, 'member', req.orgId!);
  qb.andWhere('member.teamId = :teamId', { teamId });

  const { data, pagination } = await applyPagination(qb, {
    limit: parseInt(req.query.limit as string) || 25,
    offset: parseInt(req.query.offset as string) || 0,
  });

  res.json(formatListResponse(data, pagination.total, pagination));
});
```

### Batch Operations with Partial Failures

For bulk operations that can partially fail:

```typescript
router.post('/batch', async (req: AuthenticatedRequest, res: Response) => {
  const items = req.body.items;
  const results = { successful: [], failed: [] };

  for (const item of items) {
    try {
      const created = await repo.save({ ...item, orgId: req.orgId! });
      results.successful.push(created);
    } catch (error) {
      results.failed.push({ item, error: error.message });
    }
  }

  res.status(results.failed.length > 0 ? 207 : 201).json({
    message: 'Batch operation completed',
    results,
  });
});
```

## Common Mistakes

### ❌ Mistake 1: Forgetting org_id

```typescript
// Bad - data leak across organizations
const items = await repo.find();

// Good
const qb = buildListQuery(repo, 'team', req.orgId!);
const items = await qb.getMany();
```

### ❌ Mistake 2: Trusting user input for sort field

```typescript
// Bad - SQL injection risk
applySorting(qb, req.query.sort, 'ASC', 'team', []);

// Good - validate against allowed fields
applySorting(qb, req.query.sort, 'ASC', 'team', ['name', 'createdAt']);
```

### ❌ Mistake 3: Not handling validation errors

```typescript
// Bad - validation errors silently ignored
router.post('/', async (req, res) => {
  const errors = validationResult(req);
  // Continues even if errors exist
});

// Good
router.post('/', async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
});
```

### ❌ Mistake 4: Wrong HTTP status codes

```typescript
// Bad
res.json(item); // 200 for creation
res.send('deleted'); // 200 for deletion

// Good
res.status(201).json(item); // 201 for creation
res.status(204).send(); // 204 for deletion (no content)
```

### ❌ Mistake 5: Inconsistent error responses

```typescript
// Bad - inconsistent format
res.json({ error: 'Team not found' }); // Missing status
res.json({ message: 'Invalid input', errors: [...] }); // Different format

// Good - RFC 9457 format
notFound(res, 'Team', id);
badRequest(res, 'Invalid input', errors);
```

---

## Summary

Key points to remember:

1. **Always scope by org_id** - Use `buildListQuery()` or `findOneById()`
2. **Validate sort fields** - Never trust user input for ORDER BY
3. **Use proper status codes** - 201 for POST, 204 for DELETE
4. **Format consistently** - Use provided format helpers
5. **Handle errors** - Use RFC 9457 problem details
6. **Type everything** - Create routes/types/*.types.ts files
7. **Test edge cases** - Org isolation, validation, error handling
