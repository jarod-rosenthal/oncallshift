# PagerDuty & Opsgenie Migration Compatibility Plan

## Executive Summary

This document outlines the gaps in OnCallShift's backwards compatibility with PagerDuty and Opsgenie, along with an implementation plan to enable seamless migration for customers from both platforms.

**Key Context**: Opsgenie is being sunset by Atlassian (EOL: April 5, 2027), creating a significant market opportunity for customers needing to migrate their incident management configurations.

---

## Current State Analysis

### What's Already Implemented

#### Webhook Compatibility

| Feature | PagerDuty | Opsgenie | Status |
|---------|-----------|----------|--------|
| Alert creation | Events API v2 format | Alert API v2 format | ✅ Complete |
| Acknowledge alerts | ✅ | ✅ | ✅ Complete |
| Resolve alerts | ✅ | ✅ (close) | ✅ Complete |
| Deduplication keys | ✅ routing_key | ✅ alias | ✅ Complete |
| Severity/Priority mapping | ✅ 4-level | ✅ P1-P5 → 4-level | ✅ Complete |
| Custom details passthrough | ✅ | ✅ | ✅ Complete |

#### Import Capabilities

| Entity | PagerDuty | Opsgenie | Status |
|--------|-----------|----------|--------|
| Users | Match by email | Match by username | ✅ Complete |
| Teams | Name + members | Name + members | ✅ Complete |
| Schedules | Layers + rotations | Rotations | ✅ Complete |
| Schedule restrictions | Weekly intervals | Daily/weekly | ✅ Complete |
| Escalation policies | Rules → steps | Rules → steps | ✅ Complete |
| Services | Name + policy link | Name + team link | ✅ Complete |
| ID mappings returned | ✅ | ✅ | ✅ Complete |
| Preview/dry-run | ✅ | ✅ | ✅ Complete |

---

## Gap Analysis

### Critical Gaps (Must Have for Migration)

#### 1. User Contact Methods & Notification Rules
**Impact**: High - Users can't receive alerts without this

| Feature | PagerDuty | Opsgenie | OnCallShift |
|---------|-----------|----------|-------------|
| Email contact | ✅ | ✅ | ✅ Exists |
| Phone/SMS contact | ✅ | ✅ | ✅ Exists |
| Push notification | ✅ | ✅ | ✅ Exists |
| **Import from source** | ❌ Not imported | ❌ Not imported | **GAP** |
| Notification timing rules | ✅ | ✅ | ❌ **GAP** |
| Urgency-based rules | ✅ high/low | ✅ | ❌ **GAP** |

**Current State**: `UserContactMethod` and `UserNotificationRule` models exist but import doesn't populate them.

#### 2. Multi-Target Escalation Steps
**Impact**: High - Many policies notify multiple people per step

| Feature | PagerDuty | Opsgenie | OnCallShift |
|---------|-----------|----------|-------------|
| Multiple users per step | ✅ | ✅ | ⚠️ Partial |
| Multiple schedules per step | ✅ | ✅ | ❌ **GAP** |
| Notify all vs round-robin | ✅ | ✅ | ❌ **GAP** |

**Current State**: Import takes only first target per step, ignoring additional targets.

#### 3. Integration Keys & Webhooks
**Impact**: High - Existing monitoring tools won't work without reconfiguration

| Feature | PagerDuty | Opsgenie | OnCallShift |
|---------|-----------|----------|-------------|
| Service integration keys | ✅ routing_key | ✅ API key | ✅ Exists |
| **Preserve original keys** | ❌ | ❌ | **GAP** |
| Email integration address | ✅ | ✅ | ❌ **GAP** |
| Inbound webhooks list | ✅ | ✅ | ⚠️ Partial |

**Current State**: New API keys generated on import; original keys not preserved.

#### 4. Routing Rules / Event Rules
**Impact**: Medium-High - Determines which service receives alerts

| Feature | PagerDuty | Opsgenie | OnCallShift |
|---------|-----------|----------|-------------|
| Event rules/routing | ✅ Global Event Rules | ✅ Alert Policies | ⚠️ Partial |
| Condition-based routing | ✅ | ✅ | ✅ Model exists |
| **Import routing rules** | ❌ | ❌ | **GAP** |
| Event transformation | ✅ | ✅ | ✅ Model exists |

