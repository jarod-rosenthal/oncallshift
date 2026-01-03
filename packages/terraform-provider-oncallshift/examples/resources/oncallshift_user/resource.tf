# Create a team first
resource "oncallshift_team" "platform" {
  name = "Platform Engineering"
}

# Invite users
resource "oncallshift_user" "alice" {
  email     = "alice@example.com"
  full_name = "Alice Smith"
  role      = "user"
  timezone  = "America/New_York"
  team_ids  = [oncallshift_team.platform.id]
}

resource "oncallshift_user" "bob" {
  email     = "bob@example.com"
  full_name = "Bob Jones"
  role      = "admin"
  timezone  = "America/Los_Angeles"
  team_ids  = [oncallshift_team.platform.id]
}

# Manager with additional details
resource "oncallshift_user" "manager" {
  email     = "manager@example.com"
  full_name = "Carol Manager"
  role      = "admin"
  timezone  = "America/Chicago"
  job_title = "Engineering Manager"
  team_ids  = [oncallshift_team.platform.id]
}
