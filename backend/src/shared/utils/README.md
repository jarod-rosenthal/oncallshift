# Shared Utilities

This directory contains shared utility functions and helpers used across all API routes and backend services.

## Directory Structure

```
utils/
├── README.md                  # This file
├── CRUD_PATTERNS.md           # Detailed CRUD implementation guide
├── crud.ts                    # CRUD operation helpers
├── pagination.ts              # Pagination utilities
├── filtering.ts               # Filtering utilities
├── problem-details.ts         # RFC 9457 error responses
├── etag.ts                    # ETag generation for caching
├── location-header.ts         # Location header helpers
├── logger.ts                  # Logging utility
└── index.ts                   # Central export point
```

## Quick Start

### Import Utilities

```typescript
// From the central index (recommended)
import {
  buildListQuery,
  applyFilters,
  applySorting,
  applyPagination,
  formatListResponse,
  handleCrudError,
  notFound,
  badRequest,
  logger,
} from '../../shared/utils';

// Or from specific modules
import { buildListQuery } from '../../shared/utils/crud';
import { notFound } from '../../shared/utils/problem-details';
```

### Implement a CRUD Endpoint

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
  notFound,
} from '../../shared/utils';

const router = Router();
router.use(authenticateRequest);

// GET /api/v1/teams - List with filtering and pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const dataSource = await getDataSource();
    const repo = dataSource.getRepository(Team);

    // Build query with org isolation
    const qb = buildListQuery(repo, 'team', req.orgId!);

    // Apply filters
    applyFilters(
      qb,
      req.query,
      {
        search: { field: 'name', operator: 'like' },
        status: { field: 'status', operator: 'eq' },
      },
      'team'
    );

    // Apply sorting
    applySorting(qb, req.query.sort || 'name', 'DESC', 'team', ['name', 'createdAt']);

    // Apply pagination
    const { data, pagination } = await applyPagination(qb, {
      limit: Math.min(parseInt(req.query.limit as string) || 25, 100),
      offset: parseInt(req.query.offset as string) || 0,
    });

    res.json(formatListResponse(data, pagination.total, pagination));
  } catch (error) {
    const err = handleCrudError(error, 'read');
    res.status(err.statusCode).json({ error: err.code, message: err.message });
  }
});

// GET /api/v1/teams/:id - Get single item
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const dataSource = await getDataSource();
    const repo = dataSource.getRepository(Team);

    const item = await findOneById(repo, req.params.id, req.orgId!);
    if (!item) return notFound(res, 'Team', req.params.id);

    res.json({ data: item });
  } catch (error) {
    const err = handleCrudError(error, 'read');
    res.status(err.statusCode).json({ error: err.code, message: err.message });
  }
});

// POST /api/v1/teams - Create
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

      const item = repo.create({
        ...req.body,
        orgId: req.orgId!,
      });

      const created = await repo.save(item);
      res.status(201).json({ message: 'Created', data: created });
    } catch (error) {
      const err = handleCrudError(error, 'create');
      res.status(err.statusCode).json({ error: err.code, message: err.message });
    }
  }
);

export default router;
```

## Utilities Reference

### CRUD Utilities (`crud.ts`)

Query building, filtering, sorting, pagination, and response formatting.

#### Query Building

```typescript
// Build a safe list query with org isolation
const qb = buildListQuery(repo, 'team', orgId);

// Find single item with org isolation
const item = await findOneById(repo, id, orgId, { relations: ['members'] });

// Build org filter object
const filter = buildOrgFilter(orgId);
```

#### Filtering

```typescript
// Configure filters
const filterMap = {
  search: { field: 'name', operator: 'like' },
  status: { field: 'status', operator: 'eq' },
  ids: { field: 'id', operator: 'in' },
};

// Apply filters to query
applyFilters(qb, req.query, filterMap, 'team');
```

Supported operators:
- `eq` - Equality
- `like` - ILIKE (case-insensitive substring)
- `in` - IN array
- `lt` - Less than
- `lte` - Less than or equal
- `gt` - Greater than
- `gte` - Greater than or equal
- `between` - Between two values

#### Sorting

```typescript
// Apply sorting with security check
applySorting(
  qb,
  'name', // field to sort by
  'ASC', // direction
  'team', // alias
  ['name', 'createdAt', 'status'] // allowed fields
);
```

#### Pagination

```typescript
// Apply offset-based pagination
const { data, pagination } = await applyPagination(qb, {
  limit: 25,
  offset: 0,
});

