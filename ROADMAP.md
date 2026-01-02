# OnCallShift Roadmap

**Last Updated:** January 2025

This document tracks remaining work for the OnCallShift incident management platform, prioritized based on DevOps engineer focus group feedback.

---

## Current State: Feature-Complete Production Platform

OnCallShift is deployed at https://oncallshift.com with comprehensive functionality:

### Completed Features

| Feature | Status |
|---------|--------|
| **Mobile App** | 32 React Native screens (incidents, schedules, settings, analytics, AI chat) |
| **Escalation Timer** | Automatic step advancement with configurable timeouts |
| **Multi-Channel Notifications** | Push, Email, SMS with delivery tracking |
| **User Actions** | Acknowledge, Resolve, Reassign, Snooze, Manual Escalate |
| **Runbooks** | Full CRUD with one-click action execution |
| **AI Diagnosis** | Claude-powered incident analysis and chat |
| **Setup Wizard** | Web and mobile onboarding flow |
| **Notification Status Panel** | Per-user delivery status tracking |
| **Audit Trail** | Comprehensive incident event logging |
| **CI/CD Pipeline** | GitHub Actions with Terraform approval workflow |

---

## Focus Group Insights Summary

Based on feedback from 5 DevOps engineer personas representing startups, mid-market, and enterprise:

### Adoption Blockers (Must Fix)
1. **Security hardening** - API key hashing, webhook signatures (fails vendor security reviews)
2. **SSO/SAML** - Non-negotiable for enterprise and regulated industries
3. **HIPAA/BAA** - Blocks healthcare adoption entirely

### High-Value Differentiators
1. **AI Integration** - Strong differentiator, needs guardrails and transparency
2. **Runbooks with AI Execution** - High value, especially for smaller teams
3. **Tag-Based Service Mapping** - Critical for discoverability at scale
4. **Mobile Reliability** - Notification delivery is the #1 priority

### Key Themes
- **Small teams** want simplicity and low maintenance
- **Mid-market** wants reliability and integrations (Slack, Datadog)
- **Enterprise** needs compliance, RBAC, and noise reduction at scale

---

## Remaining Work

### Phase 1: Production Hardening & Security (2-3 weeks)

> **Focus Group Priority: P0 - Adoption Blockers**
> "API keys being stored unhashed would fail our vendor security assessment immediately." - Derek (Fintech)

#### 1.1 Security Improvements

| Task | Priority | Status | Focus Group Driver |
|------|----------|--------|-------------------|
| API key hashing (bcrypt) | P0 | Not started | Blocks enterprise vendor reviews |
| Webhook signatures (HMAC-SHA256) | P0 | Not started | Security assessment requirement |
| Secrets Manager full integration | P1 | Partial | Compliance requirement |
| Rate limiting enforcement | P1 | Not started | Prevents abuse |

#### 1.2 Testing (Current Coverage: ~0%)

Priority tests needed:
- Escalation timer logic (timeout calculation, step advancement)
- Alert deduplication
- Notification delivery
- Incident state transitions
- API authentication/authorization

**Target:** 80% coverage on critical paths

#### 1.3 Reliability Improvements

| Task | Priority | Status |
|------|----------|--------|
| Retry logic with exponential backoff | P1 | Partial |
| Transaction boundaries | P1 | Partial |
| Graceful shutdown | P2 | Not started |
| Circuit breakers | P2 | Not started |

---

### Phase 2: AI Integration Enhancements (3-4 weeks)

> **Focus Group Priority: High - Key Differentiator**
> "At 3am, half-awake, having AI pull the relevant logs and say 'here's what likely happened' is huge." - Maya (Startup SRE)
> "AI as advisory tool is valuable. Need confidence indicators and data transparency." - All personas

#### 2.1 AI Trust & Transparency

| Feature | Description | Priority |
|---------|-------------|----------|
| **Confidence scores** | Display AI confidence level (high/medium/low) on all suggestions | P1 |
| **Data flow transparency** | Show exactly what data was sent to Claude in each request | P1 |
| **AI audit trail** | Log all AI interactions: request, response, user action taken | P1 |
| **"AI-generated" labels** | Clear visual indicator on all AI suggestions | P1 |

