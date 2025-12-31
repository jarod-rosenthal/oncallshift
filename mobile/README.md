# PagerDuty-Lite Mobile App

React Native mobile application built with Expo for iOS and Android.

## Prerequisites

- Node.js >= 18
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- For iOS: Xcode and CocoaPods
- For Android: Android Studio

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your values:
   - `API_URL`: Your API endpoint (from Terraform output)
   - `COGNITO_USER_POOL_ID`: From Terraform output
   - `COGNITO_CLIENT_ID`: From Terraform output
   - `AWS_REGION`: Your AWS region

## Development

**Start Metro bundler:**
```bash
npm start
```

**Run on iOS:**
```bash
npm run ios
```

**Run on Android:**
```bash
npm run android
```

**Run on web (for testing):**
```bash
npm run web
```

## Project Structure

```
mobile/
├── src/
│   ├── api/              # API client and hooks
│   ├── auth/             # Authentication (Cognito)
│   ├── components/       # Reusable UI components
│   ├── config/           # App configuration
│   ├── navigation/       # React Navigation setup
│   ├── screens/          # App screens
│   │   ├── auth/         # Login screen
│   │   ├── incidents/    # Incident list & detail
│   │   ├── oncall/       # On-call roster
│   │   └── settings/     # Settings screen
│   ├── stores/           # Zustand state management
│   ├── types/            # TypeScript types
│   └── utils/            # Utility functions
├── assets/               # Images, fonts, sounds
├── App.tsx               # Root component
├── app.json              # Expo configuration
└── package.json
```

## Features Implemented

### MVP (Phase 1)
- ✅ Cognito authentication
- ✅ Incident list (open/resolved filter)
- ✅ Incident detail with timeline
- ✅ Acknowledge incident
- ✅ Resolve incident
- ✅ Add notes to incidents
- ✅ View on-call roster
- ✅ Push notifications
- ✅ Deep linking from notifications
- ✅ Device token registration

### Phase 2 (Completed)
- ✅ Schedule rotations view (with members list)
- ✅ Personal on-call calendar
- ✅ Take on-call button (override with duration)
- ✅ Quiet hours configuration
- ✅ Biometric authentication
- ✅ Offline caching
- ✅ User availability settings
- ✅ Service filtering for incidents
- ✅ Incident reassignment
- ✅ Server-side snooze

## Push Notifications

### iOS Setup

1. **Configure APNs:**
   - Get an APNs certificate from Apple Developer Portal
   - Upload to AWS SNS (done via Terraform)
   - Update `APNS_PLATFORM_APP_ARN` in backend

2. **Test with TestFlight:**
   - Build app: `eas build --platform ios`
   - Submit to TestFlight: `eas submit --platform ios`

### Android Setup

1. **Configure FCM:**
   - Create Firebase project
   - Add app to Firebase
   - Download `google-services.json`
   - Get FCM server key
   - Update `FCM_PLATFORM_APP_ARN` in backend

2. **Test with internal testing:**
   - Build app: `eas build --platform android`
   - Submit to Play Console: `eas submit --platform android`

## Building for Production

**Using EAS Build (Recommended):**

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

## Testing

**Run tests:**
```bash
npm test
```

**Type checking:**
```bash
npx tsc --noEmit
```

## Troubleshooting

### Metro bundler issues
```bash
# Clear cache
npx expo start -c
```

### iOS build issues
```bash
cd ios
pod install
cd ..
```

### Android build issues
```bash
cd android
./gradlew clean
cd ..
```

## Environment-Specific Builds

Create multiple .env files:
- `.env.development`
- `.env.staging`
- `.env.production`

Load based on environment:
```bash
# Development
cp .env.development .env

# Staging
cp .env.staging .env

# Production
cp .env.production .env
```

## Documentation

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/docs/getting-started)
- [React Query](https://tanstack.com/query/latest/docs/react/overview)
- [AWS Cognito SDK](https://docs.amplify.aws/lib/auth/getting-started/q/platform/js/)

## Support

For issues or questions, see the main project README.
