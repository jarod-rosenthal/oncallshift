# AGENTS.md

Development guidelines for AI agents working on the OnCallShift codebase.

## Project Structure

```
oncallshift/
├── backend/          # Express + TypeScript API (port 3000)
├── frontend/         # React + Vite web app (port 5173)
├── mobile/           # React Native + Expo
├── packages/
│   ├── oncallshift-mcp/                    # MCP server (TypeScript)
│   └── terraform-provider-oncallshift/     # Terraform provider (Go)
└── e2e/              # Playwright E2E tests
```

## Quick Start

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Mobile
cd mobile && npm install && npm start

# Type check all projects
cd backend && npx tsc --noEmit
cd frontend && npx tsc -b
cd mobile && npx tsc --noEmit
```

## Key Conventions

### TypeScript
- Strict mode enabled across all projects
- Run `npx tsc --noEmit` before committing
- Follow existing patterns in the codebase

### Backend
- Routes live in `backend/src/api/routes/`
- Models are TypeORM entities in `backend/src/shared/models/`
- Use `authenticateRequest` middleware for new routes (supports JWT + org API keys + service API keys)
- All database queries must be scoped by `org_id` for multi-tenancy
- Tests colocated in `__tests__/` directories, run with `npm test`

### Frontend
- Pages in `frontend/src/pages/`, components in `frontend/src/components/`
- Server state: TanStack React Query
- Auth state: Zustand store
- Forms: React Hook Form
- Styling: Tailwind CSS

### Mobile
- Screens in `mobile/src/screens/`
- API client in `mobile/src/services/apiService.ts`
- Connects to production API at `https://oncallshift.com/api`
- Import dependencies directly to avoid require cycles

## Architecture

### Data Flow
1. **Alerts**: Webhook → API → SQS → Alert Processor → Incident → Escalation
2. **Escalation**: Timer checks every 30s → Advances steps → Notifications
3. **Notifications**: Worker → Email (SES) / Push (Expo) / SMS (SNS)

### Authentication
| Method | Header | Use Case |
|--------|--------|----------|
| Cognito JWT | `Authorization: Bearer <jwt>` | Web/mobile users |
| Service API Key | `X-API-Key: svc_*` | Service integrations |
| Org API Key | `Authorization: Bearer org_*` | MCP server, Terraform |

### Background Workers
| Worker | Purpose |
|--------|---------|
| `alert-processor` | SQS → incident creation |
| `notification-worker` | Email/Push/SMS delivery |
| `escalation-timer` | Auto-advance escalation steps |
| `snooze-expiry` | Process expired snoozes |
| `report-scheduler` | Generate scheduled reports |

## Testing

```bash
cd backend && npm test                              # All backend tests
cd backend && npm test -- --testPathPattern=webhooks # Single file
cd e2e && npx playwright test                        # E2E tests
```

## What Not to Do

- Do not commit `.env` files or secrets
- Do not modify `.gitignore` without explicit approval
- Do not use `Resource: "*"` in IAM policies
- Do not disable TLS validation
- Do not hardcode credentials anywhere
