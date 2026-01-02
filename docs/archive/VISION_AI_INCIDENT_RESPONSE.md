# OnCallShift Vision: AI-First Incident Response

## The Problem Today

Users face a fragmented experience:
- AI diagnosis requires manual API key setup per user
- Runbooks exist but aren't surfaced proactively
- No RCA tracking or learning from past incidents
- Multiple clicks to understand and remediate
- No continuity between incidents

## The Future State: Zero-Friction, AI-Powered Incident Response

### Core Philosophy
> "From alert to resolution in 60 seconds or less, even from a mobile phone"

### The Unified Workflow

```
INCIDENT ARRIVES
      │
      ▼
┌─────────────────────────────────────┐
│  AI Auto-Analysis (0 user action)   │
│  • Likely root cause                │
│  • Suggested actions                │
│  • Similar past incidents           │
│  • Recommended runbook              │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Quick Actions Panel                │
│  ┌─────────┐ ┌─────────┐           │
│  │Restart  │ │Rollback │ [More ▼] │
│  │ Pods    │ │  Now    │           │
│  └─────────┘ └─────────┘           │
│  One-tap remediation               │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Resolution Flow                    │
│  • AI drafts RCA automatically     │
│  • Engineer reviews/edits          │
│  • One-tap resolve with RCA        │
│  • Feeds learning loop             │
└─────────────────────────────────────┘
```

## Key Changes Required

### 1. Organization-Level AI Configuration
**Current**: Each user must add their own Anthropic API key
**Future**: Admin configures org-level key once, AI works for everyone

```
Admin Settings → AI Configuration
├── Anthropic API Key: sk-ant-***...
├── Auto-analyze new incidents: ✓ Enabled
├── AI model: Claude Sonnet (fast) / Claude Opus (thorough)
└── Monthly usage: $12.50 / $50 budget
```

### 2. Auto-Analysis on Incident View
**Current**: User clicks "Analyze with Claude" button
**Future**: Analysis runs automatically when incident opens

```typescript
// When incident detail loads:
useEffect(() => {
  if (!incident.aiAnalysis) {
    // Auto-trigger analysis in background
    triggerAIAnalysis(incident.id);
  }
}, [incident.id]);
```

The UI shows:
- Skeleton loader while analyzing
- AI analysis card appears automatically
- No button clicks required

### 3. Unified "Quick Actions" Panel
**Current**: Runbook steps in collapsible panel, separate from actions
**Future**: Prominent action buttons based on context

```
┌────────────────────────────────────────────┐
│ ⚡ Quick Actions                           │
│                                            │
│ AI Recommended:                            │
│ ┌──────────────┐ ┌──────────────┐         │
│ │ 🔄 Restart   │ │ ⬆️ Scale Up  │         │
│ │    Pods      │ │   to 5       │         │
│ │   ~2 min     │ │   ~1 min     │         │
│ └──────────────┘ └──────────────┘         │
│                                            │
│ From Runbook "Database Connection Fix":    │
│ ┌──────────────┐                          │
│ │ 🗑️ Flush     │                          │
│ │   Cache      │  [View Full Runbook →]   │
│ │   ~1 min     │                          │
│ └──────────────┘                          │
└────────────────────────────────────────────┘
```

### 4. AI-Powered Resolution with RCA
**Current**: Just "Resolve" button
**Future**: Resolution flow with AI-drafted RCA

```
┌────────────────────────────────────────────┐
│ ✅ Resolve Incident                        │
│                                            │
│ Root Cause Analysis (AI Draft):            │
│ ┌────────────────────────────────────────┐ │
│ │ The incident was caused by database    │ │
│ │ connection pool exhaustion due to a    │ │
│ │ spike in traffic from the marketing    │ │
│ │ campaign launch. The connection pool   │ │
│ │ max_connections setting of 20 was      │ │
│ │ insufficient for the 3x traffic        │ │
│ │ increase.                              │ │
│ │                                        │ │
│ │ Actions taken:                         │ │
│ │ • Restarted API pods (17:32)          │ │
│ │ • Scaled to 5 replicas (17:35)        │ │
│ │                                        │ │
│ │ Prevention:                            │ │
│ │ • Increase max_connections to 50      │ │
│ │ • Add connection pool monitoring      │ │
│ └────────────────────────────────────────┘ │
│ [Edit] [Regenerate]                        │
│                                            │
│ ┌──────────────────────────────────────┐  │
│ │ ✓ Resolve with RCA                   │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ [ ] Create follow-up ticket                │
│ [ ] Skip RCA (not recommended)             │
└────────────────────────────────────────────┘
```

