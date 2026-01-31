# Frontend Components Documentation

This directory contains all React components for the OnCallShift frontend application. Components are organized by feature area and follow a consistent structure for maintainability and type safety.

## Directory Structure

```
src/components/
├── types.ts                  # Shared prop type definitions
├── index.ts                  # Barrel export for all components
├── ui/                       # Base UI components (Shadcn/ui + custom)
│   ├── index.ts             # UI component exports
│   ├── button.tsx           # Button component with variants
│   ├── card.tsx             # Card container
│   ├── badge.tsx            # Badge/tag component
│   ├── dialog.tsx           # Modal/dialog component
│   ├── input.tsx            # Text input
│   ├── label.tsx            # Form label
│   ├── select.tsx           # Dropdown select
│   ├── switch.tsx           # Toggle switch
│   ├── form.tsx             # Form utilities
│   ├── status-badge.tsx     # Status-specific badge
│   ├── filter-chip.tsx      # Filter toggle chip
│   ├── bulk-action-bar.tsx  # Multi-select action bar
│   ├── theme-switcher.tsx   # Light/dark mode
│   └── schedule-timeline.tsx # Schedule visualization
├── incidents/               # Incident-related components
│   ├── index.ts            # Incident component exports
│   ├── IncidentCard.tsx    # Full incident card
│   ├── SeverityBadge.tsx   # Severity display
│   ├── StateBadge.tsx      # State display
│   └── MetricsCard.tsx     # Incident metrics
├── layout/                  # Layout wrapper components
│   ├── index.ts            # Layout component exports
│   ├── Container.tsx       # Page container
│   ├── PageHeader.tsx      # Page header
│   └── Section.tsx         # Content section
├── docs/                    # Documentation site components
│   ├── index.ts            # Doc component exports
│   ├── DocsLayout.tsx      # Doc page layout
│   ├── DocsSidebar.tsx     # Navigation sidebar
│   ├── DocsContent.tsx     # Main content area
│   ├── Callout.tsx         # Callout boxes
│   ├── StepList.tsx        # Numbered steps
│   ├── Screenshot.tsx      # Media embedding
│   ├── RelatedPages.tsx    # Related links
│   ├── FeedbackWidget.tsx  # User feedback
│   └── docsNavigation.ts   # Navigation data
├── Header.tsx              # App header
├── Navigation.tsx          # Main navigation
├── AppLayout.tsx           # App shell layout
├── ErrorBoundary.tsx       # Error handling
├── PostmortemPanel.tsx     # Postmortem editor
├── ResolveModal.tsx        # Resolve incident modal
├── StickyActionBar.tsx     # Fixed action bar
├── SimilarIncidentHint.tsx # Related incident hint
├── UserAvatar.tsx          # User avatar
├── ProfilePictureEditor.tsx # Avatar editor
├── ExecutionMonitor.tsx    # Runbook execution
├── RunbookAutomationPanel.tsx # Runbook automation
├── Toast.tsx               # Notifications
├── EmptyState.tsx          # Empty placeholder
├── WeeklyCalendar.tsx      # Schedule calendar
└── SupportHoursConfig.tsx  # Support hours editor
```

## Component Type System

All components use TypeScript interfaces defined in `types.ts` for prop validation and IDE autocomplete.

### Standard Component Pattern

```typescript
// ComponentName.tsx
import type { ComponentNameProps } from '../types';

/**
 * Brief description of what the component does
 *
 * @example
 * <ComponentName prop1="value" prop2={true} />
 */
export function ComponentName({
  prop1,
  prop2 = 'default',
  className,
}: ComponentNameProps) {
  return (
    <div className={cn('base-styles', className)}>
      {/* Component content */}
    </div>
  );
}

export default ComponentName;
```

### Type Definition Pattern

```typescript
// In types.ts
/**
 * Props for ComponentName component
 *
 * @example
 * <ComponentName prop1="value" />
 */
export interface ComponentNameProps {
  /** Description of prop1 */
  prop1: string;
  /** Description of prop2 with default */
  prop2?: boolean;
  /** CSS classes for styling */
  className?: string;
}
```

## Importing Components

