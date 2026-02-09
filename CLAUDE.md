# CLAUDE.md — OnCallShift Development Guide

This file is the source of truth for AI agents (Claude Code) and developers working on the OnCallShift codebase. It documents local dev setup, conventions, and patterns established across all phases.

## Quick Start

```bash
# 1. Start PostgreSQL + backend + frontend
./bin/dev

# 2. Or start services individually:
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL on :5433
cd backend && npm run migrate                     # Run DB migrations
cd backend && npm run seed                        # Load demo data
cd backend && npm run dev                         # API on :3000
cd frontend && npm run dev                        # Web UI on :5173
```

**URLs:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api/v1
- Swagger docs: http://localhost:3000/api-docs

## Project Structure

```
oncallshift/
├── backend/                  # Express + TypeScript API server
│   ├── src/
│   │   ├── api/
│   │   │   ├── app.ts        # Express app + middleware stack
│   │   │   ├── server.ts     # Server startup + graceful shutdown
│   │   │   ├── routes/       # Route handlers (one file per domain)
│   │   │   └── swagger.ts    # OpenAPI 3.0 spec config
│   │   ├── shared/
│   │   │   ├── config/       # Centralized config from env vars
│   │   │   ├── db/
│   │   │   │   ├── connection.ts  # TypeORM DataSource (entity/migration registration)
│   │   │   │   ├── migrate.ts     # Migration runner
│   │   │   │   ├── seed.ts        # Idempotent seed data
│   │   │   │   └── migrations/    # SQL migration files
│   │   │   ├── models/       # TypeORM entities + barrel export (index.ts)
│   │   │   ├── middleware/    # auth, rate-limiter, request-id
│   │   │   ├── services/     # AWS SDK wrappers (SQS, SES, SNS, S3, Cognito)
│   │   │   └── utils/        # logger (Winston), problem-details (RFC 9457)
│   │   └── workers/          # Background workers (alert-processor, etc.)
│   ├── Dockerfile            # Multi-stage Node 22-alpine build
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts      # Unit test config
│   └── vitest.integration.config.ts  # Integration test config
├── frontend/                 # React 19 + Vite + TailwindCSS
│   ├── src/
│   │   ├── pages/            # Full-page components
│   │   ├── components/       # Reusable UI components
│   │   ├── stores/           # Zustand state stores
│   │   ├── hooks/            # Custom React hooks
│   │   └── lib/
│   │       └── api.ts        # Axios client (baseURL: /api/v1)
│   ├── vite.config.ts        # Port 5173, proxy /api → localhost:3000
│   ├── tailwind.config.js    # Custom brand color palette
│   └── vitest.config.ts
├── mobile/                   # React Native + Expo (Android only)
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── services/
│   │   └── navigation/
│   ├── app.json              # Expo config
│   └── eas.json              # EAS Build profiles
├── e2e/                      # Playwright E2E tests
│   ├── tests/
│   ├── helpers/
│   │   ├── api-client.ts     # Direct API calls for test setup
│   │   └── test-data.ts      # Test factories + ID generators
│   └── playwright.config.ts
├── infrastructure/           # Terraform modules + environments
│   └── terraform/
│       ├── modules/          # networking, github-runner, managed-services, etc.
│       └── environments/
│           └── prod/         # Production (single env from day 1)
├── packages/
│   └── oncallshift-mcp/      # MCP server package
├── docker-compose.dev.yml    # PostgreSQL 15 on port 5433
├── bin/dev                   # Start all services for local dev
├── .env.example              # Environment variable template
└── CLAUDE.md                 # This file
```

## Environment Setup

### Prerequisites
- Node.js 20+
- Docker (for PostgreSQL)
- AWS credentials configured (for Cognito, SQS, SES, SNS, S3)

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Core
NODE_ENV=development
PORT=3000

# Database (local Docker PostgreSQL)
DATABASE_URL=postgresql://oncallshift:localdev@localhost:5433/oncallshift

# AWS (all services are real — no stubs)
AWS_REGION=us-east-2
COGNITO_USER_POOL_ID=us-east-2_XXXXXXXXX
COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
ALERTS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/...
NOTIFICATIONS_QUEUE_URL=https://sqs.us-east-2.amazonaws.com/...
SES_FROM_EMAIL=noreply@oncallshift.com
SNS_PUSH_TOPIC_ARN=arn:aws:sns:us-east-2:...
S3_UPLOADS_BUCKET=oncallshift-prod-uploads

# CORS (comma-separated origins)
CORS_ORIGINS=http://localhost:5173

# Optional
SENTRY_DSN=
```

**Important:** All AWS services are real from day 1 — no local stubs or adapters. The only difference between local dev and production is PostgreSQL (Docker vs RDS).

## Common Commands

### Backend (`cd backend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm run migrate` | Run TypeORM migrations |
| `npm run seed` | Load idempotent demo data |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:integration` | Run integration tests (real DB) |
| `npm run test:coverage` | Generate coverage report |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |

