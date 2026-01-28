/**
 * Runbook Automation Component Types
 *
 * Shared type definitions for runbook automation components.
 * These types are used across RunbookAutomationPanel and its sub-components.
 */

/**
 * Props for RunbookAutomationPanel component
 */
export interface RunbookAutomationPanelProps {
  incident: {
    id: string;
    service: {
      id: string;
    };
    severity: string;
  };
}

/**
 * Runbook structure with title, description, and steps
 */
export interface Runbook {
  id: string;
  title: string;
  description?: string | null;
  steps: RunbookStep[];
}

/**
 * Individual step in a runbook
 */
export interface RunbookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  type?: string;
}

/**
 * Execution record for a runbook
 */
export interface RunbookExecution {
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

/**
 * Result of executing a single step
 */
export interface StepResult {
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
