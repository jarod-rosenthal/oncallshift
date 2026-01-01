import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { importAPI } from '../lib/api-client';
import type { ImportPreviewResult, ImportResult, PagerDutyFetchOptions, OpsgenieFetchOptions } from '../lib/api-client';

type SourcePlatform = 'pagerduty' | 'opsgenie';
type InputMethod = 'api' | 'json';

interface EntitySelection {
  users: boolean;
  teams: boolean;
  schedules: boolean;
  escalationPolicies: boolean;
  services: boolean;
  maintenanceWindows: boolean;
  routingRules: boolean;
  heartbeats: boolean; // Opsgenie only
}

interface WizardState {
  source: SourcePlatform | null;
  method: InputMethod | null;
  apiKey: string;
  region: 'us' | 'eu';
  rawData: string;
  parsedData: any;
  preview: ImportPreviewResult | null;
  preserveKeys: boolean;
  entities: EntitySelection;
}

const INITIAL_STATE: WizardState = {
  source: null,
  method: null,
  apiKey: '',
  region: 'us',
  rawData: '',
  parsedData: null,
  preview: null,
  preserveKeys: true,
  entities: {
    users: true,
    teams: true,
    schedules: true,
    escalationPolicies: true,
    services: true,
    maintenanceWindows: true,
    routingRules: false,
    heartbeats: true,
  },
};

