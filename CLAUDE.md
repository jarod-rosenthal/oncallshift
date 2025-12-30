# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PagerDuty-Lite (OnCallShift) is a cost-effective incident management platform deployed at https://oncallshift.com. It's a full-stack TypeScript application with a backend API, React web frontend, React Native mobile app, and AWS infrastructure managed by Terraform.

## Build and Development Commands

### Backend (Express + TypeScript)
```bash
cd backend
npm install
npm run dev          # Development server with hot reload (localhost:3000)
npm run build        # TypeScript compilation
npm run start        # Production server
npm run migrate      # Run database migrations
npm run seed         # Seed test data
npm test             # Run Jest tests
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev          # Development server (localhost:5173)
npm run build        # Production build
npm run lint         # ESLint
```

### Mobile (React Native + Expo)
```bash
cd mobile
npm install
npm start            # Expo Metro bundler
npm run android      # Run on Android
npm run ios          # Run on iOS
```

### Deployment
```bash
./deploy.sh          # Full deployment (build + push to ECR + deploy to ECS + CloudFront invalidation)
```

### Infrastructure (Terraform)
```bash
cd infrastructure/terraform/environments/dev
terraform init
terraform plan
terraform apply
```

## Architecture

### Component Structure
- **backend/src/api/**: Express REST API with routes in `routes/`, app setup in `app.ts`
- **backend/src/workers/**: Background job processors (alert-processor, notification-worker, escalation-timer)
- **backend/src/shared/**: Database models (TypeORM), middleware, utilities
- **frontend/src/pages/**: React page components with React Router
- **frontend/src/lib/**: API client (Axios), utilities
- **frontend/src/store/**: Zustand auth store
- **mobile/src/screens/**: React Native screens
- **mobile/src/services/**: API client, auth, push notifications
- **infrastructure/terraform/**: AWS infrastructure as code

### Data Flow
1. **Alert Ingestion**: External webhook → API → SQS `alerts_queue` → Alert Processor Worker → Creates incident → Triggers escalation
2. **Notifications**: Escalation step → SQS `notifications_queue` → Notification Worker → Email (SES), Push (FCM/APNs), SMS (SNS)
3. **Authentication**: AWS Cognito JWT tokens verified by middleware in `backend/src/shared/middleware/`

### AWS Services
- **ECS Fargate**: 3 services (API, Alert Processor, Notification Worker)
- **RDS PostgreSQL**: Primary database (db.t4g.micro)
- **SQS**: Alert and notification queues with DLQs
- **Cognito**: JWT authentication
- **CloudFront + S3**: Frontend CDN hosting
- **SES**: Email delivery (noreply@oncallshift.com)
- **ALB**: HTTPS load balancing

### Database Models (backend/src/shared/models/)
Key entities: Organization, User, Service, Schedule, ScheduleMember, Incident, IncidentEvent, EscalationPolicy, EscalationStep, Notification, DeviceToken

## Key Patterns

### API Routes
Routes follow RESTful patterns in `backend/src/api/routes/`. Each route file exports an Express router. Auth middleware protects routes requiring authentication.

### Multi-Tenancy
All queries are scoped by `org_id`. Users belong to organizations via the User model's `org_id` field.

### Workers
Workers in `backend/src/workers/` consume from SQS queues using long polling. They're deployed as separate ECS tasks from the API.

### Frontend State
- Server state: TanStack React Query
- Auth state: Zustand store (`frontend/src/store/auth-store.ts`)
- Forms: React Hook Form

### Mobile Navigation
React Navigation with bottom tabs for main screens, stack navigation for detail flows. Deep linking configured for push notifications.

## Infrastructure Rules

**Terraform is the source of truth.** Never make manual changes in AWS Console. All infrastructure changes must go through:
1. Update Terraform files in `infrastructure/terraform/environments/dev/`
2. `terraform plan` to review
3. `terraform apply` to deploy
4. Commit changes to git

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- `deploy.yml`: Orchestrator (manual trigger)
- `_infra.yml`: Terraform with plan approval via GitHub Issues
- `_backend.yml`: Docker build → ECR → ECS deploy
- `_frontend.yml`: npm build → S3 → CloudFront invalidation
- `_mobile.yml`: Expo EAS build

## Environment

- **AWS Region**: us-east-1
- **Live URL**: https://oncallshift.com
- **API Docs**: https://oncallshift.com/api-docs
- **Cognito User Pool**: us-east-1_vMk9CQycK
