import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import type { Incident } from '../types/api';

// Generate a Claude Code prompt for incident analysis
function generateClaudePrompt(incident: Incident): string {
  const details = incident.details ? JSON.stringify(incident.details, null, 2) : 'No additional details';

  return `claude "I'm responding to an incident and need your help investigating.

INCIDENT DETAILS:
- Incident #: ${incident.incidentNumber}
- Summary: ${incident.summary}
- Service: ${incident.service.name}
- Severity: ${incident.severity.toUpperCase()}
- State: ${incident.state}
- Triggered: ${new Date(incident.triggeredAt).toLocaleString()}
${incident.acknowledgedAt ? `- Acknowledged: ${new Date(incident.acknowledgedAt).toLocaleString()}` : ''}

ADDITIONAL CONTEXT:
${details}

INSTRUCTIONS:
1. Help me investigate the root cause of this incident
2. You may READ any cloud resources (AWS CloudWatch logs, metrics, etc.) to gather information
3. Do NOT make any changes or run any write commands without my explicit approval
4. Propose a fix and wait for my approval before implementing

Start by asking what cloud provider/services are involved if not clear from the context."`;
}

interface RunbookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  isOptional: boolean;
  estimatedMinutes?: number;
}

interface Runbook {
  id: string;
  title: string;
  description?: string;
  steps: RunbookStep[];
  externalUrl?: string;
}

interface RunbookPanelProps {
  incident: Incident;
}

// Generate a mock runbook based on service name
function getMockRunbook(serviceName: string): Runbook {
  return {
    id: `rb-${serviceName}`,
    title: `${serviceName} Incident Response`,
    description: `Quick response guide for ${serviceName} incidents`,
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
    externalUrl: 'https://oncallshift.com/docs/runbooks',
  };
}

