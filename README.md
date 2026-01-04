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
- **Status Pages** - Public and private status pages for stakeholder communication

### Mobile App (iOS & Android)
- 31 React Native screens for full incident management
- Push notifications with deep linking
- Incident list, detail, and actions
- On-call schedule view with overrides
- Analytics dashboard
- OTA updates via EAS Update

### AI-Powered Features
- **AI Diagnosis** - Claude-powered incident analysis and chat
- **Runbook Automation** - AI executes runbook steps in sandboxed environments
- **Cloud Investigation** - Query AWS/GCP/Azure resources during incidents
- **AI Recommendations** - Improvement suggestions based on historical data

### Platform Migration
- **PagerDuty Import** - One-click migration of users, teams, schedules, escalation policies
- **Opsgenie Import** - Full configuration import with key preservation
- **Semantic Import** - AI-powered screenshot/text import using Claude Vision

### Developer Integrations
- **MCP Server** - AI assistant integration for Claude Code, Cursor, and other MCP clients
- **Terraform Provider** - Infrastructure-as-code for OnCallShift resources
- **Webhook API** - PagerDuty/Opsgenie-compatible alert ingestion
- **REST API** - Full API with OpenAPI documentation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│               Mobile App (Expo/React Native)                │
│                     Web App (React)                         │
│                   MCP Server / Terraform                    │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────────┐
│                Application Load Balancer                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───▼───┐   ┌─────────▼─────────┐   ┌───▼───────────────┐
│  API  │   │  Background       │   │  Escalation       │
│Service│   │  Workers (5)      │   │  Timer            │
└───┬───┘   └─────────┬─────────┘   └───────┬───────────┘
    │                 │                     │
    └────────┬────────┴─────────────────────┘
             │
    ┌────────▼────────┐         ┌───────────────┐
    │      RDS        │         │     SQS       │
    │   PostgreSQL    │         │    Queues     │
    └─────────────────┘         └───────────────┘
```

### Background Workers
| Worker | Purpose |
|--------|---------|
| `alert-processor` | Processes incoming alerts from SQS → creates incidents |
| `notification-worker` | Delivers notifications via Email/Push/SMS |
| `escalation-timer` | Auto-advances escalation steps every 30s |
| `snooze-expiry` | Processes expired incident snoozes |
| `report-scheduler` | Generates scheduled reports |

### AWS Services
- **ECS Fargate**: API + 5 background workers
- **RDS PostgreSQL**: Primary database
- **SQS**: Alert and notification queues with DLQs
- **Cognito**: JWT authentication
- **CloudFront + S3**: Frontend CDN hosting
- **SES**: Email delivery (noreply@oncallshift.com)
- **SNS**: SMS notifications
- **Secrets Manager**: Credential storage

### Cost
- **Monthly:** ~$58/month base infrastructure
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

---

## Packages

### MCP Server (`packages/oncallshift-mcp`)

Enable AI assistants to manage OnCallShift through natural language:

```bash
npx @oncallshift/mcp-server
```

Configure in Claude Code/Cursor:
```json
{
  "mcpServers": {
    "oncallshift": {
      "command": "npx",
      "args": ["@oncallshift/mcp-server"],
      "env": {
        "ONCALLSHIFT_API_KEY": "your-api-key"
      }
    }
  }
}
```

See [packages/oncallshift-mcp/README.md](packages/oncallshift-mcp/README.md) for full documentation.

### Terraform Provider (`packages/terraform-provider-oncallshift`)

Manage OnCallShift resources as infrastructure-as-code:

```hcl
resource "oncallshift_team" "platform" {
  name        = "Platform Engineering"
  description = "Infrastructure and platform team"
}