// Response includes:
// - data: T[]
// - pagination: { total, limit, offset, hasMore }
```

#### Response Formatting

```typescript
// Format list response
formatListResponse(
  items,
  totalCount,
  { limit: 25, offset: 0 },
  { legacyKey: 'teams' } // optional backwards compatibility
);

// Format created resource
formatCreatedResponse(resource, { statusCode: 201, message: 'Team created' });

// Format updated resource
formatUpdatedResponse(resource, { message: 'Team updated' });

// Format single resource
formatResource(item, { excludeFields: ['password', 'internalNotes'] });
```

#### Error Handling

```typescript
// Handle CRUD errors with appropriate status codes
const error = handleCrudError(caughtError, 'create');
// Returns: { code, message, statusCode, details? }

// Validate resource ownership
validateOwnership(resource, req.orgId!);

// Check If-Match ETag
const match = checkIfMatch(req, currentETag);
```

#### Soft Deletes

```typescript
// Apply soft delete filter (exclude deleted)
applySoftDeleteFilter(qb, 'team', 'deletedAt');

// Soft delete a resource
await softDelete(repo, id, orgId);

// Hard delete a resource
await hardDelete(repo, id, orgId);
```

#### Bulk Operations

```typescript
// Create multiple resources
const created = await bulkCreate(repo, items);

// Update multiple resources
const affected = await bulkUpdate(repo, { status: 'active' }, { status: 'archived' });

// Delete multiple resources
const deleted = await bulkDelete(repo, { status: 'archived', orgId });
```

### Pagination Utilities (`pagination.ts`)

Offset-based and cursor-based pagination support.

```typescript
// Parse pagination params from request
const pagination = parsePaginationParams(req.query);
// Returns: { limit, offset, order, sort, cursor }

// Build pagination metadata
const meta = buildPaginationMeta(total, limit, offset, lastItem);
// Returns: { total, limit, offset, hasMore, nextCursor? }

// Create paginated response
const response = paginatedResponse(data, total, pagination);
// Returns: { data, pagination, [legacyKey]: data }

// Cursor-based pagination
const { data, pagination } = await cursorPaginate(qb, {
  cursor: req.query.cursor,
  limit: 25,
  sortField: 'createdAt',
  sortOrder: 'DESC',
});

// Validate sort field
const field = validateSortField('teams', req.query.sort, 'name');
// Uses VALID_SORT_FIELDS registry
```

### Filtering Utilities (`filtering.ts`)

```typescript
// Parse base filters from query
const filters = parseBaseFilters(req.query);
// Extracts: search, status, team_id, etc.

// Apply base filters to query
applyBaseFilters(qb, filters, 'team', ['name', 'description']);
```

### Problem Details (`problem-details.ts`)

RFC 9457 compliant error responses.

```typescript
// Not found (404)
notFound(res, 'Team', id);

// Bad request (400)
badRequest(res, 'Invalid input');

// Unauthorized (401)
unauthorized(res, 'No auth token');

// Forbidden (403)
forbidden(res, 'Admin required');

// Conflict (409)
conflict(res, 'Team already exists');

// Internal error (500)
internalError(res, 'Database error');
```

### ETag Utilities (`etag.ts`)

```typescript
// Generate ETag from entity ID and timestamp
const etag = generateEntityETag(id, updatedAt);

// Generate ETag from string
const etag = generateStringETag('some-data');

// Check If-None-Match header
if (checkETagAndRespond(req, res, etag)) {
  return; // 304 was sent
}
```

### Logger (`logger.ts`)

```typescript
logger.info('message', { context });
logger.debug('message', { context });
logger.warn('message', { context });
logger.error('message', { context });
```

## Best Practices

### 1. Always Enforce Org Isolation

```typescript
// ✅ Good
const item = await findOneById(repo, id, req.orgId!);

// ❌ Bad - Data leak
const item = await repo.findOne({ where: { id } });
```

### 2. Validate Sort Fields

```typescript
// ✅ Good - Whitelist approach
applySorting(qb, sortField, order, 'team', ['name', 'createdAt']);

// ❌ Bad - User input directly in query
qb.orderBy(`team.${req.query.sort}`);
```

### 3. Use Consistent Error Responses

```typescript
// ✅ Good - RFC 9457 format
notFound(res, 'Team', id);

