# OnCallShift

Incident management platform — built by WorkerMill.

## Quick Start

```bash
# Prerequisites: Node.js 22+, Docker

# 1. Clone and install
git clone https://github.com/jarod-rosenthal/oncallshift.git
cd oncallshift

# 2. Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3. Copy environment variables
cp .env.example .env
# Edit .env with your AWS service values from terraform outputs

# 4. Start everything
./bin/dev
# Backend:  http://localhost:3000
# Frontend: http://localhost:5173
# Swagger:  http://localhost:3000/api-docs
```

## Project Structure

```
oncallshift/
├── backend/          Express + TypeScript + TypeORM API
├── frontend/         React 19 + Vite + TailwindCSS
├── mobile/           React Native + Expo (Android)
├── e2e/              Playwright E2E tests
├── infrastructure/   Terraform (AWS)
├── packages/         Shared packages (MCP server)
├── bin/dev           Local dev startup script
└── docker-compose.dev.yml  PostgreSQL for local dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express 4.18 + TypeScript 5.3 + TypeORM 0.3 |
| Database | PostgreSQL 15 |
| Frontend | React 19 + Vite + TailwindCSS 3.4 |
| Mobile | React Native + Expo (Android) |
| Auth | AWS Cognito |
| Cloud | AWS (SQS, SES, SNS, S3) |
| Infrastructure | Terraform on AWS |
| CI/CD | GitHub Actions |

## Development

- **Backend**: `cd backend && npm run dev` (port 3000)
- **Frontend**: `cd frontend && npm run dev` (port 5173)
- **Tests**: `cd backend && npm test`
- **TypeCheck**: `cd backend && npm run typecheck`
- **Seed DB**: `cd backend && npm run seed`
- **Migrate**: `cd backend && npm run migrate`
