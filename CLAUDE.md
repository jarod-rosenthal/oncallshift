# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OnCallShift is a production incident management platform deployed at https://oncallshift.com. It's a full-stack TypeScript application with:
- Backend API (Express + TypeScript)
- Web frontend (React + Vite)
- Mobile app (React Native + Expo) - 20 screens
- AWS infrastructure managed by Terraform

## Build and Development Commands

### Backend
```bash
cd backend
npm install
npm run dev          # Development server (localhost:3000)
npm run build        # TypeScript compilation
npm run start        # Production server
npm run migrate      # Run database migrations
npm run seed         # Seed test data
npm run lint         # ESLint
npm test             # Run all tests
npm test -- --testPathPattern=webhooks  # Run single test file
```

### Backend Workers
```bash
cd backend
npm run start:worker             # Notification worker
npm run start:escalation-timer   # Escalation timer worker
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # Development server (localhost:5173)
npm run build        # Production build
npm run lint         # ESLint
```

### Mobile
```bash
cd mobile
npm install
npm start            # Expo Metro bundler
npm run android      # Run on Android
npm run ios          # Run on iOS
```

### Deployment
```bash
./deploy.sh          # Full deployment (ECR + ECS + CloudFront invalidation)
```

### Infrastructure
```bash
cd infrastructure/terraform/environments/dev
terraform init
terraform plan
terraform apply
```

## Architecture

### Component Structure
- **backend/src/api/routes/**: REST API routes (incidents, services, schedules, runbooks, ai-diagnosis, notifications)
- **backend/src/workers/**: Background processors (alert-processor, notification-worker, escalation-timer)
- **backend/src/shared/**: Database models (TypeORM), middleware, utilities
- **frontend/src/pages/**: React page components
- **frontend/src/components/**: Shared UI components
- **mobile/src/screens/**: React Native screens (20 implemented)
- **mobile/src/services/**: API client, auth, push notifications, runbooks
- **mobile/src/components/**: Shared mobile components

### Key Features Implemented
- **Escalation Timer**: `backend/src/workers/escalation-timer.ts` - Auto-advances escalation steps
- **Runbooks**: `backend/src/api/routes/runbooks.ts` - CRUD + execution
- **AI Diagnosis**: `backend/src/api/routes/ai-diagnosis.ts` - Claude-powered analysis
- **User Actions**: Reassign, escalate in `backend/src/api/routes/incidents.ts`
- **Setup Wizard**: `frontend/src/pages/SetupWizard.tsx` and `mobile/src/screens/SetupWizardScreen.tsx`
- **Notification Tracking**: Delivery status per user/channel

### Data Flow
1. **Alert Ingestion**: Webhook → API → SQS → Alert Processor → Incident created → Escalation starts
2. **Escalation**: Escalation Timer checks every 30s → Advances steps → Triggers notifications
3. **Notifications**: Notification Worker → Email (SES), Push (Expo), SMS (SNS)
4. **Authentication**: AWS Cognito JWT tokens verified by middleware

### Database Models
Key entities: Organization, User, Service, Schedule, ScheduleMember, Incident, IncidentEvent, EscalationPolicy, EscalationStep, Notification, DeviceToken, Runbook, RunbookStep

### Testing
Tests are in `backend/src/**/__tests__/*.test.ts` using Jest with ts-jest. Test files are colocated near the code they test.

## Key Patterns

### API Routes
Routes in `backend/src/api/routes/` follow RESTful patterns. Auth middleware protects authenticated endpoints.

### Multi-Tenancy
All queries scoped by `org_id`. Users belong to organizations.

### Workers
Workers in `backend/src/workers/` consume from SQS queues using long polling. Deployed as separate ECS tasks.

### Frontend State
- Server state: TanStack React Query
- Auth state: Zustand store
- Forms: React Hook Form

### Mobile Navigation
React Navigation with bottom tabs + stack navigation. Deep linking for push notifications.

## Infrastructure Rules

**Terraform is the source of truth.** Never make manual AWS Console changes.

1. Update Terraform files in `infrastructure/terraform/environments/dev/`
2. `terraform plan` to review
3. `terraform apply` to deploy
4. Commit changes to git

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- `deploy.yml`: Orchestrator (manual trigger)
- `_infra.yml`: Terraform with plan approval
- `_backend.yml`: Docker → ECR → ECS
- `_frontend.yml`: Build → S3 → CloudFront
- `_mobile.yml`: Expo EAS build

## Environment

- **AWS Region**: us-east-1
- **Live URL**: https://oncallshift.com
- **API Docs**: https://oncallshift.com/api-docs
- **Cognito User Pool**: us-east-1_vMk9CQycK

## Troubleshooting

### View ECS Service Status
```bash
aws ecs describe-services --cluster pagerduty-lite-dev \
  --services pagerduty-lite-dev-api --region us-east-1
```

### View Logs
```bash
aws logs tail /ecs/pagerduty-lite-dev/api --follow --region us-east-1
```

## Recent Changes (December 2024)

- Full mobile app implementation (20 screens)
- Runbooks with one-click action execution
- AI diagnosis and chat features
- Setup wizard for new organizations
- Notification status panel with delivery tracking
- User actions: reassign, manual escalate
- PagerDuty/Opsgenie compatible webhooks and import wizard
- Escalation timer auto-advancement
- Heartbeat monitors for dead man's switch functionality
