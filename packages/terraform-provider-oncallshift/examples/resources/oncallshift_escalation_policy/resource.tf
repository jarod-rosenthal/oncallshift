# Create team, users, and schedule first
resource "oncallshift_team" "platform" {
  name = "Platform Engineering"
}

resource "oncallshift_user" "alice" {
  email     = "alice@example.com"
  full_name = "Alice Smith"
  team_ids  = [oncallshift_team.platform.id]
}

resource "oncallshift_user" "bob" {
  email     = "bob@example.com"
  full_name = "Bob Jones"
  team_ids  = [oncallshift_team.platform.id]
}

resource "oncallshift_user" "manager" {
  email     = "manager@example.com"
  full_name = "Carol Manager"
  role      = "admin"
  team_ids  = [oncallshift_team.platform.id]
}

resource "oncallshift_schedule" "primary" {
  name     = "Primary On-Call"
  timezone = "America/New_York"
  team_id  = oncallshift_team.platform.id

  layer {
    name                         = "Layer 1"
    start                        = "2024-01-01T00:00:00Z"
    rotation_turn_length_seconds = 604800
    users = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
    ]
  }
}

# Create an escalation policy with multiple steps
resource "oncallshift_escalation_policy" "critical" {
  name         = "Critical Services Escalation"
  description  = "Escalation policy for critical services"
  team_id      = oncallshift_team.platform.id
  repeat_count = 2  # Repeat the escalation twice if no response

  # Step 1: Notify on-call engineer immediately
  step {
    step_number   = 1
    delay_minutes = 0

    target {
      type = "schedule"
      id   = oncallshift_schedule.primary.id
    }
  }

  # Step 2: Escalate to manager after 15 minutes
  step {
    step_number   = 2
    delay_minutes = 15

    target {
      type = "user"
      id   = oncallshift_user.manager.id
    }
  }

  # Step 3: Escalate to entire team after 30 minutes
  step {
    step_number   = 3
    delay_minutes = 30

    target {
      type = "team"
      id   = oncallshift_team.platform.id
    }
  }
}

# Simple escalation policy with single step
resource "oncallshift_escalation_policy" "simple" {
  name    = "Simple Escalation"
  team_id = oncallshift_team.platform.id

  step {
    step_number   = 1
    delay_minutes = 0

    target {
      type = "schedule"
      id   = oncallshift_schedule.primary.id
    }
  }
}
