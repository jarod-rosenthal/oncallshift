# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OnCallShift is a production incident management platform deployed at https://oncallshift.com. It's a full-stack TypeScript application with:
- Backend API (Express + TypeScript)
- Web frontend (React + Vite)
- Mobile app (React Native + Expo)
- AWS infrastructure managed by Terraform

## Communication Style

**Be transparent and narrate your work.** Don't just silently execute - share your thinking.

Share what you're doing before starting, what you're finding during exploration, your reasoning when making decisions, and summarize what was done after completing work. Don't ask for approval on routine decisions—just communicate what you're doing.

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

### Progress Tracking for Long Tasks

**CRITICAL: For multi-phase implementations, track progress in a markdown file.**

When working on large features that span multiple files or may be interrupted:

1. **Create a progress file** at `.claude/progress/<feature-name>.md`
2. **Update after each phase** with:
   - Completed items (checked boxes)
   - Current status
   - Next steps
   - Any blockers or issues encountered
3. **Reference the plan file** if one exists in `docs/` or `.claude/plans/`

This ensures work can be resumed if the session is interrupted.

## Jira Ticket Standards

**All Jira tickets must follow these standards.** See `docs/JIRA_MIGRATION_TRACKER.md` for the full reference.

### User Story Format (Required)

Every ticket MUST include a user story:

```
As a [role],
I want [capability],
So that [benefit].
```

**Roles:**
- `on-call engineer` - Primary incident responder
- `team lead` - Manages team schedules and policies
- `platform admin` - Organization administrator
- `super admin` - OnCallShift internal admin
- `developer` - Building integrations with OnCallShift

### Definition of Done (Required)

Every ticket is complete when ALL of the following are met:

- [ ] Code passes TypeScript type checking (`npx tsc --noEmit`)
- [ ] Code follows existing patterns in the codebase
- [ ] Tests written for new functionality (80%+ coverage on critical paths)
- [ ] No security vulnerabilities introduced (OWASP Top 10 compliance)
- [ ] Terraform state remains synchronized (no drift)
- [ ] Database migrations are reversible
- [ ] API changes are backwards compatible (or properly versioned)
- [ ] PR filled out with Summary, Test Plan, and screenshots (if UI)
- [ ] Code reviewed and approved

### Acceptance Criteria Format (Required)

Use Gherkin-style format:

```
GIVEN [initial context]
WHEN [action is taken]
THEN [expected outcome]
```

### Required Ticket Sections

| Section | Required | Description |
|---------|----------|-------------|
| Summary | Yes | One-line description |
| User Story | Yes | Who/What/Why format |
| Description | Yes | Detailed context and requirements |
| Acceptance Criteria | Yes | Gherkin-style testable criteria |
| Technical Notes | Optional | Implementation hints, code snippets, naming conventions |
| Dependencies | Optional | Blocked by / Blocks |
| Out of Scope | Optional | Explicit exclusions |
| References | Optional | Links to docs, designs, related tickets |

### Story Prefixes

Use prefixes to indicate work type:

| Prefix | Meaning |
|--------|---------|
| `[GAP]` | Missing functionality that needs implementation |
| `[VERIFY]` | Existing implementation needs verification/testing |
| `[FIX]` | Bug fix or correction to existing code |
| `[REFACTOR]` | Code improvement without behavior change |

### Before Creating a Ticket

**CRITICAL: Always check the current codebase state first.**

1. Search for existing implementations using Grep/Glob
2. If feature exists, create `[VERIFY]` story to validate it works correctly
3. If feature is partial, create `[GAP]` story documenting what's missing
4. Include "Current State" section showing what already exists
5. Include "Implementation Required" section showing only the actual gaps

### Priority Definitions

| Priority | Meaning | Response Time |
|----------|---------|---------------|
| Highest | Production blocker, security issue | Immediate |
| High | Critical path for next milestone | This sprint |
| Medium | Important but not blocking | Next 2-4 sprints |
| Low | Nice to have, backlog grooming | When capacity allows |
| Lowest | Future consideration | Unscheduled |

### Story Point Guidelines

