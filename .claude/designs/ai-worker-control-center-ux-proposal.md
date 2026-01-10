# AI Worker Control Center UX Enhancement Proposal

**Document Type:** Product Design & UX Architecture
**Author:** Senior Product Designer Analysis
**Date:** 2026-01-09
**Current State:** ~3,100 LOC React component
**Target Users:** Super Admins, SREs, DevSecOps, Platform Engineers

---

## Executive Summary

The current AI Worker Control Center is a **functional MVP** that has organically grown to handle complex orchestration requirements. This proposal transforms it from a "monitoring dashboard" into an **enterprise-grade Mission Control interface** optimized for high-stakes, time-sensitive operations.

---

## Part I: What's Working Well

### 1. Conceptual Foundations (Keep & Enhance)

| Element | Assessment | Recommendation |
|---------|------------|----------------|
| **Persona Slots Grid** | Excellent mental model | Elevate to primary navigation |
| **Pipeline Visualization** | Clear workflow stages | Add interactive state transitions |
| **Live Terminal Streaming** | Critical for debugging | Enhance with log filtering/search |
| **System On/Off Toggle** | Essential kill switch | Add visual countdown/confirmation |
| **Virtual Manager Panel** | Shows review workflow | Integrate with worker pipeline |
| **Task List with Filters** | Comprehensive data | Needs better information hierarchy |

### 2. Technical Excellence

- **Real-time SSE streaming** for live updates
- **LocalStorage persistence** for user preferences
- **Comprehensive status handling** (15+ states)
- **Proper cleanup** on component unmount
- **Role-based display** (worker vs manager stats)

### 3. Information Completeness

The interface surfaces all necessary data points:
- Worker status, personas, skills
- Task progress, costs, retries
- PR links, CloudWatch log links
- Heartbeat status, timeouts
- Deployment validation states

---

## Part II: Critical Design Gaps

### 1. Information Architecture Problem

**Current:** Flat hierarchy where everything competes for attention equally.

```
┌─────────────────────────────────────────────────────────┐
│ Header (System controls)                                │
├─────────────────────────────────────────────────────────┤
│ Stats Row (6 equal boxes)                               │
├─────────────────────────────────────────────────────────┤
│ Persona Slots (8 cards)                                 │
├─────────────────────────────────────────────────────────┤
│ Manager Panel (3 stats sections)                        │
├─────────────────────────────────────────────────────────┤
│ Active Workflows (pipeline cards)                       │
├─────────────────────────────────────────────────────────┤
│ Workers (expandable cards)                              │
├─────────────────────────────────────────────────────────┤
│ Task Table (10 columns)                                 │
└─────────────────────────────────────────────────────────┘
```

**Problem:** Users must scroll and scan the entire page to understand system state. In incident response, this delays action by critical seconds.

### 2. Missing Operational Patterns

| Pattern | Status | Impact |
|---------|--------|--------|
| **Anomaly Highlighting** | Missing | Silent failures go unnoticed |
| **Action Queue/Undo** | Missing | No ability to batch operations |
| **Keyboard Navigation** | Missing | Mouse-only slows operators |
| **Time-series Context** | Missing | Can't see trends or patterns |
| **Alert Correlation** | Missing | Related issues shown in isolation |

### 3. Visual Design Debt

- Status colors are semantic but overwhelming when many tasks are active
- No visual distinction between "healthy" and "needs attention"
- Terminal output lacks syntax highlighting or structure
- Modals are functional but generic
- No loading skeletons or progressive disclosure

---

## Part III: Proposed Design System

### 1. Layout Architecture: "Mission Control" Pattern

```
┌──────────────────────────────────────────────────────────────────────┐
│ COMMAND BAR                                                          │
│ [System ON] [Orchestrator] [Watcher] │ Alerts: 2 │ Queue: 5 │ ⌘K   │
├────────────┬─────────────────────────────────────────────────────────┤
│            │                                                         │
│  SIDEBAR   │  MAIN CANVAS                                           │
│            │                                                         │
│  Workers   │  ┌─────────────────────────────────────────────────┐   │
│  ──────    │  │ ACTIVE OPERATIONS (Kanban-style swim lanes)    │   │
│  [FE] 🟢   │  │                                                 │   │
│  [BE] 🟡   │  │  Queued → Executing → Review → Deploying       │   │
│  [DO] 🟢   │  │   (3)       (2)        (1)       (0)           │   │
│  [QA] ⚫   │  │                                                 │   │
│            │  └─────────────────────────────────────────────────┘   │
│  ──────    │                                                         │
│  Quick     │  ┌─────────────────────────────────────────────────┐   │
│  Actions   │  │ FOCUSED TASK DETAIL (when selected)            │   │
│            │  │ Terminal + PR + Logs + Actions                 │   │
│  [Run]     │  └─────────────────────────────────────────────────┘   │
│  [Cancel]  │                                                         │
│  [Retry]   │  ┌─────────────────────────────────────────────────┐   │
│            │  │ TIMELINE / HISTORY (collapsed by default)      │   │
└────────────┴──┴─────────────────────────────────────────────────┴───┘
```

