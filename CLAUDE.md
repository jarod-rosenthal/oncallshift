# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OnCallShift is a production incident management platform deployed at https://oncallshift.com. It's a full-stack TypeScript application with:
- Backend API (Express + TypeScript)
- Web frontend (React + Vite)
- Mobile app (React Native + Expo)
- AWS infrastructure managed by Terraform

## Agent Workflow Guidelines

**Always consider spawning parallel agents to maximize efficiency.** This is a full-stack monorepo where work can often be parallelized across backend, frontend, and mobile.

### When to Use Parallel Agents

- **Cross-stack features**: Spawn agents for backend API, frontend UI, and mobile screens simultaneously
- **Independent file changes**: When modifying multiple unrelated files, use parallel agents
- **Research + implementation**: One agent explores/investigates while another implements known work
- **Type checking**: Run `npx tsc --noEmit` checks in parallel across backend/frontend/mobile
- **Multi-file refactoring**: Split large refactors across agents by file or directory

### Parallelization Examples

| Task | Parallel Approach |
|------|-------------------|
| Add new API endpoint + UI | Agent 1: backend route, Agent 2: frontend page, Agent 3: mobile screen |
| Fix bug across platforms | Agent 1: backend fix, Agent 2: frontend fix, Agent 3: mobile fix |
| Add new model + routes | Agent 1: TypeORM model + migration, Agent 2: API routes |
| Investigate + fix | Agent 1: search logs/code for root cause, Agent 2: implement known fixes |

### Agent Best Practices

1. **Spawn early**: Launch parallel agents at the start of multi-part tasks
2. **Clear boundaries**: Give each agent distinct files/directories to avoid conflicts
3. **Background agents**: Use `run_in_background: true` for long-running tasks
4. **Collect results**: Use `TaskOutput` to gather parallel agent results before proceeding

### Tool Installation Policy

**Always install tools that improve quality rather than wasting time on workarounds.**

- If a CLI tool (gh, jq, aws-cli, etc.) would make a task easier or more reliable, install it immediately using `winget install` or the appropriate package manager
- Don't spend time crafting complex workarounds when a proper tool exists
- Common tools to install when needed:
  - `GitHub.cli` (gh) - For PR creation, issue management
  - `stedolan.jq` (jq) - For JSON processing
  - `Amazon.AWSCLI` - For AWS operations
  - `Hashicorp.Terraform` - For infrastructure

**Example**: If you need to create a PR and `gh` isn't installed, install it rather than telling the user to do it manually.

## Local LLM Usage (Ollama MCP)

A local Ollama server is available with high-performance models running on an RTX 5090 (32GB VRAM). **Use the `mcp__ollama__*` tools to offload repetitive code generation tasks and reduce API costs.**

### Available Models & Task Mapping

| Model | Size | Speed | Best For |
|-------|------|-------|----------|
| `llama3.1:8b` | 8B | ⚡ Ultra Fast | Quick type generation, simple transforms |
| `devstral-small-2:24b` | 24B | 🚀 Fast | CRUD routes, React components, multi-file edits |
| `qwen3-coder:30b` | 30B MoE | 🚀 Fast | Complex code generation, test writing |
| `deepseek-r1:70b` | 70B | 🐢 Slow | Code explanations, reasoning tasks |
| `llama3.3:70b` | 70B | 🐢 Slow | General purpose, documentation |

### When to Use Ollama (Proactive Offloading)

**ALWAYS prefer Ollama for these tasks:**

1. **Boilerplate Generation**
   - Express routes with validation
   - React/React Native components
   - TypeORM entities and migrations
   - API response type interfaces

2. **Test Generation**
   - Jest unit tests for functions
   - Test fixtures and mocks
   - E2E test scaffolding

3. **Bulk Transformations**
   - Renaming patterns across files
   - Adding TypeScript types to JS code
   - Converting callback to async/await

4. **Documentation**
   - JSDoc comments for functions
   - README sections for modules
   - API endpoint documentation

### How to Use (MCP Tools)

The Ollama MCP server provides these tools:
- `mcp__ollama__generate` - Generate text/code with a prompt
- `mcp__ollama__chat` - Multi-turn conversation
- `mcp__ollama__list_models` - List available models

**Example invocations:**
```
# Generate a CRUD route
Use mcp__ollama__generate with model "devstral-small-2:24b" to create an Express route for managing Teams

# Generate unit tests
Use mcp__ollama__generate with model "qwen3-coder:30b" to write Jest tests for the function in backend/src/shared/utils/filtering.ts

# Generate TypeScript types
Use mcp__ollama__generate with model "llama3.1:8b" to create TypeScript interfaces from this JSON response: {...}
```

