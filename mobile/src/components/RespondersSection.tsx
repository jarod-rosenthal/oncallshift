import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import { OwnerAvatar } from './OwnerAvatar';

interface Responder {
  id: string;
  fullName: string;
  email: string;
  status: 'notified' | 'acknowledged' | 'pending';
  notifiedAt?: string;
  acknowledgedAt?: string;
}

interface RespondersSectionProps {
  responders: Responder[];
  acknowledgedBy?: {
    id: string;
    fullName: string;
    email: string;
  };
}

const getStatusIcon = (status: Responder['status']): {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
} => {
  switch (status) {
    case 'acknowledged':
      return { icon: 'check-circle', color: colors.success };
    case 'notified':
      return { icon: 'bell-ring', color: colors.warning };
    case 'pending':
    default:
      return { icon: 'clock-outline', color: colors.textMuted };
  }
};

const getStatusLabel = (status: Responder['status']): string => {
  switch (status) {
    case 'acknowledged':
      return 'Acknowledged';
    case 'notified':
      return 'Notified';
    case 'pending':
    default:
      return 'Pending';
  }
};

export const RespondersSection: React.FC<RespondersSectionProps> = ({
  responders,
  acknowledgedBy,
}) => {
  // If no responders data but we have acknowledgedBy, create a mock responder
  const displayResponders: Responder[] = responders.length > 0
    ? responders
    : acknowledgedBy
      ? [{
          id: acknowledgedBy.id,
          fullName: acknowledgedBy.fullName,
          email: acknowledgedBy.email,
          status: 'acknowledged',
        }]
      : [];

  if (displayResponders.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="account-group" size={18} color={colors.textSecondary} />
        <Text variant="titleSmall" style={styles.title}>Responders</Text>
      </View>
      <Surface style={styles.surface} elevation={0}>
        {displayResponders.map((responder, index) => {
          const { icon, color } = getStatusIcon(responder.status);
          return (
            <View
              key={responder.id}
              style={[
                styles.responderRow,
                index < displayResponders.length - 1 && styles.responderBorder,
              ]}
            >
              <OwnerAvatar name={responder.fullName} email={responder.email} size={32} />
              <View style={styles.responderInfo}>
                <Text variant="bodyMedium" style={styles.responderName}>
                  {responder.fullName}
                </Text>
                <View style={styles.statusRow}>
                  <MaterialCommunityIcons name={icon} size={14} color={color} />
                  <Text variant="labelSmall" style={[styles.statusText, { color }]}>
                    {getStatusLabel(responder.status)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  surface: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
  },
  responderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  responderBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  responderInfo: {
    flex: 1,
  },
  responderName: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    fontWeight: '500',
  },
});

export default RespondersSection;
