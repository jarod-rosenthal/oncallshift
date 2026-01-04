# AI Worker Sprint Plan

> **Purpose:** Guide AI workers to success with a thoughtfully sequenced backlog
> **Created:** 2026-01-04
> **Status:** Active

---

## Executive Summary

This plan prepares Jira tickets for AI worker execution by:
1. Identifying and fixing ticket quality issues
2. Sequencing work from simple → complex
3. Breaking down complex tasks into achievable steps
4. Creating quick wins to build momentum

---

## Current State Analysis

### Ticket Inventory

| Category | Count | Status |
|----------|-------|--------|
| Quality Epics (OCS-42 to OCS-46) | 5 | Ready |
| Quality Stories ([GAP]/[VERIFY] format) | 10 | Mostly Ready |
| Legacy Epics (OCS-1 to OCS-6) | 6 | Need Deprecation |
| Duplicate Stories (OCS-47 to OCS-52) | 6 | Need Cleanup |
| Test Ticket (OCS-66) | 1 | Ready |

### Ticket Quality Issues Found

#### Issue 1: Duplicate Stories
These stories were created before we established the [GAP]/[VERIFY] format and duplicate newer tickets:

| Old Ticket | Duplicates | Action |
|------------|------------|--------|
| OCS-47 | OCS-59 | Deprecate OCS-47 |
| OCS-48 | OCS-60 | Deprecate OCS-48 |
| OCS-49 | (unique) | Update with [GAP] format |
| OCS-50 | (schema done) | Mark as Done or Verify |
| OCS-51 | OCS-63 | Deprecate OCS-51 |
| OCS-52 | OCS-65 | Deprecate OCS-52 |

#### Issue 2: Legacy Epics (OCS-1 to OCS-6)
These epics lack:
- Proper user story format
- Acceptance criteria
- Technical notes
- They overlap with our new epics (OCS-42 to OCS-46)

**Recommendation:** Label as `legacy` and move to backlog, use new epics instead.

#### Issue 3: Missing Current State Documentation
Some tickets don't document what's already implemented, risking duplicate work:

| Ticket | Missing Info |
|--------|--------------|
| OCS-56 | Webhook routes exist - need to verify if signatures implemented |
| OCS-57 | Rate limiter exists in-memory - need Redis migration only |
| OCS-58 | Pagination utilities exist - need endpoint application |
| OCS-64 | Heartbeat API may exist - need verification |

#### Issue 4: Ambiguous Scope
| Ticket | Ambiguity | Resolution Needed |
|--------|-----------|-------------------|
| OCS-59 | "Auto-investigation trigger" - when exactly? What threshold? | Define trigger conditions |
| OCS-60 | pgvector RAG - embedding model not specified | Specify OpenAI or local model |
| OCS-61 | "Low-risk actions" - what qualifies? | Define action categories |

---

## Complexity Assessment

### Tier 1: Quick Wins (1-2 hours, single file)
Best for building AI worker confidence.

| Ticket | Description | Why It's Simple |
|--------|-------------|-----------------|
| OCS-66 | Add console.log to health check | Single line change, clear acceptance |
| OCS-64 | [VERIFY] Heartbeat Integration | Verification only, no new code |
| OCS-55 | [GAP] Fix CORS Wildcard | **DONE** - already completed! |

### Tier 2: Simple Tasks (2-4 hours, 1-3 files)
Clear scope, minimal dependencies.

| Ticket | Description | Complexity Notes |
|--------|-------------|------------------|
| OCS-56 | Webhook Signature Verification | Add HMAC to existing routes |
| OCS-58 | Apply Cursor Pagination | Utilities exist, apply to routes |
| NEW | Add security headers (CSP, HSTS) | Single middleware file |
| NEW | Enable Container Insights | Terraform config change |

### Tier 3: Medium Tasks (4-8 hours, 3-5 files)
Require understanding of existing patterns.

| Ticket | Description | Complexity Notes |
|--------|-------------|------------------|
| OCS-65 | Control Center Action Buttons | Backend + Frontend changes |
| OCS-53 | RDS Proxy | Terraform + connection string updates |
| OCS-54 | RDS Multi-AZ Upgrade | **DONE** - marked as Closed |
| OCS-57 | Rate Limiting to Redis | Depends on OCS-62 (Redis deployment) |

### Tier 4: Complex Tasks (8+ hours, multi-service)
Require significant context and careful planning.

