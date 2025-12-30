import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Navigation } from '../components/Navigation';
import { servicesAPI, schedulesAPI } from '../lib/api-client';
import type { Service, Schedule } from '../types/api';

interface EscalationPolicy {
  id: string;
  name: string;
}

export function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [escalationPolicies, setEscalationPolicies] = useState<EscalationPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create/Edit form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDescription, setNewServiceDescription] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedEscalationPolicyId, setSelectedEscalationPolicyId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // API key visibility
  const [visibleApiKeys, setVisibleApiKeys] = useState<Set<string>>(new Set());

  // Webhook URL
  const webhookUrl = `${window.location.origin}/api/v1/alerts/webhook`;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [servicesRes, schedulesRes] = await Promise.all([
        servicesAPI.list(),
        schedulesAPI.list(),
      ]);
      setServices(servicesRes.services);
      setSchedules(schedulesRes.schedules);

      // Fetch escalation policies using fetch (no API client method exists)
      const token = localStorage.getItem('accessToken');
      if (token) {
        const policiesRes = await fetch('/api/v1/escalation-policies', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (policiesRes.ok) {
          const policiesData = await policiesRes.json();
          setEscalationPolicies(policiesData.policies || []);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewServiceName('');
    setNewServiceDescription('');
    setSelectedScheduleId('');
    setSelectedEscalationPolicyId('');
    setEditingService(null);
    setShowCreateForm(false);
  };

  const handleStartEdit = (service: Service) => {
    setEditingService(service);
    setNewServiceName(service.name);
    setNewServiceDescription(service.description || '');
    setSelectedScheduleId(service.schedule?.id || '');
    setSelectedEscalationPolicyId(service.escalationPolicy?.id || '');
    setShowCreateForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      setError(null);

      const serviceData = {
        name: newServiceName,
        description: newServiceDescription || undefined,
        scheduleId: selectedScheduleId || undefined,
        escalationPolicyId: selectedEscalationPolicyId || undefined,
      };

      if (editingService) {
        await servicesAPI.update(editingService.id, serviceData);
        setSuccess('Service updated successfully');
      } else {
        await servicesAPI.create(serviceData);
        setSuccess('Service created successfully');
      }

      resetForm();
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save service');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRegenerateKey = async (serviceId: string, serviceName: string) => {
    if (!confirm(`Are you sure you want to regenerate the API key for "${serviceName}"? Any integrations using the old key will stop working.`)) {
      return;
    }

    try {
      setError(null);
      const result = await servicesAPI.regenerateApiKey(serviceId);
      setServices(services.map(s => s.id === serviceId ? result.service : s));
      setVisibleApiKeys(new Set([...visibleApiKeys, serviceId]));
      setSuccess('API key regenerated successfully. Make sure to copy the new key.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to regenerate API key');
    }
  };

  const handleDelete = async (serviceId: string, serviceName: string) => {
    if (!confirm(`Are you sure you want to delete "${serviceName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await servicesAPI.delete(serviceId);
      setServices(services.filter(s => s.id !== serviceId));
      setSuccess('Service deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete service');
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`${label} copied to clipboard`);
      setTimeout(() => setSuccess(null), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const toggleApiKeyVisibility = (serviceId: string) => {
    const newVisibleKeys = new Set(visibleApiKeys);
    if (newVisibleKeys.has(serviceId)) {
      newVisibleKeys.delete(serviceId);
    } else {
      newVisibleKeys.add(serviceId);
    }
    setVisibleApiKeys(newVisibleKeys);
  };

  const maskApiKey = (apiKey: string) => {
    return apiKey.substring(0, 8) + '••••••••••••••••';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Back to Dashboard
          </Button>
        </Link>

        <div className="mb-8 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold mb-2">Admin: Services & Webhooks</h2>
            <p className="text-muted-foreground">
              Manage services and API keys for integrations
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/users">
              <Button variant="outline">Users</Button>
            </Link>
            <Button onClick={() => {
              if (showCreateForm) {
                resetForm();
              } else {
                setShowCreateForm(true);
              }
            }}>
              {showCreateForm ? 'Cancel' : 'Create Service'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 text-sm text-green-800 bg-green-50 dark:bg-green-900/20 dark:text-green-200 rounded-md">
            {success}
          </div>
        )}

        {/* Webhook URL Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Webhook Integration</CardTitle>
            <CardDescription>
              Use this URL to send alerts from your monitoring tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
                {webhookUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
              >
                Copy
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Include the <code className="bg-muted px-1 rounded">X-API-Key</code> header with your service's API key when making requests.
            </p>
          </CardContent>
        </Card>

        {/* Create/Edit Service Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingService ? 'Edit Service' : 'Create New Service'}</CardTitle>
              <CardDescription>
                {editingService
                  ? 'Update service settings and assign a schedule for on-call routing'
                  : 'A service represents a component in your system that can trigger incidents'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="serviceName">Service Name</Label>
                    <Input
                      id="serviceName"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      placeholder="e.g., Production API"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="serviceDescription">Description (Optional)</Label>
                    <Input
                      id="serviceDescription"
                      value={newServiceDescription}
                      onChange={(e) => setNewServiceDescription(e.target.value)}
                      placeholder="e.g., Main production API server"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="scheduleId">On-Call Schedule</Label>
                    <select
                      id="scheduleId"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={selectedScheduleId}
                      onChange={(e) => setSelectedScheduleId(e.target.value)}
                    >
                      <option value="">No schedule assigned</option>
                      {schedules.map((schedule) => (
                        <option key={schedule.id} value={schedule.id}>
                          {schedule.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Determines who is on-call for this service
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="escalationPolicyId">Escalation Policy</Label>
                    <select
                      id="escalationPolicyId"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={selectedEscalationPolicyId}
                      onChange={(e) => setSelectedEscalationPolicyId(e.target.value)}
                    >
                      <option value="">No escalation policy</option>
                      {escalationPolicies.map((policy) => (
                        <option key={policy.id} value={policy.id}>
                          {policy.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Defines how incidents are escalated if not acknowledged
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? 'Saving...' : editingService ? 'Save Changes' : 'Create Service'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Services List */}
        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <CardDescription>
              {services.filter(s => s.status === 'active').length} active service{services.filter(s => s.status === 'active').length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading services...</p>
            ) : services.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No services yet. Create one to start receiving alerts.
              </p>
            ) : (
              <div className="space-y-4">
                {services.filter(s => s.status === 'active').map((service) => (
                  <div
                    key={service.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{service.name}</h3>
                        {service.description && (
                          <p className="text-sm text-muted-foreground">{service.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            service.status === 'active'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                              : service.status === 'maintenance'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {service.status}
                        </span>
                      </div>
                    </div>

                    <div className="bg-muted rounded p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">API Key</Label>
                          <code className="block font-mono text-sm mt-1">
                            {visibleApiKeys.has(service.id)
                              ? service.apiKey
                              : maskApiKey(service.apiKey)}
                          </code>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleApiKeyVisibility(service.id)}
                          >
                            {visibleApiKeys.has(service.id) ? 'Hide' : 'Show'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(service.apiKey, 'API key')}
                          >
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRegenerateKey(service.id, service.name)}
                          >
                            Regenerate
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="space-x-4">
                        {service.schedule ? (
                          <span className="text-muted-foreground">
                            Schedule: <span className="text-foreground">{service.schedule.name}</span>
                          </span>
                        ) : (
                          <span className="text-orange-600 dark:text-orange-400">
                            No schedule assigned
                          </span>
                        )}
                        {service.escalationPolicy && (
                          <span className="text-muted-foreground">
                            Escalation: <span className="text-foreground">{service.escalationPolicy.name}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartEdit(service)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(service.id, service.name)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sample Request */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Sample Alert Request</CardTitle>
            <CardDescription>
              Use this format to send alerts from your monitoring system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SERVICE_API_KEY" \\
  -d '{
    "summary": "High CPU usage on production server",
    "severity": "warning",
    "details": {
      "host": "prod-server-1",
      "cpu_usage": "95%"
    }
  }'`}
            </pre>
            <div className="mt-4 text-sm text-muted-foreground">
              <p><strong>Available severity levels:</strong> info, warning, error, critical</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
