# Data Sources

Data sources allow you to query existing OnCallShift resources for use in your Terraform configuration. Use data sources to reference resources that were created outside of Terraform or in other workspaces.

## oncallshift_team

Look up an existing team by name or slug.

### Example Usage

```hcl
# Look up by name
data "oncallshift_team" "platform" {
  name = "Platform Engineering"
}

# Look up by slug
data "oncallshift_team" "backend" {
  slug = "backend"
}

# Use in other resources
resource "oncallshift_service" "api" {
  name    = "API Service"
  team_id = data.oncallshift_team.platform.id
}
```

### Argument Reference

One of the following is required:

| Argument | Type | Description |
|----------|------|-------------|
| `name` | String | Team name to search for (exact match). |
| `slug` | String | Team slug to search for (exact match). |
| `id` | String | Team ID (UUID) to look up directly. |

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | Team ID (UUID). |
| `name` | String | Team name. |
| `slug` | String | URL-friendly identifier. |
| `description` | String | Team description. |
| `privacy` | String | Team visibility: `public` or `private`. |
| `member_count` | Number | Number of team members. |
| `settings` | Object | Team settings. |
| `created_at` | String | ISO 8601 creation timestamp. |
| `updated_at` | String | ISO 8601 last update timestamp. |

---

## oncallshift_user

Look up an existing user by email.

### Example Usage

```hcl
# Look up by email
data "oncallshift_user" "alice" {
  email = "alice@example.com"
}

# Use in escalation policy
resource "oncallshift_escalation_policy" "standard" {
  name = "Standard"

  step {
    timeout_seconds = 300

    target {
      type    = "user"
      user_id = data.oncallshift_user.alice.id
    }
  }
}
```

### Argument Reference

One of the following is required:

| Argument | Type | Description |
|----------|------|-------------|
| `email` | String | User's email address (exact match). |
| `id` | String | User ID (UUID) to look up directly. |

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | User ID (UUID). |
| `email` | String | User's email address. |
| `full_name` | String | User's display name. |
| `base_role` | String | Organization-wide role. |
| `status` | String | User status: `active` or `inactive`. |
| `phone_number` | String | User's phone number. |
| `profile_picture_url` | String | URL to profile picture. |
| `created_at` | String | ISO 8601 creation timestamp. |
| `updated_at` | String | ISO 8601 last update timestamp. |

---

## oncallshift_service

Look up an existing service by name.

### Example Usage

```hcl
# Look up by name
data "oncallshift_service" "api" {
  name = "API Service"
}

# Get service details
output "api_service_key" {
  value     = data.oncallshift_service.api.api_key
  sensitive = true
}
```

### Argument Reference

One of the following is required:

| Argument | Type | Description |
|----------|------|-------------|
| `name` | String | Service name (exact match). |
| `id` | String | Service ID (UUID) to look up directly. |

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | Service ID (UUID). |
| `name` | String | Service name. |
| `description` | String | Service description. |
| `api_key` | String | Service API key for alert ingestion. |
| `status` | String | Service status: `active`, `inactive`, `maintenance`. |
| `urgency` | String | Urgency level: `high`, `low`, `dynamic`. |
| `team_id` | String | Owning team ID. |
| `escalation_policy_id` | String | Assigned escalation policy ID. |
| `schedule_id` | String | Assigned schedule ID. |
| `auto_resolve_timeout` | Number | Auto-resolve timeout in minutes. |
| `created_at` | String | ISO 8601 creation timestamp. |
| `updated_at` | String | ISO 8601 last update timestamp. |

---

## oncallshift_schedule

Look up an existing schedule by name.

### Example Usage

```hcl
# Look up by name
data "oncallshift_schedule" "primary" {
  name = "Primary On-Call"
}

# Use in escalation policy
resource "oncallshift_escalation_policy" "standard" {
  name = "Standard"

  step {
    timeout_seconds = 300

    target {
      type        = "schedule"
      schedule_id = data.oncallshift_schedule.primary.id
    }
  }
}
```

### Argument Reference

One of the following is required:

| Argument | Type | Description |
|----------|------|-------------|
| `name` | String | Schedule name (exact match). |
| `id` | String | Schedule ID (UUID) to look up directly. |

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | Schedule ID (UUID). |
| `name` | String | Schedule name. |
| `description` | String | Schedule description. |
| `timezone` | String | Schedule timezone. |
| `type` | String | Schedule type: `manual`, `daily`, `weekly`. |
| `team_id` | String | Owning team ID. |
| `current_oncall_user_id` | String | ID of user currently on-call. |
| `created_at` | String | ISO 8601 creation timestamp. |
| `updated_at` | String | ISO 8601 last update timestamp. |

---

## oncallshift_escalation_policy

Look up an existing escalation policy by name.

### Example Usage

```hcl
# Look up by name
data "oncallshift_escalation_policy" "critical" {
  name = "Critical Escalation"
}

# Assign to service
resource "oncallshift_service" "database" {
  name                 = "Database"
  escalation_policy_id = data.oncallshift_escalation_policy.critical.id
}
```

