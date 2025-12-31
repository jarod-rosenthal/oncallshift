import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { integrationsAPI, servicesAPI, type Integration, type IntegrationEvent, type SlackChannel } from '../lib/api-client';
import type { Service } from '../types/api';

type IntegrationType = Integration['type'];

const INTEGRATION_TYPES: { type: IntegrationType; name: string; icon: string; description: string; available: boolean }[] = [
  { type: 'slack', name: 'Slack', icon: '#', description: 'Send incident notifications to Slack channels', available: true },
  { type: 'jira', name: 'Jira', icon: 'J', description: 'Create and sync Jira tickets for incidents', available: false },
  { type: 'teams', name: 'Microsoft Teams', icon: 'T', description: 'Send notifications to Teams channels', available: false },
  { type: 'webhook', name: 'Webhook', icon: 'W', description: 'Send incident data to custom webhooks', available: true },
  { type: 'servicenow', name: 'ServiceNow', icon: 'S', description: 'Create ServiceNow incidents', available: false },
  { type: 'pagerduty_import', name: 'PagerDuty Import', icon: 'P', description: 'Import services and schedules from PagerDuty', available: false },
];

export function Integrations() {
  const [searchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create form state
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(null);
  const [newIntegrationName, setNewIntegrationName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Detail view state
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [integrationEvents, setIntegrationEvents] = useState<IntegrationEvent[]>([]);
  const [linkedServices, setLinkedServices] = useState<{ id: string; name: string; status: string }[]>([]);
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Webhook form state
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    loadData();

    // Handle OAuth callback
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (code && state) {
      handleOAuthCallback(code, state);
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [integrationsRes, servicesRes] = await Promise.all([
        integrationsAPI.list(),
        servicesAPI.list(),
      ]);
      setIntegrations(integrationsRes.integrations);
      setServices(servicesRes.services);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load integrations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      const stateData = JSON.parse(atob(state));
      const integrationId = stateData.integrationId;
      const redirectUri = window.location.origin + '/integrations';

      setSuccess('Connecting to Slack...');
      await integrationsAPI.completeSlackOAuth(integrationId, code, redirectUri);
      setSuccess('Slack connected successfully!');

      // Clear URL params and reload
      window.history.replaceState({}, '', '/integrations');
      await loadData();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to connect Slack');
      window.history.replaceState({}, '', '/integrations');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;

    try {
      setIsCreating(true);
      setError(null);

      const config: Record<string, any> = {};
      if (selectedType === 'webhook' && webhookUrl) {
        config.events = ['incident.triggered', 'incident.acknowledged', 'incident.resolved'];
      }

      const result = await integrationsAPI.create({
        type: selectedType,
        name: newIntegrationName,
        config,
      });

      // For Slack, redirect to OAuth
      if (selectedType === 'slack') {
        const redirectUri = window.location.origin + '/integrations';
        const { oauthUrl } = await integrationsAPI.getSlackOAuthUrl(result.integration.id, redirectUri);
        window.location.href = oauthUrl;
        return;
      }

      // For webhook, update with URL
      if (selectedType === 'webhook' && webhookUrl) {
        await integrationsAPI.update(result.integration.id, {
          config: { webhook_url: webhookUrl },
          status: 'active',
        });
      }

      setSuccess('Integration created successfully');
      resetForm();
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create integration');
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setSelectedType(null);
    setNewIntegrationName('');
    setWebhookUrl('');
  };

  const handleSelectIntegration = async (integration: Integration) => {
    setSelectedIntegration(integration);
    setSelectedChannelId(integration.slackDefaultChannelId || '');

    try {
      // Load events and linked services
      const [eventsRes, servicesRes] = await Promise.all([
        integrationsAPI.getEvents(integration.id, 20),
        integrationsAPI.getLinkedServices(integration.id),
      ]);
      setIntegrationEvents(eventsRes.events);
      setLinkedServices(servicesRes.services);

      // For Slack, load channels
      if (integration.type === 'slack' && integration.status === 'active') {
        setIsLoadingChannels(true);
        try {
          const channelsRes = await integrationsAPI.listSlackChannels(integration.id);
          setSlackChannels(channelsRes.channels);
        } catch {
          setSlackChannels([]);
        } finally {
          setIsLoadingChannels(false);
        }
      }
    } catch (err: any) {
      console.error('Failed to load integration details:', err);
    }
  };

  const handleUpdateSlackChannel = async () => {
    if (!selectedIntegration || !selectedChannelId) return;

    try {
      await integrationsAPI.update(selectedIntegration.id, {
        config: { default_channel_id: selectedChannelId },
      });
      setSuccess('Default channel updated');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update channel');
    }
  };

  const handleTestSlack = async () => {
    if (!selectedIntegration || !selectedChannelId) return;

    try {
      setIsTesting(true);
      await integrationsAPI.testSlack(selectedIntegration.id, selectedChannelId);
      setSuccess('Test message sent to Slack!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send test message');
    } finally {
      setIsTesting(false);
    }
  };

  const handleLinkService = async (serviceId: string) => {
    if (!selectedIntegration) return;

    try {
      await integrationsAPI.linkService(selectedIntegration.id, serviceId);
      const servicesRes = await integrationsAPI.getLinkedServices(selectedIntegration.id);
      setLinkedServices(servicesRes.services);
      setSuccess('Service linked');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to link service');
    }
  };

  const handleUnlinkService = async (serviceId: string) => {
    if (!selectedIntegration) return;

    try {
      await integrationsAPI.unlinkService(selectedIntegration.id, serviceId);
      setLinkedServices(linkedServices.filter(s => s.id !== serviceId));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to unlink service');
    }
  };

  const handleDelete = async (integration: Integration) => {
    if (!confirm(`Delete "${integration.name}"? This cannot be undone.`)) return;

    try {
      await integrationsAPI.delete(integration.id);
      setIntegrations(integrations.filter(i => i.id !== integration.id));
      if (selectedIntegration?.id === integration.id) {
        setSelectedIntegration(null);
      }
      setSuccess('Integration deleted');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete integration');
    }
  };

  const handleReconnectSlack = async (integration: Integration) => {
    try {
      const redirectUri = window.location.origin + '/integrations';
      const { oauthUrl } = await integrationsAPI.getSlackOAuthUrl(integration.id, redirectUri);
      window.location.href = oauthUrl;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start OAuth flow');
    }
  };

  const getStatusBadge = (status: Integration['status']) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      disabled: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    );
  };

  const getEventStatusBadge = (status: IntegrationEvent['status']) => {
    const styles: Record<string, string> = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      retrying: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError(null)} className="float-right text-red-500 hover:text-red-700">x</button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
            <p className="mt-1 text-sm text-gray-500">Connect OnCallShift with your favorite tools</p>
          </div>
        </div>

        {/* Create Form - Always visible */}
        <Card className="mb-6">
            <CardHeader>
              <CardTitle>Add New Integration</CardTitle>
              <CardDescription>Select an integration type to get started</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedType ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {INTEGRATION_TYPES.map((type) => (
                    <button
                      key={type.type}
                      onClick={() => {
                        if (type.available) {
                          setSelectedType(type.type);
                          setNewIntegrationName(type.name);
                        }
                      }}
                      disabled={!type.available}
                      className={`p-4 border rounded-lg text-left transition-colors ${
                        type.available
                          ? 'hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
                          : 'opacity-50 cursor-not-allowed bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg font-bold">
                          {type.icon}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{type.name}</div>
                          <div className="text-xs text-gray-500">
                            {type.available ? type.description : 'Coming soon'}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Integration Name</Label>
                    <Input
                      id="name"
                      value={newIntegrationName}
                      onChange={(e) => setNewIntegrationName(e.target.value)}
                      placeholder={`My ${INTEGRATION_TYPES.find(t => t.type === selectedType)?.name}`}
                      required
                    />
                  </div>

                  {selectedType === 'webhook' && (
                    <div>
                      <Label htmlFor="webhookUrl">Webhook URL</Label>
                      <Input
                        id="webhookUrl"
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://example.com/webhook"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        We'll POST incident events to this URL
                      </p>
                    </div>
                  )}

                  {selectedType === 'slack' && (
                    <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                      After clicking "Create", you'll be redirected to Slack to authorize the connection.
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? 'Creating...' : selectedType === 'slack' ? 'Connect to Slack' : 'Create'}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Integrations List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Your Integrations</CardTitle>
              </CardHeader>
              <CardContent>
                {integrations.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No integrations configured yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {integrations.map((integration) => {
                      const typeInfo = INTEGRATION_TYPES.find(t => t.type === integration.type);
                      return (
                        <button
                          key={integration.id}
                          onClick={() => handleSelectIntegration(integration)}
                          className={`w-full p-3 border rounded-lg text-left transition-colors ${
                            selectedIntegration?.id === integration.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-sm font-bold">
                                {typeInfo?.icon || '?'}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 text-sm">{integration.name}</div>
                                <div className="text-xs text-gray-500">
                                  {integration.type === 'slack' && integration.slackWorkspaceName
                                    ? integration.slackWorkspaceName
                                    : typeInfo?.name}
                                </div>
                              </div>
                            </div>
                            {getStatusBadge(integration.status)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Integration Details */}
          <div className="lg:col-span-2">
            {selectedIntegration ? (
              <div className="space-y-6">
                {/* Details Card */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{selectedIntegration.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          {INTEGRATION_TYPES.find(t => t.type === selectedIntegration.type)?.name}
                          {getStatusBadge(selectedIntegration.status)}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {selectedIntegration.type === 'slack' && selectedIntegration.status !== 'active' && (
                          <Button size="sm" onClick={() => handleReconnectSlack(selectedIntegration)}>
                            Connect
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(selectedIntegration)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedIntegration.lastError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="text-sm font-medium text-red-800">Last Error</div>
                        <div className="text-sm text-red-700">{selectedIntegration.lastError}</div>
                        <div className="text-xs text-red-500 mt-1">
                          {selectedIntegration.lastErrorAt && formatTimeAgo(selectedIntegration.lastErrorAt)}
                        </div>
                      </div>
                    )}

                    {/* Slack Settings */}
                    {selectedIntegration.type === 'slack' && selectedIntegration.status === 'active' && (
                      <div className="space-y-4">
                        <div>
                          <Label>Workspace</Label>
                          <div className="text-sm text-gray-600">{selectedIntegration.slackWorkspaceName}</div>
                        </div>

                        <div>
                          <Label>Default Channel</Label>
                          {isLoadingChannels ? (
                            <div className="text-sm text-gray-500">Loading channels...</div>
                          ) : (
                            <div className="flex gap-2 mt-1">
                              <select
                                className="flex-1 px-3 py-2 border rounded-md text-sm"
                                value={selectedChannelId}
                                onChange={(e) => setSelectedChannelId(e.target.value)}
                              >
                                <option value="">Select a channel</option>
                                {slackChannels.map((channel) => (
                                  <option key={channel.id} value={channel.id}>
                                    #{channel.name}
                                  </option>
                                ))}
                              </select>
                              <Button size="sm" onClick={handleUpdateSlackChannel} disabled={!selectedChannelId}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleTestSlack} disabled={!selectedChannelId || isTesting}>
                                {isTesting ? 'Sending...' : 'Test'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Webhook Settings */}
                    {selectedIntegration.type === 'webhook' && (
                      <div>
                        <Label>Webhook URL</Label>
                        <div className="text-sm text-gray-600 font-mono break-all">
                          {selectedIntegration.webhookUrl || 'Not configured'}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Linked Services */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Linked Services</CardTitle>
                    <CardDescription>Select which services use this integration</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {services.map((service) => {
                        const isLinked = linkedServices.some(s => s.id === service.id);
                        return (
                          <div
                            key={service.id}
                            className="flex items-center justify-between p-2 border rounded-lg"
                          >
                            <span className="text-sm">{service.name}</span>
                            <Button
                              size="sm"
                              variant={isLinked ? 'destructive' : 'outline'}
                              onClick={() => isLinked ? handleUnlinkService(service.id) : handleLinkService(service.id)}
                            >
                              {isLinked ? 'Unlink' : 'Link'}
                            </Button>
                          </div>
                        );
                      })}
                      {services.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">No services available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Events */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {integrationEvents.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No activity yet</p>
                    ) : (
                      <div className="space-y-2">
                        {integrationEvents.map((event) => (
                          <div key={event.id} className="flex items-center justify-between p-2 border-b last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">
                                {event.direction === 'inbound' ? '←' : '→'}
                              </span>
                              <span className="text-sm">{event.eventType}</span>
                              {getEventStatusBadge(event.status)}
                            </div>
                            <span className="text-xs text-gray-500">{formatTimeAgo(event.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <p className="text-gray-500">Select an integration to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
    </div>
  );
}

export default Integrations;
