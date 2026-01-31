import { config } from '../config';
import { getAccessToken } from './authService';

// ============== Types ==============

export type ScriptLanguage = 'bash' | 'python' | 'javascript' | 'natural_language';
export type AutomationMode = 'server_sandbox' | 'claude_code_api';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'requires_approval';
export type StepResultStatus = 'pending' | 'running' | 'completed' | 'failed' | 'requires_approval';

export interface RunbookStepAction {
  type: 'webhook';
  label: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  confirmMessage?: string;
}

export interface ScriptDefinition {
  language: ScriptLanguage;
  code: string;
  version: number;
}

export interface StepAutomation {
  mode: AutomationMode;
  script: ScriptDefinition;
  timeout: number;
  requiresApproval: boolean;
  credentialIds?: string[];
}

export interface RunbookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  isOptional: boolean;
  estimatedMinutes?: number;
  // Legacy webhook action support
  action?: RunbookStepAction;
  // New automation support
  type?: 'manual' | 'automated';
  automation?: StepAutomation;
}

export interface Runbook {
  id: string;
  title: string;
  description?: string;
  serviceId: string;
  serviceName: string;
  severity?: string[];
  steps: RunbookStep[];
  lastUpdated: string;
  author?: {
    id: string;
    fullName: string;
  };
  externalUrl?: string;
  tags?: string[];
  isActive?: boolean;
}

export interface StepResult {
  stepIndex: number;
  status: StepResultStatus;
  output?: string;
  error?: string;
  exitCode?: number;
  duration?: number;
  startedAt?: string;
  completedAt?: string;
  approvalId?: string;
}

export interface RunbookExecutionApproval {
  id: string;
  stepIndex: number;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  respondedAt?: string;
  responseNotes?: string;
  scriptCode: string;
  scriptLanguage: ScriptLanguage;
  scriptDescription?: string;
}

export interface RunbookExecution {
  id: string;
  runbookId: string;
  incidentId: string;
  startedAt: string;
  completedAt?: string;
  // Legacy support
  stepsCompleted: string[];
  executedBy: {
    id: string;
    fullName: string;
  };
  // Enhanced execution tracking
  status?: ExecutionStatus;
  currentStepIndex?: number;
  stepResults?: StepResult[];
  errorMessage?: string;
  approvals?: RunbookExecutionApproval[];
}

// Request/Response types for CRUD operations
export interface CreateRunbookRequest {
  serviceId: string;
  title: string;
  description?: string;
  externalUrl?: string;
  severity?: string[];
  tags?: string[];
  steps: Omit<RunbookStep, 'id'>[];
}

export interface UpdateRunbookRequest {
  title?: string;
  description?: string;
  externalUrl?: string;
  severity?: string[];
  tags?: string[];
  steps?: RunbookStep[];
}

export interface ExecuteStepResult {
  status: StepResultStatus;
  output?: string;
  error?: string;
  exitCode?: number;
  duration?: number;
  approvalId?: string;
}

// ============== Transform Functions ==============

// Transform backend runbook response to mobile format
const transformRunbook = (apiRunbook: any): Runbook => ({
  id: apiRunbook.id,
  title: apiRunbook.title,
  description: apiRunbook.description,
  serviceId: apiRunbook.serviceId,
  serviceName: apiRunbook.service?.name || apiRunbook.serviceName || 'Unknown Service',
  severity: apiRunbook.severity || [],
  steps: (apiRunbook.steps || []).map((step: any): RunbookStep => ({
    id: step.id,
    order: step.order,
    title: step.title,
    description: step.description,
    isOptional: step.isOptional || false,
    estimatedMinutes: step.estimatedMinutes,
    // Legacy webhook action
    action: step.action ? {
      type: step.action.type || 'webhook',
      label: step.action.label,
      url: step.action.url,
      method: step.action.method,
      body: step.action.body,
      confirmMessage: step.action.confirmMessage,
    } : undefined,
    // New automation support
    type: step.type || 'manual',
    automation: step.automation ? {
      mode: step.automation.mode,
      script: {
        language: step.automation.script?.language || 'bash',
        code: step.automation.script?.code || '',
        version: step.automation.script?.version || 1,
      },
      timeout: step.automation.timeout || 60,
      requiresApproval: step.automation.requiresApproval || false,
      credentialIds: step.automation.credentialIds,
    } : undefined,
  })),
  lastUpdated: apiRunbook.updatedAt || apiRunbook.lastUpdated || new Date().toISOString(),
  author: apiRunbook.createdBy ? {
    id: apiRunbook.createdBy.id,
    fullName: apiRunbook.createdBy.fullName,
  } : apiRunbook.author,
  externalUrl: apiRunbook.externalUrl,
  tags: apiRunbook.tags || [],
  isActive: apiRunbook.isActive !== false,
});