### Quality Control Guidelines

1. **Always validate output** - Run `npx tsc --noEmit` after generating TypeScript
2. **Review before committing** - Ollama output may need minor adjustments
3. **Use smaller models for simple tasks** - `llama3.1:8b` for types, `devstral-small-2` for routes
4. **Provide context** - Include existing patterns/examples in the prompt

### When to Use Claude Instead (Never Offload)

- **Complex debugging** - Requires full codebase context
- **Architectural decisions** - Trade-off analysis, design patterns
- **Security-sensitive code** - Auth, validation, encryption
- **Multi-step investigations** - Log analysis, root cause discovery
- **Code requiring existing file context** - Modifications to existing functions
- **Tasks where quality is critical** - Production hotfixes, data migrations

## Build and Development Commands

### Backend
```bash
cd backend
npm install
npm run dev          # Development server (localhost:3000)
npm run build        # TypeScript compilation
npm run start        # Production server
npm run migrate      # Run database migrations
npm run migrate:create  # Create new migration
npm run seed         # Seed test data
npm run lint         # ESLint
npx tsc --noEmit     # Type check without emitting
npm test             # Run all tests
npm test -- --testPathPattern=webhooks  # Run single test file
```

### Backend Workers
```bash
cd backend
# Note: Alert processor runs as separate ECS task in production (consumes from SQS)
npm run start:worker             # Notification worker
npm run start:escalation-timer   # Escalation timer worker
npm run start:snooze-expiry      # Snooze expiry worker
npm run start:report-scheduler   # Report scheduler worker
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # Development server (localhost:5173)
npm run build        # Production build (includes tsc)
npm run lint         # ESLint
npx tsc -b           # Type check only
npm run preview      # Preview production build
```

### Mobile
```bash
cd mobile
npm install
npm start            # Expo Metro bundler
npx expo start --host lan    # For physical device testing
npm run android      # Run on Android
npm run ios          # Run on iOS
npx tsc --noEmit     # Type check
```

### Mobile Development with Physical Device

The mobile app connects to the **production API** at `https://oncallshift.com/api`. No local backend is needed for mobile development.

**Starting the Metro Bundler:**
```bash
cd mobile
npx expo start --host lan    # Binds to LAN IP for physical device testing
```

**Connecting from your phone:**
1. Ensure phone is on the same WiFi network as your dev machine
2. Open Expo Go app on phone
3. Scan QR code from terminal, or enter URL shown in terminal (e.g., `exp://<YOUR_IP>:8081`)

**TypeScript Validation:**
```bash
cd mobile
npx tsc --noEmit    # Check for TypeScript errors before testing
```

**Troubleshooting:**
- If phone can't connect, check Windows Firewall allows Node.js on port 8081
- Verify Metro is running: `netstat -an | findstr "8081"` should show LISTENING
- Test from phone browser: `http://<YOUR_LAN_IP>:8081` should return packager status

**Config file:** `mobile/src/config/index.ts` - Points to production API, no changes needed for development.

**Key files:**
- `mobile/src/screens/` - All screen components
- `mobile/src/components/` - Reusable components (export via `index.ts`)
- `mobile/src/services/apiService.ts` - API client methods
- `mobile/src/config/index.ts` - API URL and Cognito config

**Avoiding require cycles:** When adding new components to `mobile/src/components/`, import dependencies directly (e.g., `import { useToast } from './ActionToast'`) rather than from `./index` to avoid circular dependencies.

### Mobile App Builds (EAS Build)

The mobile app uses **EAS Build** for cloud-based builds and **EAS Update** for over-the-air (OTA) updates.

**Key Configuration Files:**
- `mobile/app.json` - Expo config with updates enabled
- `mobile/eas.json` - Build profiles with channels configured
- `mobile/.gitignore` - `/android` and `/ios` are ignored (CNG mode)

**Build Profiles:**
| Profile | Channel | Purpose |
|---------|---------|---------|
| `development` | `development` | Dev build with hot reload |
| `preview` | `preview` | Test APK for testers |
| `production` | `production` | App store release |

**Building the App:**
```bash
cd mobile

# Preview build (APK for testing)
eas build --platform android --profile preview

# Production build
eas build --platform android --profile production
```

**Required for Android Builds:**
- `mobile/google-services.json` - Firebase config (gitignored, stored as EAS secret)
- Firebase project configured for push notifications

**Note on Windows:** EAS CLI commands should be run from PowerShell, not WSL.

