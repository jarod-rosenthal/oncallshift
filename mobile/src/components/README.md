# Mobile Components Documentation

This directory contains all React Native components for the OnCallShift mobile application. Components are organized by feature area and follow a consistent TypeScript-first structure for maintainability and type safety across iOS and Android platforms.

## Directory Structure

```
src/components/
├── types.ts                      # Shared prop type definitions
├── index.ts                      # Barrel export for all components
├── IncidentCard.tsx             # Full incident card with swipe actions
├── EscalationBadge.tsx          # Escalation countdown timer
├── UrgencyIndicator.tsx         # Urgency level indicator
├── OwnerAvatar.tsx              # User avatar with fallback
├── RespondersSection.tsx        # List of responders
├── SimilarIncidentHint.tsx      # Related incidents hint
├── RelatedIncidents.tsx         # Related incidents list
├── ServiceHealthBadge.tsx       # Service status indicator
├── ResolveIncidentModal.tsx     # Resolve dialog
├── ResolveTemplatesModal.tsx    # Resolution templates
├── FilterPanel.tsx              # Filter interface
├── FilterChip.tsx               # Filter toggle button
├── DNDControls.tsx              # Do-Not-Disturb settings
├── GlobalSearch.tsx             # Search interface
├── StickyActionBar.tsx          # Fixed action bar
├── EmptyState.tsx               # Empty state placeholder
├── ActionToast.tsx              # Toast notifications
├── OfflineBanner.tsx            # Network status banner
├── ConfettiOverlay.tsx          # Celebration animation
├── AIDiagnosisPanel.tsx         # AI analysis interface
├── AIAssistantPanel.tsx         # AI chat interface
├── OnCallBanner.tsx             # On-call info display
├── ShiftHandoffNotes.tsx        # Shift handoff notes
├── ProfilePictureEditor.tsx     # Avatar editor
├── KeyboardShortcutsHelp.tsx    # Help dialog
└── README.md                    # This file
```

## Component Type System

All components use TypeScript interfaces defined in `types.ts` for prop validation and IntelliSense support in IDEs.

### Standard Component Pattern

```typescript
// ComponentName.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { ComponentNameProps } from './types';

/**
 * Brief description of what the component does
 *
 * @example
 * <ComponentName prop1="value" onPress={() => {...}} />
 */
export const ComponentName: React.FC<ComponentNameProps> = ({
  prop1,
  prop2 = 'default',
  style,
  testID,
}) => {
  return (
    <Pressable style={style} testID={testID}>
      <Text>{prop1}</Text>
    </Pressable>
  );
};

export default ComponentName;
```

### Type Definition Pattern

```typescript
// In types.ts
/**
 * Props for ComponentName component
 *
 * @example
 * <ComponentName prop1="value" onPress={() => {...}} />
 */
export interface ComponentNameProps {
  /** Description of prop1 */
  prop1: string;
  /** Description of prop2 with default */
  prop2?: string;
  /** Callback when component is pressed */
  onPress?: () => void;
  /** Custom styling */
  style?: Record<string, any>;
  /** Test ID for automation testing */
  testID?: string;
}
```

## Importing Components

### Option 1: Direct Import (Specific Component)
```typescript
import { IncidentCard } from '@/components/IncidentCard';
import type { IncidentCardProps } from '@/components/types';
```

### Option 2: Barrel Import (Recommended)
```typescript
import {
  IncidentCard,
  EscalationBadge,
  UrgencyIndicator,
  OwnerAvatar,
} from '@/components';

import type { IncidentCardProps, FilterState } from '@/components';
```

## Component Libraries

The mobile app uses **React Native Paper** as the primary UI library, with Expo modules for cross-platform features.

### Core Dependencies
- **React Native** - Cross-platform UI framework
- **React Native Paper** - Material Design components
- **React Navigation** - Navigation framework
- **Expo** - Development platform and OTA updates
- **TanStack React Query** - Server state management
- **Zustand** - Client state management

