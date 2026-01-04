# OnCallShift Strategic Differentiators

## Executive Summary

This document captures strategic differentiators that could make OnCallShift the leading incident management platform. The core insight: OnCallShift was built by a DevOps engineer who naturally built what DevOps engineers need — capabilities that enterprise-focused competitors (PagerDuty, incident.io, Rootly) don't have.

**Positioning:**
> "Built by DevOps engineers, for DevOps engineers. The first incident platform that lives inside your infrastructure."

---

## Part 1: AI First Responder

Transform from "notification router" to "AI-powered incident response platform."

**Value Proposition:** "Every incident gets an AI first responder before a human is paged."

### 1.1 Auto-Investigation on Incident Creation

**Current State:** AI diagnosis is on-demand (user clicks button)

**Future State:** Every incident automatically triggers AI investigation within seconds of creation.

**Flow:**
```
Alert → Incident Created → AI immediately investigates → Results ready when human looks
```

**Value:** Humans never start from zero. Context is always ready.

---

### 1.2 Similar Incident Matching (RAG)

**Current State:** No historical correlation

**Future State:** Vector search finds similar past incidents and what resolved them.

**Implementation:**
- Store incident embeddings in vector DB (pgvector)
- On new incident, find top 3-5 similar past incidents
- Include in AI prompt: "Similar incidents and their resolutions"

**Value:** "This looks like incident #1234 which was resolved by restarting worker pods."

---

### 1.3 Auto-Remediation for Low-Risk Actions

**Current State:** AI suggests actions, humans execute

**Future State:** Low-risk actions with `can_automate: true` execute automatically.

**Guardrails:**
- Org-level opt-in per service
- Only low-risk actions
- Full audit trail
- Verification after execution

**Value:** 30-40% of incidents auto-resolved without human involvement.

---

### 1.4 Smart Paging Decisions

**Current State:** Alert → Page human immediately

