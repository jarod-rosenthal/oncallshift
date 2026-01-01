import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { servicesAPI, schedulesAPI } from '../lib/api-client';
import type { Service, Schedule, MaintenanceWindow, ServiceUrgency, SupportHours } from '../types/api';

interface EscalationPolicy {
  id: string;
  name: string;
}

export function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [escalationPolicies, setEscalationPolicies] = useState<EscalationPolicy[]>([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState<Record<string, MaintenanceWindow[]>>({});
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

  // Urgency settings
  const [urgency, setUrgency] = useState<ServiceUrgency>('high');
  const [supportHoursEnabled, setSupportHoursEnabled] = useState(false);
  const [supportHoursTimezone, setSupportHoursTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [supportHoursDays, setSupportHoursDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [supportHoursStart, setSupportHoursStart] = useState('09:00');
  const [supportHoursEnd, setSupportHoursEnd] = useState('17:00');
  const [ackTimeoutEnabled, setAckTimeoutEnabled] = useState(false);
  const [ackTimeoutMinutes, setAckTimeoutMinutes] = useState(30);

  // API key visibility
  const [visibleApiKeys, setVisibleApiKeys] = useState<Set<string>>(new Set());

  // Maintenance window form state
  const [showMaintenanceForm, setShowMaintenanceForm] = useState<string | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    startTime: '',
    endTime: '',
    description: '',
    suppressAlerts: true,
  });
  const [isCreatingMaintenance, setIsCreatingMaintenance] = useState(false);

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

      // Load maintenance windows for all services
      const windowsMap: Record<string, MaintenanceWindow[]> = {};
      await Promise.all(
        servicesRes.services.map(async (service) => {
          try {
            const mwRes = await servicesAPI.listMaintenanceWindows(service.id);
            // Filter to show only active and upcoming
            windowsMap[service.id] = (mwRes.maintenanceWindows || []).filter(
              (mw) => mw.isActive || mw.isFuture
            );
          } catch {
            windowsMap[service.id] = [];
          }
        })
      );
      setMaintenanceWindows(windowsMap);
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
    setUrgency('high');
    setSupportHoursEnabled(false);
    setSupportHoursTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setSupportHoursDays([1, 2, 3, 4, 5]);
    setSupportHoursStart('09:00');
    setSupportHoursEnd('17:00');
    setAckTimeoutEnabled(false);
    setAckTimeoutMinutes(30);
    setEditingService(null);
    setShowCreateForm(false);
  };

  const handleStartEdit = (service: Service) => {
    setEditingService(service);
    setNewServiceName(service.name);
    setNewServiceDescription(service.description || '');
    setSelectedScheduleId(service.schedule?.id || '');
    setSelectedEscalationPolicyId(service.escalationPolicy?.id || '');
    // Urgency settings
    setUrgency(service.urgency || 'high');
    if (service.supportHours) {
      setSupportHoursEnabled(service.supportHours.enabled);
      setSupportHoursTimezone(service.supportHours.timezone);
      setSupportHoursDays(service.supportHours.days);
      setSupportHoursStart(service.supportHours.startTime);
      setSupportHoursEnd(service.supportHours.endTime);
    } else {
      setSupportHoursEnabled(false);
      setSupportHoursTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      setSupportHoursDays([1, 2, 3, 4, 5]);
      setSupportHoursStart('09:00');
      setSupportHoursEnd('17:00');
    }
    setAckTimeoutEnabled(!!service.ackTimeoutSeconds);
    setAckTimeoutMinutes(service.ackTimeoutSeconds ? Math.round(service.ackTimeoutSeconds / 60) : 30);
    setShowCreateForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      setError(null);

      // Build support hours config if dynamic urgency is selected
      const supportHours: SupportHours | undefined = urgency === 'dynamic' && supportHoursEnabled ? {
        enabled: true,
        timezone: supportHoursTimezone,
        days: supportHoursDays,
        startTime: supportHoursStart,
        endTime: supportHoursEnd,
      } : undefined;

      const serviceData = {
        name: newServiceName,
        description: newServiceDescription || undefined,
        scheduleId: selectedScheduleId || undefined,
        escalationPolicyId: selectedEscalationPolicyId || undefined,
        urgency,
        supportHours: urgency === 'dynamic' ? supportHours : undefined,
        ackTimeoutSeconds: ackTimeoutEnabled ? ackTimeoutMinutes * 60 : undefined,
      };

      if (editingService) {
        await servicesAPI.update(editingService.id, {
          ...serviceData,
          supportHours: urgency === 'dynamic' ? supportHours : null,
          ackTimeoutSeconds: ackTimeoutEnabled ? ackTimeoutMinutes * 60 : null,
        });
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

  // Maintenance window handlers
  const formatDateTimeLocal = (date: Date) => {
    return date.toISOString().slice(0, 16);
  };

  const handleOpenMaintenanceForm = (serviceId: string) => {
    const now = new Date();
    const endTime = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now
    setMaintenanceForm({
      startTime: formatDateTimeLocal(now),
      endTime: formatDateTimeLocal(endTime),
      description: '',
      suppressAlerts: true,
    });
    setShowMaintenanceForm(serviceId);
  };

  const handleCreateMaintenanceWindow = async (e: React.FormEvent, serviceId: string) => {
    e.preventDefault();

    if (!maintenanceForm.startTime || !maintenanceForm.endTime) {
      setError('Start time and end time are required');
      return;
    }

    try {
      setIsCreatingMaintenance(true);
      setError(null);
      await servicesAPI.createMaintenanceWindow(serviceId, {
        startTime: new Date(maintenanceForm.startTime).toISOString(),
        endTime: new Date(maintenanceForm.endTime).toISOString(),
        description: maintenanceForm.description || undefined,
        suppressAlerts: maintenanceForm.suppressAlerts,
      });
      setShowMaintenanceForm(null);
      setMaintenanceForm({ startTime: '', endTime: '', description: '', suppressAlerts: true });
      setSuccess('Maintenance window created successfully');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create maintenance window');
    } finally {
      setIsCreatingMaintenance(false);
    }
  };

  const handleDeleteMaintenanceWindow = async (serviceId: string, windowId: string) => {
    if (!confirm('Are you sure you want to delete this maintenance window?')) return;

    try {
      setError(null);
      await servicesAPI.deleteMaintenanceWindow(serviceId, windowId);
      setSuccess('Maintenance window deleted');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete maintenance window');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold mb-2">Services & Webhooks</h2>
            <p className="text-muted-foreground">
              Manage services and API keys for integrations
            </p>
          </div>
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

                {/* Urgency Settings */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-3">Notification Urgency</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="urgency">Urgency Mode</Label>
                      <select
                        id="urgency"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={urgency}
                        onChange={(e) => setUrgency(e.target.value as ServiceUrgency)}
                      >
                        <option value="high">High urgency (always notify immediately)</option>
                        <option value="low">Low urgency (respect quiet hours)</option>
                        <option value="dynamic">Dynamic (based on support hours)</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        High urgency incidents notify responders immediately. Low urgency respects user notification preferences.
                      </p>
                    </div>

                    {/* Support Hours (only for dynamic urgency) */}
                    {urgency === 'dynamic' && (
                      <div className="border rounded-md p-4 bg-muted/30 space-y-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="supportHoursEnabled"
                            checked={supportHoursEnabled}
                            onChange={(e) => setSupportHoursEnabled(e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor="supportHoursEnabled" className="text-sm font-medium">
                            Enable support hours
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          During support hours, incidents are high urgency. Outside support hours, they're low urgency.
                        </p>

                        {supportHoursEnabled && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="supportHoursStart">Start Time</Label>
                                <Input
                                  id="supportHoursStart"
                                  type="time"
                                  value={supportHoursStart}
                                  onChange={(e) => setSupportHoursStart(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor="supportHoursEnd">End Time</Label>
                                <Input
                                  id="supportHoursEnd"
                                  type="time"
                                  value={supportHoursEnd}
                                  onChange={(e) => setSupportHoursEnd(e.target.value)}
                                />
                              </div>
                            </div>

                            <div>
                              <Label>Support Days</Label>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                                  <label
                                    key={day}
                                    className={`px-3 py-1 rounded-md cursor-pointer text-sm border transition-colors ${
                                      supportHoursDays.includes(index)
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background border-input hover:border-primary/50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="sr-only"
                                      checked={supportHoursDays.includes(index)}
                                      onChange={() => {
                                        if (supportHoursDays.includes(index)) {
                                          setSupportHoursDays(supportHoursDays.filter(d => d !== index));
                                        } else {
                                          setSupportHoursDays([...supportHoursDays, index].sort());
                                        }
                                      }}
                                    />
                                    {day}
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="supportHoursTimezone">Timezone</Label>
                              <select
                                id="supportHoursTimezone"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={supportHoursTimezone}
                                onChange={(e) => setSupportHoursTimezone(e.target.value)}
                              >
                                <option value="America/New_York">Eastern Time (ET)</option>
                                <option value="America/Chicago">Central Time (CT)</option>
                                <option value="America/Denver">Mountain Time (MT)</option>
                                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                                <option value="UTC">UTC</option>
                                <option value="Europe/London">London (GMT/BST)</option>
                                <option value="Europe/Paris">Central European (CET)</option>
                                <option value="Asia/Tokyo">Japan (JST)</option>
                                <option value="Asia/Shanghai">China (CST)</option>
                                <option value="Australia/Sydney">Sydney (AEST)</option>
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Acknowledgement Timeout */}
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id="ackTimeoutEnabled"
                          checked={ackTimeoutEnabled}
                          onChange={(e) => setAckTimeoutEnabled(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="ackTimeoutEnabled" className="text-sm font-medium">
                          Enable acknowledgement timeout
                        </label>
                      </div>
                      {ackTimeoutEnabled && (
                        <div className="flex items-center gap-2">
                          <Label htmlFor="ackTimeoutMinutes" className="whitespace-nowrap">
                            Auto-unacknowledge after
                          </Label>
                          <Input
                            id="ackTimeoutMinutes"
                            type="number"
                            min={1}
                            max={1440}
                            value={ackTimeoutMinutes}
                            onChange={(e) => setAckTimeoutMinutes(parseInt(e.target.value) || 30)}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">minutes</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        If enabled, acknowledged incidents will automatically return to triggered state if not resolved within this time.
                      </p>
                    </div>
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

                    {/* Maintenance Windows Section */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium">Maintenance Windows</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenMaintenanceForm(service.id)}
                        >
                          Schedule Maintenance
                        </Button>
                      </div>

                      {/* Maintenance Window Form */}
                      {showMaintenanceForm === service.id && (
                        <div className="mb-4 p-4 border rounded-lg bg-accent">
                          <h5 className="font-medium mb-3">Schedule Maintenance Window</h5>
                          <form onSubmit={(e) => handleCreateMaintenanceWindow(e, service.id)} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor={`mw-start-${service.id}`}>Start Time</Label>
                                <Input
                                  id={`mw-start-${service.id}`}
                                  type="datetime-local"
                                  value={maintenanceForm.startTime}
                                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, startTime: e.target.value })}
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor={`mw-end-${service.id}`}>End Time</Label>
                                <Input
                                  id={`mw-end-${service.id}`}
                                  type="datetime-local"
                                  value={maintenanceForm.endTime}
                                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, endTime: e.target.value })}
                                  required
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor={`mw-desc-${service.id}`}>Description (optional)</Label>
                              <Input
                                id={`mw-desc-${service.id}`}
                                type="text"
                                placeholder="e.g., Database upgrade"
                                value={maintenanceForm.description}
                                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`mw-suppress-${service.id}`}
                                checked={maintenanceForm.suppressAlerts}
                                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, suppressAlerts: e.target.checked })}
                                className="rounded border-input"
                              />
                              <Label htmlFor={`mw-suppress-${service.id}`} className="text-sm">
                                Suppress alerts during maintenance
                              </Label>
                            </div>
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" disabled={isCreatingMaintenance}>
                                {isCreatingMaintenance ? 'Creating...' : 'Create'}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowMaintenanceForm(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </div>
                      )}

                      {/* Active and Upcoming Windows */}
                      {maintenanceWindows[service.id]?.length > 0 ? (
                        <div className="space-y-2">
                          {maintenanceWindows[service.id].map((mw) => (
                            <div
                              key={mw.id}
                              className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                                mw.isActive
                                  ? 'bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800'
                                  : 'bg-muted'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-1.5 py-0.5 text-xs rounded ${
                                      mw.isActive
                                        ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                                        : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                    }`}
                                  >
                                    {mw.isActive ? 'ACTIVE' : 'SCHEDULED'}
                                  </span>
                                  <span>
                                    {new Date(mw.startTime).toLocaleString()} — {new Date(mw.endTime).toLocaleString()}
                                  </span>
                                </div>
                                {mw.description && (
                                  <p className="text-muted-foreground mt-1">{mw.description}</p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteMaintenanceWindow(service.id, mw.id)}
                              >
                                {mw.isActive ? 'End' : 'Cancel'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No maintenance windows scheduled
                        </p>
                      )}
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
      </div>
  );
}
