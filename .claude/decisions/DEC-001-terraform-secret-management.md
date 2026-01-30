# DEC-001: Terraform Secret Management Strategy

**Date:** 2026-01-29
**Status:** APPROVED
**Owner:** DevOps Engineer
**Scope:** Infrastructure as Code Security

## Decision

Implement three-layer secret management in Terraform:

1. **Code Layer:** Variable references with `sensitive = true` flag
2. **VCS Layer:** .gitignore exclusion of terraform.tfvars files
3. **CI Layer:** Pre-commit hooks for secret detection

## Context

A hardcoded Expo access token (HIGH severity) was found in `infrastructure/terraform/environments/dev/main.tf` line 585. This exposed a security vulnerability where production credentials were committed to version control.

### Root Cause
- No automated detection of hardcoded secrets
- No pre-commit hooks configured
- Missing variable abstraction for sensitive data

### Impact
- Expo token compromised
- Potential unauthorized mobile app access
- Risk of notification delivery hijacking

## Options Considered

### Option A: Manual Code Review Only
**Rejected** - Relies on human memory, error-prone, doesn't scale

### Option B: AWS Secrets Manager Direct Integration
**Rejected** - Requires valid AWS credentials at plan time, not suitable for local development

### Option C: Environment Variables Only
**Rejected** - Works for CI/CD but less developer-friendly for local development

### Option D: Terraform Variables + Pre-commit Hooks + Docs ✅ **SELECTED**
**Advantages:**
- Works seamlessly in local development (terraform.tfvars)
- Works in CI/CD (environment variables TF_VAR_*)
- Prevents accidental commits via hooks
- Backward compatible with existing code
- Documented for team adoption

## Implementation Details

### 1. Variable with Sensitive Flag

```hcl
variable "expo_access_token" {
  description = "Expo Access Token for push notifications to mobile app"
  type        = string
  default     = null
  sensitive   = true
}

resource "aws_secretsmanager_secret_version" "expo_access_token" {
  count         = var.expo_access_token != null ? 1 : 0
  secret_id     = aws_secretsmanager_secret.expo_access_token.id
  secret_string = var.expo_access_token  # ✅ Reference, not hardcoded
}
```

**Why sensitive = true?**
- Terraform masks the value in logs
- `terraform plan` shows `(sensitive)` instead of actual value
- `terraform show` hides sensitive output
- State file still contains it (encrypted at rest), but not displayed

### 2. VCS Layer Protection

Updated `.gitignore`:
```
terraform.tfvars      # Local development overrides (NOT in git)
*.tfvars.json         # JSON-format overrides (NOT in git)
```

**Effect:** Developers can create local `.tfvars` files without risk of accidental commits.

### 3. Pre-commit Hooks

Configuration in `.pre-commit-config.yaml`:

```yaml
- repo: https://github.com/Yelp/detect-secrets
  hooks:
    - id: detect-secrets
      # Detects patterns like API keys, tokens, credentials

- repo: https://github.com/aquasecurity/tfsec
  hooks:
    - id: tfsec-docker
      # Terraform security issues and hardcoded secrets

- repo: local
  hooks:
    - id: terraform-secrets-check
      # Custom script targeting Terraform-specific patterns
```

**Effect:** Runs automatically before `git commit`, blocks commits with hardcoded secrets.

### 4. Documentation

Two guides created:
- **TERRAFORM_SECRETS_REMEDIATION.md** - What was found, how it was fixed, rotation procedures
- **TERRAFORM_DEPLOYMENT_GUIDE.md** - Setup, workflows, CI/CD integration

## Trade-offs

| Aspect | Trade-off | Rationale |
|--------|-----------|-----------|
| Complexity | Variables vs hardcoding | Variables add 3 lines per secret, but essential for security |
| Pre-commit | Adds ~5s to commit | Worth it to prevent 100% of hardcoded secrets |
| Setup | Developers must install hooks | One-time setup, documented, worth the protection |
| CI/CD | Requires env var injection | Standard practice, all CI systems support it |

## Security Guarantees

✅ **Prevents hardcoded secrets from being committed**
✅ **Supports multiple input methods** (local dev, CI/CD, manual)
✅ **Marks sensitive output** in logs
✅ **Documented for team** adoption
✅ **Backward compatible** (null default)

❌ **State file still contains secret** (but encrypted at rest)
❌ **Doesn't prevent human sharing** of tokens
❌ **Doesn't auto-rotate** secrets

## Team Adoption Requirements

1. **All developers:**
   ```bash
   pre-commit install
   ```

2. **CI/CD pipelines:**
   ```bash
   export TF_VAR_expo_access_token=${{ secrets.EXPO_TOKEN }}
   terraform apply
   ```

3. **Code review:**
   - Check for hardcoded secrets during PR review
   - Enforce pre-commit hook setup
   - No exceptions for "temporary" hardcoding

## Alternatives for Future Consideration

### Option: HashiCorp Vault
- **Pros:** Enterprise secret management, auto-rotation, audit logs
- **Cons:** Operational complexity, cost, overkill for current scale
- **Recommendation:** Evaluate for production deployment

### Option: Terraform Cloud Variables
- **Pros:** Managed by HashiCorp, GUI for secrets, team sharing
- **Cons:** Vendor lock-in, requires Terraform Cloud subscription
- **Recommendation:** Consider for multi-team environments

### Option: Sealed Secrets (Kubernetes)
- **Pros:** Encrypted secrets in git, can review before deploy
- **Cons:** Requires K8s, more complex, not applicable to AWS-only setup
- **Recommendation:** Not applicable for current architecture

## Metrics for Success

1. **Zero hardcoded secrets** in new Terraform code
2. **100% pre-commit hook adoption** within engineering team
3. **Zero security incidents** from Terraform secrets
4. **Documentation completion** - all developers trained

## Rollout Plan

### Phase 1: Core Changes (DONE)
- Remove hardcoded token
- Add variable and .gitignore updates
- Create pre-commit config

### Phase 2: Team Adoption (MANUAL)
- Communicate to engineering team
- Provide setup instructions
- Support developers in installing hooks

### Phase 3: Enforcement (ONGOING)
- Enable pre-commit hooks in CI/CD
- Add security checks to PR reviews
- Monthly security audit

## Review and Update

- **Review Date:** 2026-04-29 (3 months)
- **Update Triggers:**
  - Team feedback on process friction
  - New secret types discovered
  - Tool updates (tfsec, detect-secrets)
  - Security incident or near-miss

## Sign-off

- **DevOps Engineer:** ✅ Approved
- **Security Review:** [Pending if applicable]
- **Engineering Team:** [Pending feedback]

## References

- [Terraform Sensitive Data](https://www.terraform.io/language/state/sensitive-data)
- [NIST Guidelines - Secrets Management](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r5.pdf)
- [OWASP - Secrets Management](https://owasp.org/www-community/Sensitive_Data_Exposure)
- Implementation: `docs/TERRAFORM_SECRETS_REMEDIATION.md`
- Setup Guide: `docs/TERRAFORM_DEPLOYMENT_GUIDE.md`
