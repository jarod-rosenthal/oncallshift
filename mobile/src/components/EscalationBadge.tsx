import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';

interface EscalationBadgeProps {
  escalatesAt?: string;
  triggeredAt: string;
  escalationTimeoutMinutes?: number;
}

const formatTimeRemaining = (seconds: number): string => {
  if (seconds <= 0) return 'Now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
};

export const EscalationBadge: React.FC<EscalationBadgeProps> = ({
  escalatesAt,
  triggeredAt,
  escalationTimeoutMinutes = 30,
}) => {
  const { colors } = useAppTheme();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      let targetTime: Date;

      if (escalatesAt) {
        targetTime = new Date(escalatesAt);
      } else {
        // Calculate based on triggered time + timeout
        targetTime = new Date(triggeredAt);
        targetTime.setMinutes(targetTime.getMinutes() + escalationTimeoutMinutes);
      }

      const now = new Date();
      const diff = Math.floor((targetTime.getTime() - now.getTime()) / 1000);
      setTimeRemaining(Math.max(0, diff));
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [escalatesAt, triggeredAt, escalationTimeoutMinutes]);

  // Don't show if already escalated
  if (timeRemaining <= 0) {
    return null;
  }

  // Use teal accent for normal, amber only for <3 minutes (critical urgency)
  const isCritical = timeRemaining < 180; // Less than 3 minutes
  const isUrgent = timeRemaining < 300;   // Less than 5 minutes

  // Color scheme: teal for info -> amber for urgent -> muted red for critical
  const getColors = () => {
    if (isCritical) {
      return { bg: colors.errorLight, fg: colors.error };
    }
    if (isUrgent) {
      return { bg: colors.warningLight, fg: colors.warning };
    }
    // Default: teal accent (calm, informational)
    return { bg: '#E6FFFA', fg: colors.accent };
  };

  const { bg, fg } = getColors();

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <MaterialCommunityIcons
        name={isCritical ? 'alert' : 'arrow-up-circle'}
        size={12}
        color={fg}
      />
      <Text
        variant="labelSmall"
        style={[styles.text, { color: fg }]}
      >
        Escalates in {formatTimeRemaining(timeRemaining)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  text: {
    fontWeight: '600',
    fontSize: 11,
  },
});

export default EscalationBadge;
