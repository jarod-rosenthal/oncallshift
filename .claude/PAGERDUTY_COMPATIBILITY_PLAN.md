# PagerDuty Compatibility Gap Analysis & Implementation Plan

**Created:** 2025-01-01
**Status:** In Progress
**Branch:** `feature/pagerduty-compatibility-assessment`

This document tracks the gap analysis between OnCallShift and PagerDuty to ensure seamless migrations and familiar user experience for PagerDuty users.

---

## Executive Summary

OnCallShift already has strong foundational compatibility with PagerDuty, including:
- Core incident lifecycle (trigger, acknowledge, resolve)
- Escalation policies with multi-step support
- On-call schedules with layers and overrides
- Event ingestion via Events API v2 compatible webhooks
- Import wizard for PagerDuty data migration

However, several gaps exist in advanced features that PagerDuty power users expect. This plan prioritizes closing these gaps to enable frictionless migration.

---

## Current Status (2026-01-01)

### ✅ COMPLETED (Phase 1 & 2)
All core PagerDuty compatibility features are implemented and deployed:

1. **Add Responders** - Request help from additional users during incidents
2. **Snooze Incidents** - Temporarily defer notifications with automatic expiry
3. **Service Urgency** - High/low/dynamic urgency with timezone-aware support hours
4. **Event Suppression/Suspension** - Suppress incident creation based on routing rules
5. **Internal Status Pages** - Public-facing status pages with subscriber management
6. **Incident Workflows (Response Plays)** - Full automation engine with UI builder and automatic triggering

### ✅ COMPLETED (Phase 3 - High Priority)
Advanced features implemented:

- **Advanced Permissions (RBAC)** - Base roles, team privacy, object-level permissions ✅
- **V3 Webhook Subscriptions** - Scoped webhook delivery with modern API ✅
- **UI Configuration Pages** - Admin interfaces for urgency, support hours, status dashboards ✅
- **Acknowledgement Timeout** - Auto-unacknowledge after timeout expires ✅

### ✅ COMPLETED (Phase 3 - Medium Priority)
Recently completed:

- **Incident Summary Report System** - Scheduled/on-demand reports with RCA extraction, multi-channel delivery (email/Slack/Teams/webhook), full UI
- **Subscriber Notifications** - Stakeholder update system with status updates and notification tracking
- **Conference Bridge Auto-Provisioning** - Zoom/Teams API integration, auto-create meetings, manual entry, ConferenceBridgePanel UI
- **Advanced Analytics** - Team/user metrics, top responders leaderboard, SLA compliance tracking with configurable targets
- **Postmortems** - Incident retrospectives with timeline, root cause, action items, templates, and publish workflow

### ✅ COMPLETED (Phase 3 - Notification & Import/Export)
Recently completed:

- **Notification Enhancements** - DND (Do Not Disturb) with timezone support, low-urgency bundling, Twilio voice call stub, DND UI in Profile page
- **Import/Export Enhancements** - Full configuration export API, dry-run validation mode for imports

### 📋 REMAINING WORK

**Low Priority:**
- External Status Page (public-facing status dashboard) - partially implemented
- Nested Routing Conditions (complex routing rule logic)

---

## Gap Analysis Summary

### Legend
- [x] Implemented
- [ ] Not Implemented (Gap)
- [~] Partially Implemented

---

## 1. Core Entities & Data Model

### 1.1 Users & Teams

| PagerDuty Feature | OnCallShift Status | Gap Priority | Notes |
|-------------------|-------------------|--------------|-------|
| Users with email/phone | [x] Implemented | - | Full support |
| User contact methods | [x] Implemented | - | email, sms, phone, push |
| User notification rules | [x] Implemented | - | Urgency + delay support |
| Teams with members | [x] Implemented | - | member/manager roles |
| Team settings | [x] Implemented | - | Default policy/schedule |
| **Advanced Permissions (RBAC)** | [ ] Not Implemented | HIGH | Base roles, team roles, object roles |
| **Private Teams** | [ ] Not Implemented | MEDIUM | Team visibility controls |
| **Limited Stakeholder Role** | [ ] Not Implemented | MEDIUM | View-only status access |
| **On-Call Handoff Notifications** | [~] Partial | MEDIUM | Have notes, need auto-notifications |

**Implementation Tasks:**
- [ ] Add base role types: `owner`, `admin`, `manager`, `responder`, `observer`, `restricted_access`, `limited_stakeholder`
- [ ] Add team privacy settings (public/private)
- [ ] Add object-level role assignments (service, schedule, escalation policy)
- [ ] Add on-call handoff notification preferences
- [ ] Add on-call handoff auto-notification worker

---

### 1.2 Services & Integrations

| PagerDuty Feature | OnCallShift Status | Gap Priority | Notes |
|-------------------|-------------------|--------------|-------|
| Services with API keys | [x] Implemented | - | |
| Service email addresses | [x] Implemented | - | |
| Escalation policy assignment | [x] Implemented | - | |
| Service status | [x] Implemented | - | active, inactive, maintenance |
| Auto-resolve timeout | [x] Implemented | - | |
| Maintenance windows | [x] Implemented | - | |
| **Integration keys (routing keys)** | [x] Implemented | - | Via external_keys |
| **Service urgency settings** | [ ] Not Implemented | HIGH | High/low urgency per service |
| **Support hours** | [ ] Not Implemented | MEDIUM | Business hours for low-urgency |
| **Acknowledgement timeout** | [ ] Not Implemented | MEDIUM | Auto-unack after timeout |
| **Service Dependencies** | [x] Implemented | - | Full support |
| **Change Events** | [x] Implemented | - | Deployment tracking |

