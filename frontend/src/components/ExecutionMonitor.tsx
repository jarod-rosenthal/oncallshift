import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface StepResult {
  stepId: string;
  stepIndex: number;
  status: 'success' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  exitCode?: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

interface RunbookExecution {
  id: string;
  runbookId: string;
  incidentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'requires_approval';
  currentStepIndex: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number | null;
  stepResults: StepResult[];
  errorMessage?: string | null;
  startedBy?: {
    id: string;
    name: string;
    email: string;
  };
  runbook?: {
    id: string;
    title: string;
  };
}

interface ExecutionMonitorProps {
  execution: RunbookExecution;
  runbookSteps: Array<{ id: string; order: number; title: string }>;
  onRefresh?: () => void;
  onCancel?: () => void;
}

export function ExecutionMonitor({ execution, runbookSteps, onRefresh, onCancel }: ExecutionMonitorProps) {
  const [autoRefresh] = useState(true);

  // Auto-refresh while running
  useEffect(() => {
    if (!autoRefresh || !onRefresh) return;
    if (execution.status === 'running' || execution.status === 'requires_approval') {
      const interval = setInterval(() => {
        onRefresh();
      }, 3000); // Refresh every 3 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, execution.status, onRefresh]);

  const getStatusIcon = (status: RunbookExecution['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-400" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-gray-500" />;
      case 'requires_approval':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: RunbookExecution['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'running':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'requires_approval':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
    }
  };

  const getStepStatusIcon = (stepResult?: StepResult) => {
    if (!stepResult) {
      return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
    switch (stepResult.status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const isInProgress = execution.status === 'running' || execution.status === 'requires_approval';

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(execution.status)}
            <div>
              <CardTitle className="text-lg">
                {execution.runbook?.title || 'Runbook Execution'}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(execution.status)}`}>
                  {execution.status.replace('_', ' ').toUpperCase()}
                </span>
                {execution.durationMs !== null && execution.durationMs !== undefined && (
                  <span className="text-xs text-gray-500">
                    Duration: {formatDuration(execution.durationMs)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {isInProgress && onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={autoRefresh && isInProgress}
              >
                Refresh
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>
              Step {execution.currentStepIndex + 1} of {runbookSteps.length}
            </span>
            <span>
              {Math.round(((execution.currentStepIndex + 1) / runbookSteps.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                execution.status === 'failed' ? 'bg-red-500' :
                execution.status === 'completed' ? 'bg-green-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${((execution.currentStepIndex + 1) / runbookSteps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-3">
          {runbookSteps.map((step, index) => {
            const stepResult = execution.stepResults.find(r => r.stepIndex === index);
            const isCurrent = index === execution.currentStepIndex;
            const isPast = index < execution.currentStepIndex;

            return (
              <div
                key={step.id}
                className={`p-3 rounded-lg border ${
                  isCurrent
                    ? 'border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-700'
                    : isPast && stepResult?.status === 'success'
                    ? 'border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-700'
                    : isPast && stepResult?.status === 'failed'
                    ? 'border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-700'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {isCurrent && execution.status === 'running' ? (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : (
                      getStepStatusIcon(stepResult)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {step.order}. {step.title}
                      </h4>
                      {stepResult?.durationMs !== undefined && (
                        <span className="text-xs text-gray-500">
                          {formatDuration(stepResult.durationMs)}
                        </span>
                      )}
                    </div>

                    {/* Step Output */}
                    {stepResult?.output && (
                      <div className="mt-2">
                        <pre className="text-xs bg-gray-900 text-gray-100 p-2 rounded overflow-x-auto max-h-32">
                          {stepResult.output}
                        </pre>
                      </div>
                    )}

                    {/* Step Error */}
                    {stepResult?.error && (
                      <div className="mt-2">
                        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded">
                          <strong>Error:</strong> {stepResult.error}
                        </div>
                      </div>
                    )}

                    {/* Exit Code */}
                    {stepResult?.exitCode !== undefined && stepResult.exitCode !== 0 && (
                      <div className="mt-1 text-xs text-gray-500">
                        Exit code: {stepResult.exitCode}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall Error Message */}
        {execution.errorMessage && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700 rounded-lg">
            <div className="flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                  Execution Failed
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {execution.errorMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Started By */}
        {execution.startedBy && (
          <div className="mt-4 pt-3 border-t text-xs text-gray-500">
            Started by {execution.startedBy.name} at{' '}
            {new Date(execution.startedAt).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
