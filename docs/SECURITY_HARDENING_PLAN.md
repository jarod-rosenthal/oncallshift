# Security Hardening Plan for PagerDuty-Lite

**Date:** December 30, 2025
**Standard:** OWASP Application Security Verification Standard (ASVS) 4.0 Level 2
**Compliance Targets:** SOC 2 Type II, OWASP Top 10 2021

---

## Executive Summary

This security assessment identifies vulnerabilities and gaps in the pagerduty-lite application across infrastructure, application, and operational domains. The findings are organized into a phased implementation plan prioritized by risk severity.

**Risk Summary:**
- **Critical:** 3 findings
- **High:** 6 findings
- **Medium:** 8 findings
- **Low:** 5 findings

---

## Phase 1: Critical Issues (Immediate Action Required)

### 1.1 Secrets Exposure in Local Environment Files

**Finding:** The `backend/.env` file contains production database credentials with the actual password.

**Location:** `backend/.env:6`
```
DATABASE_URL=postgres://pgadmin:-%3ES1YS%3CFM%5BlZ1%5D8%28%28BIfWK1kahm%3Cn6o1@pagerduty-lite-dev.cn9wuodq8uyb.us-east-1.rds.amazonaws.com:5432/pagerduty_lite
```

**Risk:** Critical - If this file is accidentally committed or exposed, attackers gain direct database access.

**Solution:**
1. Rotate the database password immediately via AWS Secrets Manager
2. Ensure `.env` is in `.gitignore` (verified: it is)
3. Update `.env.example` to use placeholder values only
4. Implement pre-commit hooks to prevent accidental secret commits
5. Consider using `git-secrets` or `gitleaks` for automated scanning

**OWASP:** A02:2021 - Cryptographic Failures

---

### 1.2 Unauthenticated Data Exposure via Demo Endpoint

**Finding:** The `/api/v1/demo/dashboard` endpoint exposes production incident data without authentication.

**Location:** `backend/src/api/routes/demo.ts:13`
```typescript
router.get('/dashboard', async (_req: Request, res: Response) => {
  // NO AUTH REQUIRED - exposes all incidents, services, users, schedules
```

**Risk:** Critical - Exposes sensitive operational data including:
- Incident summaries and details
- User names and emails
- Service configurations
- On-call schedule information

**Solution:**
1. Remove demo endpoint in production OR
2. Add authentication requirement to demo routes
3. If demo is required, create synthetic demo data separate from production
4. Implement environment-based route registration

**OWASP:** A01:2021 - Broken Access Control

---

### 1.3 HTTP-Only ALB Listener Without TLS Enforcement

**Finding:** The ALB HTTP listener forwards traffic directly instead of redirecting to HTTPS.

**Location:** `infrastructure/terraform/environments/dev/main.tf:123-132`
```hcl
resource "aws_lb_listener" "http" {
  default_action {
    type             = "forward"  # Should be "redirect" to HTTPS
    target_group_arn = aws_lb_target_group.api.arn
  }
}
```

**Risk:** Critical - Allows man-in-the-middle attacks and credential interception.

**Solution:**
```hcl
resource "aws_lb_listener" "http" {
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
```

**OWASP:** A02:2021 - Cryptographic Failures

---

## Phase 2: High Priority Issues (1-2 Weeks)

### 2.1 Missing Rate Limiting on Authentication Endpoints

**Finding:** Login and registration endpoints lack rate limiting, enabling brute-force attacks.

**Location:** `backend/src/api/routes/auth.ts`

**Risk:** High - Allows credential stuffing and brute-force attacks.

**Solution:**
1. Apply the `webhookRateLimiter` middleware created in this session to auth routes
2. Implement stricter limits for auth endpoints (e.g., 5 attempts per minute)
3. Add exponential backoff after failed attempts
4. Consider CAPTCHA after multiple failures

```typescript
const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  keyExtractor: (req) => req.ip || 'unknown',
});

router.post('/login', authRateLimiter, [...]);
```

**OWASP:** A07:2021 - Identification and Authentication Failures

---

### 2.2 API Key Exposure in Service Responses

**Finding:** The service API returns the full `apiKey` in responses, including to non-admin users.

**Location:** `backend/src/api/routes/services.ts:302-320`
```typescript
function formatService(service: Service) {
  return {
    apiKey: service.apiKey,  // Exposed to all authenticated users
    ...
  };
}
```

