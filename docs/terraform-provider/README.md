# OnCallShift Terraform Provider

The OnCallShift Terraform Provider enables you to manage your incident management infrastructure as code. Define teams, users, services, schedules, and escalation policies in Terraform configurations and apply them consistently across environments.

## Overview

This provider interacts with the [OnCallShift API](https://oncallshift.com/api-docs) to manage:

- **Teams** - Organize users into groups for ownership and permissions
- **Users** - Invite and manage organization members
- **Services** - Define services that can receive alerts
- **Schedules** - Create on-call rotations with layers and overrides
- **Escalation Policies** - Configure multi-step notification escalation
- **Integrations** - Set up webhook integrations for alert ingestion

## Prerequisites

Before using this provider, you need:

1. **OnCallShift Account** - Sign up at [oncallshift.com](https://oncallshift.com)
2. **Organization API Key** - Generate from Settings > API Keys (requires Admin role)
3. **Terraform 1.0+** - Download from [terraform.io](https://terraform.io)

## Quick Start

### 1. Configure the Provider

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
  # Optional: defaults to https://oncallshift.com/api/v1
  # base_url = "https://oncallshift.com/api/v1"
}

variable "oncallshift_api_key" {
  type        = string
  sensitive   = true
  description = "OnCallShift organization API key"
}
```

### 2. Create Your First Resources

```hcl
# Create a team
resource "oncallshift_team" "platform" {
  name        = "Platform Engineering"
  slug        = "platform"
  description = "Infrastructure and platform services team"
}

# Create a schedule
resource "oncallshift_schedule" "platform_oncall" {
  name        = "Platform On-Call"
  description = "Weekly rotation for platform team"
  timezone    = "America/New_York"
  team_id     = oncallshift_team.platform.id

  layer {
    name           = "Primary"
    rotation_type  = "weekly"
    handoff_time   = "09:00"
    handoff_day    = 1  # Monday

    members = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
    ]
  }
}

# Create an escalation policy
resource "oncallshift_escalation_policy" "platform_escalation" {
  name        = "Platform Escalation"
  description = "Escalate through on-call then to leads"
  team_id     = oncallshift_team.platform.id

  step {
    timeout_seconds = 300  # 5 minutes

    target {
      type        = "schedule"
      schedule_id = oncallshift_schedule.platform_oncall.id
    }
  }

  step {
    timeout_seconds = 600  # 10 minutes

    target {
      type    = "user"
      user_id = oncallshift_user.team_lead.id
    }
  }
}

# Create a service
resource "oncallshift_service" "api_gateway" {
  name                 = "API Gateway"
  description          = "Main API gateway service"
  team_id              = oncallshift_team.platform.id
  escalation_policy_id = oncallshift_escalation_policy.platform_escalation.id
}
```

### 3. Apply Configuration

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply configuration
terraform apply
```

## Environment Variables

The provider supports configuration via environment variables:

| Variable | Description |
|----------|-------------|
| `ONCALLSHIFT_API_KEY` | Organization API key (required) |
| `ONCALLSHIFT_BASE_URL` | API base URL (optional) |

```bash
export ONCALLSHIFT_API_KEY="org_abc123..."
terraform plan
```

## Documentation

- [Authentication Guide](./authentication.md) - Creating API keys and provider configuration
- [Resources Reference](./resources.md) - All available resources with examples
- [Data Sources Reference](./data-sources.md) - Query existing resources
- [Import Guide](./import.md) - Import existing resources into Terraform
- [Best Practices](./best-practices.md) - Patterns for production deployments

## API Reference

Full API documentation is available at [oncallshift.com/api-docs](https://oncallshift.com/api-docs).

## Support

- **Documentation**: [docs.oncallshift.com](https://docs.oncallshift.com)
- **Issues**: [GitHub Issues](https://github.com/oncallshift/terraform-provider-oncallshift/issues)
- **Email**: support@oncallshift.com

## Version Compatibility

| Provider Version | OnCallShift API | Terraform |
|-----------------|-----------------|-----------|
| 1.x             | v1              | >= 1.0    |
