# OnCallShift Mobile App UI/UX Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to enhance the OnCallShift mobile app's user experience based on industry research, competitor analysis, and mobile UX best practices. The goal is to ensure users have critical information at their fingertips while maintaining simplicity and power.

### Research Sources
- **Competitor Apps Analyzed**: PagerDuty, Opsgenie, Splunk On-Call, incident.io, Squadcast
- **Industry Standards**: Material Design 3, Apple Human Interface Guidelines, 2024-2025 mobile UX trends
- **Current App Audit**: 25+ screens, 4-tab navigation, React Native Paper components

---

## Phase 1: Critical Path Improvements (High Impact, Core Workflows)

### 1.1 Incident Response Optimization

**Current Issues:**
- Multiple modals required to take action on incidents
- Action buttons buried in UI
- No quick-action shortcuts from list view

**Improvements:**

#### A. Swipe Actions on Incident List (ALREADY IMPLEMENTED)
```
Current implementation in AlertListScreen.tsx:
- Swipe Right → Resolve (green)
- Swipe Left → Acknowledge (yellow/warning) - for triggered only
- Long press → Enter bulk selection mode
- Quick action buttons inline on each card
```

**Files to modify:**
- `src/screens/IncidentListScreen.tsx`
- `src/components/IncidentCard.tsx` (new component)

**Technical approach:**
- Use `react-native-gesture-handler` Swipeable component
- Implement haptic feedback on swipe threshold
- Animate background color reveal during swipe

#### B. Streamlined Incident Detail Screen
```
Current: Modal-heavy design with nested action sheets
Improved: Inline actions with contextual expansion
```

**Changes:**
1. Replace modal-based actions with bottom sheet action bar (always visible)
2. Add floating action button (FAB) for primary action (Acknowledge/Resolve based on state)
3. Collapse timeline by default, expand on tap
4. Add "Related Incidents" section for grouped alerts

**Files to modify:**
- `src/screens/AlertDetailScreen.tsx`
- Create `src/components/IncidentActionBar.tsx`
- Create `src/components/IncidentTimeline.tsx`

#### C. Quick Acknowledge from Push Notification
```
Implementation: iOS/Android notification actions
- "Acknowledge" button directly in notification
- "Resolve" button directly in notification
- Deep link to incident detail on tap
```

**Files to modify:**
- `src/services/pushNotificationService.ts`
- `App.tsx` (notification handlers)

---

### 1.2 On-Call Visibility Enhancement

**Current Issues:**
- On-call schedule shows only current status
- No visibility into upcoming shifts
- Override management requires navigation away

**Improvements:**

#### A. Enhanced On-Call Dashboard
```
New layout:
┌─────────────────────────────────┐
│ Currently On-Call        ●LIVE │
│ ┌─────────────────────────────┐ │
│ │ [Avatar] John Smith         │ │
│ │ Production Schedule         │ │
│ │ Until: Today 6:00 PM        │ │
│ │ [Override] [Escalate]       │ │
│ └─────────────────────────────┘ │
│                                 │
│ Your Upcoming Shifts           │
│ ┌─────────────────────────────┐ │
│ │ Tomorrow 9AM - 5PM          │ │
│ │ Sat Dec 28 (All day)        │ │
│ └─────────────────────────────┘ │
│                                 │
│ Quick Actions                   │
│ [Take On-Call] [Request Swap]  │
└─────────────────────────────────┘
```

**Files to modify:**
- `src/screens/OnCallScreen.tsx`
- Create `src/components/OnCallCard.tsx`
- Create `src/components/UpcomingShifts.tsx`

#### B. Calendar Integration
```
Features:
- Export schedule to device calendar
- Sync upcoming on-call shifts automatically
- Visual calendar view option (week/month)
```

**New files:**
- `src/services/calendarService.ts`
- `src/components/ScheduleCalendar.tsx`

---

### 1.3 Information Architecture Restructure

**Current Issues:**
- Deep navigation hierarchy (3-4 levels to reach some features)
- "More" tab is a catch-all with poor discoverability
- Related features scattered across different sections

**Improvements:**

#### A. Reorganized Tab Structure
```
Current Tabs: Home | Incidents | On-Call | Inbox | More

Proposed Tabs: Dashboard | Incidents | On-Call | Team | Settings
```