**Risk:** High - Any authenticated user can view API keys for all services in their organization.

**Solution:**
1. Remove `apiKey` from default response
2. Create separate admin-only endpoint for key retrieval
3. Mask API keys in responses (show only last 4 characters)

**OWASP:** A01:2021 - Broken Access Control

---

### 2.3 Insufficient Password Policy Enforcement

**Finding:** Password validation only requires 8 characters minimum.

**Location:** `backend/src/api/routes/auth.ts:70`
```typescript
body('password').isLength({ min: 8 })
```

**Risk:** High - Weak passwords are vulnerable to brute-force attacks.

**Solution:**
1. Implement comprehensive password policy:
   - Minimum 12 characters
   - At least one uppercase, lowercase, number, symbol
   - Check against common password lists (Have I Been Pwned API)
2. Cognito already enforces this - sync validation with Cognito policy

**OWASP:** A07:2021 - Identification and Authentication Failures

---

### 2.4 Missing CSRF Protection

**Finding:** No CSRF tokens implemented for state-changing operations.

**Location:** Throughout API routes

**Risk:** High - Cross-site request forgery attacks possible.

**Solution:**
1. Implement CSRF token middleware for cookie-based sessions
2. For token-based auth (JWT), ensure:
   - Tokens are not stored in cookies OR
   - SameSite=Strict cookie attribute is set
3. Add custom header requirement (e.g., `X-Requested-With`)

**OWASP:** A01:2021 - Broken Access Control

---

### 2.5 Missing Security Headers

**Finding:** Several security headers are misconfigured or missing.

**Location:** `backend/src/api/app.ts:26-37`

**Risk:** High - XSS and clickjacking vulnerabilities.

**Current Issues:**
- `script-src: 'unsafe-inline'` - Allows inline scripts
- Missing `X-Content-Type-Options` explicit setting
- Missing `Referrer-Policy`
- `upgrade-insecure-requests: null` disabled

**Solution:**
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],  // Remove unsafe-inline
      styleSrc: ["'self'", "'unsafe-inline'"],  // Consider CSS-in-JS
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://api.oncallshift.com"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

**OWASP:** A05:2021 - Security Misconfiguration

---

### 2.6 Overly Permissive CORS Configuration

**Finding:** CORS is configured to allow all origins with credentials.

**Location:** `backend/src/api/app.ts:40-43`
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',  // Defaults to wildcard
  credentials: true,  // Dangerous with wildcard
}));
```

**Risk:** High - Allows any website to make authenticated requests.

**Solution:**
```typescript
const allowedOrigins = [
  'https://oncallshift.com',
  'https://app.oncallshift.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
}));
```

**OWASP:** A05:2021 - Security Misconfiguration

---

## Phase 3: Medium Priority Issues (2-4 Weeks)

### 3.1 Missing Database Connection Encryption

**Finding:** Database connection string doesn't specify SSL mode.

**Location:** Database module - no SSL enforcement visible

**Solution:**
1. Add `?sslmode=require` to DATABASE_URL
2. Configure RDS to require SSL connections
3. Add to Terraform:
```hcl
resource "aws_db_instance" "main" {
  iam_database_authentication_enabled = true
  # Add parameter group with rds.force_ssl = 1
}
```

---

### 3.2 Missing Audit Logging

**Finding:** No comprehensive audit trail for security-sensitive operations.

**Solution:**
1. Implement structured audit logging for:
   - Authentication events (login, logout, failed attempts)
   - Authorization failures
   - Data access patterns
   - Administrative actions
2. Send logs to CloudWatch Logs with appropriate retention
3. Consider AWS CloudTrail for infrastructure actions

---

### 3.3 Missing Input Sanitization for HTML/XSS

**Finding:** Incident details and notes accept arbitrary JSON without sanitization.

**Location:** Multiple routes accepting `details` field

**Solution:**
1. Sanitize user input using `DOMPurify` or similar
2. Encode output in frontend
3. Validate JSON schema for known fields

---

### 3.4 Auto-Confirm User Registration

**Finding:** Users are auto-confirmed without email verification.

**Location:** `backend/src/api/routes/auth.ts:116-120`
```typescript
// Auto-confirm user for MVP (in production, use email verification)
const confirmCommand = new AdminConfirmSignUpCommand({...});
```

**Solution:**
1. Enable email verification in Cognito
2. Remove `AdminConfirmSignUp` call
3. Implement verification flow in frontend

---

### 3.5 No Request ID Tracking

**Finding:** Requests lack correlation IDs for debugging and security incident investigation.

**Solution:**
```typescript
import { v4 as uuidv4 } from 'uuid';