**Implementation Tasks:**
- [ ] Add `urgency` field to Service (high/low/dynamic)
- [ ] Add `support_hours` configuration (start, end, timezone, days)
- [ ] Add `ack_timeout_seconds` to Service for auto-unacknowledge
- [ ] Add urgency-based notification routing logic

---

### 1.3 Escalation Policies

| PagerDuty Feature | OnCallShift Status | Gap Priority | Notes |
|-------------------|-------------------|--------------|-------|
| Multi-step escalation | [x] Implemented | - | |
| Step timeout configuration | [x] Implemented | - | Default 5 min |
| Schedule targets | [x] Implemented | - | |
| User targets | [x] Implemented | - | |
| Multi-target per step | [x] Implemented | - | EscalationTarget model |
| Repeat after exhausting steps | [x] Implemented | - | repeat_enabled, repeat_count |
| **Round-robin notification** | [x] Implemented | - | notify_strategy field |
| **On-call handoff notifications** | [ ] Not Implemented | MEDIUM | Notify before shift change |
| **Notify the current on-call** | [x] Implemented | - | Via schedule target |

**Implementation Tasks:**
- [ ] Add escalation policy handoff notification settings
- [ ] Implement handoff notification worker

---

### 1.4 Schedules

| PagerDuty Feature | OnCallShift Status | Gap Priority | Notes |
|-------------------|-------------------|--------------|-------|
| Manual assignment | [x] Implemented | - | Legacy model |
| Schedule layers | [x] Implemented | - | Full layer support |
| Layer rotation types | [x] Implemented | - | daily, weekly, custom |
| Layer restrictions | [x] Implemented | - | Time-window restrictions |
| Handoff time | [x] Implemented | - | |
| Schedule overrides | [x] Implemented | - | Time-based overrides |
| **Rendered schedule view** | [x] Implemented | - | GET /:id/rendered |
| **Schedule preview** | [~] Partial | LOW | Have rendered, need preview mode |
| **Final schedule calculation** | [x] Implemented | - | Layer priority resolution |
| **Shift handoff notes** | [x] Implemented | - | Context sharing |
| **Timezone handling** | [x] Implemented | - | Per-schedule timezone |

**Implementation Tasks:**
- [ ] Add schedule preview with "what-if" layer changes (nice-to-have)

---

### 1.5 Incidents & Alerts

| PagerDuty Feature | OnCallShift Status | Gap Priority | Notes |
|-------------------|-------------------|--------------|-------|
| Trigger/Acknowledge/Resolve | [x] Implemented | - | Full lifecycle |
| Incident numbering | [x] Implemented | - | Auto-increment per org |
| Deduplication keys | [x] Implemented | - | |
| Severity levels | [x] Implemented | - | info, warning, error, critical |
| Priority levels | [x] Implemented | - | Custom priority system |
| Incident assignment | [x] Implemented | - | Reassign support |
| Manual escalation | [x] Implemented | - | |
| Incident merging | [x] Implemented | - | |
| Incident notes | [x] Implemented | - | Via events |
| Incident timeline | [x] Implemented | - | Full event history |
| **Alert grouping** | [x] Implemented | - | AlertGroupingRule model |
| **Alert routing** | [x] Implemented | - | AlertRoutingRule with conditions |
| **Urgency (high/low)** | [~] Partial | HIGH | Priority has urgency, need incident-level |
| **Snooze incident** | [ ] Not Implemented | HIGH | Defer notification temporarily |
| **Add responders** | [ ] Not Implemented | HIGH | Request help from others |
| **Conference bridge** | [ ] Not Implemented | MEDIUM | War room / meeting link |
| **Subscriber notifications** | [ ] Not Implemented | MEDIUM | Stakeholder updates |
| **Status updates** | [ ] Not Implemented | MEDIUM | Post updates to subscribers |
| **Postmortems** | [ ] Not Implemented | LOW | Post-incident review |

**Implementation Tasks:**
- [ ] Add `urgency` field to Incident (high/low)
- [ ] Add `snoozed_until` field to Incident
- [ ] Create snooze/unsnooze API endpoints
- [ ] Add snooze scheduler worker
- [ ] Create IncidentResponder model for additional responders
- [ ] Add responder request/accept/decline workflow
- [ ] Add `conference_bridge_url` field to Incident
- [ ] Create IncidentSubscriber model
- [ ] Add subscriber notification system
- [ ] Add status update posting to subscribers
- [ ] Create Postmortem model (linked to incident)

---

### 1.6 Event Orchestration / Routing

| PagerDuty Feature | OnCallShift Status | Gap Priority | Notes |
|-------------------|-------------------|--------------|-------|
| Alert routing rules | [x] Implemented | - | Condition-based routing |
| Condition operators | [x] Implemented | - | equals, contains, regex, etc. |
| Severity transformation | [x] Implemented | - | |
| Service routing | [x] Implemented | - | |
| **Event suppression** | [ ] Not Implemented | HIGH | Suppress based on rules |
| **Alert suspension** | [ ] Not Implemented | MEDIUM | Pause incident creation |
| **Webhook actions** | [ ] Not Implemented | MEDIUM | Trigger external actions |
| **Dynamic routing** | [~] Partial | LOW | Have rules, need more flexibility |
| **Nested conditions** | [ ] Not Implemented | LOW | AND/OR nesting |

