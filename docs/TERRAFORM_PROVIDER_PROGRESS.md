# Terraform Provider for OnCallShift - Progress Tracker

**Branch:** `feat/terraform-provider`
**Started:** 2026-01-03
**Goal:** Build a production-ready Terraform provider for OnCallShift

---

## Overview

The Terraform provider enables Infrastructure-as-Code management of OnCallShift resources. Users can define their incident management configuration in HCL and manage it through standard Terraform workflows.

### Target Usage

```hcl
terraform {
  required_providers {
    oncallshift = {
      source  = "oncallshift/oncallshift"
      version = "~> 1.0"
    }
  }
}

provider "oncallshift" {
  api_url = "https://oncallshift.com/api/v1"
  api_key = var.oncallshift_api_key
}

resource "oncallshift_team" "platform" {
  name        = "Platform Engineering"
  description = "Infrastructure and platform team"
}

resource "oncallshift_service" "api" {
  name        = "API Service"
  description = "Main API service"
  team_id     = oncallshift_team.platform.id
}
```

---

## Phase 1: Project Setup - COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| Create Go module structure | DONE | `packages/terraform-provider-oncallshift/` |
| Set up terraform-plugin-framework | DONE | Using v1.17.0 |
| Configure provider schema | DONE | api_url, api_key with env var support |
| Implement API client | DONE | Full REST client with error handling |
| Add Makefile for development | DONE | build, test, install, testacc targets |
| Add README | DONE | Usage documentation |

### Directory Structure

```
packages/terraform-provider-oncallshift/
├── main.go                     # Entry point
├── go.mod                      # Go module (v1.24.0)
├── go.sum
├── Makefile                    # Build automation
├── README.md                   # Provider documentation
├── internal/
│   ├── provider/
│   │   └── provider.go         # Provider configuration
│   ├── client/
│   │   ├── client.go           # API client (all resource types)
│   │   └── client_test.go      # Unit tests (12 tests)
│   ├── datasources/
│   │   ├── team.go             # data.oncallshift_team
│   │   ├── service.go          # data.oncallshift_service
│   │   ├── user.go             # data.oncallshift_user
│   │   └── schedule.go         # data.oncallshift_schedule
│   └── resources/
│       ├── team.go             # oncallshift_team
│       ├── user.go             # oncallshift_user
│       ├── service.go          # oncallshift_service
│       ├── schedule.go         # oncallshift_schedule
│       ├── escalation_policy.go # oncallshift_escalation_policy
│       ├── integration.go      # oncallshift_integration
│       ├── routing_rule.go     # oncallshift_routing_rule
│       ├── runbook.go          # oncallshift_runbook
│       └── workflow.go         # oncallshift_workflow
├── docs/                       # Generated documentation
└── examples/
    ├── provider/
    │   └── provider.tf
    ├── resources/
    │   ├── oncallshift_team/
    │   ├── oncallshift_service/
    │   ├── oncallshift_user/
    │   ├── oncallshift_schedule/
    │   └── oncallshift_escalation_policy/
    └── complete/
        └── main.tf             # Full working example
```

---

## Phase 2: Core Resources - COMPLETE

### Priority 1: Foundation Resources

| Resource | CRUD | Import | Status |
|----------|------|--------|--------|
| `oncallshift_team` | C R U D | Yes | DONE |
| `oncallshift_user` | C R U D | Yes | DONE |
| `oncallshift_service` | C R U D | Yes | DONE |

### Priority 2: Scheduling Resources

| Resource | CRUD | Import | Status |
|----------|------|--------|--------|
| `oncallshift_schedule` | C R U D | Yes | DONE |
| `oncallshift_escalation_policy` | C R U D | Yes | DONE |

### Priority 3: Integration Resources - COMPLETE

| Resource | CRUD | Import | Status |
|----------|------|--------|--------|
| `oncallshift_integration` | C R U D | Yes | DONE |
| `oncallshift_routing_rule` | C R U D | Yes | DONE |

### Priority 4: Advanced Resources - COMPLETE

| Resource | CRUD | Import | Status |
|----------|------|--------|--------|
| `oncallshift_runbook` | C R U D | Yes | DONE |
| `oncallshift_workflow` | C R U D | Yes | DONE |
| `oncallshift_status_page` | C R U D | Yes | FUTURE |
| `oncallshift_business_service` | C R U D | Yes | FUTURE |

---

## Phase 3: Data Sources - COMPLETE

| Data Source | Status |
|-------------|--------|
| `oncallshift_team` | DONE |
| `oncallshift_user` | DONE |
| `oncallshift_service` | DONE |
| `oncallshift_schedule` | DONE |
| `oncallshift_teams` (list) | FUTURE |
| `oncallshift_users` (list) | FUTURE |
| `oncallshift_services` (list) | FUTURE |
| `oncallshift_oncall` | FUTURE |
| `oncallshift_escalation_policy` | FUTURE |

