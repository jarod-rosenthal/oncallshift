# Terraform Provider for OnCallShift

Terraform provider for managing [OnCallShift](https://oncallshift.com) incident management resources.

## Requirements

- [Terraform](https://www.terraform.io/downloads.html) >= 1.0
- [Go](https://golang.org/doc/install) >= 1.22 (for development)

## Installation

### From Terraform Registry (Coming Soon)

```hcl
terraform {
  required_providers {
    oncallshift = {
      source  = "oncallshift/oncallshift"
      version = "~> 0.1.0"
    }
  }
}
```

### Local Development

```bash
# Build the provider
make build

# Install locally for testing
make install
```

## Authentication

The provider authenticates using an API key. Set the key via environment variable:

```bash
export ONCALLSHIFT_API_KEY="your-api-key"
```

Or configure it in the provider block:

```hcl
provider "oncallshift" {
  api_key = var.oncallshift_api_key
}
```

## Usage

```hcl
# Create a team
resource "oncallshift_team" "platform" {
  name        = "Platform Engineering"
  description = "Infrastructure and platform team"
}

# Create users
resource "oncallshift_user" "alice" {
  email     = "alice@example.com"
  full_name = "Alice Smith"
  role      = "user"
  team_ids  = [oncallshift_team.platform.id]
}

# Create a schedule
resource "oncallshift_schedule" "primary" {
  name     = "Primary On-Call"
  timezone = "America/New_York"
  team_id  = oncallshift_team.platform.id

  layer {
    name                         = "Weekly Rotation"
    start                        = "2024-01-01T00:00:00Z"
    rotation_turn_length_seconds = 604800
    users                        = [oncallshift_user.alice.id]
  }
}

# Create an escalation policy
resource "oncallshift_escalation_policy" "default" {
  name    = "Default Escalation"
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

# Create a service
resource "oncallshift_service" "api" {
  name                 = "API Service"
  description          = "Main API service"
  team_id              = oncallshift_team.platform.id
  escalation_policy_id = oncallshift_escalation_policy.default.id
}
```

## Resources

| Resource | Description |
|----------|-------------|
| `oncallshift_team` | Manages teams |
| `oncallshift_user` | Manages users (invites) |
| `oncallshift_service` | Manages services |
| `oncallshift_schedule` | Manages on-call schedules |
| `oncallshift_escalation_policy` | Manages escalation policies |

## Data Sources

Coming soon.

## Development

### Building

```bash
make build
```

### Testing

```bash
# Unit tests
make test

# Acceptance tests (requires API key)
export ONCALLSHIFT_API_KEY="your-api-key"
make testacc
```

### Generating Documentation

```bash
make docs
```

## License

MPL-2.0