### 2. Component Hierarchy: Three-Tier Attention Model

#### Tier 1: Ambient Awareness (Always Visible)
- System health indicator (green/yellow/red beacon)
- Active task count badge
- Queue depth
- Current cost burn rate
- Alert count (if any anomalies)

#### Tier 2: Active Operations (Primary Focus)
- Kanban-style task lanes by workflow stage
- Live task cards with mini-progress indicators
- Drag-to-reorder priority (future)
- Contextual actions on hover

#### Tier 3: Deep Inspection (On-Demand)
- Full terminal output with search
- Task run history with diff view
- Cost breakdown by token type
- Error analysis with suggested actions

### 3. Status Visualization Overhaul

**Current Problem:** 15+ status colors create cognitive overload.

**Solution:** Three-state visual system with contextual details:

| Visual State | Meaning | Colors |
|--------------|---------|--------|
| **Healthy/Active** | Working as expected | Subtle blue glow, no badge |
| **Attention** | Needs monitoring | Amber pulse, warning badge |
| **Critical** | Requires intervention | Red glow, alert badge, sound (optional) |

Status details shown on hover/focus, not inline.

---

## Part IV: Proposed Feature Enhancements

### Phase 1: Foundation (High Impact, Lower Effort)

#### 1.1 Command Palette (⌘K / Ctrl+K)

```typescript
// Quick actions without mouse
- "run task OCS-150"       → Opens task creation with pre-filled key
- "cancel stuck"           → Cancels stuck tasks
- "show failed"            → Filters to failed tasks
- "logs BE-worker"         → Opens terminal for backend worker
- "system off"             → Toggles system (with confirmation)
```

**Rationale:** SREs live in terminals. Command palettes bridge CLI efficiency with GUI discoverability.

#### 1.2 Alert Banner System

When anomalies are detected, show a persistent banner:

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚠️ 2 tasks stuck >30min │ 1 worker has 3 consecutive failures    │
│ [View Stuck Tasks]       [Investigate Worker]        [Dismiss All]│
└────────────────────────────────────────────────────────────────────┘
```

**Trigger conditions:**
- Task heartbeat timeout
- Worker with >2 consecutive failures
- Queue growing while workers idle
- Cost exceeding daily threshold
- Watcher detecting loops

#### 1.3 Keyboard Navigation

| Key | Action |
|-----|--------|
| `j/k` | Navigate task list |
| `Enter` | Open task detail |
| `Esc` | Close modal/panel |
| `t` | Toggle terminal |
| `r` | Retry selected task |
| `c` | Cancel selected task |
| `?` | Show keyboard shortcuts |

#### 1.4 Workflow Swimlanes

Replace the current pipeline cards with horizontal swimlanes:

```
QUEUED (3)          EXECUTING (2)       REVIEW (1)          DEPLOYING (0)
─────────────       ─────────────       ─────────────       ─────────────
┌─────────┐         ┌─────────┐         ┌─────────┐
│ OCS-155 │    ──>  │ OCS-152 │    ──>  │ OCS-150 │    ──>  (empty)
│ BE │ 🟡  │         │ FE │ 🟢  │         │ BE │ 🔵  │
└─────────┘         │ Turn 23/50│        │ PR #98   │
┌─────────┐         └─────────┘         └─────────┘
│ OCS-156 │         ┌─────────┐
│ QA │ 🟡  │         │ OCS-153 │
└─────────┘         │ DO │ 🟢  │
┌─────────┐         └─────────┘
│ OCS-157 │
│ FE │ 🟡  │
└─────────┘
```

**Benefits:**
- Glanceable work-in-progress across all stages
- Natural left-to-right flow
- Visual bottleneck detection (column heights)
- Future: drag cards between columns to reprioritize

### Phase 2: Intelligence Layer (Medium Effort)

#### 2.1 Cost Trend Sparkline

Replace static cumulative cost with:

```
Cumulative Cost        ┌ Burn Rate ─────────────────┐
$127.45                │ $2.15/hr avg   ↑ $0.40 vs │
────────               │ yesterday                  │
[████████░░] 64%       │ ▁▂▃▅▆▇█▇▅▃▂▁              │
of $200 daily cap      └───────────────────────────┘
```

#### 2.2 Worker Health Score

Per-worker success rate visualization:

```
Backend Developer
───────────────────────
Success Rate: 87% ▲
└──────────────────┘
 ████████████░░  (12/14 completed)

