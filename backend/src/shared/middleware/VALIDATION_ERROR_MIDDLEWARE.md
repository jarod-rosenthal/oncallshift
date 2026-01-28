# Validation Error Middleware

The Validation Error Middleware automatically catches and formats validation errors from `express-validator` in the standardized RFC 9457 Problem Details format.

## Purpose

This middleware eliminates boilerplate code in route handlers by:
- Automatically extracting validation errors from the request
- Converting them to RFC 9457 format
- Returning a standardized 400 response with field-level error details
- Improving API consistency and reducing code duplication

## RFC 9457 Problem Details Format

All validation errors are returned in the following format:

```json
{
  "type": "https://oncallshift.com/problems/validation-error",
  "title": "Validation Failed",
  "status": 400,
  "detail": "One or more fields failed validation",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "value": "not-an-email"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters",
      "value": "123"
    }
  ],
  "validation_errors": [...] // Backwards compatibility
}
```

### Response Headers
- `Content-Type: application/problem+json`
- HTTP Status: `400 Bad Request`

## Usage

### Basic Pattern

Add the `validationErrorMiddleware` to your route's middleware array, **after** your validation rules and **before** your handler:

```typescript
import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { validationErrorMiddleware } from '../shared/middleware';

const router = Router();

router.post(
  '/users',
  [
    body('email').isEmail().withMessage('Invalid email address'),
    body('name').notEmpty().withMessage('Name is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validationErrorMiddleware, // Add this middleware
  async (req: Request, res: Response) => {
    // Handler code here - validation errors are already handled
    const { email, name, password } = req.body;

    // Proceed with your business logic
    const user = await createUser({ email, name, password });
    res.status(201).json({ user });
  }
);
```

### Before (Without Middleware)

```typescript
router.post(
  '/users',
  [
    body('email').isEmail(),
    body('name').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    // Manual validation error handling (repetitive)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Handler logic
    const user = await createUser(req.body);
    res.json(user);
  }
);
```

### After (With Middleware)

```typescript
router.post(
  '/users',
  [
    body('email').isEmail(),
    body('name').notEmpty(),
  ],
  validationErrorMiddleware, // Clean, consistent error handling
  async (req: Request, res: Response) => {
    // Validation errors are automatically handled
    // Just focus on business logic
    const user = await createUser(req.body);
    res.json(user);
  }
);
```

## Advanced Usage

### With Query Parameters

```typescript
router.get(
  '/search',
  [
    query('q').notEmpty().withMessage('Search term is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  ],
  validationErrorMiddleware,
  async (req: Request, res: Response) => {
    const { q, limit = 10 } = req.query;
    const results = await search(q as string, limit as number);
    res.json(results);
  }
);
```

### With URL Parameters

```typescript
router.get(
  '/users/:id',
  [
    param('id').isUUID().withMessage('Invalid user ID format'),
  ],
  validationErrorMiddleware,
  async (req: Request, res: Response) => {
    const user = await getUser(req.params.id);
    res.json(user);
  }
);
```

### With Multiple Validation Sources

```typescript
router.put(
  '/incidents/:incidentId/acknowledge',
  [
    param('incidentId').isUUID().withMessage('Invalid incident ID'),
    body('note').optional().isString().isLength({ max: 500 }).withMessage('Note must be 0-500 characters'),
    body('acknowledgedBy').optional().isUUID().withMessage('Invalid user ID'),
  ],
  validationErrorMiddleware,
  async (req: Request, res: Response) => {
    const { incidentId } = req.params;
    const { note, acknowledgedBy } = req.body;

    await acknowledgeIncident(incidentId, { note, acknowledgedBy });
    res.json({ success: true });
  }
);
```

## Middleware Chain Order

The correct order in a route definition is:

```typescript
router.post(
  '/path',
  [validation rules...],           // 1. Express-validator rules
  validationErrorMiddleware,        // 2. Validation error handling
  authenticateRequest,              // 3. Auth middleware (if needed)
  otherMiddleware,                  // 4. Other middleware
  async (req, res) => {            // 5. Handler
    // Business logic
  }
);
```

**Key Points:**
- Validation rules must come first (array)
- `validationErrorMiddleware` should be before authentication (optional)
- Handler function comes last

## Error Response Examples