### Argument Reference

One of the following is required:

| Argument | Type | Description |
|----------|------|-------------|
| `name` | String | Policy name (exact match). |
| `id` | String | Policy ID (UUID) to look up directly. |

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | Policy ID (UUID). |
| `name` | String | Policy name. |
| `description` | String | Policy description. |
| `team_id` | String | Owning team ID. |
| `repeat_enabled` | Boolean | Whether policy repeats. |
| `repeat_count` | Number | Number of repeat cycles. |
| `step_count` | Number | Number of escalation steps. |
| `created_at` | String | ISO 8601 creation timestamp. |
| `updated_at` | String | ISO 8601 last update timestamp. |

---

## oncallshift_current_oncall

Get the current on-call user for a schedule or service.

### Example Usage

```hcl
# Get on-call for a schedule
data "oncallshift_current_oncall" "primary" {
  schedule_id = oncallshift_schedule.primary.id
}

output "current_oncall" {
  value = data.oncallshift_current_oncall.primary.user_name
}

# Get on-call for a service
data "oncallshift_current_oncall" "api_service" {
  service_id = oncallshift_service.api.id
}

# Get all on-call users across the organization
data "oncallshift_current_oncall" "all" {}

output "all_oncall_users" {
  value = data.oncallshift_current_oncall.all.oncall_list
}
```

### Argument Reference

All arguments are optional. If none provided, returns all on-call assignments.

| Argument | Type | Description |
|----------|------|-------------|
| `schedule_id` | String | Schedule ID to query on-call for. |
| `service_id` | String | Service ID to query on-call for (via linked schedule). |

### Attribute Reference

When querying a specific schedule or service:

| Attribute | Type | Description |
|-----------|------|-------------|
| `user_id` | String | On-call user ID (UUID). |
| `user_name` | String | On-call user's full name. |
| `user_email` | String | On-call user's email. |
| `is_override` | Boolean | Whether current assignment is an override. |
| `override_until` | String | ISO 8601 timestamp when override expires. |

When querying all (no filters):

| Attribute | Type | Description |
|-----------|------|-------------|
| `oncall_list` | List(Object) | List of all current on-call assignments (see below). |

#### oncall_list Object

| Attribute | Type | Description |
|-----------|------|-------------|
| `service_id` | String | Service ID. |
| `service_name` | String | Service name. |
| `schedule_id` | String | Schedule ID. |
| `schedule_name` | String | Schedule name. |
| `user_id` | String | On-call user ID. |
| `user_name` | String | On-call user's full name. |
| `user_email` | String | On-call user's email. |
| `is_override` | Boolean | Whether assignment is an override. |

---

## oncallshift_teams

List all teams in the organization.

### Example Usage

```hcl
# Get all teams
data "oncallshift_teams" "all" {}

output "team_ids" {
  value = [for team in data.oncallshift_teams.all.teams : team.id]
}
```

### Argument Reference

This data source takes no arguments.

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `teams` | List(Object) | List of all teams (see below). |

#### teams Object

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | Team ID. |
| `name` | String | Team name. |
| `slug` | String | Team slug. |
| `description` | String | Team description. |
| `member_count` | Number | Number of members. |

---

## oncallshift_users

List all users in the organization.

### Example Usage

```hcl
# Get all users
data "oncallshift_users" "all" {}

# Get only active users
data "oncallshift_users" "active" {
  status = "active"
}

output "responder_emails" {
  value = [
    for user in data.oncallshift_users.all.users : user.email
    if user.base_role == "responder"
  ]
}
```

### Argument Reference

| Argument | Type | Description |
|----------|------|-------------|
| `status` | String | Filter by status: `active` or `inactive`. |
| `base_role` | String | Filter by role: `owner`, `admin`, `manager`, `responder`, `observer`. |
| `team_id` | String | Filter by team membership. |

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `users` | List(Object) | List of matching users (see below). |

#### users Object

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | User ID. |
| `email` | String | User email. |
| `full_name` | String | User's full name. |
| `base_role` | String | Organization role. |
| `status` | String | User status. |

---

## oncallshift_services

List all services in the organization.

### Example Usage

```hcl
# Get all active services
data "oncallshift_services" "active" {
  status = "active"
}

# Get services for a team
data "oncallshift_services" "platform" {
  team_id = oncallshift_team.platform.id
}
```

### Argument Reference

| Argument | Type | Description |
|----------|------|-------------|
| `status` | String | Filter by status: `active`, `inactive`, `maintenance`. |
| `team_id` | String | Filter by owning team. |

### Attribute Reference

| Attribute | Type | Description |
|-----------|------|-------------|
| `services` | List(Object) | List of matching services. |

#### services Object

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String | Service ID. |
| `name` | String | Service name. |
| `description` | String | Service description. |
| `status` | String | Service status. |
| `team_id` | String | Owning team ID. |
| `escalation_policy_id` | String | Assigned escalation policy. |