**Future State:** AI investigates first, pages with full context (or doesn't page if auto-resolved).

**Decision Tree:**
- Auto-resolved → No page, async notification
- Medium-risk → Page with context + suggested fix
- High-risk/unknown → Page immediately with investigation results

**Value:** Fewer 3am wake-ups. When paged, you have full context.

---

### 1.5 Learning/Feedback Loop

**Current State:** Each incident is independent

**Future State:** System gets smarter over time from human actions.

**Mechanism:**
- Capture how humans resolve incidents
- Store patterns: "For incidents like X, action Y works 80% of the time"
- Improve auto-remediation confidence over time
- Not ML training, just pattern storage + retrieval

**Value:** The more you use it, the smarter it gets.

---

## Part 2: Infrastructure-Native AI

**Core Differentiator:** OnCallShift has cloud credentials with direct API access. AI doesn't just receive alerts — it can query your infrastructure directly.

### 2.1 Live Infrastructure Discovery

**What It Does:** AI calls AWS/GCP/Azure APIs to understand your actual architecture.

**Example:**
```
AI queries:
- aws ecs describe-services → Finds your ECS services
- aws rds describe-db-instances → Finds your databases
- aws elbv2 describe-load-balancers → Finds your load balancers

Result: Real-time topology map, no manual service catalog needed.
```

**Why Competitors Can't:** They only know what you tell them. OnCallShift discovers it.

---

### 2.2 Real-Time Investigation

**What It Does:** When incident fires, AI actively queries infrastructure, not just logs.

**Example Investigation:**
```
Incident: "High latency on payment-service"

AI queries:
- aws ecs describe-services → Are tasks healthy?
- aws rds describe-db-instances → Is RDS CPU spiked?
- aws elbv2 describe-target-health → Are targets healthy?
- aws cloudwatch get-metric-data → What changed in last 30 min?
- github api → Any deploys in the last hour?

Result: "RDS CPU at 94%, started 8 min after deploy #abc123"
```

**Why Competitors Can't:** They only search logs. OnCallShift queries live state.

---

### 2.3 Proactive Health Monitoring

**What It Does:** AI periodically scans infrastructure, catches issues BEFORE alerts fire.

**Examples:**
- "RDS storage is 87% full. At current growth, you'll hit 100% in 6 days."
- "ECS task memory trending up. Possible memory leak."
- "SSL cert expires in 14 days."
- "Security group allows 0.0.0.0/0 on port 22."

**Why Competitors Can't:** They're reactive by design. OnCallShift is proactive.

---

### 2.4 Infrastructure-Aware Remediation

**What It Does:** AI knows what actions are possible in your infrastructure.

**Example:**
- Competitor: "Here's a script to run"
- OnCallShift: "I see you have an ASG. Want me to scale it from 3 to 5 instances?"

**Why Competitors Can't:** They don't know your infrastructure topology.

---

## Part 3: Unified Incident Context

### 3.1 Single Pane of Glass

**The Problem:** During incidents, engineers have 7 tabs open (Datadog, CloudWatch, GitHub, Slack, Jira, etc.)

**The Solution:** Pull all context into one incident view:
- Metrics from Datadog AND Prometheus AND CloudWatch
- Logs from multiple sources
- Recent deploys from GitHub/GitLab
- Relevant Slack threads
- Related Jira tickets

**Value:** No tab switching. Everything in one place.

---

### 3.2 Auto-Generated Runbooks

**The Problem:** Runbooks are stale. Nobody updates them. Writing them is tedious.

**The Solution:** AI watches how humans resolve incidents and creates runbooks automatically.

**Flow:**
```
Human resolves incident by running 4 commands
        ↓
AI: "I noticed you ran these commands to resolve this. Save as runbook?"
        ↓
Runbook auto-created, kept fresh as humans deviate
```

**Value:** Runbooks that write themselves.

---

### 3.3 On-Call Health Scoring

**The Problem:** On-call burnout is 71%, but there's no way to measure or improve it.

**The Solution:** Track on-call quality metrics:

| Metric | What It Measures |
|--------|------------------|
| Signal-to-noise ratio | % of pages that were real incidents |
| After-hours burden | How many 2am pages this month |
| Resolution quality | Did fixes stick or did incidents recur |
| Fairness score | Is on-call load evenly distributed |
| Burnout indicators | Trending up in pages? Response times degrading? |

**Output:** On-Call Health Score (like a credit score) with recommendations.

**Value:** You can't improve what you don't measure.

---

### 3.4 Automatic Change Correlation

**The Problem:** Most incidents are caused by changes. Correlating "what changed?" is manual.

**The Solution:** Auto-integrate with change sources:
- CI/CD (GitHub Actions, GitLab, ArgoCD)
- Feature flags (LaunchDarkly, Split)
- Infrastructure (Terraform, Pulumi)

**Output:** "In last 60 minutes: 2 deploys, 1 feature flag change, 1 Terraform apply. Here's what changed."

**Over Time:** "80% of your incidents happen within 30 min of a deploy to payment-service."

**Value:** Root cause is usually "what changed?" — automate that answer.

---

### 3.5 Customer Impact Awareness

**The Problem:** Engineers know systems are down. Leadership wants: "How many customers? How much revenue?"

**The Solution:** Integrate with business metrics:
- Stripe, Segment, your data warehouse
- Incident view shows: "Affected: ~2,340 customers, ~$45K blocked transactions"
- Severity auto-adjusts based on business impact

**Value:** Makes the business case for reliability. Execs understand dollars.

---

### 3.6 Incident Prevention (Pre-Deploy Risk Scoring)

**The Problem:** We wait for incidents, then respond.

**The Solution:** Score deploy risk before it happens.

**Pre-Deploy:**
> "This PR touches payment-service. Historical data: 3 of 5 recent deploys caused incidents. Risk: HIGH. Recommend: canary deploy, extra monitoring."

**Post-Deploy:**
> "Watching payment-service closely. I'll alert if anything looks off in the next 30 minutes."

**Value:** Prevent incidents, don't just respond faster.

---

## Part 4: DevOps-Native Architecture

### 4.1 GitOps-Native Configuration

**How DevOps Thinks:** Everything is code, version controlled, PR-reviewed.

**What OnCallShift Does:**
- Terraform provider for all resources (already exists!)
- Config lives in git, not UI clicks
- PR to change escalation policy → review → merge → applied
- Full audit trail

**Status:** Partially implemented (Terraform provider exists).

---

### 4.2 Kubernetes-Native

**How DevOps Thinks:** Pods, deployments, services, ingresses, helm releases.

**What OnCallShift Could Do:**
- Connect to K8s cluster (like AWS credentials)
- Auto-discover services from K8s
- Incident view shows: pod status, events, container logs
- Understand helm releases, ArgoCD applications
- "Deployment has 3 replicas, 1 is CrashLoopBackOff, here's why"

**Status:** Not yet implemented.

---

### 4.3 Service Dependency Mapping (Blast Radius)

**How DevOps Thinks:** If payment-service is down, what else breaks?

**What OnCallShift Could Do:**
- Auto-discover from K8s service mesh, distributed tracing, AWS service map
- Show blast radius: "payment-service down → affects: checkout, orders, invoicing"
- Smart escalation: auto-page dependent service owners

**Status:** Not yet implemented.

---

### 4.4 Pipeline-Aware (CI/CD First-Class)

**How DevOps Thinks:** Deploys are the heartbeat. Most incidents are deploy-related.

**What OnCallShift Could Do:**
- Native GitHub Actions, GitLab CI, ArgoCD integration
- Real-time deploy status in incident view
- Auto-correlate deploy → incident → rollback
- One-click rollback from incident page
- Deploy freeze during active P1 incidents

**Status:** Partial (GitHub integration for AI workers, not for incident correlation).

---

### 4.5 IaC-Aware (Terraform/Pulumi/CloudFormation)

**How DevOps Thinks:** Infrastructure changes cause incidents too.

**What OnCallShift Could Do:**
- Know your Terraform state (S3 backend, Terraform Cloud)
- Correlate: "Incident started 15 min after terraform apply"
- Show: "This resource created by module X in repo Y"
- Drift detection

**Status:** Not yet implemented.

---

### 4.6 Multi-Environment Awareness

**How DevOps Thinks:** Dev, staging, prod are different.

**What OnCallShift Could Do:**
- Environment-aware escalation rules
- Staging incident ≠ 2am page
- Auto-link: "This prod incident looks like staging issue #456 from last week"
- Promote fixes: "This worked in staging, apply to prod?"

**Status:** Not yet implemented.

---

### 4.7 Cost Correlation

**How DevOps Thinks:** Incidents cost money — engineer time AND cloud spend.

**What OnCallShift Could Do:**
- Engineer time cost (hours × loaded rate)
- Cloud cost impact: "3x Lambda spike = $2,400 extra"
- Customer impact cost
- Monthly report: "Incidents cost $47,000 this month. Here's how to reduce."

**Status:** Not yet implemented.

---

### 4.8 Security-Aware Incidents

**How DevOps Thinks:** Some incidents are security incidents. Different playbook.

**What OnCallShift Could Do:**
- Detect security patterns (unusual traffic, DDoS indicators)
- Different workflows for security incidents
- Integration with GuardDuty, Security Hub
- Auto-tag security indicators

**Status:** Not yet implemented.

---

## Competitive Positioning

| Feature | PagerDuty | incident.io | Rootly | OnCallShift |
|---------|-----------|-------------|--------|-------------|
| Infrastructure access | ❌ Alerts only | ❌ Alerts only | ❌ Alerts only | ✅ Direct API access |
| GitOps config | ❌ UI-first | ❌ UI-first | ⚠️ Partial | ✅ Terraform provider |
| K8s-native | ⚠️ Basic | ⚠️ Basic | ⚠️ Basic | 🔜 Deep integration |
| Auto-generated runbooks | ❌ | ❌ | ❌ | 🔜 AI learns from humans |
| On-call health scoring | ❌ | ❌ | ❌ | 🔜 Full metrics |
| Pre-deploy risk scoring | ❌ | ❌ | ❌ | 🔜 Prevention |
| Customer impact | ❌ | ❌ | ❌ | 🔜 Business metrics |

---

## Implementation Priority

### Phase 1: AI First Responder (Foundation)
1. Auto-investigation on incident creation
2. Similar incident matching (RAG)
3. Smart paging with context enrichment

### Phase 2: Learning & Automation
4. Auto-remediation for low-risk actions
5. Auto-generated runbooks from human patterns
6. Feedback loop for continuous improvement

### Phase 3: DevOps-Native Depth
7. Kubernetes-native integration
8. Service dependency mapping
9. CI/CD pipeline awareness
10. IaC change correlation

### Phase 4: Business Intelligence
11. On-call health scoring
12. Customer impact awareness
13. Cost correlation
14. Incident prevention / risk scoring

---

## The Pitch

**For PagerDuty refugees:**
> "Everything PagerDuty does, but simpler, cheaper, and actually DevOps-native."

**For modern teams:**
> "The only incident platform where AI lives inside your infrastructure, not outside looking in."

**For leadership:**
> "Reduce incidents by 40%, cut MTTR by 60%, and finally measure the cost of reliability."

---

## Part 5: Own the Full Incident Lifecycle

Most tools focus on "Alert → Page." But incident management is a complex, multi-phase process with coordination, communication, approvals, and follow-up. OnCallShift should own **every step**.

### The Complete Incident Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        THE INCIDENT LIFECYCLE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: PREPARATION (Before incidents happen)                            │
│  ├── On-call schedules & rotations                                          │
│  ├── Escalation policies                                                    │
│  ├── Runbooks documented & accessible                                       │
│  ├── Communication templates ready                                          │
│  ├── Stakeholder lists defined                                              │
│  └── War room / bridge call setup                                           │
│                                                                             │
│  PHASE 2: DETECTION & TRIAGE (First 5 minutes)                              │
│  ├── Alert fires                                                            │
│  ├── On-call paged                                                          │
│  ├── Acknowledge                                                            │
│  ├── Initial severity assessment                                            │
│  ├── Incident declared (P1/P2/P3/P4)                                        │
│  └── Incident Commander assigned                                            │
│                                                                             │
│  PHASE 3: MOBILIZATION (First 15 minutes)                                   │
│  ├── Create incident channel (Slack/Teams)                                  │
│  ├── Spin up war room / bridge call                                         │
│  ├── Page additional responders                                             │
│  ├── Assign roles (IC, Comms, Scribe, Technical)                            │
│  ├── Initial stakeholder notification                                       │
│  └── Status page updated (if customer-facing)                               │
│                                                                             │
│  PHASE 4: INVESTIGATION (Active incident)                                   │
│  ├── Gather context (logs, metrics, recent changes)                         │
│  ├── Form hypotheses                                                        │
│  ├── Test hypotheses                                                        │
│  ├── Document everything tried                                              │
│  ├── Regular status updates (every 15-30 min)                               │
│  ├── Escalate if needed                                                     │
│  └── Coordinate multiple teams                                              │
│                                                                             │
│  PHASE 5: REMEDIATION (Fixing the issue)                                    │
│  ├── Identify fix                                                           │
│  ├── Get approval for risky changes                                         │
│  ├── Execute remediation                                                    │
│  ├── Verify fix worked                                                      │
│  └── Monitor for recurrence                                                 │
│                                                                             │
│  PHASE 6: RESOLUTION & CLOSURE                                              │
│  ├── Confirm service restored                                               │
│  ├── Final stakeholder update                                               │
│  ├── Status page updated                                                    │
│  ├── Incident closed                                                        │
│  └── Schedule postmortem                                                    │
│                                                                             │
│  PHASE 7: POSTMORTEM & LEARNING                                             │
│  ├── Timeline reconstruction                                                │
│  ├── Root cause analysis                                                    │
│  ├── Blameless retrospective                                                │
│  ├── Action items identified                                                │
│  ├── Action items assigned with owners                                      │
│  ├── Follow-up tracking (30/60/90 days)                                     │
│  └── Runbooks updated                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What Current Tools Do vs. What's Missing

| Phase | What Tools Do | What's Still Manual/Broken |
|-------|---------------|---------------------------|
| **Preparation** | Schedules, escalation policies | Runbooks stale, templates scattered, no rehearsal |
| **Detection** | Page on-call | No AI triage, severity is guesswork |
| **Mobilization** | Create Slack channel (maybe) | Role assignment manual, stakeholder lists scattered |
| **Investigation** | Show alerts, maybe logs | No guided investigation, tribal knowledge problem |
| **Remediation** | Runbook links | Approvals outside the tool, no execution tracking |
| **Resolution** | Mark resolved | Status page updates manual, verification is hope |
| **Postmortem** | Template generation | Action items get lost, no follow-up tracking |

---

### Phase 1: Preparation Capabilities

#### 5.1 Runbook Health Dashboard

**The Problem:** Runbooks get stale and nobody knows which services are covered.

**The Solution:**
- Dashboard showing runbook coverage per service
- Stale runbook detection: "payment-service runbook not updated in 6 months, had 3 incidents"
- Auto-flag when runbook doesn't match actual resolution patterns
- Runbook effectiveness score based on usage during incidents

---

#### 5.2 Incident Response Rehearsal ("Game Day")

**The Problem:** Teams only practice incident response during real incidents.

**The Solution:**
- Simulate incidents to test response procedures
- "Wheel of Misfortune" — random scenario drills
- Track team readiness scores over time
- Identify gaps before they matter

---

#### 5.3 Communication Template Library

**The Problem:** During incidents, people waste time crafting messages.

**The Solution:**
- Pre-approved templates for each severity level
- Stakeholder-specific templates (execs, customers, internal teams)
- Variable substitution: `{{service_name}}`, `{{eta}}`, `{{impact}}`
- Template versioning and approval workflow

---

### Phase 2: Detection & Triage Capabilities

#### 5.4 AI-Powered Severity Assessment

**The Problem:** Severity classification is guesswork, often wrong.

**The Solution:**
- Auto-classify P1/P2/P3/P4 based on:
  - Business impact (customer count, revenue affected)
  - Blast radius (dependent services)
  - Historical data ("similar incidents were P2")
  - Time of day (production hours vs off-hours)
- Human can override but starts with AI recommendation
- Learn from overrides to improve over time

---

#### 5.5 Smart Incident Declaration

**The Problem:** Multiple alerts fire for one problem, creating duplicate incidents.

**The Solution:**
- Detect when multiple alerts = one incident
- "These 5 alerts are all symptoms of the same root cause"
- Auto-group related alerts
- Prevent duplicate incident creation
- Surface the root alert vs. symptoms

---

### Phase 3: Mobilization Capabilities

#### 5.6 One-Click War Room

**The Problem:** Setting up incident coordination takes precious minutes.

**The Solution:**
- One click creates:
  - Slack/Teams channel with naming convention
  - Zoom/Meet bridge call link
  - Invites to on-call + relevant responders
- Pre-populate channel with incident context
- Link everything together automatically
- Template-based setup per severity level

---

#### 5.7 Role Assignment & Tracking

**The Problem:** Unclear who's doing what during an incident.

**The Solution:**
- Formal role assignment: IC, Comms Lead, Scribe, Technical Lead
- Track who's doing what in real-time
- AI suggests roles based on expertise and availability
- Handoff tracking when shifts change
- Role history for postmortem

---

#### 5.8 Stakeholder Management

**The Problem:** Notifying the right people is manual and often forgotten.

**The Solution:**
- Define stakeholder groups per service/severity
  - P1: Execs, customer success, PR
  - P2: Engineering leads, affected team managers
  - P3: Team leads only
- Auto-notify right people at right time
- Different message templates per audience
- Track who's been notified and acknowledged
- Escalate if no acknowledgment

---

### Phase 4: Investigation Capabilities

#### 5.9 Guided Investigation Workflow

**The Problem:** Investigation is ad-hoc, depends on who's on-call.

**The Solution:**
- Step-by-step investigation checklist per service
- "Have you checked: logs? recent deploys? related alerts? metrics?"
- AI suggests next steps based on what's been tried
- Track investigation progress
- Prevent duplicate work when multiple people are investigating

---

#### 5.10 Scribe Bot / Auto-Timeline

**The Problem:** Nobody documents what happened during incident.

**The Solution:**
- Automatically capture everything:
  - Who joined the incident, when
  - Messages in incident channel
  - Commands run (via runbook execution)
  - Alerts that fired, resolved
  - Status changes
- Build timeline without manual note-taking
- Feed directly into postmortem

---

#### 5.11 Expertise Finder

**The Problem:** "Who knows about this system?"

**The Solution:**
- Auto-suggest experts based on:
  - Code ownership (CODEOWNERS, git history)
  - Past incident resolution
  - On-call history for this service
  - Documented SME lists
- "Alice has resolved 4 similar incidents, last one 2 weeks ago"
- One-click escalation to expert

---

### Phase 5: Remediation Capabilities

#### 5.12 Change Approval Workflow

**The Problem:** Risky changes during incidents need approval but it happens via Slack.

**The Solution:**
- In-platform approval for remediation actions
- "I want to restart the database" → Approval required from service owner
- Track who approved what, when
- Audit trail for compliance
- Emergency bypass with extra logging

---

#### 5.13 Remediation Execution Tracking

**The Problem:** No record of what was tried during incident.

**The Solution:**
- Track every remediation attempt:
  - What was tried
  - Who did it
  - When
  - Did it work?
- "Tried restarting pods at 3:42pm — didn't work. Scaled up at 3:55pm — worked."
- Auto-feed into postmortem
- Build pattern database for future incidents

---

#### 5.14 One-Click Rollback

**The Problem:** Rollback requires leaving incident tool, navigating CI/CD.

**The Solution:**
- Surface recent deploys in incident view
- One-click rollback to previous version
- Connected to your deploy pipeline (GitHub Actions, ArgoCD, etc.)
- Track rollback as incident action
- Auto-monitor after rollback

---

### Phase 6: Resolution & Closure Capabilities

#### 5.15 Resolution Verification Checklist

**The Problem:** "Is it actually fixed?" is based on hope.

**The Solution:**
- Checklist before closing:
  - [ ] Monitoring shows normal metrics
  - [ ] No related alerts in last 15 minutes
  - [ ] Manual verification completed
  - [ ] Customer-facing services tested
- Auto-reopen if alert fires again within window
- Require verification before marking resolved

---

#### 5.16 Automated Status Page Updates

**The Problem:** Status page updates are manual and often forgotten.

**The Solution:**
- Sync incident status → status page automatically
- AI drafts customer-facing messages based on internal incident data
- Approval workflow before publish
- Track status page history with incident
- Auto-resolve status page when incident closes

---

#### 5.17 Stakeholder Close-Out

**The Problem:** People notified at start never hear how it ended.

**The Solution:**
- Auto-send resolution summary to all notified stakeholders
- Different message templates per audience
- Include: what happened, impact, duration, next steps
- Track acknowledgment
- Feed into communication effectiveness metrics

---

### Phase 7: Postmortem & Learning Capabilities

#### 5.18 Auto-Generated Postmortem Draft

**The Problem:** Writing postmortems is tedious, often skipped.

**The Solution:**
- AI generates draft postmortem including:
  - Timeline (from scribe bot)
  - Actions taken (from execution tracking)
  - Metrics (TTD, TTR, impact)
  - Who was involved
  - AI-suggested contributing factors
- Human reviews, edits, approves
- Blameless framing built-in

---

#### 5.19 Action Item Tracking That Works

**The Problem:** "Without follow-through, a postmortem is indistinguishable from no postmortem."

**The Solution:**
- Create Jira/Linear tickets directly from postmortem
- Assign owners with due dates
- **Track completion** (this is where everyone fails)
- 30/60/90 day follow-up reminders
- Dashboard: "67% of action items completed, 12 overdue"
- Block closing postmortem without action items
- Link action item completion to incident reduction

---

#### 5.20 Recurring Incident Detection

**The Problem:** Same incidents keep happening, nobody notices the pattern.

**The Solution:**
- "This is the 3rd time this month we've had this type of incident"
- "Action items from incident #123 were never completed — that's why this happened again"
- Force prioritization of repeat issues
- Track recurrence rate per service
- Surface in on-call health score

---

## The Vision: AI Incident Commander

The ultimate differentiator: **AI that can run the incident process**, not just investigate.

```
Incident fires
     │
     ▼
AI Incident Commander activates:
├── Assesses severity (auto-classify)
├── Creates war room (Slack + bridge)
├── Pages right people (based on expertise)
├── Assigns roles (suggests IC, comms, etc.)
├── Starts investigation (queries infrastructure)
├── Posts regular status updates (drafts, human approves)
├── Tracks what's being tried
├── Suggests next steps
├── Drafts stakeholder comms
├── Updates status page
├── Verifies resolution
├── Generates postmortem
├── Creates action items
└── Tracks follow-up
```

**The human is still in control**, but AI handles the coordination overhead so humans can focus on the actual problem.

---

## Complete Capability Summary

### Preparation (3 capabilities)
1. Runbook Health Dashboard
2. Incident Response Rehearsal
3. Communication Template Library

### Detection & Triage (2 capabilities)
4. AI-Powered Severity Assessment
5. Smart Incident Declaration

### Mobilization (3 capabilities)
6. One-Click War Room
7. Role Assignment & Tracking
8. Stakeholder Management

### Investigation (3 capabilities)
9. Guided Investigation Workflow
10. Scribe Bot / Auto-Timeline
11. Expertise Finder

### Remediation (3 capabilities)
12. Change Approval Workflow
13. Remediation Execution Tracking
14. One-Click Rollback

### Resolution & Closure (3 capabilities)
15. Resolution Verification Checklist
16. Automated Status Page Updates
17. Stakeholder Close-Out

### Postmortem & Learning (3 capabilities)
18. Auto-Generated Postmortem Draft
19. Action Item Tracking That Works
20. Recurring Incident Detection

---

## Updated Implementation Priority

### Immediate (Part 5 additions)
- 5.4 AI-Powered Severity Assessment
- 5.10 Scribe Bot / Auto-Timeline
- 5.18 Auto-Generated Postmortem Draft
- 5.19 Action Item Tracking

### Near-Term
- 5.6 One-Click War Room
- 5.8 Stakeholder Management
- 5.11 Expertise Finder
- 5.16 Automated Status Page Updates

### Medium-Term
- 5.1 Runbook Health Dashboard
- 5.7 Role Assignment & Tracking
- 5.9 Guided Investigation Workflow
- 5.12 Change Approval Workflow
- 5.13 Remediation Execution Tracking
- 5.20 Recurring Incident Detection

### Future
- 5.2 Incident Response Rehearsal
- 5.3 Communication Template Library
- 5.5 Smart Incident Declaration
- 5.14 One-Click Rollback
- 5.15 Resolution Verification Checklist
- 5.17 Stakeholder Close-Out

---

## Total Capability Count

| Part | Focus Area | Capabilities |
|------|-----------|--------------|
| 1 | AI First Responder | 5 |
| 2 | Infrastructure-Native AI | 4 |
| 3 | Unified Incident Context | 6 |
| 4 | DevOps-Native Architecture | 8 |
| 5 | Full Incident Lifecycle | 20 |
| **Total** | | **43 capabilities** |

This is the roadmap to becoming the best incident management platform on the planet.
