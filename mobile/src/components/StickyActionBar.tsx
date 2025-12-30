import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Button, Surface } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

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

  if (actions.length === 0) {
    return null;
  }

  return (
    <Surface
      style={[
        styles.container,
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
            buttonColor={action.color}
            textColor={action.textColor || (action.mode === 'outlined' ? action.color : '#FFFFFF')}
            style={[
              styles.button,
              actions.length === 1 && styles.singleButton,
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
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
