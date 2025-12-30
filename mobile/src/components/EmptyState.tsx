import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const emptyStateMessages: Record<string, { icon: string; title: string; subtitle: string }> = {
  incidents: {
    icon: 'check-circle',
    title: 'All clear!',
    subtitle: 'No active incidents. Enjoy the calm.',
  },
  incidents_triggered: {
    icon: 'shield-check',
    title: 'Nothing on fire',
    subtitle: 'No triggered incidents right now.',
  },
  incidents_acknowledged: {
    icon: 'clipboard-check',
    title: 'All handled',
    subtitle: 'No acknowledged incidents in progress.',
  },
  incidents_resolved: {
    icon: 'history',
    title: 'No history yet',
    subtitle: 'Resolved incidents will appear here.',
  },
  oncall: {
    icon: 'calendar-blank',
    title: 'No schedules',
    subtitle: 'On-call schedules will appear here.',
  },
  oncall_mine: {
    icon: 'calendar-check',
    title: 'You\'re off duty',
    subtitle: 'No upcoming shifts scheduled for you.',
  },
  inbox: {
    icon: 'inbox-outline',
    title: 'All caught up!',
    subtitle: 'No notifications to show.',
  },
  team: {
    icon: 'account-group-outline',
    title: 'No team members',
    subtitle: 'Team members will appear here.',
  },
  search: {
    icon: 'magnify',
    title: 'No results',
    subtitle: 'Try adjusting your search or filters.',
  },
  error: {
    icon: 'alert-circle-outline',
    title: 'Something went wrong',
    subtitle: 'Pull to refresh and try again.',
  },
  offline: {
    icon: 'wifi-off',
    title: 'You\'re offline',
    subtitle: 'Showing cached data. Connect to refresh.',
  },
};

export function getEmptyStateConfig(type: string) {
  return emptyStateMessages[type] || emptyStateMessages.error;
}

export default function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}15` }]}>
        <MaterialCommunityIcons
          name={icon as any}
          size={48}
          color={colors.primary}
        />
      </View>
      <Text variant="titleLarge" style={[styles.title, { color: colors.textPrimary }]}>
        {title}
      </Text>
      {subtitle && (
        <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      )}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

// Convenience component that uses preset messages
export function EmptyStatePreset({
  type,
  action
}: {
  type: keyof typeof emptyStateMessages;
  action?: React.ReactNode;
}) {
  const config = getEmptyStateConfig(type);
  return <EmptyState {...config} action={action} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  action: {
    marginTop: 24,
  },
});