Last 5: ✓ ✓ ✗ ✓ ✓
```

#### 2.3 Log Intelligence

Terminal output enhancements:

```
┌─ worker-a1b2c3d4 ──────────────────────────────────────────┐
│ [Filter: errors ▼] [Search: ________] [Auto-scroll: ON]   │
├────────────────────────────────────────────────────────────┤
│ 14:23:45 [INFO]  Reading file /app/src/routes/health.ts   │
│ 14:23:46 [INFO]  Editing file...                          │
│ 14:23:47 [ERROR] Edit failed: old_string not found        │  ← Highlighted
│ 14:23:48 [INFO]  Retrying with different context...       │
│ 14:23:49 [INFO]  Edit successful                          │
│                                                            │
│ ──── AI Self-Recovery Detected ────                       │  ← Collapsed group
│ [Click to expand 3 retry attempts]                        │
└────────────────────────────────────────────────────────────┘
```

#### 2.4 Task Dependency Graph

For complex multi-task workflows, show relationships:

```
OCS-150 (Backend API)
    │
    ├──▶ OCS-151 (Frontend UI) [blocked]
    │
    └──▶ OCS-152 (E2E Tests) [blocked]
```

### Phase 3: Enterprise Features (Higher Effort)

#### 3.1 Audit Log Panel

```
┌─ Activity Log ────────────────────────────────────────────┐
│ 14:30:02  admin@company.com  Cancelled task OCS-145      │
│ 14:28:15  system             Watcher killed stuck task   │
│ 14:25:00  admin@company.com  Changed Manager model       │
│ 14:20:33  system             Task OCS-144 completed      │
│ [Load more...]                                            │
└───────────────────────────────────────────────────────────┘
```

#### 3.2 Scheduled Operations

```
Scheduled Maintenance
───────────────────────────────────────
□ Daily cost reset at 00:00 UTC
□ Weekly watcher health check (Sun 03:00)
☑ Auto-cancel stuck tasks >2hr (enabled)