**CRITICAL: CNG Mode (Continuous Native Generation)**

The app uses CNG mode where EAS generates native folders fresh each build:
- `/android` and `/ios` are in `.gitignore`
- Never commit native folders - they're generated from `app.json` config
- If you need to modify native code, use Expo config plugins instead

**Sentry Configuration (Currently Disabled):**
- Sentry plugins were removed from `app.json` due to Gradle build failures
- The `@sentry/react-native` package is still installed but not configured as a plugin
- To re-enable: add `"@sentry/react-native/expo"` to `app.json` plugins array
- May require SDK version alignment - test thoroughly before enabling

### Mobile OTA Updates

OTA updates push JavaScript changes to installed apps without rebuilding.

**Pushing an Update:**
```bash
cd mobile
eas update --branch preview --message "Description of changes"
```

**How It Works:**
1. Users install the APK once (from EAS Build)
2. Push updates with `eas update`
3. App downloads new JS bundle on next launch
4. Users can also tap "Check for Updates" in Settings

**Important Configurations (DO NOT CHANGE):**
```json
// app.json - updates must be enabled
"updates": {
  "enabled": true,
  "url": "https://u.expo.dev/7311a48c-3b87-4bb8-8bba-549de8a578e7"
},
"runtimeVersion": {
  "policy": "appVersion"
}

// eas.json - channels must match build profiles
"preview": {
  "channel": "preview",
  ...
}
```

**Required Package:**
- `expo-updates` must be installed for OTA to work
- Settings screen has "Check for Updates" button using `expo-updates` API

**Limitations:**
- OTA can only update JavaScript/assets
- Native code changes (permissions, plugins) require a new build
- Updates only work in production builds, not Expo Go

**Development Workflow for UI Changes:**
1. Make changes to mobile code
2. Push OTA update: `eas update --branch preview --message "Description"`
3. User taps "Check for Updates" in Settings or restarts app
4. Changes appear without reinstalling APK

This is much faster than rebuilding the entire APK for JavaScript-only changes.

### Deployment

**ALWAYS use the `deploy.sh` script for ALL deployments.** Never manually build/push Docker images or upload frontend files.

```bash
./deploy.sh          # Full deployment (required for all changes)
```

The deploy script handles:
1. Frontend build (Vite) → S3 upload → CloudFront invalidation
2. Backend Docker build → ECR push → ECS force deployment
3. Database migrations via ECS exec
4. Automatic rollback on failure

**Never skip this step** - both frontend and backend must be deployed together to maintain consistency.

**IMPORTANT: Always run `./deploy.sh` after making UI code changes** so the user can view them at https://oncallshift.com. The frontend is served from S3/CloudFront and changes are not visible until deployed.

### Infrastructure
```bash
cd infrastructure/terraform/environments/dev
terraform init
terraform plan
terraform apply
```

## Architecture

