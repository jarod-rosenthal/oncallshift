# PagerDuty → OnCallShift Migration Gap Analysis

This document compares PagerDuty Service Standards features against OnCallShift capabilities to identify gaps in the migration path.

---

## Summary

| PagerDuty Feature | OnCallShift Support | Import Support | Gap Level |
|-------------------|---------------------|----------------|-----------|
| Users | Full | Full | None |
| Teams | Full | Full | None |
| Team Memberships | Full | Full | None |
| Schedules | Full | Full | None |
| Schedule Layers | Full | Full | None |
| Escalation Policies | Full | Full | None |
| Services | Full | Full | None |
| Service Dependencies | Full | Full | None |
| Alert Grouping | Full | **Missing** | Medium |
| Support Hours/Urgency | Full | **Missing** | Medium |
| Business Services | Full | **Missing** | High |
| Integrations (Events API) | Full | Partial | Low |
| Extensions (Webhooks) | Full | **Missing** | Medium |
| Change Events | Full | **Missing** | Low |
| Routing Rules | Full | Full | None |
| Maintenance Windows | Full | Full | None |
| Tags | Full | Full | None |

---

## Detailed Analysis

### 1. Business Services ❌ HIGH GAP

**PagerDuty Data:**
- 4 business services created (E-Commerce Platform, Payment Processing, Mobile Experience, Core Infrastructure)
- Each has description and point of contact
- Business services have dependencies on technical services

**OnCallShift Model:** `backend/src/shared/models/BusinessService.ts`
- Full model exists with: name, description, ownerTeamId, pointOfContactId, status, impactTier
- Services can link via `businessServiceId`

**Import Status:** NOT IMPLEMENTED
- `import.ts` has no `business_services` field in `PagerDutyImportData` interface
- No import logic for business services

**Recommendation:**
1. Add `business_services?: PagerDutyBusinessService[]` to import interface
2. Map PD business services to OnCallShift BusinessService model
3. After importing services, link them to business services via `businessServiceId`

---

### 2. Alert Grouping ❌ MEDIUM GAP

**PagerDuty Data:**
- All services configured with `intelligent` grouping
- `alert_grouping_parameters.type = "intelligent"`

**OnCallShift Model:** `backend/src/shared/models/AlertGroupingRule.ts`
- Full model exists with: groupingType (intelligent|time|content|disabled)
- Supports timeWindowMinutes, contentFields, dedupKeyTemplate, maxAlertsPerIncident

**Import Status:** NOT IMPLEMENTED
- PagerDuty service import doesn't extract `alert_grouping_parameters`
- No AlertGroupingRule creation during import

**Recommendation:**
1. Extract `alert_grouping_parameters` from PD services
2. Create AlertGroupingRule records during service import
3. Map PD types: `intelligent` → `intelligent`, `time` → `time`, `content_based` → `content`

---

### 3. Support Hours / Urgency Rules ❌ MEDIUM GAP

**PagerDuty Data:**
- All services configured with `use_support_hours` urgency rule
- During support hours (9-5 ET weekdays): high urgency
- Outside support hours: low urgency

**OnCallShift Model:** `backend/src/shared/models/Service.ts`
- Full support exists:
  - `urgency: 'high' | 'low' | 'dynamic'`
  - `supportHours: { enabled, timezone, days, startTime, endTime }`
  - `getEffectiveUrgency()` method handles dynamic urgency

**Import Status:** NOT IMPLEMENTED
- PagerDuty service import doesn't extract `incident_urgency_rule` or `support_hours`
- Service.urgency defaults to 'high' during import

**Recommendation:**
1. Extract `incident_urgency_rule` from PD services
2. If type is `use_support_hours`, set `urgency: 'dynamic'`
3. Extract `support_hours` and map to OnCallShift format:
   - PD: `time_zone`, `days_of_week: [1,2,3,4,5]`, `start_time: "09:00:00"`, `end_time: "17:00:00"`
   - OCS: `timezone`, `days: [1,2,3,4,5]`, `startTime: "09:00"`, `endTime: "17:00"`

---

### 4. Extensions / Webhooks ❌ MEDIUM GAP

**PagerDuty Data:**
- 3 webhook extensions (Slack channels for alerts)
- Each has endpoint URL and is attached to services

**OnCallShift Model:** `backend/src/shared/models/WebhookSubscription.ts`
- Full PagerDuty v3 webhook compatibility
- Supports: organization/service/team scopes, event types, HMAC signatures
- Delivery tracking with retry configuration

**Import Status:** NOT IMPLEMENTED
- No `extensions` field in import interface
- No WebhookSubscription creation during import

**Recommendation:**
1. Add `extensions?: PagerDutyExtension[]` to import interface
2. Map PD extensions to WebhookSubscription:
   - `endpoint_url` → `url`
   - `extension_objects[].id` → `serviceId` (for service scope)
   - Generate webhook secret for HMAC signing
3. Set default event types based on extension type

---

### 5. Service Integrations (Events API) ⚠️ LOW GAP

**PagerDuty Data:**
- 8 integrations across services (Datadog, Stripe, Prometheus, CloudWatch, GitHub, ArgoCD, Terraform)
- Each has unique integration_key for receiving events