[+ Add Schedule]
```

#### 3.3 Multi-Environment View

For orgs with staging/production workers:

```
Environment: [Production ▼]  [Staging]  [Development]
```

---

## Part V: Interaction Design Details

### 1. Task Card Component (New Design)

```
┌────────────────────────────────────────────────────┐
│ ▶ OCS-144                                   $0.42  │
│   Add console.log to health endpoint              │
│                                                    │
│   ⚙️ Backend  │  🤖 Haiku  │  Turn 23/50         │
│   ━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░        │
│                                                    │
│   [Terminal ▼]  [PR #98]  [Logs]          [•••]  │
└────────────────────────────────────────────────────┘
```

**Hover state reveals:**
- Started: 2 min ago
- Worker: backend-worker-1
- ETA: ~3 min remaining
- Actions: Cancel, Retry, Prioritize

### 2. Critical Action Confirmation

For destructive operations, require explicit confirmation:

```
┌────────────────────────────────────────────────────┐
│ ⚠️ Cancel 3 Stuck Tasks?                          │
│                                                    │
│ This will immediately terminate:                   │
│  • OCS-145 (executing for 45 min)                 │
│  • OCS-147 (executing for 38 min)                 │
│  • OCS-149 (executing for 31 min)                 │
│                                                    │
│ Estimated cost already incurred: $4.20            │
│                                                    │
│ Type "cancel" to confirm: [__________]            │
│                                                    │
│              [Go Back]  [Cancel Tasks]            │
└────────────────────────────────────────────────────┘
```

### 3. Toast/Notification System

```
┌───────────────────────────────────────┐
│ ✓ Task OCS-144 completed              │
│   PR #98 ready for review             │  ← Action link
│                              [Dismiss]│
└───────────────────────────────────────┘
```

Position: Bottom-right, stacked, auto-dismiss after 5s.

---

## Part VI: Accessibility & Performance

### 1. Accessibility Requirements

- WCAG 2.1 AA compliance minimum
- All interactive elements keyboard-accessible
- Screen reader announcements for status changes
- Color contrast ratios enforced (4.5:1 minimum)
- Reduced motion mode respected
- Focus indicators clearly visible

### 2. Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| First Contentful Paint | <1s | Operators need instant feedback |
| Time to Interactive | <2s | Actions must be immediately available |
| SSE reconnection | <500ms | Real-time updates are critical |
| Terminal scroll | 60fps | No jank during log streaming |
| Memory (100 tasks) | <50MB | Long-running sessions are common |

### 3. Progressive Loading Strategy

1. **Immediate:** Header, system status, alert banner
2. **Fast (<500ms):** Stats grid, persona slots
3. **Normal (<1s):** Active tasks, worker list
4. **Deferred:** Historical task table (paginated)
5. **On-demand:** Terminal logs, task detail modals

---

## Part VII: Implementation Recommendations

### 1. Component Decomposition

The current 3,100 LOC monolith should be split:

```
src/pages/SuperAdminControlCenter/
├── index.tsx                    # Shell + layout
├── hooks/
│   ├── useControlCenterData.ts  # Data fetching
│   ├── useSSEStream.ts          # SSE management
│   ├── useKeyboardShortcuts.ts  # Hotkeys
│   └── useLocalPreferences.ts   # User settings
├── components/
│   ├── CommandBar/              # Header controls
│   ├── SystemStatus/            # Health indicators
│   ├── PersonaSlots/            # Persona grid
│   ├── WorkflowLanes/           # Kanban swimlanes
│   ├── TaskCard/                # Individual task
│   ├── WorkerList/              # Worker section
│   ├── TerminalOutput/          # Log viewer
│   ├── TaskTable/               # History table
│   └── Modals/                  # All modal dialogs
├── contexts/
│   └── ControlCenterContext.tsx # Shared state
└── types.ts                     # TypeScript interfaces
```

### 2. State Management

Consider migrating from local state to:

```typescript
// Zustand store for control center state
interface ControlCenterStore {
  // Data
  stats: ControlCenterStats | null;
  workers: Worker[];
  activeTasks: ActiveTask[];

  // UI State
  selectedTaskId: string | null;
  expandedPanels: Set<string>;
  filterPresets: FilterPreset[];

  // Actions
  selectTask: (id: string) => void;
  retryTask: (id: string) => Promise<void>;
  cancelTask: (id: string, reason: string) => Promise<void>;
}
```

### 3. Testing Strategy

| Test Type | Coverage Target | Focus Areas |
|-----------|-----------------|-------------|
| Unit | 80% | Utility functions, formatters |
| Integration | 70% | Data fetching, SSE handling |
| E2E | Critical paths | System toggle, task lifecycle |
| Visual regression | Key views | Task card, workflow lanes |
| Accessibility | 100% automated | WCAG violations |

---

## Part VIII: Phased Rollout Plan

### Phase 1: Quick Wins (1-2 weeks)
- [ ] Command palette (⌘K)
- [ ] Keyboard navigation
- [ ] Alert banner system
- [ ] Loading skeletons
- [ ] Component file splitting

### Phase 2: Layout Overhaul (2-3 weeks)
- [ ] Sidebar layout
- [ ] Workflow swimlanes
- [ ] Improved task cards
- [ ] Terminal enhancements

### Phase 3: Intelligence (3-4 weeks)
- [ ] Cost sparklines
- [ ] Worker health scores
- [ ] Log filtering/search
- [ ] Audit log panel

### Phase 4: Polish (2 weeks)
- [ ] Animation refinement
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] Documentation

---

## Conclusion

The current AI Worker Control Center has a **solid technical foundation** and comprehensive feature set. The proposed enhancements focus on:

1. **Information hierarchy** - Surfacing what matters most
2. **Operator efficiency** - Keyboard-first, fewer clicks
3. **Proactive alerting** - Anomalies demand attention
4. **Visual clarity** - Less noise, more signal
5. **Enterprise readiness** - Audit trails, access control

The goal is not to rebuild, but to **elevate** - transforming a capable monitoring tool into a world-class control plane that operators trust during critical moments.

---

## Appendix: Design Inspiration

- **AWS CloudWatch** - Log streaming, metric dashboards
- **Datadog APM** - Trace visualization, service maps
- **Linear** - Command palette, keyboard navigation
- **GitHub Actions** - Workflow visualization, run logs
- **Vercel Dashboard** - Deployment pipelines, real-time status
- **PagerDuty** - Incident timeline, escalation flows
