import * as Sentry from '@sentry/react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

let isInitialized = false;

// Initialize Sentry for crash reporting
export const initCrashReporting = () => {
  // Only initialize in production or if explicitly enabled
  if (__DEV__) {
    return;
  }

  if (isInitialized) {
    return;
  }

  try {
    Sentry.init({
      dsn: Constants.expoConfig?.extra?.sentryDsn || '',
      debug: false,
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      tracesSampleRate: 0.2,
    });

    // Set app version info
    Sentry.setTag('app.version', Application.nativeApplicationVersion || 'unknown');
    Sentry.setTag('app.build', Application.nativeBuildVersion || 'unknown');
    isInitialized = true;
  } catch (error) {
  }
};

// Set user context for crash reports
export const setUserContext = (userId: string, email: string, username?: string) => {
  if (!isInitialized && !__DEV__) return;
  try {
    Sentry.setUser({
      id: userId,
      email,
      username,
    });
  } catch (error) {
  }
};

// Clear user context on logout
export const clearUserContext = () => {
  if (!isInitialized && !__DEV__) return;
  try {
    Sentry.setUser(null);
  } catch (error) {
  }
};

// Log a breadcrumb for debugging
export const addBreadcrumb = (message: string, category: string, data?: Record<string, any>) => {
  if (!isInitialized && !__DEV__) return;
  try {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  } catch (error) {
  }
};

// Capture an exception
export const captureException = (error: Error, context?: Record<string, any>) => {
  if (!isInitialized && !__DEV__) return;
  try {
    if (context) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } catch (err) {
  }
};

// Capture a message
export const captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
  if (!isInitialized && !__DEV__) return;
  try {
    Sentry.captureMessage(message, level);
  } catch (error) {
  }
};

// Wrap a function with error boundary (if available)
export const withErrorBoundary = Sentry.withErrorBoundary;
