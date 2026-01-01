# Mobile App TypeScript Fixes Progress

## Summary
The mobile app had TypeScript errors after a theming refactor that introduced `useAppTheme()` hook but left some files still referencing the old `colors` import pattern.

## Completed Fixes

### 1. Theme/Colors Import Fixes
Files that needed `import { colors } from '../theme'` added for static StyleSheet access:
- [x] EmptyState.tsx
- [x] ActionToast.tsx
- [x] EscalationBadge.tsx
- [x] OfflineBanner.tsx
- [x] OwnerAvatar.tsx
- [x] UrgencyIndicator.tsx
- [x] AvailabilityScreen.tsx
- [x] MoreScreen.tsx
- [x] ContactMethodsScreen.tsx
- [x] InboxScreen.tsx
- [x] IntegrationsScreen.tsx
- [x] EscalationPoliciesScreen.tsx
- [x] ManageSchedulesScreen.tsx
- [x] IntegrationDetailScreen.tsx
- [x] ForgotPasswordScreen.tsx
- [x] OnCallScreen.tsx
- [x] SettingsScreen.tsx
- [x] SetupWizardScreen.tsx
- [x] TeamDetailScreen.tsx
- [x] TeamsScreen.tsx
- [x] ManageServicesScreen.tsx

### 2. ResolveTemplatesModal.tsx
- [x] Removed `colors.` references from static StyleSheet (was causing runtime error)

### 3. AIDiagnosisPanel.tsx
- [x] Converted `styles` to function that takes colors parameter
- [x] Changed import from `AIDiagnosisResponse` to `LegacyAIDiagnosisResponse`
- [x] Created local `LegacyAction` interface for action format
- [x] Fixed `getRiskColor` calls to pass colors parameter
- [x] Fixed `getRiskIcon` type from `SuggestedAction` to `LegacyAction`
- [x] Fixed `handleActionPress` type from `SuggestedAction` to `LegacyAction`

### 4. DNDControls.tsx
- [x] Fixed `styles.compactLabelActive` to `themedStyles.compactLabelActive`

### 5. FilterPanel.tsx
- [x] Added `medium` alias to `severityColors` in theme/index.ts
- [x] Removed color refs from static styles

### 6. GlobalSearch.tsx
- [x] Changed `getOrganizationUsers` to `getUsers`
- [x] Replaced `colors` with `themeColors` throughout

### 7. Toast/showSuccess Pattern Fixes
Files with incorrect `showSuccess({...})` changed to `showSuccess('string')`:
- [x] DashboardScreen.tsx
- [x] AlertListScreen.tsx
- [x] AvailabilityScreen.tsx
- [x] OnCallScreen.tsx (3 instances)

### 8. AlertDetailScreen.tsx
- [x] Changed `AIDiagnosisResponse` to `LegacyAIDiagnosisResponse`

### 9. ManageServicesScreen.tsx
- [x] Changed `'disabled'` to `'inactive'`
- [x] Added navigation import

### 10. ManageUsersScreen.tsx
- [x] Changed `UserProfile` import to `User`
- [x] Changed role values from `'user'` to `'member'`
- [x] Changed status values from `'disabled'` to `'inactive'`
- [x] Fixed `showToast` calls to use object syntax `{ message, type }`
- [x] Fixed `inviteUser` calls to use two arguments instead of object
- [x] Fixed `updateUserStatus` calls to use boolean instead of string
- [x] Removed 'invited' status handling (not in User interface)

### 11. AIChatScreen.tsx
- [x] Fixed `hasCredential` to `configured` (matching AnthropicCredentialStatus interface)
- [x] Added safety check for missing `route.params?.incident` with fallback UI

### 12. settingsService.ts
- [x] Added `SnoozedIncident` interface

### 13. useKeyboardShortcuts.ts
- [x] Added `preventDefault?: () => void` to KeyboardEvent interface

### 14. calendarService.ts / tsconfig.json
- [x] Added `"module": "esnext"` to tsconfig.json for dynamic import support

### 15. ResolveTemplatesModal.tsx - Transparency Fix
- [x] Changed from static `colors` import to `useAppTheme()` hook
- [x] Added `backgroundColor: colors.surface` to modal container
- [x] Added `borderBottomColor: colors.border` for visual separation
- [x] Themed all text colors (`textPrimary`, `textSecondary`)
- [x] Themed template item backgrounds and icons

