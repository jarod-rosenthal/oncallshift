# OnCallShift API Stability Policy

This document describes the OnCallShift API versioning policy, stability guarantees, and best practices for building reliable integrations.

## Table of Contents

- [API Versioning Policy](#api-versioning-policy)
- [Stability Guarantees](#stability-guarantees)
- [Breaking Change Policy](#breaking-change-policy)
- [Idempotency Support](#idempotency-support)
- [Conditional Requests (ETags)](#conditional-requests-etags)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [SDK and Client Library Support](#sdk-and-client-library-support)

---

## API Versioning Policy

### Current Version

The OnCallShift API is currently on **version 1** (`v1`). All production endpoints are available at:

```
https://oncallshift.com/api/v1/
```

### Versioning Scheme

We use **URL path versioning** for the API. The version number is included in the URL path:

```
https://oncallshift.com/api/v1/incidents
https://oncallshift.com/api/v1/services
https://oncallshift.com/api/v1/teams
```

This approach:
- Makes the API version explicit in every request
- Allows multiple versions to coexist
- Simplifies caching and routing

### Backwards Compatibility Guarantees

Within a major version (e.g., `v1`), we guarantee:

1. **Existing endpoints will not be removed** without following the deprecation process
2. **Required request parameters will not be added** to existing endpoints
3. **Response field types will not change** (e.g., a string will not become an integer)
4. **Existing response fields will not be removed** without deprecation notice
5. **HTTP methods for endpoints will not change**
6. **Authentication mechanisms will remain stable**

### Deprecation Timeline

When we deprecate an API feature, we commit to:

| Phase | Timeline | Action |
|-------|----------|--------|
| Announcement | Day 0 | Deprecation notice in changelog, API docs, and response headers |
| Warning Period | 6 months | `Deprecation` and `Sunset` headers added to responses |
| Migration Support | 6 months | Documentation for migration path, support available |
| Removal | 12+ months | Feature removed in next major version |

**Deprecation headers example:**

```http
HTTP/1.1 200 OK
Deprecation: Sun, 01 Jan 2027 00:00:00 GMT
Sunset: Sun, 01 Jul 2027 00:00:00 GMT
Link: <https://docs.oncallshift.com/migration/incident-v2>; rel="deprecation"
```

---

## Stability Guarantees

### What We Promise Will Not Change

These aspects of the API are considered stable within a major version:

| Category | Examples |
|----------|----------|
| **Response Structure** | JSON object structure, field names, nesting |
| **Field Names** | `id`, `created_at`, `updated_at`, `name`, etc. |
| **Field Types** | String, number, boolean, array, object types |
| **HTTP Methods** | GET, POST, PUT, PATCH, DELETE for existing endpoints |
| **Authentication** | Bearer token format, Cognito JWT validation |
| **Status Codes** | Semantic meaning of 200, 201, 400, 401, 403, 404, 409, 422, 429, 500 |
| **Error Format** | `{ "error": "...", "message": "..." }` structure |

### What May Change With Notice

These changes may occur with advance notice (minimum 30 days):

| Change Type | Notice Period | Communication |
|-------------|---------------|---------------|
| New optional response fields | 30 days | Changelog |
| New optional request parameters | 30 days | Changelog |
| New endpoints | Immediate | Changelog, API docs |
| New error codes | 30 days | Changelog |
| Rate limit adjustments | 30 days | Email, changelog |
| New enum values | 30 days | Changelog |

**Example of an additive change:**

```json
// Before
{
  "id": "inc_123",
  "summary": "Database connection timeout",
  "status": "triggered"
}

// After (new optional field added)
{
  "id": "inc_123",
  "summary": "Database connection timeout",
  "status": "triggered",
  "priority": "P1"  // New optional field
}
```

### What May Change Without Notice

These changes may occur at any time:

- Internal implementation details
- Performance optimizations
- Response time improvements
- Order of fields in JSON responses
- Order of items in arrays (unless explicitly documented as sorted)
- Whitespace and formatting in responses
- Internal error messages (keep error codes stable)
- Request and response size limits (within reasonable bounds)

---

## Breaking Change Policy

### Definition of a Breaking Change

A change is considered **breaking** if it could cause existing, correctly-written client code to fail. Examples include:

| Breaking Change | Example |
|-----------------|---------|
| Removing an endpoint | DELETE `/api/v1/legacy-endpoint` |
| Removing a response field | Removing `incident.service_id` |
| Changing a field type | `count: "5"` to `count: 5` |
| Adding a required parameter | New required `team_id` on POST |
| Changing authentication | Moving from API key to OAuth only |
| Changing error response format | `{ "error": "..." }` to `{ "errors": [...] }` |
| Renaming a field | `created_at` to `createdAt` |
| Changing enum values | `"triggered"` to `"TRIGGERED"` |

### Non-Breaking Changes

These changes are **not** considered breaking:

| Non-Breaking Change | Example |
|--------------------|---------|
| Adding a new endpoint | POST `/api/v1/new-feature` |
| Adding optional response fields | New `metadata` field |
| Adding optional request parameters | New `include_resolved` query param |
| Adding new enum values | New `"snoozed"` status |
| Increasing rate limits | 100/min to 200/min |
| Improving error messages | Better descriptions |
| Performance improvements | Faster response times |

### How We Communicate Breaking Changes

1. **Changelog**: Posted at [oncallshift.com/changelog](https://oncallshift.com/changelog)
2. **Email**: Sent to organization admins
3. **API Response Headers**: `Deprecation` and `Sunset` headers
4. **Documentation**: Migration guides published
5. **Dashboard Banner**: In-app notification for affected features

### Migration Support Timeline

| Milestone | Timeframe | Support Available |
|-----------|-----------|-------------------|
| Announcement | Day 0 | Documentation published |
| Migration Window | Months 1-6 | Both old and new versions available |
| Extended Support | Months 6-12 | Old version in maintenance mode |
| End of Life | Month 12+ | Old version removed |

### Examples of Breaking vs Non-Breaking Changes

**Breaking (requires new API version):**

```diff
// Changing response structure
- { "data": { "id": "123", "name": "Service A" } }
+ { "service": { "uuid": "123", "title": "Service A" } }
```

**Non-Breaking (safe within same version):**

```diff
// Adding new optional field
  {
    "id": "123",
    "name": "Service A",
+   "description": "Primary API service"
  }
```

---

## Idempotency Support

OnCallShift supports idempotent requests to safely retry operations without causing duplicate effects.

### How to Use the Idempotency-Key Header

Include an `Idempotency-Key` header with POST, PUT, and PATCH requests:

```bash
curl -X POST https://oncallshift.com/api/v1/incidents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "service_id": "svc_123",
    "summary": "High CPU usage on web-server-01"
  }'
```

### Key Format Recommendations

| Recommendation | Details |
|----------------|---------|
| **Format** | UUID v4 (recommended) or any unique string |
| **Length** | Maximum 255 characters |
| **Uniqueness** | Must be unique per organization |
| **Scope** | Keys are scoped to your organization |

**Good key examples:**

```
550e8400-e29b-41d4-a716-446655440000
incident-create-20260101-web-server-alert
order-12345-retry-1
```

### Key Expiration

- Idempotency keys expire after **24 hours**
- After expiration, the same key can be reused for a new request
- Expired keys are automatically cleaned up

### Behavior and Response Headers

**First request:**

```http
POST /api/v1/incidents HTTP/1.1
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

HTTP/1.1 201 Created
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{ "id": "inc_abc123", "summary": "High CPU usage" }
```

**Subsequent request with same key (within 24 hours):**

```http
POST /api/v1/incidents HTTP/1.1
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

HTTP/1.1 201 Created
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Idempotent-Replayed: true
Content-Type: application/json

{ "id": "inc_abc123", "summary": "High CPU usage" }
```

### Error Handling for Idempotency

| Scenario | Status Code | Response |
|----------|-------------|----------|
| Key too long (>255 chars) | 400 | `{ "error": "Invalid Idempotency-Key" }` |
| Key used for different endpoint | 422 | `{ "error": "Idempotency key conflict" }` |
| Key used for different method | 422 | `{ "error": "Idempotency key conflict" }` |

**Conflict example:**

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{
  "error": "Idempotency key conflict",
  "message": "Idempotency key was already used for a different request (POST /api/v1/services)"
}
```

### Best Practices

1. **Generate unique keys per logical operation** - Use UUIDs or combine operation type with a unique identifier
2. **Store keys for retry logic** - Keep track of keys used for pending operations
3. **Don't reuse keys for different operations** - Each unique operation should have its own key
4. **Include keys in logging** - Helps with debugging and audit trails

---

## Conditional Requests (ETags)

OnCallShift implements HTTP conditional requests (RFC 7232) using ETags for caching and optimistic concurrency control.

### How ETags Work

Every GET response includes an `ETag` header representing the current state of the resource:

```http
GET /api/v1/incidents/inc_123 HTTP/1.1

HTTP/1.1 200 OK
ETag: "a1b2c3d4e5f6"
Content-Type: application/json

{ "id": "inc_123", "summary": "Database timeout", "status": "triggered" }
```

### If-None-Match for Caching (GET Requests)

Use `If-None-Match` to avoid downloading unchanged resources:

```http
GET /api/v1/incidents/inc_123 HTTP/1.1
If-None-Match: "a1b2c3d4e5f6"

HTTP/1.1 304 Not Modified
ETag: "a1b2c3d4e5f6"
```

**Benefits:**
- Reduced bandwidth usage
- Faster response times
- Lower server load

### If-Match for Optimistic Concurrency (PUT/PATCH/DELETE)

Use `If-Match` to prevent lost updates when multiple clients modify the same resource:

```http
# First, fetch the resource
GET /api/v1/services/svc_123 HTTP/1.1

HTTP/1.1 200 OK
ETag: "abc123"
{ "id": "svc_123", "name": "API Gateway", "description": "Main gateway" }

# Then update with If-Match
PUT /api/v1/services/svc_123 HTTP/1.1
If-Match: "abc123"
Content-Type: application/json

{ "name": "API Gateway", "description": "Updated description" }

HTTP/1.1 200 OK
ETag: "def456"
```

**If another client modified the resource:**

```http
PUT /api/v1/services/svc_123 HTTP/1.1
If-Match: "abc123"

HTTP/1.1 412 Precondition Failed
Content-Type: application/json

{
  "error": "Precondition Failed",
  "message": "The resource has been modified since you last fetched it. Please refresh and try again.",
  "currentETag": "xyz789"
}
```

### Weak vs Strong ETags

| Type | Format | Use Case |
|------|--------|----------|
| **Strong** | `"abc123"` | Single entity responses, byte-for-byte comparison |
| **Weak** | `W/"abc123"` | Collection responses, semantic equivalence |

**Strong ETags** are used for individual resources where exact content matters:

```http
ETag: "a1b2c3d4e5f6"
```

**Weak ETags** are used for collections where item order may vary:

```http
ETag: W/"collection-hash-xyz"
```

### When to Use ETags

| Operation | Header | Purpose |
|-----------|--------|---------|
| GET single resource | `If-None-Match` | Cache validation |
| GET collection | `If-None-Match` | Cache validation |
| PUT/PATCH | `If-Match` | Prevent lost updates |
| DELETE | `If-Match` | Prevent deleting modified resource |

---

## Rate Limiting

OnCallShift implements rate limiting to ensure fair usage and protect service stability.

### Current Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| **Standard API endpoints** | 1000 requests | per minute |
| **Webhook ingestion** | 100 requests | per minute |
| **Authentication** | 20 requests | per minute |
| **AI/ML endpoints** | 10 requests | per minute |
| **Bulk operations** | 10 requests | per minute |

Limits are applied per API key or per IP address for unauthenticated requests.

### Rate Limit Headers

Every response includes rate limit information:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1704067260
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

### Handling Rate Limit Errors

When you exceed the rate limit, you receive a `429 Too Many Requests` response:

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704067320
Retry-After: 45
Content-Type: application/json

{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Maximum 100 requests per 60 seconds.",
  "retryAfter": 45
}
```

### Best Practices for Handling Rate Limits

1. **Monitor headers proactively**

```javascript
const remaining = response.headers.get('X-RateLimit-Remaining');
if (remaining < 10) {
  console.warn('Approaching rate limit');
}
```

2. **Implement exponential backoff**

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      const backoff = retryAfter * 1000 * Math.pow(2, attempt);
      await sleep(backoff);
      continue;
    }

    return response;
  }
  throw new Error('Max retries exceeded');
}
```

3. **Batch requests when possible**

```bash
# Instead of multiple individual requests
GET /api/v1/incidents/inc_1
GET /api/v1/incidents/inc_2
GET /api/v1/incidents/inc_3

# Use bulk endpoints
GET /api/v1/incidents?ids=inc_1,inc_2,inc_3
```

4. **Cache responses locally**

Use ETags and local caching to reduce unnecessary requests.

### Requesting Higher Limits

If your integration requires higher rate limits:

1. Contact support@oncallshift.com
2. Describe your use case and expected request volume
3. Provide your organization ID and API key prefix

Enterprise plans include higher default limits and custom limit configurations.

---

## Error Handling

### Standard Error Response Format

All API errors follow a consistent JSON structure:

```json
{
  "error": "Short error identifier",
  "message": "Human-readable description of what went wrong",
  "details": {
    "field": "Additional context if applicable"
  }
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | OK | Successful GET, PUT, PATCH |
| `201` | Created | Successful POST that creates a resource |
| `202` | Accepted | Request accepted for async processing |
| `204` | No Content | Successful DELETE |
| `304` | Not Modified | ETag matched, use cached version |
| `400` | Bad Request | Invalid request syntax or parameters |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Valid auth but insufficient permissions |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Resource state conflict (e.g., duplicate) |
| `412` | Precondition Failed | ETag mismatch on conditional request |
| `422` | Unprocessable Entity | Validation errors, business rule violations |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server error |
| `502` | Bad Gateway | Upstream service unavailable |
| `503` | Service Unavailable | Temporary service outage |

### Error Codes Reference

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `invalid_request` | 400 | Request body is malformed |
| `validation_error` | 400 | Request parameters failed validation |
| `authentication_required` | 401 | No valid credentials provided |
| `invalid_token` | 401 | Token is expired or malformed |
| `permission_denied` | 403 | User lacks required permissions |
| `resource_not_found` | 404 | Requested resource does not exist |
| `duplicate_resource` | 409 | Resource already exists |
| `precondition_failed` | 412 | If-Match ETag mismatch |
| `idempotency_conflict` | 422 | Idempotency key used for different request |
| `rate_limit_exceeded` | 429 | Too many requests |
| `internal_error` | 500 | Unexpected server error |
| `service_unavailable` | 503 | AI service or external dependency down |

### Validation Error Format

For validation errors, the response includes specific field errors:

```json
{
  "error": "Validation failed",
  "message": "Request validation failed",
  "errors": [
    {
      "field": "summary",
      "message": "Summary is required",
      "code": "required"
    },
    {
      "field": "service_id",
      "message": "Invalid service ID format",
      "code": "invalid_format"
    }
  ]
}
```

### Retry Guidance

| Status Code | Retry? | Strategy |
|-------------|--------|----------|
| `400` | No | Fix request and retry |
| `401` | No | Refresh authentication |
| `403` | No | Check permissions |
| `404` | No | Resource doesn't exist |
| `409` | Maybe | Resolve conflict, may need user input |
| `412` | Yes | Fetch latest version, reapply changes |
| `422` | No | Fix validation errors |
| `429` | Yes | Wait for `Retry-After`, use backoff |
| `500` | Yes | Exponential backoff, max 3 retries |
| `502` | Yes | Exponential backoff, max 3 retries |
| `503` | Yes | Wait for `Retry-After`, check status page |

### Example Error Handling

```javascript
async function handleApiResponse(response) {
  if (response.ok) {
    return response.json();
  }

  const error = await response.json();

  switch (response.status) {
    case 400:
    case 422:
      throw new ValidationError(error.message, error.errors);
    case 401:
      await refreshToken();
      throw new RetryableError('Token refreshed, please retry');
    case 403:
      throw new PermissionError(error.message);
    case 404:
      throw new NotFoundError(error.message);
    case 429:
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      throw new RateLimitError(error.message, retryAfter);
    case 500:
    case 502:
    case 503:
      throw new RetryableError(error.message);
    default:
      throw new ApiError(error.message);
  }
}
```

---

## SDK and Client Library Support

### Official Client Libraries

| Language | Package | Status |
|----------|---------|--------|
| JavaScript/TypeScript | `@oncallshift/sdk` | Planned |
| Python | `oncallshift` | Planned |
| Go | `github.com/oncallshift/oncallshift-go` | Planned |
| Ruby | `oncallshift` | Planned |

### Terraform Provider

The OnCallShift Terraform Provider enables infrastructure-as-code for incident management:

```hcl
terraform {
  required_providers {
    oncallshift = {
      source  = "oncallshift/oncallshift"
      version = "~> 1.0"
    }
  }
}

provider "oncallshift" {
  api_key = var.oncallshift_api_key
}

resource "oncallshift_service" "api" {
  name        = "API Service"
  team_id     = oncallshift_team.platform.id
  escalation_policy_id = oncallshift_escalation_policy.default.id
}
```

See the [Terraform Provider Documentation](./terraform-provider/README.md) for details.

### MCP Server

OnCallShift provides a Model Context Protocol (MCP) server for AI assistant integrations:

```json
{
  "mcpServers": {
    "oncallshift": {
      "command": "npx",
      "args": ["@oncallshift/mcp-server"],
      "env": {
        "ONCALLSHIFT_API_KEY": "your-api-key"
      }
    }
  }
}
```

The MCP server enables AI assistants to:
- Query incident status
- Acknowledge and resolve incidents
- Look up on-call schedules
- Execute runbook steps

### Version Compatibility Matrix

| Client Version | API Version | Support Status |
|----------------|-------------|----------------|
| SDK 1.x | v1 | Current |
| Terraform 1.x | v1 | Current |
| MCP Server 1.x | v1 | Current |

### Building Your Own Client

When building custom integrations:

1. **Always set User-Agent header**

```http
User-Agent: MyApp/1.0.0 (contact@example.com)
```

2. **Handle pagination**

```javascript
async function* fetchAllIncidents() {
  let cursor = null;
  do {
    const response = await fetch(
      `https://oncallshift.com/api/v1/incidents?cursor=${cursor || ''}`
    );
    const data = await response.json();
    yield* data.incidents;
    cursor = data.pagination?.next_cursor;
  } while (cursor);
}
```

3. **Implement idempotency for mutations**

```javascript
const response = await fetch('https://oncallshift.com/api/v1/incidents', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID()
  },
  body: JSON.stringify(incidentData)
});
```

4. **Use ETags for caching**

```javascript
const cache = new Map();

async function fetchWithCache(url) {
  const cached = cache.get(url);
  const headers = {};

  if (cached) {
    headers['If-None-Match'] = cached.etag;
  }

  const response = await fetch(url, { headers });

  if (response.status === 304) {
    return cached.data;
  }

  const data = await response.json();
  const etag = response.headers.get('ETag');

  if (etag) {
    cache.set(url, { data, etag });
  }

  return data;
}
```

---

## Additional Resources

- **API Reference**: [oncallshift.com/api-docs](https://oncallshift.com/api-docs)
- **Changelog**: [oncallshift.com/changelog](https://oncallshift.com/changelog)
- **Status Page**: [status.oncallshift.com](https://status.oncallshift.com)
- **Support**: support@oncallshift.com
- **Developer Slack**: [oncallshift-community.slack.com](https://oncallshift-community.slack.com)

---

*Last updated: January 2026*