**Current State**: `AlertRoutingRule` and `EventTransformRule` models exist but not imported.

### Important Gaps (Should Have)

#### 5. Heartbeat Monitors
**Impact**: Medium - Service health monitoring

| Feature | PagerDuty | Opsgenie | OnCallShift |
|---------|-----------|----------|-------------|
| Heartbeat/check-in | ❌ (different model) | ✅ | ❌ **GAP** |
| Auto-alert on timeout | N/A | ✅ | ❌ **GAP** |

#### 6. Maintenance Windows
**Impact**: Medium - Suppress alerts during planned work

| Feature | PagerDuty | Opsgenie | OnCallShift |
|---------|-----------|----------|-------------|
| Maintenance windows | ✅ | ✅ | ✅ Model exists |
| **Import windows** | ❌ | ❌ | **GAP** |
| Service-level suppression | ✅ | ✅ | ✅ |

#### 7. Business Services / Service Dependencies
**Impact**: Medium - Impact analysis and grouping

| Feature | PagerDuty | Opsgenie | OnCallShift |
|---------|-----------|----------|-------------|
| Business services | ✅ | ❌ | ✅ Model exists |
| Service dependencies | ✅ | ✅ | ✅ Model exists |
| **Import dependencies** | ❌ | ❌ | **GAP** |

#### 8. Tags
**Impact**: Low-Medium - Organization and filtering

| Feature | PagerDuty | Opsgenie | OnCallShift |
|---------|-----------|----------|-------------|
| Entity tagging | ✅ | ✅ | ✅ Model exists |
| **Import tags** | ❌ | ❌ | **GAP** |

### Nice-to-Have Gaps

#### 9. Incident History Migration
**Impact**: Low - Historical data for reporting

| Feature | PagerDuty | Opsgenie | OnCallShift |
|---------|-----------|----------|-------------|
| Import past incidents | ❌ | ❌ | **GAP** |
| Preserve incident numbers | ❌ | ❌ | **GAP** |
| Import incident notes | ❌ | ❌ | **GAP** |

#### 10. Analytics/Reports Export
**Impact**: Low - Historical metrics

| Feature | PagerDuty | Opsgenie | OnCallShift |
|---------|-----------|----------|-------------|
| MTTA/MTTR history | ❌ | ❌ | **GAP** |
| On-call hours reports | ❌ | ❌ | **GAP** |

---

## Implementation Plan

### Phase 1: Critical Migration Completeness (Priority: P0)

#### 1.1 Import User Contact Methods & Notification Rules
**Effort**: Medium (3-5 days)

```
PagerDuty contact_methods → UserContactMethod
  - type: phone_contact_method → phone
  - type: email_contact_method → email
  - type: push_notification_contact_method → push
  - address → value
  - label → label

PagerDuty notification_rules → UserNotificationRule
  - start_delay_in_minutes → delayMinutes
  - urgency → urgency (high/low)
  - contact_method.type → method
```

```
Opsgenie contacts → UserContactMethod (via User API)
Opsgenie notificationRules → UserNotificationRule
```

**Tasks**:
- [ ] Extend import.ts to fetch contact methods for each user
- [ ] Map PagerDuty notification rules to OnCallShift format
- [ ] Map Opsgenie notification rules
- [ ] Add to import preview
- [ ] Update user matching to merge contact methods for existing users

#### 1.2 Multi-Target Escalation Steps
**Effort**: Medium (2-3 days)

**Current limitation**: Takes first target only
**Solution**: Import all targets per step

```typescript
// Current (limited)
const firstTarget = pdRule.targets[0];

// Enhanced
const targets = pdRule.targets.map(t => ({
  type: t.type.replace('_reference', ''),
  id: mapId(t.id)
}));
```

**Tasks**:
- [ ] Update EscalationStep to store multiple targets
- [ ] Modify import to process all targets per rule
- [ ] Add target notification strategy (all vs round-robin)
- [ ] Update escalation worker to notify multiple targets

#### 1.3 Preserve Integration Keys (Zero-Config Migration)
**Effort**: Low (1-2 days)