**OnCallShift Model:**
- Services have `apiKey` field (auto-generated)
- Services have `externalKeys` field for preserving PD/Opsgenie keys

**Import Status:** PARTIAL
- `preserveKeys` option stores PD integration keys in `externalKeys.pagerduty`
- But individual per-integration keys aren't captured (only one key per service)

**Recommendation:**
1. During PD export, fetch all integrations for each service
2. Store primary integration key in `externalKeys.pagerduty`
3. Consider storing all integration keys in service `settings` for reference
4. Document that consolidation happens (multiple PD integrations → single OCS service key)

---

### 6. Change Events ⚠️ LOW GAP

**PagerDuty Data:**
- 4 change integrations (GitHub Deployments, ArgoCD, Terraform Apply, DB Migrations)
- Track deployments for incident correlation

**OnCallShift Model:** `backend/src/shared/models/ChangeEvent.ts`
- Full model exists: summary, source, timestamp, customDetails, links
- Compatible with PagerDuty Events API v2 change events

**Import Status:** NOT APPLICABLE
- Change events are runtime data, not configuration
- Historical change events typically don't need migration
- New change events will flow in via API after migration

**Recommendation:**
1. No import needed - change events are ephemeral
2. Ensure OnCallShift change event endpoint is documented
3. Update monitoring tools to send change events to OnCallShift

---

### 7. Service-to-Service Dependencies ✅ NO GAP

**PagerDuty Data:**
- 3 technical dependencies (API Gateway → Auth/User, Payment Processor → PostgreSQL)
- 7 business dependencies (Business Service → Technical Service)

**OnCallShift Model:** `backend/src/shared/models/ServiceDependency.ts`
- Full support: dependentServiceId, supportingServiceId, dependencyType, impactLevel

**Import Status:** FULLY IMPLEMENTED
- `service_dependencies` is in `PagerDutyImportData` interface
- Proper mapping of PD dependencies to OnCallShift ServiceDependency

**Note:** Business service dependencies need BusinessService import first (see Gap #1)

---

## Migration Gaps by Priority

### High Priority (Block migration completeness)
1. **Business Services** - Users with business service hierarchies will lose this structure

### Medium Priority (Degraded functionality)
2. **Alert Grouping** - Services will create more incidents than expected (each alert = new incident)
3. **Support Hours/Urgency** - All incidents will be high urgency (no off-hours low urgency)
4. **Extensions/Webhooks** - Slack/webhook notifications won't be migrated

### Low Priority (Minor inconvenience)
5. **Integration Keys** - Multiple integrations per service consolidated to one key
6. **Change Events** - Historical deployment data not migrated (acceptable)

---

## Recommended Import Interface Additions

```typescript
interface PagerDutyImportData {
  // Existing
  users?: PagerDutyUser[];
  teams?: PagerDutyTeam[];
  schedules?: PagerDutySchedule[];
  escalation_policies?: PagerDutyEscalationPolicy[];
  services?: PagerDutyService[];
  routing_rules?: PagerDutyEventRule[];
  maintenance_windows?: PagerDutyMaintenanceWindow[];
  service_dependencies?: PagerDutyServiceDependency[];

  // NEW - Add these
  business_services?: PagerDutyBusinessService[];
  extensions?: PagerDutyExtension[];
}

interface PagerDutyBusinessService {
  id: string;
  name: string;
  description?: string;
  point_of_contact?: string;
  team?: { id: string };
}

interface PagerDutyExtension {
  id: string;
  name: string;
  endpoint_url: string;
  extension_schema: { id: string; type: string; summary?: string };
  extension_objects: Array<{ id: string; type: string }>;
}

interface PagerDutyService {
  // Existing fields...

  // NEW - Add these
  alert_grouping_parameters?: {
    type: 'intelligent' | 'time' | 'content_based';
    timeout?: number;
    config?: {
      fields?: string[];
    };
  };
  incident_urgency_rule?: {
    type: 'constant' | 'use_support_hours';
    urgency?: 'high' | 'low';
    during_support_hours?: { type: string; urgency: string };
    outside_support_hours?: { type: string; urgency: string };
  };
  support_hours?: {
    type: string;
    time_zone: string;
    days_of_week: number[];
    start_time: string;
    end_time: string;
  };
  integrations?: Array<{
    id: string;
    type: string;
    name: string;
    integration_key: string;
  }>;
}
```

---

## MCP Server Gaps

The OnCallShift MCP server (`mcp__oncallshift__import_from_platform`) needs updates to:
1. Fetch business services from PagerDuty API
2. Fetch extensions from PagerDuty API
3. Include alert_grouping_parameters in service fetch
4. Include incident_urgency_rule and support_hours in service fetch

---

## Conclusion

OnCallShift has **full model support** for all PagerDuty Service Standards features. The gaps are entirely in the **import pipeline** - the data structures exist but aren't being populated during migration.

**Effort Estimate:**
- Add business services import: ~2-4 hours
- Add alert grouping import: ~1-2 hours
- Add support hours import: ~1-2 hours
- Add extensions import: ~2-3 hours
- Total: ~8-12 hours of development work

All gaps are addressable without schema changes.