### Option 1: Direct Import (Specific Component)
```typescript
import { Button } from '@/components/ui/button';
import { IncidentCard } from '@/components/incidents';
```

### Option 2: Barrel Import (Recommended)
```typescript
import { Button, Card, Badge } from '@/components/ui';
import { IncidentCard, SeverityBadge, StateBadge } from '@/components';
```

### Option 3: Group Import
```typescript
import * as UIComponents from '@/components/ui';
import * as IncidentComponents from '@/components/incidents';
```

## UI Component Library

The frontend uses **Shadcn/ui** as the base UI library, combined with custom components for OnCallShift-specific needs.

### Base Components (Shadcn/ui)
- **Button** - Interactive clickable element with variants
- **Card** - Container for grouped content
- **Badge** - Small status/category indicator
- **Dialog** - Modal dialog boxes
- **Input** - Text input fields
- **Label** - Form field labels
- **Select** - Dropdown selection
- **Switch** - Toggle/checkbox component
- **Form** - Form utilities and context

### Custom UI Components
- **StatusBadge** - Severity/state-specific styling
- **FilterChip** - Toggle filter buttons
- **BulkActionBar** - Multi-select action toolbar
- **ThemeSwitcher** - Light/dark mode toggle
- **ScheduleTimeline** - Visual schedule representation

## Component Categories

### 1. Incident Components
Display and manage incidents with severity, state, and action capabilities.

```typescript
import { IncidentCard, SeverityBadge, StateBadge, MetricsCard } from '@/components';

// Usage
<IncidentCard
  incident={incident}
  onAcknowledge={() => handleAck()}
  onResolve={() => handleResolve()}
/>
```

### 2. Layout Components
Provide page structure and spacing consistency.

```typescript
import { Container, PageHeader, Section } from '@/components/layout';

// Usage
<Container>
  <PageHeader title="Incidents" description="Active incidents" />
  <Section>Content goes here</Section>
</Container>
```

### 3. Base UI Components
Reusable design system building blocks.

```typescript
import { Button, Card, Badge, Dialog } from '@/components/ui';

// Usage
<Card>
  <Button variant="primary">Click me</Button>
  <Badge>Active</Badge>
</Card>
```

## Styling Approach

The frontend uses **Tailwind CSS** for all styling with the `cn()` utility function for conditional class names.

### Example: Component Styling

```typescript
import { cn } from '../../lib/utils';
import type { ButtonProps } from '../types';

export function Button({
  variant = 'primary',
  size = 'md',
  disabled,
  className,
  children,
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors',
        // Variants
        variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
        variant === 'secondary' && 'bg-gray-200 text-gray-900 hover:bg-gray-300',
        // Sizes
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2 text-base',
        size === 'lg' && 'px-6 py-3 text-lg',
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
```

## Creating New Components

### 1. Create Component File

```typescript
// src/components/MyComponent.tsx
import type { MyComponentProps } from '../types';

export function MyComponent({
  prop1,
  prop2 = 'default',
  className,
}: MyComponentProps) {
  return <div className={className}>Content</div>;
}

export default MyComponent;
```

### 2. Add Type Definition

```typescript
// In src/components/types.ts
export interface MyComponentProps {
  /** Description of prop1 */
  prop1: string;
  /** Description of prop2 */
  prop2?: string;
  /** CSS classes */
  className?: string;
}
```

### 3. Export from Index

```typescript
// In src/components/index.ts (or subdirectory index.ts)
export { MyComponent } from './MyComponent';
export type { MyComponentProps } from './types';
```

## Type Safety Best Practices

### 1. Use Interfaces for Props
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}
```

### 2. Use Type Unions for Specific Values
```typescript
type IconSize = 'sm' | 'md' | 'lg' | 'xl';

interface IconProps {
  size?: IconSize;
  color?: string;
}
```

### 3. Re-export Component Types
```typescript
// In component file
export type { MyComponentProps } from '../types';
```

### 4. Use Type Guards for Runtime Safety
```typescript
if (typeof value === 'string') {
  // type narrowed to string
}

