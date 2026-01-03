import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  Pressable,
  ScrollView,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  ActivityIndicator,
  useTheme,
  SegmentedButtons,
  Button,
  Portal,
  Modal,
  RadioButton,
  Surface,
  Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as apiService from '../services/apiService';
import type { OnCallData, UserProfile, UpcomingShift } from '../services/apiService';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import { OwnerAvatar, useToast, ShiftHandoffNotes } from '../components';
import * as hapticService from '../services/hapticService';
import * as calendarService from '../services/calendarService';

const OVERRIDE_DURATIONS = [
  { label: '1 hour', hours: 1 },
  { label: '4 hours', hours: 4 },
  { label: '8 hours', hours: 8 },
  { label: 'Until tomorrow', hours: 24 },
  { label: 'End of week', hours: 168 },
];

export default function OnCallScreen({ navigation }: any) {
  const theme = useTheme();
  const { colors } = useAppTheme();
  const { showSuccess, showError } = useToast();
  const themedStyles = styles(colors);
  const [oncallData, setOncallData] = useState<OnCallData[]>([]);
  const [upcomingShifts, setUpcomingShifts] = useState<UpcomingShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState<'mine' | 'all'>('mine');
  const [showTakeOverModal, setShowTakeOverModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<OnCallData | null>(null);
  const [takeOverLoading, setTakeOverLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(4);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [exportingCalendar, setExportingCalendar] = useState(false);

  // Dynamic styles for theme-aware colors
  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    card: {
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center' as const,
    },
  };

  const fetchOnCallData = async () => {
    try {
      setError(null);
      const [data, profile, shifts] = await Promise.all([
        apiService.getOnCallData(),
        apiService.getUserProfile().catch(() => null),
        apiService.getUpcomingShifts().catch(() => []),
      ]);
      setOncallData(data);
      setUpcomingShifts(shifts);
      if (profile) {
        setCurrentUser(profile);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load on-call data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOnCallData();
  }, []);

  const currentUserId = currentUser?.id || '';

  const onRefresh = () => {
    setRefreshing(true);
    fetchOnCallData();
  };

  // Get current user's on-call assignments
  const myOnCallAssignments = useMemo(() => {
    return oncallData.filter(item => item.oncallUser?.id === currentUserId);
  }, [oncallData, currentUserId]);

  const isCurrentlyOnCall = myOnCallAssignments.length > 0;

  const handleTakeOver = async () => {
    if (!selectedSchedule || !currentUser) return;

    setTakeOverLoading(true);
    await hapticService.mediumTap();

    try {
      const until = new Date();
      until.setHours(until.getHours() + selectedDuration);

      await apiService.createScheduleOverride(
        selectedSchedule.schedule.id,
        currentUser.id,
        until.toISOString()
      );

      await hapticService.success();
      showSuccess(`You are now on-call for ${selectedSchedule.service.name}`);
      setShowTakeOverModal(false);
      setSelectedSchedule(null);
      setSelectedDuration(4);
      fetchOnCallData();
    } catch (err: any) {
      await hapticService.error();
      showError(err.message || 'Failed to take over on-call');
    } finally {
      setTakeOverLoading(false);
    }
  };

  const handleRemoveOverride = async (item: OnCallData) => {
    await hapticService.mediumTap();

    Alert.alert(
      'Remove Override?',
      `This will remove the override and return to the normal schedule.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.removeScheduleOverride(item.schedule.id);
              await hapticService.success();
              showSuccess('Schedule returned to normal rotation');
              fetchOnCallData();
            } catch (err: any) {
              await hapticService.error();
              showError(err.message || 'Failed to remove override');
            }
          },
        },
      ]
    );
  };

  const openTakeOverModal = (item: OnCallData) => {
    setSelectedSchedule(item);
    setShowTakeOverModal(true);
  };

  const formatShiftTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today ${timeStr}`;
    if (isTomorrow) return `Tomorrow ${timeStr}`;

    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` ${timeStr}`;
  };

  const formatDuration = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.round(diffMs / (1000 * 60 * 60));

    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
  };

  const formatTimeUntil = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    if (diffMs < 0) return 'Now';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours < 1) return `in ${minutes}m`;
    if (hours < 24) return `in ${hours}h ${minutes}m`;
    const days = Math.floor(hours / 24);
    return `in ${days}d`;
  };

  const handleExportToCalendar = async () => {
    if (upcomingShifts.length === 0) return;

    await hapticService.mediumTap();
    setExportingCalendar(true);

    try {
      const result = await calendarService.exportShiftsToCalendar(upcomingShifts);

      if (result.success) {
        await hapticService.success();
        showSuccess(result.message);
      } else {
        await hapticService.error();
        if (result.message.includes('permission')) {
          calendarService.showPermissionDeniedAlert();
        } else {
          showError(result.message);
        }
      }
    } catch (err: any) {
      await hapticService.error();
      showError(err.message || 'Failed to export to calendar');
    } finally {
      setExportingCalendar(false);
    }
  };

  // Filter data based on segment
  const filteredData = segment === 'mine'
    ? oncallData.filter(item => item.oncallUser?.id === currentUserId)
    : oncallData;

  const renderStatusHeader = () => (
    <Surface style={themedStyles.statusHeader} elevation={0}>
      {isCurrentlyOnCall ? (
        <View style={themedStyles.statusOnCall}>
          <View style={themedStyles.statusIconContainer}>
            <View style={themedStyles.statusLive}>
              <View style={themedStyles.liveDot} />
              <Text style={themedStyles.liveText}>LIVE</Text>
            </View>
            <MaterialCommunityIcons name="phone-in-talk" size={32} color={colors.success} />
          </View>
          <View style={themedStyles.statusTextContainer}>
            <Text variant="titleLarge" style={themedStyles.statusTitle}>
              You're On-Call
            </Text>
            <Text variant="bodyMedium" style={themedStyles.statusSubtitle}>
              {myOnCallAssignments.length} service{myOnCallAssignments.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      ) : (
        <View style={themedStyles.statusOffCall}>
          <MaterialCommunityIcons name="phone-off" size={32} color={colors.textMuted} />
          <View style={themedStyles.statusTextContainer}>
            <Text variant="titleLarge" style={themedStyles.statusTitle}>
              Not On-Call
            </Text>
            <Text variant="bodyMedium" style={themedStyles.statusSubtitle}>
              Check upcoming shifts below
            </Text>
          </View>
        </View>
      )}
    </Surface>
  );

  const renderCurrentOnCallCards = () => {
    if (!isCurrentlyOnCall) return null;

    return (
      <View style={themedStyles.currentOnCallSection}>
        <Text variant="titleMedium" style={themedStyles.sectionTitle}>Currently On-Call For</Text>
        {myOnCallAssignments.map((item) => (
          <Card key={`${item.service.id}-${item.schedule.id}`} style={themedStyles.currentOnCallCard} mode="elevated">
            <Card.Content style={themedStyles.currentOnCallContent}>
              <View style={themedStyles.currentOnCallLeft}>
                <View style={themedStyles.currentOnCallInfo}>
                  <Text variant="titleMedium" style={themedStyles.currentServiceName} numberOfLines={1}>
                    {item.service.name}
                  </Text>
                  <View style={themedStyles.currentScheduleRow}>
                    <MaterialCommunityIcons name="calendar-clock" size={14} color={colors.textSecondary} />
                    <Text variant="bodySmall" style={themedStyles.currentScheduleName} numberOfLines={1}>
                      {item.schedule.name}
                    </Text>
                  </View>
                </View>
              </View>
              {item.isOverride && (
                <View style={themedStyles.overrideBadgeSmall}>
                  <MaterialCommunityIcons name="swap-horizontal" size={12} color={colors.warning} />
                  <Text style={themedStyles.overrideBadgeText}>Override</Text>
                </View>
              )}
            </Card.Content>
            {item.isOverride && item.overrideUntil && (
              <View style={themedStyles.overrideUntilBar}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={colors.warning} />
                <Text style={themedStyles.overrideUntilText}>
                  Until {new Date(item.overrideUntil).toLocaleString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
                <Button
                  mode="text"
                  compact
                  textColor={colors.warning}
                  onPress={() => handleRemoveOverride(item)}
                >
                  End Early
                </Button>
              </View>
            )}
          </Card>
        ))}
      </View>
    );
  };

  const renderUpcomingShifts = () => {
    if (upcomingShifts.length === 0) return null;

    return (
      <View style={themedStyles.upcomingSection}>
        <View style={themedStyles.upcomingSectionHeader}>
          <Pressable
            style={themedStyles.sectionHeaderRow}
            onPress={() => setShowUpcoming(!showUpcoming)}
          >
            <View style={themedStyles.sectionTitleRow}>
              <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.accent} />
              <Text variant="titleMedium" style={themedStyles.sectionTitle}>Upcoming Shifts</Text>
            </View>
            <MaterialCommunityIcons
              name={showUpcoming ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={colors.textSecondary}
            />
          </Pressable>
          <Button
            mode="outlined"
            icon="calendar-export"
            compact
            onPress={handleExportToCalendar}
            loading={exportingCalendar}
            disabled={exportingCalendar}
            style={themedStyles.exportButton}
            textColor={colors.accent}
          >
            Export
          </Button>
        </View>

        {showUpcoming && (
          <View style={themedStyles.upcomingList}>
            {upcomingShifts.slice(0, 5).map((shift, index) => {
              const isActive = new Date(shift.startTime) <= new Date() && new Date(shift.endTime) > new Date();

              return (
                <View key={`${shift.scheduleId}-${index}`} style={themedStyles.upcomingItem}>
                  <View style={themedStyles.upcomingTimeColumn}>
                    <Text style={[themedStyles.upcomingTime, isActive && themedStyles.upcomingTimeActive]}>
                      {formatShiftTime(shift.startTime)}
                    </Text>
                    <Text style={themedStyles.upcomingDuration}>
                      {formatDuration(shift.startTime, shift.endTime)}
                    </Text>
                  </View>
                  <View style={themedStyles.upcomingDivider} />
                  <View style={themedStyles.upcomingDetails}>
                    <Text variant="titleSmall" style={themedStyles.upcomingScheduleName}>
                      {shift.scheduleName}
                    </Text>
                    {shift.serviceName && shift.serviceName !== shift.scheduleName && (
                      <Text variant="bodySmall" style={themedStyles.upcomingServiceName}>
                        {shift.serviceName}
                      </Text>
                    )}
                    {isActive && (
                      <Chip compact style={themedStyles.activeChip} textStyle={themedStyles.activeChipText}>
                        Active Now
                      </Chip>
                    )}
                  </View>
                  <Text style={themedStyles.upcomingCountdown}>
                    {isActive ? 'Now' : formatTimeUntil(shift.startTime)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderOnCallItem = ({ item }: { item: OnCallData }) => {
    const isMe = item.oncallUser?.id === currentUserId;

    return (
      <Card style={dynamicStyles.card} mode="elevated">
        <Card.Content>
          {/* Service Header */}
          <View style={themedStyles.serviceHeader}>
            <View style={themedStyles.serviceTitleContainer}>
              <MaterialCommunityIcons
                name="server"
                size={20}
                color={theme.colors.primary}
              />
              <Text variant="titleMedium" style={themedStyles.serviceName}>
                {item.service.name}
              </Text>
            </View>
            <View style={themedStyles.badges}>
              {isMe && (
                <View style={themedStyles.youBadge}>
                  <MaterialCommunityIcons name="account" size={12} color={colors.success} />
                  <Text style={themedStyles.youBadgeText}>You</Text>
                </View>
              )}
              {item.isOverride && (
                <View style={themedStyles.overrideBadge}>
                  <MaterialCommunityIcons name="swap-horizontal" size={12} color={colors.warning} />
                  <Text style={themedStyles.overrideBadgeTextInline}>Override</Text>
                </View>
              )}
            </View>
          </View>

          {/* On-Call User */}
          {item.oncallUser ? (
            <View style={themedStyles.userContainer}>
              <OwnerAvatar
                name={item.oncallUser.fullName}
                email={item.oncallUser.email}
                profilePictureUrl={item.oncallUser.profilePictureUrl}
                size={48}
              />
              <View style={themedStyles.userInfo}>
                <Text variant="titleMedium" style={themedStyles.userName}>
                  {item.oncallUser.fullName}
                </Text>
                <View style={themedStyles.emailContainer}>
                  <MaterialCommunityIcons name="email-outline" size={14} color={colors.textSecondary} />
                  <Text variant="bodySmall" style={themedStyles.userEmail}>
                    {item.oncallUser.email}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={themedStyles.noUserContainer}>
              <MaterialCommunityIcons name="account-off-outline" size={48} color={colors.warning} />
              <View style={themedStyles.userInfo}>
                <Text variant="titleMedium" style={themedStyles.noUserText}>
                  No one on call
                </Text>
                <Text variant="bodySmall" style={themedStyles.noUserSubtext}>
                  Assign someone to this schedule
                </Text>
              </View>
            </View>
          )}

          {/* Schedule Info */}
          <View style={themedStyles.scheduleContainer}>
            <MaterialCommunityIcons name="calendar-clock" size={16} color={colors.textSecondary} />
            <Text variant="bodySmall" style={themedStyles.scheduleText}>
              {item.schedule.name}
            </Text>
          </View>

          {/* Override Until */}
          {item.isOverride && item.overrideUntil && (
            <View style={themedStyles.overrideInfo}>
              <MaterialCommunityIcons name="clock-alert-outline" size={16} color={colors.warning} />
              <Text variant="bodySmall" style={themedStyles.overrideText}>
                Override until: {new Date(item.overrideUntil).toLocaleString()}
              </Text>
            </View>
          )}

          {/* Take Over Button - only show if not already on call */}
          {!isMe && item.oncallUser && (
            <Button
              mode="outlined"
              icon="account-switch"
              onPress={() => openTakeOverModal(item)}
              style={themedStyles.takeOverButton}
              textColor={colors.accent}
            >
              Take Over
            </Button>
          )}

          {/* Remove Override Button - show when current user has an override */}
          {isMe && item.isOverride && (
            <Button
              mode="outlined"
              icon="close-circle-outline"
              onPress={() => handleRemoveOverride(item)}
              style={[themedStyles.takeOverButton, { borderColor: colors.warning }]}
              textColor={colors.warning}
            >
              Remove Override
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={[dynamicStyles.container, themedStyles.centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={themedStyles.loadingText}>
          Loading on-call data...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[dynamicStyles.container, themedStyles.centerContent]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color={colors.error} />
        <Text variant="bodyLarge" style={themedStyles.errorText}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        contentContainerStyle={themedStyles.scrollContent}
      >
        {/* Status Header */}
        {renderStatusHeader()}

        {/* Current On-Call Cards */}
        {renderCurrentOnCallCards()}

        {/* Shift Handoff Notes - show when user is on-call */}
        {isCurrentlyOnCall && myOnCallAssignments.length > 0 && (
          <View style={themedStyles.handoffNotesSection}>
            <ShiftHandoffNotes
              scheduleId={myOnCallAssignments[0].schedule.id}
              scheduleName={myOnCallAssignments[0].schedule.name}
            />
          </View>
        )}

        {/* Upcoming Shifts */}
        {renderUpcomingShifts()}

        {/* Quick Actions */}
        {!isCurrentlyOnCall && oncallData.length > 0 && (
          <View style={themedStyles.quickActionsSection}>
            <Text variant="titleMedium" style={themedStyles.sectionTitle}>Quick Actions</Text>
            <View style={themedStyles.quickActionsRow}>
              <Button
                mode="contained"
                icon="account-switch"
                onPress={() => {
                  // Find first schedule to take over
                  const firstAvailable = oncallData.find(item => item.oncallUser?.id !== currentUserId);
                  if (firstAvailable) {
                    openTakeOverModal(firstAvailable);
                  }
                }}
                buttonColor={colors.accent}
                style={themedStyles.quickActionButton}
              >
                Take On-Call
              </Button>
            </View>
          </View>
        )}

        <Divider style={themedStyles.sectionDivider} />

        {/* All Schedules Section */}
        <View style={themedStyles.allSchedulesSection}>
          <View style={themedStyles.allSchedulesHeader}>
            <Text variant="titleMedium" style={themedStyles.sectionTitle}>
              All Schedules
            </Text>
            <SegmentedButtons
              value={segment}
              onValueChange={(value) => setSegment(value as 'mine' | 'all')}
              buttons={[
                { value: 'mine', label: 'Mine', icon: 'account' },
                { value: 'all', label: 'All', icon: 'account-group' },
              ]}
              style={themedStyles.segmentedButtons}
              density="small"
            />
          </View>

          {filteredData.length === 0 ? (
            <View style={themedStyles.emptyContainer}>
              <MaterialCommunityIcons
                name={segment === 'mine' ? 'calendar-check' : 'calendar-remove-outline'}
                size={48}
                color={colors.textMuted}
              />
              <Text variant="titleSmall" style={themedStyles.emptyText}>
                {segment === 'mine' ? "You're not on call" : 'No schedules found'}
              </Text>
              <Text variant="bodySmall" style={themedStyles.emptySubtext}>
                {segment === 'mine'
                  ? 'Switch to "All" to see who is on call'
                  : 'Set up schedules in the web app'}
              </Text>
            </View>
          ) : (
            filteredData.map((item) => (
              <View key={`${item.service.id}-${item.schedule.id}`}>
                {renderOnCallItem({ item })}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Take Over Confirmation Modal */}
      <Portal>
        <Modal
          visible={showTakeOverModal}
          onDismiss={() => setShowTakeOverModal(false)}
          contentContainerStyle={themedStyles.modalContainer}
        >
          <View style={dynamicStyles.modalContent}>
            <MaterialCommunityIcons name="account-switch" size={48} color={colors.accent} />
            <Text variant="titleLarge" style={themedStyles.modalTitle}>
              Take Over On-Call?
            </Text>
            <Text variant="bodyMedium" style={themedStyles.modalDescription}>
              You will become the on-call responder for{' '}
              <Text style={themedStyles.modalServiceName}>{selectedSchedule?.service.name}</Text>.
              {selectedSchedule?.oncallUser && (
                <Text>{'\n'}{selectedSchedule.oncallUser.fullName} will be notified.</Text>
              )}
            </Text>

            {/* Duration Picker */}
            <View style={themedStyles.durationSection}>
              <Text variant="titleSmall" style={themedStyles.durationLabel}>
                Override Duration
              </Text>
              <RadioButton.Group
                onValueChange={(value) => setSelectedDuration(parseInt(value))}
                value={selectedDuration.toString()}
              >
                {OVERRIDE_DURATIONS.map((duration) => (
                  <Pressable
                    key={duration.hours}
                    style={themedStyles.durationOption}
                    onPress={() => setSelectedDuration(duration.hours)}
                  >
                    <RadioButton.Android
                      value={duration.hours.toString()}
                      color={colors.accent}
                    />
                    <Text style={themedStyles.durationText}>{duration.label}</Text>
                  </Pressable>
                ))}
              </RadioButton.Group>
            </View>

            <View style={themedStyles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowTakeOverModal(false)}
                style={themedStyles.modalButton}
                disabled={takeOverLoading}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleTakeOver}
                buttonColor={colors.accent}
                style={themedStyles.modalButton}
                loading={takeOverLoading}
                disabled={takeOverLoading}
              >
                Take Over
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = (colors: any) => StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
  },
  // Status Header
  statusHeader: {
    padding: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  statusOnCall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusOffCall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusIconContainer: {
    alignItems: 'center',
  },
  statusLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.success,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  statusSubtitle: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Current On-Call Section
  currentOnCallSection: {
    padding: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 12,
  },
  currentOnCallCard: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  currentOnCallContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  currentOnCallLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  currentOnCallInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  currentServiceName: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  currentScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  currentScheduleName: {
    color: colors.textSecondary,
  },
  overrideBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexShrink: 0,
  },
  overrideBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warning,
    lineHeight: 11,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  overrideUntilBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    paddingTop: 0,
  },
  overrideUntilText: {
    flex: 1,
    fontSize: 12,
    color: colors.warning,
  },
  // Handoff Notes Section
  handoffNotesSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  // Upcoming Shifts Section
  upcomingSection: {
    padding: 16,
    paddingTop: 8,
  },
  upcomingSectionHeader: {
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportButton: {
    marginTop: 12,
    borderColor: colors.accent,
    borderRadius: 8,
  },
  upcomingList: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  upcomingTimeColumn: {
    width: 100,
  },
  upcomingTime: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  upcomingTimeActive: {
    color: colors.success,
  },
  upcomingDuration: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  upcomingDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.borderLight,
    marginHorizontal: 12,
  },
  upcomingDetails: {
    flex: 1,
  },
  upcomingScheduleName: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  upcomingServiceName: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  activeChip: {
    backgroundColor: colors.successLight,
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  activeChipText: {
    fontSize: 10,
    color: colors.success,
    fontWeight: '600',
    lineHeight: 10,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  upcomingCountdown: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  // Quick Actions
  quickActionsSection: {
    padding: 16,
    paddingTop: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    borderRadius: 8,
  },
  // Section Divider
  sectionDivider: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  // All Schedules Section
  allSchedulesSection: {
    padding: 16,
    paddingTop: 8,
  },
  allSchedulesHeader: {
    marginBottom: 16,
  },
  segmentedButtons: {
    marginTop: 12,
  },
  // Card styles
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceName: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  overrideChip: {
    backgroundColor: colors.warningLight,
    paddingVertical: 4,
  },
  overrideChipText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 11,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  noUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.warningLight,
    borderRadius: 8,
  },
  noUserText: {
    color: colors.warning,
    fontWeight: '600',
  },
  noUserSubtext: {
    color: colors.warning,
    opacity: 0.8,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  userEmail: {
    color: colors.textSecondary,
  },
  scheduleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  scheduleText: {
    color: colors.textSecondary,
  },
  overrideInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.warningLight,
    borderRadius: 8,
  },
  overrideText: {
    color: colors.warning,
    flex: 1,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: colors.textMuted,
    marginTop: 12,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  youBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  youBadgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 12,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  overrideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  overrideBadgeTextInline: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 12,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  // Keep old chip styles for backwards compatibility
  youChip: {
    backgroundColor: colors.successLight,
    paddingVertical: 4,
  },
  youChipText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 11,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  takeOverButton: {
    marginTop: 16,
    borderColor: colors.accent,
    borderRadius: 8,
  },
  modalContainer: {
    margin: 20,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  modalDescription: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalServiceName: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
  },
  durationSection: {
    width: '100%',
    marginBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  durationLabel: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  durationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  durationText: {
    color: colors.textPrimary,
    fontSize: 15,
    marginLeft: 4,
  },
});
