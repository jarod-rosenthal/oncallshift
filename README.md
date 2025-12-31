# PagerDuty-Lite: Incident Management Platform

## Overview

PagerDuty-Lite is a cost-effective incident management and on-call platform built on AWS. It provides core incident management features at a fraction of the cost (~$5-10/user/month vs $29-49/user/month for PagerDuty).

**Live URL:** https://oncallshift.com

## Current Status

### ✅ Deployed and Running (Production Ready!)

1. **AWS Infrastructure** (100% Complete)
   - VPC with public/private subnets
   - PostgreSQL database on RDS
   - ECS Fargate cluster (3 services: API, Alert Processor, Notification Worker)
   - Application Load Balancer
   - CloudFront CDN
   - Cognito authentication
   - Custom domain with SSL (oncallshift.com)
   - SQS queues for async processing
   - ProtonMail domain email with SPF, DKIM, DMARC

2. **React Web Frontend** (100% Complete, Deployed)
   - Enhanced Dashboard with live statistics
   - Real-time incident monitoring
   - User availability management
   - Authentication (Login/Register)
   - Incidents and Schedules pages
   - Services management UI
   - Auto-refresh every 30 seconds
   - Live demo page at `/demo`

3. **Backend API** (100% Complete, Deployed)
   - Express + TypeScript server
   - Cognito JWT authentication
   - **Incidents API** (create, list, acknowledge, resolve)
   - **Schedules API** (CRUD, on-call management, member management)
   - **Services API** (CRUD, escalation policy assignment)
   - **Escalation Policies API** (full CRUD)
   - **Users API** (profile, device registration)
   - **Alerts Webhook** (for external monitoring tools)
   - **Demo API** (public dashboard data)
   - Swagger/OpenAPI docs at `/api-docs`

4. **Database** (100% Complete)
   - Full schema: users, organizations, services, schedules, incidents, escalation policies
   - Schedule members, incident events, notifications
   - Device tokens for push notifications
   - Seeded with test data

5. **Notification System** (100% Complete, Production Ready!)
   - **Alert Processor Worker** - Processes incoming alerts, creates incidents
   - **Notification Worker** - Sends multi-channel notifications
   - **Email Notifications** ✅ Working with noreply@oncallshift.com
   - **Push Notifications** ✅ Infrastructure ready (FCM + APNs)
   - **SMS Notifications** ✅ Infrastructure ready (AWS SNS)
   - **PagerDuty-Style Escalation Policies** ✅ Fully implemented
   - Multi-level escalation support
   - On-call user detection from schedules

### 🚧 In Progress

6. **Mobile App**
   - React Native/Expo app scaffolded
   - Needs implementation (screens, push notification registration, incident management)

## Current Features

**✅ Implemented and Deployed:**
- Incident management (create, list, view, acknowledge, resolve)
- Real-time dashboard with live statistics
- User availability management
- On-call scheduling with schedule members
- PagerDuty-style escalation policies (multi-level escalation support)
- Webhook alert ingestion (creates incidents automatically)
- Email notifications via noreply@oncallshift.com
- Services and escalation policy management
- JWT authentication via Cognito
- Web interface (React SPA)
- Auto-refresh (30-second intervals)
- Alert processor worker (SQS-based async processing)
- Notification worker (multi-channel notification delivery)

**🚧 In Progress:**
- Mobile app (iOS + Android) - React Native/Expo scaffolded, needs implementation

**❌ Not Yet Implemented:**
- Push notifications (infrastructure ready via FCM + APNs, needs mobile app)
- SMS/Voice fallback (infrastructure ready via AWS SNS, needs implementation)
- Email-to-incident parsing
- Heartbeat monitoring
- Automatic schedule rotations
- Multi-tenant organization switching (schema supports it, UI pending)

See [docs/MVP-ROADMAP.md](docs/MVP-ROADMAP.md) for complete feature breakdown and post-MVP phases.

## Architecture

**Cost-Effective AWS Architecture:**
- **ECS Fargate**: Serverless container orchestration
- **RDS PostgreSQL**: db.t4g.micro instance (cost-optimized)
- **CloudFront CDN**: Global content delivery
- **Cognito**: Managed authentication
- **Application Load Balancer**: HTTPS/HTTP routing

**Actual Infrastructure Cost:**
- Monthly: ~$58/month
- Per User: ~$3-6/month (10-20 users)
- **87-90% cheaper than PagerDuty** ($29-49/user/month)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for complete architecture details.

## Infrastructure Management

**⚠️ IMPORTANT: Terraform is the Source of Truth**

ALL infrastructure changes MUST be made through Terraform. This includes:
- DNS records (Route53)
- ECS services and task definitions
- Security groups and networking
- Database configurations
- Any other AWS resources