**Dashboard Tab (replacing Home):**
- Active incidents count with severity breakdown
- Your on-call status (current and next shift)
- Recent activity feed
- Quick actions: Acknowledge All, Take On-Call, Check Status

**Team Tab (new, replaces parts of More):**
- Team members with on-call status indicators
- Escalation policies (quick view)
- Contact team member directly

**Settings Tab (streamlined):**
- Profile & Contact Methods
- Notification Preferences
- App Settings (theme, sounds)
- Administration (for admins only)

**Files to modify:**
- `App.tsx` (tab navigator configuration)
- `src/screens/HomeScreen.tsx` → refactor to DashboardScreen
- Create `src/screens/TeamScreen.tsx`
- Refactor `src/screens/MoreScreen.tsx` → `SettingsScreen.tsx`

#### B. Global Search
```
Implementation: Search bar at top of each main tab
- Search incidents by title, service, assignee
- Search team members
- Search services and schedules
- Recent searches preserved
```

**New files:**
- `src/components/GlobalSearch.tsx`
- `src/services/searchService.ts`

---

## Phase 2: Enhanced Usability Features

### 2.1 Smart Filtering & Sorting

**Current Issues:**
- Limited filter options on incident list
- No saved filter presets
- Sorting not easily accessible

**Improvements:**

#### A. Advanced Filter Panel
```
┌─────────────────────────────────┐
│ Filters                    [X] │
├─────────────────────────────────┤
│ Status                         │
│ [●Triggered] [●Acked] [○Resolved] │
│                                 │
│ Severity                        │
│ [●Critical] [●High] [●Medium] [●Low] │
│                                 │
│ Service                         │
│ [Select services...]           │
│                                 │
│ Assigned To                     │
│ [●Me] [○My Team] [○Anyone]     │
│                                 │
│ Time Range                      │
│ [Last 24h ▼]                   │
│                                 │
│ [Save as Preset] [Apply] [Clear] │
└─────────────────────────────────┘
```

**Files to modify:**
- `src/screens/IncidentListScreen.tsx`
- Create `src/components/FilterPanel.tsx`
- Create `src/components/FilterChip.tsx`

#### B. Saved Filter Presets
```
Features:
- Save current filter combination as named preset
- Quick-access preset chips below search
- Sync presets across devices via API
```

**API additions needed:**
- `GET /api/mobile/filter-presets`
- `POST /api/mobile/filter-presets`
- `DELETE /api/mobile/filter-presets/:id`

---

### 2.2 Notification Management

**Current Issues:**
- No in-app notification history
- Can't manage notification rules from Inbox
- DND mode requires external device settings

**Improvements:**

#### A. Enhanced Inbox Screen
```
New Inbox Layout:
┌─────────────────────────────────┐
│ Inbox                    [⚙️]  │
├─────────────────────────────────┤
│ [All] [Incidents] [Updates] [System] │
├─────────────────────────────────┤
│ Today                          │
│ ┌─────────────────────────────┐ │
│ │ 🔴 Critical: DB Connection  │ │
│ │    Production • 5 min ago   │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ ✓ Incident Resolved         │ │
│ │    API Latency • 1 hour ago │ │
│ └─────────────────────────────┘ │
│                                 │
│ Yesterday                       │
│ ...                            │
└─────────────────────────────────┘
```

**Files to modify:**
- `src/screens/InboxScreen.tsx`
- Create `src/components/NotificationItem.tsx`

#### B. In-App DND Mode
```
Features:
- Toggle DND from app (respects critical alerts option)
- Schedule DND (e.g., "Silence until 9 AM")
- Per-service muting
- Override DND for high-urgency alerts option
```

**New files:**
- `src/components/DNDControls.tsx`
- `src/services/dndService.ts`

---

### 2.3 Visual Design Refresh

**Current Issues:**
- Dense information display
- Inconsistent spacing and typography
- Limited visual hierarchy

**Improvements:**

#### A. Typography & Spacing System
```
Establish consistent scale:
- Heading 1: 24px, Bold
- Heading 2: 20px, SemiBold
- Heading 3: 16px, SemiBold
- Body: 14px, Regular
- Caption: 12px, Regular

Spacing scale: 4, 8, 12, 16, 24, 32, 48
```

