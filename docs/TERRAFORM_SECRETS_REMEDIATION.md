# Terraform Hardcoded Secrets Remediation

## Issue Summary

A hardcoded Expo access token was found in the Terraform infrastructure code at `infrastructure/terraform/environments/dev/main.tf` line 585:

```hcl
secret_string = "0-DPir5fH337iOFkkLK_T5pFCPmwPvNWNbFF2om3"
```

**Severity:** HIGH

This token grants access to manage push notifications for the mobile app and should never be committed to version control.

## Remediation Steps Completed

### 1. ✅ Removed Hardcoded Secret from Code

**File:** `infrastructure/terraform/environments/dev/main.tf`

**Before:**
```hcl
resource "aws_secretsmanager_secret_version" "expo_access_token" {
  secret_id     = aws_secretsmanager_secret.expo_access_token.id
  secret_string = "0-DPir5fH337iOFkkLK_T5pFCPmwPvNWNbFF2om3"
}
```

**After:**
```hcl
resource "aws_secretsmanager_secret_version" "expo_access_token" {
  count         = var.expo_access_token != null ? 1 : 0
  secret_id     = aws_secretsmanager_secret.expo_access_token.id
  secret_string = var.expo_access_token
}
```

### 2. ✅ Added Terraform Variable with Sensitive Flag

**File:** `infrastructure/terraform/environments/dev/variables.tf`

Added new variable with `sensitive = true` to prevent accidental logging:

```hcl
variable "expo_access_token" {
  description = "Expo Access Token for push notifications to mobile app. Store in tfvars or environment variable EXPO_ACCESS_TOKEN."
  type        = string
  default     = null
  sensitive   = true
}
```

### 3. ✅ Updated .gitignore

**File:** `.gitignore`

Confirmed that sensitive Terraform files are properly excluded:
- `terraform.tfvars` - Already excluded
- `*.tfvars` - Now explicitly listed
- `*.tfvars.json` - Added to prevent JSON-formatted variable files

### 4. ✅ Added Pre-commit Hooks

**File:** `.pre-commit-config.yaml` (NEW)

Implemented multiple layers of secret detection:

#### a. Detect Secrets Hook
- Scans for exposed secrets using pattern matching
- Uses Yelp's `detect-secrets` library
- Maintains a baseline of acceptable secrets

#### b. TFSec Hook
- Terraform-specific security scanner by AquaSecurity
- Detects security misconfigurations and hardcoded secrets
- Runs before every commit

#### c. Terraform Docs Hook
- Automatically formats and validates Terraform code
- Ensures consistency and readability

#### d. Pre-commit Framework Hooks
- Detects private keys using standard patterns
- Checks for merge conflicts
- Validates JSON/YAML syntax

#### e. Custom Terraform Secrets Check
**File:** `scripts/check-terraform-secrets.sh` (NEW)

Custom shell script that checks for:
- `secret_string = "..."`
- `api_key = "..."`
- `token = "..."`
- `password = "..."`
- `private_key = "..."`
- `platform_credential = "..."`

While intelligently skipping:
- Variable references (`var.`, `data.`, etc.)
- Comments
- Resource references

## How to Use the Remediation

### Provide the Expo Token

You have two options:

#### Option 1: Using terraform.tfvars (Recommended for Development)

Create `infrastructure/terraform/environments/dev/terraform.tfvars`:

```hcl
expo_access_token = "your-actual-expo-token-here"
```

**Important:** This file is in `.gitignore` and will NOT be committed.

#### Option 2: Environment Variable (Recommended for CI/CD)

```bash
export TF_VAR_expo_access_token="your-actual-expo-token-here"
terraform apply
```

Or in your CI/CD pipeline:

```yaml
env:
  TF_VAR_expo_access_token: ${{ secrets.EXPO_ACCESS_TOKEN }}
```

### Apply Terraform Changes

```bash
cd infrastructure/terraform/environments/dev

# Verify the plan doesn't include the token
terraform plan

# Apply changes
terraform apply
```

