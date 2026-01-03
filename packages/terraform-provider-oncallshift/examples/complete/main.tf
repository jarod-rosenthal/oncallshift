# Complete Example: Full OnCallShift Setup
# This example demonstrates setting up a complete incident management configuration

terraform {
  required_providers {
    oncallshift = {
      source  = "oncallshift/oncallshift"
      version = "~> 0.1.0"
    }
  }
}

provider "oncallshift" {
  # api_key set via ONCALLSHIFT_API_KEY environment variable
}

# ============================================================================
# TEAMS
# ============================================================================

resource "oncallshift_team" "platform" {
  name        = "Platform Engineering"
  description = "Infrastructure, DevOps, and platform services"
}

resource "oncallshift_team" "backend" {
  name        = "Backend"
  description = "Backend services and APIs"
}

resource "oncallshift_team" "frontend" {
  name        = "Frontend"
  description = "Web and mobile frontend"
}

# ============================================================================
# USERS
# ============================================================================

resource "oncallshift_user" "alice" {
  email     = "alice@example.com"
  full_name = "Alice Smith"
  role      = "admin"
  timezone  = "America/New_York"
  job_title = "Platform Lead"
  team_ids  = [oncallshift_team.platform.id]
}

resource "oncallshift_user" "bob" {
  email     = "bob@example.com"
  full_name = "Bob Jones"
  role      = "user"
  timezone  = "America/Los_Angeles"
  job_title = "Senior SRE"
  team_ids  = [oncallshift_team.platform.id]
}

resource "oncallshift_user" "carol" {
  email     = "carol@example.com"
  full_name = "Carol White"
  role      = "user"
  timezone  = "Europe/London"
  job_title = "SRE"
  team_ids  = [oncallshift_team.platform.id]
}

resource "oncallshift_user" "dave" {
  email     = "dave@example.com"
  full_name = "Dave Brown"
  role      = "user"
  timezone  = "America/New_York"
  job_title = "Backend Engineer"
  team_ids  = [oncallshift_team.backend.id]
}

# ============================================================================
# SCHEDULES
# ============================================================================

# Follow-the-sun schedule for platform team
resource "oncallshift_schedule" "platform_primary" {
  name        = "Platform Primary"
  description = "Primary on-call for platform services"
  timezone    = "UTC"
  team_id     = oncallshift_team.platform.id

  layer {
    name                         = "Weekly Rotation"
    start                        = "2024-01-01T00:00:00Z"
    rotation_turn_length_seconds = 604800  # 1 week
    users = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
      oncallshift_user.carol.id,
    ]
  }
}

resource "oncallshift_schedule" "backend_primary" {
  name        = "Backend Primary"
  description = "Primary on-call for backend services"
  timezone    = "America/New_York"
  team_id     = oncallshift_team.backend.id

  layer {
    name                         = "Daily Rotation"
    start                        = "2024-01-01T00:00:00Z"
    rotation_turn_length_seconds = 86400  # 1 day
    users = [
      oncallshift_user.dave.id,
    ]
  }
}

# ============================================================================
# ESCALATION POLICIES
# ============================================================================

resource "oncallshift_escalation_policy" "platform_critical" {
  name         = "Platform Critical"
  description  = "Escalation for critical platform incidents"
  team_id      = oncallshift_team.platform.id
  repeat_count = 3

  step {
    step_number   = 1
    delay_minutes = 0

    target {
      type = "schedule"
      id   = oncallshift_schedule.platform_primary.id
    }
  }

  step {
    step_number   = 2
    delay_minutes = 15

    target {
      type = "user"
      id   = oncallshift_user.alice.id
    }
  }

  step {
    step_number   = 3
    delay_minutes = 30

    target {
      type = "team"
      id   = oncallshift_team.platform.id
    }
  }
}

resource "oncallshift_escalation_policy" "backend_default" {
  name    = "Backend Default"
  team_id = oncallshift_team.backend.id

  step {
    step_number   = 1
    delay_minutes = 0

    target {
      type = "schedule"
      id   = oncallshift_schedule.backend_primary.id
    }
  }

  step {
    step_number   = 2
    delay_minutes = 10

    target {
      type = "team"
      id   = oncallshift_team.backend.id
    }
  }
}

# ============================================================================
# SERVICES
# ============================================================================

resource "oncallshift_service" "kubernetes" {
  name                 = "Kubernetes Cluster"
  description          = "Production Kubernetes cluster"
  team_id              = oncallshift_team.platform.id
  escalation_policy_id = oncallshift_escalation_policy.platform_critical.id
}

resource "oncallshift_service" "database" {
  name                 = "PostgreSQL"
  description          = "Primary PostgreSQL database"
  team_id              = oncallshift_team.platform.id
  escalation_policy_id = oncallshift_escalation_policy.platform_critical.id
}

resource "oncallshift_service" "api" {
  name                 = "API Service"
  description          = "Main API service"
  team_id              = oncallshift_team.backend.id
  escalation_policy_id = oncallshift_escalation_policy.backend_default.id
}

resource "oncallshift_service" "auth" {
  name                 = "Authentication Service"
  description          = "User authentication and authorization"
  team_id              = oncallshift_team.backend.id
  escalation_policy_id = oncallshift_escalation_policy.backend_default.id
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "teams" {
  value = {
    platform = oncallshift_team.platform.id
    backend  = oncallshift_team.backend.id
    frontend = oncallshift_team.frontend.id
  }
}

output "services" {
  value = {
    kubernetes = oncallshift_service.kubernetes.id
    database   = oncallshift_service.database.id
    api        = oncallshift_service.api.id
    auth       = oncallshift_service.auth.id
  }
}

output "escalation_policies" {
  value = {
    platform_critical = oncallshift_escalation_policy.platform_critical.id
    backend_default   = oncallshift_escalation_policy.backend_default.id
  }
}