| Points | Complexity | Examples |
|--------|------------|----------|
| 1 | Trivial | Config change, typo fix |
| 2 | Simple | Single file change, add field |
| 3 | Small | New endpoint, new component |
| 5 | Medium | Feature spanning 3-5 files |
| 8 | Large | Multi-service feature, new integration |
| 13 | Epic-sized | Break down further |

### Task Completion Reporting

**After completing a ticket, you MUST update Jira with a completion comment AND transition the ticket to Done.** This helps the team learn from each task.

**Required in completion comment:**

1. **What was done** - Brief summary of changes made
2. **Files modified** - List key files changed (not every file, just the important ones)
3. **New artifacts** - Any new files, migrations, or resources created
4. **Tools installed** - Any new dependencies or CLI tools that were needed
5. **Blockers encountered** - Issues faced and how they were resolved
6. **Follow-up needed** - Any related work discovered that needs separate tickets
7. **Testing performed** - How the changes were verified

**CRITICAL: After adding the completion comment, you MUST transition the Jira ticket to "Done" status.** Use the Jira MCP tools to:
1. Add the completion comment via `jira_post` to `/rest/api/3/issue/{issueKey}/comment`
2. Get available transitions via `jira_get` to `/rest/api/3/issue/{issueKey}/transitions`
3. Transition to Done via `jira_post` to `/rest/api/3/issue/{issueKey}/transitions` with the Done transition ID

Never leave a completed task in "In Progress" status.

### Branch Naming Convention

**Every story MUST have a linked branch.** Use this naming pattern:

```
<type>/OCS-<number>-<short-description>
```

**Types:**
| Type | Usage |
|------|-------|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `refactor/` | Code improvements |
| `infra/` | Infrastructure changes |
| `security/` | Security fixes |

**Examples:**
- `feature/OCS-53-rds-proxy`
- `fix/OCS-55-cors-wildcard`
- `security/OCS-56-webhook-signatures`
- `infra/OCS-54-rds-multi-az`

**Workflow:**
1. Create branch from `main` using the naming convention
2. Link branch to Jira ticket (Development panel)
3. Create PR referencing the ticket: `OCS-XXX: Description`
4. PR must include Summary, Test Plan, and screenshots (if UI)

## Slash Commands

**Use slash commands for common workflows.** Commands are in `.claude/commands/` and pre-compute context for efficiency.

### Available Commands

| Command | Purpose |
|---------|---------|
| `/deploy` | Deploy frontend + backend to production |
| `/typecheck` | Run TypeScript checks on all projects in parallel |
| `/commit-push-pr` | Stage, commit, push, and create PR in one flow |
| `/test` | Run tests based on changed files |
| `/build` | Build frontend and/or backend for production |
| `/fix-types` | Iteratively fix TypeScript errors until clean |
| `/logs` | View ECS service logs for debugging |
| `/status` | Quick overview of git state and open PRs |
| `/mobile-update` | Push OTA update to mobile app |
| `/verify` | Verify work is complete (types, tests, lint) |

### When to Use Commands

- **After code changes**: `/typecheck` then `/deploy`
- **Ready to merge**: `/commit-push-pr`
- **Debugging production**: `/logs`
- **Before starting work**: `/status`
- **Mobile UI changes**: `/mobile-update`
- **Verify long task**: `/verify` (run as background agent)

## Hooks

Auto-formatting is configured in `.claude/settings.json`. After any Write/Edit to `.ts`/`.tsx`/`.js`/`.jsx` files, Prettier runs automatically.

For complex multi-step tasks, spawn a background verification agent that runs `/verify` when done.

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

## Windows/Git Bash Environment Issues

**This repository is developed on Windows with Git Bash.** Several environment issues can cause unexpected failures.

### When to Use WSL Instead of Git Bash

**CRITICAL: The Bash tool runs in Git Bash on Windows, which has severe shell parsing limitations. When commands fail with syntax errors, IMMEDIATELY spawn a Task agent - don't waste time debugging Git Bash quirks.**

Git Bash fails on:
- Command substitution `$(...)` in complex commands
- Variable expansion in URLs (e.g., `https://${TOKEN}@github.com/...`)
- Multi-line commands with special characters
- Basically anything beyond simple single-line commands