### Invalid Email

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"email": "not-an-email", "name": "John"}'
```

**Response (400):**
```json
{
  "type": "https://oncallshift.com/problems/validation-error",
  "title": "Validation Failed",
  "status": 400,
  "detail": "One or more fields failed validation",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address",
      "value": "not-an-email"
    }
  ]
}
```

### Missing Required Fields

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"password": "123"}'
```

**Response (400):**
```json
{
  "type": "https://oncallshift.com/problems/validation-error",
  "title": "Validation Failed",
  "status": 400,
  "detail": "One or more fields failed validation",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address",
      "value": ""
    },
    {
      "field": "name",
      "message": "Name is required",
      "value": ""
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters",
      "value": "123"
    }
  ]
}
```

## Backwards Compatibility

The middleware maintains backwards compatibility by including both:
- `errors`: New standardized format (RFC 9457)
- `validation_errors`: Alias for `errors` field for older clients
- `error`: Generic error message for minimal clients

This ensures existing integrations continue to work while new clients can use the structured error details.

## Logging

Validation errors are automatically logged at the DEBUG level with:
- Request ID (for tracing)
- Endpoint path and method
- Number of errors
- Field names and messages

Example log:
```json
{
  "timestamp": "2024-01-27T23:30:45.123Z",
  "level": "debug",
  "message": "Validation errors detected",
  "requestId": "req-abc123",
  "endpoint": "/api/v1/users",
  "method": "POST",
  "errorCount": 2,
  "errors": [
    {"field": "email", "message": "Invalid email address"},
    {"field": "password", "message": "Password must be at least 8 characters"}
  ]
}
```

## Testing

When testing routes that use the validation error middleware:

```typescript
import request from 'supertest';
import { app } from './app';

describe('POST /api/v1/users', () => {
  it('should return validation errors in RFC 9457 format', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .send({ email: 'invalid-email' });

    expect(res.status).toBe(400);
    expect(res.body.type).toBe('https://oncallshift.com/problems/validation-error');
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0]).toMatchObject({
      field: 'email',
      message: 'Invalid email address',
    });
  });

  it('should return multiple validation errors', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .send({ password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(1);
  });

  it('should allow valid requests through', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .send({
        email: 'user@example.com',
        name: 'John Doe',
        password: 'securepassword123',
      });

    expect(res.status).not.toBe(400);
    expect(res.body.type).not.toBe('https://oncallshift.com/problems/validation-error');
  });
});
```

## Migration Guide

To migrate existing routes to use the middleware:

1. **Add import:**
   ```typescript
   import { validationErrorMiddleware } from '../../shared/middleware';
   ```

2. **Add to route middleware array:**
   ```typescript
   router.post(
     '/path',
     [validation rules...],
     validationErrorMiddleware,
     async (req, res) => { /* ... */ }
   );
   ```

3. **Remove manual error handling:**
   ```typescript
   // DELETE THIS:
   const errors = validationResult(req);
   if (!errors.isEmpty()) {
     return res.status(400).json({ errors: errors.array() });
   }
   ```

4. **Test the route to ensure it still works**

## Common Patterns

### Optional Fields
```typescript
router.post(
  '/update',
  [
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('phone').optional({ nullable: true }).isMobilePhone().withMessage('Invalid phone'),
  ],
  validationErrorMiddleware,
  async (req, res) => {
    // Only provided fields are validated
    await updateUser(req.body);
    res.json({ success: true });
  }
);
```

### Conditional Validation
```typescript
router.post(
  '/create',
  [
    body('type').isIn(['service', 'team']).withMessage('Invalid type'),
    body('name').notEmpty().withMessage('Name is required'),
    body('serviceId')
      .if((value, { req }) => req.body.type === 'service')
      .isUUID()
      .withMessage('Service ID must be valid UUID when type is service'),
  ],
  validationErrorMiddleware,
  async (req, res) => {
    await createResource(req.body);
    res.status(201).json({ success: true });
  }
);
```

### Custom Validators
```typescript
router.post(
  '/register',
  [
    body('email')
      .isEmail()
      .withMessage('Invalid email address')
      .custom(async (email) => {
        const exists = await User.findOne({ email });
        if (exists) {
          throw new Error('Email already registered');
        }
      }),
  ],
  validationErrorMiddleware,
  async (req, res) => {
    const user = await createUser(req.body);
    res.status(201).json({ user });
  }
);
```

## References

- [express-validator documentation](https://express-validator.github.io/docs)
- [RFC 9457 - Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [Problem Details in OnCallShift](./../../utils/problem-details.ts)
