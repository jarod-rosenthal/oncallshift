import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated, AppState, AppStateStatus, Pressable } from 'react-native';
import { Text, Badge } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import * as offlineService from '../services/offlineService';

interface OfflineBannerProps {
  isOffline?: boolean;
  message?: string;
  showPendingActions?: boolean;
  onPress?: () => void;
}

export default function OfflineBanner({
  isOffline: isOfflineProp,
  message,
  showPendingActions = true,
  onPress,
}: OfflineBannerProps) {
  const { colors } = useAppTheme();
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const [offlineStatus, setOfflineStatus] = useState<offlineService.OfflineStatus | null>(null);

  // Use prop if provided, otherwise use service
  const isOffline = isOfflineProp ?? !offlineStatus?.isConnected;
  const pendingActions = offlineStatus?.pendingActions ?? 0;

  // Get dynamic message
  const displayMessage = message || (
    pendingActions > 0
      ? `Offline. ${pendingActions} action${pendingActions !== 1 ? 's' : ''} pending`
      : "You're offline. Actions will sync when connected."
  );

  useEffect(() => {
    // Initialize offline service and get initial status
    const initAndListen = async () => {
      await offlineService.initOfflineService();
      const status = await offlineService.getOfflineStatus();
      setOfflineStatus(status);
    };

    initAndListen();

    // Listen for connection changes
    const unsubscribe = offlineService.addConnectionListener((status) => {
      setOfflineStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOffline ? 0 : -60,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [isOffline, slideAnim]);

  if (!isOffline) return null;

  const BannerContent = (
    <>
      <MaterialCommunityIcons name="wifi-off" size={18} color={colors.accent} />
      <Text variant="labelMedium" style={[styles.text, { color: colors.textPrimary }]}>
        {displayMessage}
      </Text>
      {showPendingActions && pendingActions > 0 && (
        <Badge size={20} style={[styles.badge, { backgroundColor: colors.warning }]}>
          {pendingActions}
        </Badge>
      )}
      {onPress && (
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
      )}
    </>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceSecondary,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {onPress ? (
        <Pressable style={styles.pressable} onPress={onPress}>
          {BannerContent}
        </Pressable>
      ) : (
        <View style={styles.content}>
          {BannerContent}
        </View>
      )}
    </Animated.View>
  );
}

// Hook to check offline status using the offline service
export function useOfflineStatus() {
  const [status, setStatus] = useState<offlineService.OfflineStatus>({
    isConnected: true,
    isInternetReachable: true,
    pendingActions: 0,
  });

  useEffect(() => {
    // Get initial status
    const init = async () => {
      await offlineService.initOfflineService();
      const currentStatus = await offlineService.getOfflineStatus();
      setStatus(currentStatus);
    };

    init();

    // Listen for changes
    const unsubscribe = offlineService.addConnectionListener((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return !status.isConnected;
}

// Extended hook that returns full offline status
export function useOfflineStatusFull() {
  const [status, setStatus] = useState<offlineService.OfflineStatus>({
    isConnected: true,
    isInternetReachable: true,
    pendingActions: 0,
  });

  useEffect(() => {
    const init = async () => {
      await offlineService.initOfflineService();
      const currentStatus = await offlineService.getOfflineStatus();
      setStatus(currentStatus);
    };

    init();

    const unsubscribe = offlineService.addConnectionListener((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return status;
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    fontWeight: '500',
    flex: 1,
  },
  badge: {
    color: '#fff',
  },
});