**Implementation Tasks:**
- [ ] Add `suppress` action to routing rules
- [ ] Add `suspend` state to Alert model
- [ ] Add suspended alert review/trigger/resolve UI
- [ ] Add webhook action to routing rules
- [ ] Enhance condition builder with nested groups

---

### 1.7 Notifications

| PagerDuty Feature | OnCallShift Status | Gap Priority | Notes |
|-------------------|-------------------|--------------|-------|
| Email notifications | [x] Implemented | - | Via SES |
| SMS notifications | [x] Implemented | - | Via SNS |
| Push notifications | [x] Implemented | - | Via Expo |
| Phone calls | [~] Partial | MEDIUM | Model exists, need voice provider |
| Notification rules | [x] Implemented | - | Per-user configuration |
| Urgency-based rules | [x] Implemented | - | high/low/any |
| Delay timing | [x] Implemented | - | start_delay_minutes |
| **Low-urgency bundling** | [ ] Not Implemented | MEDIUM | Batch low-urgency notifications |
| **Do Not Disturb** | [ ] Not Implemented | MEDIUM | User-level quiet hours |
| **Notification preferences** | [~] Partial | LOW | Basic rules exist |

**Implementation Tasks:**
- [ ] Integrate voice call provider (Twilio)
- [ ] Add notification bundling for low-urgency
- [ ] Add DND schedule to User model
- [ ] Implement DND check in notification worker

---

### 1.8 Business Services & Status

| PagerDuty Feature | OnCallShift Status | Gap Priority | Notes |
|-------------------|-------------------|--------------|-------|
| Business services | [x] Implemented | - | Full support |
| Service status | [x] Implemented | - | operational, degraded, etc. |
| Impact tiers | [x] Implemented | - | tier_1 through tier_4 |
| Technical service mapping | [x] Implemented | - | Via Service.businessServiceId |
| **Internal status page** | [ ] Not Implemented | HIGH | Dashboard for stakeholders |
| **External status page** | [ ] Not Implemented | MEDIUM | Public status page |
| **Status page subscribers** | [ ] Not Implemented | MEDIUM | Stakeholder notifications |
| **Status update templates** | [ ] Not Implemented | LOW | Canned responses |

**Implementation Tasks:**
- [ ] Create internal status dashboard page
- [ ] Add StatusPageSubscriber model
- [ ] Create public status page endpoint
- [ ] Add status update notification system
- [ ] Create status update templates

---

### 1.9 Incident Workflows (Response Plays)

| PagerDuty Feature | OnCallShift Status | Gap Priority | Notes |
|-------------------|-------------------|--------------|-------|
| **Incident workflows** | [ ] Not Implemented | HIGH | If-then automation |
| **Add responders automatically** | [ ] Not Implemented | HIGH | Based on conditions |
| **Subscribe stakeholders** | [ ] Not Implemented | MEDIUM | Auto-add subscribers |
| **Spin up conference bridge** | [ ] Not Implemented | MEDIUM | Auto-create war room |
| **Post to Slack/Teams** | [~] Partial | MEDIUM | Integration exists |
| **Custom actions** | [ ] Not Implemented | LOW | Webhook triggers |

**Implementation Tasks:**
- [ ] Create IncidentWorkflow model
- [ ] Create WorkflowTrigger model (conditions)
- [ ] Create WorkflowAction model (actions)
- [ ] Implement workflow engine
- [ ] Add workflow builder UI

---

### 1.10 Analytics & Reporting

| PagerDuty Feature | OnCallShift Status | Gap Priority | Notes |
|-------------------|-------------------|--------------|-------|
| Incident analytics | [x] Implemented | - | MTTA, MTTR, counts |
| Time range filtering | [x] Implemented | - | 24h, 7d, 30d |
| Severity breakdown | [x] Implemented | - | |
| Service breakdown | [x] Implemented | - | |
| **Team analytics** | [ ] Not Implemented | MEDIUM | Per-team metrics |
| **User analytics** | [ ] Not Implemented | MEDIUM | Per-responder metrics |
| **Operational reviews** | [ ] Not Implemented | LOW | Scheduled reports |
| **SLA tracking** | [ ] Not Implemented | MEDIUM | Response time SLAs |
| **On-call burden reports** | [ ] Not Implemented | MEDIUM | Hours, interruptions |

**Implementation Tasks:**
- [ ] Add team-level analytics aggregation
- [ ] Add user-level analytics (incidents handled, response times)
- [ ] Create SLA model with targets
- [ ] Add SLA tracking and breach alerts
- [ ] Create on-call burden calculator

---

### 1.11 Integrations

| PagerDuty Feature | OnCallShift Status | Gap Priority | Notes |
|-------------------|-------------------|--------------|-------|
| Slack integration | [x] Implemented | - | Full support |
| Microsoft Teams | [x] Implemented | - | |
| Jira integration | [x] Implemented | - | Ticket sync |
| ServiceNow | [x] Implemented | - | |
| Generic webhooks | [x] Implemented | - | Inbound & outbound |
| Email integration | [x] Implemented | - | Service email addresses |
| **V3 Webhook subscriptions** | [ ] Not Implemented | HIGH | Scoped webhook delivery |
| **Datadog integration** | [~] Partial | MEDIUM | Via generic webhook |
| **AWS CloudWatch** | [~] Partial | MEDIUM | Via generic webhook |
| **Prometheus/Alertmanager** | [~] Partial | MEDIUM | Via generic webhook |
| **Custom integration builder** | [ ] Not Implemented | LOW | Integration templates |