## Component Categories

### 1. Incident Display Components

Display incident information with context-specific information:

```typescript
import {
  IncidentCard,
  EscalationBadge,
  UrgencyIndicator,
  SimilarIncidentHint,
  RelatedIncidents,
} from '@/components';

// Usage
<IncidentCard
  incident={incident}
  onPress={() => navigation.navigate('Details', { incident })}
  onAcknowledge={(inc) => handleAck(inc)}
  escalationTimeoutMinutes={30}
/>
```

### 2. User/Team Display Components

Show user and team information:

```typescript
import { OwnerAvatar, RespondersSection } from '@/components';

// Usage
<OwnerAvatar
  name="John Doe"
  email="john@example.com"
  size={48}
  showName={true}
/>

<RespondersSection
  responders={responders}
  maxVisible={3}
  onPress={() => navigation.navigate('Responders')}
/>
```

### 3. Action Modal Components

Handle user actions for incidents:

```typescript
import {
  ResolveIncidentModal,
  ResolveTemplatesModal,
} from '@/components';

// Usage
<ResolveIncidentModal
  incident={incident}
  visible={showResolveModal}
  onClose={() => setShowResolveModal(false)}
  onResolve={(data) => handleResolve(incident.id, data)}
/>
```

### 4. Filter & Search Components

Allow users to filter and search incidents:

```typescript
import { FilterPanel, FilterChip, GlobalSearch } from '@/components';

// Usage
<FilterPanel
  state={filters}
  onChange={(filters) => setFilters(filters)}
  visible={showFilters}
  onClose={() => setShowFilters(false)}
/>
```

### 5. State & Notification Components

Manage app state and notifications:

```typescript
import {
  ToastProvider,
  useToast,
  OfflineBanner,
  EmptyState,
  ConfettiProvider,
  useConfetti,
} from '@/components';

// Usage - Toast
const { showToast } = useToast();
showToast('Incident acknowledged', 'success', 3000);

// Usage - Offline Banner
<OfflineBanner />

// Usage - Confetti
const { triggerConfetti } = useConfetti();
```

### 6. AI Features

Integrate Claude AI for analysis and assistance:

```typescript
import { AIDiagnosisPanel, AIAssistantPanel } from '@/components';

// Usage
<AIDiagnosisPanel
  incident={incident}
  onClose={() => setShowDiagnosis(false)}
/>

<AIAssistantPanel
  incident={incident}
  messages={chatHistory}
  onSendMessage={(msg) => handleMessage(msg)}
/>
```

## Styling Approach

Mobile components use **React Native StyleSheet** for performance and type safety.

### Example: Component Styling

```typescript
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import type { ButtonProps } from './types';

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  onPress,
  disabled,
  style,
}) => {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  const variantStyles = {
    primary: styles.primaryButton,
    secondary: styles.secondaryButton,
    destructive: styles.destructiveButton,
  };

  const sizeStyles = {
    sm: styles.smallButton,
    md: styles.mediumButton,
    lg: styles.largeButton,
  };

  return (
    <Pressable
      style={[variantStyles[variant], sizeStyles[size], style]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
};

const makeStyles = (colors: any) =>
  StyleSheet.create({
    primaryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outline,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
    },
    destructiveButton: {
      backgroundColor: colors.error,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
    },
    smallButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    mediumButton: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    largeButton: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    buttonText: {
      fontWeight: '600',
      fontSize: 14,
      color: colors.onPrimary,
      textAlign: 'center',
    },
  });
```

## Custom Hooks

Mobile components provide custom hooks for common patterns:

### useToast
```typescript
import { useToast } from '@/components';

export function MyScreen() {
  const { showToast } = useToast();

  const handleAcknowledge = async () => {
    try {
      await acknowledgeIncident(incidentId);
      showToast('Incident acknowledged', 'success');
    } catch (error) {
      showToast('Failed to acknowledge', 'error');
    }
  };

  return <Button label="Acknowledge" onPress={handleAcknowledge} />;
}
```

