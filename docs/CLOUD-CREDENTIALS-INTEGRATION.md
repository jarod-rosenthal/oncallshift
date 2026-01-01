# Cloud Credentials Integration for Claude Code Analysis
**Enable Claude Code to investigate and remediate incidents in customer cloud environments**

---

## Executive Summary

Integrate secure cloud credential storage into OnCallShift, allowing Claude Code to directly access customer AWS/Azure/GCP environments for:
- **Incident analysis**: Query logs, metrics, resource status
- **Root cause investigation**: Analyze configuration, network connectivity, service health
- **Automated remediation**: Restart services, scale resources, update configurations (with approval)

**Security-first approach**: Read-only by default, time-limited credentials, audit logging, explicit user approval for write operations.

---

## Part 1: Cloud Provider CLI Capabilities

### What Claude Code Can Already Do

Claude Code has access to the **Bash tool**, which can execute:

#### AWS CLI
```bash
# List EC2 instances with issues
aws ec2 describe-instances --filters "Name=instance-state-name,Values=stopped,stopping"

# Query CloudWatch logs for errors
aws logs filter-log-events --log-group-name /aws/lambda/my-function \
  --filter-pattern "ERROR" --start-time 1640000000000

# Get ECS service status
aws ecs describe-services --cluster prod-cluster --services api-service

# Check RDS database status
aws rds describe-db-instances --db-instance-identifier prod-db

# Get Application Load Balancer health
aws elbv2 describe-target-health --target-group-arn arn:aws:...
```

#### Azure CLI
```bash
# List VMs with issues
az vm list --query "[?provisioningState=='Failed']"

# Get App Service logs
az webapp log tail --name my-app --resource-group my-rg

# Check Azure SQL database status
az sql db show --name mydb --server myserver --resource-group my-rg

# Get Application Insights logs
az monitor app-insights query --app my-app --analytics-query "exceptions | take 100"
```

#### Google Cloud CLI (gcloud)
```bash
# List compute instances
gcloud compute instances list --filter="status:TERMINATED"

# Get Cloud Run service logs
gcloud logging read "resource.type=cloud_run_revision" --limit 100

# Check GKE cluster status
gcloud container clusters describe my-cluster --zone us-central1-a

# Get Cloud SQL status
gcloud sql instances describe my-instance
```

### What This Enables

**Example Incident Flow:**
1. Alert comes in: "Production API 500 errors spiking"
2. User clicks "Analyze with Claude" on incident
3. Claude Code (with AWS CLI access):
   - Checks ECS task health
   - Queries CloudWatch logs for stack traces
   - Checks RDS connection pool status
   - Analyzes recent deployments
   - Checks Auto Scaling group health
4. Claude provides: Root cause + recommended fix
5. User approves → Claude executes fix (restart tasks, rollback deployment, scale up)

---

## Part 2: Database Schema

### Cloud Credential Storage

```sql
-- Migration: 030_add_cloud_credentials.sql

CREATE TABLE cloud_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Cloud provider
    provider VARCHAR(20) NOT NULL, -- 'aws', 'azure', 'gcp'
    name VARCHAR(255) NOT NULL, -- User-friendly name (e.g., "Production AWS Account")
    description TEXT,

    -- Credential data (encrypted)
    credentials_encrypted TEXT NOT NULL, -- JSON encrypted with org-specific key

    -- Access control
    permission_level VARCHAR(20) DEFAULT 'read_only', -- 'read_only', 'read_write'
    allowed_services JSONB DEFAULT '[]'::jsonb, -- ['ec2', 'rds', 'logs'] or empty = all

    -- Time-based restrictions
    max_session_duration_minutes INT DEFAULT 60,
    require_approval_for_write BOOLEAN DEFAULT true,

    -- Audit trail
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_used_at TIMESTAMP,
    last_used_by UUID REFERENCES users(id) ON DELETE SET NULL,
    usage_count INT DEFAULT 0,

    -- Status
    enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(org_id, provider, name)
);

-- Audit log for Claude Code cloud access
CREATE TABLE cloud_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    credential_id UUID NOT NULL REFERENCES cloud_credentials(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,

    -- Who triggered the access
    triggered_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

    -- What was accessed
    provider VARCHAR(20) NOT NULL,
    commands_executed JSONB NOT NULL, -- Array of commands

    -- Results
    success BOOLEAN DEFAULT true,
    error_message TEXT,

    -- Timing
    session_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_ended_at TIMESTAMP,
    duration_seconds INT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cloud_credentials_org ON cloud_credentials(org_id, enabled);
CREATE INDEX idx_cloud_credentials_provider ON cloud_credentials(org_id, provider);
CREATE INDEX idx_cloud_access_logs_org ON cloud_access_logs(org_id);
CREATE INDEX idx_cloud_access_logs_incident ON cloud_access_logs(incident_id);
CREATE INDEX idx_cloud_access_logs_triggered_by ON cloud_access_logs(triggered_by);
CREATE INDEX idx_cloud_access_logs_created ON cloud_access_logs(created_at);
```