| Ticket | Description | Why It's Complex |
|--------|-------------|------------------|
| OCS-59 | Auto-Investigation Trigger | Spans alert-processor, orchestrator, notifications |
| OCS-60 | Similar Incident Matching | Requires pgvector, embeddings, new API |
| OCS-61 | Auto-Remediation | Security implications, approval workflow |
| OCS-62 | Deploy ElastiCache | New infrastructure, app integration |

---

## Dependency Graph

```
OCS-62 (Deploy Redis)
  └── OCS-57 (Move Rate Limiting to Redis)

OCS-53 (RDS Proxy)
  └── Connection pooling improvements

OCS-64 (Verify Heartbeat)
  └── OCS-63 (Verify Watcher Lambda) - DONE
  └── OCS-65 (Control Center Actions)

OCS-60 (Similar Incidents - pgvector)
  └── OCS-59 (Auto-Investigation)
  └── OCS-61 (Auto-Remediation)
```

---

## Recommended Sprint Sequence

### Wave 1: Verification & Quick Wins (Build Confidence)
**Goal:** Give AI workers easy wins, validate the workflow works.

| Order | Ticket | Est. Time | Success Criteria |
|-------|--------|-----------|------------------|
| 1 | OCS-66 | 30 min | TypeScript compiles, log appears |
| 2 | OCS-64 | 1 hour | Document heartbeat status, create follow-up if needed |
| 3 | NEW-1 | 1 hour | Enable Container Insights in Terraform |
| 4 | NEW-2 | 1 hour | Add security headers middleware |

### Wave 2: Simple Enhancements (Build Skills)
**Goal:** Single-focus tasks with clear boundaries.

| Order | Ticket | Est. Time | Success Criteria |
|-------|--------|-----------|------------------|
| 5 | OCS-56 | 2 hours | HMAC verification on webhook endpoints |
| 6 | OCS-58 | 3 hours | Cursor pagination on incidents, users, teams |
| 7 | NEW-3 | 2 hours | RFC 9457 error format on all routes |
| 8 | NEW-4 | 2 hours | Request ID tracking (X-Request-Id header) |

### Wave 3: Medium Complexity (Apply Patterns)
**Goal:** Multi-file changes following established patterns.

| Order | Ticket | Est. Time | Success Criteria |
|-------|--------|-----------|------------------|
| 9 | OCS-65 | 4 hours | Retry/Cancel buttons work in UI |
| 10 | OCS-53 | 4 hours | RDS Proxy deployed, API uses it |
| 11 | OCS-62 | 5 hours | Redis deployed, health check passes |
| 12 | OCS-57 | 3 hours | Rate limiting uses Redis (after OCS-62) |

### Wave 4: Strategic Features (Requires Context)
**Goal:** Complex features requiring deep understanding.

| Order | Ticket | Est. Time | Success Criteria |
|-------|--------|-----------|------------------|
| 13 | OCS-59 | 8 hours | Auto-diagnosis triggers on incident create |
| 14 | OCS-60 | 13 hours | Similar incidents shown with similarity score |
| 15 | OCS-61 | 13 hours | Low-risk actions execute automatically |

---

## New Tickets to Create

Based on the analysis, these simpler tickets should be created to fill gaps:

### NEW-1: Enable CloudWatch Container Insights
```
Summary: [GAP] Enable CloudWatch Container Insights for ECS
Type: Story
Parent: OCS-44 (Infrastructure Hardening)
Priority: High
Estimate: 1 point

User Story:
As a platform admin,
I want Container Insights enabled for ECS,
So that I can monitor CPU, memory, and network metrics.

Current State:
- Container Insights is DISABLED
- No ECS-level metrics in CloudWatch

Implementation:
- Single Terraform change in modules/ecs/main.tf
- Add: containerInsights = "enabled" to cluster settings

Acceptance Criteria:
GIVEN Container Insights is enabled
WHEN I view CloudWatch metrics
THEN I see ECS cluster CPU/Memory/Network metrics

Branch: infra/OCS-NEW1-container-insights
```

### NEW-2: Add Security Headers Middleware
```
Summary: [GAP] Add Security Headers (CSP, HSTS, X-Frame-Options)
Type: Story
Parent: OCS-45 (Security Hardening)
Priority: High
Estimate: 2 points

User Story:
As a security engineer,
I want proper security headers on all responses,
So that the application is protected against XSS, clickjacking, etc.

Current State:
- No CSP header
- No HSTS header
- No X-Frame-Options

Implementation:
- Add helmet middleware to backend/src/api/app.ts
- Configure CSP to allow self and trusted CDNs

Acceptance Criteria:
GIVEN I make any API request
THEN response includes:
- Content-Security-Policy header
- Strict-Transport-Security header
- X-Frame-Options: DENY

Branch: security/OCS-NEW2-security-headers
```

