# OnCallShift Mobile App

React Native mobile application built with Expo for iOS and Android.

## Features

### Incident Management
- Incident list with filtering (open/resolved/acknowledged)
- Incident detail with full timeline
- Acknowledge, resolve, reassign, snooze actions
- Add notes to incidents
- Bulk actions (multi-select ack/resolve)
- Swipe gestures for quick actions

### Runbooks
- View runbook steps for each incident
- One-click action execution
- Confirmation dialogs for destructive actions
- Automatic note creation after actions

### AI Features
- AI-powered incident diagnosis
- Chat interface for incident analysis
- Root cause suggestions
- Save analysis to notes

### On-Call Management
- Current on-call roster
- Personal schedule view
- Take on-call override
- Availability settings

### Additional Features
- Push notifications with deep linking
- Notification status panel (delivery tracking)
- Setup wizard for new organizations
- Analytics dashboard
- Biometric authentication
- Dark mode support
- Haptic feedback

## Implemented Screens (20 Total)

| Screen | Description |
|--------|-------------|
| LoginScreen | Authentication with Cognito |
| ForgotPasswordScreen | Password reset |
| AlertListScreen | Incident list with filters |
| AlertDetailScreen | Incident detail + timeline + runbook |
| AIChatScreen | AI diagnosis conversation |
| OnCallScreen | Current on-call roster |
| ScheduleScreen | Personal schedule view |
| SettingsScreen | App preferences |
| AnalyticsScreen | MTTA/MTTR metrics |
| InboxScreen | Notification history |
| TeamScreen | Team members |
| MoreScreen | Additional options |
| AvailabilityScreen | Availability settings |
| SetupWizardScreen | New org onboarding |
| ManageServicesScreen | Service CRUD |
| ManageSchedulesScreen | Schedule CRUD |
| ManageUsersScreen | User management |
| EscalationPoliciesScreen | Policy management |
| OnboardingScreen | First-time setup |
| CreateScheduleScreen | Create new schedule |

## Setup

### Prerequisites
- Node.js >= 18
- npm
- Expo CLI: `npm install -g expo-cli`
- For iOS: Xcode and CocoaPods
- For Android: Android Studio

### Install Dependencies
```bash
npm install
```

### Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
- `API_URL`: Your API endpoint
- `COGNITO_USER_POOL_ID`: From Terraform output
- `COGNITO_CLIENT_ID`: From Terraform output
- `AWS_REGION`: Your AWS region

## Development

```bash
# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Project Structure

```
mobile/
├── src/
│   ├── components/       # Shared UI components
│   │   ├── RespondersSection.tsx
│   │   ├── AIDiagnosisPanel.tsx
│   │   ├── OwnerAvatar.tsx
│   │   └── ...
│   ├── screens/          # App screens (20 total)
│   ├── services/         # API client, auth, runbooks
│   │   ├── apiService.ts
│   │   ├── authService.ts
│   │   ├── runbookService.ts
│   │   └── pushNotifications.ts
│   ├── data/            # Static data (templates)
│   └── theme/           # Colors, styles
├── assets/              # Images, fonts
├── App.tsx              # Root component
└── app.json             # Expo config
```

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

## Push Notifications

### iOS (APNs)
1. Get APNs certificate from Apple Developer Portal
2. Upload to AWS SNS via Terraform
3. Update `APNS_PLATFORM_APP_ARN` in backend

### Android (FCM)
1. Create Firebase project
2. Download `google-services.json`
3. Get FCM server key
4. Update `FCM_PLATFORM_APP_ARN` in backend

## Troubleshooting

### Clear Metro cache
```bash
npx expo start -c
```

### iOS pod issues
```bash
cd ios && pod install && cd ..
```

### Android gradle issues
```bash
cd android && ./gradlew clean && cd ..
```
