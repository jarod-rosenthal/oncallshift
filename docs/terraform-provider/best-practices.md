# Best Practices

This guide covers recommended patterns and practices for managing OnCallShift infrastructure with Terraform.

## State Management

### Use Remote State

Never store Terraform state locally in production. Use remote backends for:

- State locking (prevents concurrent modifications)
- State history and rollback
- Team collaboration
- Encryption at rest

**Terraform Cloud / Enterprise:**
```hcl
terraform {
  cloud {
    organization = "my-company"
    workspaces {
      name = "oncallshift-production"
    }
  }
}
```

**AWS S3 with DynamoDB:**
```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "oncallshift/production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

### State File Isolation

Use separate state files for different environments to prevent accidental cross-environment changes:

```
infrastructure/
  oncallshift/
    environments/
      dev/
        main.tf
        terraform.tfvars
      staging/
        main.tf
        terraform.tfvars
      production/
        main.tf
        terraform.tfvars
    modules/
      team/
      service/
```

## Environment Separation

### Use Workspaces or Directories

**Option 1: Directory-based separation (recommended)**
```
oncallshift/
  modules/
    oncall-team/
      main.tf
      variables.tf
      outputs.tf
  environments/
    dev/
      main.tf
      variables.tf
      terraform.tfvars
    prod/
      main.tf
      variables.tf
      terraform.tfvars
```

**Option 2: Terraform Workspaces**
```bash
terraform workspace new dev
terraform workspace new staging
terraform workspace new production

