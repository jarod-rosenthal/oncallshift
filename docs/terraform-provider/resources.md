# Resources

This document provides detailed information about all resources available in the OnCallShift Terraform Provider.

## oncallshift_team

Teams organize users and provide ownership for services, schedules, and escalation policies.

### Example Usage

```hcl
resource "oncallshift_team" "platform" {
  name        = "Platform Engineering"
  slug        = "platform"
  description = "Infrastructure and platform services team"
  privacy     = "public"

  settings = {
    default_escalation_policy_id = oncallshift_escalation_policy.platform.id
    slack_channel_id             = "C0123456789"
  }
}
```

### Argument Reference

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | String | Yes | Team name (max 255 characters). Must be unique within the organization. |
| `slug` | String | No | URL-friendly identifier (max 100 characters). Auto-generated from name if not provided. |
| `description` | String | No | Team description. |
| `privacy` | String | No | Team visibility. One of: `public`, `private`. Default: `public`. |
| `settings` | Object | No | Team settings object (see below). |

#### Settings Object

| Attribute | Type | Description |
|-----------|------|-------------|
| `default_escalation_policy_id` | String | Default escalation policy for new services. |
| `default_schedule_id` | String | Default schedule for new services. |
| `slack_channel_id` | String | Slack channel ID for team notifications. |
| `teams_channel_id` | String | Microsoft Teams channel ID for team notifications. |

### Attribute Reference

In addition to arguments, the following attributes are exported:

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | Unique identifier for the team (UUID). |
| `member_count` | Number | Number of members in the team. |
| `created_at` | String | ISO 8601 timestamp when team was created. |
| `updated_at` | String | ISO 8601 timestamp when team was last updated. |

### Import

Teams can be imported using their ID:

```bash
terraform import oncallshift_team.platform 550e8400-e29b-41d4-a716-446655440000
```

---

## oncallshift_user

Users represent organization members who can be assigned to schedules and receive notifications.

### Example Usage

```hcl
# Invite a new user
resource "oncallshift_user" "alice" {
  email     = "alice@example.com"
  full_name = "Alice Smith"
  base_role = "responder"
}

# User with team membership
resource "oncallshift_user" "bob" {
  email     = "bob@example.com"
  full_name = "Bob Johnson"
  base_role = "manager"

  team_membership {
    team_id = oncallshift_team.platform.id
    role    = "manager"
  }

  team_membership {
    team_id = oncallshift_team.backend.id
    role    = "member"
  }
}

# Admin user
resource "oncallshift_user" "admin" {
  email     = "admin@example.com"
  full_name = "Admin User"
  base_role = "admin"
}
```

### Argument Reference

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `email` | String | Yes | User's email address. Must be unique. Used for authentication and notifications. |
| `full_name` | String | No | User's display name (max 255 characters). |
| `base_role` | String | No | Organization-wide role. One of: `owner`, `admin`, `manager`, `responder`, `observer`, `restricted_access`, `limited_stakeholder`. Default: `responder`. |
| `phone_number` | String | No | Phone number for SMS notifications. |
| `team_membership` | Block | No | Team memberships (see below). Can be specified multiple times. |

#### Base Roles

| Role | Description |
|------|-------------|
| `owner` | Full access, can manage organization settings |
| `admin` | Full access except organization settings |
| `manager` | Can manage teams, schedules, services |
| `responder` | Can acknowledge/resolve incidents, be on-call |
| `observer` | Read-only access |
| `restricted_access` | Limited access, subject to object permissions |
| `limited_stakeholder` | Read-only access to assigned resources |

#### team_membership Block

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `team_id` | String | Yes | ID of the team. |
| `role` | String | No | Role within the team. One of: `manager`, `member`. Default: `member`. |

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | Unique identifier for the user (UUID). |
| `status` | String | User status: `active` or `inactive`. |
| `created_at` | String | ISO 8601 timestamp when user was created. |
| `updated_at` | String | ISO 8601 timestamp when user was last updated. |

### Import

Users can be imported using their ID:

```bash
terraform import oncallshift_user.alice 550e8400-e29b-41d4-a716-446655440000
```

---

## oncallshift_service

Services represent applications or infrastructure components that can receive alerts and trigger incidents.

### Example Usage