**Files to modify:**
- `src/theme/theme.ts`
- All screen files (apply consistent spacing)

#### B. Enhanced Status Indicators
```
Current: Text-based status with colored backgrounds
Improved:
- Animated pulse for critical/triggered incidents
- Color-coded left border on cards
- Icon + color combination for accessibility
```

**Visual Examples:**
```
Triggered (Critical):
┌──────────────────────────────┐
│🔴│ [pulsing] Database Down   │
│  │ Production • 2 min ago    │
└──────────────────────────────┘

Acknowledged:
┌──────────────────────────────┐
│🟡│ API Latency High          │
│  │ Staging • Acked by John   │
└──────────────────────────────┘

Resolved:
┌──────────────────────────────┐
│🟢│ Memory Usage Normal       │
│  │ Resolved 1 hour ago       │
└──────────────────────────────┘
```

#### C. Dark Mode Optimization
```
Current: Basic dark theme
Improved:
- True black option for OLED displays (#000000 background)
- Reduced brightness status colors for dark mode
- Improved contrast ratios (WCAG AA compliance)
```

**Files to modify:**
- `src/theme/theme.ts` (add OLED dark variant)
- `src/theme/colors.ts` (dark mode color adjustments)

---

## Phase 3: Power User Features

### 3.1 Keyboard & Shortcut Support (Tablet/Connected Keyboards)

**Features:**
- `A` - Acknowledge selected incident
- `R` - Resolve selected incident
- `E` - Escalate selected incident
- `J/K` - Navigate up/down in list
- `/` - Focus search
- `?` - Show keyboard shortcuts

**New files:**
- `src/hooks/useKeyboardShortcuts.ts`
- `src/components/KeyboardShortcutsHelp.tsx`

---

### 3.2 Widgets (iOS/Android)

**iOS Widget Types:**
1. **On-Call Status Widget** (small): Shows if you're on-call
2. **Active Incidents Widget** (medium): Count + top 3 incidents
3. **Team Status Widget** (large): Who's on-call across teams

**Android Widget Types:**
1. **Quick Status Widget**: On-call status + incident count
2. **Incident List Widget**: Scrollable incident list
3. **Action Widget**: One-tap acknowledge/resolve buttons

**New files:**
- `ios/OnCallShiftWidgets/` (native Swift implementation)
- `android/app/src/main/java/widgets/` (native Kotlin implementation)

---

### 3.3 Offline Mode & Caching

**Features:**
- Cache recent incidents for offline viewing
- Queue actions taken offline, sync when connected
- Clear offline indicator in UI
- Background sync when connection restored

**New files:**
- `src/services/offlineService.ts`
- `src/services/syncQueue.ts`
- `src/components/OfflineIndicator.tsx`

---

## Phase 4: Accessibility & Polish

### 4.1 Accessibility Improvements

**Requirements:**
- VoiceOver/TalkBack full support
- Minimum touch target size: 44x44 points
- Color-independent status indicators (icons + labels)
- Reduced motion option
- Dynamic type support (iOS)
- High contrast mode support

**Files to audit and modify:**
- All screen and component files
- Add `accessibilityLabel` and `accessibilityHint` props
- Add `accessibilityRole` definitions

### 4.2 Haptic Feedback

**Implementation:**
- Light haptic on button press
- Medium haptic on successful action
- Heavy haptic on critical alert arrival
- Selection haptic on list navigation

**New file:**
- `src/services/hapticService.ts`

### 4.3 Sound Design

**Custom Alert Sounds:**
- Critical incident: Urgent, distinctive tone
- High severity: Alert tone
- Medium/Low: Notification tone
- Acknowledgment success: Confirmation tone

**Settings:**
- Per-severity sound selection
- Custom sound upload option
- Volume independent of device volume (optional)

---

## Implementation Status

### Completed (Phase 1 - December 2024)

