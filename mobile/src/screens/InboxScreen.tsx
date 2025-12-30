import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Surface,
  Chip,
  IconButton,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import * as apiService from '../services/apiService';
import * as hapticService from '../services/hapticService';

type FilterType = 'all' | 'mentions' | 'assigned';

interface NotificationItem {
  id: string;
  type: 'incident_triggered' | 'incident_acknowledged' | 'incident_resolved' | 'mention' | 'assigned' | 'escalated';
  title: string;
  body: string;
  incidentId?: string;
  incidentSummary?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  isRead: boolean;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
  };
}

const typeIcons: Record<string, string> = {
  incident_triggered: 'alert-circle',
  incident_acknowledged: 'check-circle',
  incident_resolved: 'check-all',
  mention: 'at',
  assigned: 'account-arrow-right',
  escalated: 'arrow-up-circle',
};

const typeColors: Record<string, string> = {
  incident_triggered: '#dc2626',
  incident_acknowledged: '#f59e0b',
  incident_resolved: '#10b981',
  mention: '#3b82f6',
  assigned: '#8b5cf6',
  escalated: '#ef4444',
};

export default function InboxScreen({ navigation }: any) {
  const { colors } = useAppTheme();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getNotifications();
      setNotifications(data);
    } catch (err: any) {
      console.log('Failed to fetch notifications from API, using mock data:', err.message);
      // Fall back to mock data if API fails
      setNotifications(getMockNotifications());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    hapticService.lightTap();
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await apiService.markNotificationRead(id);
    } catch (err) {
      console.log('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    hapticService.success();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await apiService.markAllNotificationsRead();
    } catch (err) {
      console.log('Failed to mark all notifications as read:', err);
    }
  };

  const handleNotificationPress = (notification: NotificationItem) => {
    handleMarkAsRead(notification.id);
    if (notification.incidentId) {
      navigation.navigate('AlertDetail', {
        alert: {
          id: notification.incidentId,
          summary: notification.incidentSummary || notification.title,
          severity: notification.severity || 'info',
          state: 'triggered',
          service: { id: '', name: 'Service' },
          triggeredAt: notification.createdAt,
        },
      });
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'mentions') return n.type === 'mention';
    if (filter === 'assigned') return n.type === 'assigned';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => (
    <Pressable onPress={() => handleNotificationPress(item)}>
      <Card
        style={[
          styles.card,
          {
            backgroundColor: item.isRead ? colors.surface : colors.surfaceVariant,
            borderLeftWidth: 4,
            borderLeftColor: typeColors[item.type] || colors.primary,
          },
        ]}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: `${typeColors[item.type]}20` },
              ]}
            >
              <MaterialCommunityIcons
                name={typeIcons[item.type] as any || 'bell'}
                size={20}
                color={typeColors[item.type]}
              />
            </View>
          </View>
          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Text
                variant="titleSmall"
                style={[
                  styles.title,
                  { color: colors.textPrimary },
                  !item.isRead && styles.unreadTitle,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {!item.isRead && (
                <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
              )}
            </View>
            <Text
              variant="bodySmall"
              style={[styles.body, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.body}
            </Text>
            <View style={styles.metaRow}>
              <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                {formatTime(item.createdAt)}
              </Text>
              {item.actor && (
                <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                  {' '}by {item.actor.name}
                </Text>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>
    </Pressable>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.filterRow}>
        {(['all', 'mentions', 'assigned'] as FilterType[]).map(f => (
          <Chip
            key={f}
            mode={filter === f ? 'flat' : 'outlined'}
            selected={filter === f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterChip,
              filter === f && { backgroundColor: colors.primaryContainer },
            ]}
            textStyle={{ color: filter === f ? colors.primary : colors.textSecondary }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Chip>
        ))}
      </View>
      {unreadCount > 0 && (
        <Button
          mode="text"
          compact
          onPress={handleMarkAllRead}
          style={styles.markAllButton}
        >
          Mark all read ({unreadCount})
        </Button>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="inbox-outline"
        size={64}
        color={colors.textMuted}
      />
      <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        All caught up!
      </Text>
      <Text variant="bodyMedium" style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        No notifications to show.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      <FlatList
        data={filteredNotifications}
        renderItem={renderNotification}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredNotifications.length === 0 && styles.emptyList,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={8}
      />
    </View>
  );
}

// Mock notifications for testing until backend is ready
function getMockNotifications(): NotificationItem[] {
  const now = new Date();
  return [
    {
      id: '1',
      type: 'incident_triggered',
      title: 'High CPU on prod-api-1',
      body: 'CPU usage exceeded 90% threshold on production API server',
      incidentId: 'inc-123',
      incidentSummary: 'High CPU on prod-api-1',
      severity: 'critical',
      isRead: false,
      createdAt: new Date(now.getTime() - 5 * 60000).toISOString(),
    },
    {
      id: '2',
      type: 'assigned',
      title: 'You were assigned an incident',
      body: 'Database connection pool exhausted - assigned by John Smith',
      incidentId: 'inc-124',
      incidentSummary: 'Database connection pool exhausted',
      severity: 'error',
      isRead: false,
      createdAt: new Date(now.getTime() - 30 * 60000).toISOString(),
      actor: { id: 'user-1', name: 'John Smith', email: 'john@example.com' },
    },
    {
      id: '3',
      type: 'incident_acknowledged',
      title: 'Incident acknowledged',
      body: 'Memory leak in checkout service was acknowledged by Sarah Chen',
      incidentId: 'inc-125',
      incidentSummary: 'Memory leak in checkout service',
      severity: 'warning',
      isRead: true,
      createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      actor: { id: 'user-2', name: 'Sarah Chen', email: 'sarah@example.com' },
    },
    {
      id: '4',
      type: 'incident_resolved',
      title: 'Incident resolved',
      body: 'SSL certificate expiry warning - resolved by DevOps Bot',
      incidentId: 'inc-126',
      incidentSummary: 'SSL certificate expiry warning',
      severity: 'info',
      isRead: true,
      createdAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
      actor: { id: 'bot-1', name: 'DevOps Bot', email: 'bot@example.com' },
    },
    {
      id: '5',
      type: 'escalated',
      title: 'Incident escalated to you',
      body: 'Payment gateway timeout escalated from Level 1 to Level 2',
      incidentId: 'inc-127',
      incidentSummary: 'Payment gateway timeout',
      severity: 'critical',
      isRead: false,
      createdAt: new Date(now.getTime() - 15 * 60000).toISOString(),
    },
  ];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    marginRight: 4,
  },
  markAllButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyList: {
    flex: 1,
  },
  card: {
    borderRadius: 12,
    elevation: 1,
  },
  cardContent: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  body: {
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    marginTop: 8,
    textAlign: 'center',
  },
});
