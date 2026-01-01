import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { usersAPI } from '../lib/api-client';
import { Bell, Moon, Clock } from 'lucide-react';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Australia/Sydney',
  'UTC',
];

export function NotificationPreferences() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Do Not Disturb settings
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStartTime, setDndStartTime] = useState('22:00');
  const [dndEndTime, setDndEndTime] = useState('08:00');
  const [dndTimezone, setDndTimezone] = useState('America/New_York');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const response = await usersAPI.getDNDSettings();
      const dnd = response.dnd;

      // Load DND settings
      setDndEnabled(dnd.enabled || false);
      setDndStartTime(dnd.startTime || '22:00');
      setDndEndTime(dnd.endTime || '08:00');
      setDndTimezone(dnd.timezone || 'America/New_York');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      await usersAPI.updateDNDSettings({
        enabled: dndEnabled,
        startTime: dndEnabled ? dndStartTime : null,
        endTime: dndEnabled ? dndEndTime : null,
        timezone: dndEnabled ? dndTimezone : null,
      });

      setSuccess('Notification preferences updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Bell className="w-8 h-8" />
          Notification Preferences
        </h2>
        <p className="text-muted-foreground">
          Configure when and how you receive incident notifications
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

      {/* Do Not Disturb Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="w-5 h-5" />
            Do Not Disturb
          </CardTitle>
          <CardDescription>
            Set quiet hours when you don't want to receive non-critical notifications.
            Critical and error severity incidents will always bypass DND.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="dnd-enabled" className="text-base font-medium">
                Enable Do Not Disturb
              </Label>
              <p className="text-sm text-muted-foreground">
                Block low-priority notifications during specified hours
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="dnd-enabled"
                type="checkbox"
                checked={dndEnabled}
                onChange={(e) => setDndEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {dndEnabled && (
            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dnd-start">Start Time</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <Input
                      id="dnd-start"
                      type="time"
                      value={dndStartTime}
                      onChange={(e) => setDndStartTime(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    When DND begins
                  </p>
                </div>

                <div>
                  <Label htmlFor="dnd-end">End Time</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <Input
                      id="dnd-end"
                      type="time"
                      value={dndEndTime}
                      onChange={(e) => setDndEndTime(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    When DND ends
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="dnd-timezone">Timezone</Label>
                <select
                  id="dnd-timezone"
                  value={dndTimezone}
                  onChange={(e) => setDndTimezone(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Your local timezone for DND schedule
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  <strong>Preview:</strong> DND active from {dndStartTime} to {dndEndTime} ({dndTimezone})
                  {dndStartTime > dndEndTime && ' (crosses midnight)'}
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-300 mt-2">
                  💡 Critical and error severity incidents will always notify you, even during DND hours.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Bundling Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Low-Priority Bundling</CardTitle>
          <CardDescription>
            How low-urgency notifications are handled
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium">Automatic Bundling</p>
                <p className="text-sm text-muted-foreground">
                  Low-urgency incidents (info/warning severity) are automatically bundled together
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium">Digest Frequency</p>
                <p className="text-sm text-muted-foreground">
                  You'll receive a digest of bundled notifications every 30 minutes
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium">Immediate for Critical</p>
                <p className="text-sm text-muted-foreground">
                  Critical and error incidents always notify immediately, never bundled
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={loadPreferences}
          disabled={isSaving}
        >
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
