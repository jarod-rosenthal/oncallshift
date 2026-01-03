import * as Sentry from '@sentry/react';

/**
 * Sentry configuration for OnCallShift frontend.
 *
 * Sentry is DISABLED by default. To enable:
 * - Set VITE_SENTRY_ENABLED=true
 * - Set VITE_SENTRY_DSN to the Sentry DSN
 *
 * Environment variables:
 * - VITE_SENTRY_ENABLED: Must be "true" to enable Sentry (default: false)
 * - VITE_SENTRY_DSN: Required when enabled
 * - VITE_SENTRY_ENVIRONMENT: Environment name (default: 'development')
 */

let isInitialized = false;

export function initSentry(): void {
  if (isInitialized) {
    return;
  }

  const enabled = import.meta.env.VITE_SENTRY_ENABLED === 'true';
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  // Skip if not explicitly enabled
  if (!enabled) {
    console.log('Sentry disabled (VITE_SENTRY_ENABLED is not "true")');
    return;
  }

  if (!dsn) {
    console.warn('Sentry enabled but VITE_SENTRY_DSN is not set - skipping initialization');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development',
      release: import.meta.env.VITE_SENTRY_RELEASE || 'unknown',

      // Performance monitoring
      tracesSampleRate: 0.1,

      // Session replay for errors
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,

      // Send all errors (SENTRY_ENABLED controls whether we reach here)
      beforeSend(event: Sentry.ErrorEvent) {
        return event;
      },

      // Ignore common non-errors
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Non-Error promise rejection captured',
        'Network request failed',
        'Failed to fetch',
        'Load failed',
        'ChunkLoadError',
      ],
    });

    isInitialized = true;
    console.log('Sentry initialized');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Check if Sentry is enabled and initialized
 */
export function isSentryEnabled(): boolean {
  return isInitialized;
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; orgId?: string }): void {
  if (!isInitialized) return;
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
  if (user.orgId) {
    Sentry.setTag('orgId', user.orgId);
  }
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (!isInitialized) return;
  Sentry.setUser(null);
}

/**
 * Capture an exception to Sentry
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!isInitialized) return;
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  if (!isInitialized) return;
  Sentry.addBreadcrumb(breadcrumb);
}

// Re-export Sentry for ErrorBoundary
export { Sentry };