export function ImportWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const totalSteps = state.method === 'api' ? 6 : 4;

  const goNext = () => setStep(s => Math.min(s + 1, totalSteps + 1));
  const goBack = () => setStep(s => Math.max(s - 1, 1));

  const updateState = (updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Test API connection
  const testConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('idle');
    setConnectionError('');

    try {
      const result = state.source === 'pagerduty'
        ? await importAPI.testPagerDuty(state.apiKey)
        : await importAPI.testOpsgenie(state.apiKey, state.region);

      if (result.success) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
        setConnectionError(result.error || 'Connection failed');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionError(err.response?.data?.error || err.message || 'Connection failed');
    } finally {
      setIsTesting(false);
    }
  };

  // Fetch data from source platform
  const fetchData = async () => {
    setIsFetching(true);
    setFetchProgress('Connecting to API...');
    setError(null);

    try {
      let result;
      if (state.source === 'pagerduty') {
        setFetchProgress('Fetching data from PagerDuty...');
        const options: PagerDutyFetchOptions = {
          apiKey: state.apiKey,
          includeUsers: state.entities.users,
          includeTeams: state.entities.teams,
          includeSchedules: state.entities.schedules,
          includeEscalationPolicies: state.entities.escalationPolicies,
          includeServices: state.entities.services,
          includeMaintenanceWindows: state.entities.maintenanceWindows,
          includeRoutingRules: state.entities.routingRules,
        };
        result = await importAPI.fetchPagerDuty(options);
      } else {
        setFetchProgress('Fetching data from Opsgenie...');
        const options: OpsgenieFetchOptions = {
          apiKey: state.apiKey,
          region: state.region,
          includeUsers: state.entities.users,
          includeTeams: state.entities.teams,
          includeSchedules: state.entities.schedules,
          includeEscalations: state.entities.escalationPolicies,
          includeServices: state.entities.services,
          includeHeartbeats: state.entities.heartbeats,
          includeMaintenanceWindows: state.entities.maintenanceWindows,
        };
        result = await importAPI.fetchOpsgenie(options);
      }

      if (result.success && result.data) {
        setFetchProgress('Analyzing data...');
        updateState({ parsedData: result.data });

        // Preview the import
        const preview = await importAPI.preview(state.source!, result.data);
        updateState({ preview });
        goNext();
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch data');
    } finally {
      setIsFetching(false);
      setFetchProgress('');
    }
  };

  // Parse the JSON data (for manual input)
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

  // Preview the import (for manual JSON input)
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
      const options = { preserveKeys: state.preserveKeys };
      const result = state.source === 'pagerduty'
        ? await importAPI.importPagerDuty(state.parsedData, options)
        : await importAPI.importOpsgenie(state.parsedData, options);

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
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-sm font-bold">1</span>
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
                : 'border-border hover:border-border hover:bg-muted'
            }`}
          >
            <div className="text-3xl mb-2">📟</div>
            <div className="font-semibold text-lg">PagerDuty</div>
            <div className="text-sm text-muted-foreground mt-1">
              Import from PagerDuty using API key
            </div>
          </button>

          <button
            onClick={() => updateState({ source: 'opsgenie' })}
            className={`p-6 rounded-lg border-2 text-left transition-all ${
              state.source === 'opsgenie'
                ? 'border-blue-500 bg-blue-50'
                : 'border-border hover:border-border hover:bg-muted'
            }`}
          >
            <div className="text-3xl mb-2">🔔</div>
            <div className="font-semibold text-lg">Opsgenie</div>
            <div className="text-sm text-muted-foreground mt-1">
              Import from Opsgenie using API key
            </div>
          </button>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={goNext} disabled={!state.source}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Step 2: Choose input method
  const renderMethodStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-sm font-bold">2</span>
          Choose Import Method
        </CardTitle>
        <CardDescription>
          How would you like to import your {state.source === 'pagerduty' ? 'PagerDuty' : 'Opsgenie'} data?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => updateState({ method: 'api' })}
            className={`p-6 rounded-lg border-2 text-left transition-all ${
              state.method === 'api'
                ? 'border-blue-500 bg-blue-50'
                : 'border-border hover:border-border hover:bg-muted'
            }`}
          >
            <div className="text-3xl mb-2">🔑</div>
            <div className="font-semibold text-lg">API Key (Recommended)</div>
            <div className="text-sm text-muted-foreground mt-1">
              Enter your API key and we'll fetch your data automatically
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">Automatic</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">Zero-config</span>
            </div>
          </button>

          <button
            onClick={() => updateState({ method: 'json' })}
            className={`p-6 rounded-lg border-2 text-left transition-all ${
              state.method === 'json'
                ? 'border-blue-500 bg-blue-50'
                : 'border-border hover:border-border hover:bg-muted'
            }`}
          >
            <div className="text-3xl mb-2">📋</div>
            <div className="font-semibold text-lg">Paste JSON</div>
            <div className="text-sm text-muted-foreground mt-1">
              Manually export data and paste the JSON here
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              <span className="px-2 py-0.5 bg-muted text-foreground text-xs rounded">Manual</span>
            </div>
          </button>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={goBack}>Back</Button>
          <Button onClick={goNext} disabled={!state.method}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Step 3a: API Key input (for API method)
  const renderApiKeyStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-sm font-bold">3</span>
          Connect to {state.source === 'pagerduty' ? 'PagerDuty' : 'Opsgenie'}
        </CardTitle>
        <CardDescription>
          Enter your API key to connect. We'll fetch your data securely.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">API Key</label>
            <input
              type="password"
              value={state.apiKey}
              onChange={(e) => {
                updateState({ apiKey: e.target.value });
                setConnectionStatus('idle');
              }}
              placeholder={state.source === 'pagerduty' ? 'Enter your PagerDuty API key' : 'Enter your Opsgenie API key'}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-muted-foreground">
              {state.source === 'pagerduty' ? (
                <>Get your API key from PagerDuty → User Icon → My Profile → User Settings → API Access</>
              ) : (
                <>Get your API key from Opsgenie → Settings → API key management</>
              )}
            </p>
          </div>

          {state.source === 'opsgenie' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Region</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={state.region === 'us'}
                    onChange={() => updateState({ region: 'us' })}
                    className="text-blue-600"
                  />
                  <span>US (api.opsgenie.com)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={state.region === 'eu'}
                    onChange={() => updateState({ region: 'eu' })}
                    className="text-blue-600"
                  />
                  <span>EU (api.eu.opsgenie.com)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Connection test result */}
        {connectionStatus === 'success' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 flex items-center gap-2">
            <span className="text-xl">✓</span>
            <span>Connection successful! Ready to fetch data.</span>
          </div>
        )}
        {connectionStatus === 'error' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <strong>Connection failed:</strong> {connectionError}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={goBack}>Back</Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={!state.apiKey.trim() || isTesting}
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              onClick={goNext}
              disabled={connectionStatus !== 'success'}
            >
              Continue
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Step 4a: Entity selection (for API method)
  const renderEntitySelectionStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-sm font-bold">4</span>
          Select What to Import
        </CardTitle>
        <CardDescription>
          Choose which entities you want to import from {state.source === 'pagerduty' ? 'PagerDuty' : 'Opsgenie'}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { key: 'users', label: 'Users', desc: 'User accounts and contact methods' },
            { key: 'teams', label: 'Teams', desc: 'Team memberships' },
            { key: 'schedules', label: 'Schedules', desc: 'On-call schedules and rotations' },
            { key: 'escalationPolicies', label: 'Escalation Policies', desc: 'Escalation rules and steps' },
            { key: 'services', label: 'Services', desc: 'Service configurations' },
            { key: 'maintenanceWindows', label: 'Maintenance Windows', desc: 'Scheduled maintenance' },
            ...(state.source === 'pagerduty' ? [
              { key: 'routingRules', label: 'Routing Rules', desc: 'Event routing configuration' },
            ] : [
              { key: 'heartbeats', label: 'Heartbeats', desc: 'Dead man switches' },
            ]),
          ].map(({ key, label, desc }) => (
            <label
              key={key}
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                state.entities[key as keyof EntitySelection]
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-border hover:border-border'
              }`}
            >
              <input
                type="checkbox"
                checked={state.entities[key as keyof EntitySelection]}
                onChange={(e) => updateState({
                  entities: { ...state.entities, [key]: e.target.checked }
                })}
                className="mt-1 text-blue-600"
              />
              <div>
                <div className="font-medium">{label}</div>
                <div className="text-sm text-muted-foreground">{desc}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.preserveKeys}
              onChange={(e) => updateState({ preserveKeys: e.target.checked })}
              className="mt-1 text-blue-600"
            />
            <div>
              <div className="font-medium text-blue-900">Preserve Integration Keys (Recommended)</div>
              <div className="text-sm text-blue-700">
                Keep your existing webhook URLs working without reconfiguration
              </div>
            </div>
          </label>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={goBack} disabled={isFetching}>Back</Button>
          <Button onClick={fetchData} disabled={isFetching}>
            {isFetching ? fetchProgress || 'Fetching...' : 'Fetch & Preview'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Step 3b: Paste export data (for JSON method)
  const renderDataStep = () => (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-sm font-bold">3</span>
          Paste Export Data
        </CardTitle>
        <CardDescription>
          {state.source === 'pagerduty' ? (
            <>
              Export your data from PagerDuty using their REST API, then paste the JSON below.
            </>
          ) : (
            <>
              Export your data from Opsgenie using their REST API, then paste the JSON below.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Export Data (JSON)</label>
          <textarea
            value={state.rawData}
            onChange={(e) => updateState({ rawData: e.target.value })}
            placeholder="Paste your JSON export data here..."
            className="w-full h-64 px-3 py-2 border rounded-md text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.preserveKeys}
              onChange={(e) => updateState({ preserveKeys: e.target.checked })}
              className="mt-1 text-blue-600"
            />
            <div>
              <div className="font-medium text-blue-900">Preserve Integration Keys</div>
              <div className="text-sm text-blue-700">
                Keep your existing webhook URLs working without reconfiguration
              </div>
            </div>
          </label>
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

  // Preview step (shared between methods)
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
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-sm font-bold">
              {state.method === 'api' ? '5' : '4'}
            </span>
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
            <div className="bg-muted border rounded-lg p-4">
              <div className="text-sm text-muted-foreground">
                {estimatedChanges.usersToMatch} existing user(s) will be matched by email address.
              </div>
            </div>
          )}

          {/* Preserve keys info */}
          {state.preserveKeys && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-800 flex items-center gap-2">
                <span className="text-lg">🔗</span>
                <span>Integration keys will be preserved - your existing webhooks will continue working.</span>
              </div>
            </div>
          )}

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Warnings:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {preview.warnings.map((warning, i) => (
                  <li key={i}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Detail sections */}
          <div className="space-y-4">
            {preview.preview.users.length > 0 && (
              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium bg-muted hover:bg-muted">
                  Users ({preview.preview.users.length})
                </summary>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                  {preview.preview.users.map((user, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                      <div>
                        <span className="font-medium">{user.name}</span>
                        <span className="text-muted-foreground ml-2">{user.email}</span>
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

            {preview.preview.teams.length > 0 && (
              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium bg-muted hover:bg-muted">
                  Teams ({preview.preview.teams.length})
                </summary>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                  {preview.preview.teams.map((team, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                      <span className="font-medium">{team.name}</span>
                      <span className="text-muted-foreground">{team.memberCount} members</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {preview.preview.schedules.length > 0 && (
              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium bg-muted hover:bg-muted">
                  Schedules ({preview.preview.schedules.length})
                </summary>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                  {preview.preview.schedules.map((schedule, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                      <span className="font-medium">{schedule.name}</span>
                      <span className="text-muted-foreground">{schedule.layerCount} layers</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {preview.preview.escalationPolicies.length > 0 && (
              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium bg-muted hover:bg-muted">
                  Escalation Policies ({preview.preview.escalationPolicies.length})
                </summary>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                  {preview.preview.escalationPolicies.map((policy, i) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                      <span className="font-medium">{policy.name}</span>
                      <span className="text-muted-foreground">{policy.stepCount} steps</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {preview.preview.services.length > 0 && (
              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium bg-muted hover:bg-muted">
                  Services ({preview.preview.services.length})
                </summary>
                <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                  {preview.preview.services.map((service, i) => (
                    <div key={i} className="text-sm p-2 bg-muted rounded">
                      <div className="font-medium">{service.name}</div>
                      {service.description && (
                        <div className="text-muted-foreground text-xs mt-1">{service.description}</div>
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

  // Success step
  const renderSuccessStep = () => {
    if (!importResult) return null;

    return (
      <Card className="max-w-2xl mx-auto text-center">
        <CardContent className="py-12 space-y-6">
          <div className="text-6xl">{importResult.success ? '🎉' : '⚠️'}</div>
          <h2 className="text-2xl font-bold">
            {importResult.success ? 'Import Complete!' : 'Import Completed with Issues'}
          </h2>
          <p className="text-muted-foreground">
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
                  <li key={i}>• {err}</li>
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
                  <li key={i}>• {warning}</li>
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

  // Render current step based on method
  const renderStep = () => {
    if (state.method === 'api') {
      switch (step) {
        case 1: return renderSourceStep();
        case 2: return renderMethodStep();
        case 3: return renderApiKeyStep();
        case 4: return renderEntitySelectionStep();
        case 5: return renderPreviewStep();
        case 6: return renderSuccessStep();
        default: return null;
      }
    } else if (state.method === 'json') {
      switch (step) {
        case 1: return renderSourceStep();
        case 2: return renderMethodStep();
        case 3: return renderDataStep();
        case 4: return renderPreviewStep();
        case 5: return renderSuccessStep();
        default: return null;
      }
    } else {
      // Method not selected yet
      switch (step) {
        case 1: return renderSourceStep();
        case 2: return renderMethodStep();
        default: return null;
      }
    }
  };

  const getStepTitle = () => {
    if (!state.source) return 'Import from Another Platform';
    return `Import from ${state.source === 'pagerduty' ? 'PagerDuty' : 'Opsgenie'}`;
  };

  const getCurrentStepNumber = () => {
    const effectiveTotalSteps = state.method === 'api' ? 5 : state.method === 'json' ? 4 : 2;
    const effectiveStep = Math.min(step, effectiveTotalSteps);
    return { current: effectiveStep, total: effectiveTotalSteps };
  };

  const { current, total } = getCurrentStepNumber();
  const isComplete = (state.method === 'api' && step === 6) || (state.method === 'json' && step === 5);

  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{getStepTitle()}</h1>
          <p className="text-muted-foreground">
            {isComplete ? 'Import complete!' : `Step ${current} of ${total}`}
          </p>
        </div>

        {/* Progress bar */}
        {!isComplete && (
          <div className="w-full max-w-md mx-auto mb-8">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(current / total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Step content */}
        {renderStep()}

        {/* Cancel link */}
        {!isComplete && (
          <div className="text-center mt-6">
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel and go back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
