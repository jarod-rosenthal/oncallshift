# OnCallShift Backend

Express + TypeScript API server with background workers for incident management.

## Directory Structure

```
src/
├── api/
│   ├── routes/          # REST API endpoints (35+ route files)
│   ├── app.ts           # Express app configuration
│   └── server.ts        # Server entry point
├── workers/
│   ├── alert-processor.ts       # SQS alert ingestion -> incident creation
│   ├── notification-worker.ts   # Email/Push/SMS delivery
│   ├── escalation-timer.ts      # Auto-advances escalation steps (30s interval)
│   ├── snooze-expiry.ts         # Processes expired incident snoozes
│   └── report-scheduler.ts      # Generates scheduled reports
└── shared/
    ├── models/          # TypeORM entities (60+ models)
    ├── auth/            # Cognito JWT middleware
    ├── db/              # Database config, migrations, seeds
    └── utils/           # Shared utilities
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload (localhost:3000) |
| `npm run build` | Compile TypeScript |
| `npm start` | Start production server |
| `npm test` | Run Jest test suite |
| `npm run test:integration` | Run integration tests |
| `npm run migrate` | Run database migrations |
| `npm run migrate:create` | Create a new migration |
| `npm run seed` | Seed test data |
| `npm run lint` | Run ESLint |

## API Routes

Key endpoint groups:

| Route | Description |
|-------|-------------|
| `/api/v1/incidents` | Incident CRUD + actions (ack, resolve, reassign, escalate, snooze) |
| `/api/v1/alerts/webhook` | PagerDuty/Opsgenie-compatible alert ingestion |
| `/api/v1/services` | Service management |
| `/api/v1/teams` | Team management |
| `/api/v1/schedules` | On-call schedules with `/oncall` for current on-call |
| `/api/v1/escalation-policies` | Multi-step escalation definitions |
| `/api/v1/runbooks` | Runbook management and execution |
| `/api/v1/runbook-automation` | AI-powered runbook step execution |
| `/api/v1/ai-assistant` | AI-powered incident analysis chat |
| `/api/v1/ai-diagnosis` | Claude-powered incident diagnosis |
| `/api/v1/status-pages` | Public/private status pages |
| `/api/v1/import` / `export` | Platform migration tools |
| `/api/v1/semantic-import` | AI-powered screenshot/text import |

## Authentication

The API supports multiple auth methods via the `authenticateRequest` middleware:

- **JWT** — Cognito tokens via `Authorization: Bearer <jwt>`
- **Service API Key** — `X-API-Key: svc_*`
- **Org API Key** — `Authorization: Bearer org_*`

## Testing

Tests are colocated with source code in `__tests__/` directories using Jest with ts-jest.

```bash
npm test                                    # All tests
npm test -- --testPathPattern=webhooks      # Single file
npm test -- --watch                         # Watch mode
```
