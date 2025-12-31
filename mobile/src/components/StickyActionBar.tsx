import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Button, Surface, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ActionButton {
  label: string;
  icon?: string;
  onPress: () => void;
  mode?: 'contained' | 'outlined' | 'text';
  color?: string;
  textColor?: string;
  loading?: boolean;
  disabled?: boolean;
}

interface StickyActionBarProps {
  actions: ActionButton[];
  loading?: boolean;
}

export const StickyActionBar: React.FC<StickyActionBarProps> = ({
  actions,
  loading = false,
}) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  if (actions.length === 0) {
    return null;
  }

  // Dynamic styles based on current theme
  const dynamicStyles = {
    container: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.surface,
      paddingTop: 12,
      paddingHorizontal: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outlineVariant,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
  };

  // Get text color for outlined buttons - use a bright color that contrasts with dark surface
  const getOutlinedTextColor = (color?: string) => {
    // For outlined buttons, use the theme's onSurface color for better readability
    // or the action color if provided (which should be theme-aware)
    return color || theme.colors.onSurface;
  };

  return (
    <Surface
      style={[
        dynamicStyles.container,
        { paddingBottom: Math.max(insets.bottom, 16) },
      ]}
      elevation={4}
    >
      <View style={styles.buttonRow}>
        {actions.map((action, index) => (
          <Button
            key={index}
            mode={action.mode || 'contained'}
            onPress={action.onPress}
            loading={action.loading || loading}
            disabled={action.disabled || loading}
            icon={action.icon}
            buttonColor={action.mode === 'outlined' ? 'transparent' : action.color}
            textColor={action.textColor || (action.mode === 'outlined' ? getOutlinedTextColor(action.color) : '#FFFFFF')}
            style={[
              styles.button,
              actions.length === 1 && styles.singleButton,
              action.mode === 'outlined' && { borderColor: action.color || theme.colors.outline, borderWidth: 1 },
            ]}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            {action.label}
          </Button>
        ))}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
  },
  singleButton: {
    flex: 1,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default StickyActionBar;