**The Task tool spawns agents that run in WSL where these issues don't exist:**
```
Task tool with subagent_type="general-purpose":
"Test the GitHub token by running:
GH_TOKEN=$(aws secretsmanager get-secret-value --secret-id pagerduty-lite-dev-github-token --query SecretString --output text)
git clone https://${GH_TOKEN}@github.com/jarosenthal/pagerduty-lite.git /tmp/test"
```

**Signs you should immediately delegate to a Task agent:**
- Bash tool returns syntax errors with `$(` or variable expansion
- Commands that worked before suddenly fail with parsing errors
- You've tried the same command 2+ times with different escaping

**Don't:** Spend an hour trying different escaping strategies in Git Bash
**Do:** Spawn a Task agent on the first shell parsing failure

### Verify Assumptions Early

Before debugging complex issues, verify basic assumptions:
```bash
# Check the actual repo remote - don't assume the username
git remote -v
```

**Example failure:** AI worker failed to clone `jarosenthal/pagerduty-lite` - the actual repo is `jarod-rosenthal/pagerduty-lite` (note the 'd'). An hour was wasted on encoding/shell issues when a simple `git remote -v` would have revealed the typo.

### AWS CLI Encoding Issues

When using `aws logs get-log-events` or similar commands that return Unicode/emoji content, the AWS CLI may fail with:
```
'charmap' codec can't encode character '\U0001f916'
```

**Root cause**: Windows console encoding doesn't support UTF-8 emojis by default.

**Workarounds**:
- Set `PYTHONIOENCODING=utf-8` before running AWS CLI commands
- Use `--output text` instead of JSON
- Pipe through `iconv -c -f UTF-8 -t ASCII//TRANSLIT`
- **Best fix**: Avoid emojis in container/script output entirely

### Terraform PATH Issues in Git Bash

Terraform installed via `winget` isn't in Git Bash's PATH by default.

**Solution**: Add the path explicitly:
```bash
export PATH="$PATH:/c/Users/jarod/AppData/Local/Microsoft/WinGet/Packages/Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe"
terraform.exe apply ...
```

### MSYS Path Conversion

Git Bash automatically converts paths like `/foo/bar` to Windows paths, which breaks AWS CLI commands:
```
# This fails - Git Bash converts /ecs to C:/Program Files/Git/ecs
aws logs describe-log-streams --log-group-name /ecs/pagerduty-lite-dev/...

# This works - MSYS_NO_PATHCONV disables path conversion
MSYS_NO_PATHCONV=1 aws logs describe-log-streams --log-group-name "/ecs/..."
```

### Docker Container Encoding

When building Docker containers that output to CloudWatch Logs:
- **Avoid emojis in shell scripts** - They cause encoding failures even with UTF-8 locale
- Use text prefixes like `[INFO]`, `[ERROR]`, `[SUCCESS]` instead of emojis

### ECS Image Caching

When pushing new Docker images with the same tag (e.g., `:latest`), Fargate may use cached image layers:
- **Solution**: Use versioned tags like `:v1`, `:v2`, etc.
- Update the ECS task definition to reference the new tag
- Run `terraform apply` to create a new task definition revision
- Verify the correct digest is pulled with `aws ecs describe-tasks --query 'tasks[0].containers[0].imageDigest'`

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

Use `mcp__ollama__generate` for text/code generation, `mcp__ollama__chat` for conversations, `mcp__ollama__list_models` to list models.

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

The mobile app connects to the **production API** at `https://oncallshift.com/api`. No local backend needed.

Use `npx expo start --host lan` for physical device testing. Phone must be on same WiFi—scan QR code in Expo Go app.

**Key files:** `mobile/src/screens/` (screens), `mobile/src/components/` (components), `mobile/src/services/apiService.ts` (API), `mobile/src/config/index.ts` (config).

**Avoiding require cycles:** Import dependencies directly (e.g., `import { useToast } from './ActionToast'`) rather than from `./index`.

### Mobile App Builds (EAS Build)

Uses **EAS Build** for cloud builds and **EAS Update** for OTA updates. Config in `mobile/app.json` and `mobile/eas.json`.

