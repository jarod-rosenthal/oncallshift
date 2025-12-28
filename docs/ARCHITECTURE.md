# PagerDuty-Lite Architecture

## Overview

Mobile-first incident management platform built on AWS ECS with cost-effective, scalable architecture.

## Architecture Decision: ECS vs EKS

**Chosen: AWS ECS Fargate**

**Rationale:**
- **Cost**: No Kubernetes control plane cost (~$73/month savings)
- **Simplicity**: Less operational overhead for small teams
- **Integration**: Native AWS service integration
- **Scale**: Perfect for target workload (1-20 user teams)
- **Maintenance**: Simpler upgrades and management

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile App (React Native)                 │
│                    iOS + Android (Expo)                          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ HTTPS/WSS
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                  Application Load Balancer                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
      ┌───────────┴──────────┐
      │                      │
┌─────▼──────┐      ┌────────▼─────────┐
│  ECS API   │      │   ECS Workers    │
│  Service   │      │   Service        │
│            │      │                  │
│ - Alert    │      │ - Notification   │
│   Ingestion│      │   Sender         │
│ - Incident │      │ - Escalation     │
│   CRUD     │      │   Engine         │
│ - Schedule │      │ - Heartbeat      │
│   Mgmt     │      │   Checker        │
│ - Auth     │      │                  │
└─────┬──────┘      └────────┬─────────┘
      │                      │
      │      ┌───────────────┤
      │      │               │
┌─────▼──────▼───┐  ┌────────▼─────────┐
│  Aurora        │  │  SQS Queues      │
│  Serverless v2 │  │                  │
│  (Postgres)    │  │ - alerts_queue   │
│                │  │ - notifs_queue   │
└────────────────┘  │ - escal_queue    │
                    └──────────────────┘
                           │
      ┌────────────────────┼────────────────────┐
      │                    │                    │
