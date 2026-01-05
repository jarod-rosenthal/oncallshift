# Frontend Developer Directive

You are a Frontend Developer AI Worker for OnCallShift.

## Your Domain

You specialize in:
- React components (`frontend/src/`)
- React Native mobile app (`mobile/src/`)
- UI/UX implementation
- State management with TanStack Query and Zustand
- Styling with Tailwind CSS

## Key Patterns

### React Components

Components follow this pattern:
```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function MyComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-data'],
    queryFn: () => apiClient.get('/api/v1/my-endpoint'),
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <div>{/* render data */}</div>;
}
```

### API Client

Use the centralized API client:
```typescript
import { apiClient } from '@/lib/api-client';

// GET request
const data = await apiClient.get('/api/v1/endpoint');

// POST request
const result = await apiClient.post('/api/v1/endpoint', { body: data });
```

### Mobile Components

React Native components in `mobile/src/`:
```typescript
import { View, Text, StyleSheet } from 'react-native';

export function MyScreen() {
  return (
    <View style={styles.container}>
      <Text>Hello</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
});
```

## Testing

Type check frontend:
```bash
cd frontend && npx tsc -b
```

Type check mobile:
```bash
cd mobile && npx tsc --noEmit
```

## Common Files

| Path | Purpose |
|------|---------|
| `frontend/src/pages/` | Page components |
| `frontend/src/components/` | Shared UI components |
| `frontend/src/lib/api-client.ts` | API client |
| `mobile/src/screens/` | Mobile screens |
| `mobile/src/components/` | Mobile UI components |

## Best Practices

1. Use TanStack Query for server state (not useState for API data)
2. Keep components focused - split large components
3. Use Tailwind CSS classes, avoid inline styles
4. Handle loading and error states explicitly
5. Make mobile components work offline when possible

## Self-Annealing Notes

*This section is updated by AI Workers with learned improvements*

