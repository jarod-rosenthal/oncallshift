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
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as apiService from '../services/apiService';
import * as settingsService from '../services/settingsService';
import * as hapticService from '../services/hapticService';
import * as notificationService from '../services/notificationService';
import type { Incident, OnCallData } from '../services/apiService';
import { useAppTheme } from '../context/ThemeContext';
import { severityColors, statusColors } from '../theme';
import { OwnerAvatar, EscalationBadge, EmptyStatePreset, useToast, toastMessages } from '../components';

const FILTER_STORAGE_KEY = '@incident_filter';

type FilterType = 'all' | 'mine' | 'triggered' | 'acknowledged' | 'resolved';

export default function AlertListScreen({ navigation }: any) {
  const { theme, colors } = useAppTheme();
  const { showSuccess, showError } = useToast();
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

  const fetchData = async () => {
    try {
      setError(null);
      const [incidentsData, onCallResult, profile] = await Promise.all([
        apiService.getIncidents(),
        apiService.getOnCallData().catch(() => []),
        apiService.getUserProfile().catch(() => null),
      ]);
      setIncidents(incidentsData);
      setOnCallData(onCallResult);
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
      console.error('Failed to fetch incidents:', err);

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
    } catch (err) {
      console.error('Failed to load filter preference:', err);
    }
  };

  const saveFilter = async (newFilter: FilterType) => {
    try {
      await AsyncStorage.setItem(FILTER_STORAGE_KEY, newFilter);
    } catch (err) {
      console.error('Failed to save filter preference:', err);
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
    return onCallData.find(oc => oc.oncallUser.email === currentUserEmail);
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
    await settingsService.snoozeIncident(selectedIncident.id, minutes);

    // Schedule a reminder notification
    await notificationService.scheduleLocalNotification(
      'Snoozed Incident Reminder',
      selectedIncident.summary,
      { incidentId: selectedIncident.id },
      minutes * 60
    );

    setShowSnoozeModal(false);
    loadSnoozedIncidents();
    await hapticService.success();
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
    if (incident.state !== 'triggered') return null;

    const trans = dragX.interpolate({
      inputRange: [0, 50, 100, 101],
      outputRange: [-20, 0, 0, 1],
    });

    return (
      <Animated.View style={[styles(colors).leftAction, { transform: [{ translateX: trans }] }]}>
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

  const renderRightActions = useCallback((progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, incident: Incident) => {
    if (incident.state === 'resolved') return null;

    const trans = dragX.interpolate({
      inputRange: [-101, -100, -50, 0],
      outputRange: [-1, 0, 0, 20],
    });

    return (
      <Animated.View style={[styles(colors).rightActions, { transform: [{ translateX: trans }] }]}>
        <Pressable
          style={[styles(colors).actionButton, { backgroundColor: colors.success }]}
          onPress={() => handleQuickAction(incident, 'resolve')}
        >
          <MaterialCommunityIcons name="check-all" size={24} color="#fff" />
          <Text style={styles(colors).actionText}>Resolve</Text>
        </Pressable>
        <Pressable
          style={[styles(colors).actionButton, { backgroundColor: colors.info }]}
          onPress={() => {
            setSelectedIncident(incident);
            setShowSnoozeModal(true);
          }}
        >
          <MaterialCommunityIcons name="clock-outline" size={24} color="#fff" />
          <Text style={styles(colors).actionText}>Snooze</Text>
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
    </View>
  );

  const renderIncident = ({ item }: { item: Incident }) => {
    const assignee = item.acknowledgedBy || item.resolvedBy;

    return (
      <Swipeable
        renderLeftActions={(progress, dragX) => renderLeftActions(progress, dragX, item)}
        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item)}
        overshootLeft={false}
        overshootRight={false}
        onSwipeableOpen={(direction) => {
          hapticService.lightTap();
        }}
      >
        <Pressable
          onPress={() => navigation.navigate('AlertDetail', { alert: item })}
        >
          <Card style={styles(colors).card} mode="elevated">
            {/* Severity indicator bar */}
            <View style={[styles(colors).severityBar, { backgroundColor: getSeverityColor(item.severity) }]} />

            <Card.Content style={styles(colors).cardContent}>
              {/* Top row: incident number, status, time */}
              <View style={styles(colors).cardTopRow}>
                <View style={styles(colors).incidentMeta}>
                  <Text style={styles(colors).incidentNumber}>#{item.incidentNumber}</Text>
                  <View style={[styles(colors).statusBadge, { backgroundColor: getStatusColor(item.state) + '20' }]}>
                    <View style={[styles(colors).statusDot, { backgroundColor: getStatusColor(item.state) }]} />
                    <Text style={[styles(colors).statusText, { color: getStatusColor(item.state) }]}>
                      {item.state}
                    </Text>
                  </View>
                  {item.state === 'triggered' && (
                    <EscalationBadge
                      triggeredAt={item.triggeredAt}
                      escalationTimeoutMinutes={30}
                    />
                  )}
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
                    size={26}
                    showName
                  />
                )}
              </View>

              {/* Quick Actions */}
              {item.state !== 'resolved' && (
                <View style={styles(colors).quickActions}>
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
                </View>
              )}
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
      />

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
    backgroundColor: colors.warning,
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
  },
  actionButton: {
    backgroundColor: colors.warning,
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
});
