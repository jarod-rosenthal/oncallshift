# OnCallShift — Development Guide

## Quick Start

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Copy environment config
cp .env.example .env
# Fill in AWS service values from Terraform outputs:
#   cd infrastructure/terraform/environments/dev && terraform output

# 3. Start everything (PostgreSQL + backend + frontend)
bin/dev
```

## Project Structure

```
oncallshift/
├── backend/          Express 4 + TypeScript (ESM) on :3000
├── frontend/         React 19 + Vite + TailwindCSS on :5173
├── mobile/           React Native + Expo (stub)
├── e2e/              Playwright E2E tests
├── infrastructure/   Terraform (AWS managed services)
├── packages/         oncallshift-mcp (MCP server)
├── bin/dev           Local dev orchestrator
└── docker-compose.dev.yml  PostgreSQL on :5433
```

## Backend Conventions

### ESM Imports
Backend uses ES modules (`"type": "module"` in package.json). All local imports **must** use `.js` extensions:
```typescript
import { env } from "../shared/config/env.js";
import { Organization } from "../models/organization.js";
```

### Directory Layout
```
backend/src/
├── api/
│   ├── app.ts            Express app (middleware + routes)
│   ├── server.ts         Entry point (DB connect + listen)
│   └── routes/           Route handlers (one file per resource)
├── shared/
│   ├── config/env.ts     Environment variables (centralized)
│   ├── db/
│   │   ├── connection.ts TypeORM DataSource (entity registration)
│   │   ├── migrate.ts    Migration runner (npm run migrate)
│   │   ├── seed.ts       Seed runner (npm run seed)
│   │   ├── seeds/        Seed data files (one per entity)
│   │   └── migrations/   TypeORM migrations
│   ├── middleware/       Express middleware
│   ├── models/           TypeORM entity classes
│   ├── services/         AWS service clients (SQS, S3, SES, SNS, Cognito)
│   └── utils/            Shared utilities (logger, problem-details)
└── workers/              Background workers (future)
```

### Error Handling
All API errors use **RFC 9457 Problem Details** format via `AppError` and subclasses in `shared/utils/problem-details.ts`:
```typescript
throw new NotFoundError("Incident", id);
throw new ValidationError("Email is required", { email: ["required"] });
throw new ForbiddenError();
```

### Middleware Stack (order matters)
1. `helmet` — Security headers
2. `compression` — Response compression
3. `cors` — CORS (from `CORS_ORIGINS` env var)
4. `requestIdMiddleware` — UUID request tracing
5. `express.json` — Body parsing
6. `requestLoggerMiddleware` — Request logging
7. `baseLimiter` — Rate limiting (100 req/15min)
8. Routes
9. `notFoundHandler` — 404 catch-all
10. `errorHandler` — Global error handler (must be last)

### Rate Limiting Tiers
- `baseLimiter`: 100 req/15min (applied globally)
- `expensiveLimiter`: 20 req/15min (for search, analytics)
- `bulkLimiter`: 10 req/15min (for import, bulk operations)
- `authLimiter`: 5 req/1min (for login, signup)

### Multi-Tenant Scoping
All queries must be scoped by `orgId` from the authenticated request:
```typescript
const items = await repo.find({ where: { orgId: req.user.orgId } });
```

## Database

### Connection
TypeORM DataSource configured in `backend/src/shared/db/connection.ts`. New entities must be imported and added to the `entities` array.

### Migrations
- Location: `backend/src/shared/db/migrations/`
- Naming: `NNN-description.ts` (e.g., `001-create-organizations.ts`)
- Run: `npm run migrate` (or automatically via `bin/dev`)
- Pattern: Raw SQL via `queryRunner.query()` for full control
- All tables include `created_at` and `updated_at` with trigger-based auto-update

### Seed Data
- Location: `backend/src/shared/db/seeds/`
- Run: `npm run seed` (idempotent — safe to run multiple times)
- Pattern: **Check-before-insert** — `SELECT` existence, `INSERT` only if missing
- Dependency order: organizations → users → teams → services → schedules → escalation policies → incidents → notifications
- New seed files must be imported and called from `backend/src/shared/db/seed.ts`

```typescript
// Example seed function (check-before-insert pattern)
export async function seedMyEntity(): Promise<void> {
  const repo = AppDataSource.getRepository(MyEntity);
  for (const data of items) {
    const existing = await repo.findOneBy({ name: data.name });
    if (existing) continue;
    await repo.save(repo.create(data));
  }
}
```

### Current Seed Data (Phase 0.2)
- 1 Organization: "Contoso Engineering" (enterprise plan)

## Testing

### Framework
Vitest + Supertest for backend. Tests colocated with source: `*.test.ts`.

### Commands
```bash
npm run test              # Run all unit tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
npm run test:integration  # Integration tests (requires DB)
```

### Conventions
- Mock all externals with `vi.mock()`
- Reset mocks in `beforeEach`: `vi.clearAllMocks()`
- Use Supertest for route testing: `await request(app).get("/health")`
- Test both success and error paths

### Mocking Pattern
```typescript
vi.mock("../shared/db/connection.js", () => ({
  AppDataSource: { getRepository: vi.fn() },
}));
```

## Frontend Conventions

### Structure
```
frontend/src/
├── components/layout/   App shell (AppLayout, Sidebar, Header)
├── pages/               Route page components (lazy-loaded)
├── stores/auth.ts       Zustand auth state
├── lib/
│   ├── api.ts           Axios client (base URL from VITE_API_URL)
│   ├── query-client.ts  React Query configuration
│   └── utils.ts         cn() — clsx + tailwind-merge
└── index.css            TailwindCSS base styles
```

### Routing
React Router v7 with lazy-loaded pages. Auth pages (Login, Register) render without sidebar. All app pages use `AppLayout` with sidebar navigation.

### State Management
- **Server state**: React Query (`@tanstack/react-query`)
- **Client state**: Zustand (`useAuthStore`)

### Styling
TailwindCSS with indigo brand palette (brand-50 through brand-950). Use `cn()` utility for conditional classes.

## Infrastructure

### Local Development
- PostgreSQL: Docker container on port 5433 (not 5432, avoids host conflicts)
- Backend: `tsx watch` with instant reload on :3000
- Frontend: Vite HMR on :5173
- AWS services: Real Cognito, SQS, SES, SNS, S3 (same code path as production)

### AWS Services (Real from Day 1)
All configured via `.env`, values from Terraform outputs:
- **Cognito**: User authentication (JWT)
- **SQS**: Alert and notification queues
- **SES**: Email delivery
- **SNS**: Push notifications
- **S3**: File uploads

### Environment Variables
All env vars centralized in `backend/src/shared/config/env.ts`. Use `env.propertyName` — never read `process.env` directly in application code.

## Common Commands

```bash
bin/dev                          # Start everything locally
npm run dev                      # Start backend or frontend individually
npm run build                    # Build TypeScript
npm run typecheck                # Type check without emit
npm run test                     # Run tests
npm run migrate                  # Run database migrations
npm run seed                     # Seed demo data (idempotent)
```

## Adding a New Feature Checklist

1. Create TypeORM entity in `backend/src/shared/models/`
2. Register entity in `backend/src/shared/db/connection.ts` entities array
3. Create migration in `backend/src/shared/db/migrations/`
4. Create route in `backend/src/api/routes/`
5. Register route in `backend/src/api/app.ts`
6. Add seed data in `backend/src/shared/db/seeds/` and wire into `seed.ts`
7. Write colocated `*.test.ts` unit tests
8. Update this file with new patterns if applicable
