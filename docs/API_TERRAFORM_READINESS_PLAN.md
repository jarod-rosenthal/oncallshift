# API Terraform Readiness Plan

**Created:** January 2026
**Goal:** Finalize API improvements before Terraform provider development
**Constraint:** No breaking API changes after Terraform provider begins

---

## Current State Assessment

### Utilities Implemented (Phase 0-1 Complete)

| Utility | File | Status |
|---------|------|--------|
| Pagination (offset + cursor) | `shared/utils/pagination.ts` | Done |
| Filtering | `shared/utils/filtering.ts` | Done |
| Rate Limiting (tiered) | `shared/middleware/rate-limiter.ts` | Done |
| RFC 9457 Problem Details | `shared/utils/problem-details.ts` | Done |
| Request ID | `shared/middleware/request-id.ts` | Done |

### Routes Already Updated (9 files)

| Route | Pagination | Filtering | RFC 9457 | Rate Limited |
|-------|------------|-----------|----------|--------------|
| users.ts | Yes | Yes | Yes | No |
| teams.ts | Yes | Yes | Yes | No |
| services.ts | Yes | Yes | Yes | No |
| schedules.ts | Yes | Yes | Yes | No |
| integrations.ts | Yes | Yes | Yes | No |
| incidents.ts | Yes | Yes | Yes | No |
| api-keys.ts | Yes | Yes | Yes | No |
| cloud-credentials.ts | - | - | Yes | No |
| business-services.ts | - | - | Yes | No |

### Routes Needing Updates (Critical for Terraform)

| Route | Endpoints | Priority | Work Needed |
|-------|-----------|----------|-------------|
| escalation-policies.ts | 9 | **Critical** | Add pagination + filtering |
| runbooks.ts | 8 | High | Verify pagination, add filtering |
| notifications.ts | ~5 | Medium | Add pagination |
| heartbeats.ts | ~5 | Medium | Add pagination |
| webhooks.ts | ~4 | Medium | Add pagination |
| postmortems.ts | ~6 | Low | Add pagination |

### Global Infrastructure Needed

| Item | Status | Priority |
|------|--------|----------|
| Apply tiered rate limiting to app.ts | Not done | **Critical** |
| Verify request-id in all responses | Partial | High |
| Consistent error format across all routes | Partial | High |

---

## Implementation Plan

### Phase 1: Global Infrastructure (1-2 hours)

**Single agent task - must complete first**

1. **Apply tiered rate limiting to app.ts**
   - Add `methodBasedRateLimiter()` to all `/api/v1` routes
   - Add `expensiveRateLimiter` to AI endpoints
   - Add `bulkRateLimiter` to import/export endpoints

2. **Verify request-id middleware**
   - Confirm `X-Request-Id` header in all responses
   - Add to error responses

### Phase 2: Critical Route Updates (Parallelizable)

**Can run 3-4 agents in parallel**

#### Agent 1: escalation-policies.ts
- Add pagination to `GET /escalation-policies`
- Add filtering (team_id, search)
- Add sorting (name, createdAt)
- Apply RFC 9457 error format
- ~45 minutes

#### Agent 2: runbooks.ts
- Verify pagination on `GET /runbooks`
- Add filtering (service_id, tags, search)
- Add sorting (title, createdAt)
- Verify RFC 9457 error format
- ~30 minutes

#### Agent 3: notifications.ts + heartbeats.ts
- Add pagination to list endpoints
- Add filtering (status, since, until)
- ~45 minutes

#### Agent 4: webhooks.ts + webhook-subscriptions.ts
- Add pagination to list endpoints
- Add filtering
- ~30 minutes

### Phase 3: Secondary Routes (Parallelizable)

**Lower priority, can run after Phase 2**

#### Agent 5: postmortems.ts + reports.ts
- Add pagination
- Add filtering

#### Agent 6: workflows.ts + routing-rules.ts
- Add pagination
- Add filtering

