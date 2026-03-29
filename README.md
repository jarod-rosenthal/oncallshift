# OnCallShift

**A full-stack incident management platform built entirely by AI agents.**

OnCallShift is a showcase application demonstrating [WorkerMill](https://workermill.com) — an autonomous AI coding platform that takes Jira/Linear/GitHub tickets and ships production code. Every line of code in this repository was written, tested, and deployed by WorkerMill's AI workers.

[Live App](https://oncallshift.com) | [WorkerMill Platform](https://workermill.com)

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

---

## What's Inside

OnCallShift is a real, production incident management platform — not a toy demo. It includes:

- **Incident Management** — Create, acknowledge, resolve with full audit trail
- **Escalation Policies** — Multi-level escalation with automatic timeout advancement
- **On-Call Schedules** — Schedule management with member assignment and overrides
- **Multi-Channel Notifications** — Push, Email, SMS with delivery tracking
- **Status Pages** — Public and private status pages for stakeholder communication
- **AI Diagnosis** — Claude-powered incident analysis and chat
- **Runbook Automation** — AI executes runbook steps in sandboxed environments
- **Cloud Investigation** — Query AWS/GCP/Azure resources during incidents
- **Semantic Import** — AI-powered screenshot/text import using Claude Vision
- **PagerDuty/Opsgenie Import** — One-click migration tools
- **MCP Server** — AI assistant integration for Claude Code, Cursor, and other MCP clients
- **Terraform Provider** — Infrastructure-as-code for OnCallShift resources
- **Mobile App** — Full React Native app with push notifications and deep linking

## How It Was Built

OnCallShift was built in **24 epics over ~18 hours** of autonomous execution for a total API cost of **$1,206**. The final repo contains **195,000+ lines of code across 573 files from 245 commits**.

| Component | Lines of Code | Description |
|-----------|--------------|-------------|
| Backend API | 92,000 | Express + TypeScript, 35+ routes, 60+ TypeORM models, 6 background workers |
| Web Frontend | 52,000 | React + Vite, TanStack Query, Tailwind CSS |
| Mobile App | 41,000 | React Native + Expo, 32 screens, push notifications |
| Packages | 8,000 | MCP server (TypeScript) + Terraform provider (Go) |
| E2E Tests | 2,000 | Playwright test suite |

Each epic was planned by a WorkerMill planner agent, decomposed into parallel stories, executed by specialist AI personas (backend developer, frontend developer, mobile developer, DevOps engineer), reviewed by a tech lead agent, and consolidated into a single PR.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Express, TypeScript, TypeORM, PostgreSQL |
| Web Frontend | React, Vite, TanStack Query, Tailwind CSS |
| Mobile App | React Native, Expo |
| AI | Anthropic Claude API |
| Auth | AWS Cognito |
| Infrastructure | Terraform, AWS (ECS, SQS, SES, SNS, S3, CloudFront) |
| Packages | MCP Server (TypeScript), Terraform Provider (Go) |

## Architecture

```
                      Mobile App (Expo/React Native)
                        Web App (React + Vite)
                      MCP Server / Terraform Provider
                                |
                              HTTPS
                                |
                    Application Load Balancer
                                |
            +-------------------+-------------------+
            |                   |                   |
         API Service     Background Workers    Escalation Timer
            |                   |                   |
            +--------+----------+-------------------+
                     |
              +------+------+         +-------------+
              |  PostgreSQL |         |  SQS Queues  |
              +-------------+         +-------------+
```

### Background Workers

| Worker | Purpose |
|--------|---------|
| `alert-processor` | Processes incoming alerts from SQS, creates incidents |
| `notification-worker` | Delivers notifications via Email/Push/SMS |
| `escalation-timer` | Auto-advances escalation steps every 30s |
| `snooze-expiry` | Processes expired incident snoozes |
| `report-scheduler` | Generates scheduled reports |

## Project Structure

```
oncallshift/
├── backend/                 # Express + TypeScript API
│   ├── src/api/            # Routes and middleware
│   ├── src/workers/        # Background processors
│   └── src/shared/         # Models, utilities, middleware
├── frontend/               # React + Vite web app
│   ├── src/pages/          # Page components
│   └── src/components/     # Shared components
├── mobile/                 # React Native + Expo app
│   ├── src/screens/        # Screen components
│   └── src/services/       # API client, auth, push notifications
├── packages/
│   ├── oncallshift-mcp/    # MCP server for AI assistants
│   └── terraform-provider-oncallshift/  # Terraform provider (Go)
└── e2e/                    # Playwright E2E tests
```

## Packages

### MCP Server

Enable AI assistants to manage OnCallShift through natural language:

```json
{
  "mcpServers": {
    "oncallshift": {
      "command": "npx",
      "args": ["@oncallshift/mcp-server"],
      "env": { "ONCALLSHIFT_API_KEY": "your-api-key" }
    }
  }
}
```

See [packages/oncallshift-mcp/README.md](packages/oncallshift-mcp/README.md) for details.

### Terraform Provider

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

See [packages/terraform-provider-oncallshift/README.md](packages/terraform-provider-oncallshift/README.md) for details.

## API Reference

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/alerts/webhook` | Alert ingestion (PagerDuty/Opsgenie compatible) |
| `GET /api/v1/incidents` | List incidents |
| `POST /api/v1/incidents/:id/acknowledge` | Acknowledge incident |
| `POST /api/v1/incidents/:id/resolve` | Resolve incident |
| `GET /api/v1/schedules/:id/oncall` | Get current on-call |
| `GET /api/v1/services` | List services |
| `POST /api/v1/import` | Platform migration |

Full API documentation: [oncallshift.com/api-docs](https://oncallshift.com/api-docs)

## About WorkerMill

[WorkerMill](https://workermill.com) is an autonomous AI coding platform. Point it at a ticket, and it:

1. **Plans** — Decomposes the task into parallel stories with file targets
2. **Executes** — Specialist AI personas (frontend dev, backend dev, QA) work in parallel
3. **Reviews** — Tech lead agent reviews each story for quality
4. **Ships** — Creates a consolidated PR with all changes

OnCallShift exists to demonstrate that WorkerMill can build and maintain a production-grade, multi-platform application end-to-end. Every commit in this repo traces back to a WorkerMill task.

## For AI Agents

If you're an AI worker building on this codebase, see [AGENTS.md](./AGENTS.md) for development guidelines.

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

Copyright 2025-2026 OnCallShift Contributors