if (isValidSeverity(severity)) {
  // severity is guaranteed valid
}
```

## Testing Components

Each component should have corresponding tests colocated near the implementation:

```
src/components/
├── Button.tsx
├── __tests__/
│   └── Button.test.tsx
```

### Example Test

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('supports variants', () => {
    const { rerender } = render(<Button variant="primary">Click</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-blue-600');

    rerender(<Button variant="secondary">Click</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-gray-200');
  });
});
```

## Accessibility Guidelines

All components should follow WCAG 2.1 AA standards:

1. **Semantic HTML** - Use proper HTML elements
   ```typescript
   <button>Click me</button>  // Good
   <div onClick={...}>Click</div>  // Bad
   ```

2. **ARIA Labels** - Provide labels for screen readers
   ```typescript
   <button aria-label="Close dialog" onClick={onClose}>
     <X />
   </button>
   ```

3. **Keyboard Navigation** - Support Tab, Enter, Escape
4. **Focus Indicators** - Visual focus states for all interactive elements
5. **Color Contrast** - Ensure 4.5:1 contrast ratio for text

## Performance Optimization

### 1. Memoize Components
```typescript
import { memo } from 'react';

export const IncidentCard = memo(function IncidentCard({
  incident,
  onAcknowledge,
}: IncidentCardProps) {
  return <div>...</div>;
});
```

### 2. Lazy Load Components
```typescript
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

export function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### 3. Optimize Re-renders
```typescript
import { useMemo, useCallback } from 'react';

export function List({ items, onSelect }: ListProps) {
  const memoizedItems = useMemo(
    () => items.filter(i => i.active),
    [items]
  );

  const handleSelect = useCallback(
    (id: string) => onSelect(id),
    [onSelect]
  );

  return <ul>{memoizedItems.map(item => ...)}</ul>;
}
```

## Common Patterns

### Conditional Rendering
```typescript
export function Component({ showBadge, badge }: Props) {
  return (
    <div>
      {showBadge && <Badge>{badge}</Badge>}
    </div>
  );
}
```

### Polymorphic Components
```typescript
interface PolymorphicProps<T extends React.ElementType = 'div'> {
  as?: T;
  children: React.ReactNode;
}

export function Box<T extends React.ElementType = 'div'>({
  as: Component = 'div',
  children,
  ...props
}: PolymorphicProps<T> & React.ComponentPropsWithoutRef<T>) {
  return <Component {...props}>{children}</Component>;
}
```

### Compound Components
```typescript
export function Card({ children }: CardProps) {
  return <div className="card">{children}</div>;
}

export function CardHeader({ children }: CardHeaderProps) {
  return <div className="card-header">{children}</div>;
}

export function CardContent({ children }: CardContentProps) {
  return <div className="card-content">{children}</div>;
}

// Usage
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Content>Content</Card.Content>
</Card>
```

## Color System

Colors are defined using Tailwind CSS utilities and semantic color variables:

- **Primary** - Brand color (blue-600)
- **Success** - Positive action (green-600)
- **Warning** - Caution (yellow-500)
- **Danger** - Destructive action (red-600)
- **Neutral** - Text and borders (gray-*)

## Font System

Font sizing follows a semantic scale:

- **xs** - `text-xs` (0.75rem) - Helper text, captions
- **sm** - `text-sm` (0.875rem) - Body text, form labels
- **base** - `text-base` (1rem) - Default body text
- **lg** - `text-lg` (1.125rem) - Subheadings
- **xl** - `text-xl` (1.25rem) - Section titles
- **2xl** - `text-2xl` (1.5rem) - Page titles

## Spacing System

Consistent spacing based on Tailwind's scale:

- **2** - 0.5rem (8px)
- **3** - 0.75rem (12px)
- **4** - 1rem (16px)
- **6** - 1.5rem (24px)
- **8** - 2rem (32px)

## Contributing

When adding new components:

1. Create the component file with TypeScript
2. Add prop interface to `types.ts`
3. Write JSDoc documentation
4. Add to appropriate `index.ts` barrel export
5. Create tests in `__tests__` directory
6. Update this README with usage examples
7. Run `npx tsc --noEmit` to verify types
8. Run `npm test` to verify functionality
