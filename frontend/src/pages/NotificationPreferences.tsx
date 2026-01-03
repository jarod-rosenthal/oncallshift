import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { usersAPI } from '../lib/api-client';
import { Bell, Moon, Clock, Smartphone, Mail, MessageSquare } from 'lucide-react';
import { useAuthStore } from '../store/auth-store';

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
  const { setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Channel preferences
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);

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

      // Fetch fresh user data and DND settings in parallel
      const [dndResponse, userResponse] = await Promise.all([
        usersAPI.getDNDSettings(),
        usersAPI.getMe(),
      ]);

      const dnd = dndResponse.dnd;
      const freshUser = userResponse.user;

      // Load DND settings
      setDndEnabled(dnd.enabled || false);
      setDndStartTime(dnd.startTime || '22:00');
      setDndEndTime(dnd.endTime || '08:00');
      setDndTimezone(dnd.timezone || 'America/New_York');

      // Load channel preferences from fresh user settings
      if (freshUser?.settings?.notificationPreferences) {
        const prefs = freshUser.settings.notificationPreferences;
        setPushEnabled(prefs.push?.enabled !== false);
        setEmailEnabled(prefs.email?.enabled !== false);
        setSmsEnabled(prefs.sms?.enabled !== false);
      }

      // Update auth store with fresh user data
      setUser(freshUser);
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

      // Save DND settings
      await usersAPI.updateDNDSettings({
        enabled: dndEnabled,
        startTime: dndEnabled ? dndStartTime : null,
        endTime: dndEnabled ? dndEndTime : null,
        timezone: dndEnabled ? dndTimezone : null,
      });

      // Save channel preferences
      await usersAPI.updateProfile({
        notificationPreferences: {
          push: { enabled: pushEnabled, types: ['triggered', 'acknowledged'] },
          email: { enabled: emailEnabled, types: ['triggered', 'acknowledged'] },
          sms: { enabled: smsEnabled, types: ['triggered', 'acknowledged'] },
        },
      });

      // Refresh user data to get updated settings
      const { user: updatedUser } = await usersAPI.getMe();
      setUser(updatedUser);

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

      {/* Notification Channels */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Choose which channels you want to receive incident notifications on
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Push Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="push-enabled" className="text-base font-medium">
                  Push Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive alerts on your mobile device
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="push-enabled"
                type="checkbox"
                checked={pushEnabled}
                onChange={(e) => setPushEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="email-enabled" className="text-base font-medium">
                  Email Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive alerts via email
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="email-enabled"
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* SMS Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="sms-enabled" className="text-base font-medium">
                  SMS Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive text messages for critical/error incidents
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="sms-enabled"
                type="checkbox"
                checked={smsEnabled}
                onChange={(e) => setSmsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </CardContent>
      </Card>

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