#### 2.2 AI Configuration & Control

| Feature | Description | Priority |
|---------|-------------|----------|
| **Org-provided API keys** | Let organizations use their own Anthropic API key | Done |
| **Per-service AI toggle** | Disable AI features for sensitive services (PCI, PHI) | P1 |
| **AI cost visibility** | Show estimated Claude API cost per incident | P2 |
| **Response time SLA** | AI diagnosis must complete in <5 seconds | P1 |

#### 2.3 AI Intelligence Improvements

| Feature | Description | Priority |
|---------|-------------|----------|
| **Feedback loop** | Thumbs up/down on AI suggestions, learn from outcomes | P1 |
| **Architecture context** | Allow orgs to describe their architecture for context-aware AI | P2 |
| **Multi-source log fetching** | Expand beyond CloudWatch to Datadog, New Relic, Splunk | P2 |
| **Similar incident learning** | Improve similar incident detection with resolution outcomes | P2 |

#### 2.4 Compliance & Privacy

| Feature | Description | Priority |
|---------|-------------|----------|
| **PII redaction** | Auto-redact sensitive patterns before sending to AI | P1 |
| **Data retention docs** | Document data flow to Anthropic, retention policies | P1 |
| **BAA consideration** | Evaluate Anthropic BAA for healthcare customers | P2 |

---

### Phase 3: Runbook Enhancements (3-4 weeks)

> **Focus Group Priority: High - Operational Essential**
> "Runbooks that actually get used during incidents instead of rotting in Confluence? Yes please." - Maya
> "Junior engineers can execute complex procedures with AI guidance and guardrails." - Derek

#### 3.1 Runbook Discovery & Context

| Feature | Description | Priority |
|---------|-------------|----------|
| **One-click from incident** | Recommended runbooks shown on incident detail, one click to execute | P1 |
| **Runbook health indicator** | Show last executed, success rate, last updated date | P1 |
| **Full-text search** | Search across runbook titles, steps, and content | P1 |
| **Recently used** | Show recently used runbooks for quick access | P2 |

#### 3.2 Runbook Authoring

| Feature | Description | Priority |
|---------|-------------|----------|
| **Parameterized templates** | Variables in runbooks (${service_name}, ${time_window}) | P1 |
| **Version history** | Track all changes, view previous versions | P1 |
| **Ownership assignment** | Each runbook has an owner team | P1 |
| **Import from markdown** | Import existing runbooks from markdown/Confluence | P2 |
| **Rich formatting** | Code blocks, warnings, images in steps | P2 |

#### 3.3 AI-Assisted Execution

| Feature | Description | Priority |
|---------|-------------|----------|
| **Step-level permissions** | Mark steps as "AI can auto-execute" vs "requires human approval" | P1 |
| **Approval gates** | Configurable approval required before destructive steps | P1 |
| **Execution audit trail** | Full log of each step: who, when, output, duration | P1 |
| **AI command explanation** | AI explains what each command does before execution | P2 |
| **Rollback capability** | Define rollback steps, trigger if execution fails | P2 |

#### 3.4 Runbook Governance (Enterprise)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Approval workflow** | Runbook changes require review before publishing | P2 |
| **Role-based access** | Some runbooks restricted to certain roles | P2 |
| **Dependency tracking** | Flag runbooks that reference changed runbooks | P3 |
| **Usage analytics** | Which runbooks used most, where do people abandon | P3 |

---

### Phase 4: Tag-Based Service Mapping (2-3 weeks)

> **Focus Group Priority: High - Critical for Discoverability**
> "Context-aware runbook suggestions are the difference between 'here are your 200 runbooks' and 'here are the 3 relevant ones.'" - Maya

#### 4.1 Core Tagging System

| Feature | Description | Priority |
|---------|-------------|----------|
| **Service auto-tagging** | Auto-create tags from service names | P1 |
| **Multi-dimensional tags** | Support tag categories: service, symptom, environment, team | P1 |
| **Tag autocomplete** | Suggest existing tags when creating/editing | P1 |
| **Runbook-to-service mapping** | Associate runbooks with services via shared tags | P1 |

