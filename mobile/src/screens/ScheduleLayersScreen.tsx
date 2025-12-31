import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Pressable,
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
  List,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAppTheme } from '../context/ThemeContext';
import { useToast, OwnerAvatar } from '../components';
import * as apiService from '../services/apiService';
import type {
  ScheduleLayer,
  ScheduleOverride,
  RotationType,
  User,
  Schedule,
} from '../services/apiService';
import * as hapticService from '../services/hapticService';

type RouteParams = {
  ScheduleLayers: { scheduleId: string; scheduleName: string };
};

type NavigationProp = StackNavigationProp<any>;

const ROTATION_TYPES: { value: RotationType; label: string; description: string }[] = [
  { value: 'daily', label: 'Daily', description: 'Rotate every day' },
  { value: 'weekly', label: 'Weekly', description: 'Rotate every week' },
  { value: 'custom', label: 'Custom', description: 'Custom rotation length' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduleLayersScreen() {
  const route = useRoute<RouteProp<RouteParams, 'ScheduleLayers'>>();
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const { scheduleId, scheduleName } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [layers, setLayers] = useState<ScheduleLayer[]>([]);
  const [overrides, setOverrides] = useState<{
    active: ScheduleOverride[];
    upcoming: ScheduleOverride[];
    recent: ScheduleOverride[];
  }>({ active: [], upcoming: [], recent: [] });
  const [users, setUsers] = useState<User[]>([]);
  const [showLayerModal, setShowLayerModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<ScheduleLayer | null>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'layers' | 'overrides'>('layers');

  // Layer form state
  const [layerName, setLayerName] = useState('');
  const [rotationType, setRotationType] = useState<RotationType>('daily');
  const [handoffTime, setHandoffTime] = useState('09:00');
  const [handoffDay, setHandoffDay] = useState(1); // Monday
  const [rotationLength, setRotationLength] = useState('1');

  // Override form state
  const [overrideUserId, setOverrideUserId] = useState('');
  const [overrideStartDate, setOverrideStartDate] = useState('');
  const [overrideStartTime, setOverrideStartTime] = useState('09:00');
  const [overrideEndDate, setOverrideEndDate] = useState('');
  const [overrideEndTime, setOverrideEndTime] = useState('17:00');
  const [overrideReason, setOverrideReason] = useState('');

  // Members selection
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  useEffect(() => {
    navigation.setOptions({ title: `${scheduleName} - Layers` });
    fetchData();
  }, [scheduleId]);

  const fetchData = async () => {
    try {
      const [layersData, overridesData, usersData] = await Promise.all([
        apiService.getScheduleLayers(scheduleId),
        apiService.getScheduleOverrides(scheduleId),
        apiService.getUsers(),
      ]);
      setLayers(layersData.sort((a, b) => a.layerOrder - b.layerOrder));
      setOverrides(overridesData);
      setUsers(usersData);
    } catch (error: any) {
      console.error('Failed to fetch schedule data:', error);
      showToast({ message: 'Failed to load schedule data', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [scheduleId]);

  const handleCreateLayer = async () => {
    if (!layerName.trim()) {
      showToast({ message: 'Layer name is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.createScheduleLayer(scheduleId, {
        name: layerName.trim(),
        rotationType,
        startDate: new Date().toISOString(),
        handoffTime: `${handoffTime}:00`,
        handoffDay: rotationType === 'weekly' ? handoffDay : undefined,
        rotationLength: rotationType === 'custom' ? parseInt(rotationLength, 10) : undefined,
      });
      hapticService.success();
      showToast({ message: 'Layer created', type: 'success' });
      setShowLayerModal(false);
      resetLayerForm();
      fetchData();
    } catch (error: any) {
      console.error('Failed to create layer:', error);
      showToast({ message: error.response?.data?.error || 'Failed to create layer', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLayer = async () => {
    if (!selectedLayer || !layerName.trim()) return;

    setSaving(true);
    try {
      await apiService.updateScheduleLayer(scheduleId, selectedLayer.id, {
        name: layerName.trim(),
        rotationType,
        handoffTime: `${handoffTime}:00`,
        handoffDay: rotationType === 'weekly' ? handoffDay : null,
        rotationLength: rotationType === 'custom' ? parseInt(rotationLength, 10) : undefined,
      });
      hapticService.success();
      showToast({ message: 'Layer updated', type: 'success' });
      setShowLayerModal(false);
      resetLayerForm();
      fetchData();
    } catch (error: any) {
      console.error('Failed to update layer:', error);
      showToast({ message: error.response?.data?.error || 'Failed to update layer', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLayer = (layer: ScheduleLayer) => {
    hapticService.warning();
    Alert.alert(
      'Delete Layer',
      `Are you sure you want to delete "${layer.name}"? This will affect on-call assignments.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteScheduleLayer(scheduleId, layer.id);
              hapticService.success();
              showToast({ message: 'Layer deleted', type: 'success' });
              fetchData();
            } catch (error: any) {
              showToast({ message: error.response?.data?.error || 'Failed to delete layer', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleSaveMembers = async () => {
    if (!selectedLayer) return;

    setSaving(true);
    try {
      await apiService.setScheduleLayerMembers(scheduleId, selectedLayer.id, selectedMemberIds);
      hapticService.success();
      showToast({ message: 'Members updated', type: 'success' });
      setShowMembersModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Failed to update members:', error);
      showToast({ message: error.response?.data?.error || 'Failed to update members', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOverride = async () => {
    if (!overrideUserId || !overrideStartDate || !overrideEndDate) {
      showToast({ message: 'User and dates are required', type: 'error' });
      return;
    }

    const startTime = new Date(`${overrideStartDate}T${overrideStartTime}:00`).toISOString();
    const endTime = new Date(`${overrideEndDate}T${overrideEndTime}:00`).toISOString();

    if (new Date(endTime) <= new Date(startTime)) {
      showToast({ message: 'End time must be after start time', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.createLayerOverride(scheduleId, {
        userId: overrideUserId,
        startTime,
        endTime,
        reason: overrideReason.trim() || undefined,
      });
      hapticService.success();
      showToast({ message: 'Override created', type: 'success' });
      setShowOverrideModal(false);
      resetOverrideForm();
      fetchData();
    } catch (error: any) {
      console.error('Failed to create override:', error);
      showToast({ message: error.response?.data?.error || 'Failed to create override', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOverride = (override: ScheduleOverride) => {
    hapticService.warning();
    Alert.alert(
      'Delete Override',
      'Are you sure you want to delete this override?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteLayerOverride(scheduleId, override.id);
              hapticService.success();
              showToast({ message: 'Override deleted', type: 'success' });
              fetchData();
            } catch (error: any) {
              showToast({ message: error.response?.data?.error || 'Failed to delete override', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const openEditLayerModal = (layer: ScheduleLayer) => {
    setSelectedLayer(layer);
    setLayerName(layer.name);
    setRotationType(layer.rotationType);
    setHandoffTime(layer.handoffTime.substring(0, 5));
    setHandoffDay(layer.handoffDay || 1);
    setRotationLength(layer.rotationLength?.toString() || '1');
    setShowLayerModal(true);
    setMenuVisible(null);
  };

  const openMembersModal = (layer: ScheduleLayer) => {
    setSelectedLayer(layer);
    setSelectedMemberIds(layer.members.map(m => m.userId));
    setShowMembersModal(true);
    setMenuVisible(null);
  };

  const resetLayerForm = () => {
    setSelectedLayer(null);
    setLayerName('');
    setRotationType('daily');
    setHandoffTime('09:00');
    setHandoffDay(1);
    setRotationLength('1');
  };

  const resetOverrideForm = () => {
    setOverrideUserId('');
    setOverrideStartDate('');
    setOverrideStartTime('09:00');
    setOverrideEndDate('');
    setOverrideEndTime('17:00');
    setOverrideReason('');
  };

  const formatDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRotationDescription = (layer: ScheduleLayer): string => {
    switch (layer.rotationType) {
      case 'daily':
        return `Rotates daily at ${layer.handoffTime.substring(0, 5)}`;
      case 'weekly':
        return `Rotates ${DAYS_OF_WEEK[layer.handoffDay || 0]} at ${layer.handoffTime.substring(0, 5)}`;
      case 'custom':
        return `Rotates every ${layer.rotationLength} days at ${layer.handoffTime.substring(0, 5)}`;
      default:
        return 'Unknown rotation';
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading schedule...
        </Text>
      </View>
    );
  }

  const allOverrides = [...overrides.active, ...overrides.upcoming];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'layers' | 'overrides')}
          buttons={[
            { value: 'layers', label: `Layers (${layers.length})` },
            { value: 'overrides', label: `Overrides (${allOverrides.length})` },
          ]}
          style={styles.tabs}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {activeTab === 'layers' ? (
          <>
            {layers.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="layers-outline" size={64} color={colors.textMuted} />
                <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                  No Rotation Layers
                </Text>
                <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>
                  Create layers to define who's on-call and when they rotate.
                </Text>
                <Button
                  mode="contained"
                  onPress={() => {
                    hapticService.lightTap();
                    setShowLayerModal(true);
                  }}
                  style={styles.emptyButton}
                >
                  Create First Layer
                </Button>
              </View>
            ) : (
              layers.map((layer, index) => (
                <Card key={layer.id} style={[styles.layerCard, { backgroundColor: colors.surface }]}>
                  <Card.Content>
                    <View style={styles.layerHeader}>
                      <View style={[styles.layerOrderBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.layerOrderText}>{layer.layerOrder}</Text>
                      </View>
                      <View style={styles.layerInfo}>
                        <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
                          {layer.name}
                        </Text>
                        <Text variant="bodySmall" style={{ color: colors.textSecondary, marginTop: 2 }}>
                          {getRotationDescription(layer)}
                        </Text>
                      </View>
                      <Menu
                        visible={menuVisible === layer.id}
                        onDismiss={() => setMenuVisible(null)}
                        anchor={
                          <IconButton
                            icon="dots-vertical"
                            size={20}
                            onPress={() => setMenuVisible(layer.id)}
                          />
                        }
                      >
                        <Menu.Item
                          onPress={() => openEditLayerModal(layer)}
                          title="Edit"
                          leadingIcon="pencil"
                        />
                        <Menu.Item
                          onPress={() => openMembersModal(layer)}
                          title="Manage Members"
                          leadingIcon="account-multiple"
                        />
                        <Divider />
                        <Menu.Item
                          onPress={() => {
                            setMenuVisible(null);
                            handleDeleteLayer(layer);
                          }}
                          title="Delete"
                          leadingIcon="delete"
                          titleStyle={{ color: colors.error }}
                        />
                      </Menu>
                    </View>

                    {/* Members Preview */}
                    <View style={styles.membersSection}>
                      <Text variant="labelSmall" style={{ color: colors.textMuted, marginBottom: 8 }}>
                        ROTATION MEMBERS ({layer.members.length})
                      </Text>
                      {layer.members.length === 0 ? (
                        <Pressable
                          onPress={() => openMembersModal(layer)}
                          style={[styles.addMembersButton, { borderColor: colors.border }]}
                        >
                          <MaterialCommunityIcons name="account-plus" size={20} color={colors.primary} />
                          <Text style={{ color: colors.primary, marginLeft: 8 }}>Add members</Text>
                        </Pressable>
                      ) : (
                        <View style={styles.membersList}>
                          {layer.members
                            .sort((a, b) => a.position - b.position)
                            .map((member, idx) => (
                              <View key={member.id} style={styles.memberRow}>
                                <Text style={[styles.memberPosition, { color: colors.textMuted }]}>
                                  {idx + 1}.
                                </Text>
                                <OwnerAvatar
                                  name={member.user?.fullName || member.user?.email || '?'}
                                  email={member.user?.email}
                                  size={28}
                                />
                                <Text
                                  variant="bodyMedium"
                                  style={{ color: colors.textPrimary, marginLeft: 8, flex: 1 }}
                                  numberOfLines={1}
                                >
                                  {member.user?.fullName || member.user?.email || 'Unknown'}
                                </Text>
                                {layer.currentOncallUserId === member.userId && (
                                  <Chip
                                    compact
                                    style={{ backgroundColor: `${colors.success}20` }}
                                    textStyle={{ color: colors.success, fontSize: 10 }}
                                  >
                                    On-Call
                                  </Chip>
                                )}
                              </View>
                            ))}
                        </View>
                      )}
                    </View>
                  </Card.Content>
                </Card>
              ))
            )}
          </>
        ) : (
          <>
            {allOverrides.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="swap-horizontal" size={64} color={colors.textMuted} />
                <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                  No Overrides
                </Text>
                <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>
                  Create overrides to temporarily assign someone else to be on-call.
                </Text>
                <Button
                  mode="contained"
                  onPress={() => {
                    hapticService.lightTap();
                    setShowOverrideModal(true);
                  }}
                  style={styles.emptyButton}
                >
                  Create Override
                </Button>
              </View>
            ) : (
              <>
                {overrides.active.length > 0 && (
                  <View style={styles.overrideSection}>
                    <Text variant="labelMedium" style={[styles.sectionLabel, { color: colors.textMuted }]}>
                      ACTIVE NOW
                    </Text>
                    {overrides.active.map((override) => (
                      <Card key={override.id} style={[styles.overrideCard, { backgroundColor: colors.surface }]}>
                        <Card.Content style={styles.overrideContent}>
                          <OwnerAvatar
                            name={override.user?.fullName || '?'}
                            email={override.user?.email}
                            size={40}
                          />
                          <View style={styles.overrideInfo}>
                            <Text variant="bodyLarge" style={{ color: colors.textPrimary, fontWeight: '500' }}>
                              {override.user?.fullName || 'Unknown'}
                            </Text>
                            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                              {formatDateTime(override.startTime)} - {formatDateTime(override.endTime)}
                            </Text>
                            {override.reason && (
                              <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 2 }}>
                                {override.reason}
                              </Text>
                            )}
                          </View>
                          <Chip compact style={{ backgroundColor: `${colors.success}20` }} textStyle={{ color: colors.success }}>
                            Active
                          </Chip>
                          <IconButton
                            icon="close"
                            size={18}
                            onPress={() => handleDeleteOverride(override)}
                          />
                        </Card.Content>
                      </Card>
                    ))}
                  </View>
                )}

                {overrides.upcoming.length > 0 && (
                  <View style={styles.overrideSection}>
                    <Text variant="labelMedium" style={[styles.sectionLabel, { color: colors.textMuted }]}>
                      UPCOMING
                    </Text>
                    {overrides.upcoming.map((override) => (
                      <Card key={override.id} style={[styles.overrideCard, { backgroundColor: colors.surface }]}>
                        <Card.Content style={styles.overrideContent}>
                          <OwnerAvatar
                            name={override.user?.fullName || '?'}
                            email={override.user?.email}
                            size={40}
                          />
                          <View style={styles.overrideInfo}>
                            <Text variant="bodyLarge" style={{ color: colors.textPrimary, fontWeight: '500' }}>
                              {override.user?.fullName || 'Unknown'}
                            </Text>
                            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                              {formatDateTime(override.startTime)} - {formatDateTime(override.endTime)}
                            </Text>
                            {override.reason && (
                              <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 2 }}>
                                {override.reason}
                              </Text>
                            )}
                          </View>
                          <Chip compact style={{ backgroundColor: `${colors.primary}20` }} textStyle={{ color: colors.primary }}>
                            Scheduled
                          </Chip>
                          <IconButton
                            icon="close"
                            size={18}
                            onPress={() => handleDeleteOverride(override)}
                          />
                        </Card.Content>
                      </Card>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        color="#fff"
        onPress={() => {
          hapticService.lightTap();
          if (activeTab === 'layers') {
            setShowLayerModal(true);
          } else {
            setShowOverrideModal(true);
          }
        }}
      />

      {/* Create/Edit Layer Modal */}
      <Portal>
        <Modal
          visible={showLayerModal}
          onDismiss={() => {
            setShowLayerModal(false);
            resetLayerForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {selectedLayer ? 'Edit Layer' : 'Create Layer'}
            </Text>

            <TextInput
              label="Layer Name"
              value={layerName}
              onChangeText={setLayerName}
              mode="outlined"
              style={styles.input}
            />

            <Text variant="labelLarge" style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Rotation Type
            </Text>
            <SegmentedButtons
              value={rotationType}
              onValueChange={(value) => setRotationType(value as RotationType)}
              buttons={ROTATION_TYPES.map(t => ({ value: t.value, label: t.label }))}
              style={styles.segmentedButtons}
            />

            <TextInput
              label="Handoff Time (HH:MM)"
              value={handoffTime}
              onChangeText={setHandoffTime}
              mode="outlined"
              style={styles.input}
              placeholder="09:00"
            />

            {rotationType === 'weekly' && (
              <View style={styles.daySelector}>
                <Text variant="labelMedium" style={{ color: colors.textSecondary, marginBottom: 8 }}>
                  Handoff Day
                </Text>
                <View style={styles.daysRow}>
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <Pressable
                      key={day}
                      style={[
                        styles.dayButton,
                        { borderColor: handoffDay === idx ? colors.primary : colors.border },
                        handoffDay === idx && { backgroundColor: `${colors.primary}20` },
                      ]}
                      onPress={() => setHandoffDay(idx)}
                    >
                      <Text
                        style={{ color: handoffDay === idx ? colors.primary : colors.textSecondary }}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {rotationType === 'custom' && (
              <TextInput
                label="Rotation Length (days)"
                value={rotationLength}
                onChangeText={setRotationLength}
                mode="outlined"
                keyboardType="number-pad"
                style={styles.input}
              />
            )}

            <View style={styles.modalActions}>
              <Button
                mode="text"
                onPress={() => {
                  setShowLayerModal(false);
                  resetLayerForm();
                }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={selectedLayer ? handleUpdateLayer : handleCreateLayer}
                loading={saving}
                disabled={saving}
              >
                {selectedLayer ? 'Save' : 'Create'}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Members Modal */}
      <Portal>
        <Modal
          visible={showMembersModal}
          onDismiss={() => setShowMembersModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Manage Members
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
            Select users for the rotation. Order determines rotation sequence.
          </Text>

          <ScrollView style={styles.membersList}>
            {users.map((user) => (
              <Pressable
                key={user.id}
                style={[
                  styles.memberOption,
                  selectedMemberIds.includes(user.id) && { backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => toggleMember(user.id)}
              >
                <OwnerAvatar name={user.fullName || user.email} email={user.email} size={36} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>
                    {user.fullName || 'No name'}
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                    {user.email}
                  </Text>
                </View>
                {selectedMemberIds.includes(user.id) && (
                  <View style={styles.memberOrder}>
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>
                      #{selectedMemberIds.indexOf(user.id) + 1}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowMembersModal(false)}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleSaveMembers} loading={saving} disabled={saving}>
              Save ({selectedMemberIds.length} selected)
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Create Override Modal */}
      <Portal>
        <Modal
          visible={showOverrideModal}
          onDismiss={() => {
            setShowOverrideModal(false);
            resetOverrideForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Create Override
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
              Temporarily assign someone to be on-call.
            </Text>

            <Text variant="labelMedium" style={{ color: colors.textSecondary, marginBottom: 8 }}>
              Select User
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.userScroll}>
              {users.map((user) => (
                <Pressable
                  key={user.id}
                  style={[
                    styles.userOption,
                    { borderColor: overrideUserId === user.id ? colors.primary : colors.border },
                    overrideUserId === user.id && { backgroundColor: `${colors.primary}10` },
                  ]}
                  onPress={() => setOverrideUserId(user.id)}
                >
                  <OwnerAvatar name={user.fullName || user.email} email={user.email} size={32} />
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.textPrimary, marginTop: 4 }}
                    numberOfLines={1}
                  >
                    {user.fullName?.split(' ')[0] || user.email.split('@')[0]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <TextInput
              label="Start Date (YYYY-MM-DD)"
              value={overrideStartDate}
              onChangeText={setOverrideStartDate}
              mode="outlined"
              style={styles.input}
              placeholder="2024-01-15"
            />

            <TextInput
              label="Start Time (HH:MM)"
              value={overrideStartTime}
              onChangeText={setOverrideStartTime}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="End Date (YYYY-MM-DD)"
              value={overrideEndDate}
              onChangeText={setOverrideEndDate}
              mode="outlined"
              style={styles.input}
              placeholder="2024-01-15"
            />

            <TextInput
              label="End Time (HH:MM)"
              value={overrideEndTime}
              onChangeText={setOverrideEndTime}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Reason (optional)"
              value={overrideReason}
              onChangeText={setOverrideReason}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., PTO, coverage swap"
            />

            <View style={styles.modalActions}>
              <Button
                mode="text"
                onPress={() => {
                  setShowOverrideModal(false);
                  resetOverrideForm();
                }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleCreateOverride}
                loading={saving}
                disabled={saving}
              >
                Create Override
              </Button>
            </View>
          </ScrollView>
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
  tabContainer: {
    padding: 16,
    paddingBottom: 0,
  },
  tabs: {
    marginBottom: 8,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyButton: {
    marginTop: 24,
  },
  layerCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  layerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  layerOrderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  layerOrderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  layerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  membersSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  membersList: {
    maxHeight: 300,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  memberPosition: {
    width: 24,
    fontSize: 12,
  },
  addMembersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  overrideSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  overrideCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  overrideContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overrideInfo: {
    flex: 1,
    marginLeft: 12,
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
    maxHeight: '85%',
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  daySelector: {
    marginBottom: 16,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayButton: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  memberOrder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userScroll: {
    marginBottom: 16,
  },
  userOption: {
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginRight: 8,
    minWidth: 80,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
});
