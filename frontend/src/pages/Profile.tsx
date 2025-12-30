import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Navigation } from '../components/Navigation';
import { usersAPI } from '../lib/api-client';
import type { User, NotificationPreferences } from '../types/api';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const NOTIFICATION_TYPES = [
  { value: 'triggered', label: 'New incidents' },
  { value: 'acknowledged', label: 'Acknowledged incidents' },
  { value: 'resolved', label: 'Resolved incidents' },
] as const;

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  email: { enabled: true, types: ['triggered', 'acknowledged', 'resolved'] },
  sms: { enabled: false, types: ['triggered'] },
  push: { enabled: true, types: ['triggered', 'acknowledged'] },
};

export function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const response = await usersAPI.getMe();
      setUser(response.user);

      // Set form values from user data
      setFullName(response.user.fullName || '');
      setDisplayName(response.user.settings?.profile?.displayName || '');
      setPhoneNumber(response.user.phoneNumber || '');
      setTimezone(response.user.settings?.profileTimezone || 'America/New_York');

      // Set notification preferences (deep merge to preserve nested defaults)
      if (response.user.settings?.notificationPreferences) {
        const serverPrefs = response.user.settings.notificationPreferences;
        setNotificationPrefs({
          email: { ...DEFAULT_NOTIFICATION_PREFS.email, ...serverPrefs.email },
          sms: { ...DEFAULT_NOTIFICATION_PREFS.sms, ...serverPrefs.sms },
          push: { ...DEFAULT_NOTIFICATION_PREFS.push, ...serverPrefs.push },
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      // Validate
      if (!fullName.trim() || fullName.length < 2) {
        setError('Full name must be at least 2 characters');
        setIsSaving(false);
        return;
      }

      const response = await usersAPI.updateProfile({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim() || null,
        displayName: displayName.trim() || null,
        timezone,
        notificationPreferences: notificationPrefs,
      });

      setUser(response.user);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.error) {
        setError(data.error);
      } else if (data?.errors && Array.isArray(data.errors)) {
        setError(data.errors.map((e: any) => e.msg).join('. '));
      } else {
        setError('Failed to update profile');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const toggleNotificationChannel = (channel: keyof NotificationPreferences, enabled: boolean) => {
    setNotificationPrefs(prev => ({
      ...prev,
      [channel]: { ...prev[channel], enabled },
    }));
  };

  const toggleNotificationType = (channel: keyof NotificationPreferences, type: string, enabled: boolean) => {
    setNotificationPrefs(prev => {
      const currentTypes = prev[channel].types;
      const newTypes = enabled
        ? [...currentTypes, type as 'triggered' | 'acknowledged' | 'resolved']
        : currentTypes.filter(t => t !== type);
      return {
        ...prev,
        [channel]: { ...prev[channel], types: newTypes },
      };
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Back to Dashboard
          </Button>
        </Link>

        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Profile Settings</h2>
          <p className="text-muted-foreground">
            Manage your account information and notification preferences
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 text-sm text-green-800 bg-green-50 dark:bg-green-900/20 dark:text-green-200 rounded-md">
            Profile updated successfully!
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Your personal information visible to team members
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <Label htmlFor="displayName">Display Name (Optional)</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Johnny"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    A shorter name shown in compact views
                  </p>
                </div>

                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1234567890"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for SMS notifications when on-call
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Timezone Card */}
            <Card>
              <CardHeader>
                <CardTitle>Timezone</CardTitle>
                <CardDescription>
                  Your local timezone for displaying times
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </Select>
              </CardContent>
            </Card>

            {/* Notification Preferences Card */}
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose how you want to be notified about incidents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email Notifications */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={notificationPrefs.email.enabled}
                      onCheckedChange={(checked) => toggleNotificationChannel('email', checked)}
                    />
                  </div>
                  {notificationPrefs.email.enabled && (
                    <div className="ml-4 space-y-2">
                      {NOTIFICATION_TYPES.map(type => (
                        <div key={type.value} className="flex items-center gap-2">
                          <Switch
                            checked={notificationPrefs.email.types.includes(type.value)}
                            onCheckedChange={(checked) => toggleNotificationType('email', type.value, checked)}
                          />
                          <Label className="font-normal">{type.label}</Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SMS Notifications */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">SMS Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive notifications via text message</p>
                    </div>
                    <Switch
                      checked={notificationPrefs.sms.enabled}
                      onCheckedChange={(checked) => toggleNotificationChannel('sms', checked)}
                    />
                  </div>
                  {notificationPrefs.sms.enabled && (
                    <div className="ml-4 space-y-2">
                      {NOTIFICATION_TYPES.map(type => (
                        <div key={type.value} className="flex items-center gap-2">
                          <Switch
                            checked={notificationPrefs.sms.types.includes(type.value)}
                            onCheckedChange={(checked) => toggleNotificationType('sms', type.value, checked)}
                          />
                          <Label className="font-normal">{type.label}</Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Push Notifications */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive notifications on your mobile device</p>
                    </div>
                    <Switch
                      checked={notificationPrefs.push.enabled}
                      onCheckedChange={(checked) => toggleNotificationChannel('push', checked)}
                    />
                  </div>
                  {notificationPrefs.push.enabled && (
                    <div className="ml-4 space-y-2">
                      {NOTIFICATION_TYPES.map(type => (
                        <div key={type.value} className="flex items-center gap-2">
                          <Switch
                            checked={notificationPrefs.push.types.includes(type.value)}
                            onCheckedChange={(checked) => toggleNotificationType('push', type.value, checked)}
                          />
                          <Label className="font-normal">{type.label}</Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Organization Card (Read-Only) */}
            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
                <CardDescription>
                  Your organization membership information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Organization Name</Label>
                  <p className="font-medium">{user?.organization?.name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Plan</Label>
                  <p className="font-medium capitalize">{user?.organization?.plan || 'Free'}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Your Role</Label>
                  <p className="font-medium capitalize">{user?.role || 'Member'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Account Card (Read-Only) */}
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>
                  Account information (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Email Address</Label>
                  <p className="font-medium">{user?.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Email cannot be changed. Contact support if needed.
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Member Since</Label>
                  <p className="font-medium">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }) : 'N/A'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
