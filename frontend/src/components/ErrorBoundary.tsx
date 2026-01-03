import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Sentry, isSentryEnabled } from '../lib/sentry';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

/**
 * Error boundary component that catches JavaScript errors anywhere in the
 * child component tree and displays a fallback UI.
 *
 * Also reports errors to Sentry if configured.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, eventId: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, eventId: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Report to Sentry if enabled
    if (isSentryEnabled()) {
      Sentry.withScope((scope: Sentry.Scope) => {
        scope.setExtra('componentStack', errorInfo.componentStack);
        const eventId = Sentry.captureException(error);
        this.setState({ eventId });
      });
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, eventId: null });
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  handleReportIssue = (): void => {
    if (this.state.eventId && isSentryEnabled()) {
      Sentry.showReportDialog({ eventId: this.state.eventId });
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Something went wrong
            </h1>

            <p className="text-slate-600 dark:text-slate-400 mb-6">
              We're sorry, but something unexpected happened. Our team has been notified.
            </p>

            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
                  Technical details
                </summary>
                <pre className="mt-2 p-3 bg-slate-100 dark:bg-slate-900 rounded text-xs overflow-auto text-red-600 dark:text-red-400">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleRetry} variant="default">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>

              <Button onClick={this.handleGoHome} variant="outline">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>

            {this.state.eventId && isSentryEnabled() && (
              <button
                onClick={this.handleReportIssue}
                className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Report this issue
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Sentry's error boundary wrapper (only active if Sentry is enabled)
 */
export function SentryErrorBoundary({ children }: { children: ReactNode }): ReactNode {
  if (isSentryEnabled()) {
    return (
      <Sentry.ErrorBoundary fallback={<ErrorBoundary>{null}</ErrorBoundary>}>
        {children}
      </Sentry.ErrorBoundary>
    );
  }

  return <ErrorBoundary>{children}</ErrorBoundary>;
}
