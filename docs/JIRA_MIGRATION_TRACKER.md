# Jira Migration Tracker

> **Purpose:** Track migration of roadmap items from markdown files into Jira
> **Created:** 2026-01-04
> **Status:** In Progress

---

## Table of Contents

1. [Ticket Standards](#ticket-standards)
2. [Current Jira State](#current-jira-state)
3. [Source Documents Inventory](#source-documents-inventory)
4. [Migration Roadmap](#migration-roadmap)
5. [Epics to Create](#epics-to-create)
6. [Ticket Template](#ticket-template)

---

## Ticket Standards

### User Story Format

Every ticket MUST follow this format:

```
As a [role],
I want [capability],
So that [benefit].
```

**Roles:**
- `on-call engineer` - Primary incident responder
- `team lead` - Manages team schedules and policies
- `platform admin` - Organization administrator
- `developer` - Building integrations with OnCallShift

### Definition of Done (DoD)

Every ticket is considered complete when ALL of the following are met:

- [ ] Code passes TypeScript type checking (`npx tsc --noEmit`)
- [ ] Code follows existing patterns in the codebase
- [ ] Tests written for new functionality (80%+ coverage on critical paths)
- [ ] No security vulnerabilities introduced (OWASP Top 10 compliance)
- [ ] Terraform state remains synchronized (no drift)
- [ ] Database migrations are reversible
- [ ] API changes are backwards compatible (or properly versioned)
- [ ] Frontend/Mobile changes deployed and verified
- [ ] PR filled out with Summary, Test Plan, and screenshots (if UI)
- [ ] Code reviewed and approved

### Acceptance Criteria Format

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

---

## Current Jira State

### Summary (as of 2026-01-04)

| Metric | Count |
|--------|-------|
| Total Tickets | 41 |
| Epics | 2 |
| Tasks | 39 |
| Done | 1 (OCS-31) |
| To Do | 40 |

### Tickets to KEEP

| Key | Summary | Reason |
|-----|---------|--------|
| OCS-30 | Document encryption at rest and in transit | Security compliance |
| OCS-31 | Testing Coverage - Target 80% on Critical Paths | Done - keep for history |
| OCS-32 | Migration Import Gaps - PagerDuty/Opsgenie Parity | Valid epic |

### Tickets to DELETE (Low Quality - Missing User Story/DoD)

The following tickets should be deleted and recreated properly:

| Key | Summary | Issue |
|-----|---------|-------|
| OCS-1 to OCS-29 | Various | Missing user stories, no acceptance criteria |
| OCS-33 to OCS-41 | Testing/Import tasks | Too granular, missing context |

**Action:** Delete OCS-1 to OCS-29, OCS-33 to OCS-41 (keeping OCS-30, OCS-31, OCS-32)

---

## Source Documents Inventory

### Active Planning Documents

| Document | Priority | Status | Items | Migration Status |
|----------|----------|--------|-------|------------------|
| `STRATEGIC_DIFFERENTIATORS.md` | Highest | Active | 43 capabilities | NOT STARTED |
| `INFRASTRUCTURE-IMPROVEMENTS-PLAN.md` | High | Pre-Load-Test | 10 top changes | NOT STARTED |
| `API_SCALABILITY_PLAN.md` | High | Phase 0-1 Complete | 7 phases | PARTIAL |
| `SECURITY_HARDENING_PLAN.md` | High | Active | 22 findings | NOT STARTED |
| `MOBILE-PARITY-PLAN.md` | Medium | Active | 7 phases | NOT STARTED |
| `VPC_CONSOLIDATION_PLAN.md` | Medium | Draft | 4 phases | NOT STARTED |
| `TERRAFORM_PROVIDER_PREREQUISITES_PLAN.md` | Medium | Active | Multiple | NOT STARTED |

### Archive Documents (Lower Priority)

Located in `docs/archive/`:
- AI-INCIDENT-ORCHESTRATION-VISION.md
- AI-NATIVE-VISION-V2.md
- ATLASSIAN-DESIGN-SYSTEM.md
- EMAIL-AUTHENTICATION-FIX.md
- MARKET-EXPANSION-BEYOND-SRE.md
- MARKETING-STRATEGY-2025.md
- ONCALLSHIFT-AI-NATIVE-PLATFORM.md
- ONCALLSHIFT-BUSINESS-STRATEGY-2025.md
- ONCALLSHIFT-LEAN-OPERATIONS-PLAYBOOK.md
- ONCALLSHIFT-VALUE-SIMPLICITY-ROADMAP.md
- VISION-ML-ONCALLSHIFT-INTEGRATION.md
- VISION-ML-OPPORTUNITIES.md
- VISION_AI_INCIDENT_RESPONSE.md
- X-PROMOTION-AUTOMATION-PLAN.md

**Action:** These are archived and do not need Jira tickets unless resurrected.

### Progress Tracking Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `IMPLEMENTATION_PROGRESS.md` | General progress | May be stale |
| `API_IMPROVEMENTS_PROGRESS.md` | API work tracking | Active |
| `TERRAFORM_PROVIDER_PROGRESS.md` | TF provider status | Active |
| `SEMANTIC_IMPORT_PROGRESS.md` | Semantic import WIP | In Progress |

---

## Migration Roadmap

### Phase 1: Epics (Create First)

These are the major initiatives that will contain child stories:

| Epic Name | Source Document | Priority | Q1 Target |
|-----------|-----------------|----------|-----------|
| AI First Responder | STRATEGIC_DIFFERENTIATORS.md (Part 1) | Highest | Yes |
| Infrastructure-Native AI | STRATEGIC_DIFFERENTIATORS.md (Part 2) | High | Yes |
| Full Incident Lifecycle | STRATEGIC_DIFFERENTIATORS.md (Part 5) | High | Partial |
| Infrastructure Hardening | INFRASTRUCTURE-IMPROVEMENTS-PLAN.md | High | Yes |
| API Scalability | API_SCALABILITY_PLAN.md | High | Yes |
| Security Hardening | SECURITY_HARDENING_PLAN.md | High | Yes |
| Mobile App Parity | MOBILE-PARITY-PLAN.md | Medium | Partial |
| DevOps-Native Architecture | STRATEGIC_DIFFERENTIATORS.md (Part 4) | Medium | No |
| Unified Incident Context | STRATEGIC_DIFFERENTIATORS.md (Part 3) | Medium | No |

### Phase 2: High Priority Stories (Q1 2026)

#### From STRATEGIC_DIFFERENTIATORS.md - AI First Responder

| Story | Priority | Points |
|-------|----------|--------|
| Auto-Investigation on Incident Creation | Highest | 8 |
| Similar Incident Matching (RAG with pgvector) | High | 13 |
| Smart Paging with Context Enrichment | High | 8 |
| Auto-Remediation for Low-Risk Actions | High | 13 |
| Learning/Feedback Loop from Resolutions | Medium | 8 |

#### From INFRASTRUCTURE-IMPROVEMENTS-PLAN.md

| Story | Priority | Points |
|-------|----------|--------|
| Upgrade RDS to db.t4g.medium + Multi-AZ | Highest | 2 |
| Enable RDS Performance Insights | High | 1 |
| Enable Container Insights | High | 1 |
| Increase API Task Size (1024/2048) | High | 1 |
| Add Composite Indexes for Multi-Tenant Queries | High | 3 |
| Set up RDS Proxy | High | 3 |
| Deploy ElastiCache Redis | Medium | 5 |
| Implement Per-Tenant API Rate Limiting | Medium | 5 |
| Add Worker Auto-Scaling (SQS-based) | Medium | 3 |

#### From SECURITY_HARDENING_PLAN.md - Phase 1-2

| Story | Priority | Points |
|-------|----------|--------|
| Rotate Database Credentials | Highest | 1 |
| Add Pre-Commit Hooks for Secret Scanning | Highest | 2 |
| Remove or Protect Demo Endpoint | Highest | 2 |
| Fix HTTP to HTTPS Redirect on ALB | Highest | 1 |
| Add Rate Limiting to Auth Endpoints | High | 2 |
| Mask API Keys in Service Responses | High | 2 |
| Strengthen Password Policy | High | 2 |
| Fix CORS Configuration | High | 2 |
| Harden Security Headers (CSP, HSTS) | High | 3 |

### Phase 3: Medium Priority Stories (Q2 2026)

#### From MOBILE-PARITY-PLAN.md

| Story | Priority | Points |
|-------|----------|--------|
| Mobile AI Chat with Backend Streaming | High | 8 |
| Mobile Cloud Credentials Integration | Medium | 3 |
| Mobile Runbook CRUD (Admin) | Medium | 5 |
| Mobile Automated Runbook Execution | Medium | 5 |
| Mobile Status Pages | Medium | 5 |
| Mobile Postmortems | Medium | 5 |
| Mobile Workflows | Low | 8 |

#### From VPC_CONSOLIDATION_PLAN.md

| Story | Priority | Points |
|-------|----------|--------|
| VPC Consolidation - Delete Orphaned Resources | Medium | 3 |
| Import Active VPC into Terraform State | Medium | 3 |

---

## Epics to Create

### Epic 1: AI First Responder

```
Summary: [EPIC] AI First Responder - Auto-Investigation & Smart Paging

Description:
Transform OnCallShift from "notification router" to "AI-powered incident response platform."

Value Proposition: "Every incident gets an AI first responder before a human is paged."

Capabilities:
1.1 Auto-Investigation on Incident Creation
1.2 Similar Incident Matching (RAG)
1.3 Auto-Remediation for Low-Risk Actions
1.4 Smart Paging Decisions
1.5 Learning/Feedback Loop

Source: docs/STRATEGIC_DIFFERENTIATORS.md (Part 1)

Acceptance Criteria:
- AI investigation triggers automatically on incident creation
- Similar incidents are found and displayed with resolution hints
- Low-risk auto-remediation achieves 30%+ auto-resolution rate
- MTTR reduced by 40%
```

### Epic 2: Infrastructure Hardening

```
Summary: [EPIC] Infrastructure Hardening for 100K+ Users

Description:
Prepare OnCallShift infrastructure for production scale (100,000+ users).

Current Gaps:
- RDS: Single db.t4g.micro, no Multi-AZ
- No connection pooling (RDS Proxy)
- No Redis caching
- Workers don't auto-scale
- Container Insights disabled

Target State:
- RDS db.t4g.medium with Multi-AZ
- RDS Proxy for connection pooling
- ElastiCache Redis for hot data
- SQS-based worker auto-scaling
- Full observability enabled

Source: docs/INFRASTRUCTURE-IMPROVEMENTS-PLAN.md

Acceptance Criteria:
- RDS upgraded to db.t4g.medium with Multi-AZ
- RDS Proxy enabled with connection pooling
- ElastiCache Redis deployed and integrated
- API handles 1000+ requests/second
- p95 latency < 200ms on list endpoints
```

### Epic 4: Security Hardening

```
Summary: [EPIC] Security Hardening - OWASP ASVS Level 2 Compliance

Description:
Address security vulnerabilities identified in security assessment.

Risk Summary:
- Critical: 3 findings (secrets, demo endpoint, TLS)
- High: 6 findings (rate limiting, CORS, passwords, etc.)
- Medium: 8 findings
- Low: 5 findings

Compliance Targets:
- SOC 2 Type II
- OWASP Top 10 2021
- OWASP ASVS 4.0 Level 2

Source: docs/SECURITY_HARDENING_PLAN.md

Acceptance Criteria:
- All Critical findings resolved
- All High findings resolved
- Rate limiting on all endpoints
- RFC 9457 error responses
- WAF protection enabled
```

### Epic 5: API Scalability

```
Summary: [EPIC] API Scalability - World-Class REST API

Description:
Bring OnCallShift API to industry standards (Stripe, PagerDuty, GitHub quality).

Current State:
- Only 2 of 105+ endpoints paginated
- Most list endpoints return ALL records
- Rate limiting only on webhooks
- Error format not RFC 9457 compliant

Target State:
- All list endpoints paginated with cursor support
- Consistent filtering and sorting
- Tiered rate limiting on all endpoints
- RFC 9457 Problem Details errors
- Request ID tracing
- PagerDuty/OpsGenie compatibility endpoints

Source: docs/API_SCALABILITY_PLAN.md

Acceptance Criteria:
- All list endpoints paginated (default 25, max 100)
- Cursor pagination for high-volume endpoints
- Rate limit headers on all responses
- RFC 9457 error format
- X-Request-Id on all responses
```

---

## Ticket Template

Use this template when creating new tickets:

```markdown
## User Story

As a [role],
I want [capability],
So that [benefit].

## Description

[Detailed description of the feature/fix]

## Acceptance Criteria

GIVEN [initial context]
WHEN [action is taken]
THEN [expected outcome]

(Add multiple GIVEN/WHEN/THEN blocks as needed)

## Technical Notes

### Files to Modify
- `path/to/file.ts` - Description of changes

### Code Snippets / Naming Conventions
```typescript
// Example code pattern to follow
```

### Database Changes
- Migration: `XXX_description.sql`
- New columns/tables:

### API Changes
- Endpoint: `METHOD /api/v1/path`
- Request/Response format:

## Definition of Done

- [ ] TypeScript compiles without errors
- [ ] Tests written and passing
- [ ] No security vulnerabilities
- [ ] Terraform state synchronized
- [ ] PR reviewed and approved
- [ ] Deployed to production

## Dependencies

**Blocked By:**
- [Link to blocking ticket]

**Blocks:**
- [Link to ticket this blocks]

## Out of Scope

- [Explicit exclusions]

## References

- Design doc: [link]
- Related ticket: [link]
- Source plan: docs/[PLAN].md
```

---

## Next Steps

1. ~~**Delete low-quality tickets** (OCS-1 to OCS-29, OCS-33 to OCS-41)~~ - Requires manual deletion (API permission denied)
2. ~~**Create Epics** (5 high-priority epics)~~ - DONE
3. **Continue creating stories** - In Progress
4. **Archive source documents** as tickets are created
5. **Update this tracker** as migration progresses

---

## Created Tickets Summary

### Epics (5 created)

| Key | Summary | Priority |
|-----|---------|----------|
| OCS-42 | [EPIC] AI First Responder - Auto-Investigation & Smart Paging | Highest |
| OCS-44 | [EPIC] Infrastructure Hardening for 100K+ Users | High |
| OCS-45 | [EPIC] Security Hardening - OWASP ASVS Level 2 Compliance | High |
| OCS-46 | [EPIC] API Scalability - World-Class REST API | High |

### Stories by Epic

#### OCS-42: AI First Responder (3 stories)

| Key | Summary | Type | Branch |
|-----|---------|------|--------|
| OCS-59 | [GAP] Implement Auto-Investigation Trigger on Incident Creation | Gap | `feature/OCS-59-auto-investigation-trigger` |
| OCS-60 | [GAP] Implement Similar Incident Matching with pgvector RAG | Gap | `feature/OCS-60-similar-incident-matching` |
| OCS-61 | [GAP] Implement Auto-Remediation Execution for Low-Risk Actions | Gap | `feature/OCS-61-auto-remediation` |

#### OCS-44: Infrastructure Hardening (3 stories)

| Key | Summary | Type | Branch |
|-----|---------|------|--------|
| OCS-53 | [GAP] Add RDS Proxy for Connection Pooling | Gap | `feature/OCS-53-rds-proxy` |
| OCS-54 | [GAP] Upgrade RDS to db.t4g.medium with Multi-AZ | Gap | `infra/OCS-54-rds-multi-az` |
| OCS-62 | [GAP] Deploy ElastiCache Redis for Caching Layer | Gap | `infra/OCS-62-elasticache-redis` |

#### OCS-45: Security Hardening (3 stories)

| Key | Summary | Type | Branch |
|-----|---------|------|--------|
| OCS-55 | [GAP] Fix CORS Configuration - Remove Wildcard Origin | Gap | `fix/OCS-55-cors-wildcard` |
| OCS-56 | [GAP] Implement Webhook Signature Verification | Gap | `security/OCS-56-webhook-signatures` |
| OCS-57 | [GAP] Move Rate Limiting to Redis | Gap | `security/OCS-57-redis-rate-limiting` |

#### OCS-46: API Scalability (1 story)

| Key | Summary | Type | Branch |
|-----|---------|------|--------|
| OCS-58 | [GAP] Apply Cursor Pagination to High-Volume Endpoints | Gap | `feature/OCS-58-cursor-pagination` |

---

## Migration Progress

| Epic | Status | Tickets Created | Source Archived |
|------|--------|-----------------|-----------------|
| AI First Responder (OCS-42) | IN PROGRESS | 3 | No |
| Infrastructure Hardening (OCS-44) | IN PROGRESS | 3 | No |
| Security Hardening (OCS-45) | IN PROGRESS | 3 | No |
| API Scalability (OCS-46) | IN PROGRESS | 1 | No |
| Mobile App Parity | NOT STARTED | 0 | No |
| Full Incident Lifecycle | NOT STARTED | 0 | No |
| DevOps-Native Architecture | NOT STARTED | 0 | No |
| Unified Incident Context | NOT STARTED | 0 | No |

**Total: 5 Epics, 13 Stories created**

---

*Last Updated: 2026-01-04*
