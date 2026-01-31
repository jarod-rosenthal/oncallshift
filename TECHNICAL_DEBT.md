# Technical Debt Analysis Report

**Generated:** January 2, 2026
**Project:** OnCallShift (PagerDuty Lite)
**Analyzed Areas:** Backend, Frontend, Mobile, Infrastructure, CI/CD

---

## Executive Summary

This report identifies technical debt across the OnCallShift codebase and provides a prioritized implementation plan for addressing these issues. The analysis covers code quality, architecture, performance, security, testing, and infrastructure concerns.

### Key Metrics

| Area | Critical | High | Medium | Low | Total |
|------|----------|------|--------|-----|-------|
| Backend | 2 | 5 | 12 | 4 | 23 |
| Frontend | 1 | 4 | 6 | 3 | 14 |
| Mobile | 2 | 4 | 8 | 3 | 17 |
| Infrastructure | 2 | 5 | 8 | 4 | 19 |
| **Total** | **7** | **18** | **34** | **14** | **73** |

---

## Table of Contents

1. [Critical Issues](#1-critical-issues)
2. [Backend Technical Debt](#2-backend-technical-debt)
3. [Frontend Technical Debt](#3-frontend-technical-debt)
4. [Mobile Technical Debt](#4-mobile-technical-debt)
5. [Infrastructure Technical Debt](#5-infrastructure-technical-debt)
6. [TODO/FIXME Inventory](#6-todofixme-inventory)
7. [Implementation Plan](#7-implementation-plan)

---

## 0. P0 - Fix Immediately

### 0.1 Multiple ECR Repositories for Single Codebase

**Status:** OPEN
**Priority:** P0 - HIGHEST
**Discovered:** 2026-01-02
**Impact:** Deployments silently fail to update workers, causing production incidents

**Problem:**
The Terraform ECS module creates a separate ECR repository for each service:
- `pagerduty-lite-dev-api`
- `pagerduty-lite-dev-notification-worker`
- `pagerduty-lite-dev-alert-processor`
- `pagerduty-lite-dev-escalation-timer`

However, all services use the **same Docker image** (same codebase), just with different `command` overrides. The `deploy.sh` script only pushes to the `api` repo, leaving workers running stale images.

**Impact:**
- Worker services don't get code updates when deploying
- Must manually tag and push to each ECR repo
- Confusing and error-prone deployment process
- Wasted storage across multiple repos
- **Caused production outage on 2026-01-02** - notifications not sending

**Current Workaround:**
```bash
# After deploy.sh, manually push to worker repos:
docker tag 593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-api:latest \
  593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-notification-worker:latest
docker push 593971626975.dkr.ecr.us-east-1.amazonaws.com/pagerduty-lite-dev-notification-worker:latest
# Repeat for alert-processor and escalation-timer
aws ecs update-service --cluster pagerduty-lite-dev --service pagerduty-lite-dev-notification-worker --force-new-deployment
```

**Solution:**
1. Modify `ecs-service` Terraform module to accept an optional `ecr_repository_url` variable
2. When provided, use that repo instead of creating a new one
3. Update worker modules to reference the API's ECR repo
4. Update `deploy.sh` to force-redeploy all services after pushing
5. Delete unused ECR repos

**Files to modify:**
- `infrastructure/terraform/modules/ecs-service/main.tf` - Add conditional ECR creation
- `infrastructure/terraform/modules/ecs-service/variables.tf` - Add `ecr_repository_url` variable
- `infrastructure/terraform/environments/dev/main.tf` - Pass API's ECR URL to workers
- `deploy.sh` - Add force-redeploy for all services

---

## 1. Critical Issues

These issues should be addressed immediately due to security, stability, or data integrity concerns.

### 1.1 Security Vulnerabilities

#### Missing Slack Signature Verification
- **File:** `backend/src/api/routes/integrations.ts:529`
- **Issue:** Slack webhook payloads are not verified, allowing potential spoofing
- **Risk:** Attackers could forge Slack interactions
- **Fix:** Implement Slack signature verification using `crypto.timingSafeEqual()`

#### Overly Permissive IAM Policies
- **File:** `infrastructure/terraform/environments/dev/main.tf:1175-1411`
- **Issue:** GitHub Actions OIDC policy grants wildcard access (`"iam:*"`, `"s3:*"`, etc.)
- **Risk:** Compromised CI/CD could access/modify any AWS resource
- **Fix:** Scope permissions to specific resource ARNs

#### TLS Certificate Validation Disabled
- **File:** `deploy.sh:91`
- **Issue:** `NODE_TLS_REJECT_UNAUTHORIZED=0` in production migrations
- **Risk:** Man-in-the-middle attacks possible
- **Fix:** Use proper SSL certificates and remove this flag

### 1.2 Stability Concerns

#### Zero Test Coverage for Critical Paths
- **Backend:** Only 2 test files exist (import.test.ts, webhooks.test.ts)
- **Frontend:** Zero component tests
- **Mobile:** Zero tests
- **Risk:** Regressions go undetected, production incidents
- **Fix:** Implement test coverage for critical user flows (see Implementation Plan)

---

## 2. Backend Technical Debt

### 2.1 Type Safety Issues

**294 instances of `any` type across 49 files**

| File | Count | Priority |
|------|-------|----------|
| `api/routes/import.ts` | 43 | High |
| `shared/services/gcp-investigation.ts` | 27 | High |
| `api/routes/export.ts` | 18 | Medium |
| `shared/services/cloud-investigation.ts` | 8 | Medium |

**Impact:** Reduced type safety, runtime errors, poor IDE support

### 2.2 Architecture Issues

#### Monolithic Route Files

| File | Lines | Recommendation |
|------|-------|----------------|
| `api/routes/incidents.ts` | 2,570 | Extract to IncidentService |
| `api/routes/import.ts` | 3,200+ | Split by provider |
| `api/routes/escalation-policies.ts` | 1,700 | Extract escalation logic |
| `api/routes/services.ts` | 1,466 | Extract formatting functions |

**Issues:**
- Business logic mixed with route handlers
- Helper functions not reusable
- Difficult to test

**Example - `incidents.ts` functions that should be services:**
```typescript
// Lines 948-992: formatIncident() - duplicated formatting logic
// Lines 997-1145: getEscalationStatus() - 149 lines of business logic
// Lines 1424-1444: extractKeywords() - should be utility
// Lines 2557-2568: formatDuration() - duplicated in multiple files
```

### 2.3 Database Issues

#### N+1 Query Patterns

| Location | Issue |
|----------|-------|
| `incidents.ts:199-233` | Loops over notifications accessing user data |
| `escalation-policies.ts` | Loads targets in loops |
| `ai-assistant.ts:1074-1105` | User queries in loop |

#### Missing Index Documentation
- Incident queries by `org_id`, `state`, `service_id` combinations
- User queries by `email` (auth path)
- Schedule queries by `org_id`

### 2.4 Incomplete Features (TODOs)

| Location | Description | Priority |
|----------|-------------|----------|
| `voice-call.ts:55` | Twilio integration stubbed | High |
| `users.ts:1026` | Email/SMS verification not sent | High |
| `cloud-credentials.ts:573` | AWS connection not tested | Medium |
| `workflow-engine.ts:395` | Slack integration incomplete | Medium |
| `incidents.ts:1141` | Escalation loops not tracked | Low |

---

## 3. Frontend Technical Debt

### 3.1 Large Components

| Component | Lines | States | Recommendation |
|-----------|-------|--------|----------------|
| `RunbookPanel.tsx` | 1,260 | 14+ | Split into 3-4 components |
| `SetupWizard.tsx` | 663 | 6 steps | Extract step components |
| `IncidentDetail.tsx` | 517 | 11+ | Extract modals/panels |
| `Sidebar.tsx` | 446 | 25 SVGs | Use icon library |

### 3.2 Performance Issues

#### No Route Lazy Loading
- **File:** `App.tsx`
- **Issue:** 55 pages imported at top level
- **Impact:** Large initial bundle, slow first load
- **Fix:** Implement `React.lazy()` for all routes

```typescript
// Current (Bad)
import Dashboard from './pages/Dashboard';

// Recommended
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
```

#### Missing Memoization
- Zero `React.memo()` usage
- Zero `useMemo()` implementations
- Zero `useCallback()` hooks
- **Impact:** Unnecessary re-renders, poor performance

### 3.3 Accessibility Gaps

| Component | Issue |
|-----------|-------|
| `IncidentDetail.tsx` | Delete modal missing `role="alertdialog"` |
| `Sidebar.tsx` | Missing `aria-expanded`, `aria-current` |
| `RunbookPanel.tsx` | Custom checkboxes lack ARIA attributes |

### 3.4 Code Duplication

```typescript
// Duplicated across Dashboard, IncidentDetail, Timeline:
getSeverityColor() // 4 case branches
getStateColor()    // 4 case branches
getEventIcon()     // 6 cases
getEventColor()    // 6 cases
```

**Fix:** Extract to `frontend/src/utils/colors.ts`

---

## 4. Mobile Technical Debt

### 4.1 Monolithic Screens

| Screen | Size | States | Priority |
|--------|------|--------|----------|
| `AlertDetailScreen.tsx` | 113KB | 25+ | Critical |
| `SettingsScreen.tsx` | 47KB | 15+ | High |
| `ScheduleLayersScreen.tsx` | 37KB | 12+ | Medium |
| `OnCallScreen.tsx` | 36KB | 10+ | Medium |

**AlertDetailScreen Issues:**
- 100+ state variables in single component
- Handles: incident details, timeline, runbook, AI, notifications, reassignment, escalation, resolution, approvals
- Impossible to test or maintain

### 4.2 Performance Issues

#### FlatList Optimization Missing
- No `keyExtractor` implementations (uses array index)
- No `getItemLayout` for virtualization
- No memoization of filtered data

#### useMemo/useCallback Underutilized
- Only 49 occurrences across 21 screens
- Heavy components re-render on every parent change

### 4.3 State Management

**146 error/loading/state combinations across 22 screens**

```typescript
// AlertDetailScreen.tsx has 25+ useState calls:
const [incident, setIncident] = useState<Incident>(initialIncident);
const [events, setEvents] = useState<IncidentEvent[]>([]);
const [actionLoading, setActionLoading] = useState(false);
const [loadingDetails, setLoadingDetails] = useState(true);
// ... 21 more
```

**Fix:** Extract to custom hooks or use reducer pattern

### 4.4 API Layer Issues

- **342 console statements** across mobile/src
- Duplicated error handling in every screen
- No request deduplication
- Inconsistent caching strategy

---

## 5. Infrastructure Technical Debt

### 5.1 Hardcoded Values

| File | Line | Value | Issue |
|------|------|-------|-------|
| `deploy.sh` | 43 | AWS Account ID | Not reusable |
| `deploy.sh` | 46 | CloudFront ID | Not reusable |
| `_backend.yml` | 37 | AWS Account ID | Should be secret |
| `main.tf` | 691 | SES email | Should be variable |

### 5.2 Security Concerns

#### Overly Permissive Security Groups
```hcl
# main.tf - Uses wildcard resources
Resource = "*"  # Lines 632, 642, 651
```

#### Missing Security Features
- No WAF on CloudFront
- No CloudFront access logging
- S3 buckets lack versioning
- HTTP listener doesn't redirect to HTTPS (line 124-133)

### 5.3 CI/CD Gaps

| Issue | Impact |
|-------|--------|
| No tests in pipeline | Broken code reaches production |
| No health check validation | Deployments may succeed with broken services |
| No rollback strategy | Failed deployments require manual intervention |
| Hardcoded VITE_API_URL | Cannot deploy to different environments |

### 5.4 Missing Infrastructure

- Only `dev` environment exists
- No `staging` or `prod` Terraform configs
- No disaster recovery runbook
- Missing CloudWatch alarms for error rates

---

## 6. TODO/FIXME Inventory

### Critical Priority

| Location | Description |
|----------|-------------|
| `integrations.ts:529` | Slack signature verification missing |

### High Priority

| Location | Description |
|----------|-------------|
| `users.ts:1026, 1030` | Email/SMS verification not sent |
| `cloud-credentials.ts:573` | AWS connection not tested |
| `voice-call.ts:55` | Twilio integration is stub |

### Medium Priority

| Location | Description |
|----------|-------------|
| `Header.tsx:42` | Global search not implemented |
| `Incidents.tsx:169` | Create incident modal placeholder |
| `incidents.ts:1141` | Escalation loops not tracked |
| `incidents.ts:2515` | Subscriber notifications incomplete |
| `workflow-engine.ts:395` | Slack workflow integration incomplete |

### Low Priority

| Location | Description |
|----------|-------------|
| `alert-processor.ts:172` | Suspended alerts review not implemented |
| `conference-bridge.ts:183` | Google Meet placeholder |
| `notification-worker.ts:367` | Some channels not implemented |

---

## 7. Implementation Plan

### Phase 1: Critical Security & Stability (Week 1-2)

#### 1.1 Security Fixes
- [ ] Implement Slack signature verification
- [ ] Scope IAM policies to specific resources
- [ ] Remove `NODE_TLS_REJECT_UNAUTHORIZED=0`
- [ ] Add input validation on all POST endpoints

#### 1.2 Testing Foundation
- [ ] Set up Jest for backend with coverage reporting
- [ ] Add tests for `incidents.ts` critical paths (acknowledge, resolve, escalate)
- [ ] Set up Vitest for frontend
- [ ] Add tests for IncidentDetail component

### Phase 2: Backend Refactoring (Week 3-4)

#### 2.1 Extract Services
```
backend/src/shared/services/
├── incident-service.ts      # Extract from incidents.ts
├── escalation-service.ts    # Extract from escalation-policies.ts
├── formatting-service.ts    # Shared formatters
└── import/
    ├── pagerduty-import.ts  # Split from import.ts
    └── opsgenie-import.ts
```

#### 2.2 Type Safety
- [ ] Replace `any` types in `import.ts` (43 instances)
- [ ] Replace `any` types in `gcp-investigation.ts` (27 instances)
- [ ] Create proper interfaces for all API responses

#### 2.3 Database Optimization
- [ ] Add eager loading where appropriate
- [ ] Fix N+1 queries in escalation-policies
- [ ] Document required indexes

### Phase 3: Frontend Optimization (Week 5-6)

#### 3.1 Performance
- [ ] Implement route lazy loading for all 55 pages
- [ ] Add `React.memo()` to list item components
- [ ] Implement `useMemo()` for expensive calculations
- [ ] Add `useCallback()` for event handlers

#### 3.2 Component Extraction
```
frontend/src/components/
├── runbook/
│   ├── RunbookSteps.tsx
│   ├── RunbookAIChat.tsx
│   └── RunbookAutomation.tsx
├── incident/
│   ├── IncidentActions.tsx (exists)
│   ├── IncidentTimeline.tsx (exists)
│   └── IncidentModals.tsx
└── shared/
    └── colors.ts            # Severity/state color functions
```

#### 3.3 Accessibility
- [ ] Add ARIA attributes to modals
- [ ] Implement keyboard navigation
- [ ] Add screen reader labels

### Phase 4: Mobile Refactoring (Week 7-8)

#### 4.1 Screen Decomposition
```
mobile/src/screens/AlertDetail/
├── index.tsx               # Main orchestrator (< 500 lines)
├── IncidentHeader.tsx
├── RunbookSection.tsx
├── TimelineSection.tsx
├── AIAssistantSection.tsx
└── ActionModals.tsx
```

#### 4.2 Custom Hooks
```typescript
// mobile/src/hooks/
useIncidentData(id)      // Data loading, caching, refresh
useErrorHandler()        // Consistent error handling
useLoadingState()        // Unified loading/error/success
```

#### 4.3 Performance
- [ ] Add `keyExtractor` to all FlatLists
- [ ] Implement `getItemLayout` where applicable
- [ ] Add `useMemo` for filtered lists
- [ ] Memoize expensive renders

### Phase 5: Infrastructure Hardening (Week 9-10)

#### 5.1 Security
- [ ] Reduce IAM policy permissions
- [ ] Add WAF to CloudFront
- [ ] Enable CloudFront access logging
- [ ] Add S3 bucket versioning
- [ ] Fix HTTP to HTTPS redirect

#### 5.2 CI/CD Improvements
- [ ] Add test execution to backend workflow
- [ ] Add test execution to frontend workflow
- [ ] Implement health check validation post-deploy
- [ ] Add rollback mechanism
- [ ] Parameterize environment-specific values

#### 5.3 Multi-Environment
```
infrastructure/terraform/environments/
├── dev/
├── staging/    # Create
└── prod/       # Create
```

### Phase 6: Complete TODOs (Week 11-12)

#### 6.1 High Priority
- [ ] Implement email/SMS verification delivery
- [ ] Complete AWS credential connection testing
- [ ] Evaluate Twilio integration (implement or document as unsupported)

#### 6.2 Medium Priority
- [ ] Implement global search
- [ ] Add create incident modal
- [ ] Complete Slack workflow integration

---

## Appendix A: File Reference

### Largest Files Requiring Refactoring

| File | Lines | Priority |
|------|-------|----------|
| `mobile/src/screens/AlertDetailScreen.tsx` | 2,700+ | Critical |
| `backend/src/api/routes/import.ts` | 3,200+ | High |
| `backend/src/api/routes/incidents.ts` | 2,570 | High |
| `mobile/src/services/apiService.ts` | 2,877 | Medium |
| `backend/src/api/routes/escalation-policies.ts` | 1,700 | Medium |
| `frontend/src/components/RunbookPanel.tsx` | 1,260 | Medium |

### Test Coverage Gaps

| Area | Files | Tests | Coverage |
|------|-------|-------|----------|
| Backend Routes | 34 | 2 | ~6% |
| Backend Services | 15 | 0 | 0% |
| Frontend Pages | 55 | 0 | 0% |
| Frontend Components | 44 | 0 | 0% |
| Mobile Screens | 22 | 0 | 0% |
| Mobile Components | 15 | 0 | 0% |

---

## Appendix B: Quick Wins

These items provide high ROI with minimal effort:

1. **Extract color functions** (30 min) - Remove duplication across 3 files
2. **Add React.lazy routes** (1 hour) - Significant bundle size reduction
3. **Add ARIA labels to modals** (30 min) - Fix accessibility issues
4. **Remove console.log statements** (1 hour) - Clean up 342 instances
5. **Add FlatList keyExtractor** (30 min) - Improve list performance
6. **Parameterize deploy.sh** (1 hour) - Remove hardcoded values

---

*Report generated by Claude Code analysis of OnCallShift codebase*
