import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { usersAPI, aiCredentialsAPI, type AnthropicCredentialStatus } from '../lib/api-client';
import type { User, NotificationPreferences, UserContactMethod, UserNotificationRule, ContactMethodType, NotificationUrgency } from '../types/api';

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

  // AI Credentials state
  const [aiCredentialStatus, setAiCredentialStatus] = useState<AnthropicCredentialStatus | null>(null);
  const [showCredentialInput, setShowCredentialInput] = useState(false);
  const [credentialInput, setCredentialInput] = useState('');
  const [savingCredential, setSavingCredential] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Contact Methods state
  const [contactMethods, setContactMethods] = useState<UserContactMethod[]>([]);
  const [showAddContactMethod, setShowAddContactMethod] = useState(false);
  const [contactMethodForm, setContactMethodForm] = useState({
    type: 'email' as ContactMethodType,
    address: '',
    label: '',
  });
  const [savingContactMethod, setSavingContactMethod] = useState(false);

  // Notification Rules state
  const [notificationRules, setNotificationRules] = useState<UserNotificationRule[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    contactMethodId: '',
    urgency: 'any' as NotificationUrgency,
    startDelayMinutes: 0,
  });
  const [savingRule, setSavingRule] = useState(false);

  useEffect(() => {
    loadProfile();
    loadCredentialStatus();
    loadContactMethods();
    loadNotificationRules();
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

  const loadCredentialStatus = async () => {
    try {
      const status = await aiCredentialsAPI.getStatus();
      setAiCredentialStatus(status);
    } catch (err) {
      console.error('Failed to load credential status:', err);
    }
  };

  const loadContactMethods = async () => {
    try {
      const response = await usersAPI.listContactMethods();
      setContactMethods(response.contactMethods);
    } catch (err) {
      console.error('Failed to load contact methods:', err);
    }
  };

  const loadNotificationRules = async () => {
    try {
      const response = await usersAPI.listNotificationRules();
      setNotificationRules(response.notificationRules);
    } catch (err) {
      console.error('Failed to load notification rules:', err);
    }
  };

  const handleAddContactMethod = async () => {
    if (!contactMethodForm.address.trim()) {
      setError('Address is required');
      return;
    }

    try {
      setSavingContactMethod(true);
      setError(null);
      await usersAPI.createContactMethod({
        type: contactMethodForm.type,
        address: contactMethodForm.address.trim(),
        label: contactMethodForm.label.trim() || undefined,
      });
      setShowAddContactMethod(false);
      setContactMethodForm({ type: 'email', address: '', label: '' });
      loadContactMethods();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add contact method');
    } finally {
      setSavingContactMethod(false);
    }
  };

  const handleDeleteContactMethod = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact method?')) return;

    try {
      await usersAPI.deleteContactMethod(id);
      loadContactMethods();
      loadNotificationRules(); // Rules may be affected
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete contact method');
    }
  };

  const handleAddNotificationRule = async () => {
    if (!ruleForm.contactMethodId) {
      setError('Please select a contact method');
      return;
    }

    try {
      setSavingRule(true);
      setError(null);
      await usersAPI.createNotificationRule({
        contactMethodId: ruleForm.contactMethodId,
        urgency: ruleForm.urgency,
        startDelayMinutes: ruleForm.startDelayMinutes,
      });
      setShowAddRule(false);
      setRuleForm({ contactMethodId: '', urgency: 'any', startDelayMinutes: 0 });
      loadNotificationRules();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add notification rule');
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteNotificationRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification rule?')) return;

    try {
      await usersAPI.deleteNotificationRule(id);
      loadNotificationRules();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete notification rule');
    }
  };

  const handleToggleRuleEnabled = async (rule: UserNotificationRule) => {
    try {
      await usersAPI.updateNotificationRule(rule.id, { enabled: !rule.enabled });
      loadNotificationRules();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update notification rule');
    }
  };

  const handleSaveCredential = async () => {
    if (!credentialInput.trim()) {
      setError('Please enter a credential');
      return;
    }

    if (!credentialInput.startsWith('sk-ant-')) {
      setError('Invalid credential format. Must start with sk-ant-');
      return;
    }

    try {
      setSavingCredential(true);
      setError(null);
      const result = await aiCredentialsAPI.save(credentialInput.trim());
      setAiCredentialStatus({
        configured: true,
        type: result.credential.type,
        hint: result.credential.hint,
        hasRefreshToken: result.credential.hasRefreshToken,
        updatedAt: result.credential.updatedAt,
      });
      setCredentialInput('');
      setShowCredentialInput(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save credentials');
    } finally {
      setSavingCredential(false);
    }
  };

  const handleRemoveCredential = async () => {
    if (!confirm('Are you sure you want to remove your Anthropic credentials?')) {
      return;
    }

    try {
      await aiCredentialsAPI.remove();
      setAiCredentialStatus({ configured: false });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove credentials');
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
    <div className="max-w-4xl mx-auto">
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

            {/* AI Diagnosis Credentials Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                  AI Diagnosis
                </CardTitle>
                <CardDescription>
                  Configure your Anthropic API credentials to enable AI-powered incident diagnosis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiCredentialStatus?.configured ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">Credentials Configured</p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          {aiCredentialStatus.type === 'oauth' ? 'OAuth Token' : 'API Key'}: {aiCredentialStatus.hint}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleRemoveCredential}>
                      Remove Credentials
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-600"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                      <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">Not Configured</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          Add your Anthropic credentials to enable AI diagnosis
                        </p>
                      </div>
                    </div>

                    {showCredentialInput ? (
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="credential">API Key or OAuth Token</Label>
                          <Input
                            id="credential"
                            type="password"
                            value={credentialInput}
                            onChange={(e) => setCredentialInput(e.target.value)}
                            placeholder="sk-ant-..."
                            className="font-mono"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveCredential} disabled={savingCredential}>
                            {savingCredential ? 'Saving...' : 'Save Credential'}
                          </Button>
                          <Button variant="outline" onClick={() => {
                            setShowCredentialInput(false);
                            setCredentialInput('');
                          }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button onClick={() => setShowCredentialInput(true)}>
                        Add Credentials
                      </Button>
                    )}
                  </div>
                )}

                <div className="border-t pt-4 mt-4">
                  <button
                    onClick={() => setShowHelpModal(true)}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                    How do I get credentials?
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Help Modal */}
            {showHelpModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-4">How to Enable AI Diagnosis</h3>

                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold text-lg mb-2">Option 1: Anthropic API Key</h4>
                        <p className="text-muted-foreground mb-3">Pay-per-use API access. Best for organizations.</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          <li>Go to <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">console.anthropic.com</a></li>
                          <li>Sign up or log in</li>
                          <li>Navigate to API Keys</li>
                          <li>Create a new key and copy it</li>
                          <li>Paste it in the field above</li>
                        </ol>
                      </div>

                      <hr />

                      <div>
                        <h4 className="font-semibold text-lg mb-2">Option 2: Claude Pro/Max Subscription</h4>
                        <p className="text-muted-foreground mb-3">Use your existing Claude subscription. Requires Claude Code CLI.</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          <li>Install Claude Code: <code className="bg-muted px-1 rounded">npm install -g @anthropic-ai/claude-code</code></li>
                          <li>Run <code className="bg-muted px-1 rounded">claude</code> and type <code className="bg-muted px-1 rounded">/login</code></li>
                          <li>Select "Claude app" and complete browser login</li>
                          <li>Get your token: <code className="bg-muted px-1 rounded">claude config get oauthAccessToken</code></li>
                          <li>Copy and paste the token above</li>
                        </ol>
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          Note: OAuth tokens expire every 8 hours but will be refreshed automatically.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <Button onClick={() => setShowHelpModal(false)}>Got it</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Methods Card */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Contact Methods</CardTitle>
                    <CardDescription>
                      Add email, phone, or SMS contact methods for notifications
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddContactMethod(true)}>
                    Add Contact
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showAddContactMethod && (
                  <div className="mb-4 p-4 border rounded-lg bg-accent">
                    <h4 className="font-medium mb-3">Add Contact Method</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="cm-type">Type</Label>
                          <Select
                            id="cm-type"
                            value={contactMethodForm.type}
                            onChange={(e) => setContactMethodForm({ ...contactMethodForm, type: e.target.value as ContactMethodType })}
                          >
                            <option value="email">Email</option>
                            <option value="sms">SMS</option>
                            <option value="phone">Phone</option>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="cm-label">Label (Optional)</Label>
                          <Input
                            id="cm-label"
                            value={contactMethodForm.label}
                            onChange={(e) => setContactMethodForm({ ...contactMethodForm, label: e.target.value })}
                            placeholder="e.g., Work Phone"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="cm-address">
                          {contactMethodForm.type === 'email' ? 'Email Address' : 'Phone Number'}
                        </Label>
                        <Input
                          id="cm-address"
                          type={contactMethodForm.type === 'email' ? 'email' : 'tel'}
                          value={contactMethodForm.address}
                          onChange={(e) => setContactMethodForm({ ...contactMethodForm, address: e.target.value })}
                          placeholder={contactMethodForm.type === 'email' ? 'you@example.com' : '+1234567890'}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleAddContactMethod} disabled={savingContactMethod}>
                          {savingContactMethod ? 'Adding...' : 'Add'}
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowAddContactMethod(false);
                          setContactMethodForm({ type: 'email', address: '', label: '' });
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {contactMethods.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No contact methods added yet. Add one to set up notification rules.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {contactMethods.map((cm) => (
                      <div key={cm.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium uppercase px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                            {cm.type}
                          </span>
                          <div>
                            <p className="font-medium">{cm.label || cm.address}</p>
                            {cm.label && <p className="text-sm text-muted-foreground">{cm.address}</p>}
                          </div>
                          {cm.verified ? (
                            <span className="text-xs text-green-600 dark:text-green-400">Verified</span>
                          ) : (
                            <span className="text-xs text-yellow-600 dark:text-yellow-400">Pending</span>
                          )}
                          {cm.isDefault && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Default</span>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteContactMethod(cm.id)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notification Rules Card */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Notification Rules</CardTitle>
                    <CardDescription>
                      Configure when and how you receive notifications based on urgency
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowAddRule(true)}
                    disabled={contactMethods.length === 0}
                  >
                    Add Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showAddRule && (
                  <div className="mb-4 p-4 border rounded-lg bg-accent">
                    <h4 className="font-medium mb-3">Add Notification Rule</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="rule-cm">Contact Method</Label>
                          <Select
                            id="rule-cm"
                            value={ruleForm.contactMethodId}
                            onChange={(e) => setRuleForm({ ...ruleForm, contactMethodId: e.target.value })}
                          >
                            <option value="">Select...</option>
                            {contactMethods.map((cm) => (
                              <option key={cm.id} value={cm.id}>
                                {cm.type.toUpperCase()}: {cm.label || cm.address}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="rule-urgency">Urgency</Label>
                          <Select
                            id="rule-urgency"
                            value={ruleForm.urgency}
                            onChange={(e) => setRuleForm({ ...ruleForm, urgency: e.target.value as NotificationUrgency })}
                          >
                            <option value="any">Any</option>
                            <option value="high">High Only</option>
                            <option value="low">Low Only</option>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="rule-delay">Delay (minutes)</Label>
                          <Input
                            id="rule-delay"
                            type="number"
                            min="0"
                            value={ruleForm.startDelayMinutes}
                            onChange={(e) => setRuleForm({ ...ruleForm, startDelayMinutes: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleAddNotificationRule} disabled={savingRule}>
                          {savingRule ? 'Adding...' : 'Add Rule'}
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowAddRule(false);
                          setRuleForm({ contactMethodId: '', urgency: 'any', startDelayMinutes: 0 });
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {contactMethods.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Add contact methods first before creating notification rules.
                  </p>
                ) : notificationRules.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No notification rules configured. Add rules to control how you receive notifications.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {notificationRules.map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={() => handleToggleRuleEnabled(rule)}
                          />
                          <div>
                            <p className="font-medium">
                              {rule.contactMethod?.type.toUpperCase()}: {rule.contactMethod?.label || rule.contactMethod?.address}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {rule.urgency === 'any' ? 'All incidents' : `${rule.urgency} urgency only`}
                              {rule.startDelayMinutes > 0 && ` • ${rule.startDelayMinutes}min delay`}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteNotificationRule(rule.id)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
    </div>
  );
}
