import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import * as apiService from '../services/apiService';

interface ServiceHealthBadgeProps {
  serviceId: string;
  serviceName: string;
}

interface HealthData {
  incidentsThisWeek: number;
  incidentsPreviousWeek: number;
  trend: 'up' | 'down' | 'stable';
  lastIncidentAt?: string;
}

export function ServiceHealthBadge({ serviceId, serviceName }: ServiceHealthBadgeProps) {
  const { colors } = useAppTheme();
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealthData();
  }, [serviceId]);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      // Fetch all incidents and filter by service
      const allIncidents = await apiService.getIncidents();

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Filter incidents by service ID
      const incidents = allIncidents.filter(inc => inc.service?.id === serviceId);

      const thisWeek = incidents.filter(inc => {
        const date = new Date(inc.triggeredAt);
        return date >= oneWeekAgo;
      });

      const previousWeek = incidents.filter(inc => {
        const date = new Date(inc.triggeredAt);
        return date >= twoWeeksAgo && date < oneWeekAgo;
      });

      const trend: 'up' | 'down' | 'stable' =
        thisWeek.length > previousWeek.length ? 'up' :
        thisWeek.length < previousWeek.length ? 'down' : 'stable';

      setHealthData({
        incidentsThisWeek: thisWeek.length,
        incidentsPreviousWeek: previousWeek.length,
        trend,
        lastIncidentAt: thisWeek[0]?.triggeredAt,
      });
    } catch (_error) {
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if loading, error, or no incidents
  if (loading || !healthData || healthData.incidentsThisWeek === 0) {
    return null;
  }

  const getTrendIcon = () => {
    switch (healthData.trend) {
      case 'up':
        return { name: 'trending-up' as const, color: colors.error };
      case 'down':
        return { name: 'trending-down' as const, color: colors.success };
      default:
        return { name: 'minus' as const, color: colors.textMuted };
    }
  };

  const trendInfo = getTrendIcon();
  const trendText = healthData.trend === 'up'
    ? `↑ from ${healthData.incidentsPreviousWeek}`
    : healthData.trend === 'down'
    ? `↓ from ${healthData.incidentsPreviousWeek}`
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <MaterialCommunityIcons
        name="chart-line"
        size={16}
        color={colors.textSecondary}
      />
      <Text variant="bodySmall" style={[styles.text, { color: colors.textSecondary }]}>
        {serviceName}:{' '}
        <Text style={[styles.count, { color: healthData.incidentsThisWeek > 3 ? colors.error : colors.textPrimary }]}>
          {healthData.incidentsThisWeek} incident{healthData.incidentsThisWeek !== 1 ? 's' : ''}
        </Text>
        {' '}this week
      </Text>
      {healthData.trend !== 'stable' && (
        <View style={styles.trendContainer}>
          <MaterialCommunityIcons
            name={trendInfo.name}
            size={14}
            color={trendInfo.color}
          />
          <Text variant="bodySmall" style={{ color: trendInfo.color, marginLeft: 2 }}>
            {healthData.trend === 'up' ? `↑${healthData.incidentsPreviousWeek}` : `↓${healthData.incidentsPreviousWeek}`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
  },
  text: {
    flexShrink: 1,
  },
  count: {
    fontWeight: '600',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
});

export default ServiceHealthBadge;
