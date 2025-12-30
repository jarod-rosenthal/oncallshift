import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from './authService';
import { config } from '../config';

const BACKGROUND_FETCH_TASK = 'BACKGROUND_INCIDENT_FETCH';
const LAST_INCIDENT_COUNT_KEY = '@last_incident_count';
const BACKGROUND_REFRESH_ENABLED_KEY = '@background_refresh_enabled';

interface Incident {
  id: string;
  summary: string;
  severity: string;
  state: string;
  service: { name: string };
  triggeredAt: string;
}

let taskDefined = false;

// Define the background fetch task lazily
const defineBackgroundTask = () => {
  if (taskDefined) return;

  try {
    TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('[BackgroundFetch] Running background fetch task');

    // Check if user is authenticated
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('[BackgroundFetch] No access token, skipping');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Fetch current incidents
    const response = await fetch(`${config.apiUrl}/v1/incidents?state=triggered`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log('[BackgroundFetch] API request failed');
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const incidents: Incident[] = await response.json();
    const currentCount = incidents.length;

    // Get last known count
    const lastCountStr = await AsyncStorage.getItem(LAST_INCIDENT_COUNT_KEY);
    const lastCount = lastCountStr ? parseInt(lastCountStr, 10) : 0;

    // Update badge count
    await Notifications.setBadgeCountAsync(currentCount);

    // Store current count
    await AsyncStorage.setItem(LAST_INCIDENT_COUNT_KEY, currentCount.toString());

    // Check for new incidents
    if (currentCount > lastCount) {
      const newIncidentCount = currentCount - lastCount;
      console.log(`[BackgroundFetch] ${newIncidentCount} new incidents detected`);

      // Show local notification for new incidents
      const criticalIncidents = incidents.filter(i => i.severity === 'critical');
      if (criticalIncidents.length > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'New Critical Incidents',
            body: `${criticalIncidents.length} critical incident(s) require attention`,
            data: { type: 'background_refresh' },
            sound: true,
            categoryIdentifier: 'incident',
          },
          trigger: null, // Show immediately
        });
      }

      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    console.log('[BackgroundFetch] No new incidents');
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[BackgroundFetch] Error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
    });
    taskDefined = true;
  } catch (error) {
    console.error('[BackgroundFetch] Failed to define task:', error);
  }
};

// Check if background refresh is enabled
export const isBackgroundRefreshEnabled = async (): Promise<boolean> => {
  const enabled = await AsyncStorage.getItem(BACKGROUND_REFRESH_ENABLED_KEY);
  return enabled === 'true';
};

// Set background refresh enabled state
export const setBackgroundRefreshEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(BACKGROUND_REFRESH_ENABLED_KEY, enabled.toString());
  if (enabled) {
    await registerBackgroundFetch();
  } else {
    await unregisterBackgroundFetch();
  }
};

// Register the background fetch task
export const registerBackgroundFetch = async (): Promise<boolean> => {
  try {
    // Define the task first
    defineBackgroundTask();

    // Check if background fetch is available
    const status = await BackgroundFetch.getStatusAsync();

    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
      console.log('[BackgroundFetch] Background fetch is restricted');
      return false;
    }

    if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
      console.log('[BackgroundFetch] Background fetch is denied');
      return false;
    }

    // Check if already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (isRegistered) {
      console.log('[BackgroundFetch] Task already registered');
      return true;
    }

    // Register the task
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (minimum on iOS)
      stopOnTerminate: false, // Continue even if app is killed
      startOnBoot: true, // Start on device boot (Android)
    });

    console.log('[BackgroundFetch] Task registered successfully');
    await AsyncStorage.setItem(BACKGROUND_REFRESH_ENABLED_KEY, 'true');
    return true;
  } catch (error) {
    console.error('[BackgroundFetch] Failed to register:', error);
    return false;
  }
};

// Unregister the background fetch task
export const unregisterBackgroundFetch = async (): Promise<void> => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      console.log('[BackgroundFetch] Task unregistered');
    }
    await AsyncStorage.setItem(BACKGROUND_REFRESH_ENABLED_KEY, 'false');
  } catch (error) {
    console.error('[BackgroundFetch] Failed to unregister:', error);
  }
};

// Get background fetch status
export const getBackgroundFetchStatus = async (): Promise<{
  isAvailable: boolean;
  isRegistered: boolean;
  status: BackgroundFetch.BackgroundFetchStatus;
}> => {
  const status = await BackgroundFetch.getStatusAsync();
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);

  return {
    isAvailable: status === BackgroundFetch.BackgroundFetchStatus.Available,
    isRegistered,
    status,
  };
};

// Force a refresh (for testing)
export const forceRefresh = async (): Promise<void> => {
  console.log('[BackgroundFetch] Forcing refresh...');

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('[BackgroundFetch] No access token');
      return;
    }

    const response = await fetch(`${config.apiUrl}/v1/incidents?state=triggered`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const incidents: Incident[] = await response.json();
      await Notifications.setBadgeCountAsync(incidents.length);
      await AsyncStorage.setItem(LAST_INCIDENT_COUNT_KEY, incidents.length.toString());
      console.log(`[BackgroundFetch] Refreshed: ${incidents.length} incidents`);
    }
  } catch (error) {
    console.error('[BackgroundFetch] Force refresh failed:', error);
  }
};