**Goal**: Allow customers to keep existing PagerDuty/Opsgenie integration keys so monitoring tools don't need reconfiguration.

**Approach**:
```typescript
// Allow import to specify original key
service = serviceRepo.create({
  ...
  apiKey: pdService.integration_key || crypto.randomUUID(),
  // Store original for reference
  externalKeys: {
    pagerduty: pdService.integration_key,
    opsgenie: ogService.apiKey
  }
});
```

**Tasks**:
- [ ] Add optional `preserveKeys` flag to import
- [ ] Fetch integration keys from PagerDuty service integrations
- [ ] Store multiple external keys per service
- [ ] Support lookup by any external key in webhook endpoints

#### 1.4 Import Alert Routing Rules
**Effort**: Medium (3-4 days)

```
PagerDuty Event Rules → AlertRoutingRule
  - conditions → conditions (JSON)
  - actions.route.service → serviceId
  - actions.severity → severityOverride

Opsgenie Alert Policies → AlertRoutingRule
  - filter.conditions → conditions
  - responders → routing targets
```

**Tasks**:
- [ ] Add routing rules to import data structure
- [ ] Map PagerDuty event rules conditions
- [ ] Map Opsgenie alert policy conditions
- [ ] Link rules to services
- [ ] Add to preview

### Phase 2: Important Features (Priority: P1)

#### 2.1 Heartbeat Monitors (Opsgenie)
**Effort**: Medium (3-4 days)

**Model needed**: `Heartbeat`
```typescript
{
  id, orgId, serviceId,
  name, intervalSeconds,
  alertAfterMissedCount,
  lastPingAt, status
}
```

**Tasks**:
- [ ] Create Heartbeat model and migration
- [ ] Add heartbeat API endpoints (ping, status)
- [ ] Add to Opsgenie import
- [ ] Create heartbeat monitoring worker

#### 2.2 Import Maintenance Windows
**Effort**: Low (1-2 days)

**Tasks**:
- [ ] Add maintenance windows to import data structures
- [ ] Map PagerDuty maintenance windows
- [ ] Map Opsgenie maintenance (if available)
- [ ] Add to preview

#### 2.3 Import Service Dependencies
**Effort**: Low (1-2 days)

**Tasks**:
- [ ] Add dependencies to PagerDuty import
- [ ] Resolve service ID mappings for dependencies
- [ ] Create ServiceDependency records

#### 2.4 Import Tags
**Effort**: Low (1 day)

**Tasks**:
- [ ] Add tags to import for each entity type
- [ ] Create Tag and EntityTag records
- [ ] Handle tag deduplication

### Phase 3: Migration Tools (Priority: P2)

#### 3.1 Self-Service Export Tool for Customers
**Effort**: High (5-7 days)

Create a CLI/web tool that customers can run against their PagerDuty/Opsgenie account to generate a complete export JSON.

**Components**:
1. Web UI wizard with OAuth connection to PagerDuty/Opsgenie
2. API key input alternative
3. Progress indicator for large accounts
4. Downloadable JSON export
5. Direct import option

**Tasks**:
- [ ] Create frontend export wizard component
- [ ] Add PagerDuty OAuth flow
- [ ] Add Opsgenie OAuth flow
- [ ] Implement paginated data fetching with rate limiting
- [ ] Generate comprehensive export JSON
- [ ] Add import directly from OAuth connection

#### 3.2 Migration Validation & Diff Report
**Effort**: Medium (3-4 days)

Post-migration validation that compares source vs imported configuration.

**Tasks**:
- [ ] Create comparison endpoint
- [ ] Generate diff report (missing users, schedules, etc.)
- [ ] Identify configuration gaps
- [ ] Suggest manual fixes needed

#### 3.3 Incident History Import (Optional)
**Effort**: High (5-7 days)

**Tasks**:
- [ ] Add incidents to import data structure
- [ ] Map incident fields and preserve timestamps
- [ ] Import incident events/notes
- [ ] Handle large incident volumes (pagination, background job)

### Phase 4: Webhook API Parity (Priority: P2)

#### 4.1 Additional PagerDuty Events API Actions
**Effort**: Low (1-2 days)

Support additional event actions beyond trigger/acknowledge/resolve:
- [ ] `change` events (informational)
- [ ] Custom event routing

