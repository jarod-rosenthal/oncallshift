# OnCallShift Roadmap

**Last Updated:** December 2024

## Current Status: Production MVP

OnCallShift is a production-ready incident management platform deployed at https://oncallshift.com

### What's Deployed and Working

| Component | Status | Details |
|-----------|--------|---------|
| **Infrastructure** | ✅ Complete | VPC, ECS Fargate, RDS PostgreSQL, ALB, CloudFront, Cognito, SQS |
| **Backend API** | ✅ Complete | Express + TypeScript, all CRUD endpoints, Swagger docs |
| **Web Frontend** | ✅ Complete | React SPA, dashboard, incidents, schedules, services, escalation policies |
| **Alert Processing** | ✅ Complete | Webhook ingestion, deduplication, incident creation |
| **Email Notifications** | ✅ Complete | AWS SES via noreply@oncallshift.com |
| **Push Notifications** | ✅ Complete | Expo Push API for mobile |
| **SMS Notifications** | ✅ Complete | AWS SNS text messaging |
| **Escalation Policies** | ✅ Complete | Multi-level PagerDuty-style escalation |
| **On-Call Schedules** | ✅ Complete | Schedule management, member assignment |
| **CI/CD Pipeline** | ✅ Complete | GitHub Actions with Terraform approval workflow |
| **Terraform State** | ✅ Complete | S3 backend (oncallshift bucket) |

### Mobile App Status

The React Native/Expo mobile app is scaffolded with screens implemented:
- LoginScreen, ForgotPasswordScreen
- AlertListScreen, AlertDetailScreen
- OnCallScreen, ScheduleScreen
- SettingsScreen, AnalyticsScreen
- InboxScreen, TeamScreen, MoreScreen

**Pending:** Final testing, push notification registration, App Store/Play Store submission

---

## Remaining Work

### Priority 1: Mobile App Completion

| Task | Effort | Notes |
|------|--------|-------|
| Test all screens against live API | 1 day | Verify data flows correctly |
| Push notification registration | 1 day | Register device tokens with Expo |
| Deep linking from notifications | 1 day | Open specific incident from push |
| Build APK/IPA for testing | 1 day | EAS Build configured |
| App Store submission | 1 day | After testing complete |

### Priority 2: Production Hardening

| Task | Effort | Notes |
|------|--------|-------|
| Add rate limiting | 1 day | Protect webhook endpoint |
| Add webhook signatures | 1 day | HMAC-SHA256 verification |
| Add database indexes | 1 day | Performance optimization |
| Correlation IDs in logs | 1 day | Traceability |
| Unit test coverage | 2 weeks | Target 80% coverage |

### Priority 3: Enhanced Features

| Task | Effort | Notes |
|------|--------|-------|
| Voice call fallback | 1 week | Twilio integration |
| Notification delivery tracking | 1 week | Track sent/delivered/ack status |
| User notification preferences | 1 week | Per-user channel preferences |
| Quiet hours | 3 days | Time-based notification rules |
| Automatic schedule rotations | 1 week | Weekly/daily rotation logic |

### Priority 4: DevOps Features

| Task | Effort | Notes |
|------|--------|-------|
| Slack integration | 2 weeks | Notifications + interactive buttons |
| CLI tool (`ocs`) | 2 weeks | Command-line incident management |
| Heartbeat monitoring | 1 week | Dead man's switch |
| Maintenance windows | 1 week | Suppress alerts during maintenance |

### Priority 5: Enterprise Features

| Task | Effort | Notes |
|------|--------|-------|
| Analytics dashboard | 2 weeks | MTTA/MTTR metrics |
| SSO/SAML | 2 weeks | Enterprise auth |
| Advanced RBAC | 2 weeks | Fine-grained permissions |
| Billing (Stripe) | 2 weeks | Subscription management |
| Multi-tenant org switching | 1 week | UI for org management |

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

## CI/CD Pipeline

**Orchestrator:** `.github/workflows/deploy.yml`
- Manual trigger with stage checkboxes
- Environment selection (dev/staging/prod)
- Dry-run mode for testing

**Stages:**
1. **Infrastructure** (`_infra.yml`) - Terraform with plan approval via GitHub Issues
2. **Backend** (`_backend.yml`) - Docker build + ECR push + ECS deploy
3. **Frontend** (`_frontend.yml`) - npm build + S3 sync + CloudFront invalidation
4. **Mobile** (`_mobile.yml`) - Expo EAS build

---

## Key URLs

| Resource | URL |
|----------|-----|
| Live App | https://oncallshift.com |
| API Docs | https://oncallshift.com/api-docs |
| Webhook | https://oncallshift.com/api/alerts/webhook |
| GitHub | https://github.com/jarod-rosenthal/pagerduty-lite |

---

## Quick Reference

### Deploy Changes
```bash
./deploy.sh  # Local deployment script
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

## Documentation

- `docs/ARCHITECTURE.md` - Technical architecture details
- `README.md` - Project overview and quick start
- `mobile/README.md` - Mobile app development guide
