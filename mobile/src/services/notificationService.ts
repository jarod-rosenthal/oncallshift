import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';
import axios from 'axios';
import { config } from '../config';
import { getAccessToken } from './authService';

// Critical alert channel ID for Android
const CRITICAL_CHANNEL_ID = 'critical-incidents';
const HIGH_PRIORITY_CHANNEL_ID = 'high-priority-incidents';
const DEFAULT_CHANNEL_ID = 'incidents';

// Configure notification handling - always show alerts with sound
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Check if this is a critical/high priority notification
    const priority = notification.request.content.data?.priority as string;
    const isCritical = priority === 'critical' || priority === 'high';

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
      // iOS 15+ interruption level for critical alerts
      priority: isCritical
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

/**
 * Set up Android notification channels with different priority levels
 * Critical channel can bypass DND on Android
 */
async function setupAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;

  // Critical incidents channel - bypasses DND
  await Notifications.setNotificationChannelAsync(CRITICAL_CHANNEL_ID, {
    name: 'Critical Incidents',
    description: 'Critical alerts that require immediate attention. These will sound even when Do Not Disturb is enabled.',
    importance: Notifications.AndroidImportance.MAX,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'critical_alert',
    enableVibrate: true,
    vibrationPattern: [0, 500, 200, 500, 200, 500], // Aggressive vibration pattern
    enableLights: true,
    lightColor: '#FF0000',
  });

  // High priority incidents channel
  await Notifications.setNotificationChannelAsync(HIGH_PRIORITY_CHANNEL_ID, {
    name: 'High Priority Incidents',
    description: 'High priority alerts that need prompt attention.',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 400, 200, 400],
    enableLights: true,
    lightColor: '#FFA500',
  });

  // Default incidents channel
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'Incidents',
    description: 'Standard incident notifications.',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    enableVibrate: true,
  });

  console.log('[Notifications] Android notification channels configured');
}

// Set up notification categories with actions
async function setupNotificationCategories() {
  await Notifications.setNotificationCategoryAsync('incident', [
    {
      identifier: 'acknowledge',
      buttonTitle: 'Acknowledge',
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: 'resolve',
      buttonTitle: 'Resolve',
      options: {
        opensAppToForeground: false,
        isDestructive: true,
      },
    },
    {
      identifier: 'view',
      buttonTitle: 'View Details',
      options: {
        opensAppToForeground: true,
      },
    },
  ]);

  // Also set up critical incident category
  await Notifications.setNotificationCategoryAsync('critical-incident', [
    {
      identifier: 'acknowledge',
      buttonTitle: 'Acknowledge',
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: 'call-responder',
      buttonTitle: 'Call Responder',
      options: {
        opensAppToForeground: true,
      },
    },
  ]);
}

/**
 * Initialize all notification configuration
 */
async function initializeNotificationConfig() {
  try {
    await setupAndroidNotificationChannels();
    await setupNotificationCategories();
    console.log('[Notifications] Configuration complete');
  } catch (error) {
    console.error('[Notifications] Configuration failed:', error);
  }
}

// Initialize on module load
initializeNotificationConfig();

/**
 * Request permission and get push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Check if running on a physical device
  if (!Device.isDevice) {
    console.log('[Notifications] Push notifications require a physical device - skipping registration');
    return null;
  }

  // Check if project ID is configured
  if (!config.expoProjectId || config.expoProjectId === 'your-project-id-here') {
    console.log('[Notifications] Expo project ID not configured - push notifications disabled');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Push notification permission not granted');
    return null;
  }

  // Get the push token
  try {
    console.log('[Notifications] Requesting push token with projectId:', config.expoProjectId);
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: config.expoProjectId,
    });
    console.log('[Notifications] Push token obtained successfully:', tokenData.data.substring(0, 30));
    return tokenData.data;
  } catch (error: any) {
    // Log the full error for debugging
    console.error('[Notifications] Push token error:', {
      message: error?.message,
      code: error?.code,
      projectId: config.expoProjectId,
      fullError: JSON.stringify(error, null, 2),
    });
    // Re-throw with more context so the UI can show it
    throw new Error(`Push token failed: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Register device token with backend
 */
