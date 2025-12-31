# OnCallShift Roadmap

**Last Updated:** December 2024

This document tracks remaining work for the OnCallShift incident management platform.

---

## Current State: Feature-Complete Production Platform

OnCallShift is deployed at https://oncallshift.com with comprehensive functionality:

### Completed Features

| Feature | Status |
|---------|--------|
| **Mobile App** | 20 React Native screens (incidents, schedules, settings, analytics, AI chat) |
| **Escalation Timer** | Automatic step advancement with configurable timeouts |
| **Multi-Channel Notifications** | Push, Email, SMS with delivery tracking |
| **User Actions** | Acknowledge, Resolve, Reassign, Snooze, Manual Escalate |
| **Runbooks** | Full CRUD with one-click action execution |
| **AI Diagnosis** | Claude-powered incident analysis and chat |
| **Setup Wizard** | Web and mobile onboarding flow |
| **Notification Status Panel** | Per-user delivery status tracking |
| **Audit Trail** | Comprehensive incident event logging |
| **CI/CD Pipeline** | GitHub Actions with Terraform approval workflow |

---

## Remaining Work

### Phase 1: Production Hardening (2-3 weeks)

#### 1.1 Testing (Current Coverage: ~0%)

Priority tests needed:
- Escalation timer logic (timeout calculation, step advancement)
- Alert deduplication
- Notification delivery
- Incident state transitions
- API authentication/authorization

**Target:** 80% coverage on critical paths

#### 1.2 Security Improvements

| Task | Priority | Status |
|------|----------|--------|
| Webhook signatures (HMAC-SHA256) | P1 | Not started |
| API key hashing | P1 | Not started |
| Secrets Manager integration | P2 | Partial |

#### 1.3 Reliability Improvements

| Task | Priority | Status |
|------|----------|--------|
| Retry logic with exponential backoff | P1 | Partial |
| Transaction boundaries | P1 | Partial |
| Graceful shutdown | P2 | Not started |
| Circuit breakers | P2 | Not started |

---

### Phase 2: Notification Enhancements (2 weeks)

#### 2.1 Notification Fallback Chain

**Current:** Sends channels based on severity
**Required:** Sequential fallback with delays

```
Push → (wait 2 min) → SMS → (wait 3 min) → Voice
         ↓                    ↓                ↓
    Check if ack'd       Check if ack'd   Final attempt
```

#### 2.2 User Notification Preferences

- Per-user default channels
- Quiet hours (time-based suppression)
- High urgency override for critical incidents

#### 2.3 Repeat Notifications

Re-page at configurable intervals until acknowledged.

---

### Phase 3: Missing MVP Features (2 weeks)

#### 3.1 Heartbeat Monitoring

Dead man's switch for cron jobs and batch processes:
```
POST /api/v1/heartbeat/:token  # Record heartbeat
GET  /api/v1/heartbeat/:token  # For curl/wget
```

#### 3.2 Email-to-Incident

- SES inbound email configuration
- Email parsing to create incidents
- Service mapping by email address

#### 3.3 Maintenance Windows

- Service-level scheduled windows
- Option to suppress or just skip notifications
- Calendar integration

---

### Phase 4: DevOps Differentiators (4-6 weeks)

#### 4.1 Service Dependency Graph

- Track service dependencies
- Blast radius visualization
- Cascading escalation to dependent teams

#### 4.2 Noise Suppression

- Flapping detection (suppress repeated fire/resolve)
- Correlation rules (parent alert suppresses children)
- Suggested rules from historical patterns

#### 4.3 CLI Tool

```bash
ocs incidents list
ocs incidents ack INC-123
ocs oncall show
ocs alert create --service api --severity critical --summary "Test"
```

#### 4.4 Slack Integration

- Post incidents to channels
- Interactive ack/resolve buttons
- Slash commands (/oncall, /incident, /ack)

#### 4.5 Terraform Provider

```hcl
resource "oncallshift_service" "api" {
  name = "API Service"
  escalation_policy_id = oncallshift_escalation_policy.primary.id
}
```

---

### Phase 5: Enterprise Features (6-8 weeks)

#### 5.1 SSO/SAML

- SAML 2.0 support (Okta, Azure AD, OneLogin)
- Just-in-time user provisioning
- Role mapping from IdP groups

#### 5.2 Advanced RBAC

Custom roles with granular permissions:
- incidents.view, incidents.acknowledge, incidents.resolve
- schedules.view, schedules.edit
- billing.view, billing.manage

#### 5.3 SLA Tracking

- Define ack/resolve SLAs per severity
- Compliance dashboard
- At-risk alerts

#### 5.4 Billing Integration

- Stripe subscription management
- Usage metering
- Per-org billing dashboard

---

### Phase 6: AI & Intelligence (Ongoing)

#### 6.1 Similar Incident Detection

Find past incidents with similar signatures and show resolution steps.

#### 6.2 Predictive Alerting

Analyze patterns and suggest proactive measures.

#### 6.3 Auto-Remediation

Define automated actions for known issues (restart, scale, rollback).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                     │
│                    Web App (React)                       │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTPS
┌─────────────────▼───────────────────────────────────────┐
│               Application Load Balancer                  │
└─────────────────┬───────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼───┐   ┌─────▼─────┐   ┌───▼───────────┐
│  API  │   │  Alert    │   │  Notification │
│Service│   │ Processor │   │    Worker     │
└───┬───┘   └─────┬─────┘   └───────┬───────┘
    │             │                 │
    └──────┬──────┴────────────────┬┘
           │                       │
    ┌──────▼──────┐         ┌──────▼──────┐
    │    RDS      │         │    SQS      │
    │ PostgreSQL  │         │   Queues    │
    └─────────────┘         └─────────────┘
```

**Cost:** ~$58/month (~$3-6/user for 10-20 users)
**Savings:** 87-90% vs PagerDuty ($29-49/user)

---

## Quick Reference

### Deploy Changes
```bash
./deploy.sh  # Full deployment
```

### Create User
```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_vMk9CQycK \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com

aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_vMk9CQycK \
  --username user@example.com \
  --password YourPassword123! \
  --permanent
```

### Check Service Status
```bash
aws ecs describe-services --cluster pagerduty-lite-dev \
  --services pagerduty-lite-dev-api --region us-east-1
```

### View Logs
```bash
aws logs tail /ecs/pagerduty-lite-dev/api --follow --region us-east-1
```

---

## Key URLs

| Resource | URL |
|----------|-----|
| Live App | https://oncallshift.com |
| API Docs | https://oncallshift.com/api-docs |
| Webhook | https://oncallshift.com/api/alerts/webhook |
