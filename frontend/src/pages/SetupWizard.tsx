import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  SERVICE_TEMPLATES,
  AVAILABLE_ACTIONS,
  type ServiceTemplate,
  buildRunbookSteps,
} from '../data/service-templates';
import { setupAPI } from '../lib/api-client';

// Wizard state types
interface SelectedService {
  templateId: string;
  customName: string;
  selectedActionIds: string[];
}

interface WizardState {
  aiApiKey: string;
  skipAI: boolean;
  services: SelectedService[];
  teamEmails: string;
  createRotation: boolean;
}

const INITIAL_STATE: WizardState = {
  aiApiKey: '',
  skipAI: false,
  services: [],
  teamEmails: '',
  createRotation: true,
};

// Load wizard progress from localStorage
function loadWizardProgress(): { step: number; state: WizardState } {
  try {
    const saved = localStorage.getItem('setupWizardProgress');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return { step: 1, state: INITIAL_STATE };
}

// Save wizard progress to localStorage
function saveWizardProgress(step: number, state: WizardState) {
  localStorage.setItem('setupWizardProgress', JSON.stringify({ step, state }));
}

// Clear wizard progress
function clearWizardProgress() {
  localStorage.removeItem('setupWizardProgress');
}

export function SetupWizard() {
  const navigate = useNavigate();
  const savedProgress = loadWizardProgress();
  const [step, setStep] = useState(savedProgress.step);
  const [state, setState] = useState<WizardState>(savedProgress.state);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentServiceIndex, setCurrentServiceIndex] = useState(0);

  // Auto-save progress
  useEffect(() => {
    saveWizardProgress(step, state);
  }, [step, state]);

  const totalSteps = 5;
  const progressPercentage = (step / totalSteps) * 100;

  const goNext = () => setStep(s => Math.min(s + 1, totalSteps + 1));
  const goBack = () => setStep(s => Math.max(s - 1, 1));

  const updateState = (updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Add a service from template
  const addService = (template: ServiceTemplate) => {
    const newService: SelectedService = {
      templateId: template.id,
      customName: template.name,
      selectedActionIds: template.defaultActions.map(a => a.id),
    };
    updateState({ services: [...state.services, newService] });
  };

  // Remove a service
  const removeService = (index: number) => {
    const updated = [...state.services];
    updated.splice(index, 1);
    updateState({ services: updated });
  };

  // Update service name
  const updateServiceName = (index: number, name: string) => {
    const updated = [...state.services];
    updated[index] = { ...updated[index], customName: name };
    updateState({ services: updated });
  };

  // Toggle action for a service
  const toggleAction = (serviceIndex: number, actionId: string) => {
    const updated = [...state.services];
    const service = { ...updated[serviceIndex] };
    if (service.selectedActionIds.includes(actionId)) {
      service.selectedActionIds = service.selectedActionIds.filter(id => id !== actionId);
    } else {
      service.selectedActionIds = [...service.selectedActionIds, actionId];
    }
    updated[serviceIndex] = service;
    updateState({ services: updated });
  };

  // Complete setup
  const completeSetup = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Build the request payload
      const services = state.services.map(s => {
        const template = SERVICE_TEMPLATES.find(t => t.id === s.templateId)!;
        const selectedActions = s.selectedActionIds
          .map(id => AVAILABLE_ACTIONS.find(a => a.id === id)!)
          .filter(Boolean);

        return {
          templateId: s.templateId,
          name: s.customName,
          description: template.description,
          runbook: {
            title: `${s.customName} Incident Response`,
            description: `Quick actions for ${s.customName}`,
            steps: buildRunbookSteps(selectedActions),
          },
        };
      });

      const teamEmails = state.teamEmails
        .split('\n')
        .map(e => e.trim())
        .filter(e => e.length > 0 && e.includes('@'));

      await setupAPI.complete({
        aiApiKey: state.skipAI ? undefined : state.aiApiKey || undefined,
        services,
        teamEmails,
        createRotation: state.createRotation,
      });

      // Clear progress and go to success step
      clearWizardProgress();
      goNext();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Setup failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: AI Setup
  const renderAISetupStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">1</span>
          Enable AI-Powered Incident Response
        </CardTitle>
        <CardDescription>
          OnCallShift uses Claude AI to automatically analyze incidents, suggest root causes, and draft post-incident reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">What AI can do for you:</h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>- Automatically analyze incidents when they occur</li>
            <li>- Suggest likely root causes based on symptoms</li>
            <li>- Find similar past incidents to speed up resolution</li>
            <li>- Draft post-incident reports (RCA)</li>
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">Anthropic API Key</Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="sk-ant-api03-..."
            value={state.aiApiKey}
            onChange={(e) => updateState({ aiApiKey: e.target.value, skipAI: false })}
            disabled={state.skipAI}
          />
          <p className="text-xs text-muted-foreground">
            Don't have one?{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Get API Key
            </a>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="skipAI"
            checked={state.skipAI}
            onChange={(e) => updateState({ skipAI: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="skipAI" className="text-sm text-muted-foreground cursor-pointer">
            Skip for now (AI features will be disabled)
          </Label>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={goNext} disabled={!state.aiApiKey && !state.skipAI}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Step 2: Select Services
  const renderServicesStep = () => (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">2</span>
          What services do you need to monitor?
        </CardTitle>
        <CardDescription>
          Select from templates or add custom services. Each service will get its own runbook with quick actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template grid */}
        <div>
          <h4 className="text-sm font-medium mb-3">Popular Templates</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SERVICE_TEMPLATES.map((template) => {
              const isAdded = state.services.some(s => s.templateId === template.id);
              return (
                <button
                  key={template.id}
                  onClick={() => !isAdded && addService(template)}
                  disabled={isAdded}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    isAdded
                      ? 'bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700'
                      : 'hover:border-primary hover:bg-accent'
                  }`}
                >
                  <div className="text-2xl mb-1">{template.icon}</div>
                  <div className="font-medium text-sm">{template.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{template.description}</div>
                  {isAdded && (
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">Added</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected services */}
        {state.services.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Your Services ({state.services.length})</h4>
            <div className="space-y-2">
              {state.services.map((service, index) => {
                const template = SERVICE_TEMPLATES.find(t => t.id === service.templateId);
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-background"
                  >
                    <span className="text-xl">{template?.icon}</span>
                    <Input
                      value={service.customName}
                      onChange={(e) => updateServiceName(index, e.target.value)}
                      className="flex-1"
                      placeholder="Service name"
                    />
                    <span className="text-xs text-muted-foreground">
                      {service.selectedActionIds.length} actions
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeService(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {state.services.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Click on a template above to add your first service</p>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={goBack}>Back</Button>
          <Button onClick={goNext} disabled={state.services.length === 0}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Step 3: Configure Actions
  const renderActionsStep = () => {
    const service = state.services[currentServiceIndex];
    const template = service ? SERVICE_TEMPLATES.find(t => t.id === service.templateId) : null;

    if (!service || !template) {
      return (
        <Card className="max-w-3xl mx-auto">
          <CardContent className="py-8 text-center">
            <p>No services selected. Go back and add services.</p>
            <Button variant="outline" onClick={goBack} className="mt-4">Back</Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">3</span>
            Quick Actions for "{service.customName}"
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({currentServiceIndex + 1} of {state.services.length})
            </span>
          </CardTitle>
          <CardDescription>
            Select the actions that can help fix issues with this service. These will appear as one-click buttons during incidents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3">
            {AVAILABLE_ACTIONS.map((action) => {
              const isSelected = service.selectedActionIds.includes(action.id);
              return (
                <button
                  key={action.id}
                  onClick={() => toggleAction(currentServiceIndex, action.id)}
                  className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="mt-1"
                  />
                  <span className="text-xl">{action.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{action.label}</div>
                    <div className="text-sm text-muted-foreground">{action.description}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Est. time: ~{action.estimatedMinutes} min
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between pt-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={goBack}>Back</Button>
              {currentServiceIndex > 0 && (
                <Button variant="outline" onClick={() => setCurrentServiceIndex(i => i - 1)}>
                  Previous Service
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {currentServiceIndex < state.services.length - 1 ? (
                <Button onClick={() => setCurrentServiceIndex(i => i + 1)}>
                  Next Service
                </Button>
              ) : (
                <Button onClick={goNext} disabled={service.selectedActionIds.length === 0}>
                  Continue
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Step 4: Invite Team
  const renderTeamStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">4</span>
          Invite your team
        </CardTitle>
        <CardDescription>
          Who should respond to incidents? Add their email addresses below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="teamEmails">Email addresses (one per line)</Label>
          <textarea
            id="teamEmails"
            value={state.teamEmails}
            onChange={(e) => updateState({ teamEmails: e.target.value })}
            placeholder="alice@company.com&#10;bob@company.com&#10;charlie@company.com"
            className="w-full h-32 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            They'll receive an email invitation to join your team.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="createRotation"
            checked={state.createRotation}
            onChange={(e) => updateState({ createRotation: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="createRotation" className="cursor-pointer">
            <span className="font-medium">Set up a simple on-call rotation</span>
            <span className="text-sm text-muted-foreground block">
              Each person is on-call for 1 week, rotating through the team
            </span>
          </Label>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={goBack}>Back</Button>
          <Button onClick={goNext}>
            {state.teamEmails.trim() ? 'Continue' : 'Skip for now'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Step 5: Review & Complete
  const renderReviewStep = () => {
    const emailCount = state.teamEmails
      .split('\n')
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@')).length;

    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">5</span>
            Review & Complete Setup
          </CardTitle>
          <CardDescription>
            Here's what we'll create for you:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <span className="text-xl">{state.skipAI ? '❌' : '✅'}</span>
              <div>
                <div className="font-medium">AI Analysis</div>
                <div className="text-sm text-muted-foreground">
                  {state.skipAI ? 'Disabled (can enable later in settings)' : 'Enabled with your API key'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <span className="text-xl">🛠️</span>
              <div>
                <div className="font-medium">{state.services.length} Services</div>
                <div className="text-sm text-muted-foreground">
                  {state.services.map(s => s.customName).join(', ')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <span className="text-xl">📋</span>
              <div>
                <div className="font-medium">{state.services.length} Runbooks</div>
                <div className="text-sm text-muted-foreground">
                  Each service gets a runbook with quick actions
                </div>
              </div>
            </div>

            {emailCount > 0 && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <span className="text-xl">👥</span>
                <div>
                  <div className="font-medium">{emailCount} Team Members</div>
                  <div className="text-sm text-muted-foreground">
                    {state.createRotation ? 'With weekly on-call rotation' : 'Invitations will be sent'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={goBack} disabled={isSubmitting}>
              Back
            </Button>
            <Button onClick={completeSetup} disabled={isSubmitting}>
              {isSubmitting ? 'Setting up...' : 'Complete Setup'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Step 6: Success
  const renderSuccessStep = () => (
    <Card className="max-w-2xl mx-auto text-center">
      <CardContent className="py-12 space-y-6">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold">You're all set!</h2>
        <p className="text-muted-foreground">
          OnCallShift is ready to help you resolve incidents faster with AI-powered analysis and one-click actions.
        </p>

        <div className="grid gap-3 text-left max-w-md mx-auto">
          <div className="flex items-center gap-2 text-green-600">
            <span>✓</span>
            <span>{state.services.length} services created with quick actions</span>
          </div>
          {!state.skipAI && (
            <div className="flex items-center gap-2 text-green-600">
              <span>✓</span>
              <span>AI-powered incident analysis enabled</span>
            </div>
          )}
          {state.teamEmails.trim() && (
            <div className="flex items-center gap-2 text-green-600">
              <span>✓</span>
              <span>Team invitations sent</span>
            </div>
          )}
        </div>

        <div className="pt-6 space-y-3">
          <Button className="w-full max-w-xs" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
          <Button variant="outline" className="w-full max-w-xs" onClick={() => navigate('/admin/services')}>
            View Services
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 1:
        return renderAISetupStep();
      case 2:
        return renderServicesStep();
      case 3:
        return renderActionsStep();
      case 4:
        return renderTeamStep();
      case 5:
        return renderReviewStep();
      case 6:
        return renderSuccessStep();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Let's set up OnCallShift
          </h1>
          <p className="text-muted-foreground">
            {step <= totalSteps ? `Step ${step} of ${totalSteps}` : 'Setup complete!'}
          </p>
        </div>

        {/* Progress bar */}
        {step <= totalSteps && (
          <div className="w-full max-w-md mx-auto mb-8">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Step content */}
        {renderStep()}

        {/* Skip setup link */}
        {step <= totalSteps && (
          <div className="text-center mt-6">
            <button
              onClick={() => {
                clearWizardProgress();
                navigate('/dashboard');
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Skip setup and go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
