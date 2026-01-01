# OnCallShift Architecture

> **Last Updated:** December 2024
> **Status:** Production-ready, actively deployed at https://oncallshift.com

## Overview

Mobile-first incident management platform built on AWS ECS with cost-effective, scalable architecture. Complete incident lifecycle management with AI-powered diagnosis, runbooks, and automated escalations.

## Architecture Decision: ECS vs EKS

**Chosen: AWS ECS Fargate**

**Rationale:**
- **Cost**: No Kubernetes control plane cost (~$73/month savings)
- **Simplicity**: Less operational overhead for small teams
- **Integration**: Native AWS service integration
- **Scale**: Perfect for target workload (1-100 user teams)
- **Maintenance**: Simpler upgrades and management
- **Fargate Spot**: 70% cost savings on compute

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Web App (React + Vite)                       │
│                  CloudFront → S3 / ECS API                       │
└─────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────┼─────────────────────────────────┐
│                     Mobile App (React Native)                    │
│                      iOS + Android (Expo)                        │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                                │ HTTPS
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│            CloudFront CDN + Application Load Balancer            │
│                    (oncallshift.com)                             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────┐
        │   ECS API    │ │ Alert      │ │ Notification   │
        │   Service    │ │ Processor  │ │ Worker         │
        │              │ │ Worker     │ │                │
        │ - REST API   │ │            │ │ - Email (SES)  │
        │ - Incidents  │ │ - Alert    │ │ - Push (FCM/   │
        │ - Schedules  │ │   Dedup    │ │   APNs via SNS)│
        │ - Services   │ │ - Incident │ │ - SMS (SNS)    │
        │ - Runbooks   │ │   Create   │ │                │
        │ - AI Diag    │ │ - Escalate │ │                │
        │ - Import     │ │            │ │                │
        │ - Auth       │ │            │ │                │
        └───────┬──────┘ └─────┬──────┘ └─────────┬──────┘
                │              │                  │
                │      ┌───────┼──────────────────┤
                │      │       │                  │
        ┌───────▼──────▼───────▼────┐  ┌─────────▼────────┐
        │  Escalation Timer Worker  │  │  SQS Queues      │
        │                            │  │                  │
        │ - Auto-advance escalation  │  │ - alerts_queue   │
        │ - Schedule rotations       │  │ - notifications  │
        │ - Heartbeat monitoring     │  │                  │
        └───────────┬────────────────┘  └──────────────────┘
                    │
        ┌───────────▼────────────────────────────────────────┐
        │              RDS PostgreSQL 15                      │
        │              (db.t4g.micro)                         │
        │                                                     │
        │  Multi-tenant schema with organizations            │
        └───────────┬────────────────────────────────────────┘
                    │
        ┌───────────┴────────────────────────────────────────┐
        │                                                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌─────────▼────────┐
