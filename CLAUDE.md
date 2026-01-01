# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OnCallShift is a production incident management platform deployed at https://oncallshift.com. It's a full-stack TypeScript application with:
- Backend API (Express + TypeScript)
- Web frontend (React + Vite)
- Mobile app (React Native + Expo)
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
npm run migrate:create  # Create new migration
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
npm run start:snooze-expiry      # Snooze expiry worker
npm run start:report-scheduler   # Report scheduler worker
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # Development server (localhost:5173)
npm run build        # Production build (includes tsc)
npm run lint         # ESLint
npm run preview      # Preview production build
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
- **backend/src/api/routes/**: REST API routes (33 route files)
- **backend/src/workers/**: Background processors (alert-processor, notification-worker, escalation-timer, snooze-expiry, report-scheduler)
- **backend/src/shared/models/**: TypeORM database entities (60+ models)
- **backend/src/shared/**: Middleware, utilities, database configuration
- **frontend/src/pages/**: React page components
- **frontend/src/components/**: Shared UI components
- **mobile/src/screens/**: React Native screens
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

### Database Models (TypeORM)
See `backend/src/shared/models/` for 60+ entity definitions. Core entities include Organization, User, Team, Service, Schedule, Incident, EscalationPolicy, Notification.

### Testing
Backend tests are in `backend/src/**/__tests__/*.test.ts` using Jest with ts-jest. Test files are colocated near the code they test.

## Key Patterns

### API Routes
Routes in `backend/src/api/routes/` follow RESTful patterns. Auth middleware protects authenticated endpoints.

### Multi-Tenancy
All queries scoped by `org_id`. Users belong to organizations.

### Workers
Workers in `backend/src/workers/` consume from SQS queues using long polling or run on timers. Each deployed as separate ECS tasks:
- **alert-processor**: Processes incoming alerts from SQS queue
- **notification-worker**: Delivers notifications via email/push/SMS
- **escalation-timer**: Auto-advances escalation steps, handles heartbeats
- **snooze-expiry**: Processes expired incident snoozes
- **report-scheduler**: Generates scheduled reports

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
aws logs tail /ecs/pagerduty-lite-dev/alert-processor --follow --region us-east-1
aws logs tail /ecs/pagerduty-lite-dev/notification-worker --follow --region us-east-1
```

### Database Access

**Note:** The RDS database is in a private subnet and is not reachable from local development machines. Database operations must go through ECS tasks or the AWS console.

```bash
# Migrations run automatically during ECS deployment via deploy.sh
# To run migrations manually, use ECS exec:
aws ecs execute-command --cluster pagerduty-lite-dev \
  --task <task-id> --container api --interactive \
  --command "node dist/shared/db/migrate.js"

# Create new migration (local)
cd backend && npm run migrate:create
```

## Key API Endpoints

Main API routes include:
- `/api/v1/incidents` - Incident CRUD + actions (acknowledge, resolve, reassign, escalate)
- `/api/v1/alerts/webhook` - Alert ingestion (PagerDuty/Opsgenie compatible)
- `/api/v1/services`, `/api/v1/teams`, `/api/v1/users` - Core entities
- `/api/v1/schedules` - On-call schedules with `/oncall` for current on-call
- `/api/v1/escalation-policies` - Multi-step escalation definitions
- `/api/v1/runbooks` - Runbook management and execution
- `/api/v1/ai-assistant` - AI-powered incident analysis
- `/api/v1/cloud-credentials` - Cloud provider credentials for investigation
- `/api/v1/status-pages` - Public/private status pages
- `/api/v1/import`, `/api/v1/export` - Platform migration tools
