import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { SupportHoursConfig, type SupportHoursData } from '../components/SupportHoursConfig';
import { servicesAPI } from '../lib/api-client';
import type { Service, ServiceUrgency } from '../types/api';

export function ServiceConfiguration() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [urgency, setUrgency] = useState<ServiceUrgency>('high');
  const [supportHours, setSupportHours] = useState<SupportHoursData>({
    enabled: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    days: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: '09:00',
    endTime: '17:00',
  });
  const [ackTimeoutEnabled, setAckTimeoutEnabled] = useState(false);
  const [ackTimeoutMinutes, setAckTimeoutMinutes] = useState(30);

  useEffect(() => {
    if (id) {
      loadService();
    }
  }, [id]);

  const loadService = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const data = await servicesAPI.get(id);
      setService(data.service);

      // Load form values from service
      setUrgency(data.service.urgency || 'high');

      if (data.service.supportHours) {
        setSupportHours({
          enabled: data.service.supportHours.enabled,
          timezone: data.service.supportHours.timezone,
          days: data.service.supportHours.days,
          startTime: data.service.supportHours.startTime,
          endTime: data.service.supportHours.endTime,
        });
      }

      setAckTimeoutEnabled(!!data.service.ackTimeoutSeconds);
      setAckTimeoutMinutes(data.service.ackTimeoutSeconds ? Math.round(data.service.ackTimeoutSeconds / 60) : 30);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load service');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) return;

    try {
      setIsSaving(true);
      setError(null);

      await servicesAPI.update(id, {
        urgency,
        supportHours: urgency === 'dynamic' && supportHours.enabled ? {
          enabled: true,
          timezone: supportHours.timezone,
          days: supportHours.days,
          startTime: supportHours.startTime,
          endTime: supportHours.endTime,
        } : null,
        ackTimeoutSeconds: ackTimeoutEnabled ? ackTimeoutMinutes * 60 : null,
      });

      setSuccess('Service configuration updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update service');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-destructive/10 text-destructive rounded-lg p-4">
          Service not found
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/services')}
          >
            ← Back to Services
          </Button>
        </div>
        <h2 className="text-3xl font-bold">Service Configuration</h2>
        <p className="text-muted-foreground mt-2">
          Configure urgency settings and support hours for <strong>{service.name}</strong>
        </p>
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

      <form onSubmit={handleSave} className="space-y-6">
        {/* Urgency Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Urgency</CardTitle>
            <CardDescription>
              Control how incidents from this service are escalated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="urgency">Urgency Mode</Label>
              <select
                id="urgency"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mt-1"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as ServiceUrgency)}
              >
                <option value="high">High urgency - Always notify immediately</option>
                <option value="low">Low urgency - Respect quiet hours</option>
                <option value="dynamic">Dynamic - Based on support hours</option>
              </select>
              <p className="text-xs text-muted-foreground mt-2">
                {urgency === 'high' && 'All incidents will trigger immediate notifications regardless of time of day.'}
                {urgency === 'low' && 'Incidents will respect individual user notification preferences and quiet hours.'}
                {urgency === 'dynamic' && 'Incidents will be high urgency during support hours, low urgency outside support hours.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Support Hours (only for dynamic urgency) */}
        {urgency === 'dynamic' && (
          <Card>
            <CardHeader>
              <CardTitle>Support Hours</CardTitle>
              <CardDescription>
                Define when your team provides active support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupportHoursConfig
                value={supportHours}
                onChange={setSupportHours}
              />
              <p className="text-sm text-muted-foreground mt-4">
                During support hours, incidents are treated as <strong>high urgency</strong>.
                Outside support hours, they're treated as <strong>low urgency</strong>.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Acknowledgement Timeout */}
        <Card>
          <CardHeader>
            <CardTitle>Acknowledgement Timeout</CardTitle>
            <CardDescription>
              Automatically unacknowledge incidents if not resolved within a time limit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
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
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="ackTimeoutMinutes">
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
                <p className="text-xs text-muted-foreground mt-2">
                  If an incident is acknowledged but not resolved within this time, it will automatically
                  return to the triggered state and resume escalation.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/services')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </form>
    </div>
  );
}
