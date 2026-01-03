# Create a team
resource "oncallshift_team" "platform" {
  name        = "Platform Engineering"
  description = "Infrastructure and platform team"
}

resource "oncallshift_team" "backend" {
  name        = "Backend"
  description = "Backend services team"
}

# Output the team IDs
output "platform_team_id" {
  value = oncallshift_team.platform.id
}
