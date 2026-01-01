# OnCallShift: Value & Simplicity Optimization Roadmap
## A Senior Product+UX+Ops Analysis

*Version 1.0 | December 2025*

---

## Understanding of the Application

Based on comprehensive codebase analysis, here's my understanding of OnCallShift:

- **Target users**: SREs, DevOps engineers, and on-call responders at small-to-medium SaaS companies (5-100 person engineering teams)
- **Core value proposition**: PagerDuty-quality incident management at 87-90% lower cost (~$58/month vs $500+/month)
- **Key differentiators**: AI-powered diagnosis (Claude), generous free tier, mobile-first design, guided setup wizard
- **Current state**: Feature-complete platform with 20+ screens (web + mobile), multi-channel notifications, escalation policies, runbooks, and integrations
- **Constraints**: Must stay simple for small teams; avoid enterprise complexity; maintain low infrastructure costs

---

## A. Problem & Workflow Mapping

### The Incident Lifecycle for Small Teams

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INCIDENT LIFECYCLE MAPPING                               │
├─────────────────────────────────────────────────────────────────────────────┤

1. DETECTION
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ User Goal: Know immediately when something breaks                       │
   │                                                                         │
   │ Primary Pains (Small Teams):                                           │
   │ • Alert fatigue from noisy monitoring tools                            │
   │ • False positives interrupt sleep/focus unnecessarily                  │
   │ • Multiple monitoring tools = fragmented alerting                      │
   │ • "Did anyone else get this alert?" uncertainty                        │
   │                                                                         │
   │ Where OnCallShift Helps:                                               │
   │ ✓ Unified webhook ingestion from multiple sources                      │
   │ ✓ Deduplication via dedup_key                                          │
   │ ✓ Multi-channel notifications (push, email, SMS)                       │
   │ ✓ Escalation ensures someone responds                                  │
   │                                                                         │
   │ Gaps/Weaknesses:                                                       │
   │ ✗ No intelligent alert grouping (related alerts = separate incidents) │
   │ ✗ No flapping/noise detection                                          │
   │ ✗ No "quiet hours" or notification preferences                        │
   │ ✗ No acknowledgment from notification (must open app)                 │
   │ ✗ Delivery status not surfaced until you dig into incident           │
   └─────────────────────────────────────────────────────────────────────────┘

2. TRIAGE & ASSESSMENT
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ User Goal: Quickly understand severity and decide what to do           │
   │                                                                         │
   │ Primary Pains (Small Teams):                                           │
   │ • Wake up disoriented, need context FAST                               │
   │ • "Is this real or a false alarm?" takes too long to determine        │
   │ • Unclear who else knows / who should be looped in                    │
   │ • Don't know if this happened before or how it was fixed              │
   │                                                                         │
   │ Where OnCallShift Helps:                                               │
   │ ✓ Incident detail page with alert payload                              │
   │ ✓ AI Diagnosis can analyze CloudWatch logs                             │
   │ ✓ Runbooks attached to services                                        │
   │ ✓ Severity levels (info/warning/error/critical)                        │
   │                                                                         │
   │ Gaps/Weaknesses:                                                       │
   │ ✗ No "similar incidents" surfaced proactively (exists but hidden)     │
   │ ✗ AI diagnosis requires manual trigger, not automatic                 │
   │ ✗ No quick "false alarm" dismissal path                               │
   │ ✗ Alert payload often requires scrolling/expanding to see             │
   │ ✗ No service health context ("this service has been flaky lately")   │
   └─────────────────────────────────────────────────────────────────────────┘

3. COLLABORATION & COMMUNICATION
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ User Goal: Get the right people involved, keep stakeholders informed   │
   │                                                                         │
   │ Primary Pains (Small Teams):                                           │
   │ • "Should I wake up the CTO for this?"                                 │
   │ • Manually updating Slack channels is tedious                          │
   │ • No shared context - each person starts from zero                    │
   │ • War room coordination is ad-hoc                                      │
   │                                                                         │
   │ Where OnCallShift Helps:                                               │
   │ ✓ Escalation policies define who to page next                          │
   │ ✓ Slack integration for channel notifications                          │
   │ ✓ Add Note feature for timeline comments                               │
   │ ✓ Manual reassign to bring in specific people                         │
   │                                                                         │
   │ Gaps/Weaknesses:                                                       │
   │ ✗ No Slack interactive buttons (acknowledge from Slack)               │
   │ ✗ No templated status updates ("Here's what we know so far...")       │
   │ ✗ No stakeholder notification tier (different from responders)        │
   │ ✗ No shared incident channel creation                                 │
   │ ✗ No "who's online/available" visibility                              │
   └─────────────────────────────────────────────────────────────────────────┘

4. MITIGATION & RESOLUTION
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ User Goal: Fix the problem and confirm it's fixed                      │
   │                                                                         │
   │ Primary Pains (Small Teams):                                           │
   │ • Forgetting steps under pressure                                      │
   │ • "Did I try that already?" - losing track of what's been attempted  │
   │ • Not knowing if the fix actually worked                              │
   │ • Premature resolution → incident comes back                          │
   │                                                                         │
   │ Where OnCallShift Helps:                                               │
   │ ✓ Runbooks with step-by-step procedures                                │
   │ ✓ AI chat for guided troubleshooting                                   │
   │ ✓ Timeline captures all actions taken                                  │
   │ ✓ Resolution notes field                                               │
   │                                                                         │
   │ Gaps/Weaknesses:                                                       │
   │ ✗ Runbook steps aren't tracked (checked off) during incident          │
   │ ✗ No "confirm resolution" verification step                           │
   │ ✗ No automatic re-open if same alert fires again soon                 │
   │ ✗ No time tracking (how long in each state)                           │
   │ ✗ Resolution note is optional and often skipped                       │
   └─────────────────────────────────────────────────────────────────────────┘

