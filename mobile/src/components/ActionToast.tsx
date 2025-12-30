import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
  icon?: string;
}

interface ToastContextType {
  showToast: (config: ToastConfig) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Preset messages for common actions
export const toastMessages = {
  acknowledge: "Got it. You're on it.",
  resolve: "Incident resolved. Nice work!",
  escalate: "Escalated. Help is on the way.",
  snooze: "Snoozed. We'll remind you later.",
  note_added: "Note added.",
  copied: "Copied to clipboard.",
  offline_action: "Saved. Will sync when online.",
  error: "Something went wrong. Try again.",
};

const typeConfig: Record<ToastType, { icon: string; color: string }> = {
  success: { icon: 'check-circle', color: '#10b981' },
  error: { icon: 'alert-circle', color: '#ef4444' },
  info: { icon: 'information', color: '#3b82f6' },
  warning: { icon: 'alert', color: '#f59e0b' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<ToastConfig>({ message: '' });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  }, [fadeAnim, slideAnim]);

  const showToast = useCallback((newConfig: ToastConfig) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setConfig(newConfig);
    setVisible(true);

    fadeAnim.setValue(0);
    slideAnim.setValue(50);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    timeoutRef.current = setTimeout(hideToast, newConfig.duration || 3000);
  }, [fadeAnim, slideAnim, hideToast]);

  const showSuccess = useCallback((message: string) => {
    showToast({ message, type: 'success' });
  }, [showToast]);

  const showError = useCallback((message: string) => {
    showToast({ message, type: 'error' });
  }, [showToast]);

  const showInfo = useCallback((message: string) => {
    showToast({ message, type: 'info' });
  }, [showToast]);

  const type = config.type || 'success';
  const { icon, color } = typeConfig[type];

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo }}>
      {children}
      {visible && (
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          pointerEvents="none"
        >
          <Surface style={[styles.toast, { backgroundColor: colors.surface }]} elevation={4}>
            <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
              <MaterialCommunityIcons
                name={(config.icon || icon) as any}
                size={20}
                color={color}
              />
            </View>
            <Text variant="bodyMedium" style={[styles.message, { color: colors.textPrimary }]}>
              {config.message}
            </Text>
          </Surface>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    maxWidth: 400,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontWeight: '500',
  },
});