### Credential Encryption Strategy

**Use AWS Secrets Manager / Azure Key Vault / Google Secret Manager:**
- Store a master encryption key in cloud provider's secret service
- Encrypt each org's credentials with org-specific derived key
- Never store plaintext credentials in database
- Rotate encryption keys quarterly

**Alternative (simpler for MVP):**
- Store master key in environment variable (`CREDENTIAL_ENCRYPTION_KEY`)
- Use AES-256-GCM encryption
- Derive per-org keys using HKDF

---

## Part 3: Backend API Endpoints

### Cloud Credentials Management

```typescript
// POST /api/v1/cloud-credentials
// Create new cloud credential
{
  "provider": "aws",
  "name": "Production AWS Account",
  "description": "Main production environment",
  "credentials": {
    "aws_access_key_id": "AKIA...",
    "aws_secret_access_key": "...",
    "aws_region": "us-east-1",
    // OR for role-based:
    "aws_role_arn": "arn:aws:iam::123456789:role/OnCallShiftReadOnly",
    "external_id": "unique-external-id"
  },
  "permission_level": "read_only",
  "allowed_services": ["ec2", "ecs", "rds", "logs", "cloudwatch"],
  "max_session_duration_minutes": 30
}

// GET /api/v1/cloud-credentials
// List all cloud credentials for organization
{
  "cloud_credentials": [
    {
      "id": "uuid",
      "provider": "aws",
      "name": "Production AWS Account",
      "description": "Main production environment",
      "permission_level": "read_only",
      "allowed_services": ["ec2", "ecs", "rds", "logs"],
      "enabled": true,
      "last_used_at": "2026-01-01T02:00:00Z",
      "created_at": "2025-12-01T00:00:00Z",
      // Note: credentials are never returned
    }
  ]
}

// PUT /api/v1/cloud-credentials/:id
// Update credential (excluding credentials themselves - must delete and recreate for security)

// DELETE /api/v1/cloud-credentials/:id
// Delete cloud credential

// POST /api/v1/cloud-credentials/:id/test
// Test credential validity
{
  "status": "success",
  "message": "Successfully authenticated to AWS",
  "account_id": "123456789012",
  "permissions_verified": ["ec2:DescribeInstances", "logs:FilterLogEvents"]
}

// POST /api/v1/cloud-credentials/:id/rotate
// Rotate credentials (for providers that support it)
```

### Claude Code Integration Endpoints

```typescript
// POST /api/v1/incidents/:id/claude-analyze
// Trigger Claude Code analysis with cloud access
{
  "credential_id": "uuid", // Optional - use default if not specified
  "analysis_prompt": "Investigate why the API is returning 500 errors", // Optional
  "include_cloud_access": true
}

// Response:
{
  "session_id": "uuid",
  "status": "analyzing", // or "completed", "failed"
  "analysis": "...", // Claude's findings
  "commands_executed": [
    "aws ecs describe-services --cluster prod --services api",
    "aws logs filter-log-events --log-group-name /ecs/api --filter-pattern ERROR"
  ],
  "recommendations": [
    {
      "title": "Restart ECS tasks",
      "description": "Tasks are in unhealthy state, restart recommended",
      "severity": "high",
      "requires_approval": true,
      "command": "aws ecs update-service --cluster prod --service api --force-new-deployment"
    }
  ]
}

// POST /api/v1/incidents/:id/claude-remediate
// Execute Claude's recommended remediation (requires approval)
{
  "session_id": "uuid",
  "action_index": 0, // Which recommendation to execute
  "approved_by": "user-id"
}
```

