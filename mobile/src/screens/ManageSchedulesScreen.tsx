import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  FAB,
  Portal,
  Modal,
  Button,
  TextInput,
  ActivityIndicator,
  Chip,
  IconButton,
  Menu,
  Divider,
  SegmentedButtons,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import { useToast, OwnerAvatar } from '../components';
import * as apiService from '../services/apiService';
import type { Schedule } from '../services/apiService';
import * as hapticService from '../services/hapticService';

const ROTATION_TYPES = [
  { value: 'manual', label: 'Manual' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

export default function ManageSchedulesScreen({ navigation }: { navigation: any }) {
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleDescription, setScheduleDescription] = useState('');
  const [scheduleTimezone, setScheduleTimezone] = useState('America/New_York');
  const [rotationType, setRotationType] = useState<'manual' | 'daily' | 'weekly'>('weekly');
  const [handoffTime, setHandoffTime] = useState('09:00');

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const data = await apiService.getSchedules();
      setSchedules(data);
    } catch (error: any) {
      console.error('Failed to fetch schedules:', error);
      showToast({ message: 'Failed to load schedules', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSchedules();
  }, []);

  const handleCreate = async () => {
    if (!scheduleName.trim()) {
      showToast({ message: 'Schedule name is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.createSchedule({
        name: scheduleName.trim(),
        type: rotationType,
        description: scheduleDescription.trim() || undefined,
        timezone: scheduleTimezone,
      });
      hapticService.success();
      showToast({ message: 'Schedule created', type: 'success' });
      setShowCreateModal(false);
      resetForm();
      fetchSchedules();
    } catch (error: any) {
      console.error('Failed to create schedule:', error);
      showToast({ message: error.message || 'Failed to create schedule', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedSchedule || !scheduleName.trim()) return;

    setSaving(true);
    try {
      await apiService.updateSchedule(selectedSchedule.id, {
        name: scheduleName.trim(),
        description: scheduleDescription.trim() || undefined,
        timezone: scheduleTimezone,
      });
      hapticService.success();
      showToast({ message: 'Schedule updated', type: 'success' });
      setShowEditModal(false);
      resetForm();
      fetchSchedules();
    } catch (error: any) {
      console.error('Failed to update schedule:', error);
      showToast({ message: error.message || 'Failed to update schedule', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (schedule: Schedule) => {
    hapticService.warning();
    Alert.alert(
      'Delete Schedule',
      `Are you sure you want to delete "${schedule.name}"? This will affect all users in this rotation.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteSchedule(schedule.id);
              hapticService.success();
              showToast({ message: 'Schedule deleted', type: 'success' });
              fetchSchedules();
            } catch (error: any) {
              showToast({ message: error.message || 'Failed to delete schedule', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleUpdateRotation = async () => {
    if (!selectedSchedule) return;

    setSaving(true);
    try {
      await apiService.updateScheduleRotation(selectedSchedule.id, {
        type: rotationType,
        handoffTime,
      });
      hapticService.success();
      showToast({ message: 'Rotation settings updated', type: 'success' });
      setShowRotationModal(false);
      fetchSchedules();
    } catch (error: any) {
      console.error('Failed to update rotation:', error);
      showToast({ message: error.message || 'Failed to update rotation', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setScheduleName(schedule.name);
    setScheduleDescription(schedule.description || '');
    setScheduleTimezone(schedule.timezone || 'America/New_York');
    setShowEditModal(true);
    setMenuVisible(null);
  };

  const openRotationModal = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setRotationType(schedule.type || 'weekly');
    setHandoffTime((schedule.rotationConfig as any)?.handoffTime || '09:00');
    setShowRotationModal(true);
    setMenuVisible(null);
  };

  const resetForm = () => {
    setScheduleName('');
    setScheduleDescription('');
    setScheduleTimezone('America/New_York');
    setSelectedSchedule(null);
  };

  const viewScheduleDetails = (schedule: Schedule) => {
    setMenuVisible(null);
    navigation.navigate('Schedule', { id: schedule.id });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading schedules...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {schedules.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-edit" size={64} color={colors.textMuted} />
            <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              No Schedules
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>
              Create your first on-call schedule to manage rotations.
            </Text>
          </View>
        ) : (
          schedules.map((schedule) => (
            <Card key={schedule.id} style={[styles.scheduleCard, { backgroundColor: colors.surface }]}>
              <Card.Content>
                <View style={styles.scheduleHeader}>
                  <View style={styles.scheduleInfo}>
                    <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
                      {schedule.name}
                    </Text>
                    {schedule.description && (
                      <Text variant="bodySmall" style={{ color: colors.textSecondary, marginTop: 2 }}>
                        {schedule.description}
                      </Text>
                    )}
                    <View style={styles.scheduleMeta}>
                      <Chip
                        compact
                        icon="clock-outline"
                        style={[styles.metaChip, { backgroundColor: `${colors.primary}15` }]}
                        textStyle={{ color: colors.primary, fontSize: 11 }}
                      >
                        {schedule.timezone || 'UTC'}
                      </Chip>
                      <Chip
                        compact
                        icon="rotate-3d-variant"
                        style={[styles.metaChip, { backgroundColor: `${colors.success}15` }]}
                        textStyle={{ color: colors.success, fontSize: 11 }}
                      >
                        {schedule.type}
                      </Chip>
                    </View>
                  </View>
                  <Menu
                    visible={menuVisible === schedule.id}
                    onDismiss={() => setMenuVisible(null)}
                    anchor={
                      <IconButton
                        icon="dots-vertical"
                        size={20}
                        onPress={() => setMenuVisible(schedule.id)}
                      />
                    }
                  >
                    <Menu.Item
                      onPress={() => viewScheduleDetails(schedule)}
                      title="View Details"
                      leadingIcon="eye"
                    />
                    <Menu.Item
                      onPress={() => openEditModal(schedule)}
                      title="Edit"
                      leadingIcon="pencil"
                    />
                    <Menu.Item
                      onPress={() => openRotationModal(schedule)}
                      title="Rotation Settings"
                      leadingIcon="rotate-3d-variant"
                    />
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        navigation.navigate('ScheduleLayers', {
                          scheduleId: schedule.id,
                          scheduleName: schedule.name,
                        });
                      }}
                      title="Manage Layers"
                      leadingIcon="layers"
                    />
                    <Divider />
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        handleDelete(schedule);
                      }}
                      title="Delete"
                      leadingIcon="delete"
                      titleStyle={{ color: colors.error }}
                    />
                  </Menu>
                </View>

                {/* Schedule Status */}
                {schedule.isOverride && (
                  <View style={[styles.currentOnCall, { borderTopColor: colors.border }]}>
                    <Chip
                      compact
                      icon="swap-horizontal"
                      style={{ backgroundColor: `${colors.warning}20` }}
                      textStyle={{ color: colors.warning, fontSize: 11 }}
                    >
                      Override active until {schedule.overrideUntil ? new Date(schedule.overrideUntil).toLocaleDateString() : 'N/A'}
                    </Chip>
                  </View>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        color="#fff"
        onPress={() => {
          hapticService.lightTap();
          setShowCreateModal(true);
        }}
      />

      {/* Create Modal */}
      <Portal>
        <Modal
          visible={showCreateModal}
          onDismiss={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Create Schedule
          </Text>
          <TextInput
            label="Schedule Name"
            value={scheduleName}
            onChangeText={setScheduleName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Description (optional)"
            value={scheduleDescription}
            onChangeText={setScheduleDescription}
            mode="outlined"
            multiline
            numberOfLines={2}
            style={styles.input}
          />
          <TextInput
            label="Timezone"
            value={scheduleTimezone}
            onChangeText={setScheduleTimezone}
            mode="outlined"
            style={styles.input}
            placeholder="e.g., America/New_York"
          />
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button mode="contained" onPress={handleCreate} loading={saving} disabled={saving}>
              Create
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Edit Modal */}
      <Portal>
        <Modal
          visible={showEditModal}
          onDismiss={() => {
            setShowEditModal(false);
            resetForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Edit Schedule
          </Text>
          <TextInput
            label="Schedule Name"
            value={scheduleName}
            onChangeText={setScheduleName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Description (optional)"
            value={scheduleDescription}
            onChangeText={setScheduleDescription}
            mode="outlined"
            multiline
            numberOfLines={2}
            style={styles.input}
          />
          <TextInput
            label="Timezone"
            value={scheduleTimezone}
            onChangeText={setScheduleTimezone}
            mode="outlined"
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setShowEditModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button mode="contained" onPress={handleUpdate} loading={saving} disabled={saving}>
              Save
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Rotation Settings Modal */}
      <Portal>
        <Modal
          visible={showRotationModal}
          onDismiss={() => setShowRotationModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Rotation Settings
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
            Configure how on-call rotates for {selectedSchedule?.name}
          </Text>

          <Text variant="labelMedium" style={{ color: colors.textSecondary, marginBottom: 8 }}>
            Rotation Type
          </Text>
          <SegmentedButtons
            value={rotationType}
            onValueChange={(value) => setRotationType(value as typeof rotationType)}
            buttons={ROTATION_TYPES}
            style={styles.segmentedButtons}
          />

          <TextInput
            label="Handoff Time"
            value={handoffTime}
            onChangeText={setHandoffTime}
            mode="outlined"
            placeholder="HH:MM (24-hour)"
            style={styles.input}
          />

          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowRotationModal(false)}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleUpdateRotation} loading={saving} disabled={saving}>
              Save
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
  },
  scheduleCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  metaChip: {
    borderRadius: 6,
  },
  currentOnCall: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  onCallUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  onCallUserInfo: {
    flex: 1,
  },
  membersPreview: {
    marginTop: 12,
  },
  memberAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatarWrapper: {
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 16,
  },
  memberCount: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