5. POST-INCIDENT REVIEW / LEARNING
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ User Goal: Learn from the incident, prevent recurrence                 │
   │                                                                         │
   │ Primary Pains (Small Teams):                                           │
   │ • Postmortems are time-consuming to write                             │
   │ • Knowledge gets lost - "we fixed this before, how?"                  │
   │ • Action items from postmortems never get done                        │
   │ • Hard to see patterns across incidents                               │
   │                                                                         │
   │ Where OnCallShift Helps:                                               │
   │ ✓ Full timeline/audit trail preserved                                  │
   │ ✓ AI can generate incident summaries                                   │
   │ ✓ Related incidents component exists                                   │
   │                                                                         │
   │ Gaps/Weaknesses:                                                       │
   │ ✗ No postmortem template or workflow                                  │
   │ ✗ No action item tracking (follow-ups get lost)                       │
   │ ✗ No incident tagging for pattern analysis                            │
   │ ✗ Similar incidents not prominently surfaced                          │
   │ ✗ No "lessons learned" database                                       │
   └─────────────────────────────────────────────────────────────────────────┘

6. PREVENTION / FOLLOW-UP ACTIONS
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ User Goal: Make sure this doesn't happen again                         │
   │                                                                         │
   │ Primary Pains (Small Teams):                                           │
   │ • Follow-up tickets get deprioritized                                 │
   │ • No visibility into repeat incidents                                 │
   │ • Runbooks become stale, nobody updates them                          │
   │ • On-call person doesn't know what changed since last shift           │
   │                                                                         │
   │ Where OnCallShift Helps:                                               │
   │ ✓ Runbooks can be updated based on learnings                           │
   │ ✓ Service-level organization                                           │
   │                                                                         │
   │ Gaps/Weaknesses:                                                       │
   │ ✗ No action item / follow-up tracking                                 │
   │ ✗ No "this incident type has happened X times" alert                  │
   │ ✗ No shift handoff notes                                              │
   │ ✗ No runbook staleness detection                                      │
   │ ✗ No integration with ticketing (Jira) for follow-ups                │
   └─────────────────────────────────────────────────────────────────────────┘
