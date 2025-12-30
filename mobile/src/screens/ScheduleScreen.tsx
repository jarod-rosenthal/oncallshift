import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import {
  Text,
  Card,
  Avatar,
  Button,
  ActivityIndicator,
  Chip,
  Portal,
  Modal,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import * as apiService from '../services/apiService';
import * as hapticService from '../services/hapticService';

interface ScheduleEntry {
  date: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  isOverride: boolean;
}

export default function ScheduleScreen({ route, navigation }: any) {
  const { colors, theme } = useAppTheme();
  const [schedule, setSchedule] = useState<apiService.Schedule | null>(null);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const scheduleId = route?.params?.id;

  useEffect(() => {
    fetchSchedule();
  }, [scheduleId]);

  const fetchSchedule = async () => {
    try {
      if (scheduleId) {
        const data = await apiService.getScheduleDetails(scheduleId);
        setSchedule(data.schedule);
        // Generate mock schedule entries for the next 7 days
        generateScheduleEntries(data.schedule);
      } else {
        // Fetch all schedules
        const schedules = await apiService.getSchedules();
        if (schedules.length > 0) {
          const data = await apiService.getScheduleDetails(schedules[0].id);
          setSchedule(data.schedule);
          generateScheduleEntries(data.schedule);
        }
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateScheduleEntries = (sched: apiService.Schedule) => {
    // Generate entries for the next 7 days (mock data)
    const generatedEntries: ScheduleEntry[] = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      generatedEntries.push({
        date: date.toISOString().split('T')[0],
        user: {
          id: '1',
          fullName: 'You',
          email: 'you@example.com',
        },
        isOverride: false,
      });
    }
    setEntries(generatedEntries);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSchedule();
  };

  const handleRequestOverride = async () => {
    await hapticService.mediumTap();
    setShowOverrideModal(true);
  };

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateString === today.toISOString().split('T')[0]) {
      return 'Today';
    }
    if (dateString === tomorrow.toISOString().split('T')[0]) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={[styles(colors).container, styles(colors).centerContent]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles(colors).loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  return (
    <View style={styles(colors).container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
          />
        }
      >
        {/* Schedule Header */}
        <Card style={styles(colors).headerCard}>
          <Card.Content>
            <View style={styles(colors).headerRow}>
              <MaterialCommunityIcons name="calendar-clock" size={32} color={colors.accent} />
              <View style={styles(colors).headerInfo}>
                <Text variant="titleLarge" style={styles(colors).headerTitle}>
                  {schedule?.name || 'On-Call Schedule'}
                </Text>
                <Text variant="bodyMedium" style={styles(colors).headerSubtitle}>
                  {schedule?.type === 'weekly' ? 'Weekly Rotation' : schedule?.type === 'daily' ? 'Daily Rotation' : 'Manual'}
                </Text>
              </View>
            </View>
            {schedule?.timezone && (
              <Chip
                icon="earth"
                style={styles(colors).timezoneChip}
                textStyle={styles(colors).timezoneText}
              >
                {schedule.timezone}
              </Chip>
            )}
          </Card.Content>
        </Card>

        {/* Request Override Button */}
        <View style={styles(colors).overrideButtonContainer}>
          <Button
            mode="outlined"
            onPress={handleRequestOverride}
            icon="swap-horizontal"
            style={styles(colors).overrideButton}
            textColor={colors.accent}
          >
            Request Override / Swap
          </Button>
        </View>

        {/* Schedule Entries */}
        <View style={styles(colors).entriesContainer}>
          <Text variant="titleMedium" style={styles(colors).sectionTitle}>
            Upcoming Schedule
          </Text>
          {entries.map((entry, index) => (
            <Card key={index} style={styles(colors).entryCard}>
              <Card.Content style={styles(colors).entryContent}>
                <View style={styles(colors).entryDate}>
                  <Text variant="titleMedium" style={styles(colors).dateText}>
                    {formatDate(entry.date)}
                  </Text>
                  {entry.isOverride && (
                    <Chip
                      compact
                      style={styles(colors).overrideChip}
                      textStyle={styles(colors).overrideChipText}
                    >
                      Override
                    </Chip>
                  )}
                </View>
                <View style={styles(colors).entryUser}>
                  <Avatar.Text
                    size={40}
                    label={getInitials(entry.user.fullName)}
                    style={[
                      styles(colors).avatar,
                      entry.user.fullName === 'You' && styles(colors).avatarYou,
                    ]}
                  />
                  <View style={styles(colors).userInfo}>
                    <Text variant="bodyLarge" style={styles(colors).userName}>
                      {entry.user.fullName}
                    </Text>
                    <Text variant="bodySmall" style={styles(colors).userEmail}>
                      {entry.user.email}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Override Request Modal */}
      <Portal>
        <Modal
          visible={showOverrideModal}
          onDismiss={() => setShowOverrideModal(false)}
          contentContainerStyle={[styles(colors).modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={styles(colors).modalTitle}>
            Request Schedule Change
          </Text>
          <Text variant="bodyMedium" style={styles(colors).modalDescription}>
            You can request to swap shifts with a teammate or set up a temporary override.
          </Text>
          <View style={styles(colors).modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setShowOverrideModal(false)}
              style={styles(colors).modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                hapticService.success();
                setShowOverrideModal(false);
              }}
              style={styles(colors).modalButton}
              buttonColor={colors.accent}
            >
              Submit Request
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
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
  headerCard: {
    margin: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  timezoneChip: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: colors.surfaceSecondary,
  },
  timezoneText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  overrideButtonContainer: {
    paddingHorizontal: 16,
  },
  overrideButton: {
    borderColor: colors.accent,
    borderRadius: 8,
  },
  entriesContainer: {
    padding: 16,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 12,
  },
  entryCard: {
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  entryContent: {
    gap: 12,
  },
  entryDate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  overrideChip: {
    backgroundColor: colors.warning + '20',
  },
  overrideChipText: {
    color: colors.warning,
    fontSize: 10,
  },
  entryUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    backgroundColor: colors.accent,
  },
  avatarYou: {
    backgroundColor: colors.success,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  userEmail: {
    color: colors.textSecondary,
  },
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalDescription: {
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    borderRadius: 8,
  },
});