### Set Up Pre-commit Hooks (Local Development)

```bash
# Install pre-commit framework
pip install pre-commit

# Install the git hooks from .pre-commit-config.yaml
pre-commit install

# (Optional) Run hooks manually on all files
pre-commit run --all-files
```

After setup, the hooks will automatically run before each commit, preventing hardcoded secrets from being added to the repository.

## Best Practices Going Forward

### 1. Never Commit Secrets

✅ **DO:**
```hcl
variable "my_secret" {
  type      = string
  sensitive = true
  default   = null
}

resource "aws_secret" "my_secret" {
  secret_string = var.my_secret  # ✅ References variable
}
```

❌ **DON'T:**
```hcl
resource "aws_secret" "my_secret" {
  secret_string = "hardcoded-value-123"  # ❌ SECURITY RISK!
}
```

### 2. Use AWS Secrets Manager

For secrets that need to persist in infrastructure:

```hcl
# Create the secret container
resource "aws_secretsmanager_secret" "my_secret" {
  name = "${var.project_name}-${var.environment}-my-secret"
}

# Set the value via variable or manual AWS CLI
resource "aws_secretsmanager_secret_version" "my_secret" {
  count         = var.my_secret != null ? 1 : 0
  secret_id     = aws_secretsmanager_secret.my_secret.id
  secret_string = var.my_secret
}
```

### 3. Mark Sensitive Variables

Always mark variables containing secrets:

```hcl
variable "api_key" {
  type      = string
  sensitive = true
  default   = null
}
```

This prevents the value from appearing in:
- `terraform plan` output
- `terraform apply` output
- CloudWatch logs
- State files (still encrypted at rest)

### 4. Use .gitignore for Local Files

Add to `.gitignore`:
```
terraform.tfvars        # Local overrides
terraform.tfvars.json   # Local overrides (JSON format)
```

### 5. Use Environment Variables for CI/CD

Use GitHub Secrets or similar for automated deployments:

```bash
export TF_VAR_variable_name="value"
terraform apply
```

## Verification Checklist

- [x] Hardcoded token removed from main.tf
- [x] Variable added to variables.tf with sensitive flag
- [x] .gitignore updated to exclude *.tfvars files
- [x] Pre-commit hooks configured for secret detection
- [x] Documentation created for team
- [ ] Token rotated in Expo (recommended after exposure)
- [ ] Git history cleaned (if sensitive data was exposed)

## Rotating the Exposed Secret

Since the token was committed to version control:

1. **Rotate the Expo token** immediately in your Expo account
2. **Review git history** to ensure it's not exposed in public repositories
3. **Update all deployments** with the new token

### Rotate the Expo Token

```bash
# Via Expo CLI
eas secrets create --scope project --name EXPO_ACCESS_TOKEN

# Or manually in Expo dashboard
# 1. Go to https://expo.dev
# 2. Navigate to Account Settings
# 3. Generate a new access token
# 4. Update the secret in AWS Secrets Manager:

aws secretsmanager put-secret-value \
  --secret-id pagerduty-lite-dev-expo-access-token \
  --secret-string "new-token-here" \
  --region us-east-1
```

## References

- [Terraform Sensitive Variables](https://www.terraform.io/language/state/sensitive-data)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [TFSec Security Scanner](https://aquasecurity.github.io/tfsec/latest/)
- [Detect Secrets Framework](https://github.com/Yelp/detect-secrets)
- [Pre-commit Hooks Framework](https://pre-commit.com/)

## Security Policy

**CRITICAL:** All secrets MUST be:
1. Never hardcoded in Terraform or any source code
2. Stored in AWS Secrets Manager or environment variables
3. Marked with `sensitive = true` in Terraform variables
4. Rotated regularly (monthly minimum)
5. Audited for unauthorized access

Violations of this policy may result in:
- Immediate incident response
- PR rejection without exception
- Security review requirements
- Potential revocation of commit access

## Questions?

Contact the DevOps/Security team or see the CLAUDE.md Security Requirements section.