```

---

## B. Value and Simplicity Opportunities (Prioritized)

### Top 10 High-Leverage Improvements

---

#### 1. One-Click Acknowledge from Notifications

| Attribute | Details |
|-----------|---------|
| **Type** | UX simplification, automation |
| **Why it matters** | Currently, users must: receive notification → open app → find incident → click acknowledge. At 3am, this is 30+ seconds of friction. Competitors allow acknowledging directly from push notification or SMS reply. |
| **What it looks like** | Push notification has "Acknowledge" action button. SMS includes "Reply ACK to acknowledge." Email has one-click acknowledge link. Slack message has interactive buttons. |
| **Complexity** | Medium |
| **Impact** | High |
| **Implementation hints** | - Add push notification actions (iOS/Android support this natively via Expo) - Create `/api/v1/incidents/:id/quick-ack` endpoint with token-based auth - SMS: Parse inbound SMS replies via Twilio/SNS - Slack: Enable interactive components in Slack app |

---

#### 2. Smart Incident Grouping / Correlation

| Attribute | Details |
|-----------|---------|
| **Type** | Automation, noise reduction |
| **Why it matters** | When a service fails, monitoring tools often fire 5-10 related alerts. Currently each becomes a separate incident, overwhelming the responder. PagerDuty's "Intelligent Alert Grouping" is a top-requested feature. |
| **What it looks like** | Alerts from the same service within 5 minutes are grouped into one incident. UI shows "3 related alerts" with expandable list. Single acknowledge covers all grouped alerts. |
| **Complexity** | Medium |
| **Impact** | High |
| **Implementation hints** | - Add `parentIncidentId` field to Incident model - Alert processor checks: same service + within time window → attach to existing incident - Don't need ML initially: time + service correlation is 80% of value - Show grouped alerts in incident detail with collapse/expand |

---

#### 3. Required Resolution Summary

| Attribute | Details |
|-----------|---------|
| **Type** | Opinionated constraint, workflow improvement |
| **Why it matters** | Resolution notes are currently optional and almost always skipped. This means no knowledge capture, postmortems start from scratch, and patterns can't be identified. |
| **What it looks like** | When clicking "Resolve," a modal requires: (1) What was the root cause? [dropdown + freetext], (2) How was it fixed? [freetext], (3) Follow-up needed? [yes/no + optional Jira link]. Can't resolve without filling minimum fields. |
| **Complexity** | Low |
| **Impact** | High |
| **Implementation hints** | - Add `rootCause`, `resolutionSummary`, `followUpRequired`, `followUpUrl` fields to Incident - Make the resolve modal a multi-step form - Provide common root cause dropdown: "Configuration change," "Deployment," "Capacity," "External dependency," "False alarm," "Unknown" - This data becomes gold for analytics and AI |

---

#### 4. Escalation Preview ("Who's Next")

| Attribute | Details |
|-----------|---------|
| **Type** | UX clarity, information architecture |
| **Why it matters** | During an incident, responders often wonder: "If I don't respond, who gets paged next and when?" Currently this requires navigating to the escalation policy page. |
| **What it looks like** | On incident detail page, prominent section shows: "Next escalation in 3m 24s → Sarah Chen (Engineering Manager)". Visual progress bar shows current step and remaining steps. |
| **Complexity** | Low |
| **Impact** | Medium |
| **Implementation hints** | - `EscalationStatusPanel` exists but could be more prominent - Add "who specifically" will be paged (resolve schedule → actual person) - Real-time countdown already implemented - Move this above the fold on incident detail |

---

#### 5. Incident Quick Actions Bar (Mobile-First)

| Attribute | Details |
|-----------|---------|
| **Type** | UX simplification |
| **Why it matters** | On mobile at 3am, every tap counts. Current flow requires scrolling to find action buttons. The most common actions (Acknowledge, Escalate, Add Note) should be instantly accessible. |
| **What it looks like** | Sticky bottom bar with 3-4 icon buttons: ✓ Ack, ↑ Escalate, 💬 Note, ✓ Resolve. One tap = action. Confirmation only for destructive actions. |
| **Complexity** | Low |
| **Impact** | Medium |
| **Implementation hints** | - Add fixed-position action bar to incident detail (web + mobile) - Use icon + short label - Ack/Resolve should be single-tap with brief toast confirmation - Escalate/Note can open quick modal |

---

#### 6. Auto-Generated Postmortem Draft

| Attribute | Details |
|-----------|---------|
| **Type** | Automation, insight |
| **Why it matters** | Postmortems are valuable but tedious. Most teams skip them for non-critical incidents. An auto-generated draft removes the blank page problem and captures knowledge while it's fresh. |
| **What it looks like** | When incident is resolved, option appears: "Generate Postmortem Draft." Clicking it creates a document with: Timeline (auto-populated), Impact summary, Root cause (from resolution), What went well, What could improve, Action items. All editable. |
| **Complexity** | Medium |
| **Impact** | High |
| **Implementation hints** | - Create Postmortem model (incidentId, content, status, createdBy) - Use Claude API to generate draft from: incident timeline, resolution notes, alert payload, duration - Template: standard blameless postmortem format - Store as markdown, allow editing - Later: share via link, export to Notion/Confluence |

---

#### 7. Service Health Context

| Attribute | Details |
|-----------|---------|
| **Type** | Insight, context |
| **Why it matters** | When an incident fires, responders lack context: "Is this service usually stable? How many incidents has it had this week?" This context helps with triage priority. |
| **What it looks like** | On incident detail, small badge/section shows: "payment-service: 3 incidents this week (↑ from 1 last week)" or "api-gateway: First incident in 30 days ✓". Color-coded health indicator. |
| **Complexity** | Low |
| **Impact** | Medium |
| **Implementation hints** | - Query: `SELECT COUNT(*) FROM incidents WHERE serviceId = ? AND createdAt > NOW() - 7 days` - Compare to previous 7 days for trend - Cache this per-service, update hourly - Display as compact badge on incident detail |

---

#### 8. Shift Handoff Notes

| Attribute | Details |
|-----------|---------|
| **Type** | Workflow improvement, collaboration |
| **Why it matters** | When on-call shifts change, context is lost. The outgoing person knows what's been flaky, what to watch for, what almost broke. Currently this knowledge stays in their head. |
| **What it looks like** | Before shift ends, prompt: "Leave a note for the next on-call?" Quick freetext field. When new on-call starts, they see: "Handoff from Alex: Watch the payment service, had some timeouts this morning. Also: deploy freeze until 5pm." |
| **Complexity** | Low |
| **Impact** | Medium |
| **Implementation hints** | - Create ShiftHandoff model (scheduleId, fromUserId, toUserId, notes, createdAt) - Trigger prompt: 30 min before shift ends (notification) - Show in dashboard for incoming on-call - Keep history of last 5 handoffs for context |

---

#### 9. False Alarm Fast Path

| Attribute | Details |
|-----------|---------|
| **Type** | UX simplification |
| **Why it matters** | Many alerts are false positives. Currently, handling a false alarm requires: Acknowledge → Resolve → (optionally) add note explaining it was false. This should be one action. |
| **What it looks like** | Prominent "False Alarm" button alongside Acknowledge. One click: marks as resolved, sets root cause to "False alarm," optionally prompts "Should we suppress similar alerts for 1 hour?" |
| **Complexity** | Low |
| **Impact** | Medium |
| **Implementation hints** | - Add "Dismiss as False Alarm" action button - Auto-sets: state=resolved, rootCause="false_alarm" - Creates timeline event: "Dismissed as false alarm by [user]" - Optional: "Snooze similar for [1h/4h/24h]" - Track false alarm rate per service for quality metrics |

---

#### 10. Proactive Similar Incident Surfacing

| Attribute | Details |
|-----------|---------|
| **Type** | Insight, automation |
| **Why it matters** | `RelatedIncidents` component exists but isn't prominently displayed. When an incident fires, the most valuable context is "how did we fix this last time?" |
| **What it looks like** | Above the fold on incident detail: "Similar incident 3 days ago (INC-1234) - Resolved by: Increased connection pool size. [View]" If no similar incidents: nothing shown (no noise). |
| **Complexity** | Medium |
| **Impact** | High |
| **Implementation hints** | - Match on: same service + similar title (Levenshtein distance or simple keyword match) - Pull resolution notes from matches - Display only if confident match (>70% similarity or same dedup_key pattern) - Show resolution summary inline, link to full incident - Later: use embeddings for smarter matching |

---

## C. "Simple but Magical" Enhancements

### 1. Auto-Suggested Severity

| Aspect | Details |
|--------|---------|
| **What it does** | When an incident is created, system suggests severity based on: service criticality, time of day, alert keywords, historical patterns |
| **Why it feels magical** | User doesn't have to think about severity classification - it's intelligently suggested. Reduces cognitive load at 3am. |
| **Minimal viable version** | - Parse alert title/description for keywords: "critical," "down," "outage" → suggest Critical - Check service tier (if configured): Tier 1 service → bump severity - Time-based: 2-6am → lower threshold for escalation - Display as pre-filled dropdown that user can override |
| **Implementation** | Add `suggestSeverity(alert)` function in alert processor. Use simple keyword matching + service metadata. No ML needed initially. |

---

### 2. Smart Runbook Suggestions

| Aspect | Details |
|--------|---------|
| **What it does** | When viewing an incident, system suggests the most relevant runbook even if not explicitly linked |
| **Why it feels magical** | "How did it know I needed the database failover runbook?" - Feels intelligent but is simple matching |
| **Minimal viable version** | - Match runbook titles/tags against: alert title, service name, severity - Score by keyword overlap - Show top match: "Suggested runbook: Database Connection Issues [View]" - If runbook is attached to service, always show that first |
| **Implementation** | Query runbooks, score by `(titleMatch * 3) + (tagMatch * 2) + (serviceMatch * 5)`. Show top scorer if score > threshold. |

---

### 3. One-Click Status Update Template

| Aspect | Details |
|--------|---------|
| **What it does** | Pre-written status update templates that can be sent to Slack/stakeholders with one click, auto-filled with incident details |
| **Why it feels magical** | Under pressure, writing coherent updates is hard. Templates that auto-fill with real data feel like having a communications assistant |
| **Minimal viable version** | Templates: - "Investigating": "We're aware of issues with {service}. Investigating now. ETA: Unknown." - "Identified": "Root cause identified for {service} issues. Working on fix. ETA: {input}" - "Resolved": "{service} issues have been resolved. Duration: {duration}. Root cause: {rootCause}" One-click sends to configured Slack channel |
| **Implementation** | Create StatusUpdate model with templates. Variable substitution from incident data. "Send Update" button on incident detail opens template selector. |

---

### 4. Automatic Incident Title Cleanup

| Aspect | Details |
|--------|---------|
| **What it does** | Monitoring tools often send ugly alert titles: "[FIRING:1] HighCPU - prod-web-01 (instance=i-abc123)". System auto-cleans to: "High CPU on prod-web-01" |
| **Why it feels magical** | Incidents are readable at a glance. No more parsing machine-generated titles |
| **Minimal viable version** | - Strip common prefixes: "[FIRING:1]", "[RESOLVED]", "Alert:", etc. - Convert to title case - Truncate instance IDs unless they're the only identifier - Store original as `rawTitle`, display cleaned `title` |
| **Implementation** | Add `cleanAlertTitle(rawTitle)` function with regex patterns. Apply during alert processing. Keep raw for debugging. |

---

### 5. "You're On-Call" Awareness Banner

| Aspect | Details |
|--------|---------|
| **What it does** | When user is currently on-call, persistent subtle banner: "You're on-call until 9am tomorrow. 0 open incidents." When NOT on-call and incidents exist: "Sarah is on-call. 2 open incidents." |
| **Why it feels magical** | Never wonder "Am I on-call right now?" Constant ambient awareness without being intrusive |
| **Minimal viable version** | - Query current on-call for user's schedules - Dashboard/header shows context-aware banner - Different states: on-call (green), not on-call (neutral), incidents pending (yellow) - Clicking goes to schedule or incident list |
| **Implementation** | Add `useOnCallStatus()` hook. Query schedules for current user. Display in Header component. Update on schedule change. |

---

## D. UX and Flow Cleanup

### Navigation Architecture

**Current problem:** 15+ sidebar items can overwhelm users. An on-call engineer under stress needs 3-4 things, not 15.

**Recommended structure:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RECOMMENDED NAVIGATION HIERARCHY                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PRIMARY NAV (Always visible, max 5 items)                                 │
│  ──────────────────────────────────────────                                 │
│  🏠 Dashboard        ← Landing page, current status                        │
│  🔔 Incidents        ← The core workflow                                   │
│  📅 On-Call          ← Schedules + who's on-call now                       │
│  📖 Runbooks         ← Quick access to procedures                          │
│  ⚙️ Settings         ← Everything else (expandable)                        │
│                                                                             │
│  SETTINGS SUBMENU (Collapsed by default)                                   │
│  ─────────────────────────────────────────                                  │
│  Services                                                                   │
│  Escalation Policies                                                        │
│  Integrations                                                               │
│  Routing Rules                                                              │
│  Teams                                                                      │
│  Users (admin only)                                                         │
│  Billing                                                                    │
│                                                                             │
│  REMOVED FROM PRIMARY NAV                                                   │
│  ────────────────────────                                                   │
│  Analytics → Move to Dashboard as tab/section                              │
│  Tags → Move to Settings                                                   │
│  Business Services → Move to Settings (advanced)                          │
│  Service Dependencies → Move to Settings (advanced)                       │
│  Availability → Move to On-Call submenu                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Incident Detail Page Redesign

**Current problem:** Important information requires scrolling. Actions are scattered.

**Recommended layout:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INCIDENT DETAIL PAGE LAYOUT                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ HEADER (Sticky)                                                     │   │
│  │ ← Back   INC-1234: Database connection timeout    [TRIGGERED] 🔴    │   │
│  │          payment-service • Critical • 12 minutes ago               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION BAR (Sticky, below header)                                   │   │
│  │ [✓ Acknowledge] [↑ Escalate] [💬 Add Note] [❌ False Alarm] [✓ Resolve] │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────┐ ┌────────────────────────────────────┐   │
│  │ LEFT COLUMN (60%)            │ │ RIGHT COLUMN (40%)                 │   │
│  │                              │ │                                    │   │
│  │ SIMILAR INCIDENT (if any)    │ │ OWNERSHIP & ESCALATION            │   │
│  │ ┌──────────────────────────┐ │ │ ┌────────────────────────────────┐ │   │
│  │ │ 💡 Similar: INC-1201     │ │ │ │ Owner: Alex Kim               │ │   │
│  │ │ Fixed by: Restarted DB   │ │ │ │ Escalation: Step 2 of 3       │ │   │
│  │ │ pool. [View]             │ │ │ │ Next: Sarah (3m 24s)          │ │   │
│  │ └──────────────────────────┘ │ │ │ ████████░░░░ [Escalate Now]   │ │   │
│  │                              │ │ └────────────────────────────────┘ │   │
│  │ WHAT'S HAPPENING            │ │                                    │   │
│  │ ┌──────────────────────────┐ │ │ SERVICE CONTEXT                   │   │
│  │ │ Alert: Connection pool   │ │ │ ┌────────────────────────────────┐ │   │
│  │ │ exhausted (max 100)      │ │ │ │ payment-service               │ │   │
│  │ │                          │ │ │ │ 3 incidents this week (↑)     │ │   │
│  │ │ Service: payment-service │ │ │ │ Last incident: 2 days ago     │ │   │
│  │ │ Host: prod-db-01         │ │ │ └────────────────────────────────┘ │   │
│  │ │                          │ │ │                                    │   │
│  │ │ [View Full Alert Data ▼] │ │ │ RUNBOOK                           │   │
│  │ └──────────────────────────┘ │ │ ┌────────────────────────────────┐ │   │
│  │                              │ │ │ 📖 Database Troubleshooting    │ │   │
│  │ TIMELINE                     │ │ │ Step 1: Check connection count │ │   │
│  │ ┌──────────────────────────┐ │ │ │ Step 2: Review slow queries   │ │   │
│  │ │ 10:34 Alert triggered    │ │ │ │ [Open Full Runbook]           │ │   │
│  │ │ 10:34 Alex notified      │ │ │ └────────────────────────────────┘ │   │
│  │ │ 10:35 Alex acknowledged  │ │ │                                    │   │
│  │ │ 10:36 Note: Checking DB  │ │ │ AI ASSISTANT                      │   │
│  │ │ ...                      │ │ │ ┌────────────────────────────────┐ │   │
│  │ └──────────────────────────┘ │ │ │ 🤖 [Ask AI about this incident]│ │   │
│  │                              │ │ └────────────────────────────────┘ │   │
│  └──────────────────────────────┘ └────────────────────────────────────┘   │
│                                                                             │
│  COLLAPSED SECTIONS (Below fold)                                           │
│  ───────────────────────────────                                            │
│  [▶ Full Alert Payload]                                                    │
│  [▶ Notification Delivery Status]                                          │
│  [▶ Related Incidents (3)]                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Defaults & Templates

**Principle:** Users should rarely start from a blank slate.

| Element | Current State | Recommended Default |
|---------|---------------|---------------------|
| **New Service** | All fields blank | Pre-fill with common patterns: name from URL slug, description template, default escalation policy |
| **New Escalation Policy** | Blank steps | Start with 2 steps pre-filled: (1) Primary on-call, 5 min, (2) Escalate to manager, 10 min |
| **New Schedule** | Blank rotation | Default to weekly rotation, Mon 9am handoff, prompt to add first member |
| **New Runbook** | Blank | Template with standard sections: Overview, Prerequisites, Steps, Rollback, Contacts |
| **Incident Note** | Empty text field | Quick templates: "Investigating...", "Root cause identified: ", "Escalating because: ", "Update: " |
| **Resolve Modal** | Optional freetext | Required fields with dropdown for common root causes |

### State Clarity Improvements

**Every screen should answer these questions instantly:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STATE CLARITY REQUIREMENTS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  QUESTION: Who owns this incident?                                         │
│  ─────────────────────────────────                                          │
│  Current: Assignee shown in detail page, easy to miss                      │
│  Improved: Avatar + name prominent in header, next to title                │
│            Color-coded: Green = acknowledged, Red = no response yet       │
│                                                                             │
│  QUESTION: What's the current status?                                      │
│  ────────────────────────────────────                                       │
│  Current: Status badge exists but small                                    │
│  Improved: Large status pill in header with color + icon                  │
│            [🔴 TRIGGERED] [🟡 ACKNOWLEDGED] [🟢 RESOLVED]                   │
│            Duration in status: "ACKNOWLEDGED (12 min)"                    │
│                                                                             │
│  QUESTION: What's the next action and when?                                │
│  ──────────────────────────────────────────                                 │
│  Current: Escalation countdown buried in panel                            │
│  Improved: If triggered: "Escalates to Sarah in 3:24" prominent           │
│            If acknowledged: "No pending escalation" or next steps hint    │
│            If resolved: "Resolved 5 min ago by Alex"                      │
│                                                                             │
│  QUESTION: Am I on-call right now?                                         │
│  ─────────────────────────────────                                          │
│  Current: Must check Schedules page                                        │
│  Improved: Header badge: "You're on-call" or avatar of who is            │
│            Dashboard card: "On-call: Alex Kim (you) until 9am"           │
│                                                                             │
│  QUESTION: Are there open incidents I should know about?                   │
│  ───────────────────────────────────────────────────────                    │
│  Current: Must navigate to Incidents page                                  │
│  Improved: Badge count on Incidents nav item                              │
│            Dashboard: "2 open incidents" card with severity breakdown     │
│            Browser tab title: "(2) OnCallShift" when incidents open       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## E. Metrics & Feedback Loops

### Core Metrics to Implement

---

#### 1. MTTA (Mean Time to Acknowledge)

| Aspect | Details |
|--------|---------|
| **Calculation** | `AVG(acknowledgedAt - createdAt)` for incidents acknowledged in period |
| **Where to display** | Dashboard summary card, weekly email digest, per-service breakdown |
| **Friction level** | Zero - already have timestamps |
| **How it drives improvement** | Teams see slow ack times → investigate: notification delivery issues? wrong person on-call? alert fatigue? |
| **Benchmarks to show** | "Your MTTA: 4.2 min. Industry benchmark: <5 min ✓" |

---

#### 2. MTTR (Mean Time to Resolve)

| Aspect | Details |
|--------|---------|
| **Calculation** | `AVG(resolvedAt - createdAt)` for incidents resolved in period |
| **Where to display** | Dashboard, per-service view, trend over time chart |
| **Friction level** | Zero - already have timestamps |
| **How it drives improvement** | High MTTR → runbooks need improvement? training needed? system too complex? |
| **Breakdown options** | By severity, by service, by time of day, by responder |

---

#### 3. Incident Volume by Service

| Aspect | Details |
|--------|---------|
| **Calculation** | `COUNT(*) GROUP BY serviceId` with time filtering |
| **Where to display** | Service health dashboard, weekly digest |
| **Friction level** | Zero - already tracked |
| **How it drives improvement** | High-volume services need attention: better monitoring thresholds? underlying issues? |
| **Visualization** | Bar chart sorted by volume, highlight services above threshold |

---

#### 4. On-Call Load Balance

| Aspect | Details |
|--------|---------|
| **Calculation** | Per user: incidents handled, pages received, hours on-call |
| **Where to display** | Team dashboard, manager view, weekly digest |
| **Friction level** | Low - requires aggregating across incidents and schedules |
| **How it drives improvement** | Uneven load → adjust schedules, prevent burnout |
| **Visualization** | "Alex: 12 incidents (40%), Sarah: 8 incidents (27%), Mike: 10 incidents (33%)" |

---

#### 5. False Alarm Rate

| Aspect | Details |
|--------|---------|
| **Calculation** | `COUNT(rootCause='false_alarm') / COUNT(*)` per service |
| **Where to display** | Service settings, weekly digest, alert quality score |
| **Friction level** | Requires #3 (Required Resolution Summary) to track root causes |
| **How it drives improvement** | High false alarm rate → tune alerting thresholds |
| **Target** | <10% false alarm rate per service |

---

#### 6. Repeat Incidents (No Follow-Up)

| Aspect | Details |
|--------|---------|
| **Calculation** | Same service + similar title + resolved without followUpRequired=true, recurring 3+ times in 30 days |
| **Where to display** | "Improvement Opportunities" dashboard section, weekly digest |
| **Friction level** | Requires #3 (Required Resolution Summary) |
| **How it drives improvement** | "payment-service had 5 connection timeout incidents this month with no follow-up action logged" → forces accountability |
| **Action** | Link to create follow-up ticket or schedule investigation |

---

#### 7. Escalation Rate

| Aspect | Details |
|--------|---------|
| **Calculation** | % of incidents that escalated past step 1 |
| **Where to display** | Dashboard, per-schedule breakdown |
| **Friction level** | Zero - already tracked in incident events |
| **How it drives improvement** | High escalation rate → primary on-call overwhelmed? training needed? wrong person assigned? |
| **Breakdown** | By schedule, by time of day, by service |

---

### Feedback Loop Implementation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FEEDBACK LOOP TOUCHPOINTS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  REAL-TIME (In-App)                                                        │
│  ──────────────────                                                         │
│  • Dashboard cards with current metrics                                    │
│  • Service health indicators on incident detail                           │
│  • "This is the 3rd timeout incident this week" inline warning            │
│  • "Similar incident resolved by restarting service" suggestion           │
│                                                                             │
│  DAILY (Ambient)                                                           │
│  ────────────────                                                           │
│  • Mobile app badge with open incident count                              │
│  • Browser tab title shows incident count                                 │
│  • Slack daily summary: "Yesterday: 3 incidents, MTTA 2.1min"            │
│                                                                             │
│  WEEKLY (Email Digest)                                                     │
│  ─────────────────────                                                      │
│  • Week in review email (opt-in)                                          │
│  • Metrics: MTTA, MTTR, volume, top services                              │
│  • Highlights: "MTTR improved 15% vs last week"                          │
│  • Action items: "3 repeat incidents with no follow-up"                  │
│  • On-call summary: who handled what                                      │
│                                                                             │
│  MONTHLY (Strategic)                                                       │
│  ───────────────────                                                        │
│  • Monthly report (PDF/email to managers)                                 │
│  • Trends over time                                                        │
│  • Service reliability scores                                              │
│  • Recommendations based on patterns                                      │
│                                                                             │
│  ON-DEMAND (Self-Service)                                                  │
│  ─────────────────────────                                                  │
│  • Analytics page with date range filtering                               │
│  • Export to CSV                                                           │
│  • Per-service deep dive                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## F. Differentiation & Positioning

### Positioning Angle 1: "The Simplest Incident Tool for Growing Teams"

**Core message:** "Incident management that doesn't require a dedicated SRE to configure. Set up in 15 minutes, not 15 hours."

**Features to lean into:**
- Setup wizard that gets teams running in one session
- Sensible defaults (escalation templates, runbook templates)
- Mobile-first design for on-the-go response
- Unified simple pricing (not per-feature confusion)
- "Opinionated simplicity" - fewer options, better outcomes

**What to intentionally avoid:**
- Complex event orchestration rules
- Enterprise SSO (initially)
- Customizable workflows that require training
- Analytics that need a data analyst to interpret

**Tagline options:**
- "On-call for humans, not enterprises"
- "Incident management that gets out of your way"
- "The PagerDuty alternative that respects your time"

---

### Positioning Angle 2: "AI-Powered Incident Response"

**Core message:** "The only incident tool with built-in AI that helps you diagnose and resolve faster—not just notify you."

**Features to lean into:**
- Claude-powered incident diagnosis
- Auto-generated postmortem drafts
- Smart runbook suggestions
- Similar incident matching with resolution hints
- AI chat for guided troubleshooting

**What to intentionally avoid:**
- Positioning AI as "magic" - be specific about what it does
- Overwhelming users with AI features they didn't ask for
- Requiring AI usage (make it opt-in enhancement)

**Tagline options:**
- "Your AI co-pilot for incident response"
- "Incident management that learns with you"
- "Fix faster with AI-assisted troubleshooting"

---

### Positioning Angle 3: "The 90% Cheaper PagerDuty"

**Core message:** "Enterprise-grade incident management at startup-friendly prices. Same reliability, 90% lower cost."

**Features to lean into:**
- Feature parity with PagerDuty's core offering
- Transparent, simple pricing
- Migration tools from PagerDuty/Opsgenie
- No hidden fees or per-feature charges
- Generous free tier for small teams

**What to intentionally avoid:**
- Competing on features with PagerDuty's enterprise tier
- Complex pricing that requires a sales call
- Lock-in tactics

**Tagline options:**
- "PagerDuty features, startup pricing"
- "Why pay more to get paged?"
- "Enterprise on-call. Startup price."

---

### Recommended Positioning

**Primary:** Angle 1 + Angle 3 combined

> **"The simplest, most affordable incident management for teams of 5-100. Set up in 15 minutes. 90% cheaper than PagerDuty."**

**Secondary differentiator:** AI features as "bonus" that competitors charge extra for

**Avoid:** Trying to out-feature PagerDuty on enterprise capabilities

---

## G. Stepwise Implementation Plan

### Phase 1: Quick Wins (2-3 weeks)

**Focus:** Low-effort, high-impact changes that improve daily experience

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | Required Resolution Summary (#3) | 3 days | High |
| 2 | Incident Quick Actions Bar (#5) | 2 days | Medium |
| 3 | False Alarm Fast Path (#9) | 1 day | Medium |
| 4 | Escalation Preview prominence (#4) | 1 day | Medium |
| 5 | Service Health Context badge (#7) | 2 days | Medium |
| 6 | Navigation simplification | 1 day | Medium |
| 7 | State clarity improvements (owner/status) | 2 days | Medium |

**Success criteria:**
- Resolution notes captured on 80%+ of incidents (up from ~10%)
- Mobile action time reduced by 50% (fewer taps to acknowledge)
- Users report knowing "who owns this" instantly

**Deliverables:**
- [ ] Resolve modal with required fields + root cause dropdown
- [ ] Sticky action bar on incident detail (web + mobile)
- [ ] "Dismiss as False Alarm" button
- [ ] "Next escalation" prominent in incident header
- [ ] Service incident count badge
- [ ] Simplified nav (5 primary items)
- [ ] Owner avatar + status duration in incident header

---

### Phase 2: Smart Context (3-4 weeks)

**Focus:** Surface the right information at the right time

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | Proactive Similar Incident Surfacing (#10) | 5 days | High |
| 2 | Smart Runbook Suggestions (C.2) | 3 days | Medium |
| 3 | Auto-Suggested Severity (C.1) | 2 days | Medium |
| 4 | Automatic Incident Title Cleanup (C.4) | 1 day | Low |
| 5 | "You're On-Call" Banner (C.5) | 2 days | Medium |
| 6 | Shift Handoff Notes (#8) | 3 days | Medium |

**Success criteria:**
- 30%+ of incidents show relevant similar incident
- Runbook attachment rate increases (more runbooks actually used)
- On-call awareness questions eliminated ("Am I on call?")

**Deliverables:**
- [ ] Similar incident matching algorithm + prominent display
- [ ] Runbook suggestion based on alert content
- [ ] Severity pre-filled based on keywords + service tier
- [ ] Clean incident titles (strip monitoring tool cruft)
- [ ] Header on-call status indicator
- [ ] Handoff notes prompt + display for incoming on-call

---

### Phase 3: Automation & Intelligence (4-5 weeks)

**Focus:** Reduce manual work, leverage AI

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | One-Click Acknowledge from Notifications (#1) | 7 days | High |
| 2 | Smart Incident Grouping (#2) | 7 days | High |
| 3 | Auto-Generated Postmortem Draft (#6) | 5 days | High |
| 4 | One-Click Status Update Templates (C.3) | 3 days | Medium |
| 5 | Slack Interactive Buttons | 4 days | Medium |

**Success criteria:**
- MTTA reduced by 30%+ (faster acknowledgment)
- Incident volume reduced by 20%+ (grouping related alerts)
- Postmortem creation rate increases 3x

**Deliverables:**
- [ ] Push notification acknowledge action
- [ ] SMS reply acknowledgment
- [ ] Slack interactive buttons (Ack/Resolve)
- [ ] Alert grouping by service + time window
- [ ] Postmortem model + Claude-powered draft generation
- [ ] Status update templates with variable substitution

---

### Phase 4: Analytics & Learning (3-4 weeks)

**Focus:** Close the feedback loop, enable continuous improvement

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | Metrics Dashboard | 5 days | High |
| 2 | Weekly Email Digest | 3 days | Medium |
| 3 | Repeat Incident Detection + Alerts | 3 days | High |
| 4 | On-Call Load Balancing Report | 2 days | Medium |
| 5 | Service Reliability Scores | 3 days | Medium |

**Success criteria:**
- Teams can answer "how are we doing?" without manual analysis
- Repeat incidents identified and surfaced proactively
- On-call fairness visible and actionable

**Deliverables:**
- [ ] Analytics page with MTTA, MTTR, volume charts
- [ ] Date range filtering + per-service breakdown
- [ ] Automated weekly digest email
- [ ] "Repeat incidents without follow-up" dashboard section
- [ ] Per-person incident load visualization
- [ ] Service health score (incidents, false alarm rate, MTTR)

---

## Implementation Tracking Checklist

### Phase 1: Quick Wins
- [ ] Required Resolution Summary modal
- [ ] Incident Quick Actions Bar (sticky)
- [ ] False Alarm dismissal button
- [ ] Escalation Preview in header
- [ ] Service Health Context badge
- [ ] Navigation simplification
- [ ] State clarity (owner avatar, status duration)

### Phase 2: Smart Context
- [ ] Similar Incident matching + display
- [ ] Smart Runbook suggestions
- [ ] Auto-suggested severity
- [ ] Incident title cleanup
- [ ] On-Call awareness banner
- [ ] Shift Handoff Notes

### Phase 3: Automation & Intelligence
- [ ] Push notification acknowledge action
- [ ] SMS reply acknowledgment
- [ ] Slack interactive buttons
- [ ] Alert grouping (parent/child incidents)
- [ ] Auto-generated postmortem drafts
- [ ] Status update templates

### Phase 4: Analytics & Learning
- [ ] Metrics dashboard (MTTA, MTTR, volume)
- [ ] Weekly email digest
- [ ] Repeat incident detection
- [ ] On-call load report
- [ ] Service reliability scores

---

## Appendix: Database Schema Additions

```sql
-- Phase 1: Resolution tracking
ALTER TABLE incidents ADD COLUMN root_cause VARCHAR(50);
ALTER TABLE incidents ADD COLUMN resolution_summary TEXT;
ALTER TABLE incidents ADD COLUMN follow_up_required BOOLEAN DEFAULT false;
ALTER TABLE incidents ADD COLUMN follow_up_url VARCHAR(500);

