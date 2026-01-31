# Terraform Deployment Guide

## Overview

This guide explains how to deploy infrastructure using Terraform with proper secret management.

## Prerequisites

- Terraform >= 1.0
- AWS CLI configured with credentials
- Pre-commit hooks installed (recommended)
- `.env` file with necessary variables (see below)

## Environment Setup

### 1. Create terraform.tfvars (Local Development)

Create a file that is **NOT** checked into git (it's in .gitignore):

```bash
cd infrastructure/terraform/environments/dev
cat > terraform.tfvars << 'EOF'
# Project settings
project_name = "pagerduty-lite"
environment  = "dev"
aws_region   = "us-east-1"

# Domain (optional, for production)
domain_name = null

# Secrets (NEVER commit these!)
expo_access_token = "your-actual-expo-token-here"

# Push notifications (optional)
fcm_server_key = null
apns_certificate = null
apns_private_key = null

# Database
db_instance_class = "db.t4g.micro"  # micro for POC, small for dev

# Feature flags
sentry_enabled = false
EOF
```

**IMPORTANT:** `terraform.tfvars` is in `.gitignore` and will NOT be committed.

### 2. Install Pre-commit Hooks

```bash
# Install pre-commit framework
pip install pre-commit

# Install hooks from .pre-commit-config.yaml
pre-commit install

# Run hooks on all files (optional, to verify setup)
pre-commit run --all-files
```

After this, the hooks will automatically run before each commit and prevent hardcoded secrets.

### 3. Initialize Terraform

```bash
cd infrastructure/terraform/environments/dev

# Initialize Terraform (downloads providers and configures backend)
terraform init

# This sets up the remote S3 backend for state management
```

## Common Workflows

### Plan Infrastructure Changes

```bash
cd infrastructure/terraform/environments/dev

# Review what will be created/modified
terraform plan

# Save plan to file for review
terraform plan -out=tfplan

# Apply the saved plan
terraform apply tfplan
```

### Apply Infrastructure Changes

```bash
cd infrastructure/terraform/environments/dev

# Review and apply in one command
terraform apply

# Or apply non-interactively (for CI/CD)
terraform apply -auto-approve
```

### Validate Configuration

```bash
cd infrastructure/terraform/environments/dev

# Check syntax
terraform validate

# Format code consistently
terraform fmt -recursive
```

### View Current State

```bash
# List all resources
terraform state list

# Show details of a specific resource
terraform state show aws_ecs_cluster.main

# Output values (defined in outputs.tf)
terraform output
```

## Providing Secrets

### Option 1: terraform.tfvars (Local Development)

See "Create terraform.tfvars" section above.

```bash
terraform apply  # Uses variables from terraform.tfvars
```

### Option 2: Environment Variables (CI/CD)

```bash
export TF_VAR_expo_access_token="your-token"
export TF_VAR_fcm_server_key="your-key"

terraform apply
```

### Option 3: Command Line Flags

```bash
terraform apply \
  -var="expo_access_token=your-token" \
  -var="fcm_server_key=your-key"
```

### Option 4: AWS Secrets Manager (Recommended)

For production, store secrets directly in AWS:

```bash
# Create secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name pagerduty-lite-dev-expo-access-token \
  --secret-string "your-actual-token" \
  --region us-east-1

# Then reference via data source in Terraform
data "aws_secretsmanager_secret" "expo_token" {
  name = "pagerduty-lite-dev-expo-access-token"
}

# Use in resource
secret_string = data.aws_secretsmanager_secret_version.expo_token.secret_string
```

## Handling Sensitive Data

### ✅ DO: Use Variables with sensitive = true

```hcl
variable "expo_access_token" {
  type      = string
  sensitive = true
}

resource "aws_secretsmanager_secret_version" "token" {
  secret_string = var.expo_access_token
}
```

### ❌ DON'T: Hardcode Secrets

```hcl
# NEVER do this!
resource "aws_secretsmanager_secret_version" "token" {
  secret_string = "hardcoded-token-123"
}
```

### Check Terraform Output for Sensitive Data

Terraform automatically masks sensitive variables:

```bash
$ terraform apply

Changes to Outputs:
  ~ value = (sensitive)
```

## Managing Terraform State

### State Storage

The remote backend is configured in `main.tf`:

```hcl
terraform {
  backend "s3" {
    bucket  = "oncallshift"
    key     = "terraform/dev/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true  # Encrypted at rest
  }
}
```

### Accessing State Remotely

```bash
# Pull latest state from S3
terraform refresh

# Show state
terraform show

# State is locked during operations - check locks
terraform force-unlock ID  # Only if lock is stuck!
```

### Backing Up State

```bash
# Download state locally (for backup)
aws s3 cp s3://oncallshift/terraform/dev/terraform.tfstate ./backup-$(date +%Y%m%d).tfstate

# Upload if needed
aws s3 cp ./backup-20240101.tfstate s3://oncallshift/terraform/dev/terraform.tfstate
```

## Troubleshooting

### Syntax Errors

```bash
# Validate all Terraform files
terraform validate

# Format files consistently
terraform fmt -recursive .
```

### State Issues

```bash
# Refresh state from AWS
terraform refresh

# Check what's in state
terraform state list

# Remove a resource from state (careful!)
terraform state rm aws_instance.example
```

### Secrets Not Found

```bash
# Check if secret exists
aws secretsmanager describe-secret --secret-id pagerduty-lite-dev-expo-access-token

# View secret value (masked)
aws secretsmanager get-secret-value --secret-id pagerduty-lite-dev-expo-access-token
```

### Pre-commit Hook Failures

```bash
# Bypass hooks (use with caution!)
git commit --no-verify

# Run hooks manually to see detailed errors
pre-commit run --all-files

# Update hooks
pre-commit autoupdate
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Terraform Apply

on:
  push:
    branches: [main]
    paths: ['infrastructure/terraform/**']

env:
  TF_VAR_expo_access_token: ${{ secrets.EXPO_ACCESS_TOKEN }}
  TF_VAR_fcm_server_key: ${{ secrets.FCM_SERVER_KEY }}

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.5.0

      - name: Terraform Format
        run: terraform fmt -check -recursive

      - name: Terraform Validate
        run: terraform validate

      - name: Terraform Plan
        run: |
          cd infrastructure/terraform/environments/dev
          terraform plan

      - name: Terraform Apply
        if: github.ref == 'refs/heads/main'
        run: |
          cd infrastructure/terraform/environments/dev
          terraform apply -auto-approve
```

## Security Checklist

Before deploying to production:

- [ ] All secrets provided via variables or environment
- [ ] Pre-commit hooks installed and passing
- [ ] No hardcoded secrets in .tf files
- [ ] Sensitive variables marked with `sensitive = true`
- [ ] State encryption enabled (S3 backend)
- [ ] State access restricted (IAM policies)
- [ ] Terraform plan reviewed by peer
- [ ] Secrets rotated regularly
- [ ] Audit logging enabled

## Additional Resources

- [Terraform Documentation](https://www.terraform.io/docs)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [Terraform Sensitive Data](https://www.terraform.io/language/state/sensitive-data)
- [Pre-commit Hooks](https://pre-commit.com/)
- [TERRAFORM_SECRETS_REMEDIATION.md](./TERRAFORM_SECRETS_REMEDIATION.md)
