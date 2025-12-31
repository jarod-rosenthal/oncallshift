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
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';
import * as hapticService from '../services/hapticService';
import * as apiService from '../services/apiService';
import { useToast, DNDControls, useDNDStatus } from '../components';
import type { DNDSettings } from '../components';

// Settings interface
interface AppSettings {
  // Notifications
  pushNotificationsEnabled: boolean;
  notifyOnTriggered: boolean;
  notifyOnAcknowledged: boolean;
  notifyOnResolved: boolean;
  notifyOnEscalation: boolean;
  // Quiet Hours
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm format
  quietHoursEnd: string; // HH:mm format
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
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
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
  const { showSuccess, showError } = useToast();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // AI Diagnosis credential state
  const [aiCredentialStatus, setAiCredentialStatus] = useState<apiService.AnthropicCredentialStatus | null>(null);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [credentialInput, setCredentialInput] = useState('');
  const [savingCredential, setSavingCredential] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

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
  }, []);

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

  // Time formatting helpers
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const timeStringToDate = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date;
  };

  const dateToTimeString = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Update quiet hours on server
  const updateQuietHoursOnServer = async (enabled: boolean, start: string, end: string) => {
    try {
      await apiService.updateUserProfile({
        notificationPreferences: {
          quietHoursStart: enabled ? start : undefined,
          quietHoursEnd: enabled ? end : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to sync quiet hours to server:', error);
      // Don't show error - local settings still saved
    }
  };

  const handleQuietHoursToggle = async (enabled: boolean) => {
    const newSettings = { ...settings, quietHoursEnabled: enabled };
    await saveSettings(newSettings);
    await updateQuietHoursOnServer(enabled, settings.quietHoursStart, settings.quietHoursEnd);
  };

  const handleStartTimeChange = async (_: any, selectedDate?: Date) => {
    setShowStartTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const timeStr = dateToTimeString(selectedDate);
      const newSettings = { ...settings, quietHoursStart: timeStr };
      await saveSettings(newSettings);
      if (settings.quietHoursEnabled) {
        await updateQuietHoursOnServer(true, timeStr, settings.quietHoursEnd);
      }
    }
  };

  const handleEndTimeChange = async (_: any, selectedDate?: Date) => {
    setShowEndTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const timeStr = dateToTimeString(selectedDate);
      const newSettings = { ...settings, quietHoursEnd: timeStr };
      await saveSettings(newSettings);
      if (settings.quietHoursEnabled) {
        await updateQuietHoursOnServer(true, settings.quietHoursStart, timeStr);
      }
    }
  };

  if (loading) {
    return (
      <View style={[dynamicStyles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
          Loading settings...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={dynamicStyles.headerTitle}>
          Settings
        </Text>
        <Text variant="bodyMedium" style={dynamicStyles.headerSubtitle}>
          Customize your OnCallShift experience
        </Text>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
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
            title="Triggered Incidents"
            description="Notify when new incidents are triggered"
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
        </View>
      </View>

      {/* Quiet Hours Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="moon-waning-crescent" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={dynamicStyles.sectionTitle}>
            Quiet Hours
          </Text>
        </View>

        <View style={dynamicStyles.settingCard}>
          <List.Item
            title="Enable Quiet Hours"
            description="Silence notifications during set hours"
            left={props => <List.Icon {...props} icon="bell-sleep" color={colors.textSecondary} />}
            right={() => (
              <Switch
                value={settings.quietHoursEnabled}
                onValueChange={handleQuietHoursToggle}
                disabled={!settings.pushNotificationsEnabled}
                color={colors.primary}
              />
            )}
          />
          <Divider />

          <Pressable
            style={styles.timePickerRow}
            onPress={() => settings.quietHoursEnabled && setShowStartTimePicker(true)}
            disabled={!settings.quietHoursEnabled}
          >
            <View style={styles.timePickerLabel}>
              <MaterialCommunityIcons
                name="weather-night"
                size={24}
                color={settings.quietHoursEnabled ? colors.textSecondary : colors.textMuted}
              />
              <View>
                <Text
                  variant="bodyLarge"
                  style={{ color: settings.quietHoursEnabled ? colors.textPrimary : colors.textMuted }}
                >
                  Start Time
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: settings.quietHoursEnabled ? colors.textSecondary : colors.textMuted }}
                >
                  When quiet hours begin
                </Text>
              </View>
            </View>
            <View style={[styles.timeValue, { backgroundColor: settings.quietHoursEnabled ? colors.surfaceSecondary : colors.surface }]}>
              <Text
                variant="titleMedium"
                style={{ color: settings.quietHoursEnabled ? colors.textPrimary : colors.textMuted }}
              >
                {formatTime(settings.quietHoursStart)}
              </Text>
            </View>
          </Pressable>
          <Divider />

          <Pressable
            style={styles.timePickerRow}
            onPress={() => settings.quietHoursEnabled && setShowEndTimePicker(true)}
            disabled={!settings.quietHoursEnabled}
          >
            <View style={styles.timePickerLabel}>
              <MaterialCommunityIcons
                name="weather-sunny"
                size={24}
                color={settings.quietHoursEnabled ? colors.textSecondary : colors.textMuted}
              />
              <View>
                <Text
                  variant="bodyLarge"
                  style={{ color: settings.quietHoursEnabled ? colors.textPrimary : colors.textMuted }}
                >
                  End Time
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: settings.quietHoursEnabled ? colors.textSecondary : colors.textMuted }}
                >
                  When quiet hours end
                </Text>
              </View>
            </View>
            <View style={[styles.timeValue, { backgroundColor: settings.quietHoursEnabled ? colors.surfaceSecondary : colors.surface }]}>
              <Text
                variant="titleMedium"
                style={{ color: settings.quietHoursEnabled ? colors.textPrimary : colors.textMuted }}
              >
                {formatTime(settings.quietHoursEnd)}
              </Text>
            </View>
          </Pressable>

          {settings.quietHoursEnabled && (
            <View style={styles.quietHoursInfo}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.textMuted} />
              <Text variant="bodySmall" style={styles.quietHoursInfoText}>
                Notifications will be silenced from {formatTime(settings.quietHoursStart)} to {formatTime(settings.quietHoursEnd)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Do Not Disturb Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="bell-off-outline" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={dynamicStyles.sectionTitle}>
            Do Not Disturb
          </Text>
        </View>

        <View style={dynamicStyles.settingCard}>
          <View style={styles.dndContainer}>
            <DNDControls />
          </View>
        </View>

        <View style={styles.dndInfo}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.textMuted} />
          <Text variant="bodySmall" style={styles.dndInfoText}>
            DND temporarily silences all notifications. Critical and high severity alerts can optionally override this setting.
          </Text>
        </View>
      </View>

      {/* Appearance Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="palette-outline" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={dynamicStyles.sectionTitle}>
            Appearance
          </Text>
        </View>

        <View style={dynamicStyles.settingCard}>
          <Pressable
            style={styles.themeOption}
            onPress={() => updateSetting('theme', 'system')}
          >
            <View style={styles.themeOptionLeft}>
              <RadioButton
                value="system"
                status={settings.theme === 'system' ? 'checked' : 'unchecked'}
                onPress={() => updateSetting('theme', 'system')}
                color={colors.primary}
              />
              <MaterialCommunityIcons name="cellphone" size={22} color={colors.textSecondary} style={styles.themeIcon} />
              <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>System Default</Text>
            </View>
          </Pressable>
          <Divider style={styles.themeOptionDivider} />

          <Pressable
            style={styles.themeOption}
            onPress={() => updateSetting('theme', 'light')}
          >
            <View style={styles.themeOptionLeft}>
              <RadioButton
                value="light"
                status={settings.theme === 'light' ? 'checked' : 'unchecked'}
                onPress={() => updateSetting('theme', 'light')}
                color={colors.primary}
              />
              <MaterialCommunityIcons name="white-balance-sunny" size={22} color={colors.warning} style={styles.themeIcon} />
              <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>Light</Text>
            </View>
          </Pressable>
          <Divider style={styles.themeOptionDivider} />

          <Pressable
            style={styles.themeOption}
            onPress={() => updateSetting('theme', 'dark')}
          >
            <View style={styles.themeOptionLeft}>
              <RadioButton
                value="dark"
                status={settings.theme === 'dark' ? 'checked' : 'unchecked'}
                onPress={() => updateSetting('theme', 'dark')}
                color={colors.primary}
              />
              <MaterialCommunityIcons name="moon-waning-crescent" size={22} color={colors.textSecondary} style={styles.themeIcon} />
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
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
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
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
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
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
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
          <View style={styles.aiCredentialInfo}>
            <MaterialCommunityIcons name="information-outline" size={16} color={colors.warning} />
            <Text variant="bodySmall" style={styles.aiCredentialInfoText}>
              Configure your Anthropic credentials to enable AI-powered incident diagnosis
            </Text>
          </View>
        )}
      </View>

      {/* Data Management Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
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
      <View style={styles.appInfo}>
        <Text variant="bodySmall" style={styles.appInfoText}>
          OnCallShift Mobile v1.0.0
        </Text>
        <Text variant="bodySmall" style={styles.appInfoText}>
          Built with React Native & Expo
        </Text>
      </View>

      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text variant="bodySmall" style={styles.savingText}>Saving...</Text>
        </View>
      )}

      {/* Time Pickers */}
      {showStartTimePicker && (
        <DateTimePicker
          value={timeStringToDate(settings.quietHoursStart)}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartTimeChange}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={timeStringToDate(settings.quietHoursEnd)}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndTimeChange}
        />
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
          <Text variant="titleLarge" style={styles.modalTitle}>
            Add Anthropic Credentials
          </Text>
          <Text variant="bodyMedium" style={styles.modalSubtitle}>
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

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowCredentialModal(false);
                setCredentialInput('');
              }}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveCredential}
              loading={savingCredential}
              disabled={savingCredential || !credentialInput.trim()}
              style={styles.modalButton}
            >
              Save
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Help Modal */}
      <Portal>
        <Modal
          visible={showHelpModal}
          onDismiss={() => setShowHelpModal(false)}
          contentContainerStyle={styles.helpModalContainer}
        >
          <ScrollView>
            <Text variant="titleLarge" style={styles.modalTitle}>
              How to Enable AI Diagnosis
            </Text>

            <View style={styles.helpSection}>
              <Text variant="titleMedium" style={styles.helpSectionTitle}>
                Option 1: Anthropic API Key
              </Text>
              <Text variant="bodyMedium" style={styles.helpText}>
                Pay-per-use API access. Best for organizations.
              </Text>
              <View style={styles.helpSteps}>
                <Text style={styles.helpStep}>1. Go to console.anthropic.com</Text>
                <Text style={styles.helpStep}>2. Sign up or log in</Text>
                <Text style={styles.helpStep}>3. Navigate to API Keys</Text>
                <Text style={styles.helpStep}>4. Create a new key and copy it</Text>
                <Text style={styles.helpStep}>5. Paste it above</Text>
              </View>
              <Button
                mode="outlined"
                icon="open-in-new"
                onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}
                style={styles.helpLink}
              >
                Open Anthropic Console
              </Button>
            </View>

            <Divider style={styles.helpDivider} />

            <View style={styles.helpSection}>
              <Text variant="titleMedium" style={styles.helpSectionTitle}>
                Option 2: Claude Pro/Max Subscription
              </Text>
              <Text variant="bodyMedium" style={styles.helpText}>
                Use your existing Claude subscription. Requires Claude Code.
              </Text>
              <View style={styles.helpSteps}>
                <Text style={styles.helpStep}>1. Install Claude Code:</Text>
                <Text style={styles.helpCode}>npm install -g @anthropic-ai/claude-code</Text>
                <Text style={styles.helpStep}>2. Run `claude` and type `/login`</Text>
                <Text style={styles.helpStep}>3. Select "Claude app" and complete login</Text>
                <Text style={styles.helpStep}>4. Get your token:</Text>
                <Text style={styles.helpCode}>claude config get oauthAccessToken</Text>
                <Text style={styles.helpStep}>5. Copy and paste the token above</Text>
              </View>
              <Text variant="bodySmall" style={styles.helpNote}>
                Note: OAuth tokens expire every 8 hours but we'll refresh them automatically.
              </Text>
            </View>

            <Button
              mode="contained"
              onPress={() => setShowHelpModal(false)}
              style={styles.helpCloseButton}
            >
              Got it
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  quietHoursInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
  },
  quietHoursInfoText: {
    color: colors.textMuted,
    flex: 1,
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
});
