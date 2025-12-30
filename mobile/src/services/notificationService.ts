import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import axios from 'axios';
import { config } from '../config';
import { getAccessToken } from './authService';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
}

// Initialize categories on module load
setupNotificationCategories().catch(console.error);

/**
 * Request permission and get push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
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
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: config.expoProjectId,
    });
    return tokenData.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
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
    Notifications.removeNotificationSubscription(notificationListener);
    Notifications.removeNotificationSubscription(responseListener);
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
 * Schedule a local notification (for snooze reminders)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data: Record<string, any>,
  triggerSeconds: number
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
      categoryIdentifier: 'incident',
    },
    trigger: {
      seconds: triggerSeconds,
    },
  });
  return id;
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