┌─────▼─────┐    ┌─────────▼──────┐   ┌────────▼────────┐
│  Cognito  │    │  SNS/Pinpoint  │   │   Twilio API    │
│  (Auth)   │    │  (Push/SMS)    │   │   (SMS/Voice)   │
└───────────┘    └────────────────┘   └─────────────────┘
```

## Core Components

### 1. API Service (ECS Fargate)

**Container**: Node.js/TypeScript REST API

**Endpoints:**
- `POST /api/v1/alerts/webhook` - Webhook alert ingestion
- `POST /api/v1/incidents/:id/acknowledge` - Acknowledge incident
- `POST /api/v1/incidents/:id/resolve` - Resolve incident
- `GET /api/v1/incidents` - List incidents
- `GET /api/v1/schedules/oncall` - Get current on-call
- CRUD for services, teams, schedules, escalation policies

**Configuration:**
- 2 tasks minimum (high availability)
- 0.5 vCPU, 1GB RAM per task
- Auto-scaling: 2-10 tasks based on CPU/memory
- Health checks on `/health` endpoint

### 2. Worker Services (ECS Fargate)

**Container**: Node.js/TypeScript background workers

**Workers:**

**Notification Worker:**
- Consumes from `notifications_queue`
- Sends push/SMS/voice notifications
- Implements fallback logic (push → SMS → voice)
- Tracks notification status

**Escalation Worker:**
- Consumes from `escalation_queue`
- Processes escalation steps with timeouts
- Triggers next level if no acknowledgment
- Handles schedule resolution

**Heartbeat Worker:**
- Runs on schedule (EventBridge cron: every 1 min)
- Checks missed heartbeats
- Creates incidents for dead man's switches

**Configuration:**
- 1-2 tasks per worker type
- 0.25 vCPU, 512MB RAM
- Can scale based on queue depth

### 3. Database (Aurora Serverless v2)

**Engine**: PostgreSQL 15

**Configuration:**
- Min capacity: 0.5 ACU (~$45/month)
- Max capacity: 4 ACU (scales with load)
- Multi-AZ for HA
- Automated backups (7 day retention)
- Encryption at rest

**Schema:**
- Organizations, users, teams
- Services, schedules, escalation policies
- Incidents, events, notifications
- Heartbeats, audit logs

### 4. Message Queues (SQS)

**Queues:**

1. **alerts_queue** (Standard)
   - Alert ingestion for async processing
   - Allows burst traffic without overwhelming API

2. **notifications_queue** (Standard)
   - Notification jobs (push, SMS, voice)
   - DLQ for failed notifications

3. **escalation_queue** (Standard with delay)
   - Escalation step timeouts
   - Uses SQS delay for timing

**Configuration:**
- Visibility timeout: 30s (notifications), 60s (escalations)
- DLQs with maxReceiveCount: 3
- Encryption at rest

### 5. Authentication (Amazon Cognito)

**User Pool:**
- Email/password authentication
- JWT tokens with 1-hour expiry
- Refresh tokens (30 days)
- MFA optional (for future)

**Integration:**
- Mobile app: AWS Amplify Auth
- API: JWT verification middleware

### 6. Notifications

**Push Notifications:**
- SNS → FCM (Android) + APNs (iOS)
- Device tokens registered per user
- High-priority messages

**SMS/Voice:**
- Twilio API (external service)
- Fallback after push timeout
- Voice calls with TTS for critical alerts

**Email (Inbound):**
- SES with email receiving rules
- Lambda processes incoming emails → alerts

### 7. Networking

**VPC:**
- 3 AZs for high availability
- Public subnets: ALB
- Private subnets: ECS tasks, Aurora
- NAT Gateways for outbound (or VPC endpoints for cost savings)

**Security Groups:**
- ALB: Allow 443 from 0.0.0.0/0
- ECS tasks: Allow traffic from ALB only
- Aurora: Allow 5432 from ECS tasks only

**ALB:**
- HTTPS listener (certificate from ACM)
- Health checks to ECS tasks
- Path-based routing (future: /api, /webhooks)

## Data Flow Examples

### Alert Ingestion Flow

```
1. External system → POST /api/v1/alerts/webhook
2. API validates API key, creates alert event
3. API writes to alerts_queue (async)
4. API returns 202 Accepted immediately
5. Worker consumes from alerts_queue
6. Worker checks deduplication logic
7. Worker creates/updates incident in DB
8. Worker enqueues escalation job (with delay)
9. Escalation worker processes → notifies on-call user
10. Notification worker sends push notification
```

### Incident Acknowledgment Flow

```
1. User taps "Acknowledge" in mobile app
2. Mobile → PUT /api/v1/incidents/:id/acknowledge
3. API updates incident state to ACKNOWLEDGED
4. API cancels pending escalation jobs
5. API creates incident_event (acknowledgment)
6. API returns success
7. Mobile refreshes incident detail
```

### Escalation Flow

```
1. Incident created → escalation job queued (step 1, timeout 5 min)
2. After 5 min, escalation worker wakes up
3. Worker checks if incident still TRIGGERED
4. If yes, queue notification for step 2 users
5. Queue next escalation job (step 2, timeout 5 min)
6. Repeat until acknowledged or end of policy
```

## Cost Breakdown (Monthly, 20 users)

| Service | Configuration | Cost |
|---------|---------------|------|
| ECS Fargate (API) | 2 x 0.5 vCPU, 1GB | $32 |
| ECS Fargate (Workers) | 3 x 0.25 vCPU, 512MB | $24 |
| Aurora Serverless v2 | 0.5 ACU min | $45 |
| Application Load Balancer | 1 ALB | $20 |
| NAT Gateway | 1 x per AZ | $32 (or $0 with VPC endpoints) |
| SQS | 1M requests | $1 |
| SNS | 1M publishes | $1 |
| Cognito | 20 MAU | $0 (free tier) |
| SES (receiving) | 1k emails | $0.10 |
| CloudWatch Logs | 10GB | $5 |
| **Total Infrastructure** | | **~$160/month** |
| **Per User (20 users)** | | **$8/user** |
| Twilio (SMS) | ~5 SMS/user/month | ~$0.40/user |
| Twilio (Voice) | ~1 call/user/month | ~$0.05/user |
| **Total with Notifications** | | **~$8.45/user** |

**Optimization for target ($5-10/user):**
- Use VPC endpoints instead of NAT Gateway: Save $32/month ($1.60/user)
- Start with 1 AZ for dev: Save on NAT costs
- Reduced cost: **$6.85/user** ✅

## Scalability

**Current Architecture Supports:**
- Up to 100 users per org
- ~1000 incidents/day
- 10k notifications/day

**Scaling Path:**
- Add ECS tasks (auto-scaling)
- Increase Aurora ACU (auto-scales)
- Add read replicas for Aurora if needed
- Add ElastiCache for rate limiting/session

## Security

**Data Protection:**
- Encryption at rest (Aurora, SQS, S3)
- TLS everywhere (ALB, API, external)
- Secrets in AWS Secrets Manager

**Access Control:**
- IAM roles for ECS tasks (least privilege)
- Security groups for network isolation
- API key scoping (org-level, service-level)

**Audit:**
- All actions logged to audit_logs table
- CloudWatch Logs for application logs
- CloudTrail for AWS API calls

## Monitoring & Alerting

**CloudWatch Metrics:**
- ECS task CPU/memory utilization
- ALB target response time, 5xx errors
- SQS queue depth, age of oldest message
- Aurora connections, CPU

**CloudWatch Alarms:**
- API 5xx > 5% for 5 minutes
- Queue depth > 1000 messages
- Aurora CPU > 80%
- No healthy ECS targets

**Application Metrics:**
- Incidents created (by severity, service)
- Notifications sent (by channel, status)
- Escalations triggered
- Heartbeats missed

## Disaster Recovery

**RTO: 1 hour | RPO: 5 minutes**

**Backup Strategy:**
- Aurora automated backups (7 days)
- Point-in-time restore
- Cross-region snapshot copy (optional)

**Recovery Procedure:**
1. Restore Aurora from snapshot
2. Redeploy ECS services (Terraform)
3. Verify health checks
4. Update DNS if needed

## Development Workflow

**Environments:**
- `dev`: Single AZ, minimal resources, personal testing
- `staging`: Multi-AZ, production-like, pre-release testing
- `prod`: Multi-AZ, full HA, customer-facing

**CI/CD:**
- GitHub Actions
- Build Docker images → ECR
- Run tests (unit, integration)
- Deploy via Terraform (staging auto, prod manual approval)

## Next Steps (Post-MVP)

1. Add ElastiCache Redis for rate limiting
2. Implement WebSocket for real-time updates
3. Add CloudFront CDN for static assets
4. Multi-region deployment for global teams
5. Add read replicas for reporting queries
