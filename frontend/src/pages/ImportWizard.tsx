import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { importAPI } from '../lib/api-client';
import type { ImportPreviewResult, ImportResult } from '../lib/api-client';

type SourcePlatform = 'pagerduty' | 'opsgenie';

interface WizardState {
  source: SourcePlatform | null;
  rawData: string;
  parsedData: any;
  preview: ImportPreviewResult | null;
}

const INITIAL_STATE: WizardState = {
  source: null,
  rawData: '',
  parsedData: null,
  preview: null,
};

export function ImportWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const totalSteps = 4;
  const progressPercentage = (step / totalSteps) * 100;

  const goNext = () => setStep(s => Math.min(s + 1, totalSteps + 1));
  const goBack = () => setStep(s => Math.max(s - 1, 1));

  const updateState = (updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Parse the JSON data
  const parseData = () => {
    setError(null);
    try {
      const parsed = JSON.parse(state.rawData);
      updateState({ parsedData: parsed });
      return true;
    } catch {
      setError('Invalid JSON format. Please check your data and try again.');
      return false;
    }
  };

  // Preview the import
  const previewImport = async () => {
    if (!state.source || !parseData()) return;

    setIsLoading(true);
    setError(null);

    try {
      const preview = await importAPI.preview(state.source, state.parsedData);
      updateState({ preview });
      goNext();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to preview import');
    } finally {
      setIsLoading(false);
    }
  };

  // Execute the import
  const executeImport = async () => {
    if (!state.source || !state.parsedData) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = state.source === 'pagerduty'
        ? await importAPI.importPagerDuty(state.parsedData)
        : await importAPI.importOpsgenie(state.parsedData);

      setImportResult(result);
      goNext();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Select source platform
  const renderSourceStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">1</span>
          Select Source Platform
        </CardTitle>
        <CardDescription>
          Choose the platform you want to migrate from. We'll import your teams, schedules, escalation policies, and services.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => updateState({ source: 'pagerduty' })}
            className={`p-6 rounded-lg border-2 text-left transition-all ${
              state.source === 'pagerduty'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="text-3xl mb-2">📟</div>
            <div className="font-semibold text-lg">PagerDuty</div>
            <div className="text-sm text-gray-600 mt-1">
              Import from PagerDuty REST API exports
            </div>
          </button>

          <button
            onClick={() => updateState({ source: 'opsgenie' })}
            className={`p-6 rounded-lg border-2 text-left transition-all ${
              state.source === 'opsgenie'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="text-3xl mb-2">🔔</div>
            <div className="font-semibold text-lg">Opsgenie</div>
            <div className="text-sm text-gray-600 mt-1">
              Import from Opsgenie REST API exports
            </div>
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">What will be imported:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>- Users (matched by email or created)</li>
            <li>- Teams with memberships</li>
            <li>- Schedules with rotation layers</li>
            <li>- Escalation policies with steps</li>
            <li>- Services with configurations</li>
          </ul>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={goNext} disabled={!state.source}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Step 2: Paste export data
  const renderDataStep = () => (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">2</span>
          Paste Export Data
        </CardTitle>
        <CardDescription>
          {state.source === 'pagerduty' ? (
            <>
              Export your data from PagerDuty using their REST API, then paste the JSON below.
              You can use their <a href="https://developer.pagerduty.com/api-reference" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">API Explorer</a> to fetch data.
            </>
          ) : (
            <>
              Export your data from Opsgenie using their REST API, then paste the JSON below.
              You can use their <a href="https://docs.opsgenie.com/docs/api-overview" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">API Documentation</a> as a guide.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gray-50 border rounded-lg p-4">
          <h4 className="font-medium mb-2">Expected JSON format:</h4>
          {state.source === 'pagerduty' ? (
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
{`{
  "users": [{ "id": "P...", "email": "...", "name": "..." }],
  "teams": [{ "id": "P...", "name": "...", "members": [...] }],
  "schedules": [{ "id": "P...", "name": "...", "schedule_layers": [...] }],
  "escalation_policies": [{ "id": "P...", "name": "...", "escalation_rules": [...] }],
  "services": [{ "id": "P...", "name": "...", "description": "..." }]
}`}
            </pre>
          ) : (
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
{`{
  "users": [{ "id": "...", "username": "...", "fullName": "..." }],
  "teams": [{ "id": "...", "name": "...", "members": [...] }],
  "schedules": [{ "id": "...", "name": "...", "rotations": [...] }],
  "escalation": [{ "id": "...", "name": "...", "rules": [...] }],
  "integrations": [{ "id": "...", "name": "...", "type": "..." }]
}`}
            </pre>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Export Data (JSON)</label>
          <textarea
            value={state.rawData}
            onChange={(e) => updateState({ rawData: e.target.value })}
            placeholder="Paste your JSON export data here..."
            className="w-full h-64 px-3 py-2 border rounded-md text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={goBack}>Back</Button>
          <Button onClick={previewImport} disabled={!state.rawData.trim() || isLoading}>
            {isLoading ? 'Analyzing...' : 'Preview Import'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Step 3: Preview import
  const renderPreviewStep = () => {
    const preview = state.preview;
    if (!preview) return null;

    const { estimatedChanges } = preview;
    const totalChanges =
      estimatedChanges.usersToCreate +
      estimatedChanges.teamsToCreate +
      estimatedChanges.schedulesToCreate +
      estimatedChanges.policiesToCreate +
      estimatedChanges.servicesToCreate;

    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">3</span>
            Review Import
          </CardTitle>
          <CardDescription>
            Review what will be imported. Make sure everything looks correct before proceeding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700">
                {estimatedChanges.usersToCreate}
              </div>
              <div className="text-xs text-blue-600">New Users</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-700">
                {estimatedChanges.teamsToCreate}
              </div>
              <div className="text-xs text-purple-600">Teams</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-700">
                {estimatedChanges.schedulesToCreate}
              </div>
              <div className="text-xs text-green-600">Schedules</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-700">
                {estimatedChanges.policiesToCreate}
              </div>
              <div className="text-xs text-orange-600">Policies</div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-indigo-700">
                {estimatedChanges.servicesToCreate}
              </div>
              <div className="text-xs text-indigo-600">Services</div>
            </div>
          </div>

          {/* Matched users info */}
          {estimatedChanges.usersToMatch > 0 && (
            <div className="bg-gray-50 border rounded-lg p-4">
              <div className="text-sm text-gray-600">
                {estimatedChanges.usersToMatch} existing user(s) will be matched by email address.
              </div>
            </div>
          )}

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Warnings:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {preview.warnings.map((warning, i) => (
                  <li key={i}>- {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Detail sections */}
          <div className="space-y-4">
            {/* Users */}
            {preview.preview.users.length > 0 && (
              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium bg-gray-50 hover:bg-gray-100">
                  Users ({preview.preview.users.length})
                </summary>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                  {preview.preview.users.map((user, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{user.name}</span>
                        <span className="text-gray-500 ml-2">{user.email}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        user.action === 'create' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.action === 'create' ? 'New' : 'Match'}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Teams */}
            {preview.preview.teams.length > 0 && (
              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium bg-gray-50 hover:bg-gray-100">
                  Teams ({preview.preview.teams.length})
                </summary>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                  {preview.preview.teams.map((team, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                      <span className="font-medium">{team.name}</span>
                      <span className="text-gray-500">{team.memberCount} members</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Schedules */}
            {preview.preview.schedules.length > 0 && (
              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium bg-gray-50 hover:bg-gray-100">
                  Schedules ({preview.preview.schedules.length})
                </summary>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                  {preview.preview.schedules.map((schedule, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                      <span className="font-medium">{schedule.name}</span>
                      <span className="text-gray-500">{schedule.layerCount} layers</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Escalation Policies */}
            {preview.preview.escalationPolicies.length > 0 && (
              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium bg-gray-50 hover:bg-gray-100">
                  Escalation Policies ({preview.preview.escalationPolicies.length})
                </summary>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                  {preview.preview.escalationPolicies.map((policy, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                      <span className="font-medium">{policy.name}</span>
                      <span className="text-gray-500">{policy.stepCount} steps</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Services */}
            {preview.preview.services.length > 0 && (
              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium bg-gray-50 hover:bg-gray-100">
                  Services ({preview.preview.services.length})
                </summary>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                  {preview.preview.services.map((service, i) => (
                    <div key={i} className="text-sm p-2 bg-gray-50 rounded">
                      <div className="font-medium">{service.name}</div>
                      {service.description && (
                        <div className="text-gray-500 text-xs mt-1">{service.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={goBack} disabled={isLoading}>Back</Button>
            <Button onClick={executeImport} disabled={isLoading || totalChanges === 0}>
              {isLoading ? 'Importing...' : `Import ${totalChanges} Items`}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Step 4: Success
  const renderSuccessStep = () => {
    if (!importResult) return null;

    return (
      <Card className="max-w-2xl mx-auto text-center">
        <CardContent className="py-12 space-y-6">
          <div className="text-6xl">{importResult.success ? '🎉' : '⚠️'}</div>
          <h2 className="text-2xl font-bold">
            {importResult.success ? 'Import Complete!' : 'Import Completed with Issues'}
          </h2>
          <p className="text-gray-600">
            {importResult.message}
          </p>

          {/* Import summary */}
          <div className="grid grid-cols-5 gap-2 text-center max-w-lg mx-auto">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-xl font-bold text-blue-700">{importResult.imported.users}</div>
              <div className="text-xs text-blue-600">Users</div>
            </div>
            <div className="bg-purple-50 p-3 rounded">
              <div className="text-xl font-bold text-purple-700">{importResult.imported.teams}</div>
              <div className="text-xs text-purple-600">Teams</div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-xl font-bold text-green-700">{importResult.imported.schedules}</div>
              <div className="text-xs text-green-600">Schedules</div>
            </div>
            <div className="bg-orange-50 p-3 rounded">
              <div className="text-xl font-bold text-orange-700">{importResult.imported.escalationPolicies}</div>
              <div className="text-xs text-orange-600">Policies</div>
            </div>
            <div className="bg-indigo-50 p-3 rounded">
              <div className="text-xl font-bold text-indigo-700">{importResult.imported.services}</div>
              <div className="text-xs text-indigo-600">Services</div>
            </div>
          </div>

          {/* Errors */}
          {importResult.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
              <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {importResult.errors.map((err, i) => (
                  <li key={i}>- {err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {importResult.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
              <h4 className="font-medium text-yellow-800 mb-2">Warnings:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {importResult.warnings.map((warning, i) => (
                  <li key={i}>- {warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-6 space-y-3">
            <Button className="w-full max-w-xs" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
            <Button variant="outline" className="w-full max-w-xs" onClick={() => navigate('/services')}>
              View Services
            </Button>
            <Button variant="outline" className="w-full max-w-xs" onClick={() => navigate('/people/teams')}>
              View Teams
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 1:
        return renderSourceStep();
      case 2:
        return renderDataStep();
      case 3:
        return renderPreviewStep();
      case 4:
        return renderSuccessStep();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Import from {state.source === 'pagerduty' ? 'PagerDuty' : state.source === 'opsgenie' ? 'Opsgenie' : 'Another Platform'}
          </h1>
          <p className="text-gray-600">
            {step <= totalSteps - 1 ? `Step ${step} of ${totalSteps - 1}` : 'Import complete!'}
          </p>
        </div>

        {/* Progress bar */}
        {step < totalSteps && (
          <div className="w-full max-w-md mx-auto mb-8">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Step content */}
        {renderStep()}

        {/* Cancel link */}
        {step < totalSteps && (
          <div className="text-center mt-6">
            <button
              onClick={() => navigate('/integrations')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel and go back to Integrations
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
