import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import { useAppTheme } from '../context/ThemeContext';
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
  // Professional, muted avatar palette - sophisticated, not playful
  const avatarColors = [
    '#5A67D8', // Muted Indigo
    '#6B46C1', // Deep Purple
    '#9F7AEA', // Soft Violet
    '#B7791F', // Ochre
    '#38A169', // Sage
    '#3182CE', // Cerulean
    '#718096', // Slate (replaced red)
    '#319795', // Calm Teal
  ];
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

export const OwnerAvatar: React.FC<OwnerAvatarProps> = ({
  name,
  email,
  size = 28,
  showName = false,
}) => {
  const { colors } = useAppTheme();
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
        <Text variant="labelSmall" style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>
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
    maxWidth: 80,
  },
});

export default OwnerAvatar;
