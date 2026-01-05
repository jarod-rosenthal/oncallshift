# Add API Endpoint

> Create a new REST API endpoint following OnCallShift patterns and conventions.

## Goal

Implement a new API endpoint that follows existing patterns in `backend/src/api/routes/`, including proper authentication, validation, error handling, and documentation.

## Inputs

- **JIRA_ISSUE_KEY**: The Jira ticket with requirements
- **JIRA_DESCRIPTION**: Detailed requirements including:
  - HTTP method (GET, POST, PUT, DELETE, PATCH)
  - Endpoint path
  - Request/response format
  - Business logic

## Pre-flight Checks

1. **Find similar endpoints:**
   ```
   execution/codebase/search_patterns.ts
     --directory backend/src/api/routes
     --pattern "<similar-functionality>"
   ```

   Use these as templates:
   - CRUD operations -> `teams.ts`, `services.ts`
   - Complex queries -> `incidents.ts`, `analytics.ts`
   - External integrations -> `webhooks.ts`, `integrations.ts`
   - AI features -> `ai-diagnosis.ts`, `ai-assistant.ts`

2. **Check if route file exists:**
   - If adding to existing domain, modify that file
   - If new domain, create new file in `backend/src/api/routes/`

3. **Verify models exist:**
   ```
   execution/codebase/find_model.ts
     --name "<EntityName>"
   ```
   If model doesn't exist, create it first (see separate directive).

## Steps

### Step 1: Create/Modify Route File

If creating a new route file:

```typescript
// backend/src/api/routes/<domain>.ts

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateRequest, requireAdmin } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { YourModel } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { notFound, conflict, internalError } from '../../shared/utils/problem-details';
import { parsePaginationParams, paginatedResponse } from '../../shared/utils/pagination';
import { paginationValidators } from '../../shared/validators/pagination';

const router = Router();

// All routes require authentication (supports JWT, service API key, and org API key)
router.use(authenticateRequest);

// ... routes here

export default router;
```

### Step 2: Implement the Endpoint

Follow this pattern for each endpoint:

```typescript
/**
 * @swagger
 * /api/v1/<domain>:
 *   <method>:
 *     summary: Brief description
 *     description: Detailed description
 *     tags: [<Domain>]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     // ... parameters, requestBody, responses
 */
router.<method>(
  '/<path>',
  // Validation middleware
  [
    body('field').isString().notEmpty(),
    // ... more validators
  ],
  async (req: Request, res: Response) => {
    try {
      // 1. Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // 2. Get org context (multi-tenancy)
      const orgId = req.orgId!;

      // 3. Get data source and repos
      const dataSource = await getDataSource();
      const repo = dataSource.getRepository(YourModel);

      // 4. Business logic
      // ... your implementation

      // 5. Return response
      return res.json({ data: result });

    } catch (error) {
      logger.error('Error in <endpoint>:', error);
      return internalError(res, 'Failed to <action>');
    }
  }
);
```

### Step 3: Register the Route

If new file, add to `backend/src/api/routes/index.ts`:

```typescript
import domainRouter from './domain';
// ...
app.use('/api/v1/domain', domainRouter);
```

### Step 4: Add Input Validation

Use express-validator for all inputs:

```typescript
// Path parameters
param('id').isUUID().withMessage('Valid ID required')

// Query parameters
query('status').optional().isIn(['active', 'inactive'])

// Body fields
body('name').isString().trim().notEmpty().isLength({ max: 255 })
body('email').isEmail().normalizeEmail()
body('count').isInt({ min: 1, max: 100 })
body('data').isObject()
body('tags').isArray()
```

### Step 5: Handle Errors Properly

Use problem-details utilities:

```typescript
import { notFound, conflict, badRequest, internalError } from '../../shared/utils/problem-details';

// 404 - Resource not found
if (!entity) {
  return notFound(res, 'Team', id);
}

// 409 - Conflict (duplicate, etc.)
if (existing) {
  return conflict(res, 'A team with this name already exists');
}

// 400 - Bad request
return badRequest(res, 'Invalid date range');

// 500 - Internal error (catch block)
return internalError(res, 'Failed to create team');
```

### Step 6: Add Pagination (for list endpoints)

```typescript
import { parsePaginationParams, paginatedResponse, validateSortField } from '../../shared/utils/pagination';
import { paginationValidators } from '../../shared/validators/pagination';

router.get('/', paginationValidators, async (req, res) => {
  const pagination = parsePaginationParams(req.query);

  const queryBuilder = repo
    .createQueryBuilder('entity')
    .where('entity.org_id = :orgId', { orgId });

  const sortField = validateSortField('entities', pagination.sort, 'name');
  queryBuilder.orderBy(`entity.${sortField}`, pagination.order === 'asc' ? 'ASC' : 'DESC');

  const total = await queryBuilder.getCount();
  queryBuilder.skip(pagination.offset).take(pagination.limit);
  const items = await queryBuilder.getMany();

  return res.json(paginatedResponse(items, total, pagination, items[items.length - 1], 'entities'));
});
```

### Step 7: Write Tests

Create test file at `backend/src/api/routes/__tests__/<domain>.test.ts`:

```typescript
import request from 'supertest';
import { app } from '../../../app';
import { getDataSource } from '../../../shared/db/data-source';

describe('<Domain> API', () => {
  beforeAll(async () => {
    // Setup test database connection
  });

  describe('GET /api/v1/<domain>', () => {
    it('should return paginated list', async () => {
      const response = await request(app)
        .get('/api/v1/<domain>')
        .set('Authorization', 'Bearer <test-token>');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });
});
```

### Step 8: Verify with TypeCheck and Tests

```
execution/test/run_typecheck.ts --project backend
execution/test/run_tests.ts --pattern <domain> --project backend
```

## Outputs

- [ ] Route file created/modified at `backend/src/api/routes/<domain>.ts`
- [ ] Route registered in `index.ts` (if new file)
- [ ] Swagger documentation added
- [ ] Input validation implemented
- [ ] Error handling uses problem-details
- [ ] Pagination for list endpoints
- [ ] Multi-tenancy (orgId) enforced
- [ ] Tests written and passing
- [ ] TypeScript compiles without errors

## Edge Cases

### Need Admin-Only Access

Add `requireAdmin` middleware:

```typescript
import { requireAdmin } from '../../shared/auth/middleware';

router.post('/', requireAdmin, [...validators], handler);
```

### Need Custom Authorization

For complex permissions (team managers, resource owners):

```typescript
// Check user is team manager
const membership = await membershipRepo.findOne({
  where: { teamId: id, userId: req.userId, role: 'manager' }
});
if (!membership) {
  return res.status(403).json({ error: 'Team manager access required' });
}
```

### External API Calls

When calling external services:
- Use try/catch with specific error handling
- Add timeout
- Log external call failures
- Return user-friendly error messages

### File Uploads

For endpoints accepting files:
- Use multer middleware
- Validate file type and size
- Store in S3, not local disk
- See `semantic-import.ts` for example

## Self-Annealing Notes

<!-- Updated by AI workers when they learn something -->
