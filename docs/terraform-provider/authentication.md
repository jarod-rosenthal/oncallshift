# Authentication

The OnCallShift Terraform Provider authenticates using Organization API Keys. This guide covers how to create API keys, configure the provider, and security best practices.

## Creating Organization API Keys

### Via the Web UI

1. Log in to [oncallshift.com](https://oncallshift.com) as an Admin or Owner
2. Navigate to **Settings** > **API Keys**
3. Click **Create API Key**
4. Enter a descriptive name (e.g., "terraform-production")
5. Select scopes (use `*` for full access or limit to specific resources)
6. Optionally set an expiration date
7. Click **Create**
8. **Copy the token immediately** - it will only be shown once

### Via the API

```bash
curl -X POST https://oncallshift.com/api/v1/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "terraform-production",
    "scopes": ["*"]
  }'
```

Response:
```json
{
  "api_key": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "terraform-production",
    "key_prefix": "org_abc123...",
    "scopes": ["*"],
    "created_at": "2024-01-15T10:30:00Z"
  },
  "token": "org_abc123def456789...",
  "message": "API key created successfully. Save this token - it will not be shown again."
}
```

## API Key Scopes

API keys can be restricted to specific resources and operations:

| Scope | Description |
|-------|-------------|
| `*` | Full access to all resources |
| `teams:read` | Read teams |
| `teams:write` | Create, update, delete teams |
| `users:read` | Read users |
| `users:write` | Invite, update, remove users |
| `services:read` | Read services |
| `services:write` | Create, update, delete services |
| `schedules:read` | Read schedules |
| `schedules:write` | Create, update, delete schedules |
| `escalation-policies:read` | Read escalation policies |
| `escalation-policies:write` | Create, update, delete policies |
| `incidents:read` | Read incidents |
| `incidents:write` | Create, update, resolve incidents |
| `integrations:read` | Read integrations |
| `integrations:write` | Create, update, delete integrations |

For Terraform, we recommend using `*` (full access) or all `:write` scopes to ensure Terraform can manage all resources.

## Provider Configuration

### Basic Configuration

```hcl
provider "oncallshift" {
  api_key = var.oncallshift_api_key
}

variable "oncallshift_api_key" {
  type        = string
  sensitive   = true
  description = "OnCallShift organization API key"
}
```

### With Base URL

For self-hosted or alternative environments:

```hcl
provider "oncallshift" {
  api_key  = var.oncallshift_api_key
  base_url = "https://api.example.com/api/v1"
}
```

### Using Environment Variables

The provider automatically reads from environment variables:

```bash
export ONCALLSHIFT_API_KEY="org_abc123def456789..."
export ONCALLSHIFT_BASE_URL="https://oncallshift.com/api/v1"  # optional
```

```hcl
# No explicit configuration needed
provider "oncallshift" {}
```

### Configuration Precedence

The provider reads configuration in this order (later overrides earlier):

1. Environment variables (`ONCALLSHIFT_API_KEY`, `ONCALLSHIFT_BASE_URL`)
2. Provider block arguments (`api_key`, `base_url`)

## Provider Arguments Reference

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `api_key` | String | Yes | Organization API key. Can also be set via `ONCALLSHIFT_API_KEY` environment variable. |
| `base_url` | String | No | API base URL. Defaults to `https://oncallshift.com/api/v1`. Can also be set via `ONCALLSHIFT_BASE_URL` environment variable. |

## Security Best Practices

### 1. Never Commit API Keys to Version Control

Use variables or environment variables instead of hardcoding:

```hcl
# DO NOT do this
provider "oncallshift" {
  api_key = "org_abc123..."  # BAD - hardcoded secret
}

# DO this instead
provider "oncallshift" {
  api_key = var.oncallshift_api_key  # Good - uses variable
}
```

### 2. Use Terraform Cloud/Enterprise for Secrets

Store API keys as sensitive workspace variables in Terraform Cloud:

```hcl
# terraform.tf
terraform {
  cloud {
    organization = "my-org"
    workspaces {
      name = "oncallshift-production"
    }
  }
}
```

Then set `ONCALLSHIFT_API_KEY` as a sensitive environment variable in the workspace settings.

### 3. Use Secret Management for CI/CD

**GitHub Actions:**
```yaml
env:
  ONCALLSHIFT_API_KEY: ${{ secrets.ONCALLSHIFT_API_KEY }}
```

**GitLab CI:**
```yaml
variables:
  ONCALLSHIFT_API_KEY: $ONCALLSHIFT_API_KEY  # from CI/CD settings
```

### 4. Create Separate API Keys per Environment

```hcl
# environments/dev/main.tf
provider "oncallshift" {
  api_key = var.oncallshift_api_key_dev
}

# environments/prod/main.tf
provider "oncallshift" {
  api_key = var.oncallshift_api_key_prod
}
```

### 5. Set Expiration Dates on API Keys

Create API keys with expiration for automated rotation:

```bash
curl -X POST https://oncallshift.com/api/v1/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "terraform-quarterly",
    "scopes": ["*"],
    "expires_at": "2024-04-01T00:00:00Z"
  }'
```

### 6. Rotate API Keys Regularly

Rotate keys without downtime using the rotate endpoint:

```bash
curl -X POST https://oncallshift.com/api/v1/api-keys/{id}/rotate \
  -H "Authorization: Bearer $JWT_TOKEN"
```

This invalidates the old key immediately and returns a new token.

### 7. Use Minimal Scopes for Automation

If your Terraform only manages specific resources, limit the API key scopes:

```json
{
  "name": "terraform-services-only",
  "scopes": [
    "services:read",
    "services:write",
    "escalation-policies:read",
    "schedules:read"
  ]
}
```

## Managing API Keys

### List All API Keys

```bash
curl https://oncallshift.com/api/v1/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Revoke an API Key

```bash
curl -X DELETE https://oncallshift.com/api/v1/api-keys/{id} \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Rotate an API Key

```bash
curl -X POST https://oncallshift.com/api/v1/api-keys/{id}/rotate \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Troubleshooting

### "Unauthorized" Error

```
Error: API request failed: 401 Unauthorized
```

**Solutions:**
1. Verify the API key is correct and not expired
2. Check the key has the required scopes
3. Ensure the key hasn't been revoked

### "Forbidden" Error

```
Error: API request failed: 403 Forbidden
```

**Solutions:**
1. Verify the API key has write permissions for the resource
2. Check if scopes are too restrictive
3. Ensure the resource belongs to your organization

### Connection Issues

```
Error: dial tcp: connection refused
```

**Solutions:**
1. Verify the base URL is correct
2. Check network connectivity to oncallshift.com
3. Ensure no firewall is blocking outbound HTTPS traffic
