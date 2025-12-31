# OnCallShift - Incident Management Platform

A cost-effective incident management and on-call platform built on AWS, providing core PagerDuty-like features at a fraction of the cost (~$5-10/user/month vs $29-49/user/month).

**Live URL:** https://oncallshift.com

---

## Features

### Core Platform
- **Incident Management** - Create, acknowledge, resolve with full audit trail
- **Escalation Policies** - Multi-level PagerDuty-style escalation with automatic timeout advancement
- **On-Call Schedules** - Schedule management with member assignment and overrides
- **Multi-Channel Notifications** - Push, Email, SMS with delivery tracking
- **User Actions** - Reassign, snooze, manual escalate, add responders

### Mobile App (iOS & Android)
- 20 React Native screens for full incident management
- Push notifications with deep linking
- Incident list, detail, and actions
- On-call schedule view
- Analytics dashboard

### Advanced Features
- **Runbooks** - Pre-defined remediation steps with one-click execution
- **AI Diagnosis** - Claude-powered incident analysis and chat
- **Setup Wizard** - Guided onboarding for new organizations
- **Notification Status** - Per-user delivery tracking (sent, delivered, failed)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Mobile App (Expo/React Native)              │
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

### AWS Services
- **ECS Fargate**: 3 services (API, Alert Processor, Notification Worker)
- **RDS PostgreSQL**: Primary database
- **SQS**: Alert and notification queues with DLQs
- **Cognito**: JWT authentication
- **CloudFront + S3**: Frontend CDN hosting
- **SES**: Email delivery (noreply@oncallshift.com)
- **SNS**: SMS notifications

### Cost
- **Monthly:** ~$58/month
- **Per User:** ~$3-6/month (for 10-20 users)
- **Savings:** 87-90% cheaper than PagerDuty

---

## Quick Start

### Local Development

```bash
# Backend
cd backend
npm install
npm run dev          # localhost:3000

# Frontend
cd frontend
npm install
npm run dev          # localhost:5173

# Mobile
cd mobile
npm install
npm start            # Expo dev server
```

### Deployment

```bash
./deploy.sh          # Full deployment (ECR + ECS + CloudFront)
```

### Create User

```bash
aws cognito-idp admin-create-user \
  --user-pool-id REDACTED_COGNITO_POOL_ID \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com

aws cognito-idp admin-set-user-password \
  --user-pool-id REDACTED_COGNITO_POOL_ID \
  --username user@example.com \
  --password YourPassword123! \
  --permanent
```

---

## Directory Structure

```
pagerduty-lite/
├── backend/                 # Express + TypeScript API
│   ├── src/api/            # Routes and middleware
│   ├── src/workers/        # Background processors
│   └── src/shared/         # Models, utilities
├── frontend/               # React + Vite web app
│   ├── src/pages/          # Page components
│   └── src/components/     # Shared components
├── mobile/                 # React Native + Expo app
│   ├── src/screens/        # Screen components
│   └── src/services/       # API client, auth
└── infrastructure/         # Terraform IaC
    └── terraform/
```

---

## Infrastructure Management

**Terraform is the source of truth.** Never make manual changes in AWS Console.

```bash
cd infrastructure/terraform/environments/dev
terraform init
terraform plan
terraform apply
```

---

## Documentation

- **[ROADMAP.md](ROADMAP.md)** - Feature roadmap and remaining work
- **[CLAUDE.md](CLAUDE.md)** - AI assistant guidance
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Technical architecture
- **[mobile/README.md](mobile/README.md)** - Mobile app guide

---

## Key URLs

| Resource | URL |
|----------|-----|
| Live App | https://oncallshift.com |
| API Docs | https://oncallshift.com/api-docs |
| Webhook | POST https://oncallshift.com/api/alerts/webhook |

---

## Troubleshooting

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

## License

MIT
