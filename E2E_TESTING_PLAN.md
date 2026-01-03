# E2E Testing Implementation Plan

## Overview

This document outlines the implementation plan for end-to-end (E2E) testing for OnCallShift. The primary target is **GitHub Actions CI/CD** - all tests must run reliably in the CI pipeline.

**Target Environment:** Tests run against the deployed dev environment (`https://oncallshift.com`)
**No Local Services Required:** Tests hit the real API and UI, not mocked services

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflows                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   test.yml   │───▶│ _test-api.yml│    │_test-e2e.yml │       │
│  │ (orchestrator)│   │  (parallel)  │    │  (parallel)  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              Test Against Dev Environment            │        │
│  │                 https://oncallshift.com              │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Files

| File | Purpose | Trigger |
|------|---------|---------|
| `test.yml` | Main orchestrator | PR, push to main, manual |
| `_test-api.yml` | API integration tests | Called by test.yml |
| `_test-e2e.yml` | Playwright browser tests | Called by test.yml |

### Test Frameworks

| Layer | Framework | Location | Runner |
|-------|-----------|----------|--------|
| API Integration | Jest + Supertest | `backend/tests/integration/` | Node.js |
| E2E Browser | Playwright | `e2e/` | Headless Chromium |
| Unit Tests | Jest | `*/src/**/__tests__/` | Node.js |

---

## Workflow Triggers

```yaml
# test.yml triggers
on:
  pull_request:
    branches: [main]
    paths:
      - 'backend/**'
      - 'frontend/**'
      - 'e2e/**'
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      test_suite:
        description: 'Test suite to run'
        type: choice
        options: [all, api, e2e, smoke]
  workflow_run:
    workflows: ["Deploy Pipeline"]
    types: [completed]
```

---

## Test Suites

### 1. API Integration Tests (`_test-api.yml`)

Tests backend API endpoints directly using HTTP requests.

**Test Categories:**
- `auth/` - Authentication & authorization
- `incidents/` - Incident CRUD & actions
- `schedules/` - Schedule management
- `webhooks/` - Webhook ingestion formats
- `escalation/` - Escalation policy execution

**Example Structure:**
```
backend/tests/integration/
├── setup.ts              # Test user creation, auth tokens
├── teardown.ts           # Cleanup test data
├── auth/
│   ├── login.test.ts
│   ├── register.test.ts
│   └── token-refresh.test.ts
├── incidents/
│   ├── create.test.ts
│   ├── acknowledge.test.ts
│   ├── resolve.test.ts
│   └── escalate.test.ts
├── schedules/
│   ├── oncall.test.ts
│   └── override.test.ts
└── webhooks/
    ├── pagerduty-format.test.ts
    └── opsgenie-format.test.ts
```

### 2. E2E Browser Tests (`_test-e2e.yml`)

Tests critical user flows through the browser using Playwright.

**Test Categories:**
- `auth/` - Login, logout, session management
- `incidents/` - View, acknowledge, resolve from UI
- `schedules/` - View on-call, create override
- `setup/` - Setup wizard flow

**Example Structure:**
```
e2e/
├── playwright.config.ts
├── global-setup.ts       # Login, store auth state
├── global-teardown.ts    # Cleanup
├── fixtures/
│   └── auth.fixture.ts   # Authenticated page fixture
├── tests/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── logout.spec.ts
│   ├── incidents/
│   │   ├── list.spec.ts
│   │   ├── detail.spec.ts
│   │   └── actions.spec.ts
│   └── schedules/
│       └── oncall.spec.ts
└── page-objects/
    ├── login.page.ts
    ├── incidents.page.ts
    └── schedules.page.ts
```

### 3. Smoke Tests (Post-Deploy)

Minimal tests run after each deployment to verify critical functionality.

**Smoke Test Checklist:**
- [ ] Health endpoint returns 200
- [ ] Login page loads
- [ ] API authentication works
- [ ] Dashboard loads for authenticated user
- [ ] Can fetch incidents list

---

## Test Environment & Data

### Test User Credentials

Stored in GitHub Secrets:
- `TEST_USER_EMAIL` - Test account email
- `TEST_USER_PASSWORD` - Test account password
- `TEST_ORG_ID` - Test organization ID

### Test Data Strategy

1. **Isolated Test Org**: All tests run in a dedicated test organization
2. **Setup/Teardown**: Each test suite creates and cleans up its own data
3. **Idempotent Tests**: Tests can run multiple times without side effects
4. **No Production Data**: Tests never touch real user data

### Environment Variables for CI

```yaml
env:
  API_BASE_URL: https://oncallshift.com/api
  APP_BASE_URL: https://oncallshift.com
  TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
  TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

---

## Parallelization Strategy

### GitHub Actions Matrix

```yaml
# API tests run in parallel by category
strategy:
  matrix:
    test-suite: [auth, incidents, schedules, webhooks, escalation]

# E2E tests run in parallel with sharding
strategy:
  matrix:
    shard: [1, 2, 3, 4]