### Frontend (`cd frontend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | TypeScript compile + Vite build |
| `npm run preview` | Preview production build |
| `npm test` | Run unit tests (Vitest) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |

### Mobile (`cd mobile`)

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run android` | Start on Android emulator |
| `npm test` | Run Jest tests |
| `npm run typecheck` | TypeScript type checking |

### E2E (`cd e2e`)

| Command | Description |
|---------|-------------|
| `npx playwright test` | Run E2E tests (headless) |
| `npx playwright test --headed` | Run with browser visible |
| `npx playwright test --ui` | Open Playwright UI mode |

## Code Conventions

### TypeScript (Backend)

- **ESM modules** — All imports require `.js` extensions:
  ```typescript
  // Correct
  import { AppDataSource } from "../shared/db/connection.js";
  import { sendProblem } from "../shared/utils/problem-details.js";

  // Wrong — will fail at runtime
  import { AppDataSource } from "../shared/db/connection";
  ```

- **Strict mode** enabled — no implicit `any`, null checks required
- **Experimental decorators** enabled for TypeORM entities
- **Target:** ES2022, **Module:** NodeNext

### TypeScript (Frontend)

- **Module:** ESNext, **JSX:** react-jsx
- **Strict mode** enabled
- **isolatedModules** enabled

### Formatting (Prettier)

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Linting (ESLint)

- `@typescript-eslint/no-unused-vars` — error, but `_` prefixed args are allowed
- `@typescript-eslint/no-explicit-any` — warn
- `no-console` — warn

## Database Conventions

### TypeORM Entities

- Location: `backend/src/shared/models/{EntityName}.ts`
- Barrel export: `backend/src/shared/models/index.ts`
- Column names: **snake_case** in the database, **camelCase** in TypeScript
- All entities use UUID primary keys

```typescript
@Entity("table_name")
export class EntityName {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "org_id" })
  orgId!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
```

### Entity Registration

Entities and migrations are registered **explicitly** in `backend/src/shared/db/connection.ts` — not via glob patterns:

```typescript
import { EntityName } from "../models/EntityName.js";