```hcl
# Basic service
resource "oncallshift_service" "api" {
  name        = "API Service"
  description = "Main API backend"
  team_id     = oncallshift_team.platform.id
}

# Service with escalation policy
resource "oncallshift_service" "database" {
  name                 = "Database Cluster"
  description          = "PostgreSQL primary cluster"
  team_id              = oncallshift_team.platform.id
  escalation_policy_id = oncallshift_escalation_policy.critical.id

  urgency              = "high"
  auto_resolve_timeout = 240  # 4 hours
}

# Service with support hours (dynamic urgency)
resource "oncallshift_service" "internal_tool" {
  name        = "Internal Dashboard"
  description = "Employee dashboard"
  team_id     = oncallshift_team.platform.id
  urgency     = "dynamic"

  support_hours {
    enabled   = true
    timezone  = "America/New_York"
    days      = [1, 2, 3, 4, 5]  # Monday-Friday
    start_time = "09:00"
    end_time   = "17:00"
  }
}
```

### Argument Reference

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | String | Yes | Service name (max 255 characters). |
| `description` | String | No | Service description. |
| `team_id` | String | No | ID of the owning team. |
| `escalation_policy_id` | String | No | ID of the escalation policy for incidents. |
| `schedule_id` | String | No | ID of the on-call schedule (for direct assignment). |
| `status` | String | No | Service status. One of: `active`, `inactive`, `maintenance`. Default: `active`. |
| `urgency` | String | No | Urgency level. One of: `high`, `low`, `dynamic`. Default: `high`. |
| `auto_resolve_timeout` | Number | No | Minutes until unacknowledged incidents auto-resolve. `null` to disable. |
| `ack_timeout_seconds` | Number | No | Seconds until acknowledged incidents auto-unacknowledge. `null` to disable. |
| `support_hours` | Block | No | Support hours configuration for dynamic urgency. |

#### support_hours Block

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `enabled` | Boolean | Yes | Whether support hours are enabled. |
| `timezone` | String | Yes | IANA timezone (e.g., "America/New_York"). |
| `days` | List(Number) | Yes | Days of week (0=Sunday, 6=Saturday). |
| `start_time` | String | Yes | Start time in HH:mm format. |
| `end_time` | String | Yes | End time in HH:mm format. |

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | Unique identifier for the service (UUID). |
| `api_key` | String | API key for sending alerts (format: `svc_xxxx`). |
| `email_address` | String | Email address for email-to-incident (if enabled). |
| `created_at` | String | ISO 8601 timestamp when service was created. |
| `updated_at` | String | ISO 8601 timestamp when service was last updated. |

### Import

Services can be imported using their ID:

```bash
terraform import oncallshift_service.api 550e8400-e29b-41d4-a716-446655440000
```

---

## oncallshift_schedule

Schedules define on-call rotations using layers. Each layer can have different rotation patterns and restrictions.

### Example Usage

```hcl
# Simple weekly rotation
resource "oncallshift_schedule" "primary" {
  name        = "Primary On-Call"
  description = "Weekly rotation for primary responders"
  timezone    = "America/New_York"
  team_id     = oncallshift_team.platform.id

  layer {
    name          = "Primary"
    rotation_type = "weekly"
    handoff_time  = "09:00"
    handoff_day   = 1  # Monday

    members = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
      oncallshift_user.charlie.id,
    ]
  }
}

# Multi-layer schedule with restrictions
resource "oncallshift_schedule" "coverage" {
  name        = "Full Coverage"
  description = "Business hours and after-hours coverage"
  timezone    = "America/New_York"
  team_id     = oncallshift_team.platform.id

  # Business hours layer (higher priority)
  layer {
    name          = "Business Hours"
    rotation_type = "daily"
    handoff_time  = "09:00"
    layer_order   = 0  # Higher priority

    restrictions {
      type = "weekly"
      interval {
        start_day  = 1  # Monday
        start_time = "09:00"
        end_day    = 5  # Friday
        end_time   = "17:00"
      }
    }

    members = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
    ]
  }

  # After-hours layer (lower priority, fills gaps)
  layer {
    name          = "After Hours"
    rotation_type = "weekly"
    handoff_time  = "17:00"
    handoff_day   = 1
    layer_order   = 1  # Lower priority

    members = [
      oncallshift_user.charlie.id,
      oncallshift_user.dave.id,
    ]
  }
}

# Custom rotation length
resource "oncallshift_schedule" "custom" {
  name        = "4-Day Rotation"
  description = "Custom 4-day rotation"
  timezone    = "UTC"
  team_id     = oncallshift_team.platform.id

  layer {
    name            = "Primary"
    rotation_type   = "custom"
    rotation_length = 4  # 4 days per rotation
    handoff_time    = "08:00"

    members = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
    ]
  }
}
```

