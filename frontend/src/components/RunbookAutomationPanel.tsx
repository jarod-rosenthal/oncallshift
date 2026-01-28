import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Play, RefreshCw } from 'lucide-react';
import { ExecutionMonitor } from './ExecutionMonitor';
import { AutomationEmptyState } from './AutomationEmptyState';
import { RunbookSelector } from './RunbookSelector';
import { RunbookPreview } from './RunbookPreview';
import { AutomationErrorDisplay } from './AutomationErrorDisplay';
import { AutomationStartButton } from './AutomationStartButton';
import { runbooksAPI } from '../lib/api-client';
import type { RunbookAutomationPanelProps, Runbook, RunbookExecution } from './types/runbook-automation';
import axios from 'axios';

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
        const filtered = (response?.runbooks || []).filter((rb: any) => {
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
          <AutomationEmptyState serviceId={incident.service.id} />
        ) : !execution ? (
          <>
            <RunbookSelector
              runbooks={runbooks}
              selectedId={selectedRunbook?.id || null}
              onChange={setSelectedRunbook}
            />

            {selectedRunbook && (
              <RunbookPreview
                title={selectedRunbook.title}
                description={selectedRunbook.description}
                steps={selectedRunbook.steps}
              />
            )}

            <AutomationErrorDisplay error={error} />

            <AutomationStartButton
              disabled={!selectedRunbook}
              isLoading={isStarting}
              onClick={startExecution}
            />
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