// Transform execution response
const transformExecution = (apiExecution: any): RunbookExecution => ({
  id: apiExecution.id,
  runbookId: apiExecution.runbookId,
  incidentId: apiExecution.incidentId,
  startedAt: apiExecution.startedAt,
  completedAt: apiExecution.completedAt,
  stepsCompleted: apiExecution.stepsCompleted || [],
  executedBy: apiExecution.startedBy || apiExecution.executedBy || { id: '', fullName: 'Unknown' },
  status: apiExecution.status || 'pending',
  currentStepIndex: apiExecution.currentStepIndex || 0,
  stepResults: apiExecution.stepResults || [],
  errorMessage: apiExecution.errorMessage,
  approvals: apiExecution.approvals || [],
});

// Fetch runbooks for a specific service
export const getRunbooksForService = async (serviceId: string): Promise<Runbook[]> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('[RunbookService] No access token');
      return [];
    }

    const response = await fetch(`${config.apiUrl}/v1/runbooks/service/${serviceId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log('[RunbookService] Failed to fetch runbooks:', response.status);
      return [];
    }

    const data = await response.json();
    console.log('[RunbookService] Fetched runbooks:', data.runbooks?.length || 0);
    return (data.runbooks || []).map(transformRunbook);
  } catch (error) {
    console.error('[RunbookService] Error fetching runbooks:', error);
    return [];
  }
};

// Get runbook by ID
export const getRunbook = async (runbookId: string): Promise<Runbook | null> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return null;
    }

    const response = await fetch(`${config.apiUrl}/v1/runbooks/${runbookId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.runbook ? transformRunbook(data.runbook) : null;
  } catch (error) {
    console.error('[RunbookService] Error fetching runbook:', error);
    return null;
  }
};

// Find matching runbook for an incident
export const findRunbookForIncident = async (
  serviceId: string,
  severity: string,
  keywords?: string[]
): Promise<Runbook | null> => {
  try {
    // First, try service-specific runbooks
    let runbooks = await getRunbooksForService(serviceId);

    // If no service-specific runbooks, try ALL org runbooks with automated steps
    if (runbooks.length === 0) {
      console.log('[RunbookService] No service-specific runbooks, trying org-wide...');
      try {
        const allRunbooks = await listRunbooks();
        // Filter to runbooks that have automated steps
        runbooks = allRunbooks.filter(rb =>
          rb.steps?.some(s => s.type === 'automated')
        );
        console.log('[RunbookService] Found org-wide automated runbooks:', runbooks.length);
      } catch (e) {
        console.log('[RunbookService] Could not fetch org runbooks:', e);
      }
    }

    if (runbooks.length === 0) {
      return null;
    }

    // First, try to find runbook matching severity
    const matchingSeverity = runbooks.filter(
      rb => !rb.severity || rb.severity.length === 0 || rb.severity.includes(severity)
    );

    if (matchingSeverity.length === 0) {
      return runbooks[0]; // Return first available runbook
    }

    // If keywords provided, try to match tags
    if (keywords && keywords.length > 0) {
      const matchingTags = matchingSeverity.find(
        rb => rb.tags?.some(tag => keywords.some(kw => tag.toLowerCase().includes(kw.toLowerCase())))
      );
      if (matchingTags) {
        return matchingTags;
      }
    }

    return matchingSeverity[0];
  } catch (error) {
    console.error('[RunbookService] Error finding runbook:', error);
    return null;
  }
};

// Start runbook execution for an incident
export const startRunbookExecution = async (
  runbookId: string,
  incidentId: string
): Promise<RunbookExecution | null> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return null;
    }

    const response = await fetch(`${config.apiUrl}/v1/runbooks/${runbookId}/executions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ incidentId }),
    });

    if (!response.ok) {
      return null;
    }

    // Safely parse JSON response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('[RunbookService] Error starting execution:', error);
    return null;
  }
};

// Mark a step as completed
export const completeRunbookStep = async (
  executionId: string,
  stepId: string
): Promise<boolean> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return false;
    }

    const response = await fetch(
      `${config.apiUrl}/v1/runbook-executions/${executionId}/steps/${stepId}/complete`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[RunbookService] Error completing step:', error);
    return false;
  }
};

// Get current execution for an incident
export const getExecutionForIncident = async (incidentId: string): Promise<RunbookExecution | null> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return null;
    }

    const response = await fetch(
      `${config.apiUrl}/v1/incidents/${incidentId}/runbook-execution`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    // Safely parse JSON response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('[RunbookService] Error fetching execution:', error);
    return null;
  }
};

// Generate mock runbook for demo purposes
export const getMockRunbook = (serviceId: string, serviceName: string): Runbook => ({
  id: `rb-${serviceId}`,
  title: `${serviceName} Incident Response`,
  description: `Quick response guide for ${serviceName} incidents`,
  serviceId,
  serviceName,
  severity: ['critical', 'error'],
  steps: [
    {
      id: 'step-1',
      order: 1,
      title: 'Acknowledge & investigate',
      description: 'Ack the incident and check logs/metrics for root cause.',
      isOptional: false,
      estimatedMinutes: 10,
    },
    {
      id: 'step-2',
      order: 2,
      title: 'Fix or rollback',
      description: 'Apply a fix or rollback to restore service.',
      isOptional: false,
      estimatedMinutes: 15,
    },
    {
      id: 'step-3',
      order: 3,
      title: 'Verify & resolve',
      description: 'Confirm service is healthy, then resolve the incident.',
      isOptional: false,
      estimatedMinutes: 5,
    },
  ],
  lastUpdated: new Date().toISOString(),
  tags: ['standard', 'response', 'troubleshooting'],
  externalUrl: 'https://oncallshift.com/runbooks',
});

// ============== CRUD Operations ==============

// List all runbooks for the organization
export const listRunbooks = async (): Promise<Runbook[]> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('[RunbookService] No access token');
      return [];
    }

    const response = await fetch(`${config.apiUrl}/v1/runbooks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log('[RunbookService] Failed to list runbooks:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.runbooks || []).map(transformRunbook);
  } catch (error) {
    console.error('[RunbookService] Error listing runbooks:', error);
    return [];
  }
};