#### 4.2 Smart Tag Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Tag hierarchy/wildcards** | `payments` matches `payments-api`, `payments-gateway` | P2 |
| **ML-suggested tags** | After runbook execution, suggest tags based on incident attributes | P2 |
| **Incident-based suggestions** | Alert with service=X and symptom=Y shows matching runbooks | P1 |
| **Tag inheritance** | Child services inherit parent service tags | P3 |

#### 4.3 Tag Governance (Enterprise)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Controlled vocabulary** | Admin-defined tag taxonomy, prevent duplicates | P2 |
| **Mandatory tags** | Require minimum tags before publishing runbook | P2 |
| **Tag analytics** | Unused tags, near-duplicate detection, cleanup tools | P3 |
| **Service catalog sync** | Sync tags with external service catalog | P3 |

---

### Phase 5: Mobile Trust & Reliability (3-4 weeks)

> **Focus Group Priority: P0 - Core Value Proposition**
> "If the notification doesn't arrive, nothing else matters." - Marcus (Healthcare)
> "Mobile is essential for initial response, laptop is for resolution." - Priya

#### 5.1 Notification Reliability (CRITICAL)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Notification SLA monitoring** | Track and report time from alert to notification delivery | P0 |
| **Notification fallback chain** | Push → SMS → Voice with configurable delays | P1 |
| **Delivery confirmation** | Verify push was actually delivered, not just sent | P1 |
| **Repeat notifications** | Re-page at intervals until acknowledged | P1 |
| **Sound customization** | Different sounds for critical vs warning | P2 |

#### 5.2 Mobile Quick Actions

| Feature | Description | Priority |
|---------|-------------|----------|
| **iOS/Android widgets** | Home screen widget showing on-call status and open incidents | P1 |
| **Quick snooze** | Snooze from notification without opening app | P1 |
| **Acknowledge and handoff** | Ack + signal that laptop access needed for remediation | P2 |
| **Apple Watch / WearOS** | View alert severity, ack from wrist | P3 |

#### 5.3 Mobile Security

| Feature | Description | Priority |
|---------|-------------|----------|
| **Biometric auth required** | FaceID/TouchID before app access (configurable) | P1 |
| **Biometric for sensitive ops** | Additional auth before runbook execution | P1 |
| **Session timeout** | Auto-logout after configurable inactivity | P1 |
| **Confirmation dialogs** | "Are you sure?" for destructive actions | P1 |
| **Jailbreak detection** | Warn or block on compromised devices | P2 |

#### 5.4 Mobile UX Improvements

| Feature | Description | Priority |
|---------|-------------|----------|
| **Offline mode** | Cache schedules and recent incidents for offline viewing | P2 |
| **Escalation countdown** | "Will escalate to manager in 5 minutes" visible | P1 |
| **Voice-to-text notes** | Add incident notes via voice | P3 |
| **Read-only mode** | User-selectable mode to prevent accidental actions | P2 |

#### 5.5 Mobile AI Integration

> **Focus Group Insight:** Mobile AI should reduce cognitive load at 3am, not add to it.
> "Give me the information to decide. Don't make me think harder than necessary." - Maya
> "AI can advise humans. AI cannot act as humans." - Derek
> "I'm a team of one most nights. AI should be my force multiplier." - Marcus

##### Mobile AI Modes (Organization-Configurable)

Organizations can select their comfort level for mobile AI features:

| Mode | Description | Target User | Default |
|------|-------------|-------------|---------|
| **Advisory Only** | AI insights are read-only, no execution capabilities | Regulated industries (fintech, enterprise) | No |
| **Standard** | AI insights + read-only queries, execution requires desktop | Most teams | **Yes** |
| **Full Access** | All AI features enabled, execution requires biometric | Small teams, solo on-call | No |

##### Mobile AI Feature Tiers

**Tier 1: Universal Value (Build First - All Modes)**

