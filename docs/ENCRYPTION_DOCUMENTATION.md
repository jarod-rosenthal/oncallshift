# Encryption Documentation for OnCallShift

**Document Version:** 1.0
**Date:** January 4, 2026
**Purpose:** HIPAA Compliance Documentation
**Standard:** NIST SP 800-53 SC-13 (Cryptographic Protection)

---

## Executive Summary

OnCallShift implements comprehensive encryption controls for data at rest and in transit to ensure confidentiality, integrity, and authentication of sensitive information. This document details all encryption mechanisms, key management practices, and security controls that support HIPAA compliance and data protection requirements.

**Encryption Standards Used:**
- **At Rest:** AES-256-GCM (symmetric encryption)
- **In Transit:** TLS 1.2+ (transport layer security)
- **Key Derivation:** SCRYPT, HKDF-SHA256

---

## Table of Contents

1. [Data Encryption at Rest](#data-encryption-at-rest)
2. [Data Encryption in Transit](#data-encryption-in-transit)
3. [Key Management](#key-management)
4. [Credential Encryption](#credential-encryption)
5. [Infrastructure Encryption](#infrastructure-encryption)
6. [Compliance Mapping](#compliance-mapping)
7. [Operational Procedures](#operational-procedures)

---

## Data Encryption at Rest

### 1.1 Database Encryption (RDS)

**Standard:** AWS RDS Encryption with KMS keys

**Configuration:**
- **Enabled:** Yes (mandatory for all database instances)
- **Encryption Algorithm:** AES-256
- **Key Management:** AWS Key Management Service (KMS)
- **Storage Encrypted:** True

**Implementation Location:**
- Terraform Module: `infrastructure/terraform/modules/database/main.tf` (line 73)
- Configuration: `storage_encrypted = true`

**Key Details:**

```hcl
# Database encryption configuration
resource "aws_db_instance" "main" {
  allocated_storage     = var.allocated_storage
  storage_type         = "gp3"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = var.instance_class
  db_name              = "pagerduty_lite"
  username             = "pgadmin"
  password             = random_password.db_password.result

  # Encryption settings
  storage_encrypted    = true
  kms_key_id          = var.kms_key_arn

  skip_final_snapshot  = var.environment == "dev" ? true : false
}
```

**What is Encrypted:**
- All database storage volumes
- Automatic backups
- Read replicas (if created)
- Snapshot copies

**What is NOT Encrypted:**
- Data in transit between application and database (see Section 2)

**Key Rotation:**
- Managed automatically by AWS KMS
- Rotation policy: Annual (configurable)
- No manual rotation required

**Compliance:**
- ✅ HIPAA: EC2 and EBS encryption requirement
- ✅ NIST SP 800-53 SC-13: Cryptographic Protection
- ✅ SOC 2 Type II: Encryption of data at rest

**Verification:**
```bash
# Check if encryption is enabled
aws rds describe-db-instances \
  --db-instance-identifier pagerduty-lite-dev \
  --query 'DBInstances[0].StorageEncrypted'
```

---

### 1.2 S3 Bucket Encryption

**Standard:** Server-Side Encryption with AES-256

**Buckets and Configurations:**

#### 1.2.1 Web/Static Assets Bucket (`oncallshift-{env}-web`)

**Configuration:** Private bucket for static frontend assets served via CloudFront

**Location:** `infrastructure/terraform/environments/dev/main.tf` (lines 1096-1142)

**Encryption Status:**
- Explicitly configured: ❌ Not in current Terraform code
- AWS Default S3 Encryption: ✅ Applied automatically
- Encryption Type: AES-256 (default)

**Public Access:**
- Block all public access: Yes
- ACLs disabled: Yes
- Access method: CloudFront only (via Origin Access Control)

**Recommended Configuration (for explicit documentation):**
```hcl
resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
```

#### 1.2.2 Upload Bucket (`oncallshift-{env}-uploads`)

**Configuration:** Public upload bucket for user-generated content

**Location:** `infrastructure/terraform/environments/dev/main.tf` (lines 1047-1094)

**Encryption Status:**
- Explicitly configured: ❌ Not in current Terraform code
- AWS Default S3 Encryption: ✅ Applied automatically
- Encryption Type: AES-256 (default)

**Access Control:**
- Public read: Enabled (for uploaded files)
- Upload: Restricted (CORS from app domain only)

**Recommended Configuration (for explicit documentation):**
```hcl
resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
```

**Compliance Note:**
While AWS applies default AES-256 encryption to all S3 buckets, explicitly configuring encryption in Infrastructure-as-Code improves:
- Auditability (visible in Terraform state)
- Consistency (applies across all environments)
- Compliance documentation

**Recommendations for Future Implementation:**
1. Upgrade S3 upload bucket to use KMS encryption for sensitive files
2. Explicitly configure encryption in Terraform for clear audit trail
3. Enable S3 Object Lock for compliance buckets (if retention needed)

---

### 1.3 Terraform State Encryption

**Standard:** S3-side encryption for infrastructure state

**Configuration:**
- Location: `infrastructure/terraform/environments/dev/main.tf` (lines 15-20)
- Backend: S3
- Encryption enabled: Yes (`encrypt = true`)

```hcl
terraform {
  backend "s3" {
    bucket  = "oncallshift"
    key     = "terraform/dev/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true  # Enables server-side encryption for tfstate
  }
}
```

**What is Protected:**
- Infrastructure configurations
- Variable values
- Resource IDs and attributes
- Secrets references (not the secrets themselves)

**Key Management:**
- AWS KMS default key (aws/s3)
- Rotation managed by AWS
- No manual management required

---

### 1.4 Application Secret Encryption

**Standard:** AES-256-GCM with per-organization derived keys

**Primary Use Case:** Cloud credentials (AWS, Azure, GCP, Anthropic API keys)

**Implementation Details:**

#### 1.4.1 Encryption Service Architecture

**File:** `backend/src/shared/services/credential-encryption-service.ts`

**Algorithm:** AES-256-GCM
- **Key Size:** 256 bits
- **IV Length:** 16 bytes (128 bits)
- **Authentication Tag:** 16 bytes
- **Salt:** 32 bytes (random per encryption)
- **Key Derivation:** SCRYPT with salt

**Encryption Process:**

```typescript
// 1. Encryption Key Storage
const masterKey = process.env.CREDENTIAL_ENCRYPTION_KEY ||
  (await getSecretFromAWSSecretsManager('credential-encryption-key'));

// 2. Encryption (for each credential)
const salt = crypto.randomBytes(32);  // Random salt for each encryption
const iv = crypto.randomBytes(16);     // Random IV for each encryption

// Derive key using SCRYPT
const key = crypto.scryptSync(masterKey, salt, 32);

// Encrypt credential
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([
  cipher.update(credentialData, 'utf8'),
  cipher.final()
]);

// Get authentication tag
const authTag = cipher.getAuthTag();

// Store as: salt|iv|authTag|ciphertext (base64 encoded)
const encrypted_data = Buffer.concat([salt, iv, authTag, encrypted]).toString('base64');
```

**Decryption Process:**

```typescript
// 1. Parse encrypted data
const data = Buffer.from(encrypted_data, 'base64');
const salt = data.slice(0, 32);
const iv = data.slice(32, 48);
const authTag = data.slice(48, 64);
const ciphertext = data.slice(64);

// 2. Derive key using same salt
const key = crypto.scryptSync(masterKey, salt, 32);

// 3. Decrypt
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);
const decrypted = Buffer.concat([
  decipher.update(ciphertext),
  decipher.final()
]).toString('utf8');
```

#### 1.4.2 Secondary Encryption Service (HKDF-based)

**File:** `backend/src/shared/services/credential-encryption.ts`

**Algorithm:** AES-256-GCM with HKDF key derivation
- **Key Derivation:** HKDF-SHA256
- **Per-Organization Keys:** Each organization derives unique key from master
- **Prevents Cross-Org Access:** Compromised key cannot decrypt other orgs' secrets

**Implementation:**

```typescript
// Per-organization key derivation
const orgKey = hkdf(
  'sha256',
  masterKey,
  organizationId,  // Used as salt/info
  32
);

// Format: iv:authTag:ciphertext (base64 encoded)
const encrypted = `${iv}:${authTag}:${ciphertext}`;
```

**Benefits Over SCRYPT Service:**
- ✅ Per-organization key isolation
- ✅ Deterministic (same org → same key)
- ✅ Faster key derivation (HKDF vs SCRYPT)
- ✅ Standard NIST algorithm

#### 1.4.3 Protected Data Models

**Cloud Credentials Model**
- File: `backend/src/shared/models/CloudCredential.ts`
- Column: `credentials_encrypted` (type: TEXT)

**Encrypted Fields:**
- AWS access keys (id, secret)
- Azure credentials (client_id, client_secret, tenant_id)
- GCP service account JSON
- Anthropic API keys

**Access Control:**
- File: `backend/src/api/routes/cloud-credentials.ts`
- Only organization admins can create/update
- Credentials are never returned to clients (only metadata)

---

## Data Encryption in Transit

### 2.1 TLS/SSL Configuration

**Standard:** TLS 1.2+ enforced globally

#### 2.1.1 Application Load Balancer (ALB)

**HTTPS Listener Configuration**

- File: `infrastructure/terraform/environments/dev/main.tf` (lines 137-156)
- Protocol: HTTPS (TCP 443)
- TLS Version: TLS 1.2+
- SSL Policy: `ELBSecurityPolicy-TLS13-1-2-2021-06`

```hcl
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.main.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
```

**Supported Protocols:**
- ✅ TLS 1.3
- ✅ TLS 1.2
- ❌ TLS 1.1 (disabled)
- ❌ TLS 1.0 (disabled)
- ❌ SSL 3.0 (disabled)

**Supported Ciphers (from policy):**
- All AEAD ciphers with forward secrecy
- Requires ECDHE key exchange
- No MD5 or SHA-1 based ciphers

**Certificate Management**

- Provider: AWS Certificate Manager (ACM)
- Domain: `oncallshift.com` (wildcard support)
- Validation: DNS (Route53 records)
- Auto-renewal: Enabled
- Expiration alerts: Automatic

**HTTP to HTTPS Redirect: ⚠️ GAP**

- File: `infrastructure/terraform/environments/dev/main.tf` (lines 123-132)
- Current behavior: HTTP listener forwards directly to API
- **Recommended fix:** Redirect HTTP → HTTPS (301)

```hcl
# Recommended configuration
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

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

---

#### 2.1.2 CloudFront Distribution

**HTTPS Configuration**

- File: `infrastructure/terraform/environments/dev/main.tf` (lines 1200-1315)
- Viewer Protocol Policy: HTTPS only (redirect HTTP to HTTPS)
- Minimum TLS Version: TLSv1.2_2021
- Certificate Provider: ACM

```hcl
# Viewer protocol enforcement
viewer_protocol_policy = "redirect-to-https"  # HTTP → HTTPS redirect

# Cache behavior HTTPS enforcement
cached_behavior {
  viewer_protocol_policy = "redirect-to-https"
}

# TLS version minimum
minimum_protocol_version = "TLSv1.2_2021"

# Certificate configuration
certificate_arn          = aws_acm_certificate.main.arn
ssl_support_method       = "sni-only"
```

**Origin Access Control (for S3)**

- Signing Protocol: SigV4 (AWS Signature Version 4)
- Purpose: Authenticates CloudFront requests to S3
- Result: Public S3 bucket is not accessible except via CloudFront

```hcl
origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
signing_protocol         = "sigv4"
```

**Benefits:**
- ✅ Application logic doesn't handle SSL/TLS
- ✅ Centralized certificate management
- ✅ DDoS protection via AWS Shield Standard
- ✅ SSL/TLS offloading reduces server load

---

#### 2.1.3 RDS Database Connection Encryption

**Current Status:** ⚠️ Partial Implementation

**File:** `backend/src/shared/db/data-source.ts` (line 86)

**Current Configuration:**

```typescript
// Current (permissive - allows MITM)
ssl: dbConfig.ssl ? {
  rejectUnauthorized: false  // SECURITY GAP
} : false
```

**Issues:**
1. Certificate validation disabled (`rejectUnauthorized: false`)
2. Allows man-in-the-middle attacks
3. Falls back to unencrypted if ssl parameter not set

**Recommended Configuration:**

```typescript
// Recommended (secure)
ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? {
  rejectUnauthorized: true,      // Enforce valid certificate
  ca: process.env.RDS_CA_CERT,   // Use AWS RDS CA certificate
} : false
```

**Enable SSL in DATABASE_URL:**

```
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

**RDS Parameter Group Configuration:**

```hcl
parameter {
  name  = "rds.force_ssl"
  value = "1"  # Force SSL for all connections
}
```

---

### 2.2 Application Internal Communication

**Service-to-Service Encryption:**

| Connection | Protocol | TLS | Status |
|-----------|----------|-----|--------|
| ALB → API Container | HTTP | No | ✅ Internal AWS network |
| API → RDS Database | TCP | Yes | ⚠️ Permissive validation |
| API → SQS | HTTPS | Yes | ✅ AWS SDK default |
| API → Secrets Manager | HTTPS | Yes | ✅ AWS SDK default |
| API → CloudWatch Logs | HTTPS | Yes | ✅ AWS SDK default |
| API → S3 | HTTPS | Yes | ✅ AWS SDK default |

**Justification for HTTP to RDS:**
- RDS is in private VPC subnet (not internet accessible)
- Connection encrypted by requiring application to use sslmode=require
- Should be upgraded to enforce certificate validation

---

## Key Management

### 3.1 Master Key Storage

**Primary Storage:** AWS Secrets Manager

**Secrets Managed:**

| Secret Name | Purpose | Rotation | Access |
|------------|---------|----------|--------|
| `pagerduty-lite-dev-db-password` | Database credentials | Annual | ECS tasks |
| `pagerduty-lite-dev-credential-encryption-key` | Credential encryption master key | Annual | API servers |
| `pagerduty-lite-dev-anthropic-api-key` | Claude API access | Manual | API servers |
| `pagerduty-lite-dev-github-token` | CI/CD GitHub access | Manual | GitHub Actions |
| `pagerduty-lite-dev-jira-webhook-secret` | Jira webhook validation | Manual | API servers |

**Backup Storage:** Environment Variables (for development only)

```bash
# Development only - AWS Secrets Manager preferred for production
CREDENTIAL_ENCRYPTION_KEY=<master-key>
DATABASE_URL=postgres://...
```

**Key Rotation Policy:**

| Key Type | Rotation Frequency | Process |
|----------|-------------------|---------|
| Database Password | Annually | Manual via AWS Secrets Manager |
| Credential Encryption Key | Annually | Requires re-encryption (see Section 3.2) |
| Anthropic API Key | On compromise | Manual replacement |
| TLS Certificates | Auto-renew | AWS ACM automatic renewal |

---

### 3.2 Credential Re-encryption During Master Key Rotation

**Scenario:** Master key rotation for `CREDENTIAL_ENCRYPTION_KEY`

**Process:**

1. **Create new master key** in AWS Secrets Manager
2. **Maintain old key temporarily** (dual-key support)
3. **Re-encrypt all credentials:**
   ```typescript
   // Batch re-encryption process
   const credentials = await CloudCredential.find();

   for (const cred of credentials) {
     // Decrypt with old key
     const decrypted = decryptWithKey(cred.credentials_encrypted, oldKey);

     // Re-encrypt with new key
     const reencrypted = encryptWithKey(decrypted, newKey);

     // Update database
     await CloudCredential.update({
       credentials_encrypted: reencrypted
     });
   }
   ```
4. **Verify all decryption still works**
5. **Update Secrets Manager to new key only**
6. **Remove old key after verification period** (e.g., 30 days)

**Zero-Downtime Approach:**
- Application supports reading with old key if new key fails
- Deploy updated key value to application gradually
- Monitor decryption failures
- Switch to new key after confidence period

---

### 3.3 Key Access Control

**AWS IAM Policies for Key Access**

**RDS Encryption Key (KMS):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "rds.amazonaws.com"
      },
      "Action": "kms:*",
      "Resource": "arn:aws:kms:*:*:key/*"
    },
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::*:role/pagerduty-lite-dev-ecs-task-role"
      },
      "Action": [
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:CreateGrant"
      ],
      "Resource": "arn:aws:kms:us-east-1:*:key/*"
    }
  ]
}
```

**Secrets Manager Access:**

```json
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue",
    "secretsmanager:DescribeSecret"
  ],
  "Resource": [
    "arn:aws:secretsmanager:us-east-1:*:secret:pagerduty-lite-dev-*"
  ]
}
```

---

## Credential Encryption

### 4.1 Cloud Credentials Encryption

**Purpose:** Protect cloud provider credentials and API keys at rest

**Model Location:** `backend/src/shared/models/CloudCredential.ts`

**Supported Providers:**

```typescript
enum CloudProvider {
  AWS = 'aws',
  AZURE = 'azure',
  GCP = 'gcp',
}
```

**Encrypted Fields by Provider:**

**AWS:**
```typescript
{
  accessKeyId: string,        // Encrypted
  secretAccessKey: string,    // Encrypted
  region?: string             // Not encrypted (not sensitive)
}
```

**Azure:**
```typescript
{
  clientId: string,           // Encrypted
  clientSecret: string,       // Encrypted ← Most sensitive
  tenantId: string,           // Encrypted
  subscriptionId: string      // Not encrypted
}
```

**GCP:**
```typescript
{
  serviceAccount: {           // Entire JSON encrypted
    type: string,
    project_id: string,
    private_key_id: string,
    private_key: string,      // Encrypted
    client_email: string,
    client_id: string,
    auth_uri: string,
    token_uri: string
  }
}
```

### 4.2 Anthropic API Key Encryption

**File:** `backend/src/api/routes/ai-assistant.ts`

**Storage:** CloudCredential model with provider = 'anthropic'

**Encryption:** AES-256-GCM with org-derived key

**Usage:**
- Encrypted in database
- Decrypted only when making Claude API calls
- Never logged or returned in API responses

---

## Infrastructure Encryption

### 5.1 Network Segmentation

**VPC Architecture:**

| Component | Network | Encryption | Internet Access |
|-----------|---------|-----------|-----------------|
| CloudFront | AWS edge locations | TLS 1.2+ | Public |
| ALB | Public subnets | TLS 1.2+ | Public |
| ECS Tasks (API) | Private subnets | N/A (internal) | Through NAT Gateway |
| RDS | Private subnets | AES-256 (storage) | No direct access |

**Benefits:**
- ✅ Database never exposed to internet
- ✅ RDS can require SSL without external attacks
- ✅ All inbound to RDS must be from ECS tasks

### 5.2 ECS Task Encryption

**Encrypted Configuration:**

```hcl
resource "aws_ecs_task_definition" "api" {
  # Task role (for accessing AWS services)
  task_role_arn      = aws_iam_role.ecs_task_role.arn
  execution_role_arn = aws_iam_role.ecs_task_execution_role.arn

  # Environment variables encrypted at rest by ECS
  container_definitions = jsonencode([{
    name      = "api"
    image     = "${var.ecr_registry}/${var.ecr_api_repo}:${var.image_tag}"

    # Secrets from Secrets Manager
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = aws_secretsmanager_secret.db_password.arn
      },
      {
        name      = "CREDENTIAL_ENCRYPTION_KEY"
        valueFrom = aws_secretsmanager_secret.encryption_key.arn
      }
    ]
  }])
}
```

**How Secrets Are Injected:**
1. ECS retrieves secret value from Secrets Manager
2. Injects as environment variable into container
3. Secret is NOT stored in task definition (only reference)
4. Container has access only to decrypted value

---

## Compliance Mapping

### 6.1 HIPAA Compliance

| Control | Requirement | Implementation | Status |
|---------|-------------|-----------------|--------|
| **§164.312(a)(2)(i)** | Encryption of data at rest | RDS encryption + credential encryption | ✅ Compliant |
| **§164.312(a)(2)(ii)** | Encryption of data in transit | TLS 1.2+ for all external connections | ⚠️ Partial |
| **§164.308(a)(4)** | Encryption key management | AWS KMS + AWS Secrets Manager | ✅ Compliant |
| **§164.308(a)(1)** | Audit controls | CloudWatch Logs + CloudTrail | ✅ Compliant |
| **§164.312(b)** | Audit controls implementation | Request ID tracking + error logging | ⚠️ In progress |

**Gaps:**
- Database SSL validation needs enforcement (see Section 2.1.3)
- HTTP → HTTPS redirect missing on ALB (see Section 2.1.1)

---

### 6.2 NIST SP 800-53 Mapping

| Control | Family | Implementation | Status |
|---------|--------|-----------------|--------|
| **SC-13** | Cryptographic Protection | AES-256-GCM, TLS 1.2+ | ✅ Compliant |
| **SC-7** | Boundary Protection | VPC isolation, security groups | ✅ Compliant |
| **SC-28** | Protection of Information at Rest | Storage encryption enabled | ✅ Compliant |
| **SC-29** | Heterogeneity | Multiple encryption methods | ✅ Compliant |
| **SC-40** | Wireless Access | N/A | N/A |
| **AU-2** | Audit Events | CloudWatch Logs configured | ✅ Compliant |

---

### 6.3 SOC 2 Type II Controls

| Trust Service Category | Control | Implementation | Status |
|------------------------|---------|-----------------|--------|
| **CC6.1** | Logical access controls | IAM policies + authentication | ✅ Compliant |
| **CC6.7** | Encryption of sensitive data | AES-256, TLS 1.2+ | ✅ Compliant |
| **CC7.1** | Monitoring changes | CloudTrail + CloudWatch | ✅ Compliant |
| **CC9.1** | Security change procedures | Terraform IaC | ✅ Compliant |

---

## Operational Procedures

### 7.1 Emergency Key Recovery

**If Credential Encryption Master Key is Lost:**

1. **Stop all API servers** to prevent new encryptions with broken key
2. **Identify affected credentials:**
   ```bash
   SELECT COUNT(*) FROM cloud_credentials
   WHERE created_at > '<date-key-rotated>'
   ```
3. **Options:**
   - **A) Full recovery with backup:** Restore from RDS backup before key loss
   - **B) Request users to re-add credentials:** Notify organizations to update cloud credentials

4. **Implement new key:**
   - Create new key in AWS Secrets Manager
   - Update `CREDENTIAL_ENCRYPTION_KEY` environment variable
   - Restart API servers
   - Notify users which credentials need updating

5. **Prevention:**
   - AWS Secrets Manager provides automatic backup
   - Enable MFA Delete on master key
   - Store backup in separate AWS account

---

### 7.2 Monitoring Encryption Health

**CloudWatch Metrics to Monitor:**

```bash
# Monitor KMS key usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/KMS \
  --metric-name UserErrorCount \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum

