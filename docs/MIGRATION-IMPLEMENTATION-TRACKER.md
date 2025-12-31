# Migration Compatibility Implementation Tracker

**Branch**: `feature/migration-compatibility-analysis`
**Started**: December 31, 2024
**Status**: Planning Complete

---

## Phase 1: Critical Migration Completeness (P0)

> **Goal**: Enable complete account migration with zero webhook reconfiguration

### 1.1 Import User Contact Methods & Notification Rules
**Effort**: 3-5 days | **Status**: Not Started

- [ ] Extend PagerDuty import to fetch `contact_methods` for each user
- [ ] Map PagerDuty contact method types to OnCallShift format
  - [ ] `phone_contact_method` → `phone`
  - [ ] `email_contact_method` → `email`
  - [ ] `push_notification_contact_method` → `push`
  - [ ] `sms_contact_method` → `sms`
- [ ] Extend PagerDuty import to fetch `notification_rules` for each user
- [ ] Map notification rule fields
  - [ ] `start_delay_in_minutes` → `delayMinutes`
  - [ ] `urgency` → `urgency` (high/low)
  - [ ] `contact_method.type` → `method`
- [ ] Extend Opsgenie import to fetch user contacts
- [ ] Map Opsgenie notification rules
- [ ] Add contact methods to import preview
- [ ] Handle merging contact methods for existing users
- [ ] Write tests for contact method import

### 1.2 Multi-Target Escalation Steps
**Effort**: 2-3 days | **Status**: Not Started

- [ ] Audit current `EscalationStep` model for multi-target support
- [ ] Update import to process ALL targets per escalation rule (not just first)
- [ ] Add `notifyStrategy` field to EscalationStep (`all` | `round_robin`)
- [ ] Map PagerDuty multi-target rules
- [ ] Map Opsgenie multi-target rules
- [ ] Update escalation worker to notify multiple targets per step
- [ ] Add to import preview with target counts
- [ ] Write tests for multi-target escalation

### 1.3 Preserve Integration Keys (Zero-Config Migration)
**Effort**: 1-2 days | **Status**: Complete

- [x] Add `preserveKeys` option to import API
- [x] Modify Service creation to accept external integration key
- [x] Add `externalKeys` JSONB field to Service model (store original PD/OG keys)
- [x] Create database migration for `externalKeys` field
- [x] Update webhook endpoints to lookup by external key as fallback
- [x] Fetch integration keys from PagerDuty service integrations API
- [x] Fetch integration keys from Opsgenie integrations API
- [x] Add key preservation to import preview
- [x] Write tests for key preservation

### 1.4 Import Alert Routing Rules
**Effort**: 3-4 days | **Status**: Not Started

- [ ] Add `routingRules` to PagerDuty import data structure
- [ ] Fetch PagerDuty Global Event Rules via API
- [ ] Map PagerDuty event rule conditions to OnCallShift format
- [ ] Map PagerDuty event rule actions (route, severity, etc.)
- [ ] Add `alertPolicies` to Opsgenie import data structure
- [ ] Fetch Opsgenie Alert Policies via API
- [ ] Map Opsgenie policy conditions
- [ ] Map Opsgenie policy responders to routing targets
- [ ] Link imported rules to services via ID mappings
- [ ] Add routing rules to import preview
- [ ] Write tests for routing rule import

---

## Phase 2: Important Features (P1)

> **Goal**: Feature parity for common use cases

### 2.1 Heartbeat Monitors (Opsgenie)
**Effort**: 3-4 days | **Status**: Not Started

- [ ] Create `Heartbeat` model
  ```
  id, orgId, serviceId, name, intervalSeconds,
  alertAfterMissedCount, lastPingAt, status, enabled
  ```
- [ ] Create database migration for heartbeats table
- [ ] Create heartbeat API endpoints
  - [ ] `POST /api/v1/heartbeats` - Create heartbeat
  - [ ] `GET /api/v1/heartbeats` - List heartbeats
  - [ ] `GET /api/v1/heartbeats/:name/ping` - Ping heartbeat
  - [ ] `POST /api/v1/heartbeats/:name/ping` - Ping heartbeat (POST)
  - [ ] `DELETE /api/v1/heartbeats/:id` - Delete heartbeat
- [ ] Add heartbeat to Opsgenie import
- [ ] Create heartbeat monitoring worker (check for missed pings)
- [ ] Trigger incident on heartbeat timeout
- [ ] Write tests

### 2.2 Import Maintenance Windows
**Effort**: 1-2 days | **Status**: Not Started

- [ ] Add `maintenanceWindows` to PagerDuty import structure
- [ ] Fetch PagerDuty maintenance windows via API
- [ ] Map to OnCallShift MaintenanceWindow model
- [ ] Add to Opsgenie import (if API available)
- [ ] Add to import preview
- [ ] Write tests

### 2.3 Import Service Dependencies
**Effort**: 1-2 days | **Status**: Not Started

- [ ] Add `serviceDependencies` to PagerDuty import structure
- [ ] Fetch PagerDuty service dependencies via API
- [ ] Resolve service ID mappings for upstream/downstream
- [ ] Create ServiceDependency records
- [ ] Add to import preview
- [ ] Write tests

### 2.4 Import Tags
**Effort**: 1 day | **Status**: Not Started

- [ ] Add tags array to each importable entity type
- [ ] Extract tags from PagerDuty entities
- [ ] Extract tags from Opsgenie entities
- [ ] Create/match Tag records
- [ ] Create EntityTag associations
- [ ] Handle tag name deduplication
- [ ] Add to import preview
- [ ] Write tests