| Feature | Description | Priority | Consensus |
|---------|-------------|----------|-----------|
| **AI summary on incident** | One-paragraph diagnosis displayed immediately when viewing incident | P0 | 5/5 personas want this |
| **Similar incident badge** | "Matches INC-342" with resolution hint | P0 | 5/5 personas want this |
| **Severity assessment** | AI opinion on urgency (advisory, human confirms) | P1 | 5/5 personas want this |
| **AI-enhanced notifications** | Context in push notification: "High CPU - likely traffic spike" | P1 | 4/5 personas want this |
| **Confidence indicator** | High/Medium/Low confidence shown on all AI suggestions | P1 | 5/5 personas want this |
| **Affected services list** | AI-determined blast radius | P1 | 4/5 personas want this |

**Tier 2: High Value (Build Second - Standard + Full Access Modes)**

| Feature | Description | Priority | Consensus |
|---------|-------------|----------|-----------|
| **"Explain this" button** | One-tap plain English explanation of alert | P1 | 4/5 personas want this |
| **Log summary** | AI fetches and summarizes relevant logs (read-only) | P1 | 4/5 personas want this |
| **"What changed?" query** | Show recent changes correlated with incident | P2 | 4/5 personas want this |
| **Voice input for queries** | "What changed in the last hour?" | P2 | 3/5 personas want this |
| **Draft status update** | AI writes status update, human approves and sends | P2 | 3/5 personas want this |

**Tier 3: Conditional Value (Full Access Mode Only)**

| Feature | Description | Priority | Consensus |
|---------|-------------|----------|-----------|
| **Read-only command execution** | Check status, describe resources, fetch data | P2 | 2/5 want, requires biometric |
| **Smart snooze suggestion** | "This usually self-resolves - snooze?" | P2 | 2/5 personas want this |
| **Voice briefing** | Audio summary while walking to laptop | P3 | 2/5 personas want this |
| **Runbook step execution** | Execute with biometric + confirmation | P3 | 1/5 wants, 4/5 oppose for mobile |

##### Mobile AI UX Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PUSH NOTIFICATION                         │
│  🔴 High CPU on checkout-api                                │
│  AI: "Likely traffic spike - similar to INC-342"            │
│  [View] [Ack] [Snooze 15m]                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ tap
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  INCIDENT DETAIL SCREEN                      │
├─────────────────────────────────────────────────────────────┤
│  INC-847: High CPU on checkout-api              ⚠️ Critical  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🤖 AI DIAGNOSIS                    Confidence: High │   │
│  │                                                      │   │
│  │ Database connection pool exhausted due to traffic   │   │
│  │ spike starting 15 min ago. 3 dependent services     │   │
│  │ affected: cart, inventory, payments.                │   │
│  │                                                      │   │
│  │ Similar to INC-342 (Nov 15) - resolved by           │   │
│  │ restarting worker pods.                             │   │
│  │                                                      │   │
│  │ [Explain More] [View INC-342] [👍] [👎]             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AFFECTED SERVICES (AI-determined)                   │   │
│  │ • checkout-api (this incident)                      │   │
│  │ • cart-service (dependent)                          │   │
│  │ • payments-api (dependent)                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ QUICK ACTIONS                                        │   │
│  │ [Acknowledge] [Snooze ▼] [Escalate] [Reassign]      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🎤 ASK AI                                           │   │
│  │ Quick: [What changed?] [Get logs] [Who fixed this?] │   │
│  │ Or tap mic to ask anything...                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📋 SUGGESTED RUNBOOK                                │   │
│  │ "High CPU Remediation" (87% match)                  │   │
│  │ [View Steps] [▶️ Continue on Desktop]               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⏱️ Will escalate to @manager in 4:32 if not acknowledged  │
└─────────────────────────────────────────────────────────────┘
```

##### Mobile AI Settings Screen

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ AI PREFERENCES                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Mobile AI Mode                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ○ Advisory Only                                      │   │
│  │   AI insights are read-only. No execution.          │   │
│  │   Best for: Regulated industries, enterprise        │   │
│  │                                                      │   │
│  │ ● Standard (Recommended)                            │   │
│  │   AI insights + read-only queries.                  │   │
│  │   Execution features available on desktop.          │   │
│  │                                                      │   │
│  │ ○ Full Access                                       │   │
│  │   All AI features including execution.              │   │
│  │   Requires biometric for sensitive actions.         │   │
│  │   Best for: Small teams, solo on-call               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Security                                                   │
│  [✓] Require biometric for AI execution                    │
│  [✓] Show "AI generated" labels on all suggestions         │
│  [✓] Log all AI interactions for audit                     │
│                                                             │
│  Features                                                   │
│  [✓] Show AI diagnosis on incidents                        │
│  [✓] AI-enhanced push notifications                        │
│  [ ] Enable voice input                                     │
│  [ ] Allow AI to suggest snooze for transient alerts       │
│                                                             │
│  Data                                                       │
│  [View what data AI can access]                            │
│  [View AI interaction history]                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

##### Key Mobile AI Principles

1. **AI insights visible without interaction** - Don't make users tap to see diagnosis
2. **Execution features use progressive disclosure** - Hidden behind settings by default
3. **Always offer "Continue on Desktop"** - Complex AI workflows belong on larger screens
4. **Voice input is optional** - Not everyone wants to talk to their phone at 3am
5. **Biometric required for any execution** - Extra friction prevents half-asleep mistakes
6. **Feedback loop built-in** - Thumbs up/down on every AI suggestion

##### Mobile AI Trust Spectrum (from Focus Group)

```
Advisory Only ◄────────────────────────────────► Full Automation
      │                    │                           │
   Derek               Maya, Priya                  Marcus
   Elena              (Standard)               (Full Access)
