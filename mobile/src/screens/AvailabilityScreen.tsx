import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
} from 'react-native';
import {
  Text,
  Card,
  Switch,
  Button,
  ActivityIndicator,
  Portal,
  Modal,
  TextInput,
  Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as apiService from '../services/apiService';
import type { UserAvailability } from '../services/apiService';
import { useAppTheme } from '../context/ThemeContext';
import { useToast } from '../components';
import * as hapticService from '../services/hapticService';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
];

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (AZ)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

const DEFAULT_AVAILABILITY: UserAvailability = {
  timezone: 'America/New_York',
  weeklyHours: {
    monday: { available: true, start: '09:00', end: '17:00' },
    tuesday: { available: true, start: '09:00', end: '17:00' },
    wednesday: { available: true, start: '09:00', end: '17:00' },
    thursday: { available: true, start: '09:00', end: '17:00' },
    friday: { available: true, start: '09:00', end: '17:00' },
    saturday: { available: false, start: '09:00', end: '17:00' },
    sunday: { available: false, start: '09:00', end: '17:00' },
  },
  blackoutDates: [],
};

interface BlackoutDate {
  start: string;
  end: string;
  reason?: string;
}

export default function AvailabilityScreen() {
  const { colors } = useAppTheme();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<UserAvailability>(DEFAULT_AVAILABILITY);
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [showBlackoutModal, setShowBlackoutModal] = useState(false);
  const [newBlackout, setNewBlackout] = useState<BlackoutDate>({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
    reason: '',
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      const data = await apiService.getUserAvailability();
      setAvailability(data);
    } catch (err: any) {
      console.error('Failed to fetch availability:', err);
      // Use defaults if not set
      setAvailability(DEFAULT_AVAILABILITY);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await hapticService.mediumTap();

    try {
      await apiService.updateUserAvailability(availability);
      await hapticService.success();
      showSuccess({
        title: 'Saved',
        message: 'Your availability has been updated',
      });
    } catch (err: any) {
      await hapticService.error();
      showError(err.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const toggleDayAvailable = (day: string) => {
    hapticService.lightTap();
    setAvailability((prev) => ({
      ...prev,
      weeklyHours: {
        ...prev.weeklyHours,
        [day]: {
          ...prev.weeklyHours[day],
          available: !prev.weeklyHours[day].available,
        },
      },
    }));
  };

  const updateDayTime = (day: string, field: 'start' | 'end', value: string) => {
    setAvailability((prev) => ({
      ...prev,
      weeklyHours: {
        ...prev.weeklyHours,
        [day]: {
          ...prev.weeklyHours[day],
          [field]: value,
        },
      },
    }));
  };

  const setTimezone = (tz: string) => {
    hapticService.lightTap();
    setAvailability((prev) => ({ ...prev, timezone: tz }));
    setShowTimezoneModal(false);
  };

  const addBlackoutDate = () => {
    if (!newBlackout.start || !newBlackout.end) {
      showError('Please select start and end dates');
      return;
    }

    hapticService.lightTap();
    setAvailability((prev) => ({
      ...prev,
      blackoutDates: [...prev.blackoutDates, newBlackout],
    }));
    setNewBlackout({
      start: new Date().toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
      reason: '',
    });
    setShowBlackoutModal(false);
  };

  const removeBlackoutDate = (index: number) => {
    Alert.alert(
      'Remove Blackout Date?',
      'Are you sure you want to remove this blackout period?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            hapticService.lightTap();
            setAvailability((prev) => ({
              ...prev,
              blackoutDates: prev.blackoutDates.filter((_, i) => i !== index),
            }));
          },
        },
      ]
    );
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTimezoneLabel = (tz: string) => {
    const found = COMMON_TIMEZONES.find((t) => t.value === tz);
    return found ? found.label : tz;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading availability...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Your Availability
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
          Set when you're available for on-call assignments
        </Text>
      </View>

      {/* Timezone */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="earth" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Timezone
          </Text>
        </View>
        <Pressable
          style={[styles.timezoneButton, { backgroundColor: colors.surface }]}
          onPress={() => setShowTimezoneModal(true)}
        >
          <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>
            {getTimezoneLabel(availability.timezone)}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Weekly Hours */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="calendar-week" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Weekly Hours
          </Text>
        </View>
        <Card style={[styles.card, { backgroundColor: colors.surface }]}>
          {DAYS_OF_WEEK.map((day, index) => {
            const dayData = availability.weeklyHours[day.key];
            return (
              <View key={day.key}>
                <View style={styles.dayRow}>
                  <View style={styles.dayToggle}>
                    <Switch
                      value={dayData?.available ?? false}
                      onValueChange={() => toggleDayAvailable(day.key)}
                      color={colors.primary}
                    />
                    <Text
                      variant="bodyLarge"
                      style={[
                        styles.dayLabel,
                        { color: dayData?.available ? colors.textPrimary : colors.textMuted },
                      ]}
                    >
                      {day.label}
                    </Text>
                  </View>
                  {dayData?.available && (
                    <View style={styles.timeRange}>
                      <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
                        {formatTime(dayData.start)} - {formatTime(dayData.end)}
                      </Text>
                    </View>
                  )}
                </View>
                {index < DAYS_OF_WEEK.length - 1 && <Divider />}
              </View>
            );
          })}
        </Card>
      </View>

      {/* Blackout Dates */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="calendar-remove" size={20} color={colors.primary} />
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Blackout Dates
          </Text>
        </View>
        <Text variant="bodyMedium" style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Dates when you're unavailable (vacation, PTO, etc.)
        </Text>

        {availability.blackoutDates.length > 0 && (
          <Card style={[styles.card, { backgroundColor: colors.surface, marginBottom: 12 }]}>
            {availability.blackoutDates.map((blackout, index) => (
              <View key={index}>
                <View style={styles.blackoutRow}>
                  <View style={styles.blackoutInfo}>
                    <MaterialCommunityIcons name="calendar-blank" size={18} color={colors.warning} />
                    <View>
                      <Text variant="bodyMedium" style={{ color: colors.textPrimary }}>
                        {formatDate(blackout.start)} - {formatDate(blackout.end)}
                      </Text>
                      {blackout.reason && (
                        <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                          {blackout.reason}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Pressable onPress={() => removeBlackoutDate(index)}>
                    <MaterialCommunityIcons name="close-circle" size={22} color={colors.error} />
                  </Pressable>
                </View>
                {index < availability.blackoutDates.length - 1 && <Divider />}
              </View>
            ))}
          </Card>
        )}

        <Button
          mode="outlined"
          icon="plus"
          onPress={() => setShowBlackoutModal(true)}
          style={styles.addButton}
          textColor={colors.primary}
        >
          Add Blackout Date
        </Button>
      </View>

      {/* Save Button */}
      <Button
        mode="contained"
        onPress={handleSave}
        loading={saving}
        disabled={saving}
        style={styles.saveButton}
        buttonColor={colors.primary}
      >
        Save Changes
      </Button>

      {/* Timezone Modal */}
      <Portal>
        <Modal
          visible={showTimezoneModal}
          onDismiss={() => setShowTimezoneModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Select Timezone
          </Text>
          <ScrollView style={styles.timezoneList}>
            {COMMON_TIMEZONES.map((tz) => (
              <Pressable
                key={tz.value}
                style={[
                  styles.timezoneOption,
                  availability.timezone === tz.value && { backgroundColor: `${colors.primary}15` },
                ]}
                onPress={() => setTimezone(tz.value)}
              >
                <Text
                  variant="bodyLarge"
                  style={{
                    color: availability.timezone === tz.value ? colors.primary : colors.textPrimary,
                    fontWeight: availability.timezone === tz.value ? '600' : 'normal',
                  }}
                >
                  {tz.label}
                </Text>
                {availability.timezone === tz.value && (
                  <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </ScrollView>
          <Button mode="text" onPress={() => setShowTimezoneModal(false)} textColor={colors.textSecondary}>
            Cancel
          </Button>
        </Modal>

        {/* Blackout Date Modal */}
        <Modal
          visible={showBlackoutModal}
          onDismiss={() => setShowBlackoutModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Add Blackout Period
          </Text>

          <View style={styles.datePickerRow}>
            <Pressable
              style={[styles.dateButton, { backgroundColor: colors.surfaceVariant }]}
              onPress={() => setShowStartPicker(true)}
            >
              <Text variant="labelMedium" style={{ color: colors.textSecondary }}>
                Start Date
              </Text>
              <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>
                {formatDate(newBlackout.start)}
              </Text>
            </Pressable>
            <MaterialCommunityIcons name="arrow-right" size={20} color={colors.textMuted} />
            <Pressable
              style={[styles.dateButton, { backgroundColor: colors.surfaceVariant }]}
              onPress={() => setShowEndPicker(true)}
            >
              <Text variant="labelMedium" style={{ color: colors.textSecondary }}>
                End Date
              </Text>
              <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>
                {formatDate(newBlackout.end)}
              </Text>
            </Pressable>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={new Date(newBlackout.start + 'T00:00:00')}
              mode="date"
              display="default"
              onChange={(_, date) => {
                setShowStartPicker(false);
                if (date) {
                  setNewBlackout((prev) => ({
                    ...prev,
                    start: date.toISOString().split('T')[0],
                  }));
                }
              }}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={new Date(newBlackout.end + 'T00:00:00')}
              mode="date"
              display="default"
              minimumDate={new Date(newBlackout.start + 'T00:00:00')}
              onChange={(_, date) => {
                setShowEndPicker(false);
                if (date) {
                  setNewBlackout((prev) => ({
                    ...prev,
                    end: date.toISOString().split('T')[0],
                  }));
                }
              }}
            />
          )}

          <TextInput
            label="Reason (optional)"
            value={newBlackout.reason}
            onChangeText={(text) => setNewBlackout((prev) => ({ ...prev, reason: text }))}
            mode="outlined"
            style={styles.reasonInput}
            placeholder="e.g., Vacation, PTO"
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowBlackoutModal(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={addBlackoutDate}
              buttonColor={colors.primary}
              style={styles.modalButton}
            >
              Add
            </Button>
          </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
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
    fontWeight: '600',
  },
  sectionDescription: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  timezoneButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
  },
  dayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayLabel: {
    fontWeight: '500',
  },
  timeRange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blackoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 16,
  },
  blackoutInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addButton: {
    borderRadius: 10,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 4,
  },
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  timezoneList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  timezoneOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  dateButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reasonInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
  },
});