#### 4.2 Additional Opsgenie Alert Actions
**Effort**: Medium (2-3 days)

- [ ] `POST /v2/alerts/{id}/notes` - Add note
- [ ] `POST /v2/alerts/{id}/tags` - Add tags
- [ ] `POST /v2/alerts/{id}/responders` - Add responder
- [ ] `POST /v2/alerts/{id}/assign` - Assign alert
- [ ] `DELETE /v2/alerts/{id}` - Delete alert
- [ ] `GET /v2/alerts/{id}` - Get alert details

#### 4.3 Opsgenie Request Status API
**Effort**: Low (1 day)

Opsgenie returns 202 with requestId; clients can poll for status:
- [ ] `GET /v2/alerts/requests/{requestId}` - Get request status

---

## API Compatibility Matrix (Target State)

### PagerDuty Events API v2
| Endpoint | Current | Target |
|----------|---------|--------|
| POST /v2/enqueue (trigger) | ✅ | ✅ |
| POST /v2/enqueue (acknowledge) | ✅ | ✅ |
| POST /v2/enqueue (resolve) | ✅ | ✅ |
| POST /v2/change | ❌ | ✅ |

### Opsgenie Alert API v2
| Endpoint | Current | Target |
|----------|---------|--------|
| POST /v2/alerts | ✅ | ✅ |
| POST /v2/alerts/{id}/acknowledge | ✅ | ✅ |
| POST /v2/alerts/{id}/close | ✅ | ✅ |
| POST /v2/alerts/{id}/notes | ❌ | ✅ |
| POST /v2/alerts/{id}/tags | ❌ | ✅ |
| POST /v2/alerts/{id}/assign | ❌ | ✅ |
| GET /v2/alerts/{id} | ❌ | ✅ |
| GET /v2/alerts/requests/{id} | ❌ | ✅ |

### Import API
| Entity | Current | Target |
|--------|---------|--------|
| Users | ✅ Match only | ✅ + Contact methods |
| Teams | ✅ | ✅ |
| Schedules | ✅ | ✅ |
| Escalation Policies | ✅ First target | ✅ All targets |
| Services | ✅ New keys | ✅ Preserve keys option |
| Routing Rules | ❌ | ✅ |
| Maintenance Windows | ❌ | ✅ |
| Tags | ❌ | ✅ |
| Heartbeats (OG) | ❌ | ✅ |
| Incidents (historical) | ❌ | ⚠️ Optional |

---

## Success Metrics

### Migration Success Criteria
1. **Zero webhook reconfiguration**: Customer's monitoring tools work without changes
2. **Complete schedule coverage**: All on-call schedules imported with correct rotations
3. **Escalation fidelity**: All escalation paths preserved including multi-target steps
4. **User notification parity**: Users receive alerts via same channels as before
5. **< 30 minute migration**: Automated import completes in under 30 minutes for typical accounts

### Validation Checklist
- [ ] All users mapped or invited
- [ ] All teams created with correct membership
- [ ] All schedules imported with correct timezone and rotations
- [ ] All escalation policies imported with all targets per step
- [ ] All services linked to correct policies
- [ ] Webhook endpoints accept traffic from existing integrations
- [ ] Test alert flows through to notifications

---

## Timeline Estimate

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Critical Completeness | 10-14 days | P0 |
| Phase 2: Important Features | 8-11 days | P1 |
| Phase 3: Migration Tools | 13-18 days | P2 |
| Phase 4: API Parity | 4-6 days | P2 |

**Recommended MVP**: Phase 1 (2-3 weeks)
**Full Migration Suite**: All Phases (6-8 weeks)

---

## References

- [PagerDuty REST API](https://developer.pagerduty.com/api-reference)
- [PagerDuty Events API v2](https://developer.pagerduty.com/docs/events-api-v2/overview/)
- [Opsgenie API Overview](https://docs.opsgenie.com/docs/api-overview)
- [Opsgenie Alert API](https://docs.opsgenie.com/docs/alert-api)
- [Opsgenie Configuration Backup Tool](https://github.com/opsgenie/opsgenie-configuration-backup)
- [Opsgenie Migration Gotchas](https://incident.io/blog/12-opsgenie-data-export-gotchas)
