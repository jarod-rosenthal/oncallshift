import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

  const isUrgent = timeRemaining < 300; // Less than 5 minutes

  return (
    <View style={[styles.container, isUrgent && styles.urgent]}>
      <MaterialCommunityIcons
        name="arrow-up-circle"
        size={12}
        color={isUrgent ? colors.error : colors.warning}
      />
      <Text
        variant="labelSmall"
        style={[styles.text, isUrgent && styles.urgentText]}
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
    backgroundColor: colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  urgent: {
    backgroundColor: colors.errorLight,
  },
  text: {
    color: colors.warning,
    fontWeight: '600',
    fontSize: 11,
  },
  urgentText: {
    color: colors.error,
  },
});

export default EscalationBadge;
