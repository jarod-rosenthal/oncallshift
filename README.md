# PagerDuty-Lite: Mobile-First Incident Management Platform

## Overview

PagerDuty-Lite is a cost-effective, mobile-first incident management and on-call platform built on AWS ECS. It provides core PagerDuty-style features at a fraction of the cost (~$5-10/user/month vs $29-49/user/month for PagerDuty).

## Project Status

### ✅ Completed

1. **Architecture & Planning**
   - Complete architecture documentation
   - MVP scope and post-MVP roadmap
   - Cost analysis showing ~$5/user for MVP

2. **Terraform Infrastructure** (100% Complete)
   - Networking module (VPC, subnets, security groups, VPC endpoints)
   - Database module (Aurora Serverless v2 with auto-scaling)
   - ECS service module (reusable for API and workers)
   - Complete dev environment configuration
   - SQS queues for async processing
   - SNS for push notifications
   - Cognito for authentication
   - Application Load Balancer

### ✅ Recently Completed

3. **React Web Frontend** (100% Complete)
   - Vite + React 18 + TypeScript setup ✅
   - Shadcn/ui + Tailwind CSS components ✅
   - Authentication pages (Login/Register) ✅
   - Dashboard with navigation ✅
   - Incidents management page ✅
   - Schedules management page ✅
   - Protected routes with automatic auth ✅
   - API client with token management ✅
   - Swagger/OpenAPI documentation ✅
   - Integrated with Express backend ✅

### 🚧 In Progress

4. **Backend API** (Started - 30% Complete)
   - Package.json and TypeScript configuration ✅
   - Database configuration and data source ✅
   - Swagger API documentation ✅
   - Demo dashboard ✅
   - **Still Needed:**
     - Database models (8 entities)
     - Complete API route implementations
     - SQS queue integration

5. **Workers** (Not Started)
   - Notification worker for push notifications

6. **Database** (Not Started)
   - Initial migration SQL
   - Seed data

7. **Mobile App** (Not Started)
   - React Native app with Expo
   - Core screens (login, incidents, detail)

8. **Deployment** (Not Started)
   - Dockerfiles for API and worker
   - GitHub Actions CI/CD
   - Deployment guide

## MVP Features

**What's Included in MVP:**
- ✅ Webhook alert ingestion
- ✅ Incident management (create, acknowledge, resolve)
- ✅ Basic on-call scheduling (manual assignment)
- ✅ Push notifications only (FCM + APNs)
- ✅ Mobile app (iOS + Android)
- ✅ Multi-tenant (organization isolation)
- ✅ JWT authentication via Cognito
- ✅ Web admin interface (React SPA)

**Excluded from MVP (Phase 2+):**
- SMS/Voice fallback
- Email-to-incident
- Heartbeat monitoring
- Multi-level escalation
- Schedule rotations (automatic)

See [docs/MVP-ROADMAP.md](docs/MVP-ROADMAP.md) for complete feature breakdown and post-MVP phases.

## Architecture

**Cost-Effective ECS-Based Architecture:**
- **No Kubernetes**: Saves ~$73/month (EKS control plane cost)
- **Aurora Serverless v2**: Auto-scales from 0.5 ACU (~$45/month)
- **VPC Endpoints**: No NAT Gateway (saves $32/month)
- **Fargate Spot** (optional): 70% cost savings for workers

**Estimated Infrastructure Cost:**
- Dev Environment: ~$100/month (~$5/user for 20 users) ✅
- With SMS/Voice (Phase 2): ~$130/month
- Full Production: ~$146/month (~$7.30/user)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for complete architecture details.

## Directory Structure

