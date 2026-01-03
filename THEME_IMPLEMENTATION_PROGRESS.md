# UI Redesign Implementation Progress

## Overview
Redesigning the OnCallShift UI to match PagerDuty-inspired design patterns with:
- Timeline strips for schedules
- Directory table for services
- Visual step flow for escalation policies
- Filter chips and bulk actions for incidents
- Dark/Light theme toggle

## Status: IN PROGRESS

---

## Phase 1: Theme System - COMPLETED

---

## Completed Steps

### 1. Exploration (DONE)
- [x] Explored frontend structure
- [x] Found Tailwind CSS is the styling system
- [x] Found existing theme support in `index.css` (CSS variables for light/dark)
- [x] Found `AppLayout.tsx` handles theme initialization
- [x] Found `Sidebar.tsx` has existing theme toggle (needs to move to Header)
- [x] Found `Header.tsx` is target for theme toggle placement

### 2. Create ThemeProvider Context (DONE)
- [x] Created `frontend/src/contexts/ThemeContext.tsx`
- [x] Implemented theme state management (light/dark/system)
- [x] Handles localStorage persistence (new key: `oncallshift-theme`)
- [x] Backwards compatible with legacy `theme` key
- [x] Handles system preference detection
- [x] Exported `useTheme` hook

### 3. Create ThemeSwitcher Component (DONE)
- [x] Created `frontend/src/components/ui/theme-switcher.tsx`
- [x] Sun icon for light mode, Moon icon for dark mode
- [x] Click to toggle between light/dark
- [x] Accessible with aria-label and title attributes

### 4. Update Header Component (DONE)
- [x] Added ThemeSwitcher to Header.tsx
- [x] Positioned between Help menu and Notifications icon

### 5. Update AppLayout (DONE)
- [x] Wrapped app content with ThemeProvider
- [x] Removed old theme initialization useEffect

### 6. Update Sidebar (DONE)
- [x] Removed theme state and useEffect
- [x] Removed theme toggle button
- [x] Cleaned up unused imports

### 7. Add Flash Prevention Script (DONE)
- [x] Added inline script to `index.html` head
- [x] Sets theme before CSS loads
- [x] Backwards compatible with legacy storage key

### 8. Verification (DONE)
- [x] TypeScript compilation passes
- [x] No console errors

---

## Files Created
1. `frontend/src/contexts/ThemeContext.tsx` - Theme context provider and useTheme hook
2. `frontend/src/components/ui/theme-switcher.tsx` - Theme toggle button component

## Files Modified
1. `frontend/index.html` - Added flash prevention script
2. `frontend/src/components/Header.tsx` - Added ThemeSwitcher import and component
3. `frontend/src/components/AppLayout.tsx` - Added ThemeProvider wrapper, removed old theme logic
4. `frontend/src/components/Sidebar.tsx` - Removed duplicate theme toggle and related code

---

## Architecture

### Theme Toggle Placement
- Top navigation bar (Header), between Help menu and Notifications icon
- Single click toggles light/dark
- Icon changes based on current theme (Sun in dark mode, Moon in light mode)
- Tooltip shows current action

### Theme Options
- `light` - Light mode
- `dark` - Dark mode
- `system` - Follow OS preference (available programmatically)

### Storage
- localStorage key: `oncallshift-theme`
- Backwards compatible with legacy `theme` key
- Default: `dark` (matches on-call work environment)

### Flash Prevention
- Inline script in `<head>` runs before CSS loads
- Reads localStorage and applies `.dark` class immediately
- No visible flash when reloading page

---

## Usage

```tsx
// In any component that needs theme info:
import { useTheme } from '../contexts/ThemeContext';

function MyComponent() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  // theme: 'light' | 'dark' | 'system'
  // resolvedTheme: 'light' | 'dark' (actual applied theme)
  // setTheme: (theme) => void
  // toggleTheme: () => void (toggles between light/dark)
}
```

---

## Testing Checklist

- [ ] Toggle theme in header - should switch immediately
- [ ] Refresh page - theme should persist without flash
- [ ] Check light mode renders correctly
- [ ] Check dark mode renders correctly
- [ ] Clear localStorage and refresh - should default to dark
- [ ] Test with `oncallshift-theme` key
- [ ] Test backwards compatibility with legacy `theme` key

---

## Phase 2: UI Redesign - IN PROGRESS

### Shared Components Created
- [x] `frontend/src/components/ui/filter-chip.tsx` - Dropdown filter buttons
- [x] `frontend/src/components/ui/status-badge.tsx` - Status and severity badges
- [x] `frontend/src/components/ui/bulk-action-bar.tsx` - Fixed bottom action bar
- [x] `frontend/src/components/ui/schedule-timeline.tsx` - Timeline strips for schedules

### Pages Being Redesigned (Parallel Agents)

#### Schedules Page
- [ ] Tab navigation (My On-Call / All Schedules)
- [ ] Date range picker with navigation
- [ ] Schedule cards with timeline strips
- [ ] Color-coded shift blocks per user
- [ ] Today marker on timeline

#### Services Directory Page
- [ ] Table/list view replacing card grid
- [ ] Health status indicators
- [ ] On Call Now column
- [ ] Search and filter chips
- [ ] Maintenance Windows tab

#### Escalation Policies Page
- [ ] Visual step flow diagram
- [ ] Horizontal preview in list view
- [ ] Vertical editor with connectors
- [ ] Step cards with targets
- [ ] Services using count

#### Incidents Page
- [ ] Status tabs with counts
- [ ] Filter chips (Status, Severity, Service, Team)
- [ ] Checkbox selection for bulk actions
- [ ] Bulk action bar (Acknowledge, Resolve, etc.)
- [ ] Improved incident rows