# Monitor Secrets Manager access
aws cloudwatch get-metric-statistics \
  --namespace AWS/SecretsManager \
  --metric-name SecretCount \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-02T00:00:00Z \
  --period 86400 \
  --statistics Average
```

**Alerts to Configure:**

| Alert | Condition | Action |
|-------|-----------|--------|
| RDS KMS key errors | `UserErrorCount > 10` in 1 hour | Page on-call |
| Failed secret retrieval | `SecretFetchFailures > 5` in 5 min | Page on-call |
| TLS certificate expiration | < 30 days | Manual renewal |
| High decryption latency | > 100ms p95 | Investigate performance |

---

### 7.3 Encryption Audit Log Format

**Sample Log Entry (CloudWatch Logs):**

```json
{
  "timestamp": "2025-01-04T12:30:45.123Z",
  "requestId": "req-abc123def456",
  "event": "credential_encrypted",
  "organizationId": "org-xyz789",
  "userId": "user-abc123",
  "cloudProvider": "aws",
  "action": "create",
  "encryptionAlgorithm": "aes-256-gcm",
  "keyDerivation": "hkdf-sha256",
  "status": "success",
  "duration_ms": 45
}
```

**Audit Trail Queries:**

```sql
-- Find all credential creations by org
SELECT timestamp, userId, cloudProvider, action
FROM logs
WHERE event = 'credential_encrypted'
AND organizationId = 'org-xyz789'
ORDER BY timestamp DESC;