### Component Structure
- **backend/src/api/routes/**: REST API routes (34 route files)
- **backend/src/workers/**: Background processors (alert-processor, notification-worker, escalation-timer, snooze-expiry, report-scheduler)
- **backend/src/shared/models/**: TypeORM database entities (60+ models)
- **backend/src/shared/**: Middleware, utilities, database configuration
- **frontend/src/pages/**: React page components
- **frontend/src/components/**: Shared UI components
- **mobile/src/screens/**: React Native screens (32 screens)
- **mobile/src/services/**: API client, auth, push notifications, runbooks
- **mobile/src/components/**: Shared mobile components

### Key Features Implemented
- **Escalation Timer**: `backend/src/workers/escalation-timer.ts` - Auto-advances escalation steps every 30s
- **Runbooks**: `backend/src/api/routes/runbooks.ts` - CRUD + manual execution
- **Runbook Automation**: `backend/src/api/routes/runbook-automation.ts` - Claude AI-powered automated runbook execution with sandboxed environments
- **AI Assistant**: `backend/src/api/routes/ai-assistant.ts` - Unified AI chat with org-specific API keys and cloud investigation
- **AI Diagnosis**: `backend/src/api/routes/ai-diagnosis.ts` - Claude-powered incident analysis
- **User Actions**: Reassign, escalate, snooze, add responders in `backend/src/api/routes/incidents.ts`
- **Setup Wizard**: `frontend/src/pages/SetupWizard.tsx` and `mobile/src/screens/SetupWizardScreen.tsx`
- **Notification Tracking**: Delivery status per user/channel
- **Cloud Credentials**: `backend/src/api/routes/cloud-credentials.ts` - AWS/GCP/Azure credential management for investigation

### Data Flow
1. **Alert Ingestion**: Webhook → API → SQS → Alert Processor → Incident created → Escalation starts
2. **Escalation**: Escalation Timer checks every 30s → Advances steps → Triggers notifications
3. **Notifications**: Notification Worker → Email (SES), Push (Expo), SMS (SNS)
4. **Authentication**: AWS Cognito JWT tokens verified by middleware

### Database Models (TypeORM)
See `backend/src/shared/models/` for 60+ entity definitions. Core entities include Organization, User, Team, Service, Schedule, Incident, EscalationPolicy, Notification.

### Testing
Backend tests are in `backend/src/**/__tests__/*.test.ts` using Jest with ts-jest. Test files are colocated near the code they test.

```bash
cd backend
npm test                                    # Run all tests
npm test -- --testPathPattern=webhooks      # Run single test file
npm test -- --watch                         # Watch mode
```

### E2E Testing
E2E tests use Playwright in `e2e/`. Tests run against the production site by default.

```bash
cd e2e
npm install
npx playwright test                         # Run all tests
npx playwright test --project=chromium      # Single browser
npx playwright test --ui                    # Interactive mode
npx playwright show-report                  # View results
```

**Key files:**
- `e2e/playwright.config.ts` - Test configuration
- `e2e/page-objects/` - Page object pattern for reusable selectors
- `e2e/fixtures/` - Shared test fixtures
- `e2e/tests/` - Test specs organized by feature

## Key Patterns

### API Routes
Routes in `backend/src/api/routes/` follow RESTful patterns. Auth middleware protects authenticated endpoints.

### Multi-Tenancy
All queries scoped by `org_id`. Users belong to organizations.

### Workers
Workers in `backend/src/workers/` consume from SQS queues using long polling or run on timers. Each deployed as separate ECS tasks:
- **alert-processor**: Processes incoming alerts from SQS queue
- **notification-worker**: Delivers notifications via email/push/SMS
- **escalation-timer**: Auto-advances escalation steps, handles heartbeats
- **snooze-expiry**: Processes expired incident snoozes
- **report-scheduler**: Generates scheduled reports

### Frontend State
- Server state: TanStack React Query
- Auth state: Zustand store
- Forms: React Hook Form

### Mobile Navigation
React Navigation with bottom tabs + stack navigation. Deep linking for push notifications.

### AI Integration
- **Claude API**: Used for incident diagnosis, runbook automation, and cloud investigation
- **Org-specific API keys**: Organizations can provide their own Anthropic API keys stored encrypted in the database
- **Cloud Investigation**: AI can query AWS/GCP/Azure resources when credentials are configured
- **Runbook Automation**: AI executes runbook steps in sandboxed environments with approval workflows

### MCP Server
The `packages/oncallshift-mcp/` package provides an MCP (Model Context Protocol) server for AI assistant integration, enabling programmatic access to OnCallShift features.

## Infrastructure Rules

**CRITICAL: Terraform is the ONLY source of truth for all AWS infrastructure.**

### Mandatory Practices

1. **NEVER make manual AWS Console changes** - All infrastructure changes MUST go through Terraform
2. **ALWAYS keep Terraform state synchronized** - If resources exist but aren't in state, import them immediately
3. **ALWAYS run `terraform plan` before any infrastructure discussion** - Check for drift early
4. **COMMIT Terraform changes immediately** - After `terraform apply`, commit to git right away

### Workflow
```bash
cd infrastructure/terraform/environments/dev
terraform init          # Initialize if needed
terraform plan          # ALWAYS check for drift first
terraform apply         # Apply changes
git add . && git commit # Commit immediately after apply
```

### Preventing Drift
- If you discover resources exist outside Terraform: `terraform import` them immediately
- Never "temporarily" create resources manually - they will be forgotten
- Run `terraform plan` at the start of each session to detect drift

### Consequences of Drift
- CloudFront routing breaks when state doesn't match reality
- Services may use outdated configurations
- Debugging becomes difficult when actual state differs from expected

## Security Requirements

**CRITICAL: Security is NOT optional. Never compromise on security best practices.**

### Principle of Least Privilege (MANDATORY)

1. **IAM Policies must be scoped** - Never use `Resource: "*"` with destructive actions
   - Split large policies into multiple smaller policies (10KB limit per inline policy)
   - Scope resources to specific ARN patterns: `arn:aws:service:region:account:resource/project-*`
   - Use separate statements for read-only vs write operations

2. **Never disable security controls** - These are FORBIDDEN:
   - `NODE_TLS_REJECT_UNAUTHORIZED=0` - Never disable TLS validation
   - Hardcoded credentials in code or scripts
   - Overly permissive security groups (0.0.0.0/0 for non-public services)
   - Disabling SSL/TLS requirements for databases

3. **Secrets Management**
   - Use AWS Secrets Manager for all credentials
   - Never commit secrets to git (use .env.example templates)
   - Rotate credentials regularly

4. **Input Validation**
   - Validate all webhook payloads (use HMAC signatures for Slack, PagerDuty, etc.)
   - Use express-validator for all API inputs
   - Sanitize user inputs to prevent injection attacks

### Security Review Checklist

Before any deployment, verify:
- [ ] IAM policies use least-privilege with scoped resources
- [ ] No hardcoded credentials or secrets
- [ ] TLS/SSL enabled for all connections
- [ ] Webhook signature verification implemented
- [ ] Input validation on all endpoints
- [ ] No overly permissive security groups

### When Making IAM Changes

```hcl
# WRONG - Too permissive
Action   = ["s3:*"]
Resource = "*"

# CORRECT - Scoped to project resources
Action   = ["s3:GetObject", "s3:PutObject"]
Resource = ["arn:aws:s3:::oncallshift-*/*"]
```

If a policy exceeds 10KB, split into multiple policies by domain:
- `compute-permissions` - EC2, ECS, ECR, ELB
- `data-permissions` - RDS, S3, Secrets Manager
- `networking-permissions` - CloudFront, Route53, ACM
- `messaging-permissions` - Cognito, SQS, SNS, SES
- `iam-monitoring-permissions` - IAM, Logs, CloudWatch

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- `deploy.yml`: Orchestrator (manual trigger)
- `_infra.yml`: Terraform with plan approval
- `_backend.yml`: Docker → ECR → ECS
- `_frontend.yml`: Build → S3 → CloudFront
- `_mobile.yml`: Expo EAS build

## Environment

- **AWS Region**: us-east-1
- **Live URL**: https://oncallshift.com
- **API Docs**: https://oncallshift.com/api-docs
- **Cognito User Pool**: us-east-1_qWv6JSIYH

## Troubleshooting

### View ECS Service Status
```bash
aws ecs describe-services --cluster pagerduty-lite-dev \
  --services pagerduty-lite-dev-api --region us-east-1