-- Phase 2: Handoff notes
CREATE TABLE shift_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id),
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 3: Alert grouping
ALTER TABLE incidents ADD COLUMN parent_incident_id UUID REFERENCES incidents(id);
ALTER TABLE incidents ADD COLUMN grouped_alert_count INTEGER DEFAULT 1;

-- Phase 3: Postmortems
CREATE TABLE postmortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft', -- draft, published
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 3: Status update templates
CREATE TABLE status_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name VARCHAR(100) NOT NULL,
  template TEXT NOT NULL,
  status_type VARCHAR(20), -- investigating, identified, resolved
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  template_id UUID REFERENCES status_templates(id),
  content TEXT NOT NULL,
  channel VARCHAR(50), -- slack, status_page, email
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_by UUID REFERENCES users(id)
);
```

---

## Summary

This roadmap prioritizes **leverage over comprehensiveness**. The recommended changes:

1. **Phase 1** removes friction from daily workflows (acknowledging, resolving, understanding state)
2. **Phase 2** makes the app feel "smart" by surfacing context proactively
3. **Phase 3** automates repetitive tasks and reduces alert noise
4. **Phase 4** closes the learning loop so teams continuously improve

The unifying principle: **an on-call engineer at 3am should be able to understand and resolve an incident with the minimum possible cognitive load.**

Every feature should either:
- Remove a click/decision
- Surface information that would otherwise require navigation
- Automate something currently manual
- Prevent a mistake before it happens

If a feature doesn't do one of these things, question whether it belongs in the product.

---

*Document generated as strategic roadmap for OnCallShift product development.*
