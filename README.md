# OnCallShift

Incident management platform — Built by WorkerMill.

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)
- AWS credentials configured (`~/.aws/credentials`) for us-east-2

### Setup

```bash
# 1. Clone and install
git clone https://github.com/jarod-rosenthal/oncallshift.git
cd oncallshift

# 2. Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3. Configure environment
cp .env.example .env
# Edit .env with real AWS service values from Terraform outputs

# 4. Start everything
bin/dev
```

This starts:
- **PostgreSQL** on `localhost:5433` (Docker)
- **Backend** on `http://localhost:3000` (Express + tsx watch)
- **Frontend** on `http://localhost:5173` (Vite HMR)

### Manual Start

```bash
# Start PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# Start backend (in one terminal)
cd backend && npm run dev

# Start frontend (in another terminal)
cd frontend && npm run dev
```

## Project Structure

```
oncallshift/
├── backend/               # Express + TypeScript API
│   ├── src/
│   │   ├── api/           # Routes, app setup, server
│   │   ├── shared/        # DB, middleware, services, utils
│   │   └── workers/       # Background job processors
│   ├── Dockerfile
│   └── package.json
├── frontend/              # React 19 + Vite + TailwindCSS
│   ├── src/
│   │   ├── pages/         # Route pages
│   │   ├── components/    # Shared components
│   │   ├── stores/        # Zustand stores
│   │   ├── hooks/         # Custom hooks
│   │   └── lib/           # API client, utilities
│   └── package.json
├── mobile/                # React Native + Expo
├── e2e/                   # Playwright E2E tests
├── infrastructure/        # Terraform IaC
│   └── terraform/
│       ├── environments/  # dev, prod configs
│       └── modules/       # Reusable Terraform modules
├── packages/              # Shared packages (MCP server)
├── .github/workflows/     # CI/CD (activated in Phase 13)
├── docker-compose.dev.yml # Local PostgreSQL
├── bin/dev                # Start all services
└── .env.example           # Environment variable template
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express 4.18 + TypeScript 5.3 |
| ORM | TypeORM 0.3.17 |
| Database | PostgreSQL 15 |
| Auth | AWS Cognito |
| Frontend | React 19 + Vite + TailwindCSS 3.4 |
| Mobile | React Native 0.81 + Expo 54 |
| Infrastructure | Terraform on AWS |
| CI/CD | GitHub Actions |

## Testing

```bash
# Backend unit tests
cd backend && npm run test

# Backend integration tests (requires PostgreSQL)
cd backend && npm run test:integration

# Frontend tests
cd frontend && npm run test

# E2E tests (requires running app)
cd e2e && npm run test:e2e
```

## AWS Services (Real from Day 1)

The application connects to real AWS managed services in development:

- **Cognito** — Authentication (JWT tokens)
- **SQS** — Alert and notification queues
- **SES** — Email delivery
- **SNS** — Push notifications
- **S3** — File uploads

Cost: ~$5/month at development volumes.

## License

Private — WorkerMill
