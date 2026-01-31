import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import * as apiService from '../services/apiService';
import type { UpcomingShift } from '../services/apiService';

interface OnCallBannerProps {
  compact?: boolean; // For use in headers
}

/**
 * Shows a banner when the current user is on-call
 * Displays schedule name and when shift ends
 */
export function OnCallBanner({ compact = false }: OnCallBannerProps) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const [currentShift, setCurrentShift] = useState<UpcomingShift | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentShift();
    // Refresh every 5 minutes
    const interval = setInterval(fetchCurrentShift, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchCurrentShift = async () => {
    try {
      const shifts = await apiService.getUpcomingShifts();
      const now = new Date();

      // Find a shift that's currently active
      const active = shifts.find(shift => {
        const start = new Date(shift.startTime);
        const end = new Date(shift.endTime);
        return now >= start && now < end;
      });

      setCurrentShift(active || null);
    } catch (_error) {
      setCurrentShift(null);
    } finally {
      setLoading(false);
    }
  };

  // Format time remaining until shift ends
  const formatTimeRemaining = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();

    if (diffMs <= 0) return 'ending soon';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Format end time for display
  const formatEndTime = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    const isToday = end.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = end.toDateString() === tomorrow.toDateString();

    const timeStr = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (isToday) {
      return `today at ${timeStr}`;
    } else if (isTomorrow) {
      return `tomorrow at ${timeStr}`;
    } else {
      return end.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
    }
  };

  // Don't render while loading or if not on-call
  if (loading || !currentShift) {
    return null;
  }

  if (compact) {
    // Compact version for headers
    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.warning + '20' }]}>
        <MaterialCommunityIcons name="phone-ring" size={14} color={colors.warning} />
        <Text style={[styles.compactText, { color: colors.warning }]}>
          On-call: {formatTimeRemaining(currentShift.endTime)} left
        </Text>
      </View>
    );
  }

  // Full banner version
  return (
    <Pressable
      onPress={() => navigation.navigate('OnCall' as never)}
    >
      <Surface style={[styles.container, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' }]} elevation={0}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconBg, { backgroundColor: colors.warning + '25' }]}>
            <MaterialCommunityIcons name="phone-ring" size={24} color={colors.warning} />
          </View>
        </View>

        <View style={styles.content}>
          <Text variant="titleSmall" style={[styles.title, { color: colors.textPrimary }]}>
            You're On-Call
          </Text>
          <Text variant="bodySmall" style={[styles.schedule, { color: colors.textSecondary }]}>
            {currentShift.scheduleName}
            {currentShift.serviceName && ` \u2022 ${currentShift.serviceName}`}
          </Text>
          <View style={styles.timeRow}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={colors.warning} />
            <Text variant="bodySmall" style={[styles.timeText, { color: colors.warning }]}>
              Until {formatEndTime(currentShift.endTime)} ({formatTimeRemaining(currentShift.endTime)} left)
            </Text>
          </View>
        </View>

        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
      </Surface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconContainer: {
    marginRight: 12,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
    marginBottom: 2,
  },
  schedule: {
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontWeight: '500',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OnCallBanner;