```

### View Logs
```bash
aws logs tail /ecs/pagerduty-lite-dev/api --follow --region us-east-1
aws logs tail /ecs/pagerduty-lite-dev/alert-processor --follow --region us-east-1
aws logs tail /ecs/pagerduty-lite-dev/notification-worker --follow --region us-east-1
aws logs tail /ecs/pagerduty-lite-dev/escalation-timer --follow --region us-east-1
```

### Database Access

**Note:** The RDS database is in a private subnet and is not reachable from local development machines. Database operations must go through ECS tasks or the AWS console.

```bash
# Migrations run automatically during ECS deployment via deploy.sh
# To run migrations manually, use ECS exec:
aws ecs execute-command --cluster pagerduty-lite-dev \
  --task <task-id> --container api --interactive \
  --command "node dist/shared/db/migrate.js"

# Create new migration (local)
cd backend && npm run migrate:create
```

## Work In Progress

Active development features that may have incomplete code:
- **Semantic Import Frontend**: Backend complete at `/api/v1/semantic-import`, frontend components in `frontend/src/features/semanticImport/` (in progress)
- See `docs/SEMANTIC_IMPORT_PROGRESS.md` for implementation status

## Key API Endpoints

Main API routes include:
- `/api/v1/incidents` - Incident CRUD + actions (acknowledge, resolve, reassign, escalate)
- `/api/v1/alerts/webhook` - Alert ingestion (PagerDuty/Opsgenie compatible)
- `/api/v1/services`, `/api/v1/teams`, `/api/v1/users` - Core entities
- `/api/v1/schedules` - On-call schedules with `/oncall` for current on-call
- `/api/v1/escalation-policies` - Multi-step escalation definitions
- `/api/v1/runbooks` - Runbook management and execution
- `/api/v1/runbook-automation` - AI-powered runbook step execution with sandbox
- `/api/v1/ai-assistant` - AI-powered incident analysis
- `/api/v1/cloud-credentials` - Cloud provider credentials for investigation
- `/api/v1/status-pages` - Public/private status pages
- `/api/v1/import`, `/api/v1/export` - Platform migration tools
- `/api/v1/semantic-import` - AI-powered screenshot/text import (Claude Vision)