### 5. Incident Learning Loop
**Current**: Incidents are isolated events
**Future**: AI learns from past incidents

```
Similar Past Incidents:
┌────────────────────────────────────────────┐
│ 🔍 Found 3 similar incidents               │
│                                            │
│ #INC-2024-0892 (2 weeks ago)              │
│ "Database connection timeout"              │
│ Resolved by: Restart pods                  │
│ RCA: Connection pool exhaustion            │
│                                            │
│ #INC-2024-0756 (1 month ago)              │
│ "API latency spike"                        │
│ Resolved by: Scale up + restart            │
│ RCA: Memory pressure from traffic spike    │
│                                            │
│ [Apply same fix] [View details]            │
└────────────────────────────────────────────┘
```

### 6. Mobile-Optimized Design
Every action must work with one thumb:

```
┌─────────────────────┐
│ 🔴 CRITICAL         │
│ Database timeout    │
│ Production API      │
├─────────────────────┤
│ AI: Likely DB pool  │
│ exhaustion. 89%     │
│ confidence.         │
├─────────────────────┤
│ ┌─────────────────┐ │
│ │  🔄 RESTART     │ │
│ │     PODS        │ │
│ │    [TAP]        │ │
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │  ⬆️ SCALE UP    │ │
│ │    [TAP]        │ │
│ └─────────────────┘ │
├─────────────────────┤
│ [ACK] [ESCALATE]    │
│     [RESOLVE]       │
└─────────────────────┘
```

## Database Changes

### New Fields on Incidents Table
```sql
ALTER TABLE incidents ADD COLUMN ai_analysis JSONB;
ALTER TABLE incidents ADD COLUMN ai_analysis_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE incidents ADD COLUMN root_cause_analysis TEXT;
ALTER TABLE incidents ADD COLUMN rca_source VARCHAR(20); -- 'ai_draft', 'user', 'ai_approved'
ALTER TABLE incidents ADD COLUMN similar_incidents UUID[];
ALTER TABLE incidents ADD COLUMN actions_taken JSONB DEFAULT '[]';
```

### Actions Taken Tracking
```json
{
  "actions_taken": [
    {
      "action": "restart-pods",
      "timestamp": "2024-12-30T17:32:00Z",
      "executedBy": "user-id",
      "result": "success",
      "details": {"podsRestarted": 3}
    }
  ]
}
```

## API Changes

### Auto-Analysis Endpoint
```
POST /api/v1/incidents/:id/auto-analyze
- Triggered automatically when incident viewed
- Uses org's Anthropic API key
- Stores result in ai_analysis field
- Returns cached result if < 5 min old
```

### Resolution with RCA
```
POST /api/v1/incidents/:id/resolve
{
  "rootCauseAnalysis": "...",
  "rcaSource": "ai_approved",
  "createFollowUp": true
}
```

### AI Draft RCA
```
POST /api/v1/incidents/:id/draft-rca
- Uses incident timeline, actions taken, AI analysis
- Returns suggested RCA text
```

### Similar Incidents
```
GET /api/v1/incidents/:id/similar
- Uses AI embeddings or keyword matching
- Returns past incidents with similar:
  - Service
  - Summary keywords
  - Error patterns
```

## Implementation Priority

### Phase 1: Foundation (This Sprint)
1. ✅ Runbook actions (DONE)
2. Add RCA field to incidents table
3. Update resolve flow to capture RCA
4. Track actions taken on incidents

### Phase 2: AI Integration
1. Org-level API key storage (use existing Anthropic credential system)
2. Auto-analyze on incident view
3. AI draft RCA on resolution

### Phase 3: Intelligence
1. Similar incidents feature
2. Learning from past RCAs
3. AI confidence scoring
4. Predictive suggestions

### Phase 4: Mobile Excellence
1. Redesign mobile incident view
2. Large touch targets
3. Swipe gestures for common actions
4. Push notification actions

## Setup Wizard: Zero-to-Value in 5 Minutes

### The Problem with Current Setup
- Services created separately from runbooks
- Runbooks manually linked to services
- Action webhooks require technical configuration
- No guidance on best practices
- Users don't know what they don't know

