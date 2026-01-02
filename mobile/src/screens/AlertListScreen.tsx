import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert as RNAlert,
  Pressable,
  Animated,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Surface,
  Searchbar,
  Avatar,
  Portal,
  Modal,
  Checkbox,
  IconButton,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as apiService from '../services/apiService';
import * as settingsService from '../services/settingsService';
import * as hapticService from '../services/hapticService';
import * as notificationService from '../services/notificationService';
import type { Incident, OnCallData, Service } from '../services/apiService';
import { useAppTheme } from '../context/ThemeContext';
import { severityColors, statusColors } from '../theme';
import { OwnerAvatar, EscalationBadge, EmptyStatePreset, useToast, toastMessages, useConfetti, UrgencyIndicator } from '../components';

const FILTER_STORAGE_KEY = '@incident_filter';

type FilterType = 'all' | 'mine' | 'triggered' | 'acknowledged' | 'resolved';

export default function AlertListScreen({ navigation }: any) {
  const { theme, colors } = useAppTheme();
  const { showSuccess, showError } = useToast();
  const { showConfetti } = useConfetti();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [onCallData, setOnCallData] = useState<OnCallData[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [snoozedIds, setSnoozedIds] = useState<string[]>([]);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Service filter state
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [showServiceFilter, setShowServiceFilter] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      const [incidentsData, onCallResult, profile, servicesData] = await Promise.all([
        apiService.getIncidents(),
        apiService.getOnCallData().catch(() => []),
        apiService.getUserProfile().catch(() => null),
        apiService.getServices().catch(() => []),
      ]);
      setIncidents(incidentsData);
      setOnCallData(onCallResult);
      setServices(servicesData.filter(s => s.status === 'active'));
      if (profile?.email) {
        setCurrentUserEmail(profile.email);
      }

      // Cache data for offline use
      await settingsService.cacheIncidents(incidentsData);
      await settingsService.cacheOnCallData(onCallResult);
      if (profile) {
        await settingsService.cacheProfile(profile);
      }

      // Update badge count
      const triggeredCount = incidentsData.filter(i => i.state === 'triggered').length;
      await notificationService.setBadgeCount(triggeredCount);

      setIsOffline(false);
    } catch (err: any) {
      // Try to load from cache
      const cachedIncidents = await settingsService.getCachedIncidents();
      const cachedOnCall = await settingsService.getCachedOnCallData();
      const cachedProfile = await settingsService.getCachedProfile();

      if (cachedIncidents) {
        setIncidents(cachedIncidents);
        setIsOffline(true);
      }
      if (cachedOnCall) {
        setOnCallData(cachedOnCall);
      }
      if (cachedProfile?.email) {
        setCurrentUserEmail(cachedProfile.email);
      }

      if (!cachedIncidents) {
        setError(err.message || 'Failed to load incidents');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadSnoozedIncidents = async () => {
    const snoozed = await settingsService.getSnoozedIncidents();
    setSnoozedIds(snoozed.map(s => s.incidentId));
  };

  const loadPersistedFilter = async () => {
    try {
      const savedFilter = await AsyncStorage.getItem(FILTER_STORAGE_KEY);
      if (savedFilter && ['all', 'mine', 'triggered', 'acknowledged', 'resolved'].includes(savedFilter)) {
        setFilter(savedFilter as FilterType);
      }
    } catch (_err) {
      // Use default filter on error
    }
  };

  const saveFilter = async (newFilter: FilterType) => {
    try {
      await AsyncStorage.setItem(FILTER_STORAGE_KEY, newFilter);
    } catch (_err) {
      // Ignore save errors - filter will reset next session
    }
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    saveFilter(newFilter);
  };

  useEffect(() => {
    fetchData();
    loadSnoozedIncidents();
    loadPersistedFilter();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    loadSnoozedIncidents();
  };

  // Calculate stats
  const stats = useMemo(() => {
    const triggered = incidents.filter(i => i.state === 'triggered').length;
    const acknowledged = incidents.filter(i => i.state === 'acknowledged').length;
    const resolved = incidents.filter(i => i.state === 'resolved').length;
    return { triggered, acknowledged, resolved, total: incidents.length };
  }, [incidents]);

  // Filter and search incidents
  const filteredIncidents = useMemo(() => {
    let result = [...incidents];

    // Filter out snoozed incidents
    result = result.filter(i => !snoozedIds.includes(i.id));

    // Apply service filter
    if (selectedServiceId) {
      result = result.filter(i => i.service.id === selectedServiceId);
    }

    // Apply state filter
    if (filter === 'triggered') {
      result = result.filter(i => i.state === 'triggered');
    } else if (filter === 'acknowledged') {
      result = result.filter(i => i.state === 'acknowledged');
    } else if (filter === 'resolved') {
      result = result.filter(i => i.state === 'resolved');
    } else if (filter === 'mine') {
      result = result.filter(i =>
        i.acknowledgedBy?.email === currentUserEmail ||
        i.resolvedBy?.email === currentUserEmail
      );
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.summary.toLowerCase().includes(query) ||
        i.service.name.toLowerCase().includes(query) ||
        i.incidentNumber?.toString().includes(query)
      );
    }

    // Sort: triggered first, then acknowledged, then by time
    result.sort((a, b) => {
      const stateOrder = { triggered: 0, acknowledged: 1, resolved: 2 };
      const aOrder = stateOrder[a.state] ?? 3;
      const bOrder = stateOrder[b.state] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;

      // Within same state, sort by severity
      const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
      const aSev = severityOrder[a.severity as keyof typeof severityOrder] ?? 4;
      const bSev = severityOrder[b.severity as keyof typeof severityOrder] ?? 4;
      if (aSev !== bSev) return aSev - bSev;

      // Then by time (newest first)
      return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
    });

    return result;
  }, [incidents, filter, searchQuery, currentUserEmail, snoozedIds]);

  // Check if user is on-call
  const userOnCall = useMemo(() => {
    return onCallData.find(oc => oc.oncallUser?.email === currentUserEmail);
  }, [onCallData, currentUserEmail]);

  const handleQuickAction = async (incident: Incident, action: 'acknowledge' | 'resolve') => {
    try {
      await hapticService.mediumTap();
      if (action === 'acknowledge') {
        await apiService.acknowledgeIncident(incident.id);
        await hapticService.success();
        showSuccess(toastMessages.acknowledge);
      } else {
        await apiService.resolveIncident(incident.id);
        await hapticService.success();
        showConfetti();
        showSuccess(toastMessages.resolve);
      }
      fetchData();
    } catch (err: any) {
      await hapticService.error();
      showError(err.message || `Failed to ${action} incident`);
    }
  };

  const handleSnooze = async (minutes: number) => {
    if (!selectedIncident) return;
    await hapticService.lightTap();

    try {
      // Store locally and schedule reminder notification
      await settingsService.snoozeIncident(selectedIncident.id, minutes);
      await notificationService.scheduleLocalNotification(
        'Snoozed Incident Reminder',
        selectedIncident.summary,
        { incidentId: selectedIncident.id },
        minutes * 60
      );

      setShowSnoozeModal(false);
      loadSnoozedIncidents();
      await hapticService.success();
      showSuccess(`Incident snoozed for ${minutes} minutes`);
    } catch (error: any) {
      await hapticService.error();
      showError(error.message || 'Failed to snooze incident');
    }
  };

  // Bulk selection functions
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
    hapticService.lightTap();
  };

  const selectAll = () => {
    const actionableIds = filteredIncidents
      .filter((i) => i.state !== 'resolved')
      .map((i) => i.id);
    setSelectedIds(new Set(actionableIds));
    hapticService.lightTap();
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkAcknowledge = async () => {
    const toAcknowledge = Array.from(selectedIds).filter((id) => {
      const incident = incidents.find((i) => i.id === id);
      return incident?.state === 'triggered';
    });

    if (toAcknowledge.length === 0) {
      showError('No active incidents selected');
      return;
    }

    setBulkActionLoading(true);
    try {
      await hapticService.mediumTap();
      await Promise.all(toAcknowledge.map((id) => apiService.acknowledgeIncident(id)));
      await hapticService.success();
      showSuccess(`Acknowledged ${toAcknowledge.length} incident${toAcknowledge.length > 1 ? 's' : ''}`);
      clearSelection();
      fetchData();
    } catch (err: any) {
      await hapticService.error();
      showError(err.message || 'Failed to acknowledge incidents');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkResolve = async () => {
    const toResolve = Array.from(selectedIds).filter((id) => {
      const incident = incidents.find((i) => i.id === id);
      return incident?.state !== 'resolved';
    });

    if (toResolve.length === 0) {
      showError('No actionable incidents selected');
      return;
    }

    setBulkActionLoading(true);
    try {
      await hapticService.mediumTap();
      await Promise.all(toResolve.map((id) => apiService.resolveIncident(id)));
      await hapticService.success();
      showConfetti();
      showSuccess(`Resolved ${toResolve.length} incident${toResolve.length > 1 ? 's' : ''}`);
      clearSelection();
      fetchData();
    } catch (err: any) {
      await hapticService.error();
      showError(err.message || 'Failed to resolve incidents');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    return severityColors[severity as keyof typeof severityColors] || severityColors.default;
  };

  const getStatusColor = (state: string) => {
    return statusColors[state as keyof typeof statusColors] || colors.textSecondary;
  };

  const formatTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  // Swipe action renderers
  const renderLeftActions = useCallback((progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, incident: Incident) => {
    if (incident.state === 'resolved') return null;

    const trans = dragX.interpolate({
      inputRange: [0, 50, 100, 101],
      outputRange: [-20, 0, 0, 1],
    });

    return (
      <Animated.View style={[styles(colors).leftAction, { transform: [{ translateX: trans }] }]}>
        <Pressable
          style={[styles(colors).actionButton, { backgroundColor: colors.success }]}
          onPress={() => handleQuickAction(incident, 'resolve')}
        >
          <MaterialCommunityIcons name="check-all" size={24} color="#fff" />
          <Text style={styles(colors).actionText}>Resolve</Text>
        </Pressable>
      </Animated.View>
    );
  }, [colors]);

  const renderRightActions = useCallback((progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, incident: Incident) => {
    if (incident.state !== 'triggered') return null;

    const trans = dragX.interpolate({
      inputRange: [-101, -100, -50, 0],
      outputRange: [-1, 0, 0, 20],
    });

    return (
      <Animated.View style={[styles(colors).rightActions, { transform: [{ translateX: trans }] }]}>
        <Pressable
          style={styles(colors).actionButton}
          onPress={() => handleQuickAction(incident, 'acknowledge')}
        >
          <MaterialCommunityIcons name="check" size={24} color="#fff" />
          <Text style={styles(colors).actionText}>Ack</Text>
        </Pressable>
      </Animated.View>
    );
  }, [colors]);

  const renderStatsBar = () => (
    <Surface style={styles(colors).statsBar} elevation={0}>
      {isOffline && (
        <View style={styles(colors).offlineBanner}>
          <MaterialCommunityIcons name="cloud-off-outline" size={14} color={colors.warning} />
          <Text style={styles(colors).offlineText}>Offline - showing cached data</Text>
        </View>
      )}
      <View style={styles(colors).statsRow}>
        <Pressable
          style={[styles(colors).statItem, filter === 'triggered' && styles(colors).statItemActive]}
          onPress={() => handleFilterChange(filter === 'triggered' ? 'all' : 'triggered')}
        >
          <View style={[styles(colors).statDot, { backgroundColor: colors.error }]} />
          <Text style={styles(colors).statNumber}>{stats.triggered}</Text>
          <Text style={styles(colors).statLabel}>Open</Text>
        </Pressable>
        <Pressable
          style={[styles(colors).statItem, filter === 'acknowledged' && styles(colors).statItemActive]}
          onPress={() => handleFilterChange(filter === 'acknowledged' ? 'all' : 'acknowledged')}
        >
          <View style={[styles(colors).statDot, { backgroundColor: colors.warning }]} />
          <Text style={styles(colors).statNumber}>{stats.acknowledged}</Text>
          <Text style={styles(colors).statLabel}>Ack'd</Text>
        </Pressable>
        <Pressable
          style={[styles(colors).statItem, filter === 'resolved' && styles(colors).statItemActive]}
          onPress={() => handleFilterChange(filter === 'resolved' ? 'all' : 'resolved')}
        >
          <View style={[styles(colors).statDot, { backgroundColor: colors.success }]} />
          <Text style={styles(colors).statNumber}>{stats.resolved}</Text>
          <Text style={styles(colors).statLabel}>Resolved</Text>
        </Pressable>
      </View>
    </Surface>
  );

  const renderOnCallBanner = () => {
    if (!userOnCall) return null;

    return (
      <Surface style={styles(colors).onCallBanner} elevation={0}>
        <MaterialCommunityIcons name="phone-in-talk" size={18} color={colors.accent} />
        <Text style={styles(colors).onCallText}>
          You're on-call for <Text style={styles(colors).onCallService}>{userOnCall.service.name}</Text>
        </Text>
      </Surface>
    );
  };

  const getSelectedServiceName = () => {
    if (!selectedServiceId) return null;
    const service = services.find(s => s.id === selectedServiceId);
    return service?.name || 'Unknown';
  };

  const renderFilters = () => (
    <View style={styles(colors).filterRow}>
      <Pressable
        style={[styles(colors).filterChip, filter === 'all' && styles(colors).filterChipActive]}
        onPress={() => handleFilterChange('all')}
      >
        <Text style={[styles(colors).filterChipText, filter === 'all' && styles(colors).filterChipTextActive]}>
          All
        </Text>
      </Pressable>
      <Pressable
        style={[styles(colors).filterChip, filter === 'mine' && styles(colors).filterChipActive]}
        onPress={() => handleFilterChange('mine')}
      >
        <MaterialCommunityIcons
          name="account"
          size={14}
          color={filter === 'mine' ? '#fff' : colors.textSecondary}
        />
        <Text style={[styles(colors).filterChipText, filter === 'mine' && styles(colors).filterChipTextActive]}>
          Mine
        </Text>
      </Pressable>
      {/* Service Filter */}
      <Pressable
        style={[styles(colors).filterChip, selectedServiceId && styles(colors).filterChipActive]}
        onPress={() => setShowServiceFilter(true)}
      >
        <MaterialCommunityIcons
          name="server"
          size={14}
          color={selectedServiceId ? '#fff' : colors.textSecondary}
        />
        <Text
          style={[styles(colors).filterChipText, selectedServiceId && styles(colors).filterChipTextActive]}
          numberOfLines={1}
        >
          {selectedServiceId ? getSelectedServiceName() : 'Service'}
        </Text>
        {selectedServiceId && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              setSelectedServiceId(null);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}
          >
            <MaterialCommunityIcons name="close-circle" size={14} color="#fff" />
          </Pressable>
        )}
      </Pressable>
      <View style={{ flex: 1 }} />
      {!isSelectionMode ? (
        <Pressable
          style={styles(colors).filterChip}
          onPress={() => setIsSelectionMode(true)}
        >
          <MaterialCommunityIcons name="checkbox-multiple-outline" size={14} color={colors.textSecondary} />
          <Text style={styles(colors).filterChipText}>Select</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles(colors).filterChip, styles(colors).filterChipActive]}
          onPress={clearSelection}
        >
          <MaterialCommunityIcons name="close" size={14} color="#fff" />
          <Text style={styles(colors).filterChipTextActive}>Cancel</Text>
        </Pressable>
      )}
    </View>
  );

  const renderIncident = ({ item }: { item: Incident }) => {
    const assignee = item.acknowledgedBy || item.resolvedBy;
    const isSelected = selectedIds.has(item.id);
    const isActionable = item.state !== 'resolved';

    const handlePress = () => {
      if (isSelectionMode && isActionable) {
        toggleSelection(item.id);
      } else {
        navigation.navigate('AlertDetail', { alert: item });
      }
    };

    const handleLongPress = () => {
      if (!isSelectionMode && isActionable) {
        setIsSelectionMode(true);
        toggleSelection(item.id);
      }
    };

    return (
      <Swipeable
        renderLeftActions={isSelectionMode ? undefined : (progress, dragX) => renderLeftActions(progress, dragX, item)}
        renderRightActions={isSelectionMode ? undefined : (progress, dragX) => renderRightActions(progress, dragX, item)}
        overshootLeft={false}
        overshootRight={false}
        enabled={!isSelectionMode}
        onSwipeableOpen={(direction) => {
          hapticService.lightTap();
        }}
      >
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
        >
          <Card style={[styles(colors).card, isSelected && styles(colors).cardSelected]} mode="elevated">
            {/* Severity indicator bar */}
            <View style={[styles(colors).severityBar, { backgroundColor: getSeverityColor(item.severity) }]} />

            <Card.Content style={styles(colors).cardContent}>
              <View style={styles(colors).cardRow}>
                {/* Selection checkbox */}
                {isSelectionMode && (
                  <View style={styles(colors).checkboxContainer}>
                    <Checkbox
                      status={isSelected ? 'checked' : 'unchecked'}
                      onPress={() => isActionable && toggleSelection(item.id)}
                      color={colors.accent}
                      disabled={!isActionable}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
              {/* Top row: incident number, status, time */}
              <View style={styles(colors).cardTopRow}>
                <View style={styles(colors).incidentMeta}>
                  <Text style={styles(colors).incidentNumber}>#{item.incidentNumber}</Text>
                  <View style={[styles(colors).statusBadge, { backgroundColor: getStatusColor(item.state) + '20' }]}>
                    <View style={[styles(colors).statusDot, { backgroundColor: getStatusColor(item.state) }]} />
                    <Text style={[styles(colors).statusText, { color: getStatusColor(item.state) }]}>
                      {item.state === 'triggered' ? 'Active' : item.state}
                    </Text>
                  </View>
                  {item.state === 'triggered' && (
                    <EscalationBadge
                      triggeredAt={item.triggeredAt}
                      escalationTimeoutMinutes={30}
                    />
                  )}
                  <UrgencyIndicator
                    triggeredAt={item.triggeredAt}
                    state={item.state}
                    thresholdMinutes={5}
                  />
                </View>
                <Text style={styles(colors).timeText}>{formatTimeSince(item.triggeredAt)}</Text>
              </View>

              {/* Title */}
              <Text variant="titleMedium" style={styles(colors).title} numberOfLines={2}>
                {item.summary}
              </Text>

              {/* Bottom row: service, assignee, actions */}
              <View style={styles(colors).cardBottomRow}>
                <View style={styles(colors).serviceChip}>
                  <MaterialCommunityIcons name="server" size={12} color={colors.textSecondary} />
                  <Text style={styles(colors).serviceText}>{item.service.name}</Text>
                </View>

                {assignee && (
                  <OwnerAvatar
                    name={assignee.fullName}
                    email={assignee.email}
                    profilePictureUrl={assignee.profilePictureUrl}
                    size={26}
                    showName
                  />
                )}
              </View>

              {/* Quick Actions */}
              {item.state !== 'resolved' && !isSelectionMode && (
                <View style={styles(colors).quickActions}>
                  <Button
                    mode="contained"
                    compact
                    buttonColor={colors.success}
                    textColor="#fff"
                    onPress={() => handleQuickAction(item, 'resolve')}
                    style={styles(colors).actionButtonStyle}
                    labelStyle={styles(colors).actionButtonLabel}
                  >
                    Resolve
                  </Button>
                  {item.state === 'triggered' && (
                    <Button
                      mode="contained"
                      compact
                      buttonColor={colors.warning}
                      textColor="#fff"
                      onPress={() => handleQuickAction(item, 'acknowledge')}
                      style={styles(colors).actionButtonStyle}
                      labelStyle={styles(colors).actionButtonLabel}
                    >
                      Ack
                    </Button>
                  )}
                </View>
              )}
                </View>
              </View>
            </Card.Content>
          </Card>
        </Pressable>
      </Swipeable>
    );
  };

  if (loading) {
    return (
      <View style={[styles(colors).container, styles(colors).centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={styles(colors).loadingText}>
          Loading incidents...
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles(colors).container}>
      {/* On-Call Banner */}
      {renderOnCallBanner()}

      {/* Stats Bar */}
      {renderStatsBar()}

      {/* Search and Filters */}
      <View style={styles(colors).searchContainer}>
        <Searchbar
          placeholder="Search incidents..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles(colors).searchBar}
          inputStyle={styles(colors).searchInput}
          iconColor={colors.textMuted}
          placeholderTextColor={colors.textMuted}
        />
        {renderFilters()}
      </View>

      <FlatList
        data={filteredIncidents}
        renderItem={renderIncident}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles(colors).listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyStatePreset
            type={searchQuery ? 'search' : filter === 'triggered' ? 'incidents_triggered' : filter === 'acknowledged' ? 'incidents_acknowledged' : filter === 'resolved' ? 'incidents_resolved' : 'incidents'}
          />
        }
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={8}
        updateCellsBatchingPeriod={50}
      />

      {/* Bulk Action Bar */}
      {isSelectionMode && selectedIds.size > 0 && (
        <Surface style={styles(colors).bulkActionBar} elevation={4}>
          <View style={styles(colors).bulkActionContent}>
            <View style={styles(colors).bulkSelectionInfo}>
              <Text style={styles(colors).bulkSelectionCount}>{selectedIds.size}</Text>
              <Text style={styles(colors).bulkSelectionLabel}>selected</Text>
              <Pressable onPress={selectAll} style={styles(colors).selectAllButton}>
                <Text style={styles(colors).selectAllText}>Select all</Text>
              </Pressable>
            </View>
            <View style={styles(colors).bulkActions}>
              <Button
                mode="contained"
                compact
                buttonColor={colors.success}
                textColor="#fff"
                onPress={handleBulkResolve}
                loading={bulkActionLoading}
                disabled={bulkActionLoading}
                style={styles(colors).bulkActionButton}
                icon="check-all"
              >
                Resolve
              </Button>
              <Button
                mode="contained"
                compact
                buttonColor={colors.warning}
                textColor="#fff"
                onPress={handleBulkAcknowledge}
                loading={bulkActionLoading}
                disabled={bulkActionLoading}
                style={styles(colors).bulkActionButton}
                icon="check"
              >
                Ack
              </Button>
            </View>
          </View>
        </Surface>
      )}

      {/* Snooze Modal */}
      <Portal>
        <Modal
          visible={showSnoozeModal}
          onDismiss={() => setShowSnoozeModal(false)}
          contentContainerStyle={[styles(colors).modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={styles(colors).modalTitle}>
            Snooze Incident
          </Text>
          <Text variant="bodyMedium" style={styles(colors).modalDescription}>
            Temporarily hide this incident. You'll be reminded when the snooze expires.
          </Text>
          <View style={styles(colors).snoozeOptions}>
            {[
              { label: '15 minutes', minutes: 15 },
              { label: '30 minutes', minutes: 30 },
              { label: '1 hour', minutes: 60 },
              { label: '2 hours', minutes: 120 },
            ].map((option) => (
              <Pressable
                key={option.minutes}
                style={styles(colors).snoozeOption}
                onPress={() => handleSnooze(option.minutes)}
              >
                <MaterialCommunityIcons name="clock-outline" size={20} color={colors.accent} />
                <Text style={styles(colors).snoozeOptionText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Button
            mode="text"
            onPress={() => setShowSnoozeModal(false)}
            textColor={colors.textSecondary}
          >
            Cancel
          </Button>
        </Modal>

        {/* Service Filter Modal */}
        <Modal
          visible={showServiceFilter}
          onDismiss={() => setShowServiceFilter(false)}
          contentContainerStyle={[styles(colors).modal, { backgroundColor: colors.surface, maxHeight: '70%' }]}
        >
          <Text variant="titleLarge" style={styles(colors).modalTitle}>
            Filter by Service
          </Text>
          <FlatList
            data={services}
            keyExtractor={(item) => item.id}
            style={styles(colors).serviceList}
            ListHeaderComponent={
              <Pressable
                style={[
                  styles(colors).serviceOption,
                  !selectedServiceId && styles(colors).serviceOptionActive,
                ]}
                onPress={() => {
                  setSelectedServiceId(null);
                  setShowServiceFilter(false);
                }}
              >
                <MaterialCommunityIcons
                  name="view-grid-outline"
                  size={20}
                  color={!selectedServiceId ? colors.accent : colors.textSecondary}
                />
                <Text
                  style={[
                    styles(colors).serviceOptionText,
                    !selectedServiceId && styles(colors).serviceOptionTextActive,
                  ]}
                >
                  All Services
                </Text>
                {!selectedServiceId && (
                  <MaterialCommunityIcons name="check" size={20} color={colors.accent} />
                )}
              </Pressable>
            }
            renderItem={({ item: service }) => (
              <Pressable
                style={[
                  styles(colors).serviceOption,
                  selectedServiceId === service.id && styles(colors).serviceOptionActive,
                ]}
                onPress={() => {
                  setSelectedServiceId(service.id);
                  setShowServiceFilter(false);
                }}
              >
                <MaterialCommunityIcons
                  name="server"
                  size={20}
                  color={selectedServiceId === service.id ? colors.accent : colors.textSecondary}
                />
                <View style={styles(colors).serviceOptionContent}>
                  <Text
                    style={[
                      styles(colors).serviceOptionText,
                      selectedServiceId === service.id && styles(colors).serviceOptionTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {service.name}
                  </Text>
                  {service.description && (
                    <Text style={styles(colors).serviceOptionDescription} numberOfLines={1}>
                      {service.description}
                    </Text>
                  )}
                </View>
                {selectedServiceId === service.id && (
                  <MaterialCommunityIcons name="check" size={20} color={colors.accent} />
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles(colors).emptyServiceList}>
                <MaterialCommunityIcons name="server-off" size={32} color={colors.textMuted} />
                <Text style={styles(colors).emptyServiceText}>No services available</Text>
              </View>
            }
          />
          <Button
            mode="text"
            onPress={() => setShowServiceFilter(false)}
            textColor={colors.textSecondary}
          >
            Cancel
          </Button>
        </Modal>
      </Portal>
    </GestureHandlerRootView>
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
  // Offline Banner
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: colors.warning + '20',
    marginBottom: 8,
    marginHorizontal: -16,
    marginTop: -12,
  },
  offlineText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '500',
  },
  // On-Call Banner
  onCallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted + '30',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  onCallText: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  onCallService: {
    fontWeight: '600',
    color: colors.accent,
  },
  // Stats Bar
  statsBar: {
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statItemActive: {
    backgroundColor: colors.surfaceSecondary,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Search and Filters
  searchContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    height: 40,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
    minHeight: 40,
    color: colors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  // List
  listContent: {
    padding: 12,
  },
  // Swipe Actions
  leftAction: {
    backgroundColor: colors.success,
    justifyContent: 'center',
    marginBottom: 10,
    borderRadius: 12,
    marginRight: -12,
  },
  rightActions: {
    flexDirection: 'row',
    marginBottom: 10,
    borderRadius: 12,
    marginLeft: -12,
    backgroundColor: colors.warning,
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    paddingVertical: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  // Card
  card: {
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  severityBar: {
    height: 4,
    width: '100%',
  },
  cardContent: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  incidentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  incidentNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  title: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 10,
    lineHeight: 22,
    fontSize: 15,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  serviceText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  assigneeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assigneeAvatar: {
    backgroundColor: colors.accent,
  },
  assigneeAvatarLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  assigneeName: {
    fontSize: 12,
    color: colors.textSecondary,
    maxWidth: 80,
  },
  quickActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  actionButtonStyle: {
    flex: 1,
    borderRadius: 8,
  },
  actionButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Snooze Modal
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalDescription: {
    color: colors.textSecondary,
    marginBottom: 20,
  },
  snoozeOptions: {
    gap: 8,
    marginBottom: 16,
  },
  snoozeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
  },
  snoozeOptionText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  // Bulk Selection Styles
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  checkboxContainer: {
    marginRight: 8,
    marginTop: -4,
  },
  bulkActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bulkActionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bulkSelectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulkSelectionCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accent,
  },
  bulkSelectionLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectAllText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkActionButton: {
    borderRadius: 8,
  },
  // Service Filter Modal
  serviceList: {
    maxHeight: 400,
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
  },
  serviceOptionActive: {
    backgroundColor: colors.accentMuted + '20',
  },
  serviceOptionContent: {
    flex: 1,
  },
  serviceOptionText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  serviceOptionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  serviceOptionDescription: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyServiceList: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyServiceText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