---

## Part 4: UI Design

### Settings Page: Cloud Credentials

**Location**: `/settings/cloud-credentials`

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings > Cloud Credentials                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔐 Cloud Provider Credentials                                 │
│  Connect your cloud accounts to enable Claude Code to          │
│  investigate and remediate incidents automatically.            │
│                                                                 │
│  [+ Add Cloud Credential]                                      │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ AWS                                                     │   │
│  │ Production AWS Account                                  │   │
│  │ Main production environment                             │   │
│  │                                                          │   │
│  │ 🟢 Active  •  Read Only  •  Last used 2 hours ago      │   │
│  │                                                          │   │
│  │ Allowed Services: EC2, ECS, RDS, CloudWatch Logs       │   │
│  │ Session Duration: 30 minutes                            │   │
│  │                                                          │   │
│  │ [Test Connection] [Edit] [Delete]                      │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Azure                                                   │   │
│  │ Production Subscription                                 │   │
│  │ Azure production resources                              │   │
│  │                                                          │   │
│  │ 🟢 Active  •  Read Only  •  Last used 1 day ago        │   │
│  │                                                          │   │
│  │ [Test Connection] [Edit] [Delete]                      │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Add Cloud Credential Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Add Cloud Credential                                      [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Choose Provider                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │   AWS    │  │  Azure   │  │   GCP    │                    │
│  │  [☑]     │  │  [ ]     │  │  [ ]     │                    │
│  └──────────┘  └──────────┘  └──────────┘                    │
│                                                                 │
│  Step 2: Authentication Method                                 │
│  ○ IAM Access Keys (not recommended for production)            │
│  ● IAM Role (recommended) ✓                                    │
│                                                                 │
│  Credential Name *                                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Production AWS Account                                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Description                                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Main production environment                              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  IAM Role ARN *                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ arn:aws:iam::123456789012:role/OnCallShiftReadOnly     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  External ID *                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ oncallshift-prod-external-id                            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  📘 How to set up IAM Role [View Guide]                        │
│                                                                 │
│  Step 3: Permissions                                            │
│  Permission Level                                               │
│  ● Read Only (recommended)                                      │
│  ○ Read + Write (requires approval for write operations)       │
│                                                                 │
│  Allowed Services (leave empty for all)                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ [×] EC2  [×] ECS  [×] RDS  [×] CloudWatch Logs          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Max Session Duration                                           │
│  ┌─────┐ minutes                                               │
│  │ 30  │                                                        │
│  └─────┘                                                        │
│                                                                 │
│  ☑ Require approval for write operations                       │
│                                                                 │
│  [Cancel]                              [Test & Save]           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Incident Detail Page: Claude Analysis Integration

**New section on incident detail page:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Incident #123: Production API 500 Errors                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🤖 AI-Powered Analysis                                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │  Let Claude Code investigate this incident by accessing │  │
│  │  your cloud environment.                                 │  │
│  │                                                          │  │
│  │  Cloud Credentials:                                      │  │
│  │  ┌────────────────────────────────────────────────┐     │  │
│  │  │ [v] Production AWS Account (Read Only)         │     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  │                                                          │  │
│  │  Additional Context (optional):                          │  │
│  │  ┌────────────────────────────────────────────────┐     │  │
│  │  │ Focus on ECS tasks and RDS connection pool     │     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  │                                                          │  │
│  │  [🔍 Analyze with Cloud Access]                         │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ⏳ Analysis in Progress...                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  [████████░░░░░░░░░░░░░░░░░░] 40%                       │  │
│  │                                                          │  │
│  │  ✓ Connected to AWS                                     │  │
│  │  ✓ Queried ECS service status                           │  │
│  │  ⏳ Analyzing CloudWatch logs...                         │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ✅ Analysis Complete                                          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  🔍 Root Cause Found                                     │  │
│  │                                                          │  │
│  │  Claude analyzed 347 log entries and found:             │  │
│  │                                                          │  │
│  │  • ECS tasks are running out of memory (OOM kills)      │  │
│  │  • RDS connection pool is exhausted (max 100)           │  │
│  │  • Recent deployment increased memory usage by 40%      │  │
│  │                                                          │  │
│  │  Evidence:                                               │  │
│  │  • 23 OOM events in past hour                           │  │
│  │  • RDS max_connections reached at 14:32 UTC            │  │
│  │  • Memory usage: 1.8GB / 2GB (90%)                      │  │
│  │                                                          │  │
│  │  Executed Commands:                                      │  │
│  │  $ aws ecs describe-services --cluster prod ...         │  │
│  │  $ aws logs filter-log-events --filter-pattern "OOM" ...│  │
│  │  $ aws rds describe-db-instances --db-instance prod-db  │  │
│  │  [View Full Analysis]                                    │  │
│  │                                                          │  │
│  │  💡 Recommended Actions                                  │  │
│  │  ┌────────────────────────────────────────────────┐     │  │
│  │  │ 1. Increase ECS task memory to 4GB             │     │  │
│  │  │    Priority: High                               │     │  │
│  │  │    [Approve & Execute] [View Details]          │     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  │  ┌────────────────────────────────────────────────┐     │  │
│  │  │ 2. Increase RDS max_connections to 200         │     │  │
│  │  │    Priority: High                               │     │  │
│  │  │    [Approve & Execute] [View Details]          │     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  │  ┌────────────────────────────────────────────────┐     │  │
│  │  │ 3. Rollback to previous deployment             │     │  │
│  │  │    Priority: Medium (alternative solution)     │     │  │
│  │  │    [Approve & Execute] [View Details]          │     │  │
│  │  └────────────────────────────────────────────────┘     │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Approval Modal for Write Operations

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Approve Cloud Action                                   [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  You are about to execute a write operation in your cloud      │
│  environment.                                                   │
│                                                                 │
│  Action: Increase ECS task memory to 4GB                       │
│                                                                 │
│  Provider: AWS                                                  │
│  Account: Production AWS Account (123456789012)                │
│  Region: us-east-1                                              │
│                                                                 │
│  Command to Execute:                                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ aws ecs update-service \                                 │  │
│  │   --cluster prod-cluster \                               │  │
│  │   --service api-service \                                │  │
│  │   --task-definition api-task:latest \                    │  │
│  │   --memory 4096                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Expected Impact:                                               │
│  • ECS will redeploy all tasks with new memory limit           │
│  • Brief service interruption during rolling update (~2 min)   │
│  • Tasks will have more memory to prevent OOM                  │
│                                                                 │
│  Risk Level: 🟡 Medium                                         │
│                                                                 │
│  Rollback Plan:                                                 │
│  If issues occur, Claude can revert to previous memory limit   │
│  with a similar command.                                        │
│                                                                 │
│  Confirmation:                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ I understand this will modify cloud resources           │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ☑ I have reviewed the command and approve execution          │
│                                                                 │
│  [Cancel]                              [✓ Approve & Execute]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Security Best Practices

### 1. Principle of Least Privilege

**Read-Only by Default:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "ecs:Describe*",
        "rds:Describe*",
        "logs:FilterLogEvents",
        "logs:GetLogEvents",
        "cloudwatch:GetMetric*",
        "autoscaling:Describe*"
      ],
      "Resource": "*"
    }
  ]
}
```

**Read + Write (Restricted):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "ecs:Describe*",
        "ecs:UpdateService",
        "ecs:RestartTask",
        "rds:Describe*",
        "rds:ModifyDBInstance",
        "autoscaling:SetDesiredCapacity"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Deny",
      "Action": [
        "*:Delete*",
        "iam:*",
        "organizations:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2. Time-Limited Sessions

- Generate temporary STS credentials (AWS) with 30-60 minute expiration
- Claude Code session ends when credentials expire
- User must re-authenticate for new analysis

### 3. Audit Trail

Log every command executed:
```typescript
{
  "timestamp": "2026-01-01T14:32:00Z",
  "user_id": "user-123",
  "incident_id": "inc-456",
  "provider": "aws",
  "command": "aws ecs describe-services --cluster prod --services api",
  "success": true,
  "duration_ms": 234
}
```

### 4. Role-Based Access Control

- Only admins can create/edit cloud credentials
- Regular users can trigger analysis (read-only)
- Write operations require admin approval

### 5. Encryption at Rest

- Encrypt credentials with AES-256-GCM
- Store encryption keys in AWS Secrets Manager / KMS
- Rotate keys quarterly

---

## Part 6: Example Claude Code Prompts

### Incident Investigation Prompt

When user clicks "Analyze with Cloud Access", send this prompt to Claude Code:

```
You are investigating a production incident for OnCallShift customer [ORG_NAME].