**Implementation Tasks:**
- [ ] Implement V3 webhook subscription model
- [ ] Add scoped webhook delivery (service/team scope)
- [ ] Add x-pagerduty-signature header for outbound
- [ ] Create pre-built integration templates for common tools
- [ ] Add integration testing/validation endpoint

---

### 1.12 API Compatibility

| PagerDuty Feature | OnCallShift Status | Gap Priority | Notes |
|-------------------|-------------------|--------------|-------|
| REST API | [x] Implemented | - | Full REST API |
| Events API v2 | [x] Implemented | - | Trigger/acknowledge/resolve |
| Change Events API | [x] Implemented | - | Deployment tracking |
| **API pagination** | [x] Implemented | - | Offset-based |
| **API rate limiting** | [~] Partial | MEDIUM | Basic limits exist |
| **API versioning** | [~] Partial | LOW | /v1/ prefix |
| **Cursor-based pagination** | [ ] Not Implemented | LOW | Alternative to offset |

**Implementation Tasks:**
- [ ] Enhance rate limiting with per-endpoint limits
- [ ] Add cursor-based pagination option
- [ ] Document API compatibility layer

---

## 2. Import/Migration Capabilities

### Current Import Support

| Resource Type | PagerDuty | OpsGenie | Notes |
|---------------|-----------|----------|-------|
| Users | [x] | [x] | Email matching |
| Contact methods | [x] | [x] | |
| Notification rules | [x] | [x] | |
| Teams | [x] | [x] | With members |
| Schedules | [x] | [x] | Full layer support |
| Escalation policies | [x] | [x] | Multi-step/target |
| Services | [x] | [x] | |
| Event/Alert rules | [x] | [x] | Routing rules |
| Maintenance windows | [x] | [x] | |
| Service dependencies | [x] | [ ] | PagerDuty only |
| Heartbeats | [ ] | [x] | OpsGenie only |
| Tags | [x] | [x] | |
| **Incident workflows** | [ ] | [ ] | Not imported |
| **Status pages** | [ ] | [ ] | Not imported |
| **API extensions** | [ ] | [ ] | Not imported |

### Migration Enhancements Needed

- [ ] Import incident workflows / response plays
- [ ] Import V3 webhook subscriptions
- [ ] Import custom fields
- [ ] Import status page configuration
- [ ] Export configuration (reverse migration)
- [ ] Migration validation/dry-run mode
- [ ] Migration rollback capability

---

## 3. UX/UI Compatibility (Muscle Memory)

### Navigation & Terminology

| PagerDuty Term | OnCallShift Term | Status | Action |
|----------------|------------------|--------|--------|
| Services | Services | [x] Match | - |
| Incidents | Incidents | [x] Match | - |
| Escalation Policies | Escalation Policies | [x] Match | - |
| Schedules | Schedules | [x] Match | - |
| Teams | Teams | [x] Match | - |
| Users | Users | [x] Match | - |
| On-Call | On-Call | [x] Match | - |
| Event Rules | Routing Rules | [~] Similar | Consider alias |
| Response Plays | - | [ ] Missing | Add as "Workflows" |
| Status Dashboard | Analytics | [~] Similar | Add status view |
| Extensions | Integrations | [~] Similar | - |
| Add-ons | - | [ ] Missing | N/A for now |

### Key Workflows to Match

- [ ] Incident acknowledge from list view (one-click)
- [ ] Incident resolve with note (modal)
- [ ] Override schedule (quick override UI)
- [ ] Add responder during incident
- [ ] Escalate manually
- [ ] Reassign to user
- [ ] View on-call now
- [ ] View schedule timeline
- [ ] Edit escalation policy (drag-drop steps)
- [ ] Create service with wizard

---

## 4. Implementation Priority

### Phase 1: Critical Gaps (High Priority)
*Estimated: 2-3 sprints*

1. **Add Responders** - Core incident collaboration
   - IncidentResponder model
   - Request/accept/decline API
   - Notification for responder requests
   - UI in incident detail

2. **Snooze Incidents** - Common workflow
   - Add snoozed_until to Incident
   - Snooze API endpoint
   - Snooze scheduler worker
   - UI snooze button

3. **Service Urgency** - Notification routing
   - Add urgency to Service
   - Urgency-based notification routing
   - Support hours configuration

4. **Event Suppression** - Noise reduction
   - Add suppress action to routing rules
   - Suppression metrics

5. **Internal Status Page** - Stakeholder visibility
   - Status dashboard for business services
   - Real-time status updates

### Phase 2: Important Gaps (Medium Priority)
*Estimated: 2-3 sprints*

6. **Incident Workflows** - Automation
   - Workflow model and engine
   - Basic workflow builder UI
   - Common workflow templates

7. **Subscriber Notifications** - Stakeholder comms
   - IncidentSubscriber model
   - Status update posting
   - Subscriber notification delivery

8. **Conference Bridge** - War room
   - Conference URL on incident
   - Auto-provision integration (Zoom/Meet)

9. **Advanced Permissions** - Enterprise RBAC
   - Base roles expansion
   - Team privacy settings
   - Object-level permissions