#### Agent 7: tags.ts + priorities.ts + conference-bridges.ts
- Add pagination (if needed)
- Simple routes, quick updates

### Phase 4: Validation & Testing (Sequential)

1. **API consistency audit**
   - All list endpoints return `{ data: [], pagination: {} }`
   - All errors use RFC 9457 format
   - All responses include `X-Request-Id`
   - Rate limit headers present

2. **Integration tests**
   - Pagination works correctly
   - Filtering works correctly
   - Rate limiting triggers appropriately

3. **OpenAPI spec update**
   - Ensure all pagination params documented
   - Ensure all filter params documented
   - Generate fresh spec for Terraform provider

---

## Parallelization Strategy

### Wave 1 (Sequential - Blocks Everything)
```
Phase 1: Global Infrastructure
└── Apply rate limiting to app.ts
└── Verify request-id middleware
```

### Wave 2 (Parallel - 4 Agents)
```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Agent 1         │ Agent 2         │ Agent 3         │ Agent 4         │
│ escalation-     │ runbooks.ts     │ notifications   │ webhooks        │
│ policies.ts     │                 │ heartbeats      │ webhook-subs    │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### Wave 3 (Parallel - 3 Agents)
```
┌─────────────────┬─────────────────┬─────────────────┐
│ Agent 5         │ Agent 6         │ Agent 7         │
│ postmortems     │ workflows       │ tags, priorities│
│ reports         │ routing-rules   │ conf-bridges    │
└─────────────────┴─────────────────┴─────────────────┘
```

### Wave 4 (Sequential)
```
Phase 4: Validation & Testing
└── API audit
└── Integration tests
└── OpenAPI spec update
```

---

## Terraform Provider Dependencies

The Terraform provider will need these resources:

| Resource | API Endpoint | Status |
|----------|--------------|--------|
| `oncallshift_user` | /users | Ready |
| `oncallshift_team` | /teams | Ready |
| `oncallshift_service` | /services | Ready |
| `oncallshift_schedule` | /schedules | Ready |
| `oncallshift_escalation_policy` | /escalation-policies | **Needs work** |
| `oncallshift_integration` | /integrations | Ready |
| `oncallshift_runbook` | /runbooks | Verify |
| `oncallshift_api_key` | /api-keys | Ready |

**Data Sources:**
| Data Source | API Endpoint | Status |
|-------------|--------------|--------|
| `oncallshift_users` | GET /users | Ready |
| `oncallshift_teams` | GET /teams | Ready |
| `oncallshift_services` | GET /services | Ready |
| `oncallshift_schedules` | GET /schedules | Ready |
| `oncallshift_escalation_policies` | GET /escalation-policies | **Needs work** |

---

## Estimated Timeline

| Phase | Duration | Blocking? |
|-------|----------|-----------|
| Phase 1: Global Infrastructure | 1-2 hours | Yes |
| Phase 2: Critical Routes (parallel) | 1-2 hours | No |
| Phase 3: Secondary Routes (parallel) | 1 hour | No |
| Phase 4: Validation | 1-2 hours | Yes |
| **Total** | **4-7 hours** | |

---

## Success Criteria

Before starting Terraform provider:

- [ ] All list endpoints paginated with consistent format
- [ ] All endpoints have filtering where applicable
- [ ] Tiered rate limiting applied globally
- [ ] RFC 9457 error format on all endpoints
- [ ] Request-ID header on all responses
- [ ] OpenAPI spec updated and accurate
- [ ] No known breaking changes pending

---

## Risk Mitigation

### Breaking Changes
- Keep legacy response keys (e.g., `users` alongside `data`)
- Pagination defaults to high limit (100) for backwards compat
- Errors include both `error` field and RFC 9457 fields

### Context Management
- Each agent works on isolated files
- No agent modifies shared utilities (already done)
- Clear file ownership per agent

---

*Last Updated: January 2026*
