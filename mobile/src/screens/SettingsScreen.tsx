import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
  Platform,
  TextInput,
  Linking,
} from 'react-native';
import {
  Text,
  Switch,
  List,
  Divider,
  RadioButton,
  useTheme,
  ActivityIndicator,
  Portal,
  Modal,
  Button,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import * as hapticService from '../services/hapticService';
import * as apiService from '../services/apiService';
import * as notificationService from '../services/notificationService';
import * as soundService from '../services/soundService';
import type { AlertSoundType, AlertSoundOption } from '../services/soundService';
import { ALERT_SOUND_OPTIONS, getAlertSound, setAlertSound, previewAlertSound } from '../services/soundService';
import { useToast, DNDControls, useDNDStatus, ProfilePictureEditor } from '../components';
import type { DNDSettings } from '../components';

// User profile interface
interface UserProfile {
  id: string;
  fullName: string | null;
  email: string;
  profilePictureUrl: string | null;
}

// Settings interface
interface AppSettings {
  // Notifications
  pushNotificationsEnabled: boolean;
  notifyOnTriggered: boolean;
  notifyOnAcknowledged: boolean;
  notifyOnResolved: boolean;
  notifyOnEscalation: boolean;
  // Appearance
  theme: 'system' | 'light' | 'dark';
  compactMode: boolean;
  // Behavior
  hapticFeedbackEnabled: boolean;
  confirmBeforeActions: boolean;
  autoRefreshEnabled: boolean;
  autoRefreshInterval: number; // seconds
  // Security
  biometricLockEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  pushNotificationsEnabled: true,
  notifyOnTriggered: true,
  notifyOnAcknowledged: true,
  notifyOnResolved: false,
  notifyOnEscalation: true,
  theme: 'system',
  compactMode: false,
  hapticFeedbackEnabled: true,
  confirmBeforeActions: true,
  autoRefreshEnabled: true,
  autoRefreshInterval: 30,
  biometricLockEnabled: false,
};

const SETTINGS_STORAGE_KEY = '@oncallshift_settings';

export default function SettingsScreen() {
  const theme = useTheme();
  const { colors } = useAppTheme();
  const themedStyles = styles(colors);
  const { showSuccess, showError } = useToast();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // AI Diagnosis credential state
  const [aiCredentialStatus, setAiCredentialStatus] = useState<apiService.AnthropicCredentialStatus | null>(null);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [credentialInput, setCredentialInput] = useState('');
  const [savingCredential, setSavingCredential] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Alert sound state
  const [showSoundPickerModal, setShowSoundPickerModal] = useState(false);
  const [selectedAlertSound, setSelectedAlertSound] = useState<AlertSoundType>('urgent');
  const [previewingSound, setPreviewingSound] = useState<AlertSoundType | null>(null);

  // User profile state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Push notification debug state
  const [pushDebugInfo, setPushDebugInfo] = useState<{
    token: string | null;
    tokenError: string | null;
    deviceRegistered: boolean;
    checking: boolean;
  }>({ token: null, tokenError: null, deviceRegistered: false, checking: false });

  // Dynamic styles based on current theme
  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    settingCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      overflow: 'hidden' as const,
    },
    headerTitle: {
      color: theme.colors.onSurface,
      fontWeight: 'bold' as const,
    },
    headerSubtitle: {
      color: theme.colors.onSurfaceVariant,
      marginTop: 4,
    },
    sectionTitle: {
      color: theme.colors.onSurface,
      fontWeight: '600' as const,
    },
    modalContainer: {
      backgroundColor: theme.colors.surface,
      padding: 24,
      margin: 20,
      borderRadius: 12,
    },
    credentialInput: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.colors.onSurface,
    },
  };

  // Load settings from storage
  useEffect(() => {
    loadSettings();
    loadCredentialStatus();
    loadUserProfile();
    // Load saved alert sound preference
    setSelectedAlertSound(getAlertSound());
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await apiService.getUserProfile();
      setUserProfile({
        id: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        profilePictureUrl: profile.profilePictureUrl || null,
      });
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const handleProfilePictureUpdate = (newUrl: string | null) => {
    setUserProfile(prev => prev ? { ...prev, profilePictureUrl: newUrl } : null);
  };

  const loadCredentialStatus = async () => {
    try {
      const status = await apiService.getAnthropicCredentialStatus();
      setAiCredentialStatus(status);
    } catch (error) {
      console.error('Failed to load credential status:', error);
    }
  };

  const handleSaveCredential = async () => {
    if (!credentialInput.trim()) {
      showError('Please enter a credential');
      return;
    }

    if (!credentialInput.startsWith('sk-ant-')) {
      showError('Invalid credential format. Must start with sk-ant-');
      return;
    }

    try {
      setSavingCredential(true);
      const result = await apiService.saveAnthropicCredential(credentialInput.trim());

      // Also store locally for direct Anthropic API calls (AI Chat)
      await AsyncStorage.setItem('anthropic-api-key', credentialInput.trim());

      setAiCredentialStatus({
        configured: true,
        type: result.credential.type,
        hint: result.credential.hint,
        hasRefreshToken: result.credential.hasRefreshToken,
        updatedAt: result.credential.updatedAt,
      });
      setCredentialInput('');
      setShowCredentialModal(false);
      showSuccess('Credentials saved successfully');
      await hapticService.success();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to save credentials';
      showError(message);
      await hapticService.error();
    } finally {
      setSavingCredential(false);
    }
  };

  const handleRemoveCredential = async () => {
    Alert.alert(
      'Remove Credentials',
      'Are you sure you want to remove your Anthropic credentials? AI Diagnosis will only work if your organization has configured a shared key.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.removeAnthropicCredential();
              // Also remove local key
              await AsyncStorage.removeItem('anthropic-api-key');
              setAiCredentialStatus({ configured: false });
              showSuccess('Credentials removed');
              await hapticService.success();
            } catch (error) {
              showError('Failed to remove credentials');
              await hapticService.error();
            }
          },
        },
      ]
    );
  };

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPushNotificationStatus = async () => {
    setPushDebugInfo(prev => ({ ...prev, checking: true }));
    try {
      // Try to get push token
      const token = await notificationService.registerForPushNotifications();

      if (token) {
        // Try to register with backend
        try {
          await apiService.registerDevice({
            token,
            platform: Platform.OS as 'ios' | 'android',
            appVersion: '1.0.0',
          });

          // Now fetch the debug info from the server
          try {
            const debugInfo = await apiService.getPushDebugInfo();
            const details = JSON.stringify(debugInfo, null, 2);
            Alert.alert(
              'Push Status (Server)',
              `Token: ${token.substring(0, 25)}...\n\n` +
              `Devices: ${debugInfo.devices?.length || 0}\n` +
              `Push Enabled: ${debugInfo.notificationPreferences?.push?.enabled}\n` +
              `Types: ${JSON.stringify(debugInfo.notificationPreferences?.push?.types)}\n\n` +
              `Will Work: ${JSON.stringify(debugInfo.pushWillWork)}`,
              [{ text: 'OK' }]
            );
            setPushDebugInfo({
              token: token.substring(0, 30) + '...',
              tokenError: null,
              deviceRegistered: true,
              checking: false,
            });
          } catch (debugErr) {
            // Debug endpoint might not be deployed yet
            setPushDebugInfo({
              token: token.substring(0, 30) + '...',
              tokenError: null,
              deviceRegistered: true,
              checking: false,
            });
            showSuccess('Push token registered!');
          }
        } catch (regError: any) {
          setPushDebugInfo({
            token: token.substring(0, 30) + '...',
            tokenError: `Backend registration failed: ${regError.message}`,
            deviceRegistered: false,
            checking: false,
          });
          showError(`Registration failed: ${regError.message}`);
        }
      } else {
        setPushDebugInfo({
          token: null,
          tokenError: 'No token returned. Permissions may be denied.',
          deviceRegistered: false,
          checking: false,
        });
        showError('Could not get push token');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error getting push token';
      setPushDebugInfo({
        token: null,
        tokenError: errorMsg,
        deviceRegistered: false,
        checking: false,
      });
      // Show persistent alert so user can read the full error
      Alert.alert('Push Token Error', errorMsg, [{ text: 'OK' }]);
    }
  };

  const handleCleanupDevices = async () => {
    try {
      const result = await apiService.cleanupDevices();
      if (result.removedCount > 0) {
        showSuccess(`Removed ${result.removedCount} old device(s)`);
        // Re-check push status after cleanup
        checkPushNotificationStatus();
      } else {
        Alert.alert('No Cleanup Needed', 'All registered devices are using valid Expo push tokens.');
      }
    } catch (error: any) {
      showError(`Cleanup failed: ${error.message}`);
    }
  };

  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      setSaving(true);
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
      if (newSettings.hapticFeedbackEnabled) {
        await hapticService.lightTap();
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data including offline incidents. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear specific cache keys (preserve settings)
              const keysToRemove = [
                '@oncallshift_incidents_cache',
                '@oncallshift_oncall_cache',
                '@oncallshift_services_cache',
              ];
              await AsyncStorage.multiRemove(keysToRemove);
              await hapticService.success();
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              await hapticService.error();
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'This will reset all settings to their default values. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await saveSettings(DEFAULT_SETTINGS);
            await hapticService.success();
            Alert.alert('Success', 'Settings reset to defaults');
          },
        },
      ]
    );
  };

  const handleTestCriticalAlert = async () => {
    try {
      await hapticService.warning();
      // Play the critical alert sound immediately
      await soundService.playCriticalAlert();
      // Also send a notification for testing the notification system
      await notificationService.sendCriticalTestNotification();
      showSuccess('Critical alert sound played!');
    } catch (error: any) {
      console.error('Failed to test critical alert:', error);
      showError(error.message || 'Failed to play test sound');
    }
  };

  const handleOpenNotificationSettings = async () => {
    await hapticService.lightTap();
    await notificationService.openNotificationSettings();
  };

  const handlePreviewSound = async (sound: AlertSoundType) => {
    setPreviewingSound(sound);
    await hapticService.lightTap();
    await previewAlertSound(sound);
    // Clear preview state after sound plays
    setTimeout(() => setPreviewingSound(null), 1500);
  };

  const handleSelectSound = async (sound: AlertSoundType) => {
    await setAlertSound(sound);
    setSelectedAlertSound(sound);
    await hapticService.success();
    setShowSoundPickerModal(false);
    showSuccess(`Alert sound set to ${ALERT_SOUND_OPTIONS.find(s => s.id === sound)?.name}`);
  };

  const getSelectedSoundName = () => {
    return ALERT_SOUND_OPTIONS.find(s => s.id === selectedAlertSound)?.name || 'Urgent Pulse';
  };

  if (loading) {
    return (
      <View style={[dynamicStyles.container, themedStyles.centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
          Loading settings...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={themedStyles.content}>
      {/* Header */}
      <View style={themedStyles.header}>
        <Text variant="headlineSmall" style={dynamicStyles.headerTitle}>
          Settings
        </Text>
        <Text variant="bodyMedium" style={dynamicStyles.headerSubtitle}>
          Customize your OnCallShift experience
        </Text>
      </View>

      {/* Profile Section */}
      {userProfile && (
        <View style={themedStyles.section}>
          <View style={themedStyles.sectionHeader}>
            <MaterialCommunityIcons name="account-circle-outline" size={20} color={colors.primary} />
            <Text variant="titleMedium" style={dynamicStyles.sectionTitle}>
              Profile
            </Text>
          </View>

          <View style={[dynamicStyles.settingCard, themedStyles.profileCard]}>
            <ProfilePictureEditor
              currentPictureUrl={userProfile.profilePictureUrl}
              userName={userProfile.fullName}
              userEmail={userProfile.email}
              onUpdate={handleProfilePictureUpdate}
            />
            <View style={themedStyles.profileInfo}>
              <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
                {userProfile.fullName || 'No name set'}
              </Text>
              <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
                {userProfile.email}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Notifications Section */}
      <View style={themedStyles.section}>
        <View style={themedStyles.sectionHeader}>
          <MaterialCommunityIcons name="bell-outline" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={dynamicStyles.sectionTitle}>
            Notifications
          </Text>
        </View>

        <View style={dynamicStyles.settingCard}>
          <List.Item
            title="Push Notifications"
            description="Enable or disable all push notifications"
            left={props => <List.Icon {...props} icon="bell" color={colors.textSecondary} />}
            right={() => (
              <Switch
                value={settings.pushNotificationsEnabled}
                onValueChange={(value) => updateSetting('pushNotificationsEnabled', value)}
                color={colors.primary}
              />
            )}
          />
          <Divider />

          <List.Item
            title="Active Incidents"
            description="Notify when new incidents are created"
            left={props => <List.Icon {...props} icon="alert-circle" color={colors.error} />}
            right={() => (
              <Switch
                value={settings.notifyOnTriggered}
                onValueChange={(value) => updateSetting('notifyOnTriggered', value)}
                disabled={!settings.pushNotificationsEnabled}
                color={colors.primary}
              />
            )}
          />
          <Divider />

          <List.Item
            title="Acknowledged Incidents"
            description="Notify when incidents are acknowledged"
            left={props => <List.Icon {...props} icon="check-circle" color={colors.warning} />}
            right={() => (
              <Switch
                value={settings.notifyOnAcknowledged}
                onValueChange={(value) => updateSetting('notifyOnAcknowledged', value)}
                disabled={!settings.pushNotificationsEnabled}
                color={colors.primary}
              />
            )}
          />
          <Divider />

          <List.Item
            title="Resolved Incidents"
            description="Notify when incidents are resolved"
            left={props => <List.Icon {...props} icon="check-circle-outline" color={colors.success} />}
            right={() => (
              <Switch
                value={settings.notifyOnResolved}
                onValueChange={(value) => updateSetting('notifyOnResolved', value)}
                disabled={!settings.pushNotificationsEnabled}
                color={colors.primary}
              />
            )}
          />
          <Divider />

          <List.Item
            title="Escalations"
            description="Notify when incidents are escalated to you"
            left={props => <List.Icon {...props} icon="arrow-up-bold" color={colors.accent} />}
            right={() => (
              <Switch
                value={settings.notifyOnEscalation}
                onValueChange={(value) => updateSetting('notifyOnEscalation', value)}
                disabled={!settings.pushNotificationsEnabled}
                color={colors.primary}
              />
            )}
          />
          <Divider />

          {/* Alert Sound */}
          <List.Item
            title="Alert Sound"
            description={getSelectedSoundName()}
            left={props => <List.Icon {...props} icon="music-note" color={colors.accent} />}
            onPress={() => setShowSoundPickerModal(true)}
            right={props => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          />
          <Divider />

          {/* Test Critical Alert */}
          <List.Item
            title="Test Critical Alert"
            description="Send a test notification that bypasses DND"
            left={props => <List.Icon {...props} icon="bullhorn" color={colors.error} />}
            right={() => (
              <Button
                mode="outlined"
                compact
                textColor={colors.error}
                onPress={handleTestCriticalAlert}
                disabled={!settings.pushNotificationsEnabled}
              >
                Test
              </Button>
            )}
          />
          <Divider />

          {/* Notification Settings */}
          <List.Item
            title="Notification Settings"
            description="Configure system notification permissions"
            left={props => <List.Icon {...props} icon="cog" color={colors.textSecondary} />}
            onPress={handleOpenNotificationSettings}
            right={props => <List.Icon {...props} icon="chevron-right" />}
          />
          <Divider />

          {/* Push Debug */}
          <List.Item
            title="Push Notification Status"
            description={
              pushDebugInfo.checking
                ? 'Checking...'
                : pushDebugInfo.deviceRegistered
                ? `Registered: ${pushDebugInfo.token}`
                : pushDebugInfo.tokenError || 'Tap to check status'
            }
            descriptionNumberOfLines={2}
            left={props => (
              <List.Icon
                {...props}
                icon={pushDebugInfo.deviceRegistered ? 'check-circle' : 'help-circle'}
                color={pushDebugInfo.deviceRegistered ? colors.success : colors.warning}
              />
            )}
            onPress={checkPushNotificationStatus}
            right={() =>
              pushDebugInfo.checking ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Button mode="text" compact onPress={checkPushNotificationStatus}>
                  Check
                </Button>
              )
            }
          />
          <Divider />
          <List.Item
            title="Clean Up Old Devices"
            description="Remove non-Expo device tokens that won't receive notifications"
            descriptionNumberOfLines={2}
            left={props => (
              <List.Icon {...props} icon="broom" color={colors.textSecondary} />
            )}
            onPress={handleCleanupDevices}
            right={props => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>
      </View>

      {/* Do Not Disturb Section */}
      <View style={themedStyles.section}>
        <View style={themedStyles.sectionHeader}>
          <MaterialCommunityIcons name="bell-off-outline" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={dynamicStyles.sectionTitle}>
            Do Not Disturb
          </Text>
        </View>

        <View style={dynamicStyles.settingCard}>
          <View style={themedStyles.dndContainer}>
            <DNDControls />
          </View>
        </View>

        <View style={themedStyles.dndInfo}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.textMuted} />
          <Text variant="bodySmall" style={themedStyles.dndInfoText}>
            DND temporarily silences all notifications. Critical and high severity alerts can optionally override this setting.
          </Text>
        </View>
      </View>

      {/* Appearance Section */}
      <View style={themedStyles.section}>
        <View style={themedStyles.sectionHeader}>
          <MaterialCommunityIcons name="palette-outline" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={dynamicStyles.sectionTitle}>
            Appearance
          </Text>
        </View>

        <View style={dynamicStyles.settingCard}>
          <Pressable
            style={themedStyles.themeOption}
            onPress={() => updateSetting('theme', 'system')}
          >
            <View style={themedStyles.themeOptionLeft}>
              <RadioButton
                value="system"
                status={settings.theme === 'system' ? 'checked' : 'unchecked'}
                onPress={() => updateSetting('theme', 'system')}
                color={colors.primary}
              />
              <MaterialCommunityIcons name="cellphone" size={22} color={colors.textSecondary} style={themedStyles.themeIcon} />
              <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>System Default</Text>
            </View>
          </Pressable>
          <Divider style={themedStyles.themeOptionDivider} />

          <Pressable
            style={themedStyles.themeOption}
            onPress={() => updateSetting('theme', 'light')}
          >
            <View style={themedStyles.themeOptionLeft}>
              <RadioButton
                value="light"
                status={settings.theme === 'light' ? 'checked' : 'unchecked'}
                onPress={() => updateSetting('theme', 'light')}
                color={colors.primary}
              />
              <MaterialCommunityIcons name="white-balance-sunny" size={22} color={colors.warning} style={themedStyles.themeIcon} />
              <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>Light</Text>
            </View>
          </Pressable>
          <Divider style={themedStyles.themeOptionDivider} />

          <Pressable
            style={themedStyles.themeOption}
            onPress={() => updateSetting('theme', 'dark')}
          >
            <View style={themedStyles.themeOptionLeft}>
              <RadioButton
                value="dark"
                status={settings.theme === 'dark' ? 'checked' : 'unchecked'}
                onPress={() => updateSetting('theme', 'dark')}
                color={colors.primary}
              />
              <MaterialCommunityIcons name="moon-waning-crescent" size={22} color={colors.textSecondary} style={themedStyles.themeIcon} />
              <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>Dark</Text>
            </View>
          </Pressable>
          <Divider />

          <List.Item
            title="Compact Mode"
            description="Show more items with less spacing"
            left={props => <List.Icon {...props} icon="view-compact" color={colors.textSecondary} />}
            right={() => (
              <Switch
                value={settings.compactMode}
                onValueChange={(value) => updateSetting('compactMode', value)}
                color={colors.primary}
              />
            )}
          />
        </View>
      </View>

      {/* Behavior Section */}
      <View style={themedStyles.section}>
        <View style={themedStyles.sectionHeader}>
          <MaterialCommunityIcons name="tune-vertical" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={dynamicStyles.sectionTitle}>
            Behavior
          </Text>
        </View>

        <View style={dynamicStyles.settingCard}>
          <List.Item
            title="Haptic Feedback"
            description="Vibrate on actions and gestures"
            left={props => <List.Icon {...props} icon="vibrate" color={colors.textSecondary} />}
            right={() => (
              <Switch
                value={settings.hapticFeedbackEnabled}
                onValueChange={(value) => updateSetting('hapticFeedbackEnabled', value)}
                color={colors.primary}
              />
            )}
          />
          <Divider />

          <List.Item
            title="Confirm Actions"
            description="Ask for confirmation before acknowledge/resolve"
            left={props => <List.Icon {...props} icon="help-circle-outline" color={colors.textSecondary} />}
            right={() => (
              <Switch
                value={settings.confirmBeforeActions}
                onValueChange={(value) => updateSetting('confirmBeforeActions', value)}
                color={colors.primary}
              />
            )}
          />
          <Divider />

          <List.Item
            title="Auto-Refresh"
            description="Automatically refresh incident list"
            left={props => <List.Icon {...props} icon="refresh-auto" color={colors.textSecondary} />}
            right={() => (
              <Switch
                value={settings.autoRefreshEnabled}
                onValueChange={(value) => updateSetting('autoRefreshEnabled', value)}
                color={colors.primary}
              />
            )}
          />
        </View>
      </View>

      {/* Security Section */}
      <View style={themedStyles.section}>
        <View style={themedStyles.sectionHeader}>
          <MaterialCommunityIcons name="shield-outline" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={dynamicStyles.sectionTitle}>
            Security
          </Text>
        </View>

        <View style={dynamicStyles.settingCard}>
          <List.Item
            title="Biometric Lock"
            description="Require fingerprint or face to open app"
            left={props => <List.Icon {...props} icon="fingerprint" color={colors.textSecondary} />}
            right={() => (
              <Switch
                value={settings.biometricLockEnabled}
                onValueChange={(value) => updateSetting('biometricLockEnabled', value)}
                color={colors.primary}
              />
            )}
          />
        </View>
      </View>

      {/* AI Diagnosis Section */}
      <View style={themedStyles.section}>
        <View style={themedStyles.sectionHeader}>
          <MaterialCommunityIcons name="robot-outline" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={dynamicStyles.sectionTitle}>
            AI Diagnosis
          </Text>
        </View>

        <View style={dynamicStyles.settingCard}>
          <List.Item
            title="Anthropic Credentials"
            description={
              aiCredentialStatus?.configured
                ? `${aiCredentialStatus.type === 'oauth' ? 'OAuth Token' : 'API Key'}: ${aiCredentialStatus.hint}`
                : 'Not configured'
            }
            left={props => (
              <List.Icon
                {...props}
                icon={aiCredentialStatus?.configured ? 'check-circle' : 'key-variant'}
                color={aiCredentialStatus?.configured ? colors.success : colors.textSecondary}
              />
            )}
            onPress={() => setShowCredentialModal(true)}
            right={props => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          />
          <Divider />

          {aiCredentialStatus?.configured && (
            <>
              <List.Item
                title="Remove Credentials"
                description="Delete your stored Anthropic credentials"
                left={props => <List.Icon {...props} icon="delete-outline" color={colors.error} />}
                onPress={handleRemoveCredential}
                right={props => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
              />
              <Divider />
            </>
          )}

          <List.Item
            title="Setup Guide"
            description="Learn how to get your API key or use Claude Pro"
            left={props => <List.Icon {...props} icon="help-circle-outline" color={colors.textSecondary} />}
            onPress={() => setShowHelpModal(true)}
            right={props => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          />
        </View>

        {!aiCredentialStatus?.configured && (
          <View style={themedStyles.aiCredentialInfo}>
            <MaterialCommunityIcons name="information-outline" size={16} color={colors.warning} />
            <Text variant="bodySmall" style={themedStyles.aiCredentialInfoText}>
              Configure your Anthropic credentials to enable AI-powered incident diagnosis
            </Text>
          </View>
        )}
      </View>

      {/* Data Management Section */}
      <View style={themedStyles.section}>
        <View style={themedStyles.sectionHeader}>
          <MaterialCommunityIcons name="database-outline" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={dynamicStyles.sectionTitle}>
            Data Management
          </Text>
        </View>

        <View style={dynamicStyles.settingCard}>
          <List.Item
            title="Clear Cache"
            description="Remove cached data to free up space"
            left={props => <List.Icon {...props} icon="cached" color={colors.textSecondary} />}
            onPress={handleClearCache}
            right={props => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          />
          <Divider />

          <List.Item
            title="Reset Settings"
            description="Restore all settings to defaults"
            left={props => <List.Icon {...props} icon="restore" color={colors.error} />}
            onPress={handleResetSettings}
            right={props => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          />
        </View>
      </View>

      {/* App Info */}
      <View style={themedStyles.appInfo}>
        <Text variant="bodySmall" style={themedStyles.appInfoText}>
          OnCallShift Mobile v1.0.0
        </Text>
        <Text variant="bodySmall" style={themedStyles.appInfoText}>
          Built with React Native & Expo
        </Text>
      </View>

      {saving && (
        <View style={themedStyles.savingIndicator}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text variant="bodySmall" style={themedStyles.savingText}>Saving...</Text>
        </View>
      )}

      {/* Credential Input Modal */}
      <Portal>
        <Modal
          visible={showCredentialModal}
          onDismiss={() => {
            setShowCredentialModal(false);
            setCredentialInput('');
          }}
          contentContainerStyle={dynamicStyles.modalContainer}
        >
          <Text variant="titleLarge" style={themedStyles.modalTitle}>
            Add Anthropic Credentials
          </Text>
          <Text variant="bodyMedium" style={themedStyles.modalSubtitle}>
            Enter your API key or OAuth token from Claude Code
          </Text>

          <TextInput
            style={dynamicStyles.credentialInput}
            placeholder="sk-ant-..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={credentialInput}
            onChangeText={setCredentialInput}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={true}
          />

          <View style={themedStyles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowCredentialModal(false);
                setCredentialInput('');
              }}
              style={themedStyles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveCredential}
              loading={savingCredential}
              disabled={savingCredential || !credentialInput.trim()}
              style={themedStyles.modalButton}
            >
              Save
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Sound Picker Modal */}
      <Portal>
        <Modal
          visible={showSoundPickerModal}
          onDismiss={() => setShowSoundPickerModal(false)}
          contentContainerStyle={themedStyles.soundPickerModalContainer}
        >
          <Text variant="titleLarge" style={themedStyles.modalTitle}>
            Select Alert Sound
          </Text>
          <Text variant="bodyMedium" style={themedStyles.modalSubtitle}>
            Choose a sound for critical alerts
          </Text>

          <ScrollView style={themedStyles.soundList}>
            {ALERT_SOUND_OPTIONS.map((sound) => (
              <Pressable
                key={sound.id}
                style={[
                  themedStyles.soundOption,
                  selectedAlertSound === sound.id && themedStyles.soundOptionSelected
                ]}
                onPress={() => handleSelectSound(sound.id)}
              >
                <View style={themedStyles.soundOptionLeft}>
                  <RadioButton
                    value={sound.id}
                    status={selectedAlertSound === sound.id ? 'checked' : 'unchecked'}
                    onPress={() => handleSelectSound(sound.id)}
                    color={colors.primary}
                  />
                  <View style={themedStyles.soundOptionInfo}>
                    <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>
                      {sound.name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                      {sound.description}
                    </Text>
                  </View>
                </View>
                <Button
                  mode="text"
                  compact
                  icon={previewingSound === sound.id ? 'volume-high' : 'play'}
                  textColor={colors.accent}
                  onPress={() => handlePreviewSound(sound.id)}
                  loading={previewingSound === sound.id}
                >
                  {previewingSound === sound.id ? '' : 'Play'}
                </Button>
              </Pressable>
            ))}
          </ScrollView>

          <Button
            mode="outlined"
            onPress={() => setShowSoundPickerModal(false)}
            style={themedStyles.soundPickerCloseButton}
          >
            Cancel
          </Button>
        </Modal>
      </Portal>

      {/* Help Modal */}
      <Portal>
        <Modal
          visible={showHelpModal}
          onDismiss={() => setShowHelpModal(false)}
          contentContainerStyle={themedStyles.helpModalContainer}
        >
          <ScrollView>
            <Text variant="titleLarge" style={themedStyles.modalTitle}>
              How to Enable AI Diagnosis
            </Text>

            <View style={themedStyles.helpSection}>
              <Text variant="titleMedium" style={themedStyles.helpSectionTitle}>
                Option 1: Anthropic API Key
              </Text>
              <Text variant="bodyMedium" style={themedStyles.helpText}>
                Pay-per-use API access. Best for organizations.
              </Text>
              <View style={themedStyles.helpSteps}>
                <Text style={themedStyles.helpStep}>1. Go to console.anthropic.com</Text>
                <Text style={themedStyles.helpStep}>2. Sign up or log in</Text>
                <Text style={themedStyles.helpStep}>3. Navigate to API Keys</Text>
                <Text style={themedStyles.helpStep}>4. Create a new key and copy it</Text>
                <Text style={themedStyles.helpStep}>5. Paste it above</Text>
              </View>
              <Button
                mode="outlined"
                icon="open-in-new"
                onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}
                style={themedStyles.helpLink}
              >
                Open Anthropic Console
              </Button>
            </View>

            <Divider style={themedStyles.helpDivider} />

            <View style={themedStyles.helpSection}>
              <Text variant="titleMedium" style={themedStyles.helpSectionTitle}>
                Option 2: Claude Pro/Max Subscription
              </Text>
              <Text variant="bodyMedium" style={themedStyles.helpText}>
                Use your existing Claude subscription. Requires Claude Code.
              </Text>
              <View style={themedStyles.helpSteps}>
                <Text style={themedStyles.helpStep}>1. Install Claude Code:</Text>
                <Text style={themedStyles.helpCode}>npm install -g @anthropic-ai/claude-code</Text>
                <Text style={themedStyles.helpStep}>2. Run `claude` and type `/login`</Text>
                <Text style={themedStyles.helpStep}>3. Select "Claude app" and complete login</Text>
                <Text style={themedStyles.helpStep}>4. Get your token:</Text>
                <Text style={themedStyles.helpCode}>claude config get oauthAccessToken</Text>
                <Text style={themedStyles.helpStep}>5. Copy and paste the token above</Text>
              </View>
              <Text variant="bodySmall" style={themedStyles.helpNote}>
                Note: OAuth tokens expire every 8 hours but we'll refresh them automatically.
              </Text>
            </View>

            <Button
              mode="contained"
              onPress={() => setShowHelpModal(false)}
              style={themedStyles.helpCloseButton}
            >
              Got it
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const styles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.textSecondary,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  settingCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  themeOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  themeOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeIcon: {
    marginRight: 12,
  },
  themeOptionDivider: {
    marginLeft: 56,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  appInfoText: {
    color: colors.textMuted,
    marginBottom: 4,
  },
  savingIndicator: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  savingText: {
    color: colors.textSecondary,
  },
  // Quiet Hours styles
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  timePickerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  timeValue: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  // DND styles
  dndContainer: {
    padding: 16,
  },
  dndInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    marginTop: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
  },
  dndInfoText: {
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  // AI Credentials styles
  aiCredentialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  aiCredentialInfoText: {
    color: colors.textSecondary,
    flex: 1,
  },
  // Modal styles
  modalContainer: {
    backgroundColor: colors.surface,
    padding: 24,
    margin: 20,
    borderRadius: 12,
  },
  modalTitle: {
    color: colors.textPrimary,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    color: colors.textSecondary,
    marginBottom: 20,
  },
  credentialInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    minWidth: 100,
  },
  // Help Modal styles
  helpModalContainer: {
    backgroundColor: colors.surface,
    padding: 24,
    margin: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  helpSection: {
    marginBottom: 20,
  },
  helpSectionTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpText: {
    color: colors.textSecondary,
    marginBottom: 12,
  },
  helpSteps: {
    marginLeft: 8,
    marginBottom: 12,
  },
  helpStep: {
    color: colors.textPrimary,
    marginBottom: 4,
    fontSize: 14,
  },
  helpCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: colors.background,
    color: colors.accent,
    padding: 8,
    borderRadius: 4,
    fontSize: 12,
    marginVertical: 4,
    marginLeft: 16,
    overflow: 'hidden',
  },
  helpLink: {
    marginTop: 8,
  },
  helpDivider: {
    marginVertical: 16,
  },
  helpNote: {
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  helpCloseButton: {
    marginTop: 16,
  },
  // Sound Picker Modal styles
  soundPickerModalContainer: {
    backgroundColor: colors.surface,
    padding: 24,
    margin: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  soundList: {
    marginVertical: 16,
    maxHeight: 400,
  },
  soundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  soundOptionSelected: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  soundOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  soundOptionInfo: {
    flex: 1,
    marginLeft: 4,
  },
  soundPickerCloseButton: {
    marginTop: 8,
  },
  // Profile section styles
  profileCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: 12,
  },
});