export function RunbookPanel({ incident }: RunbookPanelProps) {
  const [runbook, setRunbook] = useState<Runbook | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    // For now, use mock runbook. In future, fetch from API
    const rb = getMockRunbook(incident.service.name);
    setRunbook(rb);

    // Load completed steps from localStorage
    const savedSteps = localStorage.getItem(`runbook-progress-${incident.id}`);
    if (savedSteps) {
      setCompletedSteps(JSON.parse(savedSteps));
    }

    // Load API key from localStorage
    const savedApiKey = localStorage.getItem('anthropic-api-key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, [incident.id, incident.service.name]);

  const copyForClaude = async () => {
    const prompt = generateClaudePrompt(incident);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveApiKey = () => {
    if (apiKeyInput.trim()) {
      localStorage.setItem('anthropic-api-key', apiKeyInput.trim());
      setApiKey(apiKeyInput.trim());
      setShowApiKeyInput(false);
      setApiKeyInput('');
    }
  };

  const removeApiKey = () => {
    localStorage.removeItem('anthropic-api-key');
    setApiKey(null);
  };

  const analyzeWithClaude = async () => {
    if (!apiKey) return;

    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    const details = incident.details ? JSON.stringify(incident.details, null, 2) : 'No additional details';
    const prompt = `I'm responding to an incident and need your help investigating.

INCIDENT DETAILS:
- Incident #: ${incident.incidentNumber}
- Summary: ${incident.summary}
- Service: ${incident.service.name}
- Severity: ${incident.severity.toUpperCase()}
- State: ${incident.state}
- Triggered: ${new Date(incident.triggeredAt).toLocaleString()}
${incident.acknowledgedAt ? `- Acknowledged: ${new Date(incident.acknowledgedAt).toLocaleString()}` : ''}

ADDITIONAL CONTEXT:
${details}

Please analyze this incident and provide:
1. Likely root causes based on the information provided
2. Recommended investigation steps
3. Potential fixes or mitigations

Be concise but thorough. Ask clarifying questions if needed.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to analyze incident');
      }

      const data = await response.json();
      setAnalysisResult(data.content[0].text);
    } catch (error: any) {
      setAnalysisError(error.message || 'Failed to analyze incident');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleStep = (stepId: string) => {
    if (incident.state === 'resolved') return;

    const newCompletedSteps = completedSteps.includes(stepId)
      ? completedSteps.filter(id => id !== stepId)
      : [...completedSteps, stepId];

    setCompletedSteps(newCompletedSteps);
    localStorage.setItem(`runbook-progress-${incident.id}`, JSON.stringify(newCompletedSteps));
  };

  if (!runbook) return null;

  const progress = Math.round((completedSteps.length / runbook.steps.length) * 100);
  const requiredSteps = runbook.steps.filter(s => !s.isOptional);
  const requiredCompleted = requiredSteps.filter(s => completedSteps.includes(s.id)).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
            <CardTitle className="text-lg">Runbook</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {completedSteps.length}/{runbook.steps.length} steps
            </span>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {requiredCompleted}/{requiredSteps.length} required steps completed
          </p>
        </div>

        {/* Claude AI Integration */}
        <div className="mt-4 p-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            <span className="font-medium text-orange-800 dark:text-orange-200">AI-Assisted Analysis</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Option A: Copy for Claude Code */}
            <Button
              variant="outline"
              size="sm"
              onClick={copyForClaude}
              className="bg-white dark:bg-gray-800"
            >
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                  Copy for Claude Code
                </>
              )}
            </Button>

            {/* Option B: Analyze with API Key */}
            {apiKey ? (
              <Button
                variant="default"
                size="sm"
                onClick={analyzeWithClaude}
                disabled={analyzing}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {analyzing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                    </svg>
                    Analyze with Claude
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowApiKeyInput(true)}
                className="bg-white dark:bg-gray-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                </svg>
                Add API Key for In-App Analysis
              </Button>
            )}

            {apiKey && (
              <Button
                variant="ghost"
                size="sm"
                onClick={removeApiKey}
                className="text-muted-foreground"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Button>
            )}
          </div>

          {/* API Key Input */}
          {showApiKeyInput && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border">
              <p className="text-sm text-muted-foreground mb-2">
                Enter your Anthropic API key for in-app analysis. Your key is stored locally in your browser.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  className="flex-1 px-3 py-1 text-sm border rounded bg-background"
                />
                <Button size="sm" onClick={saveApiKey}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowApiKeyInput(false)}>Cancel</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Get your API key at{' '}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
                  console.anthropic.com
                </a>
              </p>
            </div>
          )}

          {/* Analysis Result */}
          {analysisResult && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Claude's Analysis</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAnalysisResult(null)}
                  className="h-6 w-6 p-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Button>
              </div>
              <div className="text-sm whitespace-pre-wrap">{analysisResult}</div>
            </div>
          )}

          {/* Analysis Error */}
          {analysisError && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{analysisError}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-2">
            {apiKey ? 'Using your API key for analysis' : 'Have Claude Code? Copy the prompt and paste in your terminal'}
          </p>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="pt-0">
          {runbook.description && (
            <p className="text-sm text-muted-foreground mb-4">{runbook.description}</p>
          )}

          <div className="space-y-3">
            {runbook.steps.map((step, index) => {
              const isCompleted = completedSteps.includes(step.id);
              const isDisabled = incident.state === 'resolved';

              return (
                <div
                  key={step.id}
                  className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isCompleted
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-background hover:bg-muted/50 border-border'
                  } ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  onClick={() => toggleStep(step.id)}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0 mt-0.5">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isCompleted
                          ? 'bg-green-500 border-green-500'
                          : 'border-muted-foreground/30'
                      }`}
                    >
                      {isCompleted && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                        {index + 1}. {step.title}
                      </span>
                      {step.isOptional && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${isCompleted ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                      {step.description}
                    </p>
                    {step.estimatedMinutes && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        ~{step.estimatedMinutes} min
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* External Link */}
          {runbook.externalUrl && (
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => window.open(runbook.externalUrl, '_blank')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
              View Full Runbook
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