(read-only)
```

---

### Phase 6: Notification Enhancements (2 weeks)

> **Focus Group Priority: P1 - Operational Necessity**

#### 6.1 Notification Fallback Chain

**Current:** Sends channels based on severity
**Required:** Sequential fallback with delays

```
Push → (wait 2 min) → SMS → (wait 3 min) → Voice
         ↓                    ↓                ↓
    Check if ack'd       Check if ack'd   Final attempt
```

#### 6.2 User Notification Preferences

| Feature | Description | Priority |
|---------|-------------|----------|
| Per-user default channels | Choose preferred notification method | P1 |
| Quiet hours | Time-based suppression with override for critical | P1 |
| Weekend/weekday rules | Different preferences by day type | P2 |
| Notification preview/testing | Test your notification setup | P2 |

---

### Phase 7: Operational Features (3-4 weeks)

> **Focus Group Priority: P1 - Workflow Necessities**

#### 7.1 Maintenance Windows

> "Black Friday through Cyber Monday, I need to suppress all non-critical alerts." - Priya

| Feature | Description | Priority |
|---------|-------------|----------|
| **Scheduled windows** | Define start/end times for maintenance | P1 |
| **Service-level scoping** | Apply to specific services only | P1 |
| **Severity filtering** | Suppress warning but not critical | P1 |
| **Calendar integration** | Sync with Google/Outlook calendars | P3 |

#### 7.2 Bidirectional Slack Integration

> "I need: acknowledge from Slack, resolve from Slack, add notes from Slack." - Priya

| Feature | Description | Priority |
|---------|-------------|----------|
| **Interactive buttons** | Ack/Resolve/Snooze buttons in Slack message | P1 |
| **Slash commands** | `/oncall`, `/incident INC-123`, `/ack INC-123` | P1 |
| **Thread updates** | Incident timeline updates posted to thread | P2 |
| **Notes from Slack** | Reply to incident message to add notes | P2 |

#### 7.3 Alert Routing & Deduplication

| Feature | Description | Priority |
|---------|-------------|----------|
| **Configurable dedup window** | Set dedup time window per service | P1 |
| **Routing rules with conditions** | Route based on alert payload (regex, JSONPath) | P1 |
| **Validation/test mode** | Test webhook without creating incident | P2 |
| **Payload logging** | Log incoming webhooks for debugging | P2 |

---

### Phase 8: DevOps Differentiators (4-6 weeks)

#### 8.1 Terraform Provider

> "Everything in our stack is code. If I can't terraform apply my on-call config, I'm introducing a manual process." - Maya

```hcl
resource "oncallshift_service" "api" {
  name = "API Service"
  escalation_policy_id = oncallshift_escalation_policy.primary.id
  tags = ["api", "production", "critical"]
}

