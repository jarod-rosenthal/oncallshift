# OnCallShift

An open-source incident management and on-call scheduling platform. Built with TypeScript across the full stack.

**Website:** [oncallshift.com](https://oncallshift.com)

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

---

## Features

### Core Platform
- **Incident Management** - Create, acknowledge, resolve with full audit trail
- **Escalation Policies** - Multi-level escalation with automatic timeout advancement
- **On-Call Schedules** - Schedule management with member assignment and overrides
- **Multi-Channel Notifications** - Push, Email, SMS with delivery tracking
- **User Actions** - Reassign, snooze, manual escalate, add responders
- **Status Pages** - Public and private status pages for stakeholder communication

### Mobile App (iOS & Android)
- React Native screens for full incident management
- Push notifications with deep linking
- On-call schedule view with overrides
- Analytics dashboard
- OTA updates via EAS Update

### AI-Powered Features
- **AI Diagnosis** - Claude-powered incident analysis and chat
- **Runbook Automation** - AI executes runbook steps in sandboxed environments
- **Cloud Investigation** - Query AWS/GCP/Azure resources during incidents
- **Semantic Import** - AI-powered screenshot/text import using Claude Vision

### Platform Migration
- **PagerDuty Import** - One-click migration of users, teams, schedules, escalation policies
- **Opsgenie Import** - Full configuration import with key preservation

### Developer Integrations
- **MCP Server** - AI assistant integration for Claude Code, Cursor, and other MCP clients
- **Terraform Provider** - Infrastructure-as-code for OnCallShift resources
- **Webhook API** - PagerDuty/Opsgenie-compatible alert ingestion
- **REST API** - Full API with OpenAPI documentation

---

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

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- AWS account (for Cognito, SQS, SES, SNS)

### Local Development

```bash
# Backend API
cd backend
npm install
cp .env.example .env    # Configure your environment variables
npm run dev             # localhost:3000

# Web Frontend
cd frontend
npm install
npm run dev             # localhost:5173

# Mobile App
cd mobile
npm install
npm start               # Expo dev server
```

### Database Setup

```bash
cd backend
npm run migrate         # Run database migrations
npm run seed            # Seed test data (optional)
```

---

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

---

## Packages

### MCP Server

Enable AI assistants to manage OnCallShift through natural language:

```bash
npx @oncallshift/mcp-server
```

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

---

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

---

## Testing

```bash
# Backend unit tests
cd backend && npm test

# Single test file
cd backend && npm test -- --testPathPattern=webhooks

# E2E tests (Playwright)
cd e2e && npx playwright test

# Type checking (all projects)
cd backend && npx tsc --noEmit
cd frontend && npx tsc -b
cd mobile && npx tsc --noEmit
```

---

## Documentation

- [Support & User Guides](docs/support/)
- [Terraform Provider Docs](docs/terraform-provider/)
- [MCP Server](packages/oncallshift-mcp/README.md)
- [Mobile App](mobile/README.md)
- [Frontend](frontend/README.md)

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes with tests
4. Ensure type checking passes (`npx tsc --noEmit` in each project)
5. Submit a pull request

---

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

Copyright 2025-2026 OnCallShift Contributors