// ❌ Bad - Inconsistent format
res.json({ error: 'not found' });
res.status(404).send('not found');
```

### 4. Handle Validation Errors

```typescript
// ✅ Good
const errors = validationResult(req);
if (!errors.isEmpty()) {
  return res.status(400).json({ errors: errors.array() });
}

// ❌ Bad - Validation errors ignored
const errors = validationResult(req);
// Continue without checking
```

### 5. Return Proper Status Codes

```typescript
// ✅ Good
res.status(201).json(created); // POST - created
res.status(200).json(updated); // PUT - success
res.status(204).send(); // DELETE - no content
res.status(404).json(...); // GET - not found

// ❌ Bad
res.json(created); // Missing 201
res.send('deleted'); // Missing 204
```

## Integration with Middleware

The utilities work seamlessly with existing middleware:

- **Auth**: Routes use `authenticateRequest`, which adds `req.orgId`
- **Validation**: Express-validator chains work with all utilities
- **Etag**: ETag middleware handles caching checks
- **Error Handling**: Validation error middleware captures validation errors

## TypeScript Support

All utilities are fully typed. Create route-specific type files:

```typescript
// routes/types/teams.types.ts
import { CrudCreateRequest, CrudUpdateRequest } from '../../shared/types/crud.types';

export interface CreateTeamRequest extends CrudCreateRequest<Team> {
  name: string;
  slug?: string;
}

export interface UpdateTeamRequest extends CrudUpdateRequest<Team> {
  name?: string;
  slug?: string;
}
```

## Examples

See `CRUD_PATTERNS.md` for detailed examples including:

- List endpoints with pagination, filtering, sorting
- Single item retrieval
- Create endpoints with validation
- Update endpoints with ETag support
- Delete endpoints with soft delete
- Nested resources
- Bulk operations
- Advanced patterns

## Migration Guide

If you're refactoring an existing route:

1. **Before**: Manual query building, formatting, error handling
2. **After**: Use utilities for consistency

Example migration:

```typescript
// BEFORE
const teams = await teamRepo
  .createQueryBuilder('team')
  .where('team.org_id = :orgId', { orgId: req.orgId })
  .skip(offset)
  .take(limit)
  .getManyAndCount();

res.json({
  teams: teams[0],
  pagination: { total: teams[1], limit, offset },
});

// AFTER
const qb = buildListQuery(teamRepo, 'team', req.orgId!);
const { data, pagination } = await applyPagination(qb, { limit, offset });
res.json(formatListResponse(data, pagination.total, pagination));
```

## Performance Considerations

### Query Optimization

- Use relations wisely to avoid N+1 queries
- Use queryBuilder for complex queries
- Add database indexes for filtered fields

```typescript
// Load relations
const item = await findOneById(repo, id, orgId, {
  relations: ['memberships', 'memberships.user'],
});

// Or use queryBuilder for custom relations
const qb = buildListQuery(repo, 'team', orgId);
qb.leftJoinAndSelect('team.memberships', 'members');
```

### Pagination

- Default limit: 25 items
- Max limit: 100 items
- Use cursor-based pagination for large datasets
- Avoid deep offsets (MAX_OFFSET: 10000)

### Caching

- Use ETags for GET responses
- Cache pagination metadata separately
- Consider Redis for frequently accessed data

## Troubleshooting

### Common Issues

**Issue**: Org isolation not working
```typescript
// Check: Are you using buildListQuery or findOneById?
const qb = buildListQuery(repo, 'team', req.orgId!); // ✅
const item = await findOneById(repo, id, req.orgId!); // ✅
```

**Issue**: Sort not working
```typescript
// Check: Is field in validFields?
applySorting(qb, 'name', 'ASC', 'team', ['name', 'createdAt']);
// If 'name' not in array, defaults to 'createdAt'
```

**Issue**: Pagination metadata missing
```typescript
// Check: formatListResponse params
formatListResponse(data, pagination.total, pagination);
// Need all three params
```

## Contributing

When adding new utilities:

1. Add to appropriate file (`crud.ts`, `pagination.ts`, etc.)
2. Export from `index.ts`
3. Add JSDoc with examples
4. Update this README
5. Add tests in `__tests__/` directory

---

For detailed CRUD implementation patterns, see `CRUD_PATTERNS.md`.