resource "oncallshift_service" "api" {
  name                 = "API Service"
  team_id              = oncallshift_team.platform.id
  escalation_policy_id = oncallshift_escalation_policy.default.id
}
```

See [packages/terraform-provider-oncallshift/README.md](packages/terraform-provider-oncallshift/README.md) for full documentation.

---

## Directory Structure

```
pagerduty-lite/
├── backend/                 # Express + TypeScript API
│   ├── src/api/            # Routes and middleware
│   ├── src/workers/        # Background processors (5 workers)
│   └── src/shared/         # Models (60+), utilities
├── frontend/               # React + Vite web app
│   ├── src/pages/          # Page components
│   └── src/components/     # Shared components
├── mobile/                 # React Native + Expo app
│   ├── src/screens/        # Screen components (31 screens)
│   └── src/services/       # API client, auth, push
├── packages/
│   ├── oncallshift-mcp/    # MCP server for AI assistants
│   └── terraform-provider-oncallshift/  # Terraform provider
├── infrastructure/         # Terraform IaC
│   └── terraform/
├── e2e/                    # Playwright E2E tests
└── .claude/                # Claude Code configuration
    └── commands/           # Slash commands for workflows
```

---

## Developer Workflow

### Slash Commands (Claude Code)

This repo includes slash commands for common workflows:

| Command | Purpose |
|---------|---------|
| `/deploy` | Deploy frontend + backend to production |
| `/typecheck` | Run TypeScript checks on all projects |
| `/commit-push-pr` | Stage, commit, push, and create PR |
| `/test` | Run tests based on changed files |
| `/build` | Build frontend and/or backend |
| `/fix-types` | Iteratively fix TypeScript errors |
| `/logs` | View ECS service logs |
| `/status` | Quick overview of git state and open PRs |
| `/mobile-update` | Push OTA update to mobile app |
| `/verify` | Verify work is complete (types, tests) |

### Type Checking

```bash
# All projects in parallel
cd backend && npx tsc --noEmit &
cd frontend && npx tsc -b &
cd mobile && npx tsc --noEmit &
wait
```

### Testing

```bash
# Backend unit tests
cd backend && npm test

# E2E tests
cd e2e && npx playwright test
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

## API Reference

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/alerts/webhook` | Alert ingestion (PagerDuty/Opsgenie compatible) |
| `GET /api/v1/incidents` | List incidents |
| `POST /api/v1/incidents/:id/acknowledge` | Acknowledge incident |
| `POST /api/v1/incidents/:id/resolve` | Resolve incident |
| `GET /api/v1/schedules/:id/oncall` | Get current on-call |
| `GET /api/v1/services` | List services |
| `POST /api/v1/import` | Platform migration |

Full API documentation: https://oncallshift.com/api-docs

---

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - AI assistant guidance and development commands
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Technical architecture
- **[mobile/README.md](mobile/README.md)** - Mobile app guide
- **[packages/oncallshift-mcp/README.md](packages/oncallshift-mcp/README.md)** - MCP server docs
- **[packages/terraform-provider-oncallshift/README.md](packages/terraform-provider-oncallshift/README.md)** - Terraform provider docs

---

## Key URLs

| Resource | URL |
|----------|-----|
| Live App | https://oncallshift.com |
| API Docs | https://oncallshift.com/api-docs |
| Webhook | POST https://oncallshift.com/api/v1/alerts/webhook |

---

## Troubleshooting

### Check Service Status
```bash
aws ecs describe-services --cluster pagerduty-lite-dev \
  --services pagerduty-lite-dev-api --region us-east-1
```

### View Logs
```bash
# API logs
aws logs tail /ecs/pagerduty-lite-dev/api --follow --region us-east-1

# Worker logs
aws logs tail /ecs/pagerduty-lite-dev/alert-processor --follow --region us-east-1
aws logs tail /ecs/pagerduty-lite-dev/escalation-timer --follow --region us-east-1
```

### Create User
```bash
aws cognito-idp admin-create-user \
  --user-pool-id REDACTED_COGNITO_POOL_ID_2 \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com

aws cognito-idp admin-set-user-password \
  --user-pool-id REDACTED_COGNITO_POOL_ID_2 \
  --username user@example.com \
  --password YourPassword123! \
  --permanent
```

---

## License

MIT