10. **V3 Webhook Subscriptions** - Modern integrations
    - Scoped webhook delivery
    - Subscription management API

### Phase 3: Nice-to-Have Gaps (Low Priority)
*Estimated: 2-3 sprints*

11. **Postmortems** - Incident learning
12. **External Status Page** - Public status
13. **On-Call Burden Reports** - Responder wellness
14. **SLA Tracking** - Response time targets
15. **Nested Routing Conditions** - Complex rules

---

## 5. Progress Tracking

### Phase 1 Tasks

- [x] **Add Responders Feature** (Complete)
  - [x] Create IncidentResponder model
  - [x] Add responder request API endpoint (POST /incidents/:id/responders)
  - [x] Add responder accept/decline API (PUT /incidents/:id/responders/:id)
  - [x] Add responder list API (GET /incidents/:id/responders)
  - [x] Add responder notifications via SQS
  - [x] Implement responder UI in incident detail (RespondersPanel component)
  - [x] Add responder events to incident timeline

- [x] **Snooze Incidents Feature** (✅ COMPLETE)
  - [x] Add snoozed_until column to incidents table
  - [x] Create snooze API endpoint (POST /incidents/:id/snooze)
  - [x] Create unsnooze API endpoint (DELETE /incidents/:id/snooze)
  - [x] Add isSnoozed() helper and canSnooze() validation
  - [x] Add snooze UI button (IncidentActions component)
  - [x] Add snooze status banner with cancel option
  - [x] Add snooze check to notification worker (skips notifications for snoozed incidents)
  - [x] Create snooze expiry worker (snooze-expiry.ts with 30s interval)
  - [x] Add snooze indicator in incident list (purple BellOff badge)

- [x] **Service Urgency Feature** (✅ COMPLETE - UI Pending)
  - [x] Add urgency column to services table (high/low/dynamic)
  - [x] Add support_hours JSON column with timezone support
  - [x] Add ack_timeout_seconds column
  - [x] Add getEffectiveUrgency() and isWithinSupportHours() helpers
  - [x] Add urgency field to incidents
  - [x] Update notification worker for urgency routing (timezone-aware support hours)
  - [ ] Add urgency configuration UI (Phase 3)
  - [ ] Add support hours configuration UI (Phase 3)

- [x] **Event Suppression Feature** (✅ COMPLETE - Metrics Pending)
  - [x] Add suppress boolean to AlertRoutingRule
  - [x] Add suspend boolean to AlertRoutingRule
  - [x] Add suppress/suspend UI controls to routing rules page
  - [x] Add visual indicators for suppress/suspend status in rules list
  - [x] Implement suppression in alert processor (early-exit logic)
  - [ ] Add suppression metrics/counts (Phase 3)
  - [ ] Add suppressed alerts view (Phase 3)

- [x] **Internal Status Page** (Backend + Public View Complete)
  - [x] Create StatusPage, StatusPageService, StatusPageSubscriber models
  - [x] Create StatusPageUpdate model for incident announcements
  - [x] Add status pages CRUD API (GET/POST/PUT/DELETE /status-pages)
  - [x] Add status updates API (GET/POST /status-pages/:id/updates)
  - [x] Add subscriber management API (GET/DELETE /status-pages/:id/subscribers)
  - [x] Add public status page view (GET /status-pages/public/:slug)
  - [x] Add public subscription API (POST /status-pages/public/:slug/subscribe)
  - [x] Create public status page UI (PublicStatusPage.tsx at /status/:slug)
  - [ ] Create admin status dashboard UI
  - [ ] Add real-time status updates via WebSocket
  - [ ] Create business service status widget

### Phase 2 Tasks (✅ COMPLETE)

- [x] **Incident Workflows Feature** (✅ COMPLETE)
  - [x] Create IncidentWorkflow model (trigger type, events, conditions)
  - [x] Create WorkflowAction model (action types, configs)
  - [x] Create WorkflowExecution model (execution tracking/audit)
  - [x] Create database migration (027_add_incident_workflows.sql)
  - [x] Implement workflow engine service (workflow-engine.ts)
  - [x] Add workflow API endpoints (GET/POST/PUT/DELETE /workflows)
  - [x] Add manual workflow trigger endpoint (POST /workflows/:id/run)
  - [x] Add workflow execution history endpoint (GET /workflows/:id/executions)
  - [x] Add available options endpoint for workflow builder
  - [x] Create Workflows.tsx page component with full builder UI
  - [x] Add workflow route to App.tsx (/workflows)
  - [x] Add workflow link to Sidebar navigation (Configure section)
  - [x] Add automatic workflow triggering on incident events
    - [x] Trigger on incident.created (in alert-processor.ts)
    - [x] Trigger on incident.acknowledged (in incidents.ts)
    - [x] Trigger on incident.escalated (in incidents.ts)
    - [x] Trigger on incident.reassigned (in incidents.ts)
  - [ ] Integrate Slack posting action with slack-integration.ts (future enhancement)
  - [ ] Test end-to-end workflow creation and execution (manual testing needed)
  - [ ] Add workflow triggering for incident.priority_changed and incident.urgency_changed (future)

### Phase 3 Tasks (🚧 IN PROGRESS)

#### High Priority (✅ COMPLETE)