const AppDataSource = new DataSource({
  entities: [EntityName, ...],      // Add each entity explicitly
  migrations: [...],                // Add each migration explicitly
  synchronize: false,               // Never auto-sync — migrations only
});
```

### Adding a New Model (Checklist)

1. Create entity file at `backend/src/shared/models/{Entity}.ts`
2. Export from `backend/src/shared/models/index.ts`
3. Register in `backend/src/shared/db/connection.ts` entities array
4. Create migration in `backend/src/shared/db/migrations/`
5. Register migration in `backend/src/shared/db/connection.ts` migrations array
6. Add seed function in `backend/src/shared/db/seed.ts`

### Seed Data

- `npm run seed` is **idempotent** — safe to run multiple times
- Uses **check-before-insert** pattern: SELECT for existence, INSERT only if missing
- Ordered by dependency: organizations → users → teams → services → schedules → incidents
- Each phase extends the seed script as new models are added

### Migrations

- Location: `backend/src/shared/db/migrations/`
- Never use `synchronize: true` — always write explicit migrations
- Run with `npm run migrate` (uses `tsx src/shared/db/migrate.ts`)

## API Conventions

### Error Responses (RFC 9457 Problem Details)

All API errors use RFC 9457 Problem Details format:

```json
{
  "type": "https://oncallshift.com/problems/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Incident INC-123 not found",
  "instance": "/api/v1/incidents/INC-123"
}
```

Helper functions in `backend/src/shared/utils/problem-details.ts`:
- `sendProblem(res, status, detail)` — generic
- `notFound(res, detail)` — 404
- `badRequest(res, detail)` — 400
- `unauthorized(res, detail)` — 401
- `forbidden(res, detail)` — 403
- `conflict(res, detail)` — 409
- `internalError(res, detail)` — 500

### Multi-Tenancy

All database queries must be scoped by `orgId`. The authenticated user's org is available via `req.user.orgId`:

```typescript
const incidents = await repo.find({ where: { orgId: req.user!.orgId } });
```

### Rate Limiting

Three tiers available (imported from `middleware/rate-limiter.ts`):

| Tier | Limit | Use Case |
|------|-------|----------|
| `baseRateLimit` | 100 req/min | Standard endpoints |
| `expensiveRateLimit` | 20 req/min | Search, analytics |
| `bulkRateLimit` | 5 req/min | Bulk operations, imports |

### Authentication

Auth middleware at `backend/src/shared/middleware/auth.ts`:
- `authenticateRequest` — verifies JWT (Cognito) or API key (`org_*` / `svc_*`)
- `requireRole("admin")` — authorization by role
- Auth user interface: `{ id, orgId, email, role }`
- Roles: `admin`, `member`, `super_admin`

### API Versioning

All routes under `/api/v1/`. Swagger docs at `/api-docs`.

### Request Tracing

Every request gets a unique `X-Request-Id` header via `request-id` middleware. Included in all log entries.

## Middleware Stack (Order)

1. Helmet (security headers)
2. CORS (configurable origins via `CORS_ORIGINS`)
3. `express.json()` (10MB body limit)
4. Request ID (unique ID per request)
5. Request logging (Winston, with timing)
6. Rate limiter (on `/api` routes)
7. Route handlers
8. 404 handler (Problem Details)
9. Global error handler (Problem Details)

## Frontend Conventions

### State Management

| Type | Library | Use Case |
|------|---------|----------|
| Server state | `@tanstack/react-query` | API data fetching/caching |
| Client state | `zustand` | UI state, auth state |
| Form state | `react-hook-form` + `zod` | Form validation |

### API Client

`frontend/src/lib/api.ts` — Axios instance:
- Base URL: `/api/v1` (proxied to backend via Vite)
- Request interceptor: adds `Authorization: Bearer <token>` from localStorage
- Response interceptor: redirects to `/login` on 401

### Styling

- **Tailwind CSS** with custom `brand` color palette (blue tones)
- **Headless UI** for unstyled, accessible components
- Responsive design (desktop + tablet)

## Testing Conventions

### Unit Tests (Vitest)

- **Colocated** with source: `component.ts` → `component.test.ts`
- Mock external deps with `vi.mock()`, reset in `beforeEach`
- Backend HTTP tests use Supertest: `await request(app).get("/api/v1/...")`
- Timeout: 30 seconds

```typescript
vi.mock("../shared/db/connection.js", () => ({
  AppDataSource: { getRepository: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});
```

### Integration Tests (Vitest)

- Location: `backend/src/__tests__/integration/`
- **Real PostgreSQL** — no DB mocks
- Sequential execution (single fork to avoid DB conflicts)
- Transaction rollback after each test (automatic cleanup)
- Timeout: 60 seconds

### E2E Tests (Playwright)

- Auth setup runs once, saves session to `e2e/.auth/user.json`
- Use API client for test data setup (faster than UI clicks)
- Timeout: 60s per test, 10s for expects
- Artifacts: trace on first retry, screenshot/video on failure

### Test Commands Summary

```bash
# Backend
cd backend && npm test                    # Unit tests
cd backend && npm run test:integration    # Integration tests (needs DB)
cd backend && npm run test:coverage       # Coverage report

# Frontend
cd frontend && npm test                   # Unit tests

# E2E
cd e2e && npx playwright test            # Full E2E suite

# Mobile
cd mobile && npm test                     # Jest tests
```

## AWS Services

All AWS services use real endpoints from day 1. Wrappers in `backend/src/shared/services/`:

| Service | File | Purpose |
|---------|------|---------|
| Cognito | `auth.ts` | User auth (JWT tokens, user management) |
| SQS | `queue.ts` | Message queues (alerts, notifications) |
| SES | `email.ts` | Email delivery |
| SNS | `push.ts` | Push notifications (FCM/Android) |
| S3 | `storage.ts` | File uploads |

All use AWS SDK v3 clients. Region configured via `AWS_REGION` env var (default: `us-east-2`).

## Infrastructure

### Local Dev
- PostgreSQL 15 via Docker on port **5433** (not 5432, to avoid conflicts)
- `docker-compose.dev.yml` — user: `oncallshift`, password: `localdev`, db: `oncallshift`

### Production (AWS)
- Terraform modules in `infrastructure/terraform/modules/`
- Single production environment in `infrastructure/terraform/environments/prod/`
- All infra changes go through GitHub Actions (`_infra.yml`) on self-hosted runner
- State bucket: `workermill-terraform-state-593971626975` (us-east-1)
- Resources deployed to: **us-east-2**

### CI/CD
- GitHub Actions workflows in `.github/workflows/`
- Self-hosted runner labeled `oncallshift` (EC2 in VPC private subnet)
- `_infra.yml`: terraform plan on PR, apply on merge to main
- App deployment workflows added in Phase 13

## Logging

Winston structured logger at `backend/src/shared/utils/logger.ts`:
- Request ID included in all log entries
- Log levels: error, warn, info, debug
- Development: error + warn logged
- Production: error only

## Docker

Backend Dockerfile uses multi-stage build:
1. **Builder stage:** Node 22-alpine, `npm ci`, `tsc` compile
2. **Runtime stage:** Node 22-alpine, `npm ci --omit=dev`, copy `dist/`
3. Exposes port 3000, runs `node dist/api/server.js`

## Key Design Decisions

1. **ESM everywhere** — `.js` extensions in imports, `"type": "module"` in package.json
2. **Real AWS from day 1** — No local stubs; same code path in dev and production
3. **RFC 9457 errors** — All API errors use Problem Details format
4. **Explicit registration** — TypeORM entities and migrations added to arrays manually (no globs)
5. **Idempotent seeds** — Check-before-insert pattern; `npm run seed` is always safe to run
6. **Multi-tenant isolation** — All queries scoped by `orgId`; never return cross-org data
7. **Migrations only** — `synchronize: false`; all schema changes via explicit migrations
8. **Progressive seed data** — Each phase extends `seed.ts` with new demo data