```
pagerduty-lite/
├── docs/
│   ├── ARCHITECTURE.md          # Complete architecture documentation
│   └── MVP-ROADMAP.md          # MVP scope and 7-phase roadmap
├── infrastructure/
│   └── terraform/
│       ├── modules/
│       │   ├── networking/      # VPC, subnets, security groups ✅
│       │   ├── database/        # Aurora Serverless v2 ✅
│       │   └── ecs-service/     # Reusable ECS service module ✅
│       └── environments/
│           └── dev/             # Dev environment config ✅
│               ├── main.tf
│               ├── variables.tf
│               ├── outputs.tf
│               └── terraform.tfvars.example
├── backend/
│   ├── src/
│   │   ├── api/                 # Express API service (in progress)
│   │   │   ├── routes/          # API routes ✅
│   │   │   ├── swagger.ts       # OpenAPI documentation ✅
│   │   │   └── app.ts           # Express app with frontend integration ✅
│   │   ├── workers/             # Background workers (not started)
│   │   └── shared/              # Shared code
│   │       ├── models/          # Database models (not started)
│   │       ├── db/              # Database config ✅
│   │       ├── queues/          # SQS helpers (not started)
│   │       ├── auth/            # Auth middleware (not started)
│   │       └── notifications/   # Notification helpers (not started)
│   ├── package.json             # ✅
│   └── tsconfig.json            # ✅
├── frontend/                    # React web application ✅
│   ├── src/
│   │   ├── components/          # UI components ✅
│   │   ├── pages/               # Login, Dashboard, Incidents, Schedules ✅
│   │   ├── lib/                 # API client and utilities ✅
│   │   ├── store/               # Zustand state management ✅
│   │   └── types/               # TypeScript types ✅
│   ├── dist/                    # Production build (served by backend) ✅
│   ├── package.json             # ✅
│   └── README.md                # Frontend documentation ✅
├── mobile/                      # React Native app (not started)
└── README.md                    # This file
```

## Quick Start (When Complete)

### Prerequisites

- AWS Account
- AWS CLI configured
- Terraform >= 1.0
- Node.js >= 18
- Docker
- (Optional) Firebase Cloud Messaging credentials
- (Optional) Apple Push Notification Service credentials

### 1. Deploy Infrastructure

```bash
cd infrastructure/terraform/environments/dev

# Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your AWS region and optional push notification credentials

# Deploy
terraform init
terraform apply

# Note the outputs, especially:
# - api_ecr_repository_url
# - worker_ecr_repository_url
# - alb_dns_name
# - cognito_user_pool_id
# - cognito_client_id
```

### 2. Build Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# The build output will be in dist/ and will be served by the backend
```

### 3. Build and Deploy Backend

```bash
cd backend

# Install dependencies
npm install

# Build Docker images
docker build -t API_ECR_URL:latest -f Dockerfile.api .
docker build -t WORKER_ECR_URL:latest -f Dockerfile.worker .

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin API_ECR_URL
docker push API_ECR_URL:latest
docker push WORKER_ECR_URL:latest

# Run migrations
npm run migrate
```

### 4. Configure and Build Mobile App

```bash
cd mobile

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with API URL, Cognito Pool ID, Client ID

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### 5. Create First Organization

```bash
# Use Cognito to create first user
aws cognito-idp sign-up \
  --client-id YOUR_COGNITO_CLIENT_ID \
  --username admin@example.com \
  --password YourPassword123!

# Confirm user
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@example.com

# Use API to create organization and service
curl -X POST http://YOUR_ALB_DNS/api/v1/organizations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name": "My Organization"}'
```

### 6. Test the Web Application

```bash
# Access the web frontend
open http://YOUR_ALB_DNS

# The frontend routes:
# /login - Login page
# /register - User registration
# / - Dashboard (protected, requires login)
# /incidents - Incidents management
# /schedules - On-call schedules
# /demo - Live demo dashboard
# /api-docs - Swagger API documentation
```

### 7. Test Alert Ingestion

```bash
# Send test alert
curl -X POST http://YOUR_ALB_DNS/api/v1/alerts/webhook \
  -H "X-API-Key: YOUR_SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service_key": "your-service-key",
    "summary": "Test alert - Database high CPU",
    "severity": "critical",
    "details": {
      "cpu": "95%",
      "host": "db-prod-01"
    }
  }'
```