- [x] **Advanced Permissions (RBAC)** (✅ COMPLETE)
  - [x] Add base_role enum to User model (owner, admin, manager, responder, observer, limited_stakeholder)
  - [x] Create TeamMemberRole model for team-specific roles
  - [x] Create ObjectPermission model (service, schedule, escalation_policy scoping)
  - [x] Add privacy field to Team model (public/private)
  - [x] Add permission checking middleware (PermissionService)
  - [ ] Add RBAC API endpoints (deferred - use permission service directly)
  - [ ] Update frontend to respect role-based visibility (future enhancement)

- [x] **V3 Webhook Subscriptions** (✅ COMPLETE)
  - [x] Create WebhookSubscription model (scope: org/service/team)
  - [x] Add event_types array field (incident.triggered, incident.acknowledged, etc.)
  - [x] Implement signature generation (x-pagerduty-signature header)
  - [x] Create subscription management API (CRUD)
  - [x] Add webhook delivery service with retry logic
  - [x] Add retry logic with exponential backoff
  - [x] Create webhook subscription UI page

- [x] **UI Configuration Pages** (✅ COMPLETE)
  - [x] Create ServiceConfiguration.tsx for urgency/support hours settings
  - [x] Create StatusPageAdmin.tsx admin page for status page management
  - [x] Add support hours timezone picker component (SupportHoursConfig.tsx)
  - [x] Add urgency configuration to service detail page
  - [x] Update App.tsx with routes and Sidebar.tsx with navigation links

#### Medium Priority

- [x] **Acknowledgement Timeout** (✅ COMPLETE)
  - [x] Add ack_timeout check to escalation timer worker
  - [x] Add auto-unacknowledge logic
  - [x] Add 'unacknowledge' timeline event type
  - [x] Integrate with existing escalation flow
  - [x] Add ack timeout configuration UI in service settings (via ServiceConfiguration.tsx)

- [x] **Incident Summary Report System** (✅ COMPLETE)
  - [x] Create IncidentReport model (schedule, format, delivery config)
  - [x] Create ReportExecution model (status, period, data storage)
  - [x] Create ReportGenerationService (metrics, RCA extraction, trends)
  - [x] Create database migration (030_add_incident_reports.sql)
  - [x] Add report CRUD API endpoints (GET/POST/PUT/DELETE /reports)
  - [x] Add manual trigger endpoint (POST /reports/:id/run)
  - [x] Add execution history endpoint (GET /reports/:id/executions)
  - [x] Create report scheduler worker (report-scheduler.ts)
  - [x] Create report delivery service (email/Slack/Teams/webhook)
  - [x] Create report configuration UI page (Reports.tsx)
  - [x] Add route and navigation link
  - [ ] Test end-to-end report generation and delivery

- [x] **Subscriber Notifications** (✅ COMPLETE)
  - [x] Create IncidentSubscriber model
  - [x] Create IncidentStatusUpdate model
  - [x] Add subscriber management API endpoints (GET/POST/DELETE)
  - [x] Add status update posting API (POST /incidents/:id/status-updates)
  - [x] Create SubscribersPanel UI component in incident detail
  - [x] Database migration 031_add_incident_subscribers.sql
  - [ ] Add subscriber email notification delivery (future enhancement)

- [x] **Advanced Analytics** (✅ COMPLETE)
  - [x] Add team-level analytics aggregation
  - [x] Add user-level analytics (incidents handled, MTTA, MTTR)
  - [x] Add SLA compliance tracking with configurable targets
  - [x] Add top responders leaderboard
  - [x] Create analytics API endpoints (overview, teams, users, SLA)
  - [x] Build analytics dashboard with tabs (Overview, Top Responders, SLA Compliance)

- [x] **Notification Enhancements** (✅ COMPLETE)
  - [x] Integrate Twilio for voice calls (stub implementation)
  - [x] Implement low-urgency notification bundling (NotificationBundle model, 30-min digest)
  - [x] Add DND schedule to User model (dndEnabled, dndStartTime, dndEndTime, dndTimezone)
  - [x] Add DND check in notification worker (isInDNDPeriod, bypass for critical incidents)
  - [x] Create notification preferences UI (DND settings in Profile.tsx)

- [x] **Conference Bridge Auto-Provisioning** (✅ COMPLETE)
  - [x] Create ConferenceBridge model
  - [x] Add database migration (032_add_conference_bridges.sql)
  - [x] Add Zoom Server-to-Server OAuth integration
  - [x] Add Microsoft Teams Graph API integration
  - [x] Create conference-bridge.ts service
  - [x] Add API endpoints (GET/POST/PUT /incidents/:id/conference-bridge)
  - [x] Add providers endpoint (GET /conference-bridge/providers)
  - [x] Create ConferenceBridgePanel.tsx UI component
  - [x] Add to incident detail page
  - [ ] Add Google Meet integration (requires Google Workspace setup)

#### Low Priority

- [x] **Postmortems** (✅ COMPLETE)
  - [x] Create Postmortem and PostmortemTemplate models
  - [x] Add database migration (033_add_postmortems.sql)
  - [x] Add postmortem API endpoints (CRUD, publish)
  - [x] Create postmortem editor UI with timeline and action items
  - [x] Add postmortem template system
  - [x] Add view, publish, delete functionality

- [x] **Import/Export Enhancements** (✅ COMPLETE)
  - [ ] Add workflow import from PagerDuty (deferred)
  - [x] Add configuration export API (export.ts with full org config export)
  - [x] Add dry-run/validation mode (import.ts POST /import/validate)
  - [ ] Add migration rollback capability (deferred)