INCIDENT DETAILS:
- Incident #123: Production API 500 Errors
- Service: api-service (ECS)
- Triggered: 2026-01-01 14:30 UTC
- Severity: Critical
- Summary: API returning 500 errors at high rate (30% of requests)

CLOUD ACCESS:
You have read-only access to the AWS production account (123456789012) via AWS CLI.
Region: us-east-1

INVESTIGATION STEPS:
1. Check ECS service health:
   - Run: aws ecs describe-services --cluster prod-cluster --services api-service
   - Look for: unhealthy tasks, recent deployments, task failures

2. Check CloudWatch Logs:
   - Run: aws logs filter-log-events --log-group-name /ecs/api-service --filter-pattern "ERROR|500" --start-time [30 minutes ago]
   - Look for: stack traces, database errors, timeout errors

3. Check RDS database:
   - Run: aws rds describe-db-instances --db-instance-identifier prod-db
   - Look for: connection count, storage space, CPU usage

4. Check Auto Scaling:
   - Run: aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names api-asg
   - Look for: desired vs actual capacity, scaling events

5. Recent deployments:
   - Run: aws ecs describe-task-definition --task-definition api-task
   - Check: recent changes, environment variables, resource limits

ANALYSIS REQUIREMENTS:
- Provide root cause analysis
- Include evidence (command outputs, metrics, logs)
- Recommend specific remediation actions
- For each action, specify:
  - Command to execute
  - Expected impact
  - Risk level (low/medium/high)
  - Rollback plan