**Build profiles:** `development` (hot reload), `preview` (test APK), `production` (app store).

```bash
cd mobile
eas build --platform android --profile preview    # Test APK
eas build --platform android --profile production # Production
```

**Note:** EAS CLI should run from PowerShell, not WSL. Requires `google-services.json` (gitignored, stored as EAS secret).

**CNG Mode:** `/android` and `/ios` are gitignored—EAS generates them fresh each build. Use Expo config plugins for native modifications.

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

**Important:** OTA config in `app.json` and `eas.json` must stay enabled. `expo-updates` package required. OTA can only update JavaScript/assets—native changes require a new build.

### Deployment

#### For Human Developers (Local Machine)

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

#### For AI Workers (ECS Container)

**AI Workers MUST NOT use deploy.sh** - it requires Docker daemon which is unavailable in the container.

Instead, use direct deployment commands as documented in `/app/directives/common/deploy_and_verify.md`:
- **Backend:** Use Kaniko (`/kaniko/executor`) for Docker builds, then AWS CLI for ECS deployment
- **Frontend:** Use `npm run build` then `aws s3 sync` and `aws cloudfront create-invalidation`

See the ai-worker directives for complete deployment instructions.

#### AI Worker Orchestrator Deployment

**When changes affect ONLY the orchestrator,** use the dedicated orchestrator deployment script to ensure TypeScript is properly rebuilt:

```bash
./deploy-orchestrator.sh    # Deploy orchestrator with explicit TypeScript rebuild
```

**Use this script when:**
- Modifying `backend/src/workers/ai-worker-orchestrator.ts`
- Modifying `backend/src/shared/models/AIWorkerTask.ts` (especially status-related logic)
- Modifying any orchestrator-specific logic
- You've deployed before but the orchestrator is still running old code

**The script ensures:**
1. Backend TypeScript is explicitly rebuilt with `npm run build`
2. Docker image is built with a unique versioned tag (not just `:latest`)
3. New image is pushed to ECR
4. Orchestrator service is force-redeployed
5. New task starts and old task is terminated
6. Logs are checked to verify new code is running

