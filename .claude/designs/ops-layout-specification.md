# `/ops` - Mission Control Layout Specification

## Overview

A standalone, full-screen control plane at `https://oncallshift.com/ops` with no app shell, sidebar menus, or navigation chrome. Pure operational interface.

---

## Full Page Layout (1920x1080 reference)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              COMMAND BAR (56px)                                 │
│  OnCallShift OPS   [System ON]  [Orch ON]  [Watch ON]  │ Q:3 │ $4.20 │    ⌘K  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                         ALERT BANNER (0px or 48px)                              │
│  ⚠ 2 tasks stuck longer than 30 minutes          [View]  [Cancel All]  [×]    │
├────────────────────┬────────────────────────────────────────────────────────────┤
│                    │                                                            │
│   WORKER SIDEBAR   │                    MAIN CANVAS                             │
│      (240px)       │                                                            │
│                    │  ┌──────────────────────────────────────────────────────┐  │
│  ┌──────────────┐  │  │              WORKFLOW LANES (280px)                  │  │
│  │ SYSTEM PULSE │  │  │                                                      │  │
│  │  ████░ 78%   │  │  │   QUEUED    EXECUTING    REVIEW     DEPLOYING       │  │
│  │  healthy     │  │  │    (3)        (2)         (1)         (0)           │  │
│  └──────────────┘  │  │                                                      │  │
│                    │  │  ┌─────┐    ┌─────┐     ┌─────┐                      │  │
│  WORKERS           │  │  │ 155 │    │ 152 │     │ 150 │     (empty)         │  │
│  ────────────────  │  │  │ BE  │    │ FE  │     │ BE  │                      │  │
│                    │  │  └─────┘    │23/50│     │ PR  │                      │  │
│  ┌──────────────┐  │  │  ┌─────┐    └─────┘     └─────┘                      │  │
│  │ 🎨 Frontend  │  │  │  │ 156 │    ┌─────┐                                  │  │
│  │    ● working │  │  │  │ QA  │    │ 153 │                                  │  │
│  │    OCS-152   │  │  │  └─────┘    │ DO  │                                  │  │
│  └──────────────┘  │  │  ┌─────┐    └─────┘                                  │  │
│                    │  │  │ 157 │                                             │  │
│  ┌──────────────┐  │  │  │ FE  │                                             │  │
│  │ ⚙️ Backend   │  │  │  └─────┘                                             │  │
│  │    ● working │  │  └──────────────────────────────────────────────────────┘  │
│  │    OCS-155   │  │                                                            │
│  └──────────────┘  │  ┌──────────────────────────────────────────────────────┐  │
│                    │  │              FOCUS PANEL (flex)                      │  │
│  ┌──────────────┐  │  │                                                      │  │
│  │ 🔧 DevOps    │  │  │  OCS-152: Add dark mode toggle         $0.42  [×]   │  │
│  │    ● working │  │  │  ───────────────────────────────────────────────    │  │
│  │    OCS-153   │  │  │                                                      │  │
│  └──────────────┘  │  │  [Details]  [Terminal]  [PR #98]  [Logs]            │  │
│                    │  │                                                      │  │
│  ┌──────────────┐  │  │  ┌────────────────────────────────────────────────┐  │  │
│  │ 🧪 QA        │  │  │  │ $ claude --task OCS-152                       │  │  │
│  │    ○ idle    │  │  │  │ [14:23:45] Reading health.ts...               │  │  │
│  │              │  │  │  │ [14:23:46] Editing file...                    │  │  │
│  └──────────────┘  │  │  │ [14:23:47] Running type check...              │  │  │
│                    │  │  │ [14:23:48] Creating commit...                 │  │  │
│  ────────────────  │  │  │ [14:23:49] Pushing to remote...               │  │  │
│                    │  │  │ █                                              │  │  │
│  QUICK ACTIONS     │  │  └────────────────────────────────────────────────┘  │  │
│                    │  │                                                      │  │
│  [+ Run Task    ]  │  │  Progress: ████████████░░░░░░░░  Turn 23/50         │  │
│  [↻ Retry Failed]  │  │                                                      │  │
│  [⊗ Cancel Stuck]  │  │  [Cancel Task]  [Retry]  [View in Jira ↗]           │  │
│                    │  └──────────────────────────────────────────────────────┘  │
│  ────────────────  │                                                            │
│                    │  ┌──────────────────────────────────────────────────────┐  │
│  STATS             │  │              HISTORY TABLE (collapsed)      [▼]     │  │
│  Today: 12 done    │  └──────────────────────────────────────────────────────┘  │
│  Failed: 2         │                                                            │
│  Cost: $14.20      │                                                            │
│                    │                                                            │
└────────────────────┴────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Command Bar (Top Strip)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ◉ OnCallShift OPS   │ [🟢 ON] [Orch] [Watch] │ Q:3  A:2  │ $4.20/hr │    ⌘K   │
└─────────────────────────────────────────────────────────────────────────────────┘
  │                     │                        │            │           │
  │                     │                        │            │           └─ Command palette trigger
  │                     │                        │            └─ Burn rate (live)
  │                     │                        └─ Queue:3, Active:2
  │                     └─ System toggles (clickable)
  └─ Logo/title (click → back to main app)
```

**Behavior:**
- Fixed at top, always visible
- System toggles show loading state when clicked
- ⌘K opens command palette modal
- Burn rate updates every 30s

---

### 2. Alert Banner (Conditional)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ⚠  2 tasks stuck > 30 min  │  1 worker has 3 consecutive failures             │
│                            │                                      [Fix] [×]    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Trigger Conditions:**
- Task with no heartbeat > 10 min
- Worker with 3+ consecutive failures
- Queue growing while workers idle
- Cost exceeds threshold ($50/day default)
- Watcher detects retry loops

**States:**
- Hidden (0px) when no alerts
- Visible (48px) with amber background when active
- Multiple alerts stack as pills
- Click [×] dismisses for 1 hour

---

### 3. Worker Sidebar (Left Panel)

```
┌──────────────────┐
│   SYSTEM PULSE   │
│                  │
│   ████████░░     │  ← Health bar (tasks succeeded / total today)
│   12/14 = 86%    │
│   ● healthy      │  ← Green dot, or amber/red if issues
│                  │
└──────────────────┘

┌──────────────────┐
│ 🎨 Frontend      │  ← Persona emoji + name
│    ● working     │  ← Status indicator
│    OCS-152       │  ← Current task (if any)
│    ████████░░    │  ← Mini progress bar
│    23/50 turns   │
└──────────────────┘

┌──────────────────┐
│ ⚙️ Backend       │
│    ● working     │
│    OCS-155       │
│    ███░░░░░░░    │
│    8/50 turns    │
└──────────────────┘

┌──────────────────┐
│ 🧪 QA            │
│    ○ idle        │  ← Empty circle = idle
│                  │
│    Ready         │
└──────────────────┘
```

**Worker Card States:**

| State | Indicator | Background |
|-------|-----------|------------|
| Working | `●` green pulse | Subtle green tint |
| Idle | `○` gray | Default |
| Failed | `●` red | Subtle red tint |
| Paused | `◐` amber | Subtle amber tint |

**Interaction:**
- Click worker → Filters main canvas to that worker
- Hover → Shows tooltip with full stats
- Right-click → Context menu (pause, view history)

---

### 4. Workflow Lanes (Kanban)

```
      QUEUED           EXECUTING          REVIEW           DEPLOYING
        (3)               (2)              (1)               (0)
  ─────────────    ─────────────     ─────────────     ─────────────

  ┌───────────┐    ┌───────────┐     ┌───────────┐
  │  OCS-155  │    │  OCS-152  │     │  OCS-150  │      (empty)
  │  ───────  │    │  ───────  │     │  ───────  │
  │  ⚙️ BE    │    │  🎨 FE    │     │  ⚙️ BE    │
  │           │    │           │     │           │
  │  Waiting  │    │ ████░ 46% │     │  PR #98   │
  │           │    │ Turn 23   │     │  Pending  │
  └───────────┘    └───────────┘     └───────────┘

  ┌───────────┐    ┌───────────┐
  │  OCS-156  │    │  OCS-153  │
  │  ───────  │    │  ───────  │
  │  🧪 QA    │    │  🔧 DO    │
  └───────────┘    └───────────┘

  ┌───────────┐
  │  OCS-157  │
  │  ───────  │
  │  🎨 FE    │
  └───────────┘
```

**Task Card (in lane):**
```
┌─────────────────────┐
│ OCS-152         $0.42│  ← Jira key + cost
│ ─────────────────── │
│ Add dark mode toggle│  ← Summary (truncated)
│                     │
│ 🎨 FE  │  Haiku    │  ← Persona + Model badge
│ ████████████░░░ 46% │  ← Progress bar
│ Turn 23/50          │  ← Turn count
└─────────────────────┘
```

**Interaction:**
- Click card → Opens in Focus Panel below
- Hover → Shows full summary tooltip
- Double-click → Opens in Jira (new tab)
- Cards are visually connected when same PR
- Column headers show count badge

**Visual Cues:**
- Cards glow subtly when actively executing
- Red border if task has error
- Amber border if stuck
- Green checkmark overlay when transitioning to next stage

---

### 5. Focus Panel (Detail View)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  OCS-152: Add dark mode toggle to settings                     $0.42    [×]    │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  [Details]    [Terminal]    [PR #98 ↗]    [CloudWatch ↗]    [Jira ↗]          │
│      ▲                                                                          │
│      └── Tab navigation (keyboard: 1-5)                                        │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─ TERMINAL ─────────────────────────────────────────────────────────────────┐│
│  │                                                     [Filter ▼] [Search 🔍] ││
│  │ $ claude --task OCS-152 --model haiku                                      ││
│  │                                                                             ││
│  │ [14:23:41] Starting task execution...                                      ││
│  │ [14:23:42] Cloning repository...                                           ││
│  │ [14:23:45] Reading settings component...                                   ││
│  │ [14:23:46] Analyzing existing theme system...                              ││
│  │ [14:23:47] Planning implementation approach...                             ││
│  │ [14:23:48] ─── AI Analysis ────────────────────────                        ││
│  │            I'll add a toggle switch to the existing                        ││
│  │            Settings page that controls a dark mode                         ││
│  │            CSS class on the root element...                                ││
│  │ [14:23:49] Editing SettingsPage.tsx...                                     ││
│  │ [14:23:50] Adding useTheme hook...                                         ││
│  │ [14:23:51] Running type check... ✓                                         ││
│  │ [14:23:52] Creating commit...                                              ││
│  │ █                                                    ← Live cursor         ││
│  │                                                                             ││
│  │ ──────────────────────────────────────────────────────────────────────────-││
│  │ ● LIVE                                              Auto-scroll: ON        ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                 │
│  Progress: ████████████████████░░░░░░░░░░░░░░░░░░░░  Turn 23/50   ETA: ~3min  │
│                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────┐│
│  │  [Cancel Task]      [Retry]      [Add Note]      [Escalate to Human]      ││
│  └────────────────────────────────────────────────────────────────────────────┘│
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Tabs:**

| Tab | Content |
|-----|---------|
| Details | Metadata grid: started, worker, model, retries, heartbeat |
| Terminal | Live streaming logs (default for executing tasks) |
| PR | Embedded PR diff preview (if PR exists) |
| CloudWatch | Direct link to AWS logs |
| Jira | Direct link to ticket |

**Terminal Features:**
- Auto-scroll (toggleable)
- Filter dropdown: All, Errors, AI Output, Git Operations
- Search box with regex support
- Syntax highlighting for code blocks
- Collapsible "AI thinking" sections
- Copy button for log lines

---

### 6. History Table (Collapsed by Default)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  HISTORY                                        [Search: ______] [Filter ▼]  [▼]│
└─────────────────────────────────────────────────────────────────────────────────┘

  ↓ Expands to:

┌─────────────────────────────────────────────────────────────────────────────────┐
│  HISTORY                                        [Search: ______] [Filter ▼]  [▲]│
├─────────────────────────────────────────────────────────────────────────────────┤
│  Task      │ Time     │ Summary              │ Status    │ Cost  │ Actions     │
│  ──────────│──────────│──────────────────────│───────────│───────│─────────────│
│  OCS-149   │ 2h ago   │ Fix webhook timeout  │ ✓ Done    │ $1.20 │ [↗] [🗑]    │
│  OCS-148   │ 3h ago   │ Add retry logic      │ ✓ Done    │ $0.80 │ [↗] [🗑]    │
│  OCS-147   │ 4h ago   │ Update docs          │ ✗ Failed  │ $0.45 │ [↻] [↗] [🗑]│
│  OCS-146   │ 5h ago   │ Refactor auth        │ ✓ Done    │ $2.10 │ [↗] [🗑]    │
│  ...       │          │                      │           │       │             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              [Load More]                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Virtual scrolling for performance
- Click row → Opens in Focus Panel
- Inline actions: Retry, Open PR, Delete
- Filter: All, Completed, Failed, Cancelled
- Search: By Jira key or summary text

---

## Interactive States

### Command Palette (⌘K)

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍  Type a command or search...                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  QUICK ACTIONS                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  ▶  Run task...                                    ⌘R          │
│  ↻  Retry failed tasks                             ⌘⇧R         │
│  ⊗  Cancel stuck tasks                             ⌘⇧C         │
│  ⏸  Pause system                                   ⌘P          │
│                                                                 │
│  NAVIGATION                                                     │
│  ─────────────────────────────────────────────────────────────  │
│  →  Go to task OCS-...                             ⌘G          │
│  ←  Back to dashboard                              Esc         │
│  ↓  Show history                                   ⌘H          │
│                                                                 │
│  RECENT TASKS                                                   │
│  ─────────────────────────────────────────────────────────────  │
│     OCS-152  Add dark mode toggle         (executing)          │
│     OCS-150  Fix health endpoint          (review)             │
│     OCS-149  Update webhook handler       (completed)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Run Task Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Run New Task                                             [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Jira Issue Key                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ OCS-                                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Worker Persona                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ⚙️ Backend Developer                               ▼   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Model (optional)                                               │
│  ○ Haiku (fast, cheap)                                         │
│  ● Sonnet (balanced) ← default                                 │
│  ○ Opus (complex tasks)                                        │
│                                                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      [Run Task]                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Responsive Behavior

### Desktop (≥1280px)
Full layout as shown above.

### Laptop (1024-1279px)
- Sidebar collapses to icons only (48px)
- Hover to expand sidebar temporarily
- Workflow lanes scroll horizontally

### Tablet (768-1023px)
- Sidebar becomes bottom tab bar
- Workflow lanes stack vertically
- Focus panel becomes full-screen modal

### Mobile (<768px)
- Not officially supported (warning message)
- Suggest using main app or CLI instead

---

## Color Palette

```
Background:     #0a0a0b (near black)
Surface:        #141416 (cards, panels)
Border:         #27272a (subtle lines)
Text Primary:   #fafafa (white)
Text Secondary: #a1a1aa (gray)
Text Muted:     #52525b (dark gray)

Accent Blue:    #3b82f6 (primary actions)
Success Green:  #22c55e (completed, healthy)
Warning Amber:  #f59e0b (attention needed)
Error Red:      #ef4444 (failed, critical)
Purple:         #a855f7 (review states)

Glow Effect:    0 0 20px rgba(59, 130, 246, 0.3)
```

---

## Keyboard Shortcuts Reference

| Key | Action |
|-----|--------|
| `⌘K` | Open command palette |
| `⌘R` | Run new task |
| `⌘G` | Go to task by key |
| `Esc` | Close modal / deselect |
| `j` / `↓` | Next task in list |
| `k` / `↑` | Previous task in list |
| `Enter` | Open selected task |
| `t` | Toggle terminal |
| `r` | Retry selected task |
| `c` | Cancel selected task |
| `1-5` | Switch focus panel tabs |
| `?` | Show keyboard shortcuts |

---

## Animation Specifications

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Card enter | Fade + slide up | 200ms | ease-out |
| Card move between lanes | Slide horizontal | 300ms | ease-in-out |
| Terminal log line | Fade in | 100ms | linear |
| Alert banner | Slide down | 200ms | ease-out |
| Modal open | Fade + scale | 150ms | ease-out |
| Status pulse | Opacity 0.5→1→0.5 | 2000ms | ease-in-out, infinite |
| Progress bar | Width transition | 500ms | linear |

---

## Data Flow

```
                    ┌─────────────────┐
                    │   SSE Stream    │
                    │  /control-center│
                    │     /stream     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  Stats   │  │  Tasks   │  │ Workers  │
        │  Update  │  │  Update  │  │  Update  │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                    ┌─────────────────┐
                    │  Zustand Store  │
                    │   (or Context)  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  ┌──────────┐        ┌──────────┐        ┌──────────┐
  │  Sidebar │        │   Lanes  │        │  Focus   │
  │Component │        │Component │        │  Panel   │
  └──────────┘        └──────────┘        └──────────┘
```

---

## Next Steps

1. **Confirm layout** - Does this match your vision?
2. **Prioritize features** - What's MVP vs. nice-to-have?
3. **Start implementation** - I'll build it component by component

Let me know if you want any section adjusted before I start coding.
