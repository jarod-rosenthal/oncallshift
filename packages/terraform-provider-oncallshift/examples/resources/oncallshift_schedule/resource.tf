# Create a team and users first
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

resource "oncallshift_user" "carol" {
  email     = "carol@example.com"
  full_name = "Carol White"
  team_ids  = [oncallshift_team.platform.id]
}

# Create a weekly on-call schedule
resource "oncallshift_schedule" "primary" {
  name        = "Primary On-Call"
  description = "Primary on-call rotation"
  timezone    = "America/New_York"
  team_id     = oncallshift_team.platform.id

  layer {
    name                         = "Layer 1"
    start                        = "2024-01-01T00:00:00Z"
    rotation_turn_length_seconds = 604800  # 1 week in seconds
    users = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
      oncallshift_user.carol.id,
    ]
  }
}

# Secondary schedule for business hours only
resource "oncallshift_schedule" "secondary" {
  name        = "Secondary On-Call"
  description = "Secondary coverage during business hours"
  timezone    = "America/New_York"
  team_id     = oncallshift_team.platform.id

  layer {
    name                         = "Business Hours"
    start                        = "2024-01-01T09:00:00Z"
    rotation_turn_length_seconds = 86400  # 1 day in seconds
    users = [
      oncallshift_user.bob.id,
      oncallshift_user.carol.id,
    ]
  }
}