app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});
```

---

### 3.6 Missing Container Security Scanning

**Finding:** CI/CD pipeline builds and pushes Docker images without security scanning.

**Location:** `.github/workflows/_backend.yml`

**Solution:**
1. Add Trivy or Snyk container scanning:
```yaml
- name: Scan image for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ steps.set-vars.outputs.ECR_REGISTRY }}/${{ steps.set-vars.outputs.ECR_API_REPO }}:${{ github.sha }}
    format: 'sarif'
    severity: 'CRITICAL,HIGH'
```

---

### 3.7 ECR Image Tag Mutability

**Finding:** ECR repositories allow mutable tags.

**Location:** `infrastructure/terraform/modules/ecs-service/main.tf:14`
```hcl
image_tag_mutability = "MUTABLE"
```

**Solution:**
```hcl
image_tag_mutability = "IMMUTABLE"
```

---

### 3.8 Missing WAF Protection

**Finding:** No Web Application Firewall configured for ALB or CloudFront.

**Solution:**
1. Add AWS WAF to CloudFront distribution
2. Enable AWS Managed Rules for:
   - Common Rule Set
   - Known Bad Inputs
   - SQL Injection
   - Rate limiting

---

## Phase 4: Low Priority Improvements (4-8 Weeks)

### 4.1 Enable RDS Performance Insights and Enhanced Monitoring

**Location:** `infrastructure/terraform/environments/dev/main.tf:75-76`

Currently disabled for cost savings - enable for production.

---

### 4.2 Implement Database Connection Pooling

Use PgBouncer or RDS Proxy to prevent connection exhaustion attacks.

---

### 4.3 Add Dependency Vulnerability Scanning

```yaml
- name: Run npm audit
  run: npm audit --audit-level=high
```

---

### 4.4 Implement API Versioning Strategy

Current versioning (`/api/v1/`) is good but lacks deprecation handling.

---

### 4.5 Add Security.txt

Create `/.well-known/security.txt` with vulnerability disclosure information.

---

## Implementation Checklist

### Immediate (Phase 1 - This Week)
- [ ] Rotate database credentials
- [ ] Add pre-commit hooks for secret scanning
- [ ] Remove or protect demo endpoint
- [ ] Fix HTTP to HTTPS redirect

### Short-term (Phase 2 - Next 2 Weeks)
- [ ] Add rate limiting to auth endpoints
- [ ] Mask API keys in responses
- [ ] Strengthen password policy
- [ ] Fix CORS configuration
- [ ] Harden security headers

### Medium-term (Phase 3 - Next Month)
- [ ] Enable database SSL
- [ ] Implement audit logging
- [ ] Add input sanitization
- [ ] Enable email verification
- [ ] Add container scanning to CI/CD
- [ ] Add WAF rules

### Long-term (Phase 4 - Next Quarter)
- [ ] Enable RDS monitoring
- [ ] Implement connection pooling
- [ ] Add dependency scanning
- [ ] Create security.txt
- [ ] Conduct penetration testing

---

## Compliance Mapping

| Control | OWASP ASVS | SOC 2 | Status |
|---------|------------|-------|--------|
| Authentication | V2.1-2.10 | CC6.1 | Partial |
| Session Management | V3.1-3.7 | CC6.1 | Good |
| Access Control | V4.1-4.3 | CC6.2 | Needs Work |
| Input Validation | V5.1-5.5 | CC6.1 | Partial |
| Cryptography | V6.1-6.4 | CC6.7 | Needs Work |
| Error Handling | V7.1-7.4 | CC7.1 | Good |
| Data Protection | V8.1-8.3 | CC6.5 | Partial |
| API Security | V13.1-13.4 | CC6.1 | Needs Work |

---

## Resources

- [OWASP ASVS 4.0](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [AWS Security Best Practices](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/)
- [SOC 2 Compliance](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/sorhome)

---

*This document should be reviewed and updated quarterly or after significant infrastructure changes.*
