import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated, AppState, AppStateStatus } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

interface OfflineBannerProps {
  isOffline?: boolean;
  message?: string;
}

export default function OfflineBanner({
  isOffline = false,
  message = "You're offline. Actions will sync when connected."
}: OfflineBannerProps) {
  const { colors } = useAppTheme();
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOffline ? 0 : -60,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [isOffline, slideAnim]);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.warning,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <MaterialCommunityIcons name="wifi-off" size={18} color="#fff" />
      <Text variant="labelMedium" style={styles.text}>
        {message}
      </Text>
    </Animated.View>
  );
}

// Simple hook to check offline status using fetch
export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try to fetch a small resource to check connectivity
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-cache'
        });

        clearTimeout(timeoutId);
        setIsOffline(false);
      } catch {
        setIsOffline(true);
      }
    };

    // Check on mount
    checkConnection();

    // Check when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        checkConnection();
      }
      appState.current = nextAppState;
    });

    // Periodic check every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  return isOffline;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    color: '#fff',
    fontWeight: '600',
  },
});