resource "oncallshift_schedule" "primary" {
  name = "Primary On-Call"
  timezone = "America/New_York"
  layers {
    rotation_type = "weekly"
    members = [oncallshift_user.alice.id, oncallshift_user.bob.id]
  }
}

resource "oncallshift_runbook" "high_cpu" {
  name = "High CPU Remediation"
  tags = ["cpu", "performance"]
  steps = [
    { title = "Check top processes", command = "top -b -n 1" },
    { title = "Restart service if needed", command = "systemctl restart app", requires_approval = true }
  ]
}
```

#### 8.2 CLI Tool

```bash
# Incident management
ocs incidents list --service payments --status triggered
ocs incidents ack INC-123 --note "Investigating"
ocs incidents resolve INC-123 --note "Fixed by rollback"

# On-call queries
ocs oncall show --service api
ocs oncall override --user alice --start now --end +4h

# Runbook execution
ocs runbook list --tag payments
ocs runbook run high-cpu-remediation --service payments-api

# Alert testing
ocs alert test --service api --severity critical --summary "Test alert"
```

#### 8.3 Alert Correlation & Noise Reduction (Enterprise)

> "When our payment database goes down, we get 200 alerts. I need automatic grouping." - Elena

| Feature | Description | Priority |
|---------|-------------|----------|
| **Intelligent grouping** | Auto-group related alerts into single incident | P2 |
| **Flapping detection** | Suppress rapid fire/resolve cycles | P2 |
| **Parent-child suppression** | Database down suppresses dependent service alerts | P2 |
| **Correlation rules UI** | Configure grouping logic | P3 |

#### 8.4 Service Dependencies

| Feature | Description | Priority |
|---------|-------------|----------|
| **Dependency definition** | Service A depends on Service B | P2 |
| **Blast radius visualization** | Show impacted services when parent fails | P2 |
| **Cascading notifications** | Auto-notify dependent service teams | P3 |

---

### Phase 9: Enterprise Features (6-8 weeks)

> **Focus Group Priority: P0 for Enterprise Adoption**

#### 9.1 SSO/SAML

> "This is non-negotiable. Our security policy prohibits SaaS tools that don't support SSO." - Derek

| Feature | Description | Priority |
|---------|-------------|----------|
| **SAML 2.0 support** | Okta, Azure AD, OneLogin integration | P0 |
| **Just-in-time provisioning** | Auto-create users on first login | P1 |
| **Role mapping** | Map IdP groups to OnCallShift roles | P1 |
| **SCIM provisioning** | Auto-create/disable users from IdP | P2 |
| **Google Workspace SSO** | For smaller teams using Google | P2 |

#### 9.2 Advanced RBAC

> "I need to give team leads access to their team's services only, not everything." - Derek

| Feature | Description | Priority |
|---------|-------------|----------|
| **Team-scoped access** | Users see only their team's resources | P1 |
| **Custom roles** | Define roles with specific permissions | P2 |
| **Permission matrix** | incidents.view, incidents.ack, schedules.edit, etc. | P2 |
| **Audit log for access** | Track permission changes | P2 |

#### 9.3 Compliance & Audit

| Feature | Description | Priority |
|---------|-------------|----------|
| **Immutable audit logs** | Tamper-proof audit trail | P1 |
| **Audit log export** | Export to SIEM (Splunk, etc.) | P1 |
| **SLA compliance dashboard** | Track ack/resolve times vs targets | P1 |
| **Data retention policies** | Configurable retention periods | P2 |
| **SOC2 documentation** | Compliance documentation package | P2 |

#### 9.4 HIPAA Compliance

> "We handle PHI. Before I can use any SaaS tool, I need a BAA." - Marcus

| Feature | Description | Priority |
|---------|-------------|----------|
| **BAA availability** | Offer Business Associate Agreement | P1 |
| **PHI-safe configuration** | Document HIPAA-eligible setup | P1 |
| **Encryption documentation** | Document encryption at rest/in transit | P1 |

---

### Phase 10: Advanced Features (Ongoing)

#### 10.1 Native Integrations

| Integration | Type | Priority |
|-------------|------|----------|
| **Datadog** | Native (not just webhook) with rich context | P2 |
| **New Relic** | Native integration | P3 |
| **Prometheus/AlertManager** | Native integration | P2 |
| **Splunk** | Log integration for AI | P3 |

#### 10.2 Schedule Improvements

| Feature | Description | Priority |
|---------|-------------|----------|
| **Follow-the-sun templates** | Pre-built multi-timezone rotations | P2 |
| **Schedule gap detection** | Warn when no one is on-call | P1 |
| **Vacation mode** | Easy coverage request workflow | P2 |
| **On-call handoff notes** | Auto-generated shift summary | P2 |
| **ICS calendar export** | Personal calendar integration | P2 |

#### 10.3 Reporting & Analytics

| Feature | Description | Priority |
|---------|-------------|----------|
| **Percentile metrics** | p50, p95, p99 response times | P2 |
| **Per-team breakdown** | Metrics by team | P2 |
| **Trend analysis** | Week-over-week, month-over-month | P2 |
| **Export to CSV/PDF** | Download reports | P2 |

---

## Implementation Priority Matrix

Based on focus group feedback, prioritized for maximum adoption impact:

### Immediate (Next 4 weeks)
| Item | Impact | Effort | Driver |
|------|--------|--------|--------|
| API key hashing | Unblocks enterprise | Small | Security |
| Webhook signatures | Unblocks enterprise | Small | Security |
| **Mobile: AI summary on incident** | 5/5 personas want this | Medium | Focus Group - Mobile AI |
| **Mobile: Similar incident badge** | 5/5 personas want this | Small | Focus Group - Mobile AI |
| AI confidence scores | Increases AI trust | Small | Focus Group |
| AI data transparency | Addresses privacy concerns | Medium | Focus Group |
| Notification reliability monitoring | Core value prop | Medium | Focus Group |
| Step-level runbook permissions | Enables safe AI execution | Medium | Focus Group |

### Short-term (4-8 weeks)
| Item | Impact | Effort | Driver |
|------|--------|--------|--------|
| **Mobile: AI-enhanced notifications** | Context in push notification | Medium | Focus Group - Mobile AI |
| **Mobile: Severity assessment (AI)** | Advisory urgency indicator | Small | Focus Group - Mobile AI |
| **Mobile: "Explain this" button** | One-tap explanation | Small | Focus Group - Mobile AI |
| **Mobile: AI mode settings** | Advisory/Standard/Full Access | Medium | Focus Group - Mobile AI |
| Maintenance windows | Operational necessity | Medium | Focus Group |
| Bidirectional Slack | Major workflow improvement | Medium | Focus Group |
| Tag-based runbook mapping | Discoverability | Medium | Focus Group |
| Mobile widgets | User experience | Medium | Focus Group |
| Runbook health indicators | Trust & adoption | Small | Focus Group |
| Biometric auth for mobile | Security | Small | Focus Group |
| **Mobile: Escalation countdown** | "Will escalate in X min" | Small | Focus Group - Mobile AI |
| **Mobile: Affected services (AI)** | Blast radius visibility | Medium | Focus Group - Mobile AI |

### Medium-term (8-16 weeks)
| Item | Impact | Effort | Driver |
|------|--------|--------|--------|
| **Mobile: Voice input for AI queries** | 3/5 personas want this | Medium | Focus Group - Mobile AI |
| **Mobile: Log summary via AI** | Fetch and summarize logs | Medium | Focus Group - Mobile AI |
| **Mobile: Draft status update (AI)** | AI writes, human approves | Medium | Focus Group - Mobile AI |
| SSO/SAML | Unblocks enterprise entirely | Large | Focus Group |
| Terraform provider | Appeals to IaC teams | Large | Focus Group |
| CLI tool | Automation workflows | Medium | Focus Group |
| Advanced RBAC | Enterprise necessity | Large | Focus Group |
| Alert correlation | Scale requirement | Large | Focus Group |

### Long-term (16+ weeks)
| Item | Impact | Effort | Driver |
|------|--------|--------|--------|
| **Mobile: Full Access AI mode** | Execution with biometric | Large | Focus Group - Mobile AI |
| **Mobile: Smart snooze suggestions** | AI identifies transient alerts | Medium | Focus Group - Mobile AI |
| **Mobile: Voice briefing** | Audio summary on the go | Medium | Focus Group - Mobile AI |
| Service dependency graph | Enterprise feature | Large | Focus Group |
| HIPAA/BAA | Healthcare vertical | Medium | Focus Group |
| Native integrations | Ecosystem expansion | Large | Focus Group |
| Predictive alerting | Differentiation | Large | Roadmap |

---

## Mobile AI Implementation Summary

Quick reference for mobile AI features by consensus:

| Feature | Consensus | Priority | Mode Required |
|---------|-----------|----------|---------------|
| AI diagnosis summary | 5/5 | P0 | All modes |
| Similar incident badge | 5/5 | P0 | All modes |
| Severity assessment | 5/5 | P1 | All modes |
| Confidence indicator | 5/5 | P1 | All modes |
| AI-enhanced notifications | 4/5 | P1 | All modes |
| Affected services list | 4/5 | P1 | All modes |
| "Explain this" button | 4/5 | P1 | Standard+ |
| Log summary | 4/5 | P1 | Standard+ |
| "What changed?" query | 4/5 | P2 | Standard+ |
| Voice input | 3/5 | P2 | Standard+ |
| Draft status update | 3/5 | P2 | Standard+ |
| Read-only execution | 2/5 | P2 | Full Access |
| Smart snooze | 2/5 | P2 | Full Access |
| Voice briefing | 2/5 | P3 | Full Access |
| Runbook execution | 1/5 | P3 | Full Access |

**Key insight:** Build Tier 1 (universal value) features first - they have 100% consensus and work across all AI modes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                         │
│                    Web App (React)                           │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS
┌─────────────────▼───────────────────────────────────────────┐
│               Application Load Balancer                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼───┐   ┌─────▼─────┐   ┌───▼───────────┐
│  API  │   │  Alert    │   │  Notification │
│Service│   │ Processor │   │    Worker     │
└───┬───┘   └─────┬─────┘   └───────┬───────┘
    │             │                 │
    └──────┬──────┴────────────────┬┘
           │                       │
    ┌──────▼──────┐         ┌──────▼──────┐
    │    RDS      │         │    SQS      │
    │ PostgreSQL  │         │   Queues    │
    └─────────────┘         └─────────────┘
```