### The Solution: Guided Setup Wizard

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  🚀 Let's set up OnCallShift in 5 minutes                 │
│                                                            │
│  ━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Step 2 of 5: Your Services                               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Step 1: Welcome & AI Setup
```
┌────────────────────────────────────────────────────────────┐
│  🤖 Enable AI-Powered Incident Response                   │
│                                                            │
│  OnCallShift uses Claude AI to:                           │
│  • Automatically analyze incidents                         │
│  • Suggest root causes                                     │
│  • Draft post-incident reports                            │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Anthropic API Key                                    │ │
│  │ sk-ant-api03-●●●●●●●●●●●●●●●●●●●●●●●●●●●●●           │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Don't have one? [Get API Key →]                          │
│                                                            │
│  ☐ Skip for now (AI features will be disabled)            │
│                                                            │
│                          [Continue →]                      │
└────────────────────────────────────────────────────────────┘
```

### Step 2: Define Your Services
```
┌────────────────────────────────────────────────────────────┐
│  🛠️ What services do you need to monitor?                 │
│                                                            │
│  Select from templates or create custom:                   │
│                                                            │
│  Popular Templates:                                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ 🌐 Web      │ │ 🔌 API      │ │ 🗄️ Database │         │
│  │ Application │ │ Service     │ │ Service     │         │
│  │ [+ Add]     │ │ [+ Add]     │ │ [+ Add]     │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ 📦 Queue    │ │ 🔐 Auth     │ │ 💳 Payment  │         │
│  │ Worker      │ │ Service     │ │ Service     │         │
│  │ [+ Add]     │ │ [+ Add]     │ │ [+ Add]     │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                            │
│  Your Services:                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ✓ Production API                              [Edit] │ │
│  │ ✓ Web Application                             [Edit] │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  [+ Add Custom Service]                                    │
│                                                            │
│                          [Continue →]                      │
└────────────────────────────────────────────────────────────┘
```

### Step 3: Configure Quick Actions (Per Service)
```
┌────────────────────────────────────────────────────────────┐
│  ⚡ Set up Quick Actions for "Production API"             │
│                                                            │
│  What can you do to fix issues with this service?         │
│                                                            │
│  Common Actions (select all that apply):                   │
│                                                            │
│  ☑ 🔄 Restart Service                                     │
│     Command: kubectl rollout restart deployment/api        │
│     Est. time: ~2 min                                      │
│                                                            │
│  ☑ ⬆️ Scale Up                                            │
│     Command: kubectl scale deployment/api --replicas=5     │
│     Est. time: ~1 min                                      │
│                                                            │
│  ☑ ⏪ Rollback                                            │
│     Command: kubectl rollout undo deployment/api           │
│     Est. time: ~2 min                                      │
│                                                            │
│  ☐ 🗑️ Clear Cache                                         │
│  ☐ 🔄 Restart Dependencies                                │
│  ☐ 📊 Enable Debug Logging                                │
│                                                            │
│  [+ Add Custom Action]                                     │
│                                                            │
│  How should these actions execute?                         │
│  ○ Demo Mode (simulate actions, log results)              │
│  ○ Webhook (call your endpoint)                           │
│  ○ AWS Lambda (coming soon)                               │
│  ○ Kubernetes API (coming soon)                           │
│                                                            │
│                          [Continue →]                      │
└────────────────────────────────────────────────────────────┘
```

### Step 4: Set Up Alerts
```
┌────────────────────────────────────────────────────────────┐
│  🔔 How will alerts reach OnCallShift?                    │
│                                                            │
│  Select your monitoring tools:                             │
│                                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ 📊 Datadog  │ │ 🔥 PagerDuty│ │ 📈 Grafana  │         │
│  │ [Connect]   │ │ [Connect]   │ │ [Connect]   │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ ☁️ AWS      │ │ 🌀 Uptime   │ │ 🔗 Webhook  │         │
│  │ CloudWatch  │ │ Robot       │ │ (Generic)   │         │
│  │ [Connect]   │ │ [Connect]   │ │ [Connect]   │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                            │
│  Your webhook endpoint:                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ https://oncallshift.com/api/v1/alerts/webhook/abc123 │ │
│  │                                         [📋 Copy]    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  [Send Test Alert]                                         │
│                                                            │
│                          [Continue →]                      │
└────────────────────────────────────────────────────────────┘
```

### Step 5: Invite Your Team
```
┌────────────────────────────────────────────────────────────┐
│  👥 Invite your team                                       │
│                                                            │
│  Who should respond to incidents?                          │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Email addresses (one per line)                       │ │
│  │ alice@company.com                                    │ │
│  │ bob@company.com                                      │ │
│  │ charlie@company.com                                  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ☑ Set up a simple on-call rotation                       │
│    (Each person is on-call for 1 week)                    │
│                                                            │
│                                                            │
│                    [🎉 Complete Setup]                     │
└────────────────────────────────────────────────────────────┘
```

