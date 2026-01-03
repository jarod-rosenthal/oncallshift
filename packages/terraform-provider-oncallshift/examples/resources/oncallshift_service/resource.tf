# First, create a team and escalation policy
resource "oncallshift_team" "platform" {
  name        = "Platform Engineering"
  description = "Infrastructure and platform team"
}

resource "oncallshift_escalation_policy" "default" {
  name    = "Default Escalation"
  team_id = oncallshift_team.platform.id

  step {
    step_number   = 1
    delay_minutes = 0
  }
}

# Create services
resource "oncallshift_service" "api" {
  name                 = "API Service"
  description          = "Main API service"
  team_id              = oncallshift_team.platform.id
  escalation_policy_id = oncallshift_escalation_policy.default.id
}

resource "oncallshift_service" "database" {
  name                 = "Database"
  description          = "PostgreSQL database"
  team_id              = oncallshift_team.platform.id
  escalation_policy_id = oncallshift_escalation_policy.default.id
}
