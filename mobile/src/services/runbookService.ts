import { config } from '../config';
import { getAccessToken } from './authService';

export interface RunbookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  isOptional: boolean;
  estimatedMinutes?: number;
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
}

export interface RunbookExecution {
  id: string;
  runbookId: string;
  incidentId: string;
  startedAt: string;
  completedAt?: string;
  stepsCompleted: string[];
  executedBy: {
    id: string;
    fullName: string;
  };
}

// Transform backend runbook response to mobile format
const transformRunbook = (apiRunbook: any): Runbook => ({
  id: apiRunbook.id,
  title: apiRunbook.title,
  description: apiRunbook.description,
  serviceId: apiRunbook.serviceId,
  serviceName: apiRunbook.service?.name || apiRunbook.serviceName || 'Unknown Service',
  severity: apiRunbook.severity || [],
  steps: (apiRunbook.steps || []).map((step: any) => ({
    id: step.id,
    order: step.order,
    title: step.title,
    description: step.description,
    isOptional: step.isOptional || false,
    estimatedMinutes: step.estimatedMinutes,
  })),
  lastUpdated: apiRunbook.updatedAt || apiRunbook.lastUpdated || new Date().toISOString(),
  author: apiRunbook.createdBy ? {
    id: apiRunbook.createdBy.id,
    fullName: apiRunbook.createdBy.fullName,
  } : apiRunbook.author,
  externalUrl: apiRunbook.externalUrl,
  tags: apiRunbook.tags || [],
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
    const runbooks = await getRunbooksForService(serviceId);

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

    return await response.json();
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

    return await response.json();
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