OUTPUT FORMAT:
{
  "root_cause": "Brief description",
  "evidence": ["Finding 1", "Finding 2", ...],
  "commands_executed": ["aws ecs ...", "aws logs ..."],
  "recommendations": [
    {
      "title": "Action title",
      "description": "What this does",
      "severity": "high|medium|low",
      "command": "aws ecs update-service ...",
      "requires_approval": true,
      "expected_impact": "2 minute rolling restart",
      "rollback_plan": "Run previous task definition"
    }
  ]
}

Begin investigation now.
```

### Automated Remediation Prompt (Post-Approval)

```
EXECUTE APPROVED REMEDIATION

USER APPROVAL:
- User: john@example.com
- Approved at: 2026-01-01 14:45 UTC
- Action: Increase ECS task memory to 4GB

COMMAND TO EXECUTE:
aws ecs update-service --cluster prod-cluster --service api-service --task-definition api-task:12 --memory 4096

REQUIREMENTS:
1. Execute the command
2. Monitor the deployment:
   - Check task health every 30 seconds
   - Verify new tasks reach "RUNNING" state
   - Confirm 500 errors decrease
3. If deployment fails:
   - Rollback to previous task definition
   - Report failure reason
4. Report final status

Execute now and provide status updates.
```

---

## Part 7: Implementation Roadmap

### Phase 1: Read-Only Analysis (2 weeks)

**Backend:**
- [ ] Create CloudCredential model
- [ ] Create CloudAccessLog model
- [ ] Implement credential encryption service
- [ ] Create cloud credentials API endpoints
- [ ] Create Claude Code integration endpoint

**Frontend:**
- [ ] Cloud credentials settings page
- [ ] Add cloud credential modal
- [ ] Test connection UI
- [ ] Incident detail "Analyze with Claude" button
- [ ] Analysis progress/results display

**Testing:**
- [ ] Test with AWS IAM role
- [ ] Test with Azure service principal
- [ ] Test with GCP service account
- [ ] Verify encryption/decryption
- [ ] Load test (100+ concurrent analyses)

### Phase 2: Write Operations (1 week)

**Backend:**
- [ ] Implement approval workflow
- [ ] Create remediation execution endpoint
- [ ] Add rollback capability
- [ ] Enhanced audit logging

**Frontend:**
- [ ] Approval modal for write operations
- [ ] Remediation execution status
- [ ] Rollback button
- [ ] Audit log viewer

### Phase 3: Advanced Features (2 weeks)

**Features:**
- [ ] Multi-cloud support (AWS + Azure + GCP in same analysis)
- [ ] Custom Claude prompts (user-defined investigation steps)
- [ ] Automated runbooks (trigger Claude analysis on specific incident types)
- [ ] Historical analysis (learn from past incidents)
- [ ] Cost optimization suggestions
- [ ] Security vulnerability detection

---

## Part 8: Customer Onboarding Guide

### AWS Setup Instructions

**For Read-Only Access:**

1. Create IAM Role in AWS Console:
   ```
   Role Name: OnCallShiftReadOnly
   Trust Policy: OnCallShift AWS Account (provided)
   Permissions: ReadOnlyAccess (AWS managed policy)
   External ID: [Generated by OnCallShift]
   ```

2. Copy Role ARN:
   ```
   arn:aws:iam::123456789012:role/OnCallShiftReadOnly
   ```

3. Add to OnCallShift:
   - Go to Settings > Cloud Credentials
   - Click "Add Cloud Credential"
   - Select AWS
   - Paste Role ARN and External ID
   - Test Connection
   - Save

**For Read + Write Access:**

Same as above, but use custom IAM policy with specific write permissions.

### Azure Setup Instructions

1. Create Service Principal:
   ```bash
   az ad sp create-for-rbac --name oncallshift-reader \
     --role Reader \
     --scopes /subscriptions/{subscription-id}
   ```

2. Copy credentials:
   - Application (client) ID
   - Directory (tenant) ID
   - Client secret

3. Add to OnCallShift (same as AWS flow)

### Google Cloud Setup Instructions

1. Create Service Account:
   ```bash
   gcloud iam service-accounts create oncallshift-reader \
     --display-name="OnCallShift Read-Only"

   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:oncallshift-reader@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/viewer"
   ```

2. Create key:
   ```bash
   gcloud iam service-accounts keys create key.json \
     --iam-account=oncallshift-reader@PROJECT_ID.iam.gserviceaccount.com
   ```

3. Upload key.json to OnCallShift

---

## Part 9: Revenue Impact

### Pricing Tier: Claude Code Cloud Access

**Add-on to existing plans:**
- **Starter**: Not available (Enterprise feature)
- **Professional**: $199/month per organization
- **Enterprise**: Included

**Value Proposition:**
- Reduce MTTR by 60% (from 45 min → 18 min avg)
- Automated root cause analysis
- One-click remediation
- 24/7 AI incident responder

**ROI Calculator:**
- If you have 50 incidents/month
- Average incident costs $2,000 in lost revenue/productivity
- Claude resolves 80% automatically
- **Savings**: 40 incidents × $2,000 = $80,000/month
- **Cost**: $199/month
- **ROI**: 400x

---

## Part 10: Competitive Differentiation

**vs PagerDuty:**
- PagerDuty has "Runbook Automation" but requires pre-defined runbooks
- OnCallShift: Claude adapts to any incident, learns from cloud state

**vs Opsgenie:**
- Opsgenie has basic integrations (alerts only)
- OnCallShift: Claude has full cloud access, can investigate + remediate

**vs FireHydrant:**
- FireHydrant focuses on incident management process
- OnCallShift: Claude focuses on technical root cause + automated fix

**Unique Value:**
- Only platform with AI that can directly access customer cloud environments
- Only platform with AI-powered remediation (not just alerts)
- Only platform where AI learns from actual cloud state (not just logs)

---

## Conclusion

**This feature transforms OnCallShift from "alert routing" to "AI-powered incident resolution platform".**

**Customer workflow:**
1. Alert fires → OnCallShift creates incident
2. User clicks "Analyze with Claude" → Claude investigates cloud environment
3. Claude identifies root cause in 2 minutes (vs 45 minutes manual)
4. Claude recommends fix → User approves → Claude executes
5. Incident resolved in 5 minutes total

**Market impact:**
- Charge $199/month premium (40% revenue increase)
- Target: DevOps teams at 500+ companies
- First AI-powered incident resolution platform with cloud access
- Defensible moat: Integration complexity + Claude's capabilities

**Implementation: 5 weeks total**
- Week 1-2: Read-only analysis
- Week 3: Write operations
- Week 4-5: Polish + documentation

Let's build this! 🚀
