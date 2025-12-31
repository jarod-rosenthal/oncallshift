import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';

interface UrgencyIndicatorProps {
  triggeredAt: string;
  state: string;
  thresholdMinutes?: number;
}

export default function UrgencyIndicator({
  triggeredAt,
  state,
  thresholdMinutes = 5,
}: UrgencyIndicatorProps) {
  const { colors } = useAppTheme();
  const [minutesOld, setMinutesOld] = useState(0);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const calculateAge = () => {
      const now = new Date();
      const triggered = new Date(triggeredAt);
      const diffMs = now.getTime() - triggered.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      setMinutesOld(diffMinutes);
    };

    calculateAge();
    const interval = setInterval(calculateAge, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [triggeredAt]);

  useEffect(() => {
    // Only animate pulse for triggered incidents that are old
    if (state === 'triggered' && minutesOld >= thresholdMinutes) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [minutesOld, state, thresholdMinutes, pulseAnim]);

  // Only show for triggered incidents older than threshold
  if (state !== 'triggered' || minutesOld < thresholdMinutes) {
    return null;
  }

  const getUrgencyLevel = () => {
    if (minutesOld >= 30) return { label: 'Critical', color: colors.error, icon: 'alert' };
    if (minutesOld >= 15) return { label: 'High', color: colors.warning, icon: 'alert-circle' };
    return { label: 'Aging', color: colors.warningMuted || '#FFA500', icon: 'clock-alert' };
  };

  const urgency = getUrgencyLevel();

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: urgency.color + '20', transform: [{ scale: pulseAnim }] },
      ]}
    >
      <MaterialCommunityIcons
        name={urgency.icon as any}
        size={12}
        color={urgency.color}
      />
      <Text style={[styles.text, { color: urgency.color }]}>
        {minutesOld}m
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
  },
});