**Why this exists:** The main `deploy.sh` doesn't always trigger TypeScript rebuilds, which can result in stale compiled JavaScript being packaged in Docker images. This dedicated script guarantees the orchestrator gets the latest code.

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
- **packages/oncallshift-mcp/**: MCP server for AI assistant integration
- **packages/terraform-provider-oncallshift/**: Terraform provider (Go)

### Key Features Implemented
- **Escalation Timer**: `backend/src/workers/escalation-timer.ts` - Auto-advances escalation steps every 30s
- **Runbooks**: `backend/src/api/routes/runbooks.ts` - CRUD + manual execution
- **Runbook Automation**: `backend/src/api/routes/runbook-automation.ts` - Claude AI-powered automated runbook execution with sandboxed environments
- **AI Assistant**: `backend/src/api/routes/ai-assistant.ts` - Unified AI chat with org-specific API keys and cloud investigation
- **AI Diagnosis**: `backend/src/api/routes/ai-diagnosis.ts` - Claude-powered incident analysis
- **AI Workers Control Center**: `backend/src/api/routes/super-admin.ts` - Super admin dashboard for monitoring AI workers (see below)
- **User Actions**: Reassign, escalate, snooze, add responders in `backend/src/api/routes/incidents.ts`
- **Setup Wizard**: `frontend/src/pages/SetupWizard.tsx` and `mobile/src/screens/SetupWizardScreen.tsx`
- **Notification Tracking**: Delivery status per user/channel
- **Cloud Credentials**: `backend/src/api/routes/cloud-credentials.ts` - AWS/GCP/Azure credential management for investigation

### AI Workers Control Center

A super admin feature for monitoring and managing AI workers. Requires `super_admin` role or org API key authentication.

**Key Files:**
- `backend/src/api/routes/super-admin.ts` - API endpoints for control center data
- `frontend/src/pages/SuperAdminControlCenter.tsx` - Web dashboard (htop-style worker overview)
- `backend/scripts/ai-worker-cli.ts` - CLI tool for terminal-based monitoring
- `.claude/plans/effervescent-brewing-cloud.md` - Implementation plan

**API Endpoints:**
- `GET /api/v1/super-admin/control-center` - Aggregated worker/task data
- `GET /api/v1/super-admin/control-center/logs/:taskId` - Stream logs for a task

**CLI Tool:**
```bash
cd backend
npx ts-node scripts/ai-worker-cli.ts          # Watch all active tasks
npx ts-node scripts/ai-worker-cli.ts <taskId> # Watch specific task
```

**Authentication:** Supports both user JWT (super_admin role) and org API keys (`Bearer org_*`)

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

### Authentication Middleware

The `backend/src/shared/auth/middleware.ts` provides multiple authentication methods:

| Middleware | Use Case | Auth Header |
|------------|----------|-------------|
| `authenticateUser` | Cognito JWT only | `Bearer <jwt>` |
| `authenticateApiKey` | Service API key | `X-API-Key: svc_*` |
| `authenticateOrgApiKey` | Org API key | `Bearer org_*` |
| `authenticateRequest` | **All methods** (recommended) | Any of above |

**Important:** Always use `authenticateRequest` for new routes unless you specifically need to restrict to one auth method. Routes using `authenticateUser` directly will reject org API keys.

**Bug Fix Note:** `conference-bridges.ts` was changed from `authenticateUser` to `authenticateRequest` because it was intercepting all `/api/v1/*` requests and blocking org API key authentication for other routes.

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
The `packages/oncallshift-mcp/` package provides an MCP server for AI assistant integration. Config is in `.mcp.json` (project root). Create org API key at Settings > API Keys (`org_<uuid>` format). Restart Claude Code after modifying `.mcp.json`.

### Terraform Provider
The `packages/terraform-provider-oncallshift/` provides a Terraform provider for managing OnCallShift resources as infrastructure-as-code.

```bash
cd packages/terraform-provider-oncallshift
make build           # Build the provider
make test            # Run unit tests
make testacc         # Acceptance tests (requires ONCALLSHIFT_API_KEY)
make docs            # Generate documentation
make install         # Install locally for testing
```

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

**The RDS database is in a private subnet.** Access it directly via the ECS container.

#### Quick Database Access

```bash
# Get running task ID
TASK_ID=$(aws ecs list-tasks --cluster pagerduty-lite-dev --service-name pagerduty-lite-dev-api --region us-east-1 --query 'taskArns[0]' --output text | awk -F/ '{print $NF}')

# Connect to PostgreSQL
aws ecs execute-command \
  --cluster pagerduty-lite-dev \
  --task $TASK_ID \
  --container api \
  --interactive \
  --command "psql \$DATABASE_URL"
```

**Common SQL queries:**

```sql
-- Cancel stuck AI worker task
UPDATE ai_worker_tasks
SET status = 'failed',
    completed_at = NOW(),
    error_message = 'Manually cancelled'
WHERE jira_issue_key = 'OCS-91'
  AND status NOT IN ('completed', 'failed', 'cancelled');

-- List active AI worker tasks
SELECT id, jira_issue_key, status, summary, created_at
FROM ai_worker_tasks
WHERE status IN ('claimed', 'environment_setup', 'executing')
ORDER BY created_at DESC;

-- Check user status
SELECT id, email, full_name, status FROM users WHERE org_id = 'YOUR_ORG_ID';
```

#### Migrations

```bash
# Migrations run automatically during deployment
# To run manually:
aws ecs execute-command --cluster pagerduty-lite-dev \
  --task $TASK_ID --container api --interactive \
  --command "node dist/shared/db/migrate.js"

# Create new migration (local)
cd backend && npm run migrate:create
```

#### Alternative: Use API Endpoints

For common operations, use the API instead of direct SQL:

```bash
# Cancel stuck task (requires super_admin role or org API key)
curl -X POST https://oncallshift.com/api/v1/super-admin/control-center/tasks/cancel-by-key \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jiraKey": "OCS-91", "reason": "Manually cancelled"}'
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
- `/api/v1/super-admin/control-center` - AI Workers monitoring (super_admin or org API key)
