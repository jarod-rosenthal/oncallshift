import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import { colors } from '../theme';

interface OwnerAvatarProps {
  name?: string;
  email?: string;
  size?: number;
  showName?: boolean;
}

const getInitials = (name?: string, email?: string): string => {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return '??';
};

const getAvatarColor = (name?: string, email?: string): string => {
  const str = name || email || '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const avatarColors = [
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#14B8A6', // Teal
  ];
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

export const OwnerAvatar: React.FC<OwnerAvatarProps> = ({
  name,
  email,
  size = 28,
  showName = false,
}) => {
  const initials = getInitials(name, email);
  const bgColor = getAvatarColor(name, email);

  return (
    <View style={styles.container}>
      <Avatar.Text
        size={size}
        label={initials}
        style={[styles.avatar, { backgroundColor: bgColor }]}
        labelStyle={[styles.label, { fontSize: size * 0.4 }]}
      />
      {showName && name && (
        <Text variant="labelSmall" style={styles.name} numberOfLines={1}>
          {name.split(' ')[0]}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    // backgroundColor set dynamically
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  name: {
    color: colors.textSecondary,
    maxWidth: 80,
  },
});

export default OwnerAvatar;
