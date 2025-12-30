# OnCallShift Mobile UX Analysis & Strategic Plan

> Generated: December 2024
> Purpose: Comprehensive UX analysis and phased implementation roadmap for the OnCallShift mobile app

---

## Table of Contents

1. [Industry & Pattern Analysis](#1-industry--pattern-analysis)
2. [Current App Gap Analysis](#2-current-app-gap-analysis)
3. [Proposed Mobile UX Architecture](#3-proposed-mobile-ux-architecture)
4. [Phased Implementation Plan](#4-phased-implementation-plan)

---

## 1. Industry & Pattern Analysis

### 1.1 Navigation Structure Patterns

**Industry Standard: Bottom Tab + Contextual Stack**

| App | Primary Tabs | Key Pattern |
|-----|--------------|-------------|
| **PagerDuty** | Incidents, On-Call, More | Incidents as default home; badge counts on tabs |
| **Opsgenie** | Alerts, On-Call, Teams, More | Alert-centric with quick filters |
| **Squadcast** | Incidents, Services, Schedules, Profile | Service-oriented hierarchy |
| **VictorOps** | Timeline, Team, Schedules, Settings | Timeline-first (activity feed) |

**Common Pattern**: 3-4 primary tabs with **Incidents/Alerts as the leftmost (default) tab**. Settings/Profile pushed to "More" or rightmost position.

### 1.2 Incident List & Detail Patterns

**List View Best Practices:**
- **Severity-first visual hierarchy**: Color-coded left border or badge (red=critical, orange=high, yellow=medium, blue=low)
- **State indicators**: Clear triggered/acknowledged/resolved states with distinct colors
- **Time context**: Relative time ("2m ago") prominently displayed
- **Ownership clarity**: Avatar or initials of who's handling it
- **Service context**: Service name always visible (not just incident title)
- **Quick actions**: Swipe-to-acknowledge is table stakes; some allow swipe-to-resolve

**Detail View Best Practices:**
- **Action buttons fixed at bottom**: Never scroll to find Acknowledge/Resolve
- **Timeline as core UI**: Event history is central, not hidden
- **Runbook integration**: Linked or embedded guidance
- **Responder list**: Who's been notified, who's responded
- **Related context**: Links to dashboards, logs, related incidents

### 1.3 Escalation & Acknowledgement Flows

**Key Principles:**
1. **One-tap acknowledge** from list, notification, or detail
2. **Confirmation for destructive actions** (resolve, reassign, snooze)
3. **Escalation as explicit action** with clear recipient preview
4. **Snooze with preset durations** (15m, 30m, 1h, custom)
5. **Reassign to person OR schedule** (not just individuals)

**Notification Quick Actions (iOS/Android):**
- PagerDuty: Acknowledge, Resolve, Escalate (3 actions)
- Opsgenie: Acknowledge, Close, Add Note
- Best practice: 2-3 actions max; Acknowledge is always first

### 1.4 Schedules & On-Call Handoff

**Schedule Display Patterns:**
- **"Who's on call now"** is the hero metric (photo + name + time remaining)
- **Next up** clearly visible for handoff awareness
- **My shifts** filtered view with calendar integration
- **Override capability** accessible but not prominent
- **Time zone awareness** explicit in all time displays

**Handoff UX:**
- Visual countdown to shift end
- Notification before handoff (configurable: 15m, 1h, 1d)
- One-tap "Take On-Call" override for emergencies

### 1.5 Notifications & Inbox Handling

**Notification Hierarchy:**
1. **Critical/P1**: Sound + vibration + persistent notification + phone call fallback
2. **High/P2**: Sound + vibration + push
3. **Medium/P3**: Push only, can be batched
4. **Low/P4**: Badge only, optional push

**Inbox Patterns:**
- **Unread count badge** on app icon AND tab
- **Grouped by incident** (not flat list of events)
- **Mark all read** for inbox zero
- **Filter: Mentions, Assigned to me, All**

### 1.6 Core UX Principles for Incident Management

| Principle | Implementation |
|-----------|----------------|
| **Speed over polish** | Large tap targets, minimal navigation depth |
| **Clarity of ownership** | Always show who's handling what |
| **Visibility of state** | Color + icon + text redundancy for states |
| **Escalation path visibility** | Show "if you don't ack in X, Y gets paged" |
| **Undo safety** | Acknowledge is reversible; resolve may require confirmation |
| **Offline resilience** | Queue actions when offline, sync when back |
| **Quiet hours respect** | Clear indication when in/out of quiet hours |

---

## 2. Current App Gap Analysis

### 2.1 What We Do Well

| Strength | Details |
|----------|---------|
| **Solid foundation** | Clean architecture, proper service separation, typed API |
| **Core functionality complete** | Incidents, on-call, schedules, authentication all work |
| **Swipe gestures** | Acknowledge/resolve via swipe is implemented |
| **Theme support** | Light/dark mode with system preference |
| **Biometric auth** | Face ID/fingerprint for security |
| **Haptic feedback** | Tactile confirmation on actions |
| **Runbook integration** | Step-by-step guidance linked to incidents |
| **Background refresh** | Badge updates even when app closed |
| **Offline caching** | Incidents cached for offline viewing |
| **Deep linking** | Push notifications open correct screen |

### 2.2 UX Gaps vs Industry Leaders

#### Navigation & Information Architecture

| Gap | Impact | Industry Standard |
|-----|--------|-------------------|
| **No "Inbox" or activity feed** | Miss updates between sessions | Dedicated activity/notification tab |
| **Settings as primary tab** | Wastes prime real estate | Should be in "More" or profile |
| **No badge counts on tabs** | Can't see unread at a glance | Badge on Incidents tab |
| **Team/Analytics buried** | Discovery problem | Part of navigation, not hidden modals |

#### Incident List

| Gap | Impact | Industry Standard |
|-----|--------|-------------------|
| **No ownership indicator in list** | Can't see who's handling what | Avatar/initials on each card |
| **Service not prominent** | Context requires extra tap | Service name visible in list item |
| **No escalation countdown** | Miss auto-escalation timing | "Escalates in 5m" badge |
| **Filter state not persistent** | Resets on return | Remember last filter |
| **No bulk actions** | Tedious multi-incident handling | Select multiple, bulk ack/resolve |

#### Incident Detail

| Gap | Impact | Industry Standard |
|-----|--------|-------------------|
| **Actions scroll off screen** | Hunt for Acknowledge button | Sticky bottom action bar |
| **No responder list** | Who else is notified? | Show escalation chain + status |
| **No related incidents** | Miss patterns | "Similar incidents" section |
| **Runbook collapsed by default** | Missed guidance | Prominent or auto-expanded for P1 |
| **No quick escalate** | Extra taps to get help | One-tap escalate with preview |

#### On-Call & Schedules

| Gap | Impact | Industry Standard |
|-----|--------|-------------------|
| **No "My Shifts" view** | Hard to see personal schedule | Filtered view of my upcoming shifts |
| **No override from on-call screen** | Context switch required | "Take Over" button on current on-call |
| **No shift handoff notification** | Surprised by shift start/end | Configurable reminders |
| **No calendar export** | Manual tracking | .ics export or native calendar sync |

#### Notifications & Engagement

| Gap | Impact | Industry Standard |
|-----|--------|-------------------|
| **No notification history in-app** | Lost context if dismissed | Inbox/Activity feed |
| **No notification preferences per service** | All or nothing | Granular per-service settings |
| **No quiet hours override** | Miss critical during quiet hours | "Break quiet hours for P1" option |
| **Badge shows count only** | No urgency indication | Badge could show severity icon |

### 2.3 Cognitive Load Issues

1. **Too many sections in Settings**: 9 sections visible, overwhelming
2. **Incident detail is long scroll**: Key actions at bottom require scrolling
3. **Filter pills are small**: Touch targets could be larger
4. **No empty states with guidance**: Lists feel broken when empty
5. **Timeline events lack visual hierarchy**: All events look the same importance

---

## 3. Proposed Mobile UX Architecture

### 3.1 New Information Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ROOT NAVIGATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ INCIDENTS│  │  ON-CALL │  │  INBOX   │  │   MORE   │       │
│  │  (Home)  │  │          │  │ (New!)   │  │          │       │
│  │   🔴 3   │  │          │  │   🔵 5   │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│       ▲                                          │              │
│       │                                          ▼              │
│   Default                               ┌─────────────────┐    │
│   Landing                               │ • My Profile    │    │
│                                         │ • Team          │    │
│                                         │ • Analytics     │    │
│                                         │ • Settings      │    │
│                                         │ • Help & Support│    │
│                                         └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Tab Structure

| Tab | Purpose | Badge |
|-----|---------|-------|
| **Incidents** | Active incidents, filters, search | Count of triggered |
| **On-Call** | Who's on call, my shifts, schedules | None (or dot if I'm on-call) |
| **Inbox** | Notification history, activity feed | Count of unread |
| **More** | Profile, Team, Analytics, Settings | Dot if update available |

### 3.3 Screen Map

```
INCIDENTS TAB
├── IncidentListScreen (home)
│   ├── Filter: All | Mine | Triggered | Acknowledged | Resolved
│   ├── Search
│   └── Incident Cards (swipe-able)
│       └── → IncidentDetailScreen
│           ├── Header (severity, state, service)
│           ├── Summary
│           ├── Responders
│           ├── Runbook (expandable)
│           ├── Timeline
│           ├── Notes Input
│           └── [STICKY] Action Bar: Ack | Resolve | Escalate | More

ON-CALL TAB
├── OnCallScreen
│   ├── Segment: Now | My Shifts | All Schedules
│   ├── "Now" → Current on-call per service
│   ├── "My Shifts" → Upcoming shifts for me
│   └── "All Schedules" → Schedule list
│       └── → ScheduleDetailScreen
│           ├── Current on-call
│           ├── Rotation calendar
│           └── Override controls

INBOX TAB
├── InboxScreen (NEW)
│   ├── Filter: All | Mentions | Assigned
│   ├── Activity cards grouped by incident
│   └── Mark all read

MORE TAB
├── MoreScreen
│   ├── Profile Section
│   │   ├── Avatar, Name, Role
│   │   └── → ProfileEditScreen
│   ├── Team → TeamScreen
│   ├── Analytics → AnalyticsScreen
│   ├── Settings → SettingsScreen (simplified)
│   │   ├── Notifications
│   │   ├── Appearance
│   │   ├── Security
│   │   └── About
│   └── Help & Support
```

### 3.4 Key Screen Narratives

#### Incident List Screen

**User's Mental Model**: "What's on fire? What needs my attention right now?"

**Primary Actions**:
1. Scan for critical/triggered incidents
2. Swipe to acknowledge (most common)
3. Tap to see details
4. Filter to focus

**State Reflection**:
- Triggered: Red badge, prominent
- Acknowledged: Yellow/orange, "Owned by [Name]" visible
- Resolved: Gray, moved to bottom or filtered out

**Key Improvements**:
- Add owner avatar to each card
- Add "Escalates in X" countdown badge for triggered
- Make service name always visible (not just summary)
- Persist filter selection

---

#### Incident Detail Screen

**User's Mental Model**: "What is this incident, who else knows, and what should I do?"

**Primary Actions**:
1. Acknowledge (if triggered)
2. View runbook steps
3. Add note
4. Resolve or Escalate

**State Reflection**:
- Sticky action bar at bottom changes based on state
- Timeline shows all state transitions with who/when
- Responder section shows who's been notified

**Key Improvements**:
- Sticky action bar (never scrolls away)
- Responders section above timeline
- Runbook expanded by default for P1/P2
- "Escalate" as explicit button (not buried in menu)
- Related incidents section

---

#### Inbox Screen (New)

**User's Mental Model**: "What happened while I was away? What do I need to catch up on?"

**Primary Actions**:
1. Scan for mentions or assignments
2. Tap to go to incident
3. Mark as read

**State Reflection**:
- Unread items have visual indicator (bold, dot, background)
- Read items are dimmed
- Badge on tab clears as items are viewed

---

#### On-Call Screen

**User's Mental Model**: "Who's handling what right now? When am I on call next?"

**Primary Actions**:
1. See current on-call (default view)
2. Check my upcoming shifts
3. View schedule details
4. Take over (override)

**State Reflection**:
- Current on-call shows time remaining in shift
- My shifts show countdown to next shift
- Override indicator when not normal rotation

---

### 3.5 Primary User Flows

#### Flow 1: "I've Been Paged"

```
Push Notification
    ↓
[Quick Action: Acknowledge] ←── Most common path (1 tap)
    or
[Tap Notification]
    ↓
Incident Detail Screen
    ↓
[Review Summary + Runbook]
    ↓
[Acknowledge Button] ←── Sticky at bottom
    ↓
(Investigate using runbook steps)
    ↓
[Resolve Button] ←── Confirmation modal
    ↓
Done
```

#### Flow 2: "I Need to Escalate"

```
Incident Detail Screen
    ↓
[Escalate Button] (in sticky action bar)
    ↓
Escalation Preview Modal
├── Shows: Next responder(s)
├── Shows: Escalation policy
└── [Confirm Escalate]
    ↓
Incident updated, responders notified
```

#### Flow 3: "I Want to Snooze"

```
Incident List (swipe) or Detail Screen
    ↓
[Snooze Button / Action]
    ↓
Duration Picker (Bottom Sheet)
├── 15 minutes
├── 30 minutes
├── 1 hour
├── 4 hours
└── Custom
    ↓
Incident snoozed, removed from active list
Badge on "Snoozed" filter shows count
```

#### Flow 4: "Review Recent Incidents"

```
Incidents Tab
    ↓
[Filter: Resolved] or [Filter: All]
    ↓
Scroll through resolved incidents
    ↓
[Tap incident]
    ↓
View timeline, notes, resolution
```

#### Flow 5: "Check My Schedule"

```
On-Call Tab
    ↓
[Segment: My Shifts]
    ↓
View upcoming shifts with countdown
    ↓
[Tap shift]
    ↓
Schedule Detail with full rotation
    ↓
[Export to Calendar] (optional)
```

---

## 4. Phased Implementation Plan

### Phase 1: Quick Wins (Minimal Changes, High Impact)

**Goal**: Improve usability without restructuring navigation. Reuse existing components.

**Estimated Scope**: ~15 component/screen changes

#### Changes by File:

| File | Change | Impact |
|------|--------|--------|
| `AlertListScreen.tsx` | Add owner avatar to incident cards | Shows ownership at a glance |
| `AlertListScreen.tsx` | Add service name to card subtitle | Context without tap |
| `AlertListScreen.tsx` | Persist filter in AsyncStorage | Filter survives app restart |
| `AlertListScreen.tsx` | Add "Escalates in X" badge for triggered | Urgency awareness |
| `AlertDetailScreen.tsx` | **Sticky action bar at bottom** | Never scroll to find actions |
| `AlertDetailScreen.tsx` | Add responders section (before timeline) | See who's involved |
| `AlertDetailScreen.tsx` | Add "Escalate" button to action bar | Prominent escalation |
| `AlertDetailScreen.tsx` | Auto-expand runbook for critical/error severity | Guidance visible immediately |
| `OnCallScreen.tsx` | Add segment control: Now / My Shifts / All | Personal schedule visibility |
| `OnCallScreen.tsx` | Add "Take Over" button on each service | Quick override |
| `SettingsScreen.tsx` | Group into fewer sections (4 instead of 9) | Reduce cognitive load |
| `App.tsx` | Add badge count to Incidents tab | Visible triggered count |

#### New Components to Create:

| Component | Purpose |
|-----------|---------|
| `src/components/StickyActionBar.tsx` | Reusable bottom action bar with elevation |
| `src/components/RespondersSection.tsx` | Shows notified users with status |
| `src/components/EscalationBadge.tsx` | "Escalates in 5m" countdown chip |
| `src/components/OwnerAvatar.tsx` | Small avatar with fallback initials |

#### API Assumptions:
- Incident response includes `responders[]` array with notification status
- Incident response includes `escalatesAt` timestamp (or can be computed from policy)

---

### Phase 2: Structural Improvements (Navigation Rework)

**Goal**: Implement new IA with Inbox tab and More menu.

#### Navigation Changes:

| Change | Details |
|--------|---------|
| Add **Inbox Tab** | New screen for notification history |
| Rename/restructure **Settings Tab → More Tab** | Contains Profile, Team, Analytics, Settings |
| Move Team, Analytics to More menu | Cleaner primary navigation |
| Add tab badges | Incidents (triggered count), Inbox (unread count) |

#### New Screens to Create:

| Screen | Purpose |
|--------|---------|
| `src/screens/InboxScreen.tsx` | Activity feed / notification history |
| `src/screens/MoreScreen.tsx` | Menu for Profile, Team, Analytics, Settings |
| `src/screens/ProfileScreen.tsx` | Extracted from Settings |

#### State Management Improvements:

| Change | Details |
|--------|---------|
| Implement Zustand store | Already in deps, not used |
| `src/stores/useIncidentsStore.ts` | Global incident state, optimistic updates |
| `src/stores/useNotificationsStore.ts` | Inbox items, read/unread state |
| `src/stores/useOnCallStore.ts` | Current on-call, my shifts |

#### Backend Requirements:
- `GET /v1/notifications` - Notification history endpoint
- `PUT /v1/notifications/:id/read` - Mark as read
- `PUT /v1/notifications/read-all` - Mark all as read

---

### Phase 3: Delight Features (Polish & Differentiation)

**Goal**: Add the finishing touches that make the app feel premium.

#### Microcopy Improvements:

| Location | Before | After |
|----------|--------|-------|
| Empty incident list | "No incidents" | "All clear! No active incidents." |
| After acknowledge | [No feedback] | Toast: "Got it. You're on it." |
| After resolve | Alert dialog | Toast: "Incident resolved. Nice work!" |
| Escalation confirm | "Escalate?" | "This will page [Name]. Continue?" |
| Offline state | [Nothing] | Banner: "You're offline. Actions will sync when connected." |

#### Haptics & Feedback:

| Action | Haptic | Visual |
|--------|--------|--------|
| Acknowledge | `success()` | Card slides, green flash |
| Resolve | `success()` | Confetti micro-animation |
| Escalate | `warning()` | Confirmation modal |
| Snooze | `lightTap()` | Card fades |
| Pull to refresh | `lightTap()` on threshold | Spinner |
| Tab switch | `lightTap()` | None (native) |

#### Visual Cues:

| Feature | Implementation |
|---------|----------------|
| Severity strip | 4px left border on cards matching severity color |
| State badges | Pill badges with icons (🔴 Triggered, 🟡 Acknowledged, ✅ Resolved) |
| Time-based urgency | Cards older than 5m get subtle "aging" indicator |
| Handoff countdown | Circular progress showing time until shift ends |
| Unread dot | Blue dot on inbox items, tabs |

#### Advanced Features:

| Feature | Value |
|---------|-------|
| **Incident templates** | Quick resolve with common resolutions |
| **Voice notes** | Record audio note instead of typing |
| **Suggested runbook step** | AI-highlight likely next step |
| **Related incidents** | Show similar recent incidents |
| **Bulk actions** | Select multiple incidents, bulk ack/resolve |

---

## Summary

### Current State Assessment

**Score: 7/10** - Solid foundation with core functionality complete, but lacks the polish and UX patterns that make incident management feel effortless under stress.

### Key Improvements by Phase

| Phase | Focus | User Benefit |
|-------|-------|--------------|
| **Phase 1** | Quick wins | "I can see who's handling what and find actions fast" |
| **Phase 2** | Navigation | "I can catch up on what I missed and find everything easily" |
| **Phase 3** | Delight | "This app feels designed for me and my high-stress moments" |

### Success Metrics

| Metric | Target |
|--------|--------|
| Time to acknowledge (from notification) | < 5 seconds |
| Time to find "my incidents" | < 2 seconds |
| Actions per session | Reduce by 20% |
| User-reported "couldn't find X" | Reduce by 50% |

---

## Appendix: Current App Structure

### File Inventory

```
mobile/src/
├── screens/
│   ├── LoginScreen.tsx
│   ├── ForgotPasswordScreen.tsx
│   ├── OnboardingScreen.tsx
│   ├── AlertListScreen.tsx
│   ├── AlertDetailScreen.tsx
│   ├── OnCallScreen.tsx
│   ├── SettingsScreen.tsx
│   ├── ScheduleScreen.tsx
│   ├── TeamScreen.tsx
│   └── AnalyticsScreen.tsx
├── services/
│   ├── apiService.ts
│   ├── authService.ts
│   ├── notificationService.ts
│   ├── biometricService.ts
│   ├── hapticService.ts
│   ├── soundService.ts
│   ├── settingsService.ts
│   ├── runbookService.ts
│   ├── crashReportingService.ts
│   ├── updateService.ts
│   └── backgroundRefreshService.ts
├── context/
│   └── ThemeContext.tsx
├── config/
│   └── index.ts
└── theme/
    └── index.ts
```

### Technology Stack

- **Framework**: React Native + Expo SDK 51
- **Navigation**: React Navigation v6 (Stack + Bottom Tabs)
- **UI Library**: React Native Paper v5
- **State**: React Context + useState (Zustand available but unused)
- **Storage**: AsyncStorage + SecureStore
- **Auth**: AWS Cognito
- **Notifications**: Expo Notifications
- **Error Tracking**: Sentry

---

*Document generated as part of UX analysis sprint. Update as implementation progresses.*