---

## Phase 4: Testing & Documentation - COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| Unit tests for client | DONE | 12 tests with mock HTTP responses |
| Acceptance tests | FUTURE | Real API against test org |
| Provider documentation | DONE | README.md |
| Resource documentation | DONE | Inline markdown docs |
| Example configurations | DONE | 6 examples including complete setup |
| Website documentation | DONE | /docs/iac/terraform |

---

## API Endpoints Used

The provider uses the following OnCallShift API endpoints:

| Resource | Endpoints |
|----------|-----------|
| Teams | `GET/POST /teams`, `GET/PUT/DELETE /teams/:id` |
| Users | `GET/POST /users/invite`, `GET/PUT/DELETE /users/:id` |
| Services | `GET/POST /services`, `GET/PUT/DELETE /services/:id` |
| Schedules | `GET/POST /schedules`, `GET/PUT/DELETE /schedules/:id` |
| Escalation Policies | `GET/POST /escalation-policies`, `GET/PUT/DELETE /escalation-policies/:id` |
| Integrations | `GET/POST /integrations`, `GET/PUT/DELETE /integrations/:id` |
| Routing Rules | `GET/POST /routing-rules`, `GET/PUT/DELETE /routing-rules/:id` |
| Runbooks | `GET/POST /runbooks`, `GET/PUT/DELETE /runbooks/:id` |
| Workflows | `GET/POST /workflows`, `GET/PUT/DELETE /workflows/:id` |

---

## Authentication

The provider supports:

1. **API Key** (primary): `ONCALLSHIFT_API_KEY` environment variable or `api_key` attribute
2. **Bearer Token**: For Cognito-authenticated users (optional)

```hcl
provider "oncallshift" {
  api_key = var.oncallshift_api_key  # Or use ONCALLSHIFT_API_KEY env var
}
```

---

## Development Commands

```bash
cd packages/terraform-provider-oncallshift

# Build provider
make build

# Install locally for testing
make install

# Run unit tests
make test

# Run acceptance tests (requires API key)
ONCALLSHIFT_API_KEY=xxx make testacc

# Generate documentation
make docs
```

---

## Files Created

| File | Purpose |
|------|---------|
| `main.go` | Provider entry point |
| `go.mod` | Go module definition |
| `Makefile` | Build automation |
| `README.md` | Provider documentation |
| `internal/provider/provider.go` | Provider configuration |
| `internal/client/client.go` | API client |
| `internal/resources/team.go` | Team resource |
| `internal/resources/service.go` | Service resource |
| `internal/resources/user.go` | User resource |
| `internal/resources/schedule.go` | Schedule resource |
| `internal/resources/escalation_policy.go` | Escalation policy resource |
| `examples/provider/provider.tf` | Provider example |
| `examples/resources/*/resource.tf` | Resource examples |
| `examples/complete/main.tf` | Complete setup example |

---

## Current Session Progress

### 2026-01-03 - Session 1

- [x] Create branch `feat/terraform-provider`
- [x] Create progress tracking document
- [x] Initialize Go module
- [x] Set up terraform-plugin-framework (v1.17.0)
- [x] Implement provider configuration with API key auth
- [x] Implement API client with RFC 9457 error handling
- [x] Implement oncallshift_team resource
- [x] Implement oncallshift_service resource
- [x] Implement oncallshift_user resource
- [x] Implement oncallshift_schedule resource (with layers)
- [x] Implement oncallshift_escalation_policy resource (with steps and targets)
- [x] Add example configurations
- [x] Verify build compiles successfully
- [x] Commit and push initial provider

### 2026-01-03 - Session 2 (Continuation)

- [x] Add unit tests for API client (12 tests)
- [x] Implement data sources (team, service, user, schedule)
- [x] Extend API client with Integration, RoutingRule, Runbook, Workflow types
- [x] Implement oncallshift_integration resource
- [x] Implement oncallshift_routing_rule resource
- [x] Implement oncallshift_runbook resource
- [x] Implement oncallshift_workflow resource
- [x] Update provider to register all 9 resources + 4 data sources
- [x] Verify build and tests pass
- [x] Commit and push additional resources
- [x] Update website documentation at /docs/iac/terraform

### Future Work

- [ ] Add acceptance tests (requires test org)
- [ ] Add list data sources (teams, users, services)
- [ ] Add oncallshift_status_page resource
- [ ] Add oncallshift_business_service resource
- [ ] Publish to Terraform Registry

---

## References

- [Terraform Plugin Framework](https://developer.hashicorp.com/terraform/plugin/framework)
- [PagerDuty Provider](https://github.com/PagerDuty/terraform-provider-pagerduty) - Reference implementation
- [OnCallShift API Docs](https://oncallshift.com/api-docs)

---

*Last Updated: 2026-01-03 (Session 2)*
