import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { runbooksAPI, aiAssistantAPI, cloudCredentialsAPI } from '../lib/api-client';
import type { Incident, RunbookStep as APIRunbookStep, RunbookStepAction, CloudProvider } from '../types/api';
import axios from 'axios';

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

// Use API types for runbooks
type RunbookStep = APIRunbookStep;

interface Runbook {
  id: string;
  title: string;
  description?: string | null;
  steps: RunbookStep[];
  externalUrl?: string | null;
}

interface ActionState {
  stepId: string;
  status: 'idle' | 'confirming' | 'executing' | 'success' | 'error';
  message?: string;
}

interface ToolCall {
  name: string;
  status: 'pending' | 'success' | 'error';
  summary?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

interface CloudCredentialOption {
  id: string;
  name: string;
  provider: CloudProvider;
}

interface RunbookPanelProps {
  incident: Incident;
  onAddNote?: (content: string) => Promise<void>;
  onAIChatActiveChange?: (isActive: boolean) => void;
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

export function RunbookPanel({ incident, onAddNote, onAIChatActiveChange }: RunbookPanelProps) {
  const [runbook, setRunbook] = useState<Runbook | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [noteAdded, setNoteAdded] = useState(false);
  const [refreshPaused, setRefreshPaused] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [availableCredentials, setAvailableCredentials] = useState<CloudCredentialOption[]>([]);
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([]);
  const [showCredentialSelector, setShowCredentialSelector] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'haiku' | 'sonnet' | 'opus'>('sonnet');

  const modelOptions = [
    { id: 'haiku' as const, name: 'Claude Haiku', description: 'Fast, lightweight' },
    { id: 'sonnet' as const, name: 'Claude Sonnet', description: 'Balanced (Recommended)' },
    { id: 'opus' as const, name: 'Claude Opus', description: 'Most capable' },
  ];

  // Execute a runbook action
  const executeAction = async (stepId: string, action: RunbookStepAction) => {
    // If there's a confirm message and we're not already confirming, show confirmation
    if (action.confirmMessage && actionStates[stepId]?.status !== 'confirming') {
      setActionStates(prev => ({
        ...prev,
        [stepId]: { stepId, status: 'confirming', message: action.confirmMessage }
      }));
      return;
    }

    // Execute the action
    setActionStates(prev => ({
      ...prev,
      [stepId]: { stepId, status: 'executing' }
    }));

    try {
      const response = await axios({
        method: action.method,
        url: action.url,
        data: action.body,
      });

      setActionStates(prev => ({
        ...prev,
        [stepId]: { stepId, status: 'success', message: response.data.message || 'Action completed' }
      }));

      // Mark step as completed
      if (!completedSteps.includes(stepId)) {
        const newCompletedSteps = [...completedSteps, stepId];
        setCompletedSteps(newCompletedSteps);
        localStorage.setItem(`runbook-progress-${incident.id}`, JSON.stringify(newCompletedSteps));
      }

      // Clear success after 3 seconds
      setTimeout(() => {
        setActionStates(prev => ({
          ...prev,
          [stepId]: { stepId, status: 'idle' }
        }));
      }, 3000);
    } catch (error: any) {
      setActionStates(prev => ({
        ...prev,
        [stepId]: {
          stepId,
          status: 'error',
          message: error.response?.data?.error || error.message || 'Action failed'
        }
      }));

      // Clear error after 5 seconds
      setTimeout(() => {
        setActionStates(prev => ({
          ...prev,
          [stepId]: { stepId, status: 'idle' }
        }));
      }, 5000);
    }
  };

  const cancelConfirmation = (stepId: string) => {
    setActionStates(prev => ({
      ...prev,
      [stepId]: { stepId, status: 'idle' }
    }));
  };

  // Notify parent when chat becomes active/inactive (respects user override)
  useEffect(() => {
    // Only pause if there are messages AND user hasn't manually resumed
    onAIChatActiveChange?.(chatMessages.length > 0 && refreshPaused);
  }, [chatMessages.length, refreshPaused, onAIChatActiveChange]);

  useEffect(() => {
    // Fetch runbook from API, fall back to mock if none found
    const loadRunbook = async () => {
      try {
        const response = await runbooksAPI.listForService(incident.service.id);
        const serviceRunbooks = response.runbooks;

        if (serviceRunbooks.length > 0) {
          // Find the best matching runbook:
          // 1. Match severity if specified
          // 2. Otherwise use the first one
          let matchedRunbook = serviceRunbooks.find(rb =>
            rb.severity.length === 0 || rb.severity.includes(incident.severity)
          );

          if (!matchedRunbook) {
            matchedRunbook = serviceRunbooks[0];
          }

          setRunbook({
            id: matchedRunbook.id,
            title: matchedRunbook.title,
            description: matchedRunbook.description,
            steps: matchedRunbook.steps,
            externalUrl: matchedRunbook.externalUrl,
          });
        } else {
          // Fall back to mock runbook
          setRunbook(getMockRunbook(incident.service.name));
        }
      } catch (error) {
        console.error('Failed to fetch runbook:', error);
        // Fall back to mock runbook on error
        setRunbook(getMockRunbook(incident.service.name));
      }
    };

    loadRunbook();

    // Load completed steps from localStorage
    const savedSteps = localStorage.getItem(`runbook-progress-${incident.id}`);
    if (savedSteps) {
      setCompletedSteps(JSON.parse(savedSteps));
    }

    // Load saved conversation from localStorage
    const savedChat = localStorage.getItem(`ai-chat-${incident.id}`);
    if (savedChat) {
      try {
        setChatMessages(JSON.parse(savedChat));
      } catch (e) {
        // Invalid JSON, clear it
        localStorage.removeItem(`ai-chat-${incident.id}`);
      }
    }

    // Load cloud credentials
    const loadCredentials = async () => {
      try {
        const response = await cloudCredentialsAPI.list();
        const creds = response.credentials
          ?.filter(c => c.enabled)
          ?.map(c => ({
            id: c.id,
            name: c.name,
            provider: c.provider as CloudProvider,
          })) || [];
        setAvailableCredentials(creds);
      } catch {
        // Credentials are optional
      }
    };
    loadCredentials();
  }, [incident.id, incident.service.id, incident.service.name, incident.severity]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const copyForClaude = async () => {
    const prompt = generateClaudePrompt(incident);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCredential = (credId: string) => {
    setSelectedCredentials(prev =>
      prev.includes(credId)
        ? prev.filter(id => id !== credId)
        : [...prev, credId]
    );
  };

  const generateInitialPrompt = (): string => {
    const details = incident.details ? JSON.stringify(incident.details, null, 2) : 'No additional details';
    return `Please analyze this incident:

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

Provide:
1. Likely root causes based on the information
2. Recommended investigation steps
3. Potential fixes or mitigations`;
  };

  const sendMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    setIsLoading(true);
    setChatError(null);

    // Add user message to chat
    const userMessage: ChatMessage = {
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
    };

    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setUserInput('');

    // Create placeholder for assistant response
    const assistantId = Date.now();
    let assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: assistantId,
      toolCalls: [],
    };
    setChatMessages(prev => [...prev, assistantMessage]);

    try {
      await aiAssistantAPI.streamChat(
        incident.id,
        {
          message: messageContent.trim(),
          conversation_id: conversationId || undefined,
          credential_ids: selectedCredentials,
          model: selectedModel,
        },
        (event) => {
          switch (event.type) {
            case 'conversation_id':
              setConversationId(event.id);
              break;

            case 'text':
              setChatMessages(prev => prev.map(m =>
                m.timestamp === assistantId
                  ? { ...m, content: m.content + event.content }
                  : m
              ));
              break;

            case 'tool_call':
              setChatMessages(prev => prev.map(m =>
                m.timestamp === assistantId
                  ? {
                      ...m,
                      toolCalls: [
                        ...(m.toolCalls || []),
                        { name: event.tool || event.toolName, status: 'pending' as const }
                      ]
                    }
                  : m
              ));
              break;

            case 'tool_result':
              setChatMessages(prev => prev.map(m =>
                m.timestamp === assistantId
                  ? {
                      ...m,
                      toolCalls: m.toolCalls?.map(tc =>
                        tc.name === (event.tool || event.toolName)
                          ? { ...tc, status: event.result?.success ? 'success' as const : 'error' as const }
                          : tc
                      )
                    }
                  : m
              ));
              break;

            case 'error':
              setChatError(event.error);
              break;

            case 'done':
              if (event.conversation_id) {
                setConversationId(event.conversation_id);
              }
              // Save to localStorage
              setChatMessages(prev => {
                localStorage.setItem(`ai-chat-${incident.id}`, JSON.stringify(prev));
                return prev;
              });
              break;
          }
        },
        (err) => {
          setChatError(err.message);
        }
      );
    } catch (err: any) {
      setChatError(err.message || 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const startAnalysis = () => {
    const initialPrompt = generateInitialPrompt();
    sendMessage(initialPrompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(userInput);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
    localStorage.removeItem(`ai-chat-${incident.id}`);
    setNoteAdded(false);
  };

  const handleAddToNotes = async () => {
    if (chatMessages.length === 0 || !onAddNote) return;

    setAddingNote(true);
    try {
      // Format all messages as a conversation summary
      const formattedChat = chatMessages
        .map(msg => `**${msg.role === 'user' ? 'You' : 'Claude'}:**\n${msg.content}`)
        .join('\n\n---\n\n');
      await onAddNote(`**AI Analysis Conversation:**\n\n${formattedChat}`);
      setNoteAdded(true);
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setAddingNote(false);
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              <span className="font-medium text-orange-800 dark:text-orange-200">AI-Assisted Analysis</span>
            </div>
            {chatMessages.length > 0 && (
              <button
                onClick={() => setRefreshPaused(!refreshPaused)}
                className={`text-xs px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  refreshPaused
                    ? 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 hover:bg-orange-200 dark:hover:bg-orange-900'
                    : 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 hover:bg-green-200 dark:hover:bg-green-900'
                }`}
                title={refreshPaused ? 'Click to resume auto-refresh' : 'Click to pause auto-refresh'}
              >
                {refreshPaused ? 'Auto-refresh paused' : 'Auto-refresh on'}
              </button>
            )}
          </div>

          {/* Initial buttons when no chat */}
          {chatMessages.length === 0 && (
            <>
              {/* Model & Cloud Options */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {/* Model Selector */}
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as 'haiku' | 'sonnet' | 'opus')}
                  className="text-sm px-2 py-1 border rounded bg-white dark:bg-gray-800 text-foreground"
                >
                  {modelOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name} - {opt.description}
                    </option>
                  ))}
                </select>

                {/* Cloud Credentials Toggle */}
                {availableCredentials.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCredentialSelector(!showCredentialSelector)}
                    className="bg-white dark:bg-gray-800"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                    </svg>
                    Cloud: {selectedCredentials.length > 0 ? `${selectedCredentials.length} selected` : 'None'}
                  </Button>
                )}
              </div>

              {/* Cloud Credentials Selector */}
              {showCredentialSelector && availableCredentials.length > 0 && (
                <div className="mb-3 p-2 bg-white dark:bg-gray-800 rounded border">
                  <p className="text-xs text-muted-foreground mb-2">Select cloud credentials for Claude to use:</p>
                  {availableCredentials.map(cred => (
                    <label key={cred.id} className="flex items-center gap-2 py-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCredentials.includes(cred.id)}
                        onChange={() => toggleCredential(cred.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{cred.name}</span>
                      <span className="text-xs text-muted-foreground uppercase">{cred.provider}</span>
                    </label>
                  ))}
                </div>
              )}

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

                {/* Option B: Analyze with Backend */}
                <Button
                  variant="default"
                  size="sm"
                  onClick={startAnalysis}
                  disabled={isLoading}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isLoading ? (
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
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                {selectedCredentials.length > 0
                  ? `Claude can query ${selectedCredentials.length} cloud credential(s) during analysis`
                  : 'Have Claude Code? Copy the prompt and paste in your terminal'}
              </p>
            </>
          )}

          {/* Chat Interface */}
          {chatMessages.length > 0 && (
            <div className="mt-2">
              {/* Chat Messages */}
              <div
                ref={chatContainerRef}
                className="max-h-96 xl:max-h-[32rem] 2xl:max-h-[40rem] overflow-y-auto space-y-3 mb-3 p-2 bg-white dark:bg-gray-800 rounded border"
              >
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] xl:max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-foreground'
                      }`}
                    >
                      {/* Tool Calls */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {msg.toolCalls.map((tc, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-xs bg-white/10 rounded px-2 py-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                              </svg>
                              <span className="font-medium">{tc.name.replace(/_/g, ' ')}</span>
                              {tc.status === 'pending' && (
                                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                              )}
                              {tc.status === 'success' && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                              {tc.status === 'error' && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-orange-200' : 'text-muted-foreground'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Claude is thinking...
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow-up question... (Enter to send)"
                  className="flex-1 px-3 py-2 text-sm border rounded bg-background resize-none"
                  rows={2}
                  disabled={isLoading}
                />
                <Button
                  size="sm"
                  onClick={() => sendMessage(userInput)}
                  disabled={isLoading || !userInput.trim()}
                  className="self-end bg-orange-600 hover:bg-orange-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </Button>
              </div>

              {/* Chat Error */}
              {chatError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400">{chatError}</p>
                </div>
              )}

              {/* Chat Actions */}
              <div className="flex gap-2 mt-3">
                {onAddNote && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddToNotes}
                    disabled={addingNote || noteAdded}
                    className="flex-1"
                  >
                    {noteAdded ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Added to Notes
                      </>
                    ) : addingNote ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Adding...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                        </svg>
                        Save to Notes
                      </>
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearChat}
                  className="text-muted-foreground"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Clear Chat
                </Button>
              </div>
            </div>
          )}
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
              const actionState = actionStates[step.id];
              const hasAction = !!step.action;

              return (
                <div
                  key={step.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    isCompleted
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : actionState?.status === 'success'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                      : actionState?.status === 'error'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                      : 'bg-background border-border'
                  }`}
                >
                  {/* Step Header */}
                  <div className="flex items-start justify-between gap-3">
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
                        {isCompleted && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${isCompleted ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                        {step.description}
                      </p>
                    </div>

                    {/* Action Button or Checkbox */}
                    {hasAction && step.action ? (
                      <div className="flex-shrink-0">
                        {actionState?.status === 'confirming' ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => executeAction(step.id, step.action!)}
                              disabled={isDisabled}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelConfirmation(step.id)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : actionState?.status === 'executing' ? (
                          <Button size="sm" disabled className="min-w-[100px]">
                            <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Running...
                          </Button>
                        ) : actionState?.status === 'success' ? (
                          <Button size="sm" variant="outline" disabled className="min-w-[100px] text-green-600 border-green-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Done
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant={isCompleted ? "outline" : "default"}
                            onClick={() => executeAction(step.id, step.action!)}
                            disabled={isDisabled}
                            className={`min-w-[100px] ${!isCompleted ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            {step.action.label}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                          isCompleted
                            ? 'bg-green-500 border-green-500'
                            : 'border-muted-foreground/30 hover:border-muted-foreground/50'
                        } ${isDisabled ? 'cursor-not-allowed' : ''}`}
                        onClick={() => !isDisabled && toggleStep(step.id)}
                      >
                        {isCompleted && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Confirmation Message */}
                  {actionState?.status === 'confirming' && (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-sm text-amber-800 dark:text-amber-200">
                      {actionState.message}
                    </div>
                  )}

                  {/* Success Message */}
                  {actionState?.status === 'success' && actionState.message && (
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/30 rounded text-sm text-green-800 dark:text-green-200">
                      {actionState.message}
                    </div>
                  )}

                  {/* Error Message */}
                  {actionState?.status === 'error' && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 rounded text-sm text-red-800 dark:text-red-200">
                      {actionState.message}
                    </div>
                  )}

                  {/* Estimated time */}
                  {step.estimatedMinutes && !isCompleted && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      ~{step.estimatedMinutes} min
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* External Link */}
          {runbook.externalUrl && (
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => runbook.externalUrl && window.open(runbook.externalUrl, '_blank')}
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