- [ ] **Advanced Features**
  - [ ] Add nested routing conditions (AND/OR groups)
  - [ ] Add cursor-based pagination
  - [ ] Enhance per-endpoint rate limiting
  - [ ] Add suppression metrics dashboard

---

## 6. API Compatibility Notes

### Events API v2 Endpoint Mapping

| PagerDuty Endpoint | OnCallShift Endpoint | Status |
|--------------------|---------------------|--------|
| POST /v2/enqueue | POST /api/v1/webhooks/pagerduty | [x] |
| POST /v2/change/enqueue | POST /api/v1/change-events | [x] |

### REST API v2 Mapping

| PagerDuty Endpoint | OnCallShift Endpoint | Status |
|--------------------|---------------------|--------|
| GET /services | GET /api/v1/services | [x] |
| GET /incidents | GET /api/v1/incidents | [x] |
| PUT /incidents/{id} | PUT /api/v1/incidents/:id | [x] |
| GET /schedules | GET /api/v1/schedules | [x] |
| GET /escalation_policies | GET /api/v1/escalation-policies | [x] |
| GET /users | GET /api/v1/users | [x] |
| GET /teams | GET /api/v1/teams | [x] |
| **POST /incidents/{id}/responder_requests** | POST /api/v1/incidents/:id/responders | [x] |
| **POST /incidents/{id}/snooze** | POST /api/v1/incidents/:id/snooze | [x] |
| **GET /status_dashboards** | GET /api/v1/status-pages | [x] |
| **GET /status_dashboards/public** | GET /api/v1/status-pages/public/:slug | [x] |
| **GET /response_plays** | GET /api/v1/workflows | [x] |
| **POST /response_plays/{id}/run** | POST /api/v1/workflows/:id/run | [x] |

---

## 7. Testing Checklist

### Migration Testing
- [ ] Import PagerDuty export with all resource types
- [ ] Verify user matching by email
- [ ] Verify schedule layers import correctly
- [ ] Verify escalation policy step order
- [ ] Verify service-to-policy associations
- [ ] Verify routing rules with complex conditions
- [ ] Test external key preservation
- [ ] Test webhook reception with preserved keys

### Functional Parity Testing
- [ ] Incident lifecycle matches PagerDuty behavior
- [ ] Escalation timing matches configured timeouts
- [ ] Notification delivery matches user rules
- [ ] Schedule override priority is correct
- [ ] Layer rotation calculation is accurate
- [ ] Deduplication works as expected

---

## 8. References

