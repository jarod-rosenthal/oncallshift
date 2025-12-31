import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import {
  Text,
  Switch,
  Button,
  Portal,
  Modal,
  RadioButton,
  Divider,
  IconButton,
  Chip,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import * as hapticService from '../services/hapticService';

const DND_STORAGE_KEY = '@oncallshift/dnd_settings';

export interface DNDSettings {
  enabled: boolean;
  until: string | null; // ISO date string
  allowCritical: boolean;
  allowHighUrgency: boolean;
  mutedServiceIds: string[];
}

export const defaultDNDSettings: DNDSettings = {
  enabled: false,
  until: null,
  allowCritical: true,
  allowHighUrgency: false,
  mutedServiceIds: [],
};

interface DNDControlsProps {
  onSettingsChange?: (settings: DNDSettings) => void;
  compact?: boolean;
}

const DURATION_OPTIONS = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: 'Until tomorrow 9 AM', minutes: -1 }, // Special case
  { label: 'Indefinitely', minutes: 0 },
];

export function DNDControls({ onSettingsChange, compact = false }: DNDControlsProps) {
  const { colors: themeColors } = useAppTheme();
  const [settings, setSettings] = useState<DNDSettings>(defaultDNDSettings);
  const [showModal, setShowModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    // Check if DND has expired
    if (settings.enabled && settings.until) {
      const untilDate = new Date(settings.until);
      if (untilDate < new Date()) {
        // DND expired, disable it
        updateSettings({ ...settings, enabled: false, until: null });
      }
    }
  }, [settings]);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(DND_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings(parsed);
      }
    } catch (error) {
      console.error('Failed to load DND settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: DNDSettings) => {
    try {
      await AsyncStorage.setItem(DND_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save DND settings:', error);
    }
  };

  const updateSettings = (newSettings: DNDSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    onSettingsChange?.(newSettings);
  };

  const calculateUntilTime = (minutes: number): string | null => {
    if (minutes === 0) return null; // Indefinitely
    if (minutes === -1) {
      // Until tomorrow 9 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow.toISOString();
    }
    const until = new Date();
    until.setMinutes(until.getMinutes() + minutes);
    return until.toISOString();
  };

  const handleEnableDND = async () => {
    await hapticService.mediumTap();
    setShowModal(true);
  };

  const handleConfirmDND = async () => {
    await hapticService.success();
    const until = calculateUntilTime(selectedDuration);
    updateSettings({
      ...settings,
      enabled: true,
      until,
    });
    setShowModal(false);
  };

  const handleDisableDND = async () => {
    await hapticService.mediumTap();
    updateSettings({
      ...settings,
      enabled: false,
      until: null,
    });
  };

  const formatTimeRemaining = (): string => {
    if (!settings.until) return 'Indefinitely';

    const until = new Date(settings.until);
    const now = new Date();
    const diffMs = until.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      return `Until ${until.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  if (loading) return null;

  // Compact mode for quick toggle in header/settings
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactRow}>
          <MaterialCommunityIcons
            name={settings.enabled ? 'bell-off' : 'bell'}
            size={20}
            color={settings.enabled ? colors.warning : colors.textSecondary}
          />
          <Text style={[styles.compactLabel, settings.enabled && styles.compactLabelActive]}>
            {settings.enabled ? 'DND On' : 'DND Off'}
          </Text>
        </View>
        <Switch
          value={settings.enabled}
          onValueChange={(value) => {
            if (value) {
              handleEnableDND();
            } else {
              handleDisableDND();
            }
          }}
          color={colors.warning}
        />

        <Portal>
          <Modal
            visible={showModal}
            onDismiss={() => setShowModal(false)}
            contentContainerStyle={[styles.modal, { backgroundColor: themeColors.surface }]}
          >
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="bell-off" size={32} color={colors.warning} />
              <Text variant="titleLarge" style={styles.modalTitle}>Enable Do Not Disturb</Text>
            </View>

            <Text variant="bodyMedium" style={styles.modalDescription}>
              Silence notifications for a period of time. Critical alerts can still break through if enabled.
            </Text>

            <Divider style={styles.modalDivider} />

            <Text variant="labelLarge" style={styles.sectionLabel}>Duration</Text>
            <RadioButton.Group
              onValueChange={(value) => setSelectedDuration(parseInt(value))}
              value={selectedDuration.toString()}
            >
              {DURATION_OPTIONS.map((option) => (
                <Pressable
                  key={option.minutes}
                  style={styles.radioRow}
                  onPress={() => setSelectedDuration(option.minutes)}
                >
                  <RadioButton.Android value={option.minutes.toString()} color={colors.warning} />
                  <Text style={styles.radioLabel}>{option.label}</Text>
                </Pressable>
              ))}
            </RadioButton.Group>

            <Divider style={styles.modalDivider} />

            <View style={styles.overrideSection}>
              <View style={styles.overrideRow}>
                <View style={styles.overrideInfo}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color={colors.error} />
                  <Text style={styles.overrideLabel}>Allow Critical Alerts</Text>
                </View>
                <Switch
                  value={settings.allowCritical}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, allowCritical: value }))}
                  color={colors.error}
                />
              </View>
              <View style={styles.overrideRow}>
                <View style={styles.overrideInfo}>
                  <MaterialCommunityIcons name="alert" size={20} color={colors.warning} />
                  <Text style={styles.overrideLabel}>Allow High Urgency</Text>
                </View>
                <Switch
                  value={settings.allowHighUrgency}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, allowHighUrgency: value }))}
                  color={colors.warning}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowModal(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleConfirmDND}
                buttonColor={colors.warning}
                style={styles.modalButton}
              >
                Enable DND
              </Button>
            </View>
          </Modal>
        </Portal>
      </View>
    );
  }

  // Full card mode for settings screen
  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name={settings.enabled ? 'bell-off' : 'bell-ring-outline'}
            size={28}
            color={settings.enabled ? colors.warning : colors.textSecondary}
          />
          <View style={styles.headerText}>
            <Text variant="titleMedium" style={styles.title}>
              Do Not Disturb
            </Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              {settings.enabled
                ? formatTimeRemaining()
                : 'Silence notifications temporarily'}
            </Text>
          </View>
        </View>
        <Switch
          value={settings.enabled}
          onValueChange={(value) => {
            if (value) {
              handleEnableDND();
            } else {
              handleDisableDND();
            }
          }}
          color={colors.warning}
        />
      </View>

      {settings.enabled && (
        <>
          <Divider style={styles.divider} />
          <View style={styles.activeInfo}>
            <View style={styles.activeRow}>
              <Chip
                icon="bell-off"
                style={[styles.activeChip, { backgroundColor: colors.warningLight }]}
                textStyle={{ color: colors.warning }}
              >
                DND Active
              </Chip>
              {settings.allowCritical && (
                <Chip
                  icon="alert-circle"
                  style={[styles.activeChip, { backgroundColor: colors.errorLight }]}
                  textStyle={{ color: colors.error }}
                >
                  Critical allowed
                </Chip>
              )}
            </View>
            <Button
              mode="text"
              onPress={handleDisableDND}
              textColor={colors.warning}
              compact
            >
              Turn Off
            </Button>
          </View>
        </>
      )}

      <Portal>
        <Modal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: themeColors.surface }]}
        >
          <View style={styles.modalHeader}>
            <MaterialCommunityIcons name="bell-off" size={32} color={colors.warning} />
            <Text variant="titleLarge" style={styles.modalTitle}>Enable Do Not Disturb</Text>
          </View>

          <Text variant="bodyMedium" style={styles.modalDescription}>
            Silence notifications for a period of time. Critical alerts can still break through if enabled.
          </Text>

          <Divider style={styles.modalDivider} />

          <Text variant="labelLarge" style={styles.sectionLabel}>Duration</Text>
          <RadioButton.Group
            onValueChange={(value) => setSelectedDuration(parseInt(value))}
            value={selectedDuration.toString()}
          >
            {DURATION_OPTIONS.map((option) => (
              <Pressable
                key={option.minutes}
                style={styles.radioRow}
                onPress={() => setSelectedDuration(option.minutes)}
              >
                <RadioButton.Android value={option.minutes.toString()} color={colors.warning} />
                <Text style={styles.radioLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </RadioButton.Group>

          <Divider style={styles.modalDivider} />

          <View style={styles.overrideSection}>
            <View style={styles.overrideRow}>
              <View style={styles.overrideInfo}>
                <MaterialCommunityIcons name="alert-circle" size={20} color={colors.error} />
                <Text style={styles.overrideLabel}>Allow Critical Alerts</Text>
              </View>
              <Switch
                value={settings.allowCritical}
                onValueChange={(value) => setSettings(prev => ({ ...prev, allowCritical: value }))}
                color={colors.error}
              />
            </View>
            <View style={styles.overrideRow}>
              <View style={styles.overrideInfo}>
                <MaterialCommunityIcons name="alert" size={20} color={colors.warning} />
                <Text style={styles.overrideLabel}>Allow High Urgency</Text>
              </View>
              <Switch
                value={settings.allowHighUrgency}
                onValueChange={(value) => setSettings(prev => ({ ...prev, allowHighUrgency: value }))}
                color={colors.warning}
              />
            </View>
          </View>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowModal(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirmDND}
              buttonColor={colors.warning}
              style={styles.modalButton}
            >
              Enable DND
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

// Hook to check DND status
export function useDNDStatus(): DNDSettings {
  const [settings, setSettings] = useState<DNDSettings>(defaultDNDSettings);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem(DND_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Check if expired
          if (parsed.enabled && parsed.until) {
            const untilDate = new Date(parsed.until);
            if (untilDate < new Date()) {
              parsed.enabled = false;
              parsed.until = null;
              await AsyncStorage.setItem(DND_STORAGE_KEY, JSON.stringify(parsed));
            }
          }
          setSettings(parsed);
        }
      } catch (error) {
        console.error('Failed to load DND settings:', error);
      }
    };

    loadSettings();
  }, []);

  return settings;
}

// Helper to check if notification should be shown based on DND settings
export function shouldShowNotification(
  settings: DNDSettings,
  severity: string,
  urgency?: string
): boolean {
  if (!settings.enabled) return true;

  // Check if DND expired
  if (settings.until) {
    const untilDate = new Date(settings.until);
    if (untilDate < new Date()) return true;
  }

  // Allow critical if enabled
  if (settings.allowCritical && severity === 'critical') return true;

  // Allow high urgency if enabled
  if (settings.allowHighUrgency && (urgency === 'high' || severity === 'high')) return true;

  return false;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    marginVertical: 16,
  },
  activeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  activeChip: {
    height: 28,
  },
  // Compact mode
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  compactLabelActive: {
    color: colors.warning,
    fontWeight: '600',
  },
  // Modal
  modal: {
    margin: 20,
    borderRadius: 16,
    padding: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 12,
  },
  modalDescription: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalDivider: {
    marginVertical: 16,
  },
  sectionLabel: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 8,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  radioLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  overrideSection: {
    gap: 12,
  },
  overrideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overrideInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overrideLabel: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
  },
});

export default DNDControls;