### Argument Reference

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | String | Yes | Schedule name (max 255 characters). |
| `description` | String | No | Schedule description. |
| `timezone` | String | No | IANA timezone for the schedule. Default: `UTC`. |
| `team_id` | String | No | ID of the owning team. |
| `layer` | Block | No | Schedule layers (see below). Can be specified multiple times. |

#### layer Block

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | String | Yes | Layer name (max 255 characters). |
| `rotation_type` | String | Yes | Rotation type: `daily`, `weekly`, or `custom`. |
| `handoff_time` | String | Yes | Time of day for handoffs in HH:mm format. |
| `handoff_day` | Number | No | Day of week for weekly rotations (0=Sunday, 6=Saturday). |
| `rotation_length` | Number | No | Days per rotation for custom rotations. Default: 1. |
| `layer_order` | Number | No | Layer priority (lower = higher priority). Default: 0. |
| `start_date` | String | No | ISO 8601 date when the layer becomes active. |
| `end_date` | String | No | ISO 8601 date when the layer ends. |
| `members` | List(String) | Yes | List of user IDs in rotation order. |
| `restrictions` | Block | No | Time-based restrictions (see below). |

#### restrictions Block

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | String | Yes | Restriction type. Currently only `weekly` is supported. |
| `interval` | Block | Yes | Time intervals when layer is active. Can be specified multiple times. |