```

### Agent Parallelization (Claude Code)

The implementation work is divided into independent streams that can be worked on simultaneously:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PARALLELIZATION MAP                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STREAM 1: GitHub Actions Workflows (No dependencies)                    │
│  ├── Create test.yml orchestrator                                        │
│  ├── Create _test-api.yml                                                │
│  └── Create _test-e2e.yml                                                │
│                                                                          │
│  STREAM 2: API Test Infrastructure (No dependencies)                     │
│  ├── Create backend/tests/integration/setup.ts                           │
│  ├── Create backend/tests/integration/teardown.ts                        │
│  ├── Create backend/tests/integration/helpers/                           │
│  └── Update backend/package.json with test scripts                       │
│                                                                          │
│  STREAM 3: E2E Test Infrastructure (No dependencies)                     │
│  ├── Create e2e/ directory structure                                     │
│  ├── Create e2e/playwright.config.ts                                     │
│  ├── Create e2e/global-setup.ts                                          │
│  ├── Create e2e/fixtures/auth.fixture.ts                                 │
│  └── Create e2e/package.json                                             │
│                                                                          │
│  STREAM 4: API Tests - Auth (Depends on Stream 2)                        │
│  ├── Create auth/login.test.ts                                           │
│  ├── Create auth/register.test.ts                                        │
│  └── Create auth/token-refresh.test.ts                                   │
│                                                                          │
│  STREAM 5: API Tests - Incidents (Depends on Stream 2)                   │
│  ├── Create incidents/create.test.ts                                     │
│  ├── Create incidents/acknowledge.test.ts                                │
│  ├── Create incidents/resolve.test.ts                                    │
│  └── Create incidents/escalate.test.ts                                   │
│                                                                          │
│  STREAM 6: API Tests - Webhooks (Depends on Stream 2)                    │
│  ├── Create webhooks/pagerduty-format.test.ts                            │
│  └── Create webhooks/opsgenie-format.test.ts                             │
│                                                                          │
│  STREAM 7: E2E Tests - Auth (Depends on Stream 3)                        │
│  ├── Create page-objects/login.page.ts                                   │
│  ├── Create tests/auth/login.spec.ts                                     │
│  └── Create tests/auth/logout.spec.ts                                    │
│                                                                          │
│  STREAM 8: E2E Tests - Incidents (Depends on Stream 3)                   │
│  ├── Create page-objects/incidents.page.ts                               │
│  ├── Create tests/incidents/list.spec.ts                                 │
│  └── Create tests/incidents/actions.spec.ts                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Infrastructure (Parallel - 3 Agents)

| Task ID | Description | Agent | Dependencies | Est. Files |
|---------|-------------|-------|--------------|------------|
| **1A** | Create GitHub Actions workflows | Agent 1 | None | 3 files |
| **1B** | Create API test infrastructure | Agent 2 | None | 5 files |
| **1C** | Create E2E test infrastructure | Agent 3 | None | 6 files |

#### Task 1A: GitHub Actions Workflows
```
Files to create:
- .github/workflows/test.yml
- .github/workflows/_test-api.yml
- .github/workflows/_test-e2e.yml
```

#### Task 1B: API Test Infrastructure
```
Files to create:
- backend/tests/integration/setup.ts
- backend/tests/integration/teardown.ts
- backend/tests/integration/helpers/api-client.ts
- backend/tests/integration/helpers/auth.ts
- backend/jest.integration.config.js
- backend/package.json (update scripts)
```

#### Task 1C: E2E Test Infrastructure
```
Files to create:
- e2e/package.json
- e2e/playwright.config.ts
- e2e/global-setup.ts
- e2e/global-teardown.ts
- e2e/fixtures/auth.fixture.ts
- e2e/tsconfig.json
```

### Phase 2: Test Implementation (Parallel - 4 Agents)

| Task ID | Description | Agent | Dependencies | Est. Files |
|---------|-------------|-------|--------------|------------|
| **2A** | API Tests - Auth | Agent 1 | 1B | 3 files |
| **2B** | API Tests - Incidents | Agent 2 | 1B | 4 files |
| **2C** | API Tests - Webhooks | Agent 3 | 1B | 2 files |
| **2D** | E2E Tests - Auth + Incidents | Agent 4 | 1C | 6 files |

#### Task 2A: API Auth Tests
```
Files to create:
- backend/tests/integration/auth/login.test.ts
- backend/tests/integration/auth/register.test.ts
- backend/tests/integration/auth/token-refresh.test.ts
```

#### Task 2B: API Incident Tests
```
Files to create:
- backend/tests/integration/incidents/create.test.ts
- backend/tests/integration/incidents/acknowledge.test.ts
- backend/tests/integration/incidents/resolve.test.ts
- backend/tests/integration/incidents/escalate.test.ts
```

#### Task 2C: API Webhook Tests
```
Files to create:
- backend/tests/integration/webhooks/pagerduty-format.test.ts
- backend/tests/integration/webhooks/opsgenie-format.test.ts
```

#### Task 2D: E2E Auth + Incident Tests
```
Files to create:
- e2e/page-objects/login.page.ts
- e2e/page-objects/incidents.page.ts
- e2e/tests/auth/login.spec.ts
- e2e/tests/auth/logout.spec.ts
- e2e/tests/incidents/list.spec.ts
- e2e/tests/incidents/actions.spec.ts
```

### Phase 3: Integration & Validation (Sequential)

| Task ID | Description | Dependencies |
|---------|-------------|--------------|
| **3A** | Run full test suite locally | 2A, 2B, 2C, 2D |
| **3B** | Push and validate in GitHub Actions | 3A |
| **3C** | Fix any CI-specific issues | 3B |
| **3D** | Add to PR requirements | 3C |

---

## File Details

### test.yml (Main Orchestrator)

```yaml
name: Test Suite

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      suite:
        description: 'Test suite'
        type: choice
        options: [all, api, e2e, smoke]
        default: all