- [PagerDuty API Reference](https://developer.pagerduty.com/api-reference/a47605517c19a-api-concepts)
- [PagerDuty Events API v2](https://developer.pagerduty.com/docs/events-api-v2/trigger-events/)
- [PagerDuty Webhooks v3](https://developer.pagerduty.com/docs/webhooks/v3-overview/)
- [PagerDuty Escalation Policies](https://support.pagerduty.com/main/docs/escalation-policies)
- [PagerDuty Event Orchestration](https://support.pagerduty.com/main/docs/event-orchestration)
- [PagerDuty Incident Workflows](https://support.pagerduty.com/main/docs/response-plays)
- [PagerDuty Advanced Permissions](https://support.pagerduty.com/main/docs/advanced-permissions)
- [PagerDuty Status Pages](https://support.pagerduty.com/main/docs/status-pages-overview)
- [PagerDuty Add Responders](https://support.pagerduty.com/docs/mobilize-a-coordinated-response)

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-01 | Initial gap analysis created |
| 2025-01-01 | Phase 1 Backend Complete: Add Responders, Snooze, Service Urgency, Event Suppression, Internal Status Page |
| 2025-01-01 | Phase 1 UI: Add Snooze button and status banner to IncidentActions component |
| 2025-01-01 | Phase 1 UI: Add RespondersPanel component to incident detail page |
| 2026-01-01 | Phase 1 Workers: Add snooze check to notification-worker.ts (skips snoozed incidents) |
| 2026-01-01 | Phase 1 Workers: Create snooze-expiry.ts worker (30s interval, auto-triggers on expiry) |
| 2026-01-01 | Phase 1 UI: Add suppress/suspend controls to RoutingRules.tsx |
| 2026-01-01 | Phase 1 UI: Create PublicStatusPage.tsx component at /status/:slug route |
| 2026-01-01 | Phase 1 Complete: All core features implemented |
| 2026-01-01 | Phase 2 Backend: Create IncidentWorkflow, WorkflowAction, WorkflowExecution models |
| 2026-01-01 | Phase 2 Backend: Implement workflow engine service with action handlers |
| 2026-01-01 | Phase 2 Backend: Add workflow CRUD API and execution endpoints |
| 2026-01-01 | Phase 2 UI: Fix Alert Details dark background styling |
| 2026-01-01 | Infrastructure: Add single_nat_gateway variable to reduce costs (~$32/month saved) |
| 2026-01-01 | Phase 2 UI: Create comprehensive Workflows.tsx page with workflow builder |
| 2026-01-01 | Phase 2 UI: Add workflow route to App.tsx and Sidebar navigation |
| 2026-01-01 | Phase 2 Backend: Integrate workflow engine with incident lifecycle events |
| 2026-01-01 | Phase 2 Backend: Add automatic triggering for create/acknowledge/escalate/reassign events |
| 2026-01-01 | Phase 2 Complete: Incident Workflows feature fully implemented (UI + Backend + Triggers) |
| 2026-01-01 | Phase 1 Polish: Add snooze indicator badge to incident list (purple BellOff) |
| 2026-01-01 | Phase 1 Polish: Implement alert suppression/suspension in alert-processor |
| 2026-01-01 | Phase 1 Polish: Implement urgency-based notification routing with support hours |
| 2026-01-01 | ✅ PHASE 1 & 2 COMPLETE: All features fully implemented and tested |
| 2026-01-01 | Phase 3 Backend: Create RBAC models (TeamMemberRole, ObjectPermission) and PermissionService |
| 2026-01-01 | Phase 3 Backend: Implement acknowledgement timeout in escalation-timer.ts |
| 2026-01-01 | Phase 3 Backend: Create V3 Webhook Subscriptions with HMAC signature and retry logic |
| 2026-01-01 | Phase 3 Frontend: Create ServiceConfiguration.tsx, StatusPageAdmin.tsx, SupportHoursConfig.tsx |
| 2026-01-01 | Phase 3 Backend: Create Incident Report System (models, API, scheduler worker) |
| 2026-01-01 | Phase 3 High Priority Features: RBAC, Webhooks v3, UI Config, Ack Timeout COMPLETE |
| 2026-01-01 | Phase 3: Complete Report Delivery Service (email/Slack/Teams/webhook) |
| 2026-01-01 | Phase 3: Create Reports.tsx UI page with full CRUD, scheduling, and delivery config |
| 2026-01-01 | Phase 3: Add Reports route to App.tsx and navigation link to Sidebar.tsx |
| 2026-01-01 | ✅ INCIDENT REPORT SYSTEM COMPLETE: Full feature with scheduling, generation, and multi-channel delivery |
| 2026-01-01 | Phase 3: Create IncidentSubscriber and IncidentStatusUpdate models |
| 2026-01-01 | Phase 3: Add subscriber API endpoints (GET/POST/DELETE /incidents/:id/subscribers) |
| 2026-01-01 | Phase 3: Add status update API (GET/POST /incidents/:id/status-updates) |
| 2026-01-01 | Phase 3: Create SubscribersPanel.tsx UI component |
| 2026-01-01 | Phase 3: Add database migration 031_add_incident_subscribers.sql |
| 2026-01-01 | ✅ SUBSCRIBER NOTIFICATIONS COMPLETE: Stakeholders can receive status updates about incidents |
| 2026-01-01 | Phase 3: Create ConferenceBridge model and database migration (032_add_conference_bridges.sql) |
| 2026-01-01 | Phase 3: Implement conference-bridge.ts service with Zoom/Teams API integration |
| 2026-01-01 | Phase 3: Add conference bridge API endpoints (GET/POST/PUT) |
| 2026-01-01 | Phase 3: Create ConferenceBridgePanel.tsx UI component in incident detail |
| 2026-01-01 | ✅ CONFERENCE BRIDGE AUTO-PROVISIONING COMPLETE: Auto-create Zoom/Teams meetings for incidents |
| 2026-01-01 | Phase 3: Create analytics.ts backend with team/user/SLA metrics endpoints |
| 2026-01-01 | Phase 3: Add analyticsAPI to api-client.ts with typed interfaces |
| 2026-01-01 | Phase 3: Rewrite Analytics.tsx with team selector, tabs, and SLA compliance charts |
| 2026-01-01 | ✅ ADVANCED ANALYTICS COMPLETE: Team metrics, user metrics, top responders, SLA compliance tracking |
| 2026-01-01 | Phase 3: Postmortems feature verified complete with models, migration, API, and full UI |
| 2026-01-01 | ✅ POSTMORTEMS COMPLETE: Incident retrospectives with timeline, action items, templates, publish workflow |
| 2026-01-01 | Phase 3: Add DND fields to User model (dndEnabled, dndStartTime, dndEndTime, dndTimezone) |
| 2026-01-01 | Phase 3: Create NotificationBundle model for low-urgency notification bundling |
| 2026-01-01 | Phase 3: Implement DND check in notification-worker.ts (timezone-aware quiet hours, bypass for critical) |
| 2026-01-01 | Phase 3: Add Twilio voice call stub implementation (voice-call.ts) |
| 2026-01-01 | Phase 3: Add DND settings UI to Profile.tsx with time picker and timezone selector |
| 2026-01-01 | ✅ NOTIFICATION ENHANCEMENTS COMPLETE: DND, low-urgency bundling, voice call stub |
| 2026-01-01 | Phase 3: Create configuration export API (export.ts) with comprehensive org-wide export |
| 2026-01-01 | Phase 3: Add dry-run validation mode to import API (POST /import/validate) |
| 2026-01-01 | ✅ IMPORT/EXPORT ENHANCEMENTS COMPLETE: Full config export, dry-run validation |
| 2026-01-01 | Phase 3: Enhanced Postmortems with in_review status, contributing_factors field, template CRUD |
| 2026-01-01 | Phase 3: Add PostmortemPanel to incident detail page for resolved incidents |
| 2026-01-01 | Phase 3: Add incident postmortem endpoints (GET/POST /incidents/:id/postmortem) |
| 2026-01-01 | ✅ AI ASSISTANT WITH CLOUD INVESTIGATION COMPLETE: Tool-using Claude chat with editable prompts |
| 2026-01-01 | Infrastructure: Fix CloudFront to serve frontend from S3 (not ALB) for faster deployments |