**Never make manual changes in the AWS Console.** Always:
1. Update Terraform configuration files
2. Run `terraform plan` to review changes
3. Run `terraform apply` to deploy changes
4. Commit the Terraform changes to git

This ensures:
- Infrastructure is version controlled
- Changes are reproducible
- Team members can see what changed and why
- Easy to rollback if needed

**Location:** `infrastructure/terraform/environments/dev/`

## Directory Structure

```
pagerduty-lite/
├── docs/                        # Architecture and roadmap docs
├── infrastructure/terraform/    # AWS infrastructure as code
├── backend/                     # Express + TypeScript API
│   ├── src/api/                # API routes and server
│   ├── src/shared/             # Database models and utilities
│   └── Dockerfile              # Production build
├── frontend/                    # React web application
│   ├── src/                    # Components, pages, and utilities
│   └── dist/                   # Production build (deployed)
└── mobile/                      # React Native app (not started)
```

## Quick Start

### Current Deployment

The application is already deployed and running:

- **Live App:** https://oncallshift.com
- **API Docs:** https://oncallshift.com/api-docs
- **Demo Dashboard:** https://oncallshift.com/demo
- **Region:** us-east-1
- **Environment:** Development

### Local Development

```bash
# Install dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# Run frontend dev server
cd frontend
npm run dev  # Runs on http://localhost:5173

# Run backend dev server (in separate terminal)
cd backend
npm run dev  # Runs on http://localhost:3000
```

### Deploy Updates

```bash
# Build and deploy new version
cd /path/to/pagerduty-lite

# Build Docker image
docker build -t pagerduty-lite-api -f Dockerfile .

# Tag and push to ECR
docker tag pagerduty-lite-api:latest 593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-api:latest
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 593971626975.dkr.ecr.us-east-1.amazonaws.com
docker push 593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-api:latest

# Deploy to ECS
aws ecs update-service --cluster pagerduty-lite-dev --service pagerduty-lite-dev-api --force-new-deployment --region us-east-1
```

### Create User

```bash
# Create new user via Cognito
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_vMk9CQycK \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com \
  --region us-east-1

# Set password
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_vMk9CQycK \
  --username user@example.com \
  --password YourPassword123! \
  --permanent \
  --region us-east-1
```

## Next Steps

See **[ROADMAP.md](ROADMAP.md)** for the complete feature roadmap and remaining work.

**Immediate Priority:**
1. Complete mobile app testing and App Store submission
2. Production hardening (rate limiting, webhook signatures)

**Coming Soon:**
- Voice call fallback
- Notification delivery tracking
- Slack integration
- Analytics dashboard

## Cost Breakdown

### Current Production Deployment

| Service | Monthly Cost |
|---------|--------------|
| ECS Fargate (3 services: API, Alert Processor, Notification Worker) | ~$15 |
| RDS PostgreSQL (db.t4g.micro) | ~$13 |
| Application Load Balancer | ~$20 |
| CloudFront CDN | ~$5 |
| Cognito + SQS + Logs | ~$5 |
| **Total** | **~$58/month** |

**Cost per user:** ~$3-6/user/month (for 10-20 users)

**Comparison:** PagerDuty costs $29-49/user/month → **87-90% cost savings**

## Roadmap

See **[ROADMAP.md](ROADMAP.md)** for the complete prioritized roadmap including:
- Mobile app completion
- Production hardening
- Enhanced features (voice, notifications, schedules)
- DevOps features (Slack, CLI, heartbeats)
- Enterprise features (SSO, billing, analytics)

## Documentation

- **[ROADMAP.md](ROADMAP.md)**: Feature roadmap and remaining work
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)**: Technical architecture and data flows
- **[mobile/README.md](mobile/README.md)**: Mobile app development guide

## Troubleshooting

### Check Service Status
```bash
aws ecs describe-services --cluster pagerduty-lite-dev --service pagerduty-lite-dev-api --region us-east-1
```

### View Logs
```bash
aws logs tail /ecs/pagerduty-lite-dev-api --follow --region us-east-1
```

### Database Connection
```bash
# Get database credentials from Secrets Manager
aws secretsmanager get-secret-value --secret-id pagerduty-lite-dev-db-password --query SecretString --output text --region us-east-1
```

## Support

For production hardening:
1. Set up automated backups
2. Enable enhanced monitoring
3. Implement secrets rotation
4. Add comprehensive logging
5. Set up CI/CD pipeline

## License

MIT

---

**Built with cost-effectiveness in mind** 🚀
**Target: $5-10/user/month vs PagerDuty's $29-49/user/month**
