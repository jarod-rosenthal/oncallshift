# Terraform Integration

Manage OnCallShift resources as infrastructure as code using our Terraform provider.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Authentication](#authentication)
- [Provider Configuration](#provider-configuration)
- [Resources](#resources)
- [Data Sources](#data-sources)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The OnCallShift Terraform provider enables:

- **Version-controlled configuration** - Track changes in Git
- **Repeatable deployments** - Consistent across environments
- **Team collaboration** - Review changes via pull requests
- **Automation** - CI/CD for incident management config

### Supported Resources

| Resource | Description |
|----------|-------------|
| `oncallshift_team` | Teams |
| `oncallshift_user` | Users (invite/manage) |
| `oncallshift_service` | Services |
| `oncallshift_escalation_policy` | Escalation policies |
| `oncallshift_schedule` | On-call schedules |
| `oncallshift_schedule_override` | Schedule overrides |
| `oncallshift_runbook` | Runbooks |
| `oncallshift_integration` | Service integrations |

---

## Installation

### Provider Requirements

- Terraform >= 1.0
- OnCallShift account with API access

### Provider Declaration

Add to your `terraform.tf`:

```hcl
terraform {
  required_providers {
    oncallshift = {
      source  = "oncallshift/oncallshift"
      version = "~> 1.0"
    }
  }
}
```

### Initialize

```bash
terraform init
```

---

## Authentication

### API Key

Generate an API key with appropriate permissions:

1. Go to **Settings** > **API Keys**
2. Click **Create API Key**
3. Name it (e.g., "Terraform")
4. Select **Read-Write** permissions
5. Copy the key

### Configuration Methods

**Option 1: Environment Variable** (Recommended)

```bash
export ONCALLSHIFT_API_KEY="your-api-key"
```

**Option 2: Provider Configuration**

```hcl
provider "oncallshift" {
  api_key = var.oncallshift_api_key
}
```

**Option 3: Terraform Variables**

```hcl
variable "oncallshift_api_key" {
  type      = string
  sensitive = true
}

provider "oncallshift" {
  api_key = var.oncallshift_api_key
}
```

Pass via CLI:
```bash
terraform apply -var="oncallshift_api_key=your-key"
```

Or via `terraform.tfvars`:
```hcl
oncallshift_api_key = "your-key"
```

---

## Provider Configuration

### Full Configuration

```hcl
provider "oncallshift" {
  api_key = var.oncallshift_api_key

  # Optional: API endpoint (default: https://oncallshift.com/api/v1)
  api_url = "https://oncallshift.com/api/v1"

  # Optional: Request timeout in seconds (default: 30)
  timeout = 60

  # Optional: Retry configuration
  max_retries = 3
}
```

---

## Resources

### oncallshift_team

Manage teams:

```hcl
resource "oncallshift_team" "backend" {
  name        = "Backend Engineering"
  description = "Backend services team"
  slug        = "backend"
}

resource "oncallshift_team" "sre" {
  name        = "Site Reliability Engineering"
  description = "SRE team"
  slug        = "sre"
}
```

### oncallshift_user

Invite users to your organization:

```hcl
resource "oncallshift_user" "alice" {
  email    = "alice@example.com"
  name     = "Alice Smith"
  role     = "responder"
  team_ids = [oncallshift_team.backend.id]
}

resource "oncallshift_user" "bob" {
  email    = "bob@example.com"
  name     = "Bob Jones"
  role     = "manager"
  team_ids = [oncallshift_team.backend.id, oncallshift_team.sre.id]
}
```

**Roles**: `admin`, `manager`, `responder`

### oncallshift_schedule

Create on-call schedules:

```hcl
resource "oncallshift_schedule" "backend_primary" {
  name        = "Backend Primary"
  description = "Primary on-call rotation for backend team"
  timezone    = "America/New_York"
  team_id     = oncallshift_team.backend.id

  layer {
    name           = "Primary"
    rotation_type  = "weekly"
    handoff_time   = "09:00"
    handoff_day    = "monday"

    participants = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
    ]
  }
}
```

**Rotation types**: `daily`, `weekly`, `custom`

### oncallshift_schedule_override

Create schedule overrides for vacations, etc.:

```hcl
resource "oncallshift_schedule_override" "alice_vacation" {
  schedule_id = oncallshift_schedule.backend_primary.id
  user_id     = oncallshift_user.bob.id  # Bob covers
  start       = "2026-02-01T00:00:00Z"
  end         = "2026-02-08T00:00:00Z"
  reason      = "Alice vacation coverage"
}
```

### oncallshift_escalation_policy

Define escalation policies:

```hcl
resource "oncallshift_escalation_policy" "backend_critical" {
  name        = "Backend Critical"
  description = "Critical escalation for backend services"
  team_id     = oncallshift_team.backend.id

  step {
    order          = 0
    delay_minutes  = 0

    target {
      type = "schedule"
      id   = oncallshift_schedule.backend_primary.id
    }
  }

  step {
    order          = 1
    delay_minutes  = 5

    target {
      type = "user"
      id   = data.oncallshift_user.manager.id
    }
  }

  step {
    order          = 2
    delay_minutes  = 15

    target {
      type = "user"
      id   = data.oncallshift_user.vp_eng.id
    }
  }
}
```

### oncallshift_service

Create services:

```hcl
resource "oncallshift_service" "payment_api" {
  name                 = "Payment API"
  description          = "Payment processing service"
  team_id              = oncallshift_team.backend.id
  escalation_policy_id = oncallshift_escalation_policy.backend_critical.id

  alert_settings {
    auto_resolve_timeout = 3600  # 1 hour
    alert_grouping       = true
    grouping_window      = 300   # 5 minutes
  }
}

resource "oncallshift_service" "user_service" {
  name                 = "User Service"
  description          = "User management and authentication"
  team_id              = oncallshift_team.backend.id
  escalation_policy_id = oncallshift_escalation_policy.backend_critical.id
}
```

### oncallshift_integration

Create integrations for services:

```hcl
resource "oncallshift_integration" "payment_datadog" {
  service_id = oncallshift_service.payment_api.id
  type       = "webhook"
  name       = "Datadog Integration"
}

output "payment_webhook_url" {
  value     = oncallshift_integration.payment_datadog.webhook_url
  sensitive = true
}
```

### oncallshift_runbook

Create runbooks:

```hcl
resource "oncallshift_runbook" "high_cpu" {
  name        = "High CPU Troubleshooting"
  description = "Steps to diagnose and resolve high CPU issues"
  service_ids = [oncallshift_service.payment_api.id]

  content = <<-EOT
    # High CPU Troubleshooting

    ## Symptoms
    - CPU utilization > 90%
    - Slow response times

    ## Steps
    1. Check current CPU usage: `top` or CloudWatch metrics
    2. Identify high-CPU process: `ps aux --sort=-%cpu | head -10`
    3. Check for recent deployments
    4. Review application logs for errors

    ## Resolution
    - Scale horizontally if legitimate traffic
    - Roll back if caused by deployment
    - Restart service if memory leak suspected
  EOT
}
```

---

## Data Sources

### oncallshift_user

Look up existing users:

```hcl
data "oncallshift_user" "manager" {
  email = "manager@example.com"
}

data "oncallshift_user" "vp_eng" {
  email = "vp-eng@example.com"
}
```

### oncallshift_team

Look up existing teams:

```hcl
data "oncallshift_team" "platform" {
  slug = "platform"
}
```

### oncallshift_schedule

Look up existing schedules:

```hcl
data "oncallshift_schedule" "existing" {
  name    = "Platform Primary"
  team_id = data.oncallshift_team.platform.id
}
```

---

## Examples

### Complete Team Setup

```hcl
# Variables
variable "team_members" {
  type = list(object({
    email = string
    name  = string
    role  = string
  }))
  default = [
    { email = "alice@example.com", name = "Alice Smith", role = "manager" },
    { email = "bob@example.com", name = "Bob Jones", role = "responder" },
    { email = "carol@example.com", name = "Carol White", role = "responder" },
  ]
}

# Team
resource "oncallshift_team" "backend" {
  name = "Backend"
  slug = "backend"
}

# Users
resource "oncallshift_user" "team_members" {
  for_each = { for u in var.team_members : u.email => u }

  email    = each.value.email
  name     = each.value.name
  role     = each.value.role
  team_ids = [oncallshift_team.backend.id]
}

# Schedule
resource "oncallshift_schedule" "primary" {
  name     = "Backend Primary"
  timezone = "America/New_York"
  team_id  = oncallshift_team.backend.id

  layer {
    name          = "Primary"
    rotation_type = "weekly"
    handoff_time  = "09:00"
    handoff_day   = "monday"
    participants  = [for u in oncallshift_user.team_members : u.id]
  }
}

# Escalation Policy
resource "oncallshift_escalation_policy" "standard" {
  name    = "Backend Standard"
  team_id = oncallshift_team.backend.id

  step {
    order         = 0
    delay_minutes = 0
    target {
      type = "schedule"
      id   = oncallshift_schedule.primary.id
    }
  }

  step {
    order         = 1
    delay_minutes = 10
    target {
      type = "user"
      id   = oncallshift_user.team_members["alice@example.com"].id
    }
  }
}

# Service
resource "oncallshift_service" "api" {
  name                 = "Backend API"
  team_id              = oncallshift_team.backend.id
  escalation_policy_id = oncallshift_escalation_policy.standard.id
}

# Integration
resource "oncallshift_integration" "datadog" {
  service_id = oncallshift_service.api.id
  type       = "webhook"
  name       = "Datadog"
}

# Outputs
output "webhook_url" {
  value     = oncallshift_integration.datadog.webhook_url
  sensitive = true
}

output "team_id" {
  value = oncallshift_team.backend.id
}
```

### Multi-Environment Setup

```hcl
# environments/production/main.tf

module "oncallshift" {
  source = "../../modules/oncallshift"

  environment = "production"
  team_name   = "Backend"

  escalation_steps = [
    { delay = 0, type = "schedule", target = "primary" },
    { delay = 5, type = "schedule", target = "secondary" },
    { delay = 15, type = "user", target = "manager@example.com" },
  ]
}
```

---

## Best Practices

### State Management

- Use remote state backend (S3, Terraform Cloud)
- Enable state locking
- Separate state per environment

```hcl
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "oncallshift/production.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

### Sensitive Data

- Never commit API keys to Git
- Use environment variables or secrets management
- Mark outputs as sensitive

```hcl
output "api_key" {
  value     = var.oncallshift_api_key
  sensitive = true
}
```

### Change Management

- Use pull requests for changes
- Run `terraform plan` in CI
- Require approval for `terraform apply`
- Tag resources for auditing

### Import Existing Resources

Import existing OnCallShift resources:

```bash
# Import a team
terraform import oncallshift_team.backend team_abc123

# Import a service
terraform import oncallshift_service.api svc_xyz789
```

### Drift Detection

Schedule regular drift detection:

```bash
terraform plan -detailed-exitcode
# Exit code 2 = drift detected
```

---

## Troubleshooting

### Authentication Errors

```
Error: 401 Unauthorized
```

**Solutions**:
- Verify API key is correct
- Check key has write permissions
- Ensure key hasn't expired

### Resource Not Found

```
Error: Resource oncallshift_team.backend not found
```

**Solutions**:
- Run `terraform import` if resource exists
- Check resource ID is correct
- Verify you have access to the resource

### Rate Limiting

```
Error: 429 Too Many Requests
```

**Solutions**:
- Add retry configuration to provider
- Reduce parallelism: `terraform apply -parallelism=2`
- Contact support for rate limit increase

### Import Fails

```
Error: Cannot import, resource already managed
```

**Solutions**:
- Remove from state: `terraform state rm resource.name`
- Then re-import

### Dependency Issues

Terraform may not know correct ordering:

```hcl
resource "oncallshift_service" "api" {
  # Explicit dependency
  depends_on = [oncallshift_escalation_policy.standard]

  escalation_policy_id = oncallshift_escalation_policy.standard.id
}
```

---

## Additional Resources

- [Terraform Provider Documentation](https://registry.terraform.io/providers/oncallshift/oncallshift/latest/docs)
- [API Reference](../api-reference.md)
- [GitHub Examples Repository](https://github.com/oncallshift/terraform-examples)

---

*Need help? See [Troubleshooting](../troubleshooting.md) or [contact support](../contact.md).*