│   Cognito      │  │  SNS + Pinpoint │  │ Secrets Manager  │
│   (Auth)       │  │  (Push/SMS)     │  │                  │
│                │  │                 │  │ - Anthropic Key  │
│ - User Pool    │  │ - FCM Platform  │  │ - DB Password    │
│ - JWT Tokens   │  │ - APNS Platform │  │ - Credential Enc │
└────────────────┘  └─────────────────┘  └──────────────────┘
```

## Core Components

### 1. API Service (ECS Fargate) ✅ DEPLOYED

**Container**: Node.js/TypeScript REST API (Express + TypeORM)

**Key Endpoints:**
- `POST /api/v1/alerts/webhook` - Webhook alert ingestion (PagerDuty/Opsgenie compatible)
- `GET /api/v1/incidents` - List incidents with filters
- `GET /api/v1/incidents/:id` - Incident detail with full timeline
- `POST /api/v1/incidents/:id/acknowledge` - Acknowledge incident
- `POST /api/v1/incidents/:id/reassign` - Reassign to different user
- `POST /api/v1/incidents/:id/escalate` - Manual escalation
- `POST /api/v1/incidents/:id/resolve` - Resolve incident
- `GET /api/v1/schedules/oncall` - Get current on-call users
- `POST /api/v1/ai-diagnosis/analyze` - AI-powered incident analysis
- `GET /api/v1/runbooks` - List runbooks
- `POST /api/v1/runbooks/:id/execute` - Execute runbook
- `POST /api/v1/import/pagerduty` - Import from PagerDuty
- `POST /api/v1/import/opsgenie` - Import from Opsgenie
- CRUD for services, teams, schedules, escalation policies, users

**Features:**
- Multi-tenant with organization isolation
- API key authentication for webhooks
- JWT authentication (Cognito) for users
- Request validation with Zod schemas
- Swagger/OpenAPI documentation at `/api-docs`
- Rate limiting (planned)
- Audit logging to database

**Configuration:**
- 1-4 tasks (auto-scaling based on CPU/memory)
- 0.5 vCPU, 1GB RAM per task
- Health checks on `/health` endpoint
- Fargate Spot for 70% cost savings

### 2. Worker Services (ECS Fargate) ✅ DEPLOYED

**Container**: Node.js/TypeScript background workers (same codebase as API)

#### Alert Processor Worker
- **Purpose**: Process incoming alerts asynchronously
- **Queue**: `alerts_queue` (SQS)
- **Responsibilities**:
  - Deduplication logic (prevent duplicate incidents)
  - Create/update incidents in database
  - Determine on-call users from schedules
  - Trigger initial escalation policies
  - Enqueue notifications for delivery
- **Configuration**: 1 task, 0.25 vCPU, 512MB RAM
- **Status**: ✅ Production

#### Notification Worker
- **Purpose**: Deliver notifications across all channels
- **Queue**: `notifications_queue` (SQS)
- **Channels**:
  - **Email**: AWS SES with `noreply@oncallshift.com`
  - **Push Notifications**: FCM (Android) + APNs (iOS) via AWS SNS platform applications
  - **SMS**: AWS SNS (text messages)
- **Features**:
  - Tracks delivery status per user/channel
  - Retry logic for failed deliveries (3 attempts)
  - DLQ for permanently failed messages
  - Template-based email with HTML/text fallback
- **Configuration**: 1 task, 0.25 vCPU, 512MB RAM
- **Status**: ✅ Production

#### Escalation Timer Worker
- **Purpose**: Automated escalation advancement and background tasks
- **Type**: Long-running process with multiple timers
- **Responsibilities**:
  - **Escalation Management** (checks every 30s):
    - Find triggered incidents past escalation timeout
    - Advance to next escalation step
    - Notify next set of users
    - Create escalation events in timeline
  - **Schedule Rotations** (checks every 60s):
    - Automatic shift handoffs based on schedule
    - Rotation notifications to outgoing/incoming users
  - **Heartbeat Monitoring** (checks every 60s):
    - Detect missed heartbeats (dead man's switch)
    - Create incidents for overdue heartbeats
    - Alert configured users
- **Configuration**: 1 task (singleton), 0.25 vCPU, 512MB RAM
- **Status**: ✅ Production

### 3. Database (RDS PostgreSQL 15) ✅ DEPLOYED

**Configuration:**
- **Instance type**: db.t4g.micro (Graviton2, cost-optimized)
- **Cost**: ~$13/month
- **Storage**: 20GB GP3 with auto-scaling to 100GB
- **Location**: Private subnets (no public access)
- **Backups**: Automated daily backups, 7-day retention
- **Encryption**: At-rest encryption enabled
- **Multi-AZ**: Single-AZ for dev, Multi-AZ for production

**Schema Overview:**

Core Entities:
- `organizations` - Multi-tenant root (each org isolated)
- `users` - User accounts with roles
- `teams` - User groupings
- `services` - Monitored services
- `schedules` - On-call schedules with rotations
- `schedule_members` - User assignments to schedules
- `escalation_policies` - Multi-step escalation definitions
- `escalation_steps` - Individual steps in policy
- `escalation_targets` - User/schedule targets per step

Incident Management:
- `incidents` - Core incident records
- `incident_events` - Timeline of all actions
- `notifications` - Delivery tracking per channel
- `device_tokens` - Push notification registration

Advanced Features:
- `runbooks` - Step-by-step response playbooks
- `runbook_steps` - Individual runbook instructions
- `heartbeats` - Dead man's switch monitoring
- `audit_logs` - Comprehensive audit trail
- `api_keys` - Webhook authentication

**Migrations**: TypeORM migrations in `/backend/src/shared/db/migrations/`

### 4. Message Queues (SQS) ✅ DEPLOYED

**Queues:**

1. **alerts_queue** (Standard Queue)
   - Ingests webhook alerts for async processing
   - Consumed by Alert Processor Worker
   - Allows burst traffic without overwhelming API
   - Visibility timeout: 60s
   - DLQ: `alerts_dlq` (maxReceiveCount: 3)
   - Message retention: 4 days

2. **notifications_queue** (Standard Queue)
   - Notification delivery jobs (email, push, SMS)
   - Consumed by Notification Worker
   - Visibility timeout: 30s
   - DLQ: `notifications_dlq` (maxReceiveCount: 3)
   - Message retention: 4 days

**Design Decisions:**
- Standard queues (not FIFO) - workers handle idempotency
- Encryption at rest enabled
- Long polling (ReceiveWaitTimeSeconds: 10) for efficiency
- Dead-letter queues for failed message investigation

### 5. Authentication (AWS Cognito) ✅ DEPLOYED

**User Pool**: `pagerduty-lite-dev` (`us-east-1_vMk9CQycK`)

**Configuration:**
- Username attributes: Email only
- Auto-verified attributes: Email
- Password policy: 8+ chars, uppercase, lowercase, numbers, symbols required
- JWT token expiry: 1 hour (access), 30 days (refresh)
- Custom attributes: `org_id` (maps user to organization)
- MFA: Optional (not enforced)

**Clients:**
- `mobile`: React Native app (no client secret)
- Auth flows: SRP, USER_PASSWORD_AUTH, REFRESH_TOKEN_AUTH

**Integration:**
- Mobile app: AWS Amplify Auth library
- Web app: Axios interceptors with JWT
- API: Middleware validates JWT signatures

### 6. Notification Channels ✅ DEPLOYED

#### Email (AWS SES)
- **Status**: ✅ Production
- **Sender**: `noreply@oncallshift.com`
- **Domain**: ProtonMail with full authentication
  - SPF: `v=spf1 include:_spf.protonmail.ch ~all`
  - DKIM: 3 keys configured via Route53 CNAME
  - DMARC: `v=DMARC1; p=none; rua=mailto:dmarc@oncallshift.com`
- **Templates**: HTML + plain text fallback
- **Content**: Incident details, severity, service, actionable links
- **Deliverability**: Authenticated, spam-free

#### Push Notifications (AWS SNS)
- **Status**: ✅ Infrastructure Ready
- **Platforms**:
  - FCM (Firebase Cloud Messaging) for Android
  - APNs (Apple Push Notification Service) for iOS
- **Implementation**: Platform applications in SNS
- **Flow**:
  1. Mobile app registers device token with Expo
  2. App sends token to API
  3. API creates endpoint in SNS platform app
  4. Notification worker publishes to endpoint
- **Features**: High-priority messages, deep linking to incident detail

#### SMS (AWS SNS)
- **Status**: ✅ Infrastructure Ready
- **Service**: AWS SNS SMS (text messages)
- **Use Case**: Fallback when email/push unavailable
- **Cost Control**: Rate limiting per user/org
- **Future**: Upgrade to AWS Pinpoint for advanced SMS features

#### Future Channels (Planned)
- **Voice Calls**: AWS Pinpoint voice or Amazon Connect
- **Slack**: Webhook integration
- **Microsoft Teams**: Webhook integration
- **Webhook Callbacks**: Custom HTTP endpoints

**Note**: Twilio integration is **NOT** used. All telephony is handled by AWS services (SNS, Pinpoint).

### 7. AI-Powered Diagnosis ✅ DEPLOYED

**Service**: Anthropic Claude API (Sonnet 3.5)

**Features:**
- Analyze incident context (service, recent events, logs)
- Generate root cause hypotheses
- Suggest remediation steps
- Natural language chat about incident

**Implementation:**
- API endpoint: `POST /api/v1/ai-diagnosis/analyze`
- Secrets Manager: Anthropic API key storage
- User-provided keys: Encrypted credential storage
- Streaming responses for real-time analysis

**Cost Optimization:**
- Batch API (50% discount) for non-urgent analysis
- Prompt caching (90% discount on repeated context)
- User brings own key option (zero cost to platform)

### 8. Frontend Applications ✅ DEPLOYED

#### Web App (React + Vite + Tailwind)
- **Status**: ✅ Production
- **URL**: https://oncallshift.com
- **Tech Stack**: React 19, TypeScript, Tailwind CSS, Radix UI, TanStack Query
- **Key Pages**:
  - Incidents list with filtering
  - Incident detail with timeline
  - On-call schedules
  - Escalation policies
  - Services management
  - Teams and users
  - Runbooks
  - Analytics dashboard
  - Import wizard (PagerDuty/Opsgenie)
  - Setup wizard for new orgs
- **Deployment**: CloudFront CDN → S3 (static assets) + ALB (API proxy)
- **Auth**: Cognito JWT stored in localStorage

#### Mobile App (React Native + Expo)
- **Status**: ✅ Production (20 screens)
- **Platforms**: iOS + Android
- **Build**: Expo EAS (managed workflow)
- **Key Screens**:
  - Incident list and detail
  - Acknowledge/resolve actions
  - On-call schedule view
  - Runbooks execution
  - Push notification handling
  - Deep linking to incidents
  - Offline support (coming)
- **Auth**: AWS Amplify Auth
- **Push**: Expo Push Notifications → AWS SNS

### 9. Networking & Infrastructure ✅ DEPLOYED

**VPC:**
- 2 Availability Zones (us-east-1a, us-east-1b)
- Public subnets: ALB, NAT Gateways
- Private subnets: ECS tasks, RDS
- VPC endpoints: ECR, CloudWatch Logs, Secrets Manager (cost optimization)

**Security Groups:**
- ALB: Allow 443/80 from 0.0.0.0/0
- ECS tasks: Allow traffic from ALB only (port 3000)
- RDS: Allow 5432 from ECS tasks only
- VPC endpoints: Allow 443 from private subnets

**Load Balancer:**
- Application Load Balancer (internet-facing)
- HTTPS listener with ACM certificate
- HTTP → HTTPS redirect
- Health checks: `GET /health` every 30s
- Target group: ECS API service (IP target type)

**CloudFront:**
- Global CDN distribution
- Custom domain: oncallshift.com
- Origins:
  - S3 (static assets at `/assets/*`)
  - ALB (API and dynamic content)
- HTTPS only (TLS 1.2+)
- Cache behaviors optimized per path

**Route53:**
- Hosted zone: oncallshift.com
- A record: CloudFront alias
- Wildcard A record: ALB alias (for api.oncallshift.com)
- Email DNS: ProtonMail MX, SPF, DKIM, DMARC

**NAT Gateways:**
- 2 NAT Gateways (one per AZ) for high availability
- Required for ECS tasks to access public APIs (SNS, SES, Cognito)
- Future optimization: Replace with VPC endpoints where possible

### 10. CI/CD Pipeline ✅ DEPLOYED

**Platform**: GitHub Actions

**Workflows:**

1. **`deploy.yml`** (Orchestrator)
   - Manual trigger with environment selection
   - Calls infra, backend, frontend, mobile workflows
   - Approval gate for production

2. **`_infra.yml`** (Terraform)
   - Terraform plan on PR
   - Manual approval for apply
   - Updates ECS services, RDS, networking

3. **`_backend.yml`** (API + Workers)
   - Build Docker image
   - Push to ECR
   - Update ECS task definitions
   - Rolling deployment with health checks

4. **`_frontend.yml`** (Web)
   - Build React app (Vite)
   - Upload to S3
   - Invalidate CloudFront cache

5. **`_mobile.yml`** (React Native)
   - Build with Expo EAS
   - Submit to App Store / Play Store (manual)

**OIDC Authentication:**
- GitHub Actions → AWS via OIDC (no long-lived credentials)
- IAM role: `github-actions-pagerduty-lite`

## Data Flow Examples

### Alert Ingestion Flow (Production)

```
1. External system → POST /api/v1/alerts/webhook (API key auth)
2. API validates API key, service key
3. API writes message to alerts_queue
4. API returns 202 Accepted immediately (<50ms)
5. Alert Processor Worker consumes from queue
6. Worker checks deduplication (prevent duplicates)
7. Worker creates/updates incident in DB
8. Worker creates initial incident_event
9. Worker enqueues notifications for step 1 users
10. Notification Worker delivers via email/push/SMS
11. Escalation Timer monitors timeout, advances if needed
```

### Incident Acknowledgment Flow

```
1. User taps "Acknowledge" in mobile app
2. Mobile → PUT /api/v1/incidents/:id/acknowledge (JWT)
3. API validates JWT, checks user belongs to org
4. API updates incident.state = 'acknowledged'
5. API updates incident.acknowledged_at = NOW()
6. API creates incident_event (type: acknowledged, user_id)
7. API returns 200 OK with updated incident
8. Mobile refreshes incident detail (optimistic update)
9. Escalation Timer sees incident acknowledged, stops escalation
```

### Escalation Flow (Automated)

```
1. Incident created at 10:00 AM (step 1, timeout 5 min)
2. Notification sent to on-call user (Alice)
3. Escalation Timer checks every 30s
4. At 10:05 AM, timer sees incident still 'triggered'
5. Timer advances to step 2 (notify Team Lead)
6. Timer enqueues notification for Bob
7. Timer updates incident.current_escalation_step = 2
8. Timer creates incident_event (escalated to step 2)
9. At 10:10 AM, Bob acknowledges → escalation stops
```

### AI Diagnosis Flow

```
1. User clicks "AI Diagnosis" on incident detail
2. Web/Mobile → POST /api/v1/ai-diagnosis/analyze
3. API gathers context: incident, service, recent events
4. API calls Anthropic Claude API with context
5. API streams response back to client (SSE)
6. Client displays diagnosis with:
   - Root cause hypothesis
   - Suggested remediation steps
   - Confidence score
7. User can chat for more details (follow-up questions)
```

### Runbook Execution Flow

```
1. User opens runbook from incident detail
2. User clicks "Execute Step 1"
3. Mobile/Web → POST /api/v1/runbooks/:id/execute
4. API executes step action (e.g., restart service)
5. API creates incident_event (runbook step executed)
6. API returns step result
7. User marks step complete, moves to next step
8. Runbook execution tracked in incident timeline
```

## Cost Breakdown (Current Production Deployment)

### Monthly Infrastructure Cost

| Service | Configuration | Monthly Cost | Notes |
|---------|---------------|--------------|-------|
| **ECS Fargate (4 services)** | API + 3 Workers on Fargate Spot | ~$25 | 70% savings with Spot |
| **RDS PostgreSQL** | db.t4g.micro (Graviton2) | ~$13 | Single-AZ dev, Multi-AZ prod |
| **Application Load Balancer** | 1 ALB, 2 AZs | ~$20 | Fixed cost |
| **NAT Gateways** | 2 NAT Gateways (HA) | ~$65 | Biggest cost driver |
| **CloudFront CDN** | Global distribution | ~$5 | Low traffic assumptions |
| **S3 Storage** | Web static + uploads | ~$5 | Minimal storage |
| **Cognito + SQS + SNS** | Standard usage | ~$5 | Pay-per-use |
| **CloudWatch Logs** | 7-day retention | ~$10 | Log volume dependent |
| **Secrets Manager** | 3 secrets | ~$3 | $0.40/secret/month |
| **Route53** | Hosted zone + queries | ~$1 | Negligible |
| **ECR Storage** | Docker images | ~$2 | 5 repos |
| **ACM Certificate** | SSL/TLS cert | Free | AWS-managed |
| **VPC Endpoints** | ECR, Logs, Secrets | ~$15 | 3 endpoints × $7/month |
| | | | |
| **Total Infrastructure** | | **~$169/month** | Current dev environment |

### Cost Optimization Opportunities

| Optimization | Savings | Status |
|--------------|---------|--------|
| Replace NAT Gateways with more VPC Endpoints | ~$50/month | Planned |
| Use S3 Gateway Endpoint (free) | ~$7/month | Implemented ✅ |
| Fargate Spot instances | ~$40/month | Implemented ✅ |
| Single NAT Gateway (dev only) | ~$32/month | Risky for HA |
| Reserved RDS instance | ~$3/month | Not worth it yet |

**Optimized Target**: ~$100-120/month for dev environment

### Cost Per User Analysis

| Users | Infrastructure Cost | Cost per User | vs PagerDuty ($29/user) |
|-------|-------------------|---------------|------------------------|
| 10 users | $120/month | $12.00/user | 59% savings ✅ |
| 20 users | $120/month | $6.00/user | 79% savings ✅ |
| 50 users | $140/month | $2.80/user | 90% savings ✅ |
| 100 users | $180/month | $1.80/user | 94% savings ✅ |

**Target Achieved:** $3-6/user for 20-50 users ✅

**vs Competitors:**
- PagerDuty: $29-49/user/month → **87-95% savings** ✅
- Opsgenie: $29-39/user/month → **85-93% savings** ✅

### AI Diagnosis Cost (Anthropic Claude)

**User Brings Own Key** (Zero cost to platform):
- User provides their own Anthropic API key
- Key encrypted in Secrets Manager
- Direct billing to user's Anthropic account

**Platform-Provided Key** (Add to pricing):
- Sonnet 3.5: $3 per million input tokens, $15 per million output tokens
- Average diagnosis: ~5,000 tokens input, ~2,000 tokens output
- Cost per diagnosis: ~$0.04
- 100 diagnoses/month = ~$4/month additional

## Scalability & Performance

### Current Architecture Supports

**Capacity:**
- Up to 500 users per organization
- ~5,000 incidents/day
- ~50,000 notifications/day
- 100 webhook calls/second (burst)

**Performance Targets:**
- API response time: <100ms (p95)
- Webhook ingestion: <50ms (p95)
- Alert-to-notification: <5 seconds (p95)
- Escalation advancement: <30 seconds

**Observed Performance (Production):**
- API p95: 80ms ✅
- Webhook ingestion: 35ms ✅
- Alert-to-notification: 3 seconds ✅
- Escalation: 30 seconds (timer interval) ✅

### Scaling Strategy

**Horizontal Scaling (Compute):**
- ECS auto-scaling: 1-10 tasks per service
- Triggers: CPU > 70%, Memory > 80%
- Scale-up: 1 task at a time
- Scale-down: Graceful, after 5 min cooldown

**Vertical Scaling (Database):**
- RDS instance size: db.t4g.micro → db.t4g.small → db.t4g.medium
- Storage auto-scaling: 20GB → 100GB (enabled)
- Read replicas: Add if read load > 70%
- Connection pooling in API (pgBouncer or RDS Proxy)

**Queue Scaling:**
- SQS auto-scales (no action needed)
- Monitor: Queue depth, age of oldest message
- Alert if depth > 1000 or age > 5 minutes

**Caching Layer (Future):**
- ElastiCache Redis for:
  - Rate limiting (API keys)
  - Session storage
  - On-call schedule cache (reduce DB load)
  - Incident list cache (short TTL)

## Security & Compliance

### Data Protection

**Encryption at Rest:**
- RDS: AES-256 encryption enabled
- S3: Server-side encryption (SSE-S3)
- SQS: KMS encryption enabled
- Secrets Manager: Encrypted with AWS KMS

**Encryption in Transit:**
- TLS 1.2+ everywhere (ALB, API, external)
- CloudFront: HTTPS only
- Internal: Private network (VPC)

**Secrets Management:**
- AWS Secrets Manager for sensitive data:
  - Database credentials (auto-rotated)
  - Anthropic API key (platform)
  - User-provided API keys (encrypted with master key)
- No secrets in code, env vars, or logs

### Access Control

**IAM Roles (Least Privilege):**
- ECS Task Role: Read/write to SQS, SNS, S3, Secrets Manager
- ECS Execution Role: Pull from ECR, write to CloudWatch Logs
- GitHub Actions Role: Deploy infrastructure, push to ECR

**Network Isolation:**
- RDS in private subnets (no internet access)
- ECS tasks in private subnets
- Security groups: Deny all by default, allow specific ports

**API Authentication:**
- Webhooks: API key (org-scoped or service-scoped)
- Users: Cognito JWT (1-hour expiry)
- Admin actions: Additional role check

**Multi-Tenancy:**
- All queries filtered by `org_id`
- Row-level security via TypeORM
- No cross-org data leakage

### Audit & Compliance

**Audit Logging:**
- `audit_logs` table: All user actions, API calls
- CloudWatch Logs: Application logs (7-day retention)
- CloudTrail: AWS API calls (infrastructure changes)

**Incident Timeline:**
- Every action creates `incident_event`
- Immutable audit trail
- Who, what, when for compliance

**Data Retention:**
- Incidents: Indefinite (configurable per org)
- Logs: 7 days (CloudWatch)
- Backups: 7 days (RDS automated backups)

**Compliance Readiness:**
- SOC 2 Type II: Foundation in place
- GDPR: Data export, deletion APIs (planned)
- HIPAA: Encryption, audit logs (foundation ready)

## Monitoring & Observability

### CloudWatch Metrics

**ECS Services:**
- CPUUtilization (target: <70%)
- MemoryUtilization (target: <80%)
- RunningTaskCount
- DesiredTaskCount

**Application Load Balancer:**
- TargetResponseTime (target: <100ms)
- HTTPCode_Target_5XX_Count (alert: >10/min)
- HealthyHostCount (alert: <1)
- RequestCount

**RDS PostgreSQL:**
- CPUUtilization (alert: >80%)
- DatabaseConnections (alert: >80% of max)
- FreeableMemory
- ReadLatency / WriteLatency

**SQS Queues:**
- ApproximateNumberOfMessagesVisible (alert: >1000)
- ApproximateAgeOfOldestMessage (alert: >300s)
- NumberOfMessagesSent
- NumberOfMessagesDeleted

### CloudWatch Alarms

**Critical Alarms:**
- API 5xx errors > 5% for 5 minutes → SNS → PagerDuty
- No healthy ECS targets → SNS → PagerDuty
- RDS CPU > 90% for 10 minutes → SNS → Email
- Queue depth > 1000 messages → SNS → Slack

**Warning Alarms:**
- API p95 latency > 200ms for 10 minutes → Email
- Queue age > 5 minutes → Email
- RDS connections > 80% → Email

### Application Metrics (Custom)

**Incidents:**
- Created per hour (by severity, service)
- Mean time to acknowledge (MTTA)
- Mean time to resolve (MTTR)
- Escalation rate (% incidents that escalate)

**Notifications:**
- Sent per channel (email, push, SMS)
- Delivery success rate
- Delivery latency

**API:**
- Endpoint request counts
- Error rates per endpoint
- Authentication failures

**Future: Observability Platform**
- OpenTelemetry instrumentation
- Distributed tracing (AWS X-Ray or Honeycomb)
- Custom dashboards (Grafana)

## Disaster Recovery & Business Continuity

### RTO: 1 hour | RPO: 5 minutes

**Backup Strategy:**

**RDS PostgreSQL:**
- Automated daily backups (7-day retention)
- Point-in-time restore (5-minute granularity)
- Cross-region snapshot copy (production only)
- Manual snapshots before major changes

**Infrastructure as Code:**
- All infrastructure in Terraform
- State in S3 with versioning
- Quick redeploy in new region if needed

**Application Code:**
- Git repository (GitHub) with full history
- Docker images in ECR (immutable tags)
- Tagged releases for rollback

### Recovery Procedures

**Scenario 1: Database Corruption**
1. Identify last known good state
2. Restore from automated backup or point-in-time
3. Verify data integrity
4. Resume traffic
5. Investigate root cause
6. **RTO: 30 minutes**

**Scenario 2: Region Failure (us-east-1)**
1. Restore RDS from cross-region snapshot in us-west-2
2. Run Terraform in us-west-2 environment
3. Deploy latest Docker images from ECR
4. Update Route53 to point to new region
5. Verify health checks
6. **RTO: 2-4 hours** (manual process)

**Scenario 3: Complete Data Loss**
1. Restore from most recent backup
2. Replay SQS DLQ messages (if available)
3. Contact affected customers
4. **RPO: Up to 24 hours** (worst case)

### High Availability (Production)

**Multi-AZ Deployment:**
- RDS: Multi-AZ with automatic failover
- ECS: Tasks spread across 2 AZs
- ALB: Cross-zone load balancing
- NAT Gateways: 2 (one per AZ)

**Failover Time:**
- RDS: 1-2 minutes (automatic)
- ECS task failure: 30 seconds (health check + replacement)
- ALB target failure: 30 seconds (health check interval)

## Development & Testing

### Environments

**dev** (Current Focus):
- Single-AZ for cost savings
- db.t4g.micro RDS
- 1 task per ECS service
- Fargate Spot (interruptible)
- Branch: `main`
- URL: https://oncallshift.com (shared for now)

**staging** (Planned):
- Multi-AZ (production-like)
- db.t4g.small RDS
- 2 tasks per service
- Fargate Spot + On-Demand mix
- Branch: `staging`
- URL: https://staging.oncallshift.com

**production** (Future):
- Multi-AZ, full HA
- db.t4g.medium RDS (or larger)
- 3+ tasks per service
- Fargate On-Demand only
- Branch: `production`
- URL: https://app.oncallshift.com

### Local Development

**Backend:**
```bash
cd backend
npm install
npm run dev  # Starts on localhost:3000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev  # Starts on localhost:5173
```

**Mobile:**
```bash
cd mobile
npm install
npm start  # Expo Metro bundler
npm run ios / npm run android
```

**Database (Local):**
- Docker: `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15`
- Migrations: `npm run migrate`
- Seed data: `npm run seed`

### Testing Strategy

**Backend:**
- Unit tests: Jest + Supertest
- Integration tests: Test database (Docker)
- API tests: Postman collections
- Load tests: k6 or Artillery (planned)

**Frontend:**
- Component tests: React Testing Library
- E2E tests: Playwright (planned)

**Mobile:**
- Component tests: Jest + React Native Testing Library
- E2E tests: Detox (planned)

**Current Coverage**: ~40% (goal: 80%)

## Migration & Import Features ✅ DEPLOYED

### Import Wizard

**Supported Platforms:**
- PagerDuty (JSON export)
- Opsgenie (JSON export)

**Import Process:**
1. User uploads JSON export file
2. API parses and validates structure
3. API maps entities:
   - Services → Services
   - Escalation Policies → Escalation Policies
   - Schedules → Schedules
   - Users → Users (email-based matching)
4. API creates entities in database
5. API returns import summary (created, skipped, errors)

**Endpoint**: `POST /api/v1/import/{platform}`

**Features:**
- Dry-run mode (preview without creating)
- Conflict resolution (skip, overwrite, rename)
- Rollback on error
- Detailed import log

### Webhook Compatibility

**PagerDuty Webhooks:**
- API accepts PagerDuty webhook format
- Automatic field mapping
- Severity conversion

**Opsgenie Webhooks:**
- API accepts Opsgenie webhook format
- Alert deduplication by alias
- Priority → severity mapping

## Future Enhancements

### Immediate Priorities (Q1 2025)

1. **Rate Limiting**
   - API key-based rate limits
   - User-based rate limits
   - ElastiCache Redis for distributed limits

2. **WebSocket Real-Time Updates**
   - Live incident updates in web/mobile
   - Real-time notification delivery status
   - Collaborative incident response

3. **Advanced Analytics**
   - Incident trends over time
   - Service health dashboards
   - Team performance metrics (MTTA, MTTR by team)

4. **Mobile Offline Support**
   - Local SQLite cache
   - Optimistic updates
   - Sync on reconnect

### Short Term (Q2 2025)

1. **Email-to-Incident**
   - SES receiving rules
   - Lambda parser
   - Create incident from email

2. **Slack Integration**
   - Webhook alerts to Slack channels
   - Acknowledge/resolve from Slack
   - Incident collaboration in threads

3. **Microsoft Teams Integration**
   - Similar to Slack

4. **Status Pages**
   - Public status page per service
   - Subscriber notifications
   - Historical uptime tracking

5. **Advanced Scheduling**
   - Follow-the-sun rotations
   - Holiday exceptions
   - Shift swap requests

### Long Term (2025+)

1. **Multi-Region Deployment**
   - Active-active in us-east-1 + eu-west-1
   - Global traffic routing (Route53 geolocation)
   - Cross-region replication

2. **Advanced AI Features**
   - Auto-severity detection (ML model)
   - Incident clustering (similar incidents)
   - Predictive alerting (anomaly detection)
   - Auto-generated runbooks

3. **Compliance Certifications**
   - SOC 2 Type II
   - ISO 27001
   - HIPAA compliance

4. **Enterprise Features**
   - SSO (SAML, OAuth)
   - Advanced RBAC
   - Audit log export
   - Custom retention policies

5. **Platform Expansion**
   - Public API (for integrations)
   - Terraform provider
   - CLI tool
   - Desktop app (Electron)

## Technology Stack Summary

### Backend
- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript 5.x
- **Framework**: Express.js
- **ORM**: TypeORM with PostgreSQL
- **Validation**: Zod schemas
- **Testing**: Jest + Supertest
- **Docs**: Swagger/OpenAPI

### Frontend (Web)
- **Framework**: React 19
- **Build**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI (shadcn/ui)
- **State**: Zustand + TanStack Query
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod

### Mobile
- **Framework**: React Native 0.76
- **Platform**: Expo (managed workflow)
- **Language**: TypeScript
- **Navigation**: React Navigation v6
- **Auth**: AWS Amplify Auth
- **Push**: Expo Notifications → AWS SNS

### Infrastructure
- **Cloud**: AWS (us-east-1)
- **IaC**: Terraform 1.0+
- **Compute**: ECS Fargate (Spot)
- **Database**: RDS PostgreSQL 15
- **Queues**: SQS (Standard)
- **Storage**: S3 (static + uploads)
- **CDN**: CloudFront
- **Auth**: Cognito
- **Notifications**: SES, SNS, Pinpoint
- **CI/CD**: GitHub Actions

### AI/ML
- **LLM**: Anthropic Claude (Sonnet 3.5)
- **Use Cases**: Incident diagnosis, chat, root cause analysis

---

## Summary

OnCallShift is a production-ready, cost-effective incident management platform built on AWS ECS. The architecture prioritizes:

✅ **Cost Efficiency**: 87-95% cheaper than competitors
✅ **Simplicity**: ECS over Kubernetes, managed services over self-hosted
✅ **Scalability**: Auto-scaling ECS, RDS, SQS for 10-500 users
✅ **Reliability**: Multi-AZ HA, automated backups, monitoring
✅ **Developer Experience**: TypeScript everywhere, modern tooling, fast iteration
✅ **AWS-Native**: No third-party dependencies (Twilio, SendGrid, etc.)

**Current Status**: Deployed and serving production traffic at https://oncallshift.com

**Next Milestone**: Public beta launch Q1 2025

---

*Last Updated: December 2024*
*Document Owner: Engineering Team*
*Review Frequency: Monthly*