### useOfflineStatus
```typescript
import { useOfflineStatus } from '@/components';

export function MyScreen() {
  const isOffline = useOfflineStatus();

  if (isOffline) {
    return <Text>You're offline. Changes will sync when online.</Text>;
  }

  return <IncidentList />;
}
```

### useConfetti
```typescript
import { useConfetti } from '@/components';

export function ResolveScreen() {
  const { triggerConfetti } = useConfetti();

  const handleResolve = async () => {
    await resolveIncident(incidentId);
    triggerConfetti(); // Show celebration animation
  };

  return <Button label="Resolve" onPress={handleResolve} />;
}
```

### useDNDStatus
```typescript
import { useDNDStatus } from '@/components';

export function NotificationCenter() {
  const { isEnabled, durationMinutes } = useDNDStatus();

  return (
    <Text>
      {isEnabled
        ? `DND enabled for ${durationMinutes} minutes`
        : 'Notifications enabled'}
    </Text>
  );
}
```

## Creating New Components

### 1. Create Component File

```typescript
// src/components/MyComponent.tsx
import React from 'react';
import { View, Text } from 'react-native';
import type { MyComponentProps } from './types';

export const MyComponent: React.FC<MyComponentProps> = ({
  title,
  onPress,
  style,
  testID,
}) => {
  return (
    <View style={style} testID={testID}>
      <Text>{title}</Text>
    </View>
  );
};

export default MyComponent;
```

### 2. Add Type Definition

```typescript
// In src/components/types.ts
export interface MyComponentProps {
  /** Component title */
  title: string;
  /** Callback when pressed */
  onPress?: () => void;
  /** Custom styling */
  style?: Record<string, any>;
  /** Test ID */
  testID?: string;
}
```

### 3. Export from Index

```typescript
// In src/components/index.ts
export { MyComponent } from './MyComponent';
export type { MyComponentProps } from './types';
```

## Type Safety Best Practices

### 1. Use React.FC with Generic Props
```typescript
export const MyComponent: React.FC<MyComponentProps> = ({ ... }) => {
  // ...
};
```

### 2. Use Type Unions for Options
```typescript
type ToastType = 'success' | 'error' | 'info' | 'warning';
type IconSize = 'sm' | 'md' | 'lg';

interface MyComponentProps {
  type?: ToastType;
  iconSize?: IconSize;
}
```

### 3. Extend Common Props
```typescript
interface MyComponentProps extends React.ViewProps {
  title: string;
  variant?: 'primary' | 'secondary';
}
```

## Testing Components

Each component should have corresponding tests:

```
src/components/
├── IncidentCard.tsx
├── __tests__/
│   └── IncidentCard.test.tsx
```

### Example Test

```typescript
import { render } from '@testing-library/react-native';
import { IncidentCard } from '../IncidentCard';

describe('IncidentCard', () => {
  it('renders incident title', () => {
    const incident = {
      id: '1',
      title: 'Database down',
      severity: 'critical',
    };

    const { getByText } = render(
      <IncidentCard incident={incident} onPress={jest.fn()} />
    );

    expect(getByText('Database down')).toBeTruthy();
  });

  it('calls onPress when card is pressed', () => {
    const onPress = jest.fn();
    const incident = { id: '1', title: 'Test', severity: 'high' };

    const { getByTestId } = render(
      <IncidentCard
        incident={incident}
        onPress={onPress}
        testID="incident-card"
      />
    );

    fireEvent.press(getByTestId('incident-card'));
    expect(onPress).toHaveBeenCalledWith(incident);
  });
});
```

## Accessibility Guidelines

All components should be accessible on both iOS and Android:

### 1. Use Accessible Labels
```typescript
<Pressable
  accessible={true}
  accessibilityLabel="Acknowledge incident"
  accessibilityRole="button"
  onPress={handleAcknowledge}
>
  <Icon name="check" />
</Pressable>
```