## Development Status

### What Works Right Now

- ✅ Terraform infrastructure can be deployed
- ✅ Creates all AWS resources (VPC, ECS, Aurora, ALB, SQS, SNS, Cognito)
- ✅ Database configuration with Secrets Manager integration
- ✅ Complete React web frontend with authentication and incident management
- ✅ Express backend serves static frontend files
- ✅ Swagger/OpenAPI documentation at /api-docs
- ✅ Live demo dashboard at /demo

### What Needs to Be Built

**Backend API (~4-6 hours):**
1. Database models (8 entities with TypeORM)
2. API routes:
   - POST /api/v1/alerts/webhook
   - GET /api/v1/incidents
   - PUT /api/v1/incidents/:id/acknowledge
   - PUT /api/v1/incidents/:id/resolve
   - POST /api/v1/incidents/:id/notes
   - GET /api/v1/schedules/oncall
3. Authentication middleware (Cognito JWT verification)
4. SQS message publishing

**Notification Worker (~2-3 hours):**
1. SQS consumer
2. SNS push notification sender
3. Device token management
4. Delivery status tracking

**Database (~1-2 hours):**
1. Initial migration creating all tables
2. Seed data for testing

**Mobile App (~8-10 hours):**
1. Authentication screens
2. Incident list screen
3. Incident detail screen
4. On-call roster screen
5. Push notification handling
6. Deep linking

**Deployment (~2-3 hours):**
1. Dockerfiles (API and worker)
2. GitHub Actions workflow
3. Deployment documentation

**Total Estimated Time: 17-24 hours**

## Cost Breakdown

### MVP (Current Infrastructure)

| Service | Monthly Cost |
|---------|--------------|
| ECS Fargate (API + Worker) | $24 |
| Aurora Serverless v2 | $45 |
| Application Load Balancer | $20 |
| VPC Endpoints | $7 |
| SQS + SNS + Logs | $5 |
| **Total** | **$101/month** |
| **Per User (20 users)** | **$5.05/user** |

### With All Features (Phase 7)

| Service | Monthly Cost |
|---------|--------------|
| Base Infrastructure | $101 |
| Redis (ElastiCache) | $15 |
| Twilio (SMS/Voice) | $10-20 |
| Web Admin (CloudFront) | $5 |
| Enhanced Monitoring | $10 |
| **Total** | **$141-151/month** |
| **Per User (20 users)** | **$7.05-7.55/user** |

**Still significantly under the $29-49/user PagerDuty pricing** ✅

## Post-MVP Roadmap

- **Phase 2 (Week 2-3)**: SMS/Voice fallback, email-to-incident, heartbeats
- **Phase 3 (Week 4-5)**: Schedule rotations, multi-level escalation
- **Phase 4 (Week 6)**: Teams, web admin interface, maintenance windows
- **Phase 5 (Week 7-8)**: Stripe billing, usage metering, rate limiting
- **Phase 6 (Week 9)**: Enhanced monitoring, audit logs, status page
- **Phase 7 (Week 10+)**: ChatOps, analytics, AI features

See [docs/MVP-ROADMAP.md](docs/MVP-ROADMAP.md) for complete roadmap with features and costs.

## Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)**: Complete architecture, data flows, and technical details
- **[MVP-ROADMAP.md](docs/MVP-ROADMAP.md)**: MVP scope, exclusions, and 7-phase roadmap
- **Terraform Modules**: Each module has inline documentation

## Support

This is an MVP implementation. For production use:

1. Configure remote Terraform state (S3 + DynamoDB)
2. Set up proper CI/CD with approvals
3. Enable enhanced monitoring and alerting
4. Configure backup and disaster recovery
5. Implement proper secrets rotation
6. Add comprehensive error handling and logging
7. Add integration and end-to-end tests

## License

MIT

---

**Built with cost-effectiveness in mind** 🚀
**Target: $5-10/user/month vs PagerDuty's $29-49/user/month**
