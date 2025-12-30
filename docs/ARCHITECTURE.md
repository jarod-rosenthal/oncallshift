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
┌─────▼──────┐   ┌──────▼────────┐   ┌─────────▼──────┐
│  ECS API   │   │ Alert Proc    │   │ Notification   │
│  Service   │   │ Worker        │   │ Worker         │
│            │   │               │   │                │
│ - REST API │   │ - Alert       │   │ - Email        │
│ - Incident │   │   Processing  │   │   Delivery     │
│   CRUD     │   │ - Incident    │   │ - Push (FCM/   │
│ - Schedule │   │   Creation    │   │   APNs)        │
│   Mgmt     │   │ - Escalation  │   │ - SMS (SNS)    │
│ - Services │   │   Trigger     │   │                │
│ - Auth     │   │               │   │                │
└─────┬──────┘   └──────┬────────┘   └─────────┬──────┘
      │                 │                      │
      │      ┌──────────┼──────────────────────┤
      │      │          │                      │
┌─────▼──────▼──────────▼───┐  ┌───────────────▼──────┐
│  RDS PostgreSQL            │  │  SQS Queues          │
│  (db.t4g.micro)            │  │                      │
│                            │  │ - alerts_queue       │
│                            │  │ - notifications_queue│
└────────────────────────────┘  └──────────────────────┘
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

**Alert Processor Worker (✅ Deployed):**
- Consumes from `alerts_queue`
- Creates incidents from incoming alerts
- Determines on-call users from schedules
- Triggers escalation policies
- Enqueues notifications for delivery
- Configuration: 1 task, 0.25 vCPU, 512MB RAM

**Notification Worker (✅ Deployed):**
- Consumes from `notifications_queue`
- **Email**: AWS SES with noreply@oncallshift.com
- **Push**: FCM (Android) + APNs (iOS) - infrastructure ready
- **SMS**: AWS SNS - infrastructure ready
- Tracks notification delivery status
- Implements retry logic for failed deliveries
- Configuration: 1 task, 0.25 vCPU, 512MB RAM

**Future Workers (Planned):**
- **Heartbeat Worker**: EventBridge cron to check missed heartbeats
- **Schedule Rotation Worker**: Automated on-call rotation logic

### 3. Database (RDS PostgreSQL)

**Engine**: PostgreSQL 15

**Configuration:**
- Instance type: db.t4g.micro (cost-optimized)
- Cost: ~$13/month
- Single-AZ for dev environment
- Automated backups (7 day retention)
- Encryption at rest
- Located in private subnets

**Schema:**
- Organizations, users, teams
- Services, schedules, escalation policies
- Incidents, events, notifications
- Heartbeats, audit logs

### 4. Message Queues (SQS)

**Queues (✅ Deployed):**

1. **alerts_queue** (Standard)
   - Alert ingestion for async processing
   - Consumed by Alert Processor Worker
   - Allows burst traffic without overwhelming API
   - DLQ for failed alert processing

2. **notifications_queue** (Standard)
   - Notification delivery jobs (email, push, SMS)
   - Consumed by Notification Worker
   - DLQ for failed notification deliveries

**Configuration:**
- Visibility timeout: 30s (notifications), 60s (alerts)
- DLQs with maxReceiveCount: 3
- Encryption at rest
- FIFO not required (idempotent processing)

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

**Email Notifications (✅ Working):**
- AWS SES for outbound email
- Sender: noreply@oncallshift.com
- ProtonMail domain with SPF, DKIM, DMARC configured
- Incident details with actionable links
- HTML email templates

**Push Notifications (🚧 Infrastructure Ready):**
- FCM (Android) + APNs (iOS) via AWS SNS
- Device tokens registered per user
- High-priority messages
- Deep linking to incident detail
- Requires mobile app implementation

**SMS (🚧 Infrastructure Ready):**
- AWS SNS for SMS delivery
- Fallback channel when email/push unavailable
- Rate limiting to control costs

**Future Notification Channels:**
- Voice calls with TTS (Twilio)
- Email-to-incident (SES receiving rules + Lambda)

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

## Cost Breakdown (Actual Production Deployment)

### Current Monthly Cost

| Service | Configuration | Cost |
|---------|---------------|------|
| ECS Fargate (3 services) | API + Alert Processor + Notification Worker | ~$15 |
| RDS PostgreSQL | db.t4g.micro | ~$13 |
| Application Load Balancer | 1 ALB | ~$20 |
| CloudFront CDN | Global distribution | ~$5 |
| Cognito + SQS + Logs | Standard usage | ~$5 |
| **Total Infrastructure** | | **~$58/month** |

### Cost Per User Analysis

| Users | Cost per User | Notes |
|-------|--------------|--------|
| 10 users | ~$5.80/user | Within target range |
| 20 users | ~$2.90/user | Well under target |
| 50 users | ~$1.16/user | Highly cost-effective |

**Target Achieved:** $3-6/user for 10-20 users ✅

**vs PagerDuty:** $29-49/user/month → **87-90% cost savings** ✅

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

### Immediate Priority
1. **Mobile App Implementation** - React Native/Expo app with incident management
2. **Push Notification Integration** - FCM + APNs registration and delivery
3. **SMS Fallback** - Implement AWS SNS SMS delivery

### Short Term
1. Email-to-incident parsing (SES receiving rules + Lambda)
2. Heartbeat monitoring for dead man's switch
3. Automatic schedule rotations
4. Multi-tenant organization switching UI

### Long Term
1. Add ElastiCache Redis for rate limiting
2. Implement WebSocket for real-time updates
3. Multi-region deployment for global teams
4. Add read replicas for reporting queries
5. Voice call fallback (Twilio integration)