export async function registerDeviceWithBackend(pushToken: string): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error('No access token available');
      return false;
    }

    const response = await axios.post(
      `${config.apiUrl}/v1/devices/register`,
      {
        token: pushToken,
        platform: Platform.OS,
        deviceName: Device.modelName || 'Unknown Device',
        appVersion: '1.0.0',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Device registered:', response.data);
    return true;
  } catch (error) {
    console.error('Failed to register device with backend:', error);
    return false;
  }
}

/**
 * Initialize push notifications
 * Call this after successful login
 */
export async function initializePushNotifications(): Promise<void> {
  const pushToken = await registerForPushNotifications();

  if (pushToken) {
    console.log('Push token:', pushToken);
    await registerDeviceWithBackend(pushToken);
  }
}

/**
 * Set up notification listeners
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void
): () => void {
  // Listener for notifications received while app is foregrounded
  const notificationListener = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('Notification received:', notification);
      onNotificationReceived?.(notification);
    }
  );

  // Listener for when user interacts with notification
  const responseListener = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('Notification response:', response);
      onNotificationResponse?.(response);
    }
  );

  // Return cleanup function
  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
}

/**
 * Get the last notification response (for handling app opened from notification)
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}

/**
 * Set the app badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Failed to set badge count:', error);
  }
}

/**
 * Get the current badge count
 */
export async function getBadgeCount(): Promise<number> {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.error('Failed to get badge count:', error);
    return 0;
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}

/**
 * Notification priority levels
 */
export type NotificationPriority = 'critical' | 'high' | 'default' | 'low';

/**
 * Schedule a local notification with priority support
 * Critical notifications will attempt to bypass DND
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data: Record<string, any>,
  triggerSeconds: number,
  priority: NotificationPriority = 'high'
): Promise<string> {
  // Determine channel and category based on priority
  const isCritical = priority === 'critical';
  const channelId = isCritical
    ? CRITICAL_CHANNEL_ID
    : priority === 'high'
    ? HIGH_PRIORITY_CHANNEL_ID
    : DEFAULT_CHANNEL_ID;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { ...data, priority },
      sound: 'default',
      categoryIdentifier: isCritical ? 'critical-incident' : 'incident',
      // For critical alerts on iOS, we set interruptionLevel
      // The actual critical sound configuration is handled by iOS when the entitlement is approved
      ...(isCritical && {
        // @ts-ignore - iOS specific property for critical alerts
        interruptionLevel: 'critical',
      }),
    },
    trigger: {
      seconds: triggerSeconds,
      channelId, // Android channel
    },
  });
  return id;
}

/**
 * Send an immediate critical notification (for testing)
 */
export async function sendCriticalTestNotification(): Promise<string> {
  return scheduleLocalNotification(
    '🚨 Critical Alert Test',
    'This is a test of the critical alert system. This notification should sound even if DND is enabled.',
    { type: 'test', priority: 'critical' },
    1, // 1 second delay
    'critical'
  );
}

/**
 * Check if the app has permission to bypass DND (Android only)
 */
export async function checkDndBypassPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    // iOS handles this through Critical Alerts entitlement
    return true;
  }

  try {
    // On Android, we need to check if we have notification policy access
    const channels = await Notifications.getNotificationChannelsAsync();
    const criticalChannel = channels?.find((c: any) => c.id === CRITICAL_CHANNEL_ID);
    return criticalChannel?.bypassDnd === true;
  } catch {
    return false;
  }
}

/**
 * Open system settings for notification configuration
 */
export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    // Open Android notification settings
    await Linking.openSettings();
  } else {
    // Open iOS settings
    await Linking.openURL('app-settings:');
  }
}

/**
 * Request iOS critical alerts permission
 * Note: Requires com.apple.developer.usernotifications.critical-alerts entitlement
 */
export async function requestCriticalAlertsPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return true;
  }

  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: true, // Request critical alerts permission
      },
    });

    return status === 'granted';
  } catch (error) {
    console.error('[Notifications] Failed to request critical alerts permission:', error);
    return false;
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}
