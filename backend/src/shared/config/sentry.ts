import * as Sentry from '@sentry/node';
import { logger } from '../utils/logger';

/**
 * Sentry configuration for OnCallShift backend.
 *
 * Sentry is DISABLED by default. To enable:
 * - Set SENTRY_ENABLED=true
 * - Ensure SENTRY_DSN is set (stored in Secrets Manager)
 *
 * Environment variables:
 * - SENTRY_ENABLED: Must be "true" to enable Sentry (default: false)
 * - SENTRY_DSN: DSN from Secrets Manager (required when enabled)
 * - SENTRY_ENVIRONMENT: Environment name (default: 'development')
 * - SENTRY_RELEASE: Release version (default: git SHA or 'unknown')
 * - SENTRY_TRACES_SAMPLE_RATE: Performance tracing sample rate 0-1 (default: 0.1)
 */

let isInitialized = false;

export function initSentry(options?: {
  workerName?: string;
}): void {
  // Check if already initialized
  if (isInitialized) {
    return;
  }

  const enabled = process.env.SENTRY_ENABLED === 'true';
  const dsn = process.env.SENTRY_DSN;

  // Skip if not explicitly enabled or no DSN
  if (!enabled) {
    logger.info('Sentry disabled (SENTRY_ENABLED is not "true")');
    return;
  }

  if (!dsn) {
    logger.warn('Sentry enabled but SENTRY_DSN is not set - skipping initialization');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || process.env.GIT_SHA || 'unknown',

      // Performance monitoring
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

      // Attach user context to errors
      beforeSend(event: Sentry.ErrorEvent) {
        // Scrub sensitive data
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['x-api-key'];
        }
        return event;
      },

      // Ignore common non-errors
      ignoreErrors: [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'Request aborted',
      ],
    });

    // Set worker name if provided
    if (options?.workerName) {
      Sentry.setTag('worker', options.workerName);
    }

    isInitialized = true;
    logger.info('Sentry initialized', {
      environment: process.env.SENTRY_ENVIRONMENT || 'development',
      worker: options?.workerName,
    });
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Check if Sentry is enabled and initialized
 */
export function isSentryEnabled(): boolean {
  return isInitialized;
}

/**
 * Capture an exception to Sentry (if enabled)
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!isInitialized) return;

  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

/**
 * Capture a message to Sentry (if enabled)
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (!isInitialized) return;
  Sentry.captureMessage(message, level);
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
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  if (!isInitialized) return;
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Start a new transaction for performance monitoring
 */
export function startTransaction(name: string, op: string): Sentry.Span | undefined {
  if (!isInitialized) return undefined;
  return Sentry.startInactiveSpan({ name, op });
}

// Re-export Sentry for direct access when needed
export { Sentry };