### Step 6: Success!
```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                    🎉 You're all set!                      │
│                                                            │
│  OnCallShift is ready to help you resolve incidents        │
│  faster with AI-powered analysis and one-click actions.    │
│                                                            │
│  What you set up:                                          │
│  ✓ 2 services with quick actions                          │
│  ✓ AI-powered incident analysis                           │
│  ✓ Webhook endpoint for alerts                            │
│  ✓ 3 team members invited                                 │
│                                                            │
│  Next steps:                                               │
│  • Install the mobile app for on-the-go response          │
│  • Configure your monitoring tool to send alerts          │
│  • Try the demo incident to see it in action              │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           [📱 Get Mobile App]                        │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           [🧪 Try Demo Incident]                     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           [→ Go to Dashboard]                        │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Service Templates with Pre-built Runbooks

Each template comes with:
1. **Service definition** (name, description, severity mappings)
2. **Default runbook** with common actions
3. **Alert routing rules**

#### API Service Template
```json
{
  "name": "API Service",
  "description": "REST/GraphQL API endpoints",
  "defaultRunbook": {
    "name": "API Incident Response",
    "steps": [
      {"action": "restart", "label": "Restart Pods", "command": "kubectl rollout restart"},
      {"action": "scale", "label": "Scale Up", "command": "kubectl scale --replicas=5"},
      {"action": "rollback", "label": "Rollback", "command": "kubectl rollout undo"},
      {"action": "logs", "label": "Tail Logs", "command": "kubectl logs -f"}
    ]
  },
  "severityMapping": {
    "5xx_rate > 10%": "critical",
    "5xx_rate > 5%": "error",
    "latency_p99 > 2s": "warning"
  }
}
```

#### Database Service Template
```json
{
  "name": "Database Service",
  "description": "PostgreSQL, MySQL, or MongoDB",
  "defaultRunbook": {
    "name": "Database Incident Response",
    "steps": [
      {"action": "connections", "label": "Reset Connections", "command": "pg_terminate_backend"},
      {"action": "vacuum", "label": "Run VACUUM", "command": "VACUUM ANALYZE"},
      {"action": "replica", "label": "Failover to Replica", "command": "promote replica"},
      {"action": "slow_queries", "label": "Kill Slow Queries", "command": "pg_cancel_backend"}
    ]
  }
}
```

### Implementation: Wizard Flow

```typescript
// frontend/src/pages/SetupWizard.tsx
export function SetupWizard() {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    aiApiKey: '',
    services: [],
    actions: {},
    alertEndpoint: '',
    teamMembers: []
  });

  const steps = [
    { id: 1, name: 'AI Setup', component: AISetupStep },
    { id: 2, name: 'Services', component: ServicesStep },
    { id: 3, name: 'Actions', component: ActionsStep },
    { id: 4, name: 'Alerts', component: AlertsStep },
    { id: 5, name: 'Team', component: TeamStep },
    { id: 6, name: 'Complete', component: CompleteStep }
  ];

  // Auto-save progress to localStorage
  // Allow resuming setup later
  // Track completion for onboarding metrics
}
```

### Backend: Wizard Completion Endpoint

```typescript
// POST /api/v1/setup/complete
// Creates all resources in one transaction
{
  "aiApiKey": "sk-ant-...",
  "services": [
    {
      "template": "api",
      "name": "Production API",
      "actions": ["restart", "scale", "rollback"]
    }
  ],
  "teamMembers": ["alice@company.com", "bob@company.com"],
  "createRotation": true
}
```

This endpoint:
1. Saves org-level AI API key (encrypted)
2. Creates services from templates
3. Creates runbooks with selected actions
4. Generates unique webhook endpoint
5. Sends team invitations
6. Creates default on-call rotation

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time to first remediation action | ~5 min | < 30 sec |
| % incidents with RCA | ~10% | > 80% |
| Mobile resolution rate | Unknown | > 50% |
| Repeat incidents (same root cause) | Unknown | -30% |

## Competitive Differentiation

vs PagerDuty:
- AI-first, not AI-added
- One-click remediation built-in
- RCA as core feature, not enterprise add-on

vs incident.io:
- Mobile-native remediation
- Zero-config AI analysis
- Integrated runbook execution

vs Rootly:
- Simpler UX for smaller teams
- Lower price point
- Faster time to value

---

This vision transforms OnCallShift from an "alert forwarder" to an
"AI incident resolution platform" that actually fixes problems.
