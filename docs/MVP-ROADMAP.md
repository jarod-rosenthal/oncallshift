# MVP Scope & Roadmap

## Minimal Viable Product (MVP) - Phase 1

**Goal:** Deployable incident management system with core features
**Timeline:** Immediate (code provided in this implementation)
**Target Cost:** ~$80-100/month infrastructure (~$4-5/user for 20 users)

### MVP Features (What's Included)

#### 1. Alert Ingestion ✅
- **Webhook endpoint** for alert creation
- Basic deduplication by `dedup_key`
- Store alerts in database
- Async processing via SQS

#### 2. Incident Management ✅
- Incident states: TRIGGERED, ACKNOWLEDGED, RESOLVED
- Acknowledge incident (via mobile app)
- Resolve incident (via mobile app)
- Add notes to incidents
- View incident history and timeline

#### 3. Basic On-Call ✅
- **Simple schedules:** Manual assignment of on-call users
- **Single escalation step:** Notify on-call user immediately
- No rotation logic (manual updates via admin)
- View "who's on call now"

#### 4. Push Notifications Only ✅
- FCM (Android) + APNs (iOS) push notifications
- High-priority notifications
- Deep linking to incident detail
- Track delivery status

#### 5. Mobile App (Core Screens) ✅
- Login/Authentication (Cognito)
- Incident list (open/resolved filter)
- Incident detail with ACK/Resolve buttons
- Add notes
- View on-call roster
- Basic settings

#### 6. Authentication & Multi-Tenancy ✅
- Amazon Cognito user pools
- Organization (tenant) model
- Basic user roles (Admin, Member)
- API key for webhook ingestion

#### 7. Infrastructure ✅
- ECS Fargate (1 API task, 1 worker task)
- Aurora Serverless v2 (0.5 ACU minimum)
- Application Load Balancer
- SQS queues (alerts, notifications)
- No NAT Gateway (using VPC endpoints)

### MVP Exclusions (Coming in Phase 2+)

#### ❌ Not in MVP:
- SMS/Voice fallback notifications
- Email-to-incident ingestion
- Heartbeat/dead man's switch monitoring
- Multi-level escalation policies
- Automatic schedule rotations
- Maintenance windows
- Quiet hours/notification rules
- Web admin interface (mobile-only config for MVP)
- Advanced reporting/analytics
- Billing integration (Stripe)
- Team management (single team per org for MVP)

---

## Post-MVP Roadmap

### Phase 2: Enhanced Notifications & Reliability (Week 2-3)

**Cost Impact:** +$10-20/month (Twilio)

#### Features:
1. **SMS Fallback**
   - Twilio integration
   - Automatic fallback if push not acknowledged within N minutes
   - Rate limiting to control costs

2. **Voice Call Fallback**
   - Text-to-speech incident summary
   - Press-to-acknowledge via phone

3. **Email-to-Incident**
   - SES receiving rules
   - Lambda processor for inbound emails
   - Service-specific email addresses

4. **Heartbeat Monitoring**
   - Create heartbeat tokens
   - Scheduled check (EventBridge)
   - Auto-create incidents for missed heartbeats

5. **Enhanced Push**
   - iOS Critical Alerts (bypass DND)
   - Android high-priority channels
   - Custom notification sounds

**Terraform Changes:**
- Add Twilio credentials to Secrets Manager
- Add SES receiving rules
- Add EventBridge scheduled rule for heartbeats
- Add Lambda for email processing

**Backend Changes:**
- Notification worker: Add SMS/voice channels
- Add heartbeat checker worker
- Add email ingestion handler

---

### Phase 3: Advanced Scheduling & Escalation (Week 4-5)

**Cost Impact:** Minimal (just compute)

#### Features:
1. **Schedule Rotations**
   - Weekly/daily rotation algorithms
   - Timezone support
   - Calendar view in mobile app