// Create a new runbook
export const createRunbook = async (data: CreateRunbookRequest): Promise<Runbook | null> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${config.apiUrl}/v1/runbooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create runbook: ${response.status}`);
    }

    const result = await response.json();
    return result.runbook ? transformRunbook(result.runbook) : null;
  } catch (error) {
    console.error('[RunbookService] Error creating runbook:', error);
    throw error;
  }
};

// Update an existing runbook
export const updateRunbook = async (runbookId: string, data: UpdateRunbookRequest): Promise<Runbook | null> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${config.apiUrl}/v1/runbooks/${runbookId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update runbook: ${response.status}`);
    }

    const result = await response.json();
    return result.runbook ? transformRunbook(result.runbook) : null;
  } catch (error) {
    console.error('[RunbookService] Error updating runbook:', error);
    throw error;
  }
};

// Delete a runbook
export const deleteRunbook = async (runbookId: string): Promise<boolean> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${config.apiUrl}/v1/runbooks/${runbookId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to delete runbook: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('[RunbookService] Error deleting runbook:', error);
    throw error;
  }
};

// Seed example runbooks
export const seedExampleRunbooks = async (): Promise<Runbook[]> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${config.apiUrl}/v1/runbooks/seed-examples`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to seed runbooks: ${response.status}`);
    }

    const result = await response.json();
    return (result.runbooks || []).map(transformRunbook);
  } catch (error) {
    console.error('[RunbookService] Error seeding runbooks:', error);
    throw error;
  }
};

// ============== Execution Operations ==============

// Get execution by ID
export const getExecution = async (executionId: string): Promise<RunbookExecution | null> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return null;
    }

    const response = await fetch(`${config.apiUrl}/v1/runbooks/executions/${executionId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data ? transformExecution(data) : null;
  } catch (error) {
    console.error('[RunbookService] Error fetching execution:', error);
    return null;
  }
};

// Execute an automated step
export const executeStep = async (
  executionId: string,
  stepIndex: number,
  approved?: boolean
): Promise<ExecuteStepResult> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${config.apiUrl}/v1/runbooks/executions/${executionId}/steps/${stepIndex}/execute`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ approved }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to execute step: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[RunbookService] Error executing step:', error);
    throw error;
  }
};

// Cancel a running execution
export const cancelExecution = async (executionId: string): Promise<boolean> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${config.apiUrl}/v1/runbooks/executions/${executionId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to cancel execution: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('[RunbookService] Error cancelling execution:', error);
    throw error;
  }
};

// ============== Approval Operations ==============

// Approve a pending step
export const approveStep = async (approvalId: string, notes?: string): Promise<boolean> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${config.apiUrl}/v1/runbooks/executions/approvals/${approvalId}/approve`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to approve step: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('[RunbookService] Error approving step:', error);
    throw error;
  }
};

// Reject a pending step
export const rejectStep = async (approvalId: string, notes?: string): Promise<boolean> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${config.apiUrl}/v1/runbooks/executions/approvals/${approvalId}/reject`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to reject step: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('[RunbookService] Error rejecting step:', error);
    throw error;
  }
};

// Get all executions for an incident
export const getExecutionsForIncident = async (incidentId: string): Promise<RunbookExecution[]> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return [];
    }

    const response = await fetch(
      `${config.apiUrl}/v1/runbooks/executions/incident/${incidentId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.executions || data || []).map(transformExecution);
  } catch (error) {
    console.error('[RunbookService] Error fetching executions for incident:', error);
    return [];
  }
};
