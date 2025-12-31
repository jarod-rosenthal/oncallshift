import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  Pressable,
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
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as apiService from '../services/apiService';
import type { OnCallData, UserProfile } from '../services/apiService';
import { colors } from '../theme';
import { OwnerAvatar, useToast } from '../components';
import * as hapticService from '../services/hapticService';

const OVERRIDE_DURATIONS = [
  { label: '1 hour', hours: 1 },
  { label: '4 hours', hours: 4 },
  { label: '8 hours', hours: 8 },
  { label: 'Until tomorrow', hours: 24 },
  { label: 'End of week', hours: 168 },
];

export default function OnCallScreen() {
  const theme = useTheme();
  const { showSuccess, showError } = useToast();
  const [oncallData, setOncallData] = useState<OnCallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState<'mine' | 'all'>('mine');
  const [showTakeOverModal, setShowTakeOverModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<OnCallData | null>(null);
  const [takeOverLoading, setTakeOverLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(4); // Default 4 hours

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
      const [data, profile] = await Promise.all([
        apiService.getOnCallData(),
        apiService.getUserProfile().catch(() => null),
      ]);
      setOncallData(data);
      if (profile) {
        setCurrentUser(profile);
      }
    } catch (err: any) {
      console.error('Failed to fetch on-call data:', err);
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

  const handleTakeOver = async () => {
    if (!selectedSchedule || !currentUser) return;

    setTakeOverLoading(true);
    await hapticService.mediumTap();

    try {
      // Calculate override end time
      const until = new Date();
      until.setHours(until.getHours() + selectedDuration);

      await apiService.createScheduleOverride(
        selectedSchedule.schedule.id,
        currentUser.id,
        until.toISOString()
      );

      await hapticService.success();
      showSuccess({
        title: 'On-Call Updated',
        message: `You are now on-call for ${selectedSchedule.service.name}`,
      });
      setShowTakeOverModal(false);
      setSelectedSchedule(null);
      setSelectedDuration(4); // Reset to default
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
              showSuccess({
                title: 'Override Removed',
                message: 'Schedule returned to normal rotation',
              });
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

  // Filter data based on segment
  const filteredData = segment === 'mine'
    ? oncallData.filter(item => item.oncallUser?.id === currentUserId)
    : oncallData;

  const renderOnCallItem = ({ item }: { item: OnCallData }) => {
    const isMe = item.oncallUser?.id === currentUserId;

    return (
      <Card style={dynamicStyles.card} mode="elevated">
        <Card.Content>
          {/* Service Header */}
          <View style={styles.serviceHeader}>
            <View style={styles.serviceTitleContainer}>
              <MaterialCommunityIcons
                name="server"
                size={20}
                color={theme.colors.primary}
              />
              <Text variant="titleMedium" style={styles.serviceName}>
                {item.service.name}
              </Text>
            </View>
            <View style={styles.badges}>
              {isMe && (
                <Chip
                  compact
                  style={styles.youChip}
                  textStyle={styles.youChipText}
                  icon="account"
                >
                  You
                </Chip>
              )}
              {item.isOverride && (
                <Chip
                  compact
                  style={styles.overrideChip}
                  textStyle={styles.overrideChipText}
                  icon="swap-horizontal"
                >
                  Override
                </Chip>
              )}
            </View>
          </View>

          {/* On-Call User */}
          {item.oncallUser ? (
            <View style={styles.userContainer}>
              <OwnerAvatar
                name={item.oncallUser.fullName}
                email={item.oncallUser.email}
                size={48}
              />
              <View style={styles.userInfo}>
                <Text variant="titleMedium" style={styles.userName}>
                  {item.oncallUser.fullName}
                </Text>
                <View style={styles.emailContainer}>
                  <MaterialCommunityIcons name="email-outline" size={14} color={colors.textSecondary} />
                  <Text variant="bodySmall" style={styles.userEmail}>
                    {item.oncallUser.email}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.noUserContainer}>
              <MaterialCommunityIcons name="account-off-outline" size={48} color={colors.warning} />
              <View style={styles.userInfo}>
                <Text variant="titleMedium" style={styles.noUserText}>
                  No one on call
                </Text>
                <Text variant="bodySmall" style={styles.noUserSubtext}>
                  Assign someone to this schedule
                </Text>
              </View>
            </View>
          )}

          {/* Schedule Info */}
          <View style={styles.scheduleContainer}>
            <MaterialCommunityIcons name="calendar-clock" size={16} color={colors.textSecondary} />
            <Text variant="bodySmall" style={styles.scheduleText}>
              {item.schedule.name}
            </Text>
          </View>

          {/* Override Until */}
          {item.isOverride && item.overrideUntil && (
            <View style={styles.overrideInfo}>
              <MaterialCommunityIcons name="clock-alert-outline" size={16} color={colors.warning} />
              <Text variant="bodySmall" style={styles.overrideText}>
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
              style={styles.takeOverButton}
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
              style={[styles.takeOverButton, { borderColor: colors.warning }]}
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
      <View style={[dynamicStyles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading on-call data...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[dynamicStyles.container, styles.centerContent]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color={colors.error} />
        <Text variant="bodyLarge" style={styles.errorText}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <FlatList
        data={filteredData}
        renderItem={renderOnCallItem}
        keyExtractor={(item) => `${item.service.id}-${item.schedule.id}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        windowSize={8}
        initialNumToRender={6}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="headlineSmall" style={styles.headerTitle}>
              Who's On Call
            </Text>
            <Text variant="bodyMedium" style={styles.headerSubtitle}>
              Current on-call responders by service
            </Text>
            <SegmentedButtons
              value={segment}
              onValueChange={(value) => setSegment(value as 'mine' | 'all')}
              buttons={[
                {
                  value: 'mine',
                  label: 'My Schedule',
                  icon: 'account',
                },
                {
                  value: 'all',
                  label: 'All Schedules',
                  icon: 'account-group',
                },
              ]}
              style={styles.segmentedButtons}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name={segment === 'mine' ? 'calendar-check' : 'calendar-remove-outline'}
              size={64}
              color={colors.textMuted}
            />
            <Text variant="titleMedium" style={styles.emptyText}>
              {segment === 'mine' ? "You're not on call" : 'No on-call schedules'}
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtext}>
              {segment === 'mine'
                ? 'Check "All Schedules" to see who is currently on call'
                : 'Set up schedules in the web app to see on-call responders here'}
            </Text>
          </View>
        }
      />

      {/* Take Over Confirmation Modal */}
      <Portal>
        <Modal
          visible={showTakeOverModal}
          onDismiss={() => setShowTakeOverModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={dynamicStyles.modalContent}>
            <MaterialCommunityIcons name="account-switch" size={48} color={colors.accent} />
            <Text variant="titleLarge" style={styles.modalTitle}>
              Take Over On-Call?
            </Text>
            <Text variant="bodyMedium" style={styles.modalDescription}>
              You will become the on-call responder for{' '}
              <Text style={styles.modalServiceName}>{selectedSchedule?.service.name}</Text>.
              {selectedSchedule?.oncallUser && (
                <Text>{'\n'}{selectedSchedule.oncallUser.fullName} will be notified.</Text>
              )}
            </Text>

            {/* Duration Picker */}
            <View style={styles.durationSection}>
              <Text variant="titleSmall" style={styles.durationLabel}>
                Override Duration
              </Text>
              <RadioButton.Group
                onValueChange={(value) => setSelectedDuration(parseInt(value))}
                value={selectedDuration.toString()}
              >
                {OVERRIDE_DURATIONS.map((duration) => (
                  <Pressable
                    key={duration.hours}
                    style={styles.durationOption}
                    onPress={() => setSelectedDuration(duration.hours)}
                  >
                    <RadioButton.Android
                      value={duration.hours.toString()}
                      color={colors.accent}
                    />
                    <Text style={styles.durationText}>{duration.label}</Text>
                  </Pressable>
                ))}
              </RadioButton.Group>
            </View>

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowTakeOverModal(false)}
                style={styles.modalButton}
                disabled={takeOverLoading}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleTakeOver}
                buttonColor={colors.accent}
                style={styles.modalButton}
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
  errorText: {
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
  },
  listContent: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
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
    height: 28,
  },
  overrideChipText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '600',
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: colors.textMuted,
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  segmentedButtons: {
    marginTop: 16,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  youChip: {
    backgroundColor: colors.successLight,
    height: 28,
  },
  youChipText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '600',
  },
  takeOverButton: {
    marginTop: 16,
    borderColor: colors.accent,
    borderRadius: 8,
  },
  modalContainer: {
    margin: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
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