| Feature | Status | Notes |
|---------|--------|-------|
| Swipe actions on incidents | ALREADY EXISTED | Swipe right=Resolve, left=Acknowledge |
| Streamlined incident detail | ALREADY EXISTED | StickyActionBar component |
| Enhanced on-call dashboard | COMPLETED | Status header, current on-call cards, upcoming shifts |
| Quick acknowledge from notification | ALREADY EXISTED | Categories set up in notificationService.ts |
| Calendar export | COMPLETED | Export shifts to device calendar |
| Reusable IncidentCard component | COMPLETED | Extracted to components/IncidentCard.tsx |
| Upcoming shifts API | COMPLETED | getUpcomingShifts() with local computation fallback |

### Completed (Phase 2 - December 2024)

| Feature | Status | Notes |
|---------|--------|-------|
| DashboardScreen | COMPLETED | New home tab with incident summary, on-call status, quick actions |
| Tab navigation update | COMPLETED | Added Dashboard as first tab (Home) |
| FilterPanel component | COMPLETED | Advanced filtering with status, severity, time range, services |
| Filter presets support | COMPLETED | Save/load filter presets |
| DNDControls component | COMPLETED | In-app Do Not Disturb with duration picker and override settings |
| useDNDStatus hook | COMPLETED | Check DND state across the app |
| GlobalSearch component | COMPLETED | Search incidents, services, users with recent searches |
| SearchButton component | COMPLETED | Compact search trigger button |
| GlobalSearch integration | COMPLETED | Added to DashboardScreen header |
| DNDControls integration | COMPLETED | Added to SettingsScreen |

### Completed (Phase 3 - December 2024)

| Feature | Status | Notes |
|---------|--------|-------|
| offlineService | COMPLETED | Caching with TTL, sync queue for offline actions |
| NetInfo integration | COMPLETED | Reliable network status detection |
| OfflineBanner upgrade | COMPLETED | Shows pending actions, uses offlineService |
| useOfflineStatusFull hook | COMPLETED | Returns full offline status including pending actions |
| useKeyboardShortcuts hook | COMPLETED | Keyboard shortcuts for tablet/connected keyboards |
| KeyboardShortcutsHelp modal | COMPLETED | Shows all available shortcuts organized by category |
| useHardwareKeyboard hook | COMPLETED | Detect connected hardware keyboards |

### Pending (Phase 3)

| Feature | Status | Notes |
|---------|--------|-------|
| iOS Widgets | NOT STARTED | Requires native Swift implementation |
| Android Widgets | NOT STARTED | Requires native Kotlin implementation |

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Swipe actions on incidents | High | Medium | P0 |
| Streamlined incident detail | High | High | P0 |
| Enhanced on-call dashboard | High | Medium | P0 |
| Quick acknowledge from notification | High | Low | P0 |
| Tab restructure (Dashboard/Team) | High | High | P1 |
| Global search | Medium | Medium | P1 |
| Advanced filters | Medium | Medium | P1 |
| In-app DND | Medium | Low | P1 |
| Visual design refresh | Medium | High | P2 |
| Dark mode optimization | Low | Low | P2 |
| Keyboard shortcuts | Low | Low | P2 |
| iOS/Android widgets | Medium | High | P3 |
| Offline mode | Medium | High | P3 |
| Accessibility audit | High | Medium | P1 |
| Haptic feedback | Low | Low | P2 |
| Custom sounds | Low | Medium | P3 |

---

## Detailed Implementation Roadmap

### Sprint 1: Critical Incident Workflow (P0)
**Goal:** Reduce time-to-acknowledge by 50%

1. Create `IncidentCard` component with swipe actions
2. Implement swipe-to-acknowledge gesture
3. Add long-press quick action menu
4. Implement persistent bottom action bar on incident detail
5. Add haptic feedback to actions

**Deliverables:**
- `src/components/IncidentCard.tsx`
- `src/components/IncidentActionBar.tsx`
- Updated `IncidentListScreen.tsx`
- Updated `AlertDetailScreen.tsx`

### Sprint 2: On-Call Enhancement (P0)
**Goal:** Full on-call visibility without navigation

1. Redesign `OnCallScreen` with new dashboard layout
2. Create `OnCallCard` component with status and actions
3. Create `UpcomingShifts` component
4. Add quick override creation flow
5. Implement calendar export

**Deliverables:**
- Updated `OnCallScreen.tsx`
- `src/components/OnCallCard.tsx`
- `src/components/UpcomingShifts.tsx`
- `src/services/calendarService.ts`