jobs:
  api-tests:
    if: inputs.suite == 'all' || inputs.suite == 'api'
    uses: ./.github/workflows/_test-api.yml
    secrets: inherit

  e2e-tests:
    if: inputs.suite == 'all' || inputs.suite == 'e2e'
    uses: ./.github/workflows/_test-e2e.yml
    secrets: inherit

  smoke-tests:
    if: inputs.suite == 'smoke'
    runs-on: ubuntu-latest
    steps:
      - name: Health Check
        run: curl -f https://oncallshift.com/health
```

### _test-api.yml

```yaml
name: API Integration Tests

on:
  workflow_call:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        suite: [auth, incidents, webhooks, schedules]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: Run ${{ matrix.suite }} tests
        working-directory: backend
        env:
          API_BASE_URL: https://oncallshift.com/api
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
        run: npm run test:integration -- --testPathPattern=${{ matrix.suite }}

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: api-test-results-${{ matrix.suite }}
          path: backend/test-results/
```

### _test-e2e.yml

```yaml
name: E2E Browser Tests

on:
  workflow_call:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: e2e/package-lock.json

      - name: Install dependencies
        working-directory: e2e
        run: npm ci

      - name: Install Playwright browsers
        working-directory: e2e
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests (shard ${{ matrix.shard }}/2)
        working-directory: e2e
        env:
          BASE_URL: https://oncallshift.com
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
        run: npx playwright test --shard=${{ matrix.shard }}/2

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ matrix.shard }}
          path: e2e/playwright-report/

      - name: Upload traces
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces-${{ matrix.shard }}
          path: e2e/test-results/
```

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    process.env.CI ? ['github'] : ['list']
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://oncallshift.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // Setup project - runs first, stores auth state
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },
    // Main tests - use stored auth state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

---

## GitHub Secrets Required

| Secret | Description | How to Set |
|--------|-------------|------------|
| `TEST_USER_EMAIL` | Email for test account | Create test user in dev org |
| `TEST_USER_PASSWORD` | Password for test account | Set secure password |
| `TEST_ORG_ID` | Organization ID for tests | Get from dev database |

---

## Success Criteria

### Phase 1 Complete When:
- [ ] `test.yml` triggers on PR and runs both API and E2E jobs
- [ ] `_test-api.yml` runs Jest tests in matrix (4 parallel suites)
- [ ] `_test-e2e.yml` runs Playwright tests with sharding (2 shards)
- [ ] All infrastructure files created and linted

### Phase 2 Complete When:
- [ ] Auth API tests pass (login, register, token refresh)
- [ ] Incident API tests pass (create, acknowledge, resolve, escalate)
- [ ] Webhook API tests pass (PagerDuty, Opsgenie formats)
- [ ] E2E login/logout tests pass
- [ ] E2E incident list/actions tests pass

### Phase 3 Complete When:
- [ ] Full test suite passes in GitHub Actions
- [ ] Test artifacts (reports, traces) upload correctly
- [ ] PR checks require passing tests
- [ ] Documentation updated

---

## Execution Command

To implement this plan with parallel agents:

```
Agent 1: "Implement Task 1A - Create GitHub Actions test workflows (test.yml, _test-api.yml, _test-e2e.yml)"

Agent 2: "Implement Task 1B - Create API test infrastructure (setup.ts, teardown.ts, helpers, jest config)"

Agent 3: "Implement Task 1C - Create E2E test infrastructure (playwright.config.ts, global-setup.ts, fixtures)"
```

After Phase 1 completes:

```
Agent 1: "Implement Task 2A - Create API auth tests"
Agent 2: "Implement Task 2B - Create API incident tests"
Agent 3: "Implement Task 2C - Create API webhook tests"
Agent 4: "Implement Task 2D - Create E2E auth and incident tests"
```

---

## Notes

- Tests run against **live dev environment** - no local Docker/database setup needed in CI
- Test user must exist in dev environment before tests can run
- Playwright traces and screenshots are uploaded on failure for debugging
- API tests use matrix strategy for parallel execution by category
- E2E tests use sharding for parallel execution across browsers
