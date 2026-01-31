# API Reference

The OnCallShift REST API enables programmatic access to all platform features. Build integrations, automate workflows, and manage your incident response infrastructure.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Rate Limits](#rate-limits)
- [Request Format](#request-format)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Pagination](#pagination)
- [Common Endpoints](#common-endpoints)
- [Webhooks](#webhooks)
- [SDKs and Tools](#sdks-and-tools)

---

## Overview

The OnCallShift API follows REST conventions:

- **HTTPS only** - All requests must use HTTPS
- **JSON format** - Request and response bodies are JSON
- **Resource-based URLs** - Clear, predictable endpoint structure
- **Standard HTTP methods** - GET, POST, PUT, PATCH, DELETE
- **Meaningful status codes** - Success, client errors, server errors

**Full API Documentation**: [oncallshift.com/api-docs](https://oncallshift.com/api-docs)

The Swagger/OpenAPI documentation provides:
- Complete endpoint reference
- Request/response schemas
- Interactive "Try it out" functionality
- Code generation for multiple languages

---

## Authentication

### API Keys

All API requests require authentication via API key.

**Generate an API key**:
1. Navigate to **Settings** > **API Keys**
2. Click **Create API Key**
3. Select permissions (read-only or read-write)
4. Copy and securely store the key

**Include in requests**:

```bash
# Authorization header (recommended)
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://oncallshift.com/api/v1/incidents

# Query parameter (less secure)
curl "https://oncallshift.com/api/v1/incidents?api_key=YOUR_API_KEY"
```

### Key Permissions

| Permission | Access Level |
|------------|--------------|
| **Read-only** | GET requests only |
| **Read-write** | All methods |

### Key Security

- Keys are shown only once at creation
- Store securely (secrets manager, environment variables)
- Never commit to source control
- Rotate regularly
- Use separate keys per integration

---

## Base URL

All API endpoints use:

```
https://oncallshift.com/api/v1
```

Example full URL:
```
https://oncallshift.com/api/v1/incidents
```

---

## Rate Limits

### Default Limits

| Endpoint Type | Limit |
|---------------|-------|
| Read (GET) | 600 requests/minute |
| Write (POST/PUT/PATCH/DELETE) | 120 requests/minute |
| Alert ingestion | 120 requests/minute per service |

### Rate Limit Headers

Responses include rate limit information:

```
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 595
X-RateLimit-Reset: 1704067200
```

### Handling Rate Limits

When rate limited, you receive:

```json
{
  "status": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Retry after 45 seconds.",
  "retry_after": 45
}
```

**Best practices**:
- Implement exponential backoff
- Cache responses where possible
- Use webhooks for real-time updates
- Contact support for higher limits

---

## Request Format

### Headers

Required headers:

```
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

Optional headers:

```
Accept: application/json
X-Request-Id: your-unique-id    # For request tracing
```

### Request Body

POST, PUT, PATCH requests include JSON body:

```bash
curl -X POST https://oncallshift.com/api/v1/incidents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "summary": "Database connection error",
    "service_id": "svc_abc123",
    "severity": "high"
  }'
```

### Query Parameters

GET requests use query parameters for filtering:

```bash
# Filter incidents by status and date
curl "https://oncallshift.com/api/v1/incidents?status=triggered&since=2026-01-01"
```

---

## Response Format

### Success Response

Successful requests return appropriate status codes:

| Method | Success Code | Meaning |
|--------|--------------|---------|
| GET | 200 | Resource retrieved |
| POST | 201 | Resource created |
| PUT/PATCH | 200 | Resource updated |
| DELETE | 204 | Resource deleted |

**Single resource**:
```json
{
  "data": {
    "id": "inc_abc123",
    "summary": "Database connection error",
    "status": "triggered",
    "severity": "high",
    "created_at": "2026-01-02T10:30:00Z"
  }
}
```

**Collection**:
```json
{
  "data": [
    { "id": "inc_abc123", "summary": "..." },
    { "id": "inc_def456", "summary": "..." }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "per_page": 25,
    "total_pages": 6
  }
}
```

### Timestamps

All timestamps are ISO 8601 format in UTC:

```
2026-01-02T10:30:00Z
```

### IDs

Resources use prefixed IDs for clarity:

| Resource | Prefix | Example |
|----------|--------|---------|
| Incident | `inc_` | `inc_abc123` |
| Service | `svc_` | `svc_def456` |
| Team | `team_` | `team_ghi789` |
| User | `usr_` | `usr_jkl012` |
| Schedule | `sch_` | `sch_mno345` |
| Escalation Policy | `esc_` | `esc_pqr678` |

---

## Error Handling

### Error Response Format

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    {
      "field": "severity",
      "message": "must be one of: critical, high, medium, low, info"
    }
  ],
  "request_id": "req_abc123xyz"
}
```

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request | Check request format/parameters |
| 401 | Unauthorized | Check API key |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists or state conflict |
| 422 | Unprocessable | Validation failed |
| 429 | Too Many Requests | Implement backoff, retry later |
| 500 | Server Error | Retry, contact support if persists |
| 503 | Service Unavailable | Maintenance, retry later |

### Error Handling Example

```javascript
async function createIncident(data) {
  try {
    const response = await fetch('https://oncallshift.com/api/v1/incidents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = error.retry_after || 60;
        await sleep(retryAfter * 1000);
        return createIncident(data);
      }

      if (response.status >= 400 && response.status < 500) {
        // Client error - fix the request
        throw new Error(`Client error: ${error.message}`);
      }

      if (response.status >= 500) {
        // Server error - retry with backoff
        throw new Error(`Server error: ${error.message}`);
      }
    }

    return response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}
```

---

## Pagination

### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 25 | Items per page (max 100) |

```bash
curl "https://oncallshift.com/api/v1/incidents?page=2&per_page=50"
```

### Response Metadata

```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "page": 2,
    "per_page": 50,
    "total_pages": 3,
    "has_next": true,
    "has_prev": true
  }
}
```

### Cursor Pagination

For large datasets, use cursor pagination:

```bash
# First request
curl "https://oncallshift.com/api/v1/incidents?limit=100"

# Response includes cursor
{
  "data": [...],
  "cursor": "eyJpZCI6ImluY18xMjMifQ=="
}

# Next request
curl "https://oncallshift.com/api/v1/incidents?limit=100&cursor=eyJpZCI6ImluY18xMjMifQ=="
```

---

## Common Endpoints

### Incidents

```bash
# List incidents
GET /api/v1/incidents
GET /api/v1/incidents?status=triggered&severity=critical

# Get incident
GET /api/v1/incidents/{id}

# Create incident
POST /api/v1/incidents

# Update incident
PATCH /api/v1/incidents/{id}

# Acknowledge
POST /api/v1/incidents/{id}/acknowledge

# Resolve
POST /api/v1/incidents/{id}/resolve

# Escalate
POST /api/v1/incidents/{id}/escalate

# Snooze
POST /api/v1/incidents/{id}/snooze

# Add note
POST /api/v1/incidents/{id}/notes
```

### Services

```bash
# List services
GET /api/v1/services

# Get service
GET /api/v1/services/{id}

# Create service
POST /api/v1/services

# Update service
PUT /api/v1/services/{id}

# Delete service
DELETE /api/v1/services/{id}
```

### Schedules

```bash
# List schedules
GET /api/v1/schedules

# Get schedule
GET /api/v1/schedules/{id}

# Get current on-call
GET /api/v1/schedules/{id}/oncall

# Create override
POST /api/v1/schedules/{id}/overrides
```

### Users

```bash
# List users
GET /api/v1/users

# Get user
GET /api/v1/users/{id}

# Get current user
GET /api/v1/users/me

# Invite user
POST /api/v1/users/invite
```

### Teams

```bash
# List teams
GET /api/v1/teams

# Get team
GET /api/v1/teams/{id}

# Create team
POST /api/v1/teams

# Update team
PUT /api/v1/teams/{id}
```

### Escalation Policies

```bash
# List policies
GET /api/v1/escalation-policies

# Get policy
GET /api/v1/escalation-policies/{id}

# Create policy
POST /api/v1/escalation-policies

# Update policy
PUT /api/v1/escalation-policies/{id}
```

### Alert Webhook

```bash
# Trigger alert (creates incident)
POST /api/v1/alerts/webhook
```

See [Webhooks Integration](./integrations/webhooks.md) for details.

---

## Webhooks

### Outbound Webhooks

OnCallShift can send webhooks to your systems when events occur.

**Configure webhooks**:
1. Go to **Settings** > **Webhooks**
2. Add endpoint URL
3. Select events to subscribe
4. Set secret for signature verification

**Events available**:
- `incident.triggered`
- `incident.acknowledged`
- `incident.resolved`
- `incident.escalated`
- `incident.reassigned`

**Payload format**:
```json
{
  "event": "incident.triggered",
  "timestamp": "2026-01-02T10:30:00Z",
  "data": {
    "incident": {
      "id": "inc_abc123",
      "summary": "Database error",
      "status": "triggered"
    }
  }
}
```

**Signature verification**:
```
X-OnCallShift-Signature: sha256=abc123...
```

Verify with:
```python
import hmac
import hashlib

def verify_signature(payload, signature, secret):
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

---

## SDKs and Tools

### Official SDKs

| Language | Package |
|----------|---------|
| Python | `pip install oncallshift` |
| Node.js | `npm install @oncallshift/sdk` |
| Go | `go get github.com/oncallshift/oncallshift-go` |

### Python Example

```python
from oncallshift import Client

client = Client(api_key='YOUR_API_KEY')

# List incidents
incidents = client.incidents.list(status='triggered')

# Acknowledge incident
client.incidents.acknowledge('inc_abc123')

# Create service
service = client.services.create(
    name='Payment API',
    team_id='team_xyz',
    escalation_policy_id='esc_123'
)
```

### Node.js Example

```javascript
const { OnCallShift } = require('@oncallshift/sdk');

const client = new OnCallShift({ apiKey: 'YOUR_API_KEY' });

// List incidents
const incidents = await client.incidents.list({ status: 'triggered' });

// Acknowledge incident
await client.incidents.acknowledge('inc_abc123');

// Create service
const service = await client.services.create({
  name: 'Payment API',
  teamId: 'team_xyz',
  escalationPolicyId: 'esc_123'
});
```

### cURL Examples

```bash
# Authenticate
export OCS_API_KEY="your-api-key"

# List triggered incidents
curl -s -H "Authorization: Bearer $OCS_API_KEY" \
  "https://oncallshift.com/api/v1/incidents?status=triggered" | jq

# Acknowledge an incident
curl -X POST -H "Authorization: Bearer $OCS_API_KEY" \
  "https://oncallshift.com/api/v1/incidents/inc_abc123/acknowledge"

# Get current on-call
curl -s -H "Authorization: Bearer $OCS_API_KEY" \
  "https://oncallshift.com/api/v1/schedules/sch_xyz/oncall" | jq
```

### Terraform Provider

See [Terraform Integration](./integrations/terraform.md) for infrastructure as code.

---

## Additional Resources

- **Interactive Docs**: [oncallshift.com/api-docs](https://oncallshift.com/api-docs)
- **OpenAPI Spec**: [oncallshift.com/api/openapi.json](https://oncallshift.com/api/openapi.json)
- **Postman Collection**: Available in API docs
- **Status Page**: [status.oncallshift.com](https://status.oncallshift.com)

---

*Need help? See [Troubleshooting](./troubleshooting.md) or [contact support](./contact.md).*