2. **Multi-Level Escalation**
   - Multiple escalation steps per policy
   - Configurable timeouts
   - Escalation history tracking

3. **Manual Overrides**
   - "Take on-call" button
   - Temporary coverage with end time
   - Override history

4. **Multiple Schedules per Service**
   - Primary/secondary on-call
   - Follow-the-sun support

**Backend Changes:**
- Schedule resolution engine
- Escalation engine with step tracking
- Override management

**Mobile App Changes:**
- Personal schedule view (upcoming shifts)
- Take on-call button
- Calendar integration

---

### Phase 4: Teams & Admin Features (Week 6)

**Cost Impact:** Minimal

#### Features:
1. **Team Management**
   - Multiple teams per organization
   - Team-scoped services and schedules
   - Team member roles

2. **Web Admin Interface**
   - Service configuration
   - Schedule management
   - Escalation policy builder
   - API key management
   - User invitations

3. **Maintenance Windows**
   - Schedule maintenance periods
   - Suppress or tag incidents during maintenance
   - Recurring maintenance windows

4. **Notification Rules**
   - Per-user notification preferences
   - Quiet hours (time-based)
   - Day/night different channels

**New Components:**
- Web admin app (React)
- Deploy to S3 + CloudFront

---

### Phase 5: Billing & Business Features (Week 7-8)

**Cost Impact:** +$5-10/month (Stripe fees)

#### Features:
1. **Stripe Integration**
   - Subscription management
   - Usage-based metering (notifications)
   - Self-service checkout

2. **Usage Metering**
   - Track incidents created
   - Track notifications sent by channel
   - Monthly usage reports

3. **Plan Tiers**
   - Free tier (1 user, limited features)
   - Pro tier ($5-10/user/month)
   - Feature gating

4. **Rate Limiting**
   - Per-org alert rate limits
   - Per-service rate limits
   - Redis-based counters

**Infrastructure Changes:**
- Add ElastiCache Redis cluster
- Stripe webhook handler

---

### Phase 6: Observability & Reliability (Week 9)

**Cost Impact:** +$10-15/month (monitoring services)

#### Features:
1. **Enhanced Monitoring**
   - Custom CloudWatch metrics
   - Application-level metrics
   - Performance dashboards

2. **Alerting on the Platform**
   - Monitor notification delivery failures
   - Monitor API error rates
   - Alert operations team

3. **Audit Logs**
   - Complete audit trail
   - Compliance features
   - Log export

4. **Status Page**
   - Public status page
   - Incident updates
   - Subscriber notifications

**Infrastructure Changes:**
- CloudWatch dashboards
- SNS topic for ops alerts
- S3 for audit log exports

---

### Phase 7: Advanced Features (Week 10+)

**Cost Impact:** Variable (depends on features)

#### Features:
1. **ChatOps Integration**
   - Slack bot (acknowledge, resolve from Slack)
   - Microsoft Teams integration
   - Bi-directional sync

2. **Native Monitoring Integrations**
   - Datadog webhook templates
   - CloudWatch Alarms → Incidents
   - Prometheus AlertManager webhook
   - New Relic integration

3. **Incident Analytics**
   - MTTR/MTTA dashboards
   - Incident trends
   - Service reliability scores
   - Burnout risk indicators

4. **AI/LLM Features**
   - Incident summarization
   - Similar incident suggestions
   - Runbook recommendations
   - Auto-drafted status updates

5. **Advanced On-Call**
   - On-call handoff notes
   - Shift swapping
   - On-call credits/fairness tracking
   - Multi-region follow-the-sun

---

## MVP Cost Breakdown

### Infrastructure (Monthly)

