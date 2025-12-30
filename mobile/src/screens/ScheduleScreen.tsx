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
  SegmentedButtons,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import * as apiService from '../services/apiService';
import type { ScheduleMember, OnCallData } from '../services/apiService';
import * as hapticService from '../services/hapticService';
import { OwnerAvatar } from '../components';

interface ScheduleEntry {
  date: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  isOverride: boolean;
}

type ViewTab = 'upcoming' | 'members';

export default function ScheduleScreen({ route, navigation }: any) {
  const { colors, theme } = useAppTheme();
  const [schedule, setSchedule] = useState<apiService.Schedule | null>(null);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [members, setMembers] = useState<ScheduleMember[]>([]);
  const [currentOncall, setCurrentOncall] = useState<OnCallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>('upcoming');
  const scheduleId = route?.params?.id;

  useEffect(() => {
    fetchSchedule();
  }, [scheduleId]);

  const fetchSchedule = async () => {
    try {
      let targetScheduleId = scheduleId;

      if (!targetScheduleId) {
        // Fetch all schedules and use the first one
        const schedules = await apiService.getSchedules();
        if (schedules.length > 0) {
          targetScheduleId = schedules[0].id;
        }
      }

      if (targetScheduleId) {
        // Fetch schedule details, members, and on-call data in parallel
        const [scheduleData, membersData, oncallData] = await Promise.all([
          apiService.getScheduleDetails(targetScheduleId),
          apiService.getScheduleMembers(targetScheduleId).catch(() => []),
          apiService.getOnCallData().catch(() => []),
        ]);

        setSchedule(scheduleData.schedule);
        setMembers(membersData.sort((a, b) => a.position - b.position));

        // Find current on-call for this schedule
        const oncall = oncallData.find(oc => oc.schedule.id === targetScheduleId);
        setCurrentOncall(oncall || null);

        // Generate schedule entries based on rotation members
        generateScheduleEntries(scheduleData.schedule, membersData, oncall);
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateScheduleEntries = (
    sched: apiService.Schedule,
    membersList: ScheduleMember[],
    oncall?: OnCallData | null
  ) => {
    // Generate entries for the next 7 days based on rotation
    const generatedEntries: ScheduleEntry[] = [];
    const today = new Date();

    // If we have members, rotate through them for the schedule view
    if (membersList.length > 0) {
      // Find current on-call member index
      let currentIndex = 0;
      if (oncall?.oncallUser) {
        const foundIndex = membersList.findIndex(
          m => m.user.id === oncall.oncallUser?.id
        );
        if (foundIndex >= 0) {
          currentIndex = foundIndex;
        }
      }

      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);

        // Calculate which member is on-call based on schedule type
        let memberIndex = currentIndex;
        if (sched.type === 'daily') {
          memberIndex = (currentIndex + i) % membersList.length;
        } else if (sched.type === 'weekly') {
          memberIndex = (currentIndex + Math.floor(i / 7)) % membersList.length;
        }

        const member = membersList[memberIndex];
        generatedEntries.push({
          date: date.toISOString().split('T')[0],
          user: member.user,
          isOverride: i === 0 && (oncall?.isOverride ?? false),
        });
      }
    } else {
      // Fallback if no members
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        generatedEntries.push({
          date: date.toISOString().split('T')[0],
          user: oncall?.oncallUser || {
            id: 'unknown',
            fullName: 'Unassigned',
            email: '',
          },
          isOverride: i === 0 && (oncall?.isOverride ?? false),
        });
      }
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

        {/* Current On-Call */}
        {currentOncall?.oncallUser && (
          <Card style={styles(colors).currentOncallCard}>
            <Card.Content>
              <Text variant="labelMedium" style={styles(colors).currentOncallLabel}>
                CURRENTLY ON-CALL
              </Text>
              <View style={styles(colors).currentOncallUser}>
                <OwnerAvatar
                  name={currentOncall.oncallUser.fullName}
                  email={currentOncall.oncallUser.email}
                  size={48}
                />
                <View style={styles(colors).currentOncallInfo}>
                  <Text variant="titleMedium" style={styles(colors).currentOncallName}>
                    {currentOncall.oncallUser.fullName}
                  </Text>
                  <Text variant="bodySmall" style={styles(colors).currentOncallEmail}>
                    {currentOncall.oncallUser.email}
                  </Text>
                </View>
                {currentOncall.isOverride && (
                  <Chip
                    compact
                    style={styles(colors).overrideChip}
                    textStyle={styles(colors).overrideChipText}
                    icon="swap-horizontal"
                  >
                    Override
                  </Chip>
                )}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Tab Selector */}
        <View style={styles(colors).tabContainer}>
          <SegmentedButtons
            value={viewTab}
            onValueChange={(value) => setViewTab(value as ViewTab)}
            buttons={[
              {
                value: 'upcoming',
                label: 'Upcoming',
                icon: 'calendar-month',
              },
              {
                value: 'members',
                label: `Members (${members.length})`,
                icon: 'account-group',
              },
            ]}
          />
        </View>

        {/* Upcoming Schedule View */}
        {viewTab === 'upcoming' && (
          <View style={styles(colors).entriesContainer}>
            <View style={styles(colors).sectionHeaderRow}>
              <Text variant="titleMedium" style={styles(colors).sectionTitle}>
                Upcoming Schedule
              </Text>
              <Button
                mode="text"
                compact
                onPress={handleRequestOverride}
                icon="swap-horizontal"
                textColor={colors.accent}
              >
                Override
              </Button>
            </View>
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
                    <OwnerAvatar
                      name={entry.user.fullName}
                      email={entry.user.email}
                      size={40}
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
        )}

        {/* Members View */}
        {viewTab === 'members' && (
          <View style={styles(colors).entriesContainer}>
            <Text variant="titleMedium" style={styles(colors).sectionTitle}>
              Rotation Members
            </Text>
            <Text variant="bodyMedium" style={styles(colors).sectionDescription}>
              Team members in this on-call rotation, ordered by position
            </Text>
            {members.length === 0 ? (
              <Card style={styles(colors).emptyCard}>
                <Card.Content style={styles(colors).emptyContent}>
                  <MaterialCommunityIcons
                    name="account-group-outline"
                    size={48}
                    color={colors.textMuted}
                  />
                  <Text variant="bodyLarge" style={styles(colors).emptyText}>
                    No members in this rotation
                  </Text>
                  <Text variant="bodySmall" style={styles(colors).emptySubtext}>
                    Add team members via the web dashboard
                  </Text>
                </Card.Content>
              </Card>
            ) : (
              members.map((member, index) => (
                <Card key={member.id} style={styles(colors).memberCard}>
                  <Card.Content style={styles(colors).memberContent}>
                    <View style={styles(colors).memberPosition}>
                      <Text variant="labelLarge" style={styles(colors).positionNumber}>
                        {member.position}
                      </Text>
                    </View>
                    <OwnerAvatar
                      name={member.user.fullName}
                      email={member.user.email}
                      size={44}
                    />
                    <View style={styles(colors).memberInfo}>
                      <Text variant="bodyLarge" style={styles(colors).memberName}>
                        {member.user.fullName}
                      </Text>
                      <Text variant="bodySmall" style={styles(colors).memberEmail}>
                        {member.user.email}
                      </Text>
                    </View>
                    {currentOncall?.oncallUser?.id === member.user.id && (
                      <Chip
                        compact
                        style={styles(colors).onCallChip}
                        textStyle={styles(colors).onCallChipText}
                        icon="phone-in-talk"
                      >
                        On-Call
                      </Chip>
                    )}
                  </Card.Content>
                </Card>
              ))
            )}
          </View>
        )}
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
  // Current On-Call
  currentOncallCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.accentMuted + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  currentOncallLabel: {
    color: colors.accent,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  currentOncallUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentOncallInfo: {
    flex: 1,
  },
  currentOncallName: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  currentOncallEmail: {
    color: colors.textSecondary,
  },
  // Tabs
  tabContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  // Section Header Row
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionDescription: {
    color: colors.textSecondary,
    marginBottom: 12,
  },
  // Members
  memberCard: {
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  memberContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberPosition: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionNumber: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  memberEmail: {
    color: colors.textSecondary,
  },
  onCallChip: {
    backgroundColor: colors.success + '20',
  },
  onCallChipText: {
    color: colors.success,
    fontSize: 10,
  },
  // Empty State
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  emptySubtext: {
    color: colors.textMuted,
    textAlign: 'center',
  },
});