### NEW-3: Implement RFC 9457 Error Format
```
Summary: [GAP] Standardize Error Responses to RFC 9457
Type: Story
Parent: OCS-46 (API Scalability)
Priority: Medium
Estimate: 3 points

User Story:
As a developer,
I want consistent error responses,
So that I can handle errors predictably.

Current State:
- Error utility exists: backend/src/shared/utils/problem-details.ts
- NOT applied to all routes

Implementation:
- Update error middleware to use RFC 9457 format
- Ensure all routes use consistent error responses

Branch: feature/OCS-NEW3-rfc9457-errors
```

### NEW-4: Add Request ID Tracking
```
Summary: [GAP] Add X-Request-Id Header for Tracing
Type: Story
Parent: OCS-46 (API Scalability)
Priority: Medium
Estimate: 2 points

User Story:
As a support engineer,
I want request IDs on all API responses,
So that I can trace issues through logs.

Current State:
- Request ID middleware may exist (need verification)

Implementation:
- Add/verify request ID middleware
- Ensure X-Request-Id returned in all responses
- Include in CloudWatch logs

Branch: feature/OCS-NEW4-request-id
```

---

## Tickets to Clean Up

### Deprecate (label + move to backlog)
| Ticket | Reason |
|--------|--------|
| OCS-47 | Duplicates OCS-59 |
| OCS-48 | Duplicates OCS-60 |
| OCS-51 | Duplicates OCS-63 |
| OCS-52 | Duplicates OCS-65 |
| OCS-1 to OCS-6 | Legacy epics, replaced by OCS-42 to OCS-46 |

### Update with Current State
| Ticket | Update Needed |
|--------|---------------|
| OCS-49 | Add [GAP] prefix, document what exists |
| OCS-50 | Verify if schema is done, update status |
| OCS-56 | Check if webhook signatures exist |
| OCS-64 | Check if heartbeat API exists |

### Mark as Done
| Ticket | Reason |
|--------|--------|
| OCS-54 | Already closed |
| OCS-55 | Already done |
| OCS-63 | Already closed |

---

## AI Worker Success Checklist

Before assigning a ticket to an AI worker, verify:

- [ ] Ticket has [GAP] or [VERIFY] prefix
- [ ] User story is complete (who/what/why)
- [ ] Current state is documented
- [ ] Acceptance criteria are specific and testable
- [ ] Technical notes include file paths
- [ ] Branch name is specified
- [ ] Dependencies are identified
- [ ] Complexity is appropriate for worker's current level

---

## Metrics to Track

| Metric | Target | Purpose |
|--------|--------|---------|
| First-attempt success rate | >70% | Are tickets clear enough? |
| Average completion time | Within estimate | Are estimates accurate? |
| Rework rate | <20% | Is scope well-defined? |
| Worker stuck time | <30 min | Is context sufficient? |

---

## Next Actions

1. **Immediate:** Create NEW-1 through NEW-4 tickets in Jira
2. **Immediate:** Deprecate duplicate tickets (OCS-47, 48, 51, 52)
3. **Immediate:** Label legacy epics (OCS-1 to OCS-6) and move to backlog
4. **Before Wave 1:** Update OCS-64 with verification checklist
5. **Before Wave 2:** Update OCS-56, OCS-58 with current state info
6. **Ongoing:** Track metrics and adjust ticket quality

---

## Appendix: Ticket Template for AI Workers

```markdown
## User Story
As a [role],
I want [capability],
So that [benefit].

## Current State
- What exists today (with file paths)
- What's missing

## Implementation Required
1. Specific step 1
2. Specific step 2
3. ...

## Acceptance Criteria
GIVEN [context]
WHEN [action]
THEN [outcome]

## Technical Notes
### Files to Modify
- path/to/file.ts - Description

### Code Pattern to Follow
```typescript
// Example from codebase
```

## Branch
feature/OCS-XX-description

## Definition of Done
- [ ] TypeScript compiles
- [ ] Tests pass
- [ ] Terraform state synchronized (if infra)
- [ ] PR created with summary
```

---

*Last Updated: 2026-01-04*