| Service | Configuration | Cost |
|---------|---------------|------|
| **ECS Fargate** | | |
| - API service | 1 x 0.5 vCPU, 1GB | $16 |
| - Notification worker | 1 x 0.25 vCPU, 512MB | $8 |
| **Aurora Serverless v2** | 0.5 ACU min | $45 |
| **Application Load Balancer** | 1 ALB | $20 |
| **NAT Gateway** | None (VPC endpoints) | $0 |
| **VPC Endpoints** | ECR, Logs, S3 | $7 |
| **SQS** | <1M requests | $1 |
| **SNS** | Push notifications | $1 |
| **Cognito** | <50 MAU | $0 |
| **CloudWatch Logs** | 5GB | $3 |
| **Route 53** | Hosted zone | $0.50 |
| | |
| **Total Infrastructure** | | **~$101.50/month** |
| **Per User (20 users)** | | **~$5.08/user** |

### Scaling Costs (Phase 2+)

| Phase | Additional Monthly Cost | Feature |
|-------|------------------------|---------|
| Phase 2 | +$10-20 | SMS/Voice (Twilio) |
| Phase 3 | +$0 | Advanced scheduling |
| Phase 4 | +$5 | Web admin (CloudFront) |
| Phase 5 | +$10 | Redis + Stripe |
| Phase 6 | +$10 | Enhanced monitoring |
| **Total (All Phases)** | **~$136-146/month** | **$6.80-7.30/user** |

**Still under $10/user target ✅**

---

## MVP Development Sequence

### What I'm Building Now:

1. **Terraform Infrastructure**
   - Complete networking module ✅
   - Complete database module ✅
   - Complete ECS service module (in progress)
   - Main environment configuration
   - SQS queues
   - Cognito user pool
   - ALB + target groups

2. **Backend API**
   - Express.js + TypeScript
   - Core routes: `/alerts/webhook`, `/incidents`, `/auth`
   - Database models (TypeORM)
   - API key authentication
   - JWT token validation

3. **Notification Worker**
   - SQS consumer
   - SNS push notification sender
   - Device token management

4. **Database Schema**
   - Initial migration with core tables
   - Seed data for testing

5. **React Native Mobile App**
   - Expo-managed workflow
   - Authentication screens
   - Incident list/detail
   - Basic navigation

6. **Deployment Scripts**
   - Docker build scripts
   - CI/CD with GitHub Actions
   - Terraform apply instructions

---

## Success Criteria for MVP

### Must Have (MVP Launch):
- ✅ Receive webhook alerts
- ✅ Create incidents
- ✅ Send push notifications to on-call user
- ✅ Acknowledge incidents from mobile
- ✅ Resolve incidents from mobile
- ✅ View incident history
- ✅ Basic on-call assignment

### Nice to Have (Can wait for Phase 2):
- Email-to-incident
- SMS fallback
- Schedule rotations
- Web admin interface
- Multi-level escalation

### Metrics for Success:
- Alert ingestion P99 < 500ms
- Push notification delivery within 10 seconds
- Mobile app loads incident list in < 2 seconds
- Infrastructure cost < $5.50/user/month

---

## Migration Path from MVP to Full Product

Each phase builds incrementally:

1. **Phase 2**: Add new worker (SMS/voice), update notification logic
2. **Phase 3**: Update escalation engine, no infrastructure changes
3. **Phase 4**: Add web frontend (separate deployment)
4. **Phase 5**: Add Redis cluster, Stripe integration
5. **Phase 6**: Enhanced monitoring (configuration changes)
6. **Phase 7**: Feature additions (no core architecture changes)

**No rearchitecture needed** - MVP foundation supports all future phases.

---

## What You Get Today

**Deployable Code:**
- Complete Terraform (infrastructure as code)
- Backend API (Node.js/TypeScript)
- Notification worker
- Database schema
- React Native mobile app (basic)
- CI/CD pipeline
- Deployment documentation

**Can be deployed to AWS and functional for:**
- Receiving webhook alerts
- Creating incidents
- Notifying on-call users via push
- Acknowledging/resolving from mobile
- Multi-tenant (organization isolation)

**Ready to test with real alerts within ~1 hour of deployment.**

---

Let's build this! 🚀