### 2. Use Meaningful Roles
```typescript
<View
  accessible={true}
  accessibilityRole="header"
  accessibilityLabel="Incident details"
>
  <Text>Incident #123</Text>
</View>
```

### 3. Use AccessibilityState
```typescript
<Pressable
  accessible={true}
  accessibilityState={{ disabled: isLoading }}
  onPress={handlePress}
>
  <Text>{isLoading ? 'Loading...' : 'Submit'}</Text>
</Pressable>
```

### 4. Support VoiceOver/TalkBack
- Provide meaningful labels for all interactive elements
- Use `accessibilityHint` for complex interactions
- Test with screen readers on both platforms

## Performance Optimization

### 1. Memoize Components
```typescript
import { memo } from 'react';

export const IncidentCard = memo(function IncidentCard({
  incident,
  onPress,
}: IncidentCardProps) {
  return <View>...</View>;
}, (prevProps, nextProps) => {
  // Custom equality check
  return prevProps.incident.id === nextProps.incident.id;
});
```

### 2. Use FlatList for Large Lists
```typescript
import { FlatList } from 'react-native';

export function IncidentList({ incidents }: Props) {
  return (
    <FlatList
      data={incidents}
      renderItem={({ item }) => <IncidentCard incident={item} />}
      keyExtractor={(item) => item.id}
      initialNumToRender={20}
      maxToRenderPerBatch={10}
      windowSize={21}
    />
  );
}
```

### 3. Use useCallback for Event Handlers
```typescript
import { useCallback } from 'react';

export function MyComponent({ onPress }: Props) {
  const handlePress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  return <Pressable onPress={handlePress} />;
}
```

## Theme System

Components use a centralized theme via `useAppTheme()` hook:

```typescript
import { useAppTheme } from '../hooks/useAppTheme';

export const MyComponent: React.FC<Props> = ({ style }) => {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View style={[{ padding: spacing.md }, style]}>
      <Text style={typography.body}>{label}</Text>
    </View>
  );
};
```

## Platform-Specific Code

Handle platform differences using `Platform` API:

```typescript
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 20 : 0,
    paddingBottom: Platform.OS === 'android' ? 16 : 0,
  },
});

export function MyComponent() {
  if (Platform.OS === 'ios') {
    return <IosComponent />;
  }
  return <AndroidComponent />;
}
```

## Common Patterns

### Controlled Component
```typescript
export function IncidentFilter({ value, onChange }: Props) {
  return (
    <Pressable onPress={() => onChange(!value)}>
      <Checkbox checked={value} />
    </Pressable>
  );
}
```

### Compound Component
```typescript
export function Card({ children }: Props) {
  return <View style={styles.card}>{children}</View>;
}

Card.Header = function CardHeader({ children }: Props) {
  return <View style={styles.header}>{children}</View>;
};

Card.Content = function CardContent({ children }: Props) {
  return <View style={styles.content}>{children}</View>;
};

// Usage
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Content>Content</Card.Content>
</Card>
```

### Render Props
```typescript
export function List({ data, renderItem }: Props) {
  return (
    <FlatList
      data={data}
      renderItem={({ item }) => renderItem(item)}
      keyExtractor={(item) => item.id}
    />
  );
}

// Usage
<List
  data={incidents}
  renderItem={(incident) => <IncidentCard incident={incident} />}
/>
```

## Contributing

When adding new components:

1. Create the component file with TypeScript
2. Add prop interface to `types.ts`
3. Add JSDoc documentation
4. Add to `index.ts` barrel export
5. Create tests in `__tests__` directory
6. Test on both iOS and Android
7. Run `npx tsc --noEmit` to verify types
8. Run tests with `npm test`

## Useful Resources

- [React Native Documentation](https://reactnative.dev)
- [React Native Paper](https://callstack.github.io/react-native-paper)
- [React Navigation](https://reactnavigation.org)
- [Expo Documentation](https://docs.expo.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