---

## Phase 3: Migration Tools (P2)

> **Goal**: Self-service migration experience

### 3.1 Self-Service Export Tool
**Effort**: 5-7 days | **Status**: Not Started

#### Frontend Export Wizard
- [ ] Create `/import` page with step-by-step wizard
- [ ] Step 1: Select source (PagerDuty / Opsgenie)
- [ ] Step 2: Authentication method selection
  - [ ] OAuth connection option
  - [ ] API key input option
- [ ] Step 3: Connection test and account info display
- [ ] Step 4: Select entities to import (checkboxes)
- [ ] Step 5: Preview changes (dry-run results)
- [ ] Step 6: Execute import with progress indicator
- [ ] Step 7: Results summary with any errors

#### PagerDuty OAuth Integration
- [ ] Register OnCallShift as PagerDuty OAuth app
- [ ] Implement OAuth authorization flow
- [ ] Store OAuth tokens securely
- [ ] Implement token refresh

#### Opsgenie OAuth Integration
- [ ] Register OnCallShift as Atlassian OAuth app
- [ ] Implement OAuth authorization flow
- [ ] Store OAuth tokens securely
- [ ] Implement token refresh

#### Data Fetching Service
- [ ] Create `ExportService` for PagerDuty
- [ ] Create `ExportService` for Opsgenie
- [ ] Implement pagination with rate limiting
- [ ] Implement exponential backoff for 429 errors
- [ ] Progress tracking for large accounts
- [ ] Downloadable JSON export option

### 3.2 Migration Validation & Diff Report
**Effort**: 3-4 days | **Status**: Not Started

- [ ] Create validation endpoint `POST /api/v1/import/validate`
- [ ] Compare source account vs imported configuration
- [ ] Generate diff report:
  - [ ] Missing users (not invited)
  - [ ] Schedule rotation differences
  - [ ] Escalation policy differences
  - [ ] Unmapped integrations
- [ ] Identify configuration gaps
- [ ] Suggest manual fixes needed
- [ ] Create frontend validation results view

### 3.3 Incident History Import (Optional)
**Effort**: 5-7 days | **Status**: Not Started

- [ ] Add `incidents` to import data structure
- [ ] Fetch historical incidents from PagerDuty
- [ ] Fetch historical alerts from Opsgenie
- [ ] Map incident fields preserving timestamps
- [ ] Import incident events/notes
- [ ] Handle large volumes (background job with pagination)
- [ ] Add date range filter option
- [ ] Write tests

---

## Phase 4: Webhook API Parity (P2)

> **Goal**: Complete drop-in replacement for webhook endpoints

### 4.1 PagerDuty Change Events
**Effort**: 1-2 days | **Status**: Not Started

- [ ] Add `change` event_action support to PagerDuty webhook
- [ ] Create change event record (informational, no incident)
- [ ] Link change events to services
- [ ] Return change event in response

### 4.2 Additional Opsgenie Alert Actions
**Effort**: 2-3 days | **Status**: Not Started

- [ ] `POST /api/v1/webhooks/opsgenie/{id}/notes` - Add note to incident
- [ ] `POST /api/v1/webhooks/opsgenie/{id}/tags` - Add tags to incident
- [ ] `POST /api/v1/webhooks/opsgenie/{id}/responders` - Add responder
- [ ] `POST /api/v1/webhooks/opsgenie/{id}/assign` - Assign incident
- [ ] `DELETE /api/v1/webhooks/opsgenie/{id}` - Delete/cancel alert
- [ ] `GET /api/v1/webhooks/opsgenie/{id}` - Get alert details
- [ ] Write tests for each endpoint

### 4.3 Opsgenie Request Status API
**Effort**: 1 day | **Status**: Not Started

- [ ] Create `WebhookRequest` model to track async requests
- [ ] Store request status (pending, processing, completed, failed)
- [ ] `GET /api/v1/webhooks/opsgenie/requests/{requestId}` - Get status
- [ ] Return Opsgenie-compatible response format
- [ ] Clean up old request records (TTL)
- [ ] Write tests

---

## Progress Summary

| Phase | Tasks | Completed | Progress |
|-------|-------|-----------|----------|
| Phase 1: Critical | 37 | 9 | 24% |
| Phase 2: Important | 28 | 0 | 0% |
| Phase 3: Tools | 32 | 0 | 0% |
| Phase 4: API Parity | 13 | 0 | 0% |
| **Total** | **110** | **9** | **8%** |

---

## Notes & Decisions

### Technical Decisions
- External keys stored in `externalKeys` JSONB field on Service model
- Webhook lookup checks native `apiKey` first, then falls back to external keys
- Import accepts `options.preserveKeys` flag to control key preservation
- Both PagerDuty and Opsgenie keys can be stored per service

### Blockers
- *None*

### Completed Sessions
- **Dec 31, 2024**: Initial analysis and plan creation
- **Dec 31, 2024**: Implemented Phase 1.3 - Preserve Integration Keys (8/9 tasks)

---

## Quick Links

- [Full Analysis Document](./MIGRATION-COMPATIBILITY-PLAN.md)
- [PagerDuty API Reference](https://developer.pagerduty.com/api-reference)
- [Opsgenie API Overview](https://docs.opsgenie.com/docs/api-overview)
- [Current webhooks.ts](../backend/src/api/routes/webhooks.ts)
- [Current import.ts](../backend/src/api/routes/import.ts)