terraform workspace select production
terraform apply
```

```hcl
locals {
  env_config = {
    dev = {
      escalation_timeout = 600   # 10 minutes
      repeat_count       = 1
    }
    staging = {
      escalation_timeout = 300   # 5 minutes
      repeat_count       = 2
    }
    production = {
      escalation_timeout = 120   # 2 minutes
      repeat_count       = 3
    }
  }

  config = local.env_config[terraform.workspace]
}
```

### Environment-Specific Variables

```hcl
# variables.tf
variable "environment" {
  type        = string
  description = "Environment name (dev, staging, production)"
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "oncallshift_api_key" {
  type        = string
  sensitive   = true
  description = "OnCallShift API key for this environment"
}
```

```hcl
# environments/production/terraform.tfvars
environment = "production"
# API key provided via environment variable or Terraform Cloud
```

## Team Structure Patterns

### Pattern 1: Service-Aligned Teams

Map Terraform team structure to your service organization:

```hcl
# Create teams for each domain
resource "oncallshift_team" "platform" {
  name        = "Platform"
  description = "Infrastructure and platform services"
}

resource "oncallshift_team" "backend" {
  name        = "Backend"
  description = "API and business logic services"
}

resource "oncallshift_team" "frontend" {
  name        = "Frontend"
  description = "Web and mobile applications"
}

# Services belong to their teams
resource "oncallshift_service" "kubernetes" {
  name    = "Kubernetes Cluster"
  team_id = oncallshift_team.platform.id
  # ...
}

resource "oncallshift_service" "api_gateway" {
  name    = "API Gateway"
  team_id = oncallshift_team.backend.id
  # ...
}
```

### Pattern 2: On-Call Rotation Pool

Create a shared rotation with specialists:

```hcl
# Core on-call pool
resource "oncallshift_schedule" "primary" {
  name     = "Primary On-Call"
  timezone = "America/New_York"

  layer {
    name          = "Primary"
    rotation_type = "weekly"
    handoff_time  = "09:00"
    handoff_day   = 1

    members = [
      oncallshift_user.alice.id,
      oncallshift_user.bob.id,
      oncallshift_user.charlie.id,
    ]
  }
}

# Specialist backup
resource "oncallshift_schedule" "database_specialist" {
  name     = "Database Specialist"
  timezone = "America/New_York"

  layer {
    name          = "Database"
    rotation_type = "weekly"
    handoff_time  = "09:00"
    handoff_day   = 1

    members = [oncallshift_user.dba.id]
  }
}

# Escalation: Primary -> Specialist -> Manager
resource "oncallshift_escalation_policy" "with_specialist" {
  name = "Standard with DB Specialist"

  step {
    timeout_seconds = 300
    target {
      type        = "schedule"
      schedule_id = oncallshift_schedule.primary.id
    }
  }

  step {
    timeout_seconds = 300
    target {
      type        = "schedule"
      schedule_id = oncallshift_schedule.database_specialist.id
    }
  }

  step {
    timeout_seconds = 600
    target {
      type    = "user"
      user_id = oncallshift_user.eng_manager.id
    }
  }
}
```

### Pattern 3: Follow-the-Sun

For global teams with 24/7 coverage:

```hcl
resource "oncallshift_schedule" "follow_the_sun" {
  name     = "Global Coverage"
  timezone = "UTC"

  # Americas coverage (13:00-21:00 UTC / 8am-4pm EST)
  layer {
    name          = "Americas"
    rotation_type = "weekly"
    handoff_time  = "09:00"
    handoff_day   = 1
    layer_order   = 0

    restrictions {
      type = "weekly"
      interval {
        start_day  = 1  # Monday
        start_time = "13:00"
        end_day    = 5  # Friday
        end_time   = "21:00"
      }
    }

    members = [
      oncallshift_user.us_engineer_1.id,
      oncallshift_user.us_engineer_2.id,
    ]
  }

  # APAC coverage (21:00-05:00 UTC / 6am-2pm Sydney)
  layer {
    name          = "APAC"
    rotation_type = "weekly"
    handoff_time  = "06:00"
    handoff_day   = 1
    layer_order   = 0

    restrictions {
      type = "weekly"
      interval {
        start_day  = 1
        start_time = "21:00"
        end_day    = 2
        end_time   = "05:00"
      }
      # Repeat for other days...
    }

    members = [
      oncallshift_user.apac_engineer_1.id,
      oncallshift_user.apac_engineer_2.id,
    ]
  }

  # EMEA coverage (05:00-13:00 UTC / 6am-2pm London)
  layer {
    name          = "EMEA"
    rotation_type = "weekly"
    handoff_time  = "09:00"
    handoff_day   = 1
    layer_order   = 0

    restrictions {
      type = "weekly"
      interval {
        start_day  = 1
        start_time = "05:00"
        end_day    = 1
        end_time   = "13:00"
      }
      # Repeat for other days...
    }

    members = [
      oncallshift_user.emea_engineer_1.id,
      oncallshift_user.emea_engineer_2.id,
    ]
  }
}
```

## Module Design

### Create Reusable Modules

**modules/oncall-team/main.tf:**
```hcl
variable "name" {
  type        = string
  description = "Team name"
}

variable "members" {
  type = list(object({
    email     = string
    full_name = string
    role      = optional(string, "member")
  }))
  description = "Team members"
}

variable "rotation_type" {
  type    = string
  default = "weekly"
}

variable "escalation_timeout" {
  type    = number
  default = 300
}

# Create team
resource "oncallshift_team" "this" {
  name = var.name
}

# Create users
resource "oncallshift_user" "members" {
  for_each = { for m in var.members : m.email => m }

  email     = each.value.email
  full_name = each.value.full_name

  team_membership {
    team_id = oncallshift_team.this.id
    role    = each.value.role
  }
}

# Create schedule
resource "oncallshift_schedule" "primary" {
  name     = "${var.name} On-Call"
  team_id  = oncallshift_team.this.id
  timezone = "UTC"

  layer {
    name          = "Primary"
    rotation_type = var.rotation_type
    handoff_time  = "09:00"
    handoff_day   = 1

    members = [for u in oncallshift_user.members : u.id]
  }
}

# Create escalation policy
resource "oncallshift_escalation_policy" "standard" {
  name    = "${var.name} Escalation"
  team_id = oncallshift_team.this.id

  step {
    timeout_seconds = var.escalation_timeout

    target {
      type        = "schedule"
      schedule_id = oncallshift_schedule.primary.id
    }
  }
}

# Outputs
output "team_id" {
  value = oncallshift_team.this.id
}

output "schedule_id" {
  value = oncallshift_schedule.primary.id
}

output "escalation_policy_id" {
  value = oncallshift_escalation_policy.standard.id
}
```

**Using the module:**
```hcl
module "platform_team" {
  source = "./modules/oncall-team"

  name = "Platform"

  members = [
    { email = "alice@example.com", full_name = "Alice Smith", role = "manager" },
    { email = "bob@example.com", full_name = "Bob Johnson" },
    { email = "charlie@example.com", full_name = "Charlie Brown" },
  ]

  rotation_type      = "weekly"
  escalation_timeout = 300
}

resource "oncallshift_service" "kubernetes" {
  name                 = "Kubernetes"
  team_id              = module.platform_team.team_id
  escalation_policy_id = module.platform_team.escalation_policy_id
}
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  push:
    branches: [main]
    paths: ['oncallshift/**']
  pull_request:
    branches: [main]
    paths: ['oncallshift/**']

env:
  ONCALLSHIFT_API_KEY: ${{ secrets.ONCALLSHIFT_API_KEY }}
  TF_VAR_environment: production

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.6.0

      - name: Terraform Init
        working-directory: oncallshift/environments/production
        run: terraform init

      - name: Terraform Plan
        working-directory: oncallshift/environments/production
        run: terraform plan -out=tfplan

      - name: Upload Plan
        uses: actions/upload-artifact@v4
        with:
          name: tfplan
          path: oncallshift/environments/production/tfplan

  apply:
    needs: plan
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.6.0

      - name: Download Plan
        uses: actions/download-artifact@v4
        with:
          name: tfplan
          path: oncallshift/environments/production

      - name: Terraform Init
        working-directory: oncallshift/environments/production
        run: terraform init

      - name: Terraform Apply
        working-directory: oncallshift/environments/production
        run: terraform apply -auto-approve tfplan
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - validate
  - plan
  - apply

variables:
  TF_ROOT: oncallshift/environments/production

.terraform:
  image: hashicorp/terraform:1.6
  before_script:
    - cd $TF_ROOT
    - terraform init

validate:
  extends: .terraform
  stage: validate
  script:
    - terraform validate
    - terraform fmt -check

plan:
  extends: .terraform
  stage: plan
  script:
    - terraform plan -out=tfplan
  artifacts:
    paths:
      - $TF_ROOT/tfplan
    expire_in: 1 day

apply:
  extends: .terraform
  stage: apply
  script:
    - terraform apply -auto-approve tfplan
  dependencies:
    - plan
  when: manual
  only:
    - main
```

## Disaster Recovery

### Export Configuration

Regularly export your OnCallShift configuration for backup:

```bash
#!/bin/bash
# backup_oncallshift.sh

BACKUP_DIR="backups/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Export teams
curl -s https://oncallshift.com/api/v1/teams \
  -H "Authorization: Bearer $ONCALLSHIFT_API_KEY" \
  > "$BACKUP_DIR/teams.json"

# Export users
curl -s https://oncallshift.com/api/v1/users \
  -H "Authorization: Bearer $ONCALLSHIFT_API_KEY" \
  > "$BACKUP_DIR/users.json"

# Export services
curl -s https://oncallshift.com/api/v1/services \
  -H "Authorization: Bearer $ONCALLSHIFT_API_KEY" \
  > "$BACKUP_DIR/services.json"

# Export schedules
curl -s https://oncallshift.com/api/v1/schedules \
  -H "Authorization: Bearer $ONCALLSHIFT_API_KEY" \
  > "$BACKUP_DIR/schedules.json"

# Export escalation policies
curl -s https://oncallshift.com/api/v1/escalation-policies \
  -H "Authorization: Bearer $ONCALLSHIFT_API_KEY" \
  > "$BACKUP_DIR/policies.json"

# Terraform state backup
terraform state pull > "$BACKUP_DIR/terraform.tfstate"

echo "Backup complete: $BACKUP_DIR"
```

### Recover from Terraform State

If state is lost but resources exist:

```bash
# 1. Initialize Terraform
terraform init

# 2. Import existing resources (see import.md)
./import_commands.sh

# 3. Verify configuration matches
terraform plan

# 4. Commit updated state
terraform apply
```

### Prevent Accidental Deletion

Use lifecycle rules to protect critical resources:

```hcl
resource "oncallshift_service" "critical_api" {
  name = "Critical API"
  # ...

  lifecycle {
    prevent_destroy = true
  }
}

resource "oncallshift_escalation_policy" "production" {
  name = "Production Escalation"
  # ...

  lifecycle {
    prevent_destroy = true
  }
}
```

## Security Best Practices

### 1. Least Privilege API Keys

Create specific API keys for different purposes:

```bash
# Terraform key - full access
curl -X POST https://oncallshift.com/api/v1/api-keys \
  -d '{"name": "terraform-prod", "scopes": ["*"]}'

# Monitoring key - read only
curl -X POST https://oncallshift.com/api/v1/api-keys \
  -d '{"name": "monitoring", "scopes": ["services:read", "incidents:read"]}'
```

### 2. Rotate API Keys Regularly

```bash
# Rotate key via API
curl -X POST https://oncallshift.com/api/v1/api-keys/{id}/rotate \
  -H "Authorization: Bearer $JWT_TOKEN"

# Update in CI/CD secrets
# Update in Terraform Cloud variables
```

### 3. Audit Terraform Changes

Enable detailed logging:

```bash
export TF_LOG=INFO
terraform apply
```

Review changes before applying:

```bash
terraform plan -out=plan.tfplan
terraform show plan.tfplan
# Review carefully
terraform apply plan.tfplan
```

### 4. Use OIDC Instead of Long-Lived Keys

For CI/CD, prefer OIDC authentication when available:

```yaml
# GitHub Actions with OIDC
jobs:
  deploy:
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Configure OnCallShift
        uses: oncallshift/auth-action@v1
        with:
          workload_identity_provider: 'projects/123/locations/global/workloadIdentityPools/my-pool/providers/github'
```
