# Atlassian-Style Design System for OnCallShift

**Target Reference:** Atlassian Opsgenie Migration Page
**Tech Stack:** React + TypeScript + Tailwind CSS + Radix UI
**Goal:** Create a calm, enterprise-grade UI with clear hierarchy and generous white space

---

## Implementation Progress Tracker

> **Status:** Phase 3 Complete - Ready for Phase 4
> **Last Updated:** 2025-12-31
> **Branch:** `feature/phase1-mobile-improvements`

### Phase 1: Foundations - COMPLETE
- [x] Update `tailwind.config.js` with Atlassian colors, typography, shadows
- [x] Update `index.css` with new CSS variables
- [x] Create `lib/design-tokens.ts` for programmatic access
- [x] Verify build passes with new config

### Phase 2: Layout Components - COMPLETE
- [x] Create `components/layout/Container.tsx`
- [x] Create `components/layout/PageHeader.tsx`
- [x] Create `components/layout/Section.tsx`
- [x] Update `components/ui/button.tsx` with new variants

### Phase 3: High-Traffic Pages - COMPLETE
- [x] Refactor `pages/Incidents.tsx` with new layout
- [x] Create `components/incidents/IncidentCard.tsx`
- [x] Create `components/incidents/SeverityBadge.tsx`
- [x] Create `components/incidents/StateBadge.tsx`
- [x] Create `components/incidents/MetricsCard.tsx`
- [x] Refactor `pages/IncidentDetail.tsx` with new design

### Phase 4: Polish & Rollout (Ongoing)
- [ ] Audit all UI components for consistency
- [ ] Update remaining pages (Schedules, Escalation Policies, etc.)
- [ ] Remove hardcoded colors
- [ ] Add loading skeletons
- [ ] Performance optimization (code splitting)

---

## Table of Contents

