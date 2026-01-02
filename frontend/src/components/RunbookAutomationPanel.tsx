import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Play, RefreshCw } from 'lucide-react';
import { ExecutionMonitor } from './ExecutionMonitor';
import { runbooksAPI } from '../lib/api-client';
import type { Incident } from '../types/api';
import axios from 'axios';

interface RunbookAutomationPanelProps {
  incident: Incident;
}

interface Runbook {
  id: string;
  title: string;
  description?: string | null;
  steps: Array<{
    id: string;
    order: number;
    title: string;
    description: string;
    type?: string;
  }>;
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
  stepResults: Array<{
    stepId: string;
    stepIndex: number;
    status: 'success' | 'failed' | 'skipped';
    output?: string;
    error?: string;
    exitCode?: number;
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
  }>;
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

export function RunbookAutomationPanel({ incident }: RunbookAutomationPanelProps) {
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [selectedRunbook, setSelectedRunbook] = useState<Runbook | null>(null);
  const [execution, setExecution] = useState<RunbookExecution | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available runbooks
  useEffect(() => {
    const loadRunbooks = async () => {
      try {
        const response = await runbooksAPI.listForService(incident.service.id);
        const filtered = response.runbooks.filter((rb: any) => {
          // Show runbooks that match severity or have automation
          const matchesSeverity = rb.severity.length === 0 || rb.severity.includes(incident.severity);
          const hasAutomation = rb.steps.some((s: any) => s.type === 'automated');
          return matchesSeverity && hasAutomation;
        });
        setRunbooks(filtered);
        if (filtered.length > 0) {
          setSelectedRunbook(filtered[0]);
        }
      } catch (err) {
        console.error('Failed to load runbooks:', err);
      }
    };
    loadRunbooks();
  }, [incident.service.id, incident.severity]);

  // Start execution
  const startExecution = async () => {
    if (!selectedRunbook) return;

    setIsStarting(true);
    setError(null);

    try {
      const response = await axios.post(
        `/api/v1/runbooks/${selectedRunbook.id}/executions`,
        {
          incident_id: incident.id,
        }
      );

      setExecution(response.data.execution);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start execution');
    } finally {
      setIsStarting(false);
    }
  };

  // Refresh execution status
  const refreshExecution = async () => {
    if (!execution) return;

    try {
      const response = await axios.get(
        `/api/v1/runbooks/executions/${execution.id}`
      );
      setExecution(response.data.execution);
    } catch (err) {
      console.error('Failed to refresh execution:', err);
    }
  };

  // Cancel execution
  const cancelExecution = async () => {
    if (!execution) return;

    try {
      await axios.post(
        `/api/v1/runbooks/executions/${execution.id}/cancel`
      );
      await refreshExecution();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel execution');
    }
  };

  // Always show the panel - show message if no runbooks
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg">Runbook Automation</CardTitle>
          </div>
          {execution && (
            <Button
              variant="outline"
              size="sm"
              onClick={refreshExecution}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {runbooks.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">No automated runbooks found for this service.</p>
            <p className="text-xs mt-1">Service ID: {incident.service.id}</p>
          </div>
        ) : !execution ? (
          <>
            {/* Runbook Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Select Runbook
              </label>
              <select
                value={selectedRunbook?.id || ''}
                onChange={(e) => {
                  const rb = runbooks.find(r => r.id === e.target.value);
                  setSelectedRunbook(rb || null);
                }}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              >
                {runbooks.map(rb => (
                  <option key={rb.id} value={rb.id}>
                    {rb.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Runbook Preview */}
            {selectedRunbook && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">{selectedRunbook.title}</h4>
                {selectedRunbook.description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {selectedRunbook.description}
                  </p>
                )}
                <div className="space-y-1">
                  {selectedRunbook.steps.map((step, idx) => (
                    <div key={step.id} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{idx + 1}.</span>
                      <span>{step.title}</span>
                      {step.type === 'automated' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          Automated
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Start Button */}
            <Button
              onClick={startExecution}
              disabled={!selectedRunbook || isStarting}
              className="w-full"
            >
              {isStarting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Execute Runbook
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground mt-2 text-center">
              Automated steps will execute sequentially with approval gates
            </p>
          </>
        ) : (
          // Show execution monitor
          <ExecutionMonitor
            execution={execution}
            runbookSteps={selectedRunbook?.steps || []}
            onRefresh={refreshExecution}
            onCancel={cancelExecution}
          />
        )}
      </CardContent>
    </Card>
  );
}
