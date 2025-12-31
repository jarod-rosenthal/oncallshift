import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  SegmentedButtons,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import * as apiService from '../services/apiService';

const { width } = Dimensions.get('window');

interface AnalyticsData {
  totalIncidents: number;
  triggeredCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  mtta: number; // Mean Time To Acknowledge (minutes)
  mttr: number; // Mean Time To Resolve (minutes)
  incidentsBySeverity: {
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
  incidentsByService: Array<{
    serviceName: string;
    count: number;
  }>;
  dailyTrend: Array<{
    date: string;
    count: number;
  }>;
}

export default function AnalyticsScreen({ navigation }: any) {
  const { colors } = useAppTheme();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      // Fetch incidents and calculate analytics
      const incidents = await apiService.getIncidents();

      const now = new Date();
      const rangeStart = new Date();
      if (timeRange === '24h') {
        rangeStart.setHours(rangeStart.getHours() - 24);
      } else if (timeRange === '7d') {
        rangeStart.setDate(rangeStart.getDate() - 7);
      } else {
        rangeStart.setDate(rangeStart.getDate() - 30);
      }

      const filteredIncidents = incidents.filter(
        i => new Date(i.triggeredAt) >= rangeStart
      );

      // Calculate metrics
      const triggeredCount = filteredIncidents.filter(i => i.state === 'triggered').length;
      const acknowledgedCount = filteredIncidents.filter(i => i.state === 'acknowledged').length;
      const resolvedCount = filteredIncidents.filter(i => i.state === 'resolved').length;

      // Calculate MTTA and MTTR
      let totalAckTime = 0;
      let ackCount = 0;
      let totalResolveTime = 0;
      let resolveCount = 0;

      filteredIncidents.forEach(incident => {
        const triggeredAt = new Date(incident.triggeredAt).getTime();
        if (incident.acknowledgedAt) {
          const ackAt = new Date(incident.acknowledgedAt).getTime();
          totalAckTime += (ackAt - triggeredAt) / 60000; // Convert to minutes
          ackCount++;
        }
        if (incident.resolvedAt) {
          const resolvedAt = new Date(incident.resolvedAt).getTime();
          totalResolveTime += (resolvedAt - triggeredAt) / 60000;
          resolveCount++;
        }
      });

      const mtta = ackCount > 0 ? Math.round(totalAckTime / ackCount) : 0;
      const mttr = resolveCount > 0 ? Math.round(totalResolveTime / resolveCount) : 0;

      // Count by severity
      const incidentsBySeverity = {
        critical: filteredIncidents.filter(i => i.severity === 'critical').length,
        error: filteredIncidents.filter(i => i.severity === 'error').length,
        warning: filteredIncidents.filter(i => i.severity === 'warning').length,
        info: filteredIncidents.filter(i => i.severity === 'info').length,
      };

      // Count by service
      const serviceMap = new Map<string, number>();
      filteredIncidents.forEach(incident => {
        const serviceName = incident.service.name;
        serviceMap.set(serviceName, (serviceMap.get(serviceName) || 0) + 1);
      });
      const incidentsByService = Array.from(serviceMap.entries())
        .map(([serviceName, count]) => ({ serviceName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Daily trend
      const dailyMap = new Map<string, number>();
      const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, 0);
      }
      filteredIncidents.forEach(incident => {
        const dateStr = incident.triggeredAt.split('T')[0];
        if (dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
        }
      });
      const dailyTrend = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .reverse();

      setData({
        totalIncidents: filteredIncidents.length,
        triggeredCount,
        acknowledgedCount,
        resolvedCount,
        mtta,
        mttr,
        incidentsBySeverity,
        incidentsByService,
        dailyTrend,
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return colors.error;
      case 'error': return '#E11D48';
      case 'warning': return colors.warning;
      case 'info': return colors.info;
      default: return colors.textMuted;
    }
  };

  if (loading) {
    return (
      <View style={[styles(colors).container, styles(colors).centerContent]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles(colors).loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <View style={styles(colors).container}>
      {/* Time Range Selector */}
      <View style={styles(colors).selectorContainer}>
        <SegmentedButtons
          value={timeRange}
          onValueChange={setTimeRange}
          buttons={[
            { value: '24h', label: '24h' },
            { value: '7d', label: '7 Days' },
            { value: '30d', label: '30 Days' },
          ]}
          style={styles(colors).segmentedButtons}
        />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
          />
        }
      >
        {/* Key Metrics */}
        <View style={styles(colors).metricsRow}>
          <Card style={styles(colors).metricCard}>
            <Card.Content style={styles(colors).metricContent}>
              <MaterialCommunityIcons name="alert-circle" size={24} color={colors.error} />
              <Text style={styles(colors).metricValue}>{data?.totalIncidents || 0}</Text>
              <Text style={styles(colors).metricLabel}>Total Incidents</Text>
            </Card.Content>
          </Card>
          <Card style={styles(colors).metricCard}>
            <Card.Content style={styles(colors).metricContent}>
              <MaterialCommunityIcons name="clock-fast" size={24} color={colors.warning} />
              <Text style={styles(colors).metricValue}>{formatDuration(data?.mtta || 0)}</Text>
              <Text style={styles(colors).metricLabel}>MTTA</Text>
            </Card.Content>
          </Card>
          <Card style={styles(colors).metricCard}>
            <Card.Content style={styles(colors).metricContent}>
              <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
              <Text style={styles(colors).metricValue}>{formatDuration(data?.mttr || 0)}</Text>
              <Text style={styles(colors).metricLabel}>MTTR</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Status Breakdown */}
        <Card style={styles(colors).card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles(colors).cardTitle}>
              Status Breakdown
            </Text>
            <View style={styles(colors).statusRow}>
              <View style={styles(colors).statusItem}>
                <View style={[styles(colors).statusDot, { backgroundColor: colors.error }]} />
                <Text style={styles(colors).statusLabel}>Active</Text>
                <Text style={styles(colors).statusValue}>{data?.triggeredCount || 0}</Text>
              </View>
              <View style={styles(colors).statusItem}>
                <View style={[styles(colors).statusDot, { backgroundColor: colors.warning }]} />
                <Text style={styles(colors).statusLabel}>Acknowledged</Text>
                <Text style={styles(colors).statusValue}>{data?.acknowledgedCount || 0}</Text>
              </View>
              <View style={styles(colors).statusItem}>
                <View style={[styles(colors).statusDot, { backgroundColor: colors.success }]} />
                <Text style={styles(colors).statusLabel}>Resolved</Text>
                <Text style={styles(colors).statusValue}>{data?.resolvedCount || 0}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Severity Breakdown */}
        <Card style={styles(colors).card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles(colors).cardTitle}>
              By Severity
            </Text>
            {Object.entries(data?.incidentsBySeverity || {}).map(([severity, count]) => (
              <View key={severity} style={styles(colors).barRow}>
                <View style={styles(colors).barLabelContainer}>
                  <Text style={styles(colors).barLabel}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</Text>
                  <Text style={styles(colors).barValue}>{count}</Text>
                </View>
                <View style={styles(colors).barContainer}>
                  <View
                    style={[
                      styles(colors).bar,
                      {
                        backgroundColor: getSeverityColor(severity),
                        width: `${Math.min((count / (data?.totalIncidents || 1)) * 100, 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Top Services */}
        <Card style={styles(colors).card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles(colors).cardTitle}>
              Top Services
            </Text>
            {data?.incidentsByService.length === 0 ? (
              <Text style={styles(colors).emptyText}>No incidents in this period</Text>
            ) : (
              data?.incidentsByService.map((service, index) => (
                <View key={service.serviceName} style={styles(colors).serviceRow}>
                  <View style={styles(colors).serviceRank}>
                    <Text style={styles(colors).rankText}>#{index + 1}</Text>
                  </View>
                  <Text style={styles(colors).serviceName}>{service.serviceName}</Text>
                  <Text style={styles(colors).serviceCount}>{service.count}</Text>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Trend */}
        <Card style={styles(colors).card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles(colors).cardTitle}>
              Daily Trend
            </Text>
            <View style={styles(colors).trendContainer}>
              {data?.dailyTrend.map((day, index) => (
                <View key={day.date} style={styles(colors).trendBar}>
                  <View
                    style={[
                      styles(colors).trendBarFill,
                      {
                        height: `${Math.min((day.count / Math.max(...(data?.dailyTrend.map(d => d.count) || [1]))) * 100, 100)}%`,
                        backgroundColor: colors.accent,
                      },
                    ]}
                  />
                  <Text style={styles(colors).trendLabel}>
                    {new Date(day.date).getDate()}
                  </Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        <View style={styles(colors).bottomPadding} />
      </ScrollView>
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
  selectorContainer: {
    padding: 16,
    backgroundColor: colors.surface,
  },
  segmentedButtons: {
    backgroundColor: colors.surfaceSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  metricContent: {
    alignItems: 'center',
    gap: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusItem: {
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  barRow: {
    marginBottom: 12,
  },
  barLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  barValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  barContainer: {
    height: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  serviceRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  serviceName: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  serviceCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  trendContainer: {
    flexDirection: 'row',
    height: 100,
    alignItems: 'flex-end',
    gap: 4,
  },
  trendBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  trendBarFill: {
    width: '80%',
    borderRadius: 4,
    minHeight: 4,
  },
  trendLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  bottomPadding: {
    height: 40,
  },
});