1. [Design Analysis](#1-design-analysis)
2. [Design System Specification](#2-design-system-specification)
3. [Screen Layouts](#3-screen-layouts)
4. [Implementation Plan](#4-implementation-plan)
5. [Code Examples](#5-code-examples)

---

## 1. Design Analysis

### Key Characteristics of Atlassian Opsgenie Migration Page

#### Layout
- **Container-constrained**: Max width ~1200px on desktop, centered
- **Full-width sections**: Hero and major sections span full viewport with inner containers
- **Generous padding**: 40px (desktop), 20px (mobile) for section padding
- **Vertical rhythm**: 48px gaps between major sections, 24-32px within sections
- **Two-column layouts**: Content + imagery, or split feature comparisons
- **Grid-based**: CSS Grid with consistent gaps (24px, 32px)

#### Typography
- **Font stack**: Custom sans-serif ("Charlie Display" for headlines, "Charlie Text" for body)
- **Hierarchy**:
  - **Hero headline**: Very large (48-64px), semi-bold, short and punchy
  - **Section headers**: 32-40px, medium weight, with subtle bottom margin
  - **Subsection headers**: 24px, medium weight
  - **Body text**: 16px with generous line-height (1.6-1.8)
  - **Captions/labels**: 12-14px, slightly muted color
- **Line length**: ~65-75 characters for optimal readability
- **Letter spacing**: Slightly open on headlines for professional feel

#### Color Palette
- **Primary blue**: #0052CC (Atlassian brand blue)
- **Accent blue**: #1868DB (hover states, interactive elements)
- **Light blue backgrounds**: #CFE1FD (subtle highlights)
- **Purple accent**: #EED7FC (gradient accents)
- **Neutral grays**:
  - Background: #F8F8F8 (off-white, not pure white)
  - Borders: #DDDEE1 (subtle, low-contrast)
  - Text gray: #505258 (muted secondary text)
  - Dark text: #101214 (primary text)
- **Gradients**: Soft 135deg linear gradients mixing blues and purples for hero sections

#### Component Patterns
- **Hero section**:
  - Full-width gradient background with subtle decorative imagery
  - Large centered headline + descriptive subheading
  - Single primary CTA, sometimes with secondary link below
  - Two-column layout (text left, supporting image right)

- **Step-by-step section**:
  - Numbered steps (1, 2, 3, 4) with large circular badges
  - Each step has: icon/number → headline → description → supporting image
  - Vertical or horizontal card layout depending on complexity
  - 40px padding per card

- **Feature comparison**:
  - Accordion-style expandable rows
  - Clear visual differentiation between "before" and "after"
  - Checkmarks and X marks for feature availability
  - Subtle hover states with box shadows

- **CTA sections**:
  - Full-width band with contrasting background
  - Centered text + button(s)
  - Often uses gradient backgrounds for visual interest

- **Cards**:
  - White background (or very light gray)
  - Subtle border (1px solid #DDDEE1)
  - Soft shadow on hover: `0px 8px 12px rgba(9, 30, 66, 0.15)`
  - 16-24px padding
  - Rounded corners (4-8px)

#### Visual Rhythm & Spacing
- **Spacing scale**: 4px base unit
  - xs: 4px
  - sm: 8px
  - md: 12px
  - base: 16px
  - lg: 24px
  - xl: 32px
  - 2xl: 40px
  - 3xl: 48px
  - 4xl: 64px
- **Section gaps**: 48px vertical between major sections
- **Card grids**: 24-32px gap between cards
- **Inline elements**: 8-12px gap (e.g., icon + text)

#### Creating the "Calm, Enterprise" Feel
- **Limited color palette**: Mostly neutrals with blue accents, avoiding bright colors
- **Generous whitespace**: Never cramped; breathing room around all elements
- **Subtle shadows**: Only on hover/interaction, very soft (low opacity, large blur)
- **Consistent alignment**: Everything aligns to a grid; no random positioning
- **Minimal ornamentation**: No unnecessary gradients, patterns, or decorations
- **Clear hierarchy**: Size and weight differences are significant enough to scan quickly
- **Soft corners**: 4-8px border radius on cards/buttons (not sharp, not overly round)
- **Low-contrast borders**: #DDDEE1 instead of dark borders
- **Professional typography**: No condensed or decorative fonts; open spacing

---

## 2. Design System Specification

### 2.1 Color Palette

```css
/* CSS Variables for Tailwind */
:root {
  /* Primary (Atlassian Blue) */
  --color-primary: 213 94% 48%;        /* #0052CC */
  --color-primary-hover: 216 79% 49%;  /* #1868DB */
  --color-primary-foreground: 0 0% 100%;

  /* Neutral Palette */
  --color-neutral-50: 240 20% 99%;     /* #FAFBFC - lightest */
  --color-neutral-100: 240 14% 97%;    /* #F8F8F8 - page background */
  --color-neutral-200: 240 11% 94%;    /* #EEEFF1 - card background */
  --color-neutral-300: 240 8% 87%;     /* #DDDEE1 - borders */
  --color-neutral-400: 240 5% 65%;     /* #9FA1A6 - disabled */
  --color-neutral-500: 240 6% 47%;     /* #747579 - muted text */
  --color-neutral-600: 240 7% 33%;     /* #505258 - secondary text */
  --color-neutral-700: 240 9% 19%;     /* #2C2D30 - headings */
  --color-neutral-900: 240 11% 7%;     /* #101214 - primary text */

  /* Accent Blues */
  --color-blue-50: 214 100% 97%;       /* #EDF5FF */
  --color-blue-100: 214 95% 92%;       /* #CFE1FD */
  --color-blue-600: 213 94% 48%;       /* Primary blue */

  /* Accent Purple */
  --color-purple-50: 270 100% 98%;     /* #FAF8FF */
  --color-purple-100: 270 80% 93%;     /* #EED7FC */

  /* Status Colors */
  --color-success: 145 65% 45%;        /* #2A9D5F - green */
  --color-warning: 36 100% 50%;        /* #FF9500 - orange */
  --color-danger: 0 84% 60%;           /* #E63946 - red */
  --color-info: 213 94% 48%;           /* Use primary blue */

  /* Backgrounds */
  --background: var(--color-neutral-100);
  --surface: 0 0% 100%;                /* Pure white for cards */
  --foreground: var(--color-neutral-900);

  /* Borders & Inputs */
  --border: var(--color-neutral-300);
  --input-border: var(--color-neutral-300);
  --input-border-focus: var(--color-primary);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(9, 30, 66, 0.08);
  --shadow-md: 0 4px 8px rgba(9, 30, 66, 0.12);
  --shadow-lg: 0 8px 12px rgba(9, 30, 66, 0.15);
  --shadow-xl: 0 12px 24px rgba(9, 30, 66, 0.18);

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
}
```

**Usage Guide:**
- **Primary Blue (#0052CC)**: CTAs, links, active states, key accents
- **Neutral Grays**: Backgrounds, borders, text hierarchy
- **Blue/Purple Gradients**: Hero sections, feature highlights
- **Status Colors**: Success/warning/danger states only (not decorative)
- **White (#FFFFFF)**: Cards, panels, modals

### 2.2 Typography Scale

```typescript
// Typography configuration for Tailwind
const typography = {
  // Display (Hero headlines)
  'display-2xl': {
    fontSize: '64px',
    lineHeight: '72px',
    fontWeight: '600',
    letterSpacing: '-0.02em',
    usage: 'Landing page hero'
  },
  'display-xl': {
    fontSize: '48px',
    lineHeight: '56px',
    fontWeight: '600',
    letterSpacing: '-0.01em',
    usage: 'Page hero sections'
  },

  // Headings
  'heading-2xl': {
    fontSize: '40px',
    lineHeight: '48px',
    fontWeight: '600',
    usage: 'Major section headers'
  },
  'heading-xl': {
    fontSize: '32px',
    lineHeight: '40px',
    fontWeight: '600',
    usage: 'Section headers'
  },
  'heading-lg': {
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: '600',
    usage: 'Subsection headers, card titles'
  },
  'heading-md': {
    fontSize: '20px',
    lineHeight: '28px',
    fontWeight: '600',
    usage: 'Component headers'
  },
  'heading-sm': {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: '600',
    usage: 'Small headers, labels'
  },

  // Body
  'body-lg': {
    fontSize: '18px',
    lineHeight: '28px',
    fontWeight: '400',
    usage: 'Large body text, intros'
  },
  'body-md': {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: '400',
    usage: 'Default body text'
  },
  'body-sm': {
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: '400',
    usage: 'Secondary text, captions'
  },
  'body-xs': {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: '400',
    usage: 'Labels, timestamps, metadata'
  },
}
```

**Font Stack:**
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen",
             "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue",
             sans-serif;
```

### 2.3 Spacing System

```javascript
// Tailwind spacing extension
spacing: {
  '0': '0px',
  'px': '1px',
  '0.5': '2px',
  '1': '4px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '7': '28px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '14': '56px',
  '16': '64px',
  '20': '80px',
  '24': '96px',
}
```

**Spacing Patterns:**
- **Section padding**: `py-12 px-6` (mobile), `py-20 px-10` (desktop)
- **Card padding**: `p-6` (24px)
- **Card grid gaps**: `gap-6` (24px) or `gap-8` (32px)
- **Section vertical gaps**: `space-y-12` (48px) for major sections
- **Inline elements**: `gap-2` (8px) for icon + text, `gap-3` (12px) for buttons

### 2.4 Core Components

#### Button Styles

```typescript
// Primary Button
const primary = {
  base: 'bg-primary hover:bg-primary-hover text-white',
  padding: 'px-6 py-3',
  typography: 'text-base font-semibold',
  border: 'rounded-md',
  transition: 'transition-colors duration-200',
  shadow: 'shadow-sm hover:shadow-md',
}

// Secondary Button
const secondary = {
  base: 'bg-white border-2 border-neutral-300 hover:border-neutral-400 text-neutral-700',
  padding: 'px-6 py-3',
  typography: 'text-base font-semibold',
  border: 'rounded-md',
  transition: 'transition-all duration-200',
}

// Tertiary Button (Link-style)
const tertiary = {
  base: 'text-primary hover:text-primary-hover',
  typography: 'text-base font-semibold',
  transition: 'transition-colors duration-200',
}
```

#### Card/Panel

```typescript
const card = {
  base: 'bg-white border border-neutral-300 rounded-lg',
  padding: 'p-6',
  shadow: 'shadow-sm hover:shadow-md',
  transition: 'transition-shadow duration-200',
}
```

#### Section Structure

```typescript
const section = {
  container: 'max-w-7xl mx-auto px-6 lg:px-10',
  padding: 'py-12 lg:py-20',
  gap: 'space-y-12',
}
```

#### Page Header

```typescript
const pageHeader = {
  container: 'border-b border-neutral-300 bg-white',
  inner: 'max-w-7xl mx-auto px-6 lg:px-10 py-8',
  title: 'text-heading-xl text-neutral-900',
  subtitle: 'text-body-lg text-neutral-600 mt-2',
  actions: 'mt-6 flex gap-3',
}
```

---

## 3. Screen Layouts

### 3.1 Incidents List Page

#### Visual Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ PAGE HEADER                                        [+ New]      │
│ Incidents                                          [Filter ▾]   │
│ Monitor and manage all incidents across services                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─ ACTIVE INCIDENTS ─────────────────────────────────────────┐ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────┐   │ │
│ │ │ 🔴 Critical   │ Database connection pool exhausted   │   │ │
│ │ │ #INC-1234     │ Assigned to: John Doe                │   │ │
│ │ │ 2 min ago     │ Service: User API                    │   │ │
│ │ │               │ [Acknowledge] [Resolve] [More...]    │   │ │
│ │ └─────────────────────────────────────────────────────┘   │ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────┐   │ │
│ │ │ 🟡 Warning    │ High memory usage on web-server-3    │   │ │
│ │ │ #INC-1233     │ Assigned to: Jane Smith              │   │ │
│ │ │ 15 min ago    │ Service: Web Server                  │   │ │
│ │ │               │ [Acknowledge] [Resolve] [More...]    │   │ │
│ │ └─────────────────────────────────────────────────────┘   │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─ RECENT ACTIVITY ──────────────────────────────────────────┐ │
│ │ 📊 Chart: Incidents over last 7 days                       │ │
│ │ 📈 MTTA: 4.2 min  │  MTTR: 18.5 min  │  Open: 12          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─ RESOLVED (Last 24 hours) ─────────────────────────────────┐ │
│ │ [Collapsed by default - click to expand]                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Component Breakdown

1. **PageHeader**
   - Props: `title`, `subtitle`, `primaryAction`, `secondaryActions`
   - Style: White background, bottom border, contained within max-width

2. **Section** (Active Incidents)
   - Header with icon + title
   - Card-based list with generous padding
   - Each incident card:
     - Left accent border (color-coded by severity)
     - Icon + severity badge
     - Incident ID + summary
     - Metadata row (timestamp, assignee, service)
     - Action buttons (primary: Acknowledge, secondary: Resolve, tertiary: More)
   - Gap between cards: 16px

3. **MetricsCard** (Recent Activity)
   - White card with border
   - Chart visualization (optional)
   - Key metrics in horizontal layout
   - Icons for each metric

4. **CollapsibleSection** (Resolved)
   - Collapsed by default
   - Click to expand
   - Same card layout as active incidents

#### Layout Constraints
- **Max width**: 1280px (Tailwind `max-w-7xl`)
- **Horizontal padding**: 24px (mobile), 40px (desktop)
- **Vertical spacing**: 48px between sections
- **Card padding**: 24px
- **Grid gap**: 16px for tight lists, 24px for cards

### 3.2 Incident Detail Page

#### Visual Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Incidents                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 🔴 #INC-1234: Database connection pool exhausted                │
│                                                                  │
│ Status: Triggered  │  Severity: Critical  │  Priority: P1       │
│ Created: 2 min ago │  Assigned: John Doe  │  Service: User API  │
│                                                                  │
│ [Acknowledge]  [Reassign]  [Escalate]  [Resolve]  [More ▾]     │
│                                                                  │
├──────────────────────────────┬──────────────────────────────────┤
│                              │                                  │
│ TIMELINE & ACTIVITY          │ CONTEXT & DETAILS                │
│                              │                                  │
│ ┌──────────────────────────┐ │ ┌──────────────────────────────┐│
│ │ ⚡ Incident triggered    │ │ │ SERVICE DETAILS              ││
│ │ 2 min ago                │ │ │ User API (Production)        ││
│ │                          │ │ │ Owner: Backend Team          ││
│ │ John Doe was notified    │ │ └──────────────────────────────┘│
│ └──────────────────────────┘ │                                  │
│                              │ ┌──────────────────────────────┐│
│ ┌──────────────────────────┐ │ │ ESCALATION POLICY            ││
│ │ 📧 Email sent to         │ │ │ Backend On-Call → Team Lead  ││
│ │ john@company.com         │ │ │ Next escalation: 13 min      ││
│ │ 2 min ago                │ │ └──────────────────────────────┘│
│ └──────────────────────────┘ │                                  │
│                              │ ┌──────────────────────────────┐│
│ ┌──────────────────────────┐ │ │ RUNBOOKS                     ││
│ │ 📱 Push notification     │ │ │ Database Connection Issues   ││
│ │ sent (iOS)               │ │ │ → View runbook               ││
│ │ 2 min ago                │ │ └──────────────────────────────┘│
│ └──────────────────────────┘ │                                  │
│                              │ ┌──────────────────────────────┐│
│ [Load more activity]         │ │ ALERT PAYLOAD                ││
│                              │ │ {                             ││
│                              │ │   "severity": "critical",    ││
│                              │ │   "source": "db-monitor"     ││
│                              │ │ }                             ││
│                              │ │ [View full payload]           ││
│                              │ └──────────────────────────────┘│
│                              │                                  │
└──────────────────────────────┴──────────────────────────────────┘
```

#### Component Breakdown

1. **BreadcrumbNav**
   - Back link with arrow icon
   - Muted text color

2. **IncidentHeader**
   - Large title with severity icon
   - Metadata chips (Status, Severity, Priority, etc.)
   - Action button row with primary/secondary/tertiary variants
   - White background, bottom border

3. **Two-Column Layout**
   - Left (60%): Timeline activity feed
   - Right (40%): Context cards
   - On mobile: Stack vertically

4. **TimelineEvent Card**
   - Icon on left
   - Title + timestamp
   - Details below
   - Vertical line connecting events
   - White background with subtle border

5. **ContextCard**
   - Smaller cards in right column
   - Title + content
   - Collapsible if content is long
   - Stack vertically with 16px gap

#### Key Patterns
- **Above-the-fold**: Header + metadata + actions visible immediately
- **Progressive disclosure**: Timeline loads more on scroll
- **Visual hierarchy**: Left column (actions) vs. right column (reference)
- **Consistent card style**: All cards use same padding, border, shadow

### 3.3 On-Call Schedule Page

#### Visual Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ PAGE HEADER                                                      │
│ On-Call Schedules                        [+ Create Schedule]    │
│ Manage rotation schedules and coverage                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [Week View ▾]  [← Prev Week]  Dec 25 - Dec 31, 2024  [Next →]  │
│                                                                  │
│ ┌─ BACKEND TEAM ─────────────────────────────────────────────┐ │
│ │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │ Sun               │ │
│ │──────┼──────┼──────┼──────┼──────┼──────┼──────             │ │
│ │ John │ John │ Jane │ Jane │ Mike │ Mike │ Mike              │ │
│ │ Doe  │ Doe  │ Smith│ Smith│ Chen │ Chen │ Chen              │ │
│ │ 8-5  │ 8-5  │ 8-5  │ 8-5  │ 8-5  │ All  │ All               │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─ FRONTEND TEAM ────────────────────────────────────────────┐ │
│ │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │ Sun               │ │
│ │──────┼──────┼──────┼──────┼──────┼──────┼──────             │ │
│ │ Sarah│ Sarah│ Tom  │ Tom  │ Lisa │ Lisa │ Lisa              │ │
│ │ Jones│ Jones│ Brown│ Brown│ Wang │ Wang │ Wang              │ │
│ │ 8-5  │ 8-5  │ 8-5  │ 8-5  │ 8-5  │ All  │ All               │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─ UPCOMING SHIFTS ──────────────────────────────────────────┐ │
│ │ • John Doe covering Backend (Mon 8am - 5pm)                 │ │
│ │ • Jane Smith covering Backend (Wed 8am - Thu 5pm)           │ │
│ │ • Mike Chen covering Backend (Fri 8am - Sun 11:59pm)        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Component Breakdown

1. **PageHeader** (same as Incidents)
   - Title, subtitle, primary action

2. **ScheduleControls**
   - View selector (Week/Month)
   - Date navigation (Prev/Next)
   - Current date range display
   - Horizontal layout, centered

3. **ScheduleCard** (per team)
   - Team name header
   - Calendar grid
   - Each cell: Person name + shift time
   - Visual indicators for current day, handoffs
   - Border, subtle shadow, white background

4. **UpcomingShiftsList**
   - List of upcoming shifts
   - User avatar + name + time range
   - Bulleted list format
   - Card style

#### Key Patterns
- **Tabular data**: Use table or grid layout
- **Visual density**: Compact but readable
- **Color coding**: Subtle backgrounds for different people (pastel colors)
- **Current day highlight**: Border or background accent
- **Responsive**: Stack schedules vertically on mobile

---

## 4. Implementation Plan

### Phase 1: Foundations (1-2 days)

**Goal:** Establish the design system tokens and base styles

#### Step 1.1: Update Tailwind Config

**File:** `/frontend/tailwind.config.js`

**Tasks:**
- [ ] Extend color palette with Atlassian-inspired colors
- [ ] Add custom spacing values
- [ ] Configure typography scale
- [ ] Add custom box shadows
- [ ] Set up container max-widths

**Deliverable:** Updated `tailwind.config.js` (see code examples below)

#### Step 1.2: Update Global CSS Variables

**File:** `/frontend/src/index.css`

**Tasks:**
- [ ] Replace current HSL color variables with new Atlassian palette
- [ ] Add gradient definitions for hero sections
- [ ] Define shadow utilities
- [ ] Set base typography styles

**Deliverable:** Updated `index.css` with new color scheme

#### Step 1.3: Create Design Tokens File

**File:** `/frontend/src/lib/design-tokens.ts`

**Tasks:**
- [ ] Export spacing scale
- [ ] Export typography scale
- [ ] Export color palette (for use in JS/TS)
- [ ] Export shadow values

**Deliverable:** Centralized design tokens for programmatic use

---

### Phase 2: Layout & Page Shell (1-3 days)

**Goal:** Create reusable layout components that match Atlassian structure

#### Step 2.1: Create Layout Components

**Files to create:**
- `/frontend/src/components/layout/AppLayout.tsx`
- `/frontend/src/components/layout/PageHeader.tsx`
- `/frontend/src/components/layout/Section.tsx`
- `/frontend/src/components/layout/Container.tsx`

**Component Specs:**

1. **AppLayout**
   - Props: `children`, `nav?`, `footer?`
   - Structure: `<header>` + `<main>` + `<footer>`
   - Max-width container, responsive padding

2. **PageHeader**
   - Props: `title`, `subtitle?`, `primaryAction?`, `secondaryActions?`, `breadcrumb?`
   - Structure: Contained, white background, bottom border
   - Action buttons in top-right (desktop) or below title (mobile)

3. **Section**
   - Props: `title?`, `subtitle?`, `children`, `variant?` (default | accent)
   - Structure: Full-width background, contained content
   - Optional title + subtitle above children

4. **Container**
   - Props: `children`, `size?` (sm | md | lg | xl | full)
   - Structure: Centered, max-width, responsive padding

**Deliverables:** 4 layout components, fully typed with TypeScript

#### Step 2.2: Update Button Components

**File:** `/frontend/src/components/ui/button.tsx`

**Tasks:**
- [ ] Update primary button colors to Atlassian blue (#0052CC)
- [ ] Adjust padding and font sizing
- [ ] Add subtle shadow on hover
- [ ] Ensure secondary/tertiary variants match design system

**Deliverable:** Updated Button component with new styles

#### Step 2.3: Update Card Component

**File:** `/frontend/src/components/ui/card.tsx`

**Tasks:**
- [ ] Adjust border color to `--color-neutral-300`
- [ ] Set background to pure white
- [ ] Add hover shadow transition
- [ ] Update padding to 24px (p-6)

**Deliverable:** Updated Card component

---

### Phase 3: High-Traffic Pages (3-7 days)

**Goal:** Refactor Incidents list and Incident detail pages to match new design system

#### Step 3.1: Incidents List Page

**File:** `/frontend/src/pages/Incidents.tsx`

**Refactor plan:**
1. Wrap page in `<AppLayout>`
2. Add `<PageHeader title="Incidents" subtitle="..." primaryAction={...} />`
3. Create `<Section title="Active Incidents">` for active list
4. Refactor incident cards:
   - Left accent border (color-coded by severity)
   - Icon + severity badge
   - Better spacing and typography
   - Action buttons using updated Button component
5. Add `<Section title="Recent Activity">` with metrics
6. Use `<CollapsibleSection title="Resolved">` for closed incidents

**New components to create:**
- `<IncidentCard>`: Displays single incident with all metadata
- `<SeverityBadge>`: Colored badge with icon
- `<MetricsCard>`: Displays MTTA, MTTR, open count

**Deliverable:** Fully refactored Incidents list page matching Atlassian style

#### Step 3.2: Incident Detail Page

**File:** `/frontend/src/pages/IncidentDetail.tsx`

**Refactor plan:**
1. Wrap in `<AppLayout>`
2. Add `<BreadcrumbNav />` at top
3. Create `<IncidentHeader>` section:
   - Large title with severity icon
   - Metadata chips
   - Action buttons
4. Two-column layout:
   - Left: `<TimelineSection>` with activity feed
   - Right: Multiple `<ContextCard>` components (Service, Escalation, Runbooks, Payload)
5. Responsive: Stack vertically on mobile

**New components to create:**
- `<IncidentHeader>`: Top section with title, metadata, actions
- `<TimelineEvent>`: Single event in timeline
- `<ContextCard>`: Reusable card for right column
- `<BreadcrumbNav>`: Breadcrumb navigation

**Deliverable:** Fully refactored Incident detail page

#### Step 3.3: On-Call Schedule Page (optional in Phase 3)

**File:** `/frontend/src/pages/Schedules.tsx`

**Refactor plan:**
1. Wrap in `<AppLayout>`
2. Add `<PageHeader>`
3. Create `<ScheduleControls>` for view/date navigation
4. Create `<ScheduleGrid>` component for each team
5. Add `<UpcomingShiftsList>`

**New components:**
- `<ScheduleGrid>`: Calendar grid view
- `<ScheduleControls>`: View selector + date nav
- `<ShiftCell>`: Individual shift in grid

**Deliverable:** Refactored Schedules page (or defer to Phase 4)

---

### Phase 4: Polish & Consistency (Ongoing)

**Goal:** Standardize all remaining components and remove legacy styles

#### Step 4.1: Component Audit

**Tasks:**
- [ ] Audit all existing UI components (`/frontend/src/components/ui/`)
- [ ] Update each to match new design system
- [ ] Document component usage in Storybook or markdown

**Components to update:**
- Input, Select, Textarea
- Dialog, Modal, Popover
- Badge, Tag, Label
- Table, DataGrid
- Tabs, Accordion
- Navigation, Sidebar

#### Step 4.2: Create Component Library Docs

**File:** `/frontend/src/components/README.md`

**Contents:**
- Design system overview
- Color palette with usage examples
- Typography scale with examples
- Spacing system guide
- Component showcase with code snippets

#### Step 4.3: Remove Legacy Styles

**Tasks:**
- [ ] Search for hardcoded colors (e.g., `#3B82F6`) and replace with design tokens
- [ ] Remove unused CSS classes
- [ ] Consolidate duplicate styles
- [ ] Run ESLint to catch inconsistencies

#### Step 4.4: Performance Optimization

**Tasks:**
- [ ] Lazy-load heavy components
- [ ] Optimize images (use WebP, responsive images)
- [ ] Minimize bundle size (check with `npm run build`)
- [ ] Add loading skeletons for better perceived performance

---

## 5. Code Examples

### 5.1 Updated Tailwind Config

**File:** `/frontend/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Atlassian-inspired palette
        primary: {
          DEFAULT: 'hsl(213, 94%, 48%)',      // #0052CC
          hover: 'hsl(216, 79%, 49%)',        // #1868DB
          foreground: 'hsl(0, 0%, 100%)',
        },
        neutral: {
          50: 'hsl(240, 20%, 99%)',           // #FAFBFC
          100: 'hsl(240, 14%, 97%)',          // #F8F8F8
          200: 'hsl(240, 11%, 94%)',          // #EEEFF1
          300: 'hsl(240, 8%, 87%)',           // #DDDEE1
          400: 'hsl(240, 5%, 65%)',           // #9FA1A6
          500: 'hsl(240, 6%, 47%)',           // #747579
          600: 'hsl(240, 7%, 33%)',           // #505258
          700: 'hsl(240, 9%, 19%)',           // #2C2D30
          900: 'hsl(240, 11%, 7%)',           // #101214
        },
        blue: {
          50: 'hsl(214, 100%, 97%)',          // #EDF5FF
          100: 'hsl(214, 95%, 92%)',          // #CFE1FD
          600: 'hsl(213, 94%, 48%)',          // #0052CC
        },
        purple: {
          50: 'hsl(270, 100%, 98%)',          // #FAF8FF
          100: 'hsl(270, 80%, 93%)',          // #EED7FC
        },
        success: {
          DEFAULT: 'hsl(145, 65%, 45%)',      // #2A9D5F
          foreground: 'hsl(0, 0%, 100%)',
        },
        warning: {
          DEFAULT: 'hsl(36, 100%, 50%)',      // #FF9500
          foreground: 'hsl(0, 0%, 100%)',
        },
        danger: {
          DEFAULT: 'hsl(0, 84%, 60%)',        // #E63946
          foreground: 'hsl(0, 0%, 100%)',
        },
        // Semantic aliases (for compatibility with existing code)
        background: 'hsl(240, 14%, 97%)',     // neutral-100
        foreground: 'hsl(240, 11%, 7%)',      // neutral-900
        border: 'hsl(240, 8%, 87%)',          // neutral-300
        input: 'hsl(240, 8%, 87%)',           // neutral-300
        ring: 'hsl(213, 94%, 48%)',           // primary
        card: {
          DEFAULT: 'hsl(0, 0%, 100%)',        // white
          foreground: 'hsl(240, 11%, 7%)',    // neutral-900
        },
        muted: {
          DEFAULT: 'hsl(240, 11%, 94%)',      // neutral-200
          foreground: 'hsl(240, 7%, 33%)',    // neutral-600
        },
        accent: {
          DEFAULT: 'hsl(214, 95%, 92%)',      // blue-100
          foreground: 'hsl(213, 94%, 48%)',   // primary
        },
      },
      spacing: {
        '18': '4.5rem',   // 72px
        '88': '22rem',    // 352px
        '128': '32rem',   // 512px
      },
      fontSize: {
        'display-2xl': ['64px', { lineHeight: '72px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-2xl': ['40px', { lineHeight: '48px', fontWeight: '600' }],
        'heading-xl': ['32px', { lineHeight: '40px', fontWeight: '600' }],
        'heading-lg': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'heading-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'heading-sm': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px' }],
        'body-md': ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        'body-xs': ['12px', { lineHeight: '16px' }],
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(9, 30, 66, 0.08)',
        'md': '0 4px 8px rgba(9, 30, 66, 0.12)',
        'lg': '0 8px 12px rgba(9, 30, 66, 0.15)',
        'xl': '0 12px 24px rgba(9, 30, 66, 0.18)',
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
      },
      maxWidth: {
        'container-sm': '640px',
        'container-md': '768px',
        'container-lg': '1024px',
        'container-xl': '1280px',
      },
    },
  },
  plugins: [],
}
```

---

### 5.2 Updated Global CSS

**File:** `/frontend/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Atlassian-inspired color palette */
    --color-primary: 213 94% 48%;
    --color-primary-hover: 216 79% 49%;
    --color-primary-foreground: 0 0% 100%;

    --color-neutral-50: 240 20% 99%;
    --color-neutral-100: 240 14% 97%;
    --color-neutral-200: 240 11% 94%;
    --color-neutral-300: 240 8% 87%;
    --color-neutral-400: 240 5% 65%;
    --color-neutral-500: 240 6% 47%;
    --color-neutral-600: 240 7% 33%;
    --color-neutral-700: 240 9% 19%;
    --color-neutral-900: 240 11% 7%;

    --background: var(--color-neutral-100);
    --foreground: var(--color-neutral-900);
    --card: 0 0% 100%;
    --card-foreground: var(--color-neutral-900);
    --border: var(--color-neutral-300);
    --input: var(--color-neutral-300);
    --ring: var(--color-primary);
    --radius: 0.5rem;

    /* Gradients */
    --gradient-hero: linear-gradient(135deg, hsl(214, 95%, 92%), hsl(270, 80%, 93%));
  }

  .dark {
    /* Dark mode palette (keep existing or adjust) */
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen",
                 "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue",
                 sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  h1 {
    @apply text-heading-xl text-neutral-900 font-semibold;
  }

  h2 {
    @apply text-heading-lg text-neutral-900 font-semibold;
  }

  h3 {
    @apply text-heading-md text-neutral-900 font-semibold;
  }

  p {
    @apply text-body-md text-neutral-600;
  }

  a {
    @apply text-primary hover:text-primary-hover transition-colors duration-200;
  }
}

@layer utilities {
  .gradient-hero {
    background: linear-gradient(135deg, hsl(214, 95%, 92%), hsl(270, 80%, 93%));
  }

  .section-spacing {
    @apply py-12 lg:py-20;
  }

  .container-padding {
    @apply px-6 lg:px-10;
  }
}
```

---

### 5.3 Layout Components

#### Container Component

**File:** `/frontend/src/components/layout/Container.tsx`

```typescript
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ContainerProps {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-container-sm',
  md: 'max-w-container-md',
  lg: 'max-w-container-lg',
  xl: 'max-w-container-xl',
  full: 'max-w-full',
};

export function Container({ children, size = 'xl', className }: ContainerProps) {
  return (
    <div className={cn(
      'mx-auto px-6 lg:px-10',
      sizeClasses[size],
      className
    )}>
      {children}
    </div>
  );
}
```

#### PageHeader Component

**File:** `/frontend/src/components/layout/PageHeader.tsx`

```typescript
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  secondaryActions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'secondary' | 'ghost';
  }>;
  breadcrumb?: {
    label: string;
    href: string;
  };
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('border-b border-neutral-300 bg-white', className)}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8">
        {breadcrumb && (
          <a
            href={breadcrumb.href}
            className="inline-flex items-center gap-2 text-body-sm text-neutral-600 hover:text-neutral-900 mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {breadcrumb.label}
          </a>
        )}

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-heading-xl text-neutral-900 font-semibold">
              {title}
            </h1>
            {subtitle && (
              <p className="text-body-lg text-neutral-600 mt-2">
                {subtitle}
              </p>
            )}
          </div>

          {(primaryAction || secondaryActions) && (
            <div className="flex flex-wrap items-center gap-3">
              {secondaryActions?.map((action, idx) => (
                <Button
                  key={idx}
                  variant={action.variant || 'secondary'}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
              {primaryAction && (
                <Button onClick={primaryAction.onClick}>
                  {primaryAction.icon}
                  {primaryAction.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### Section Component

**File:** `/frontend/src/components/layout/Section.tsx`

```typescript
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  variant?: 'default' | 'accent' | 'gradient';
  className?: string;
  innerClassName?: string;
}

export function Section({
  title,
  subtitle,
  children,
  variant = 'default',
  className,
  innerClassName,
}: SectionProps) {
  const bgClass = {
    default: 'bg-background',
    accent: 'bg-neutral-50',
    gradient: 'gradient-hero',
  }[variant];

  return (
    <section className={cn('section-spacing', bgClass, className)}>
      <div className={cn('max-w-7xl mx-auto px-6 lg:px-10', innerClassName)}>
        {(title || subtitle) && (
          <div className="mb-8 lg:mb-12">
            {title && (
              <h2 className="text-heading-xl text-neutral-900 font-semibold">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-body-lg text-neutral-600 mt-2 max-w-3xl">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
```

#### AppLayout Component

**File:** `/frontend/src/components/layout/AppLayout.tsx`

```typescript
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  nav?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function AppLayout({ children, nav, footer, className }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {nav && <header className="sticky top-0 z-50 bg-white border-b border-neutral-300">{nav}</header>}
      <main className={cn('flex-1', className)}>
        {children}
      </main>
      {footer && <footer className="bg-neutral-900 text-white">{footer}</footer>}
    </div>
  );
}
```

---

### 5.4 Updated Button Component

**File:** `/frontend/src/components/ui/button.tsx`

```typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-md",
        secondary:
          "bg-white border-2 border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:shadow-sm",
        ghost:
          "text-primary hover:text-primary-hover hover:bg-accent/50",
        destructive:
          "bg-danger text-white shadow-sm hover:bg-danger/90 hover:shadow-md",
        outline:
          "border border-neutral-300 bg-white hover:bg-neutral-50",
      },
      size: {
        sm: "px-4 py-2 text-body-sm",
        md: "px-6 py-3 text-base",
        lg: "px-8 py-4 text-body-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

---

### 5.5 Example: Incidents List Page Refactor

**File:** `/frontend/src/pages/Incidents.tsx` (refactored excerpt)

```typescript
import { useEffect, useState } from 'react';
import { Plus, Filter } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { IncidentCard } from '@/components/incidents/IncidentCard';
import { MetricsCard } from '@/components/incidents/MetricsCard';
import { incidentsAPI } from '@/lib/api-client';
import type { Incident } from '@/types/api';

export function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    try {
      setIsLoading(true);
      const response = await incidentsAPI.list();
      setIncidents(response.incidents);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');

  return (
    <AppLayout>
      <PageHeader
        title="Incidents"
        subtitle="Monitor and manage all incidents across your services"
        primaryAction={{
          label: 'Create Incident',
          onClick: () => {/* navigate to create */},
          icon: <Plus className="w-4 h-4" />,
        }}
        secondaryActions={[
          {
            label: 'Filters',
            onClick: () => {/* open filter modal */},
            variant: 'secondary',
          },
        ]}
      />

      <Section title="Active Incidents">
        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : activeIncidents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-body-lg text-neutral-600">No active incidents</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeIncidents.map(incident => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                onAcknowledge={() => handleAcknowledge(incident.id)}
                onResolve={() => handleResolve(incident.id)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent Activity" variant="accent">
        <MetricsCard incidents={incidents} />
      </Section>

      <Section title="Resolved (Last 24 hours)">
        <details className="group">
          <summary className="cursor-pointer text-body-md text-neutral-600 hover:text-neutral-900 transition-colors">
            Show {resolvedIncidents.length} resolved incidents
          </summary>
          <div className="mt-4 space-y-4">
            {resolvedIncidents.map(incident => (
              <IncidentCard key={incident.id} incident={incident} readOnly />
            ))}
          </div>
        </details>
      </Section>
    </AppLayout>
  );
}
```

---

### 5.6 Example: IncidentCard Component

**File:** `/frontend/src/components/incidents/IncidentCard.tsx`

```typescript
import { Clock, User, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SeverityBadge } from './SeverityBadge';
import type { Incident } from '@/types/api';
import { cn } from '@/lib/utils';

interface IncidentCardProps {
  incident: Incident;
  onAcknowledge?: () => void;
  onResolve?: () => void;
  readOnly?: boolean;
}

const severityColors = {
  critical: 'border-danger',
  high: 'border-warning',
  medium: 'border-blue-600',
  low: 'border-neutral-400',
  info: 'border-neutral-300',
};

export function IncidentCard({
  incident,
  onAcknowledge,
  onResolve,
  readOnly = false
}: IncidentCardProps) {
  const severityColor = severityColors[incident.severity as keyof typeof severityColors] || 'border-neutral-300';

  return (
    <div className={cn(
      'bg-white border border-neutral-300 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow',
      'border-l-4',
      severityColor
    )}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        {/* Left: Incident info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-3">
            <SeverityBadge severity={incident.severity} />
            <div className="flex-1 min-w-0">
              <h3 className="text-heading-sm text-neutral-900 truncate">
                #{incident.incident_number}: {incident.summary}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-body-sm text-neutral-600">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{formatRelativeTime(incident.created_at)}</span>
            </div>
            {incident.assigned_to && (
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>Assigned to: {incident.assigned_to.name}</span>
              </div>
            )}
            {incident.service && (
              <div className="flex items-center gap-1.5">
                <Server className="w-4 h-4" />
                <span>Service: {incident.service.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        {!readOnly && (
          <div className="flex gap-2">
            {incident.status === 'triggered' && onAcknowledge && (
              <Button variant="secondary" size="sm" onClick={onAcknowledge}>
                Acknowledge
              </Button>
            )}
            {incident.status !== 'resolved' && onResolve && (
              <Button variant="primary" size="sm" onClick={onResolve}>
                Resolve
              </Button>
            )}
            <Button variant="ghost" size="sm">
              More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds} sec ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
```

---

### 5.7 Example: SeverityBadge Component

**File:** `/frontend/src/components/incidents/SeverityBadge.tsx`

```typescript
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SeverityBadgeProps {
  severity: string;
  size?: 'sm' | 'md' | 'lg';
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    label: 'Critical',
    colors: 'bg-danger/10 text-danger border-danger/20',
  },
  high: {
    icon: AlertTriangle,
    label: 'High',
    colors: 'bg-warning/10 text-warning border-warning/20',
  },
  medium: {
    icon: AlertTriangle,
    label: 'Medium',
    colors: 'bg-blue-600/10 text-blue-600 border-blue-600/20',
  },
  low: {
    icon: Info,
    label: 'Low',
    colors: 'bg-neutral-100 text-neutral-600 border-neutral-300',
  },
  info: {
    icon: Info,
    label: 'Info',
    colors: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  },
};

export function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.info;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-1 text-body-xs gap-1',
    md: 'px-3 py-1.5 text-body-sm gap-1.5',
    lg: 'px-4 py-2 text-body-md gap-2',
  };

  return (
    <span className={cn(
      'inline-flex items-center font-medium border rounded-md',
      config.colors,
      sizeClasses[size]
    )}>
      <Icon className={cn(
        size === 'sm' && 'w-3 h-3',
        size === 'md' && 'w-4 h-4',
        size === 'lg' && 'w-5 h-5',
      )} />
      {config.label}
    </span>
  );
}
```

---

### 5.8 Example: MetricsCard Component

**File:** `/frontend/src/components/incidents/MetricsCard.tsx`

```typescript
import { TrendingUp, Clock, AlertCircle } from 'lucide-react';
import type { Incident } from '@/types/api';

interface MetricsCardProps {
  incidents: Incident[];
}

export function MetricsCard({ incidents }: MetricsCardProps) {
  const openCount = incidents.filter(i => i.status !== 'resolved').length;
  const avgMTTA = calculateMTTA(incidents);
  const avgMTTR = calculateMTTR(incidents);

  return (
    <div className="bg-white border border-neutral-300 rounded-lg p-6 shadow-sm">
      <h3 className="text-heading-md text-neutral-900 mb-6">Recent Activity</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricItem
          icon={<AlertCircle className="w-5 h-5" />}
          label="Open Incidents"
          value={openCount.toString()}
          color="text-danger"
        />
        <MetricItem
          icon={<Clock className="w-5 h-5" />}
          label="Avg. Time to Acknowledge"
          value={avgMTTA}
          color="text-blue-600"
        />
        <MetricItem
          icon={<TrendingUp className="w-5 h-5" />}
          label="Avg. Time to Resolve"
          value={avgMTTR}
          color="text-success"
        />
      </div>
    </div>
  );
}

interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

function MetricItem({ icon, label, value, color }: MetricItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className={`${color} mt-1`}>{icon}</div>
      <div>
        <p className="text-body-sm text-neutral-600">{label}</p>
        <p className="text-heading-lg text-neutral-900 mt-1">{value}</p>
      </div>
    </div>
  );
}

function calculateMTTA(incidents: Incident[]): string {
  const acknowledged = incidents.filter(i => i.acknowledged_at);
  if (acknowledged.length === 0) return 'N/A';

  const totalSeconds = acknowledged.reduce((sum, inc) => {
    const ackTime = new Date(inc.acknowledged_at!).getTime();
    const createTime = new Date(inc.created_at).getTime();
    return sum + (ackTime - createTime) / 1000;
  }, 0);

  const avgSeconds = totalSeconds / acknowledged.length;
  return formatDuration(avgSeconds);
}

function calculateMTTR(incidents: Incident[]): string {
  const resolved = incidents.filter(i => i.resolved_at);
  if (resolved.length === 0) return 'N/A';

  const totalSeconds = resolved.reduce((sum, inc) => {
    const resolveTime = new Date(inc.resolved_at!).getTime();
    const createTime = new Date(inc.created_at).getTime();
    return sum + (resolveTime - createTime) / 1000;
  }, 0);

  const avgSeconds = totalSeconds / resolved.length;
  return formatDuration(avgSeconds);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}
```

---

## Summary

This design system brings the calm, professional aesthetic of Atlassian's Opsgenie migration page to your incident management app. Key principles:

1. **Generous white space** – Never cramped; breathing room everywhere
2. **Clear hierarchy** – Size and color differences are meaningful
3. **Consistent spacing** – 4px base unit, predictable rhythm
4. **Subtle interactions** – Shadows on hover, smooth transitions
5. **Enterprise color palette** – Blues and neutrals, not flashy
6. **Reusable components** – PageHeader, Section, Container, Card patterns

**Next Steps:**
1. Implement Phase 1 (foundations) to establish design tokens
2. Build layout components in Phase 2
3. Refactor Incidents pages in Phase 3 to validate the system
4. Roll out to remaining pages in Phase 4

This system is designed to scale across your entire app while maintaining the polished, trustworthy feel that enterprise customers expect.

---

*Last updated: December 2024*
*Document owner: Product/Design*
*Review frequency: Quarterly*