#### interval Block

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_day` | Number | Yes | Start day of week (0=Sunday). |
| `start_time` | String | Yes | Start time in HH:mm format. |
| `end_day` | Number | Yes | End day of week (0=Sunday). |
| `end_time` | String | Yes | End time in HH:mm format. |

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | Unique identifier for the schedule (UUID). |
| `current_oncall_user_id` | String | ID of user currently on-call. |
| `created_at` | String | ISO 8601 timestamp when schedule was created. |
| `updated_at` | String | ISO 8601 timestamp when schedule was last updated. |

### Import

Schedules can be imported using their ID:

```bash
terraform import oncallshift_schedule.primary 550e8400-e29b-41d4-a716-446655440000
```

---

## oncallshift_escalation_policy

Escalation policies define how incidents are escalated through multiple notification steps.

### Example Usage

```hcl
# Simple escalation to schedule then manager
resource "oncallshift_escalation_policy" "standard" {
  name        = "Standard Escalation"
  description = "Escalate to on-call, then team lead"
  team_id     = oncallshift_team.platform.id

  step {
    timeout_seconds = 300  # 5 minutes

    target {
      type        = "schedule"
      schedule_id = oncallshift_schedule.primary.id
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

# Multi-target escalation
resource "oncallshift_escalation_policy" "critical" {
  name           = "Critical Escalation"
  description    = "Aggressive escalation for critical services"
  team_id        = oncallshift_team.platform.id
  repeat_enabled = true
  repeat_count   = 3  # Repeat up to 3 times

  # Step 1: Primary on-call
  step {
    timeout_seconds = 120  # 2 minutes

    target {
      type        = "schedule"
      schedule_id = oncallshift_schedule.primary.id
    }
  }

  # Step 2: Secondary on-call AND team leads (parallel notification)
  step {
    timeout_seconds = 300  # 5 minutes

    target {
      type        = "schedule"
      schedule_id = oncallshift_schedule.secondary.id
    }

    target {
      type    = "user"
      user_id = oncallshift_user.lead1.id
    }

    target {
      type    = "user"
      user_id = oncallshift_user.lead2.id
    }
  }

  # Step 3: Engineering manager
  step {
    timeout_seconds = 600  # 10 minutes

    target {
      type    = "user"
      user_id = oncallshift_user.eng_manager.id
    }
  }
}

# Escalation with direct user list (legacy style)
resource "oncallshift_escalation_policy" "legacy" {
  name = "Legacy Style"

  step {
    timeout_seconds = 300
    target_type     = "users"
    user_ids        = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
    ]
  }
}
```

### Argument Reference

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | String | Yes | Policy name (max 255 characters). |
| `description` | String | No | Policy description. |
| `team_id` | String | No | ID of the owning team. |
| `repeat_enabled` | Boolean | No | Whether to repeat escalation after exhausting all steps. Default: `false`. |
| `repeat_count` | Number | No | Number of times to repeat (0 = infinite when enabled). Default: 0. |
| `step` | Block | Yes | Escalation steps (see below). At least one required. |

#### step Block

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `timeout_seconds` | Number | Yes | Seconds to wait before escalating to next step. |
| `target` | Block | No | Escalation targets (see below). Multiple allowed for parallel notification. |
| `target_type` | String | No | Legacy: `schedule` or `users`. |
| `schedule_id` | String | No | Legacy: Schedule ID when target_type is `schedule`. |
| `user_ids` | List(String) | No | Legacy: User IDs when target_type is `users`. |
| `notify_strategy` | String | No | How to notify targets: `all` or `round_robin`. Default: `all`. |

#### target Block (Recommended)

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | String | Yes | Target type: `user` or `schedule`. |
| `user_id` | String | No | User ID (required when type is `user`). |
| `schedule_id` | String | No | Schedule ID (required when type is `schedule`). |

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | Unique identifier for the policy (UUID). |
| `created_at` | String | ISO 8601 timestamp when policy was created. |
| `updated_at` | String | ISO 8601 timestamp when policy was last updated. |

### Import

Escalation policies can be imported using their ID:

```bash
terraform import oncallshift_escalation_policy.standard 550e8400-e29b-41d4-a716-446655440000
```

---

## oncallshift_integration

Integrations connect external services to OnCallShift for alert ingestion and notification delivery.

### Example Usage

```hcl
# Webhook integration for custom alerts
resource "oncallshift_integration" "custom_webhook" {
  name    = "Custom Monitoring"
  type    = "webhook"

  config = {
    events       = ["trigger", "resolve"]
    retry_count  = 3
    timeout_ms   = 5000
  }
}

# Slack integration
resource "oncallshift_integration" "slack" {
  name = "Slack Workspace"
  type = "slack"

  config = {
    notify_on_trigger     = true
    notify_on_acknowledge = true
    notify_on_resolve     = true
  }

  features = {
    incident_sync         = true
    auto_create_channel   = true
    bidirectional         = true
  }
}

# Jira integration for ticket creation
resource "oncallshift_integration" "jira" {
  name = "Jira Cloud"
  type = "jira"

  jira_site_url   = "https://company.atlassian.net"
  jira_project_key = "OPS"
  jira_issue_type  = "Incident"

  features = {
    incident_sync = true
    sync_comments = true
    sync_status   = true
  }
}
```

### Argument Reference

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | String | Yes | Integration name (max 255 characters). |
| `type` | String | Yes | Integration type: `slack`, `teams`, `jira`, `servicenow`, `webhook`, `pagerduty_import`. |
| `status` | String | No | Integration status: `pending`, `active`, `error`, `disabled`. Default: `pending`. |
| `config` | Object | No | Type-specific configuration. |
| `features` | Object | No | Feature flags (see below). |

#### Type-Specific Arguments

**Slack:**
| Argument | Type | Description |
|----------|------|-------------|
| `slack_workspace_id` | String | Slack workspace ID. |
| `slack_workspace_name` | String | Slack workspace name. |
| `slack_default_channel_id` | String | Default channel for notifications. |

**Jira:**
| Argument | Type | Description |
|----------|------|-------------|
| `jira_site_url` | String | Jira Cloud or Server URL. |
| `jira_project_key` | String | Project key for ticket creation. |
| `jira_issue_type` | String | Issue type (e.g., "Incident", "Bug"). |

**Webhook:**
| Argument | Type | Description |
|----------|------|-------------|
| `webhook_url` | String | URL to receive webhooks. |
| `webhook_secret` | String | Secret for HMAC signature verification. |
| `webhook_headers` | Object | Custom headers to include in requests. |

#### features Object

| Attribute | Type | Description |
|-----------|------|-------------|
| `incident_sync` | Boolean | Sync incident status with integration. |
| `bidirectional` | Boolean | Allow updates from integration back to OnCallShift. |
| `auto_create_channel` | Boolean | Create channel per incident (Slack). |
| `auto_resolve` | Boolean | Auto-resolve incidents from integration. |
| `sync_comments` | Boolean | Sync comments bidirectionally. |
| `sync_status` | Boolean | Sync status changes. |

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | Unique identifier for the integration (UUID). |
| `last_error` | String | Last error message if status is `error`. |
| `last_error_at` | String | Timestamp of last error. |
| `error_count` | Number | Number of consecutive errors. |
| `created_at` | String | ISO 8601 timestamp when integration was created. |
| `updated_at` | String | ISO 8601 timestamp when integration was last updated. |

### Import

Integrations can be imported using their ID:

```bash
terraform import oncallshift_integration.slack 550e8400-e29b-41d4-a716-446655440000
```