**Cost:** ~$58/month (~$3-6/user for 10-20 users)
**Savings:** 87-90% vs PagerDuty ($29-49/user)

---

## Quick Reference

### Deploy Changes
```bash
./deploy.sh  # Full deployment
```

### Create User
```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_vMk9CQycK \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com

aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_vMk9CQycK \
  --username user@example.com \
  --password YourPassword123! \
  --permanent
```

### Check Service Status
```bash
aws ecs describe-services --cluster pagerduty-lite-dev \
  --services pagerduty-lite-dev-api --region us-east-1
```

### View Logs
```bash
aws logs tail /ecs/pagerduty-lite-dev/api --follow --region us-east-1
```

---

## Key URLs

| Resource | URL |
|----------|-----|
| Live App | https://oncallshift.com |
| API Docs | https://oncallshift.com/api-docs |
| Webhook | https://oncallshift.com/api/alerts/webhook |

---

## Appendix: Focus Group Persona Summary

| Persona | Company Type | Current Tool | Key Priorities | Adoption Likelihood |
|---------|--------------|--------------|----------------|---------------------|
| Maya Chen | Series B Startup (45 eng) | PagerDuty | Cost, Terraform provider, simplicity | High - immediate |
| Derek Williams | Fintech (200 eng) | Opsgenie | SSO, RBAC, audit logs, compliance | Medium - needs SSO |
| Priya Sharma | E-commerce (80 eng) | VictorOps | Slack, maintenance windows, reliability | High - after Slack |
| Marcus Johnson | Healthcare Startup (12 eng) | DIY Slack bot | HIPAA, simplicity, cost | High - immediate |
| Elena Kowalski | Enterprise Media (500+ eng) | PagerDuty Enterprise | Alert correlation, dependencies, scale | Low - complementary use |