### 16. AI Assistant UX Improvements
- [x] DashboardScreen: "AI Assistant" quick action now navigates to Incidents tab (so user can pick an incident)
- [x] AlertDetailScreen: Removed `incident.state !== 'resolved'` condition - AI Chat now available for all incidents
- [x] AlertDetailScreen: "Send as Note" option now available for resolved incidents too (for follow-up)

### 17. On-Call Screen Chip Styling
- [x] Fixed chip/pill text centering by removing fixed heights
- [x] Added `paddingVertical` and `lineHeight` for proper text centering
- [x] Updated activeChip, youChip, and overrideChip styles

### 18. Critical Alerts & DND Bypass
- [x] **app.json**: Added iOS Critical Alerts entitlement (`com.apple.developer.usernotifications.critical-alerts`)
- [x] **app.json**: Added Android permissions (`ACCESS_NOTIFICATION_POLICY`, `USE_FULL_SCREEN_INTENT`)
- [x] **app.json**: Configured expo-notifications plugin with sound support
- [x] **notificationService.ts**: Created 3 Android notification channels (critical, high, default)
- [x] **notificationService.ts**: Critical channel has `bypassDnd: true` and MAX importance
- [x] **notificationService.ts**: Added `NotificationPriority` type and priority-aware scheduling
- [x] **notificationService.ts**: Added `sendCriticalTestNotification()` function
- [x] **notificationService.ts**: Added `checkDndBypassPermission()` function
- [x] **notificationService.ts**: Added `openNotificationSettings()` function
- [x] **notificationService.ts**: Added `requestCriticalAlertsPermission()` for iOS
- [x] **SettingsScreen.tsx**: Added "Test Critical Alert" button
- [x] **SettingsScreen.tsx**: Added "Notification Settings" link to system settings

**Important Notes for Critical Alerts:**
- **iOS**: Requires Apple approval for the Critical Alerts entitlement. Apply at developer.apple.com with justification that this is an incident management tool.
- **Android**: The `bypassDnd` flag requires user to grant "Do Not Disturb access" permission in system settings.
- Test button in Settings > Notifications allows testing critical alert sound

### 19. Sound Service - Critical Alert Sound
- [x] **soundService.ts**: Added `playCriticalAlert()` function that generates a WAV beep
- [x] Generates 880Hz (A5 note) sine wave programmatically
- [x] Configured to play even in silent mode (`playsInSilentModeIOS: true`)
- [x] Sound has attack/decay envelope for less harsh tone
- [x] Slight frequency modulation for urgency
- [x] **SettingsScreen.tsx**: Test button now calls `soundService.playCriticalAlert()`

### 20. On-Call Tab Badge Styling Fix
- [x] Replaced Chip components with custom View-based badges
- [x] "You" badge: green background, icon + text, proper padding
- [x] "Override" badge: warning color, icon + text, proper padding
- [x] Both badges use `alignItems: 'center'` for proper vertical centering
- [x] Added `gap: 4` between icon and text for spacing

## Outstanding Issues

### AI Integration (Investigated)
- [x] AI integration IS still present in the app
- The AI is accessible in two ways:
  1. **From Dashboard**: "AI Assistant" quick action - but this has no incident context, so shows "No Incident Selected" message (expected behavior after fix)
  2. **From Incident Detail**: Open an incident > "Chat with AI" button appears for unresolved incidents
- The AIDiagnosisPanel component is also used in AlertDetailScreen to show AI diagnosis results
- **Resolution**: AI works correctly, but requires an incident context. Access via Incidents > tap incident > "Chat with AI"

## Files Changed
See git status for full list. Key files:
- `mobile/src/components/*.tsx` - Multiple theme fixes
- `mobile/src/screens/*.tsx` - Multiple type and API fixes
- `mobile/src/services/*.ts` - Type additions
- `mobile/src/theme/index.ts` - Added severity color alias
- `mobile/tsconfig.json` - Module setting for dynamic imports

## How to Verify
```bash
cd mobile
npx tsc --noEmit  # Should pass with no errors
npm start         # Metro bundler should start
```

## Next Steps
1. Investigate AI integration in AlertDetailScreen
2. Test the app on device to verify all fixes work at runtime
3. Consider committing these fixes