### Sprint 3: Navigation Restructure (P1)
**Goal:** Reduce navigation depth, improve discoverability

1. Create new `DashboardScreen` (replacing Home)
2. Create new `TeamScreen`
3. Restructure `SettingsScreen`
4. Update tab navigator configuration
5. Implement global search component

**Deliverables:**
- `src/screens/DashboardScreen.tsx`
- `src/screens/TeamScreen.tsx`
- Updated `SettingsScreen.tsx`
- `src/components/GlobalSearch.tsx`
- Updated `App.tsx`

### Sprint 4: Filtering & Notifications (P1)
**Goal:** Efficient incident triage and notification control

1. Create `FilterPanel` component
2. Implement saved filter presets
3. Enhanced inbox with categories
4. In-app DND controls
5. Accessibility audit pass 1

**Deliverables:**
- `src/components/FilterPanel.tsx`
- `src/components/FilterChip.tsx`
- Updated `InboxScreen.tsx`
- `src/components/DNDControls.tsx`

### Sprint 5: Visual Polish (P2)
**Goal:** Consistent, modern visual design

1. Typography and spacing system implementation
2. Enhanced status indicators with animations
3. Dark mode OLED optimization
4. Component library documentation
5. Accessibility audit pass 2

**Deliverables:**
- Updated `src/theme/theme.ts`
- Updated `src/theme/colors.ts`
- Animation utilities
- Style guide documentation

### Sprint 6: Power Features (P3)
**Goal:** Enable power users and offline scenarios

1. iOS widgets implementation
2. Android widgets implementation
3. Offline mode with sync queue
4. Keyboard shortcuts (tablet)
5. Custom alert sounds

**Deliverables:**
- Native widget implementations
- `src/services/offlineService.ts`
- `src/services/syncQueue.ts`
- `src/hooks/useKeyboardShortcuts.ts`

---

## Success Metrics

### Quantitative
- Time to acknowledge incident: Target < 5 seconds (from notification)
- Navigation depth to key features: Target max 2 taps
- App session duration: Increase engagement by 20%
- Push notification interaction rate: Increase by 30%

### Qualitative
- User satisfaction survey (post-implementation)
- App store rating improvement
- Support ticket reduction for "how do I..." questions

---

## Technical Dependencies

### Required Libraries
```json
{
  "react-native-gesture-handler": "^2.x",
  "react-native-reanimated": "^3.x",
  "@react-native-community/blur": "^4.x",
  "react-native-calendars": "^1.x",
  "react-native-haptic-feedback": "^2.x",
  "@react-native-async-storage/async-storage": "^1.x"
}
```

### API Endpoints Needed
- `GET/POST/DELETE /api/mobile/filter-presets`
- `GET /api/mobile/dashboard-summary`
- `POST /api/mobile/dnd-status`
- `GET /api/mobile/team-status`

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing workflows | Feature flags for gradual rollout |
| Performance regression | Benchmark before/after each sprint |
| User confusion with new layout | In-app walkthrough on first launch post-update |
| Platform-specific bugs | Dedicated QA for iOS and Android |

---

## Appendix A: Competitor Feature Comparison

| Feature | OnCallShift | PagerDuty | Opsgenie | incident.io |
|---------|-------------|-----------|----------|-------------|
| Swipe to acknowledge | Planned | Yes | Yes | No |
| Quick actions from notification | Planned | Yes | Yes | Yes |
| Calendar view | Planned | Yes | Yes | No |
| Widgets | Planned | Yes | No | No |
| Offline mode | Planned | Partial | No | No |
| In-app DND | Planned | Yes | Yes | No |
| Global search | Planned | Yes | Yes | Yes |
| Custom alert sounds | Planned | Yes | Yes | No |

---

## Appendix B: Wireframes Reference

Wireframes should be created in Figma for the following screens:
1. New Dashboard layout
2. Incident list with swipe actions
3. Incident detail with action bar
4. On-call dashboard
5. Team screen
6. Filter panel
7. Enhanced inbox
8. Settings restructure

---

*Document Version: 1.0*
*Created: December 2024*
*Author: Mobile UX Design Team*