-- Monitor encryption failures
SELECT timestamp, organizationId, error
FROM logs
WHERE event = 'credential_encrypted'
AND status = 'failure'
LIMIT 100;
```

---

### 7.4 Regular Security Testing

**Quarterly Encryption Verification:**

```bash
#!/bin/bash
# Verify RDS encryption is enabled
aws rds describe-db-instances \
  --db-instance-identifier pagerduty-lite-dev \
  --query 'DBInstances[0].[DBInstanceIdentifier,StorageEncrypted,KmsKeyId]' \
  --output table

# Verify S3 bucket encryption
aws s3api get-bucket-encryption \
  --bucket oncallshift-dev-web

# Verify TLS on ALB
aws elbv2 describe-listeners \
  --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:*:loadbalancer/app/* \
  --query 'Listeners[*].[Port,Protocol,Certificates]' \
  --output table

# Test database SSL requirement
psql -h pagerduty-lite-dev.rds.amazonaws.com \
  --sslmode=require \
  -U pgadmin \
  -d pagerduty_lite \
  -c "SHOW sslmode;"
```

---

## Appendix: Encryption Algorithms Reference

### A1. AES-256-GCM

- **Full Name:** Advanced Encryption Standard with 256-bit key in Galois/Counter Mode
- **Use Cases:** Credential storage, application secrets
- **Key Size:** 256 bits (32 bytes)
- **IV Size:** 128 bits (16 bytes) - random per encryption
- **Authentication Tag:** 128 bits (16 bytes) - prevents tampering
- **NIST Approval:** Yes (SP 800-38D)
- **Performance:** ~1000-5000 encryptions/second on modern CPU

### A2. SCRYPT

- **Full Name:** Key derivation function based on memory-hard algorithm
- **Use Cases:** Converting passwords/seeds into encryption keys
- **Parameters:**
  - N=16384 (CPU/memory cost)
  - r=8 (block size)
  - p=1 (parallelization)
- **Output:** 256-bit derived key
- **Security:** Resistant to GPU/ASIC attacks due to memory requirements
- **Performance:** ~50-100ms per derivation

### A3. HKDF-SHA256

- **Full Name:** HMAC-based Key Derivation Function with SHA-256
- **Use Cases:** Per-organization key derivation
- **Input:** Master key + organization ID
- **Output:** 256-bit organization-specific key
- **Performance:** <1ms per derivation
- **NIST Approval:** Yes (SP 800-56C)

### A4. TLS 1.2 & 1.3

- **Purpose:** Encrypted communication between client and server
- **Handshake:** Elliptic Curve Diffie-Hellman (ECDHE) key exchange
- **Record Encryption:** AES-GCM or ChaCha20-Poly1305
- **Forward Secrecy:** Yes (ephemeral key exchange)
- **Certificate Validation:** X.509 PKI via AWS Certificate Manager

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-04 | Initial comprehensive encryption documentation |

---

## Document Approval

**Status:** Ready for HIPAA Compliance Review

**Recommended Reviews:**
1. Security team review of encryption implementations
2. Compliance officer validation of HIPAA mapping
3. Database team confirmation of RDS SSL enforcement plan
4. Infrastructure team approval of key management procedures

---

*This document should be reviewed and updated quarterly or after significant encryption-related changes. All encryption implementations are subject to regular security audits and penetration testing.*
