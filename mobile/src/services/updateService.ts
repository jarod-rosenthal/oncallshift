import { Alert, Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';
import { getAccessToken } from './authService';

const LAST_UPDATE_CHECK_KEY = '@last_update_check';
const DISMISSED_VERSION_KEY = '@dismissed_version';
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

interface VersionInfo {
  currentVersion: string;
  latestVersion: string;
  minRequiredVersion: string;
  forceUpdate: boolean;
  updateUrl: {
    ios: string;
    android: string;
  };
  releaseNotes?: string;
}

// Compare version strings (e.g., "1.2.3" vs "1.2.4")
const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
};

// Get current app version
export const getCurrentVersion = (): string => {
  return Application.nativeApplicationVersion || '1.0.0';
};

// Get current build number
export const getCurrentBuild = (): string => {
  return Application.nativeBuildVersion || '1';
};

// Fetch version info from backend
const fetchVersionInfo = async (): Promise<VersionInfo | null> => {
  try {
    const response = await fetch(`${config.apiUrl}/v1/app/version`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Platform': Platform.OS,
        'X-App-Version': getCurrentVersion(),
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
};

// Check if update is available
export const checkForUpdate = async (force = false): Promise<{
  updateAvailable: boolean;
  forceUpdate: boolean;
  version?: string;
  releaseNotes?: string;
} | null> => {
  try {
    // Check if we should skip this check
    if (!force) {
      const lastCheck = await AsyncStorage.getItem(LAST_UPDATE_CHECK_KEY);
      if (lastCheck) {
        const lastCheckTime = parseInt(lastCheck, 10);
        if (Date.now() - lastCheckTime < UPDATE_CHECK_INTERVAL) {
          return null;
        }
      }
    }

    // Update last check time
    await AsyncStorage.setItem(LAST_UPDATE_CHECK_KEY, Date.now().toString());

    // Fetch version info
    const versionInfo = await fetchVersionInfo();
    if (!versionInfo) {
      // If API is not available, use fallback logic
      return checkForUpdateFallback();
    }

    const currentVersion = getCurrentVersion();

    // Check if force update is required
    if (compareVersions(currentVersion, versionInfo.minRequiredVersion) < 0) {
      return {
        updateAvailable: true,
        forceUpdate: true,
        version: versionInfo.latestVersion,
        releaseNotes: versionInfo.releaseNotes,
      };
    }

    // Check if regular update is available
    if (compareVersions(currentVersion, versionInfo.latestVersion) < 0) {
      // Check if user dismissed this version
      const dismissedVersion = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
      if (dismissedVersion === versionInfo.latestVersion && !force) {
        return null;
      }

      return {
        updateAvailable: true,
        forceUpdate: false,
        version: versionInfo.latestVersion,
        releaseNotes: versionInfo.releaseNotes,
      };
    }

    return {
      updateAvailable: false,
      forceUpdate: false,
    };
  } catch (error) {
    return null;
  }
};

// Fallback check when API is not available
const checkForUpdateFallback = async (): Promise<{
  updateAvailable: boolean;
  forceUpdate: boolean;
} | null> => {
  // In fallback mode, we can't determine if an update is available
  // This could be enhanced to check the App Store / Play Store directly
  return null;
};

// Show update dialog
export const showUpdateDialog = (
  version: string,
  forceUpdate: boolean,
  releaseNotes?: string,
  onUpdate?: () => void,
  onDismiss?: () => void
): void => {
  const title = forceUpdate ? 'Update Required' : 'Update Available';
  const message = forceUpdate
    ? `A critical update (v${version}) is required to continue using OnCallShift. Please update now.`
    : `A new version (v${version}) of OnCallShift is available.${releaseNotes ? `\n\n${releaseNotes}` : ''}`;

  const buttons = forceUpdate
    ? [
        {
          text: 'Update Now',
          onPress: () => {
            openAppStore();
            onUpdate?.();
          },
        },
      ]
    : [
        {
          text: 'Later',
          style: 'cancel' as const,
          onPress: async () => {
            await dismissVersion(version);
            onDismiss?.();
          },
        },
        {
          text: 'Update',
          onPress: () => {
            openAppStore();
            onUpdate?.();
          },
        },
      ];

  Alert.alert(title, message, buttons, { cancelable: !forceUpdate });
};

// Dismiss a version (user chose "Later")
const dismissVersion = async (version: string): Promise<void> => {
  await AsyncStorage.setItem(DISMISSED_VERSION_KEY, version);
};

// Clear dismissed version (for testing)
export const clearDismissedVersion = async (): Promise<void> => {
  await AsyncStorage.removeItem(DISMISSED_VERSION_KEY);
};

// Open the app store
export const openAppStore = (): void => {
  const storeUrl =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/oncallshift/id1234567890'
      : 'https://play.google.com/store/apps/details?id=com.oncallshift.mobile';

  Linking.openURL(storeUrl).catch((err) => {
    Alert.alert('Error', 'Could not open the app store. Please update manually.');
  });
};

// Initialize update check on app start
export const initUpdateCheck = async (): Promise<void> => {
  const result = await checkForUpdate();

  if (result?.updateAvailable) {
    showUpdateDialog(
      result.version || 'latest',
      result.forceUpdate,
      result.releaseNotes
    );
  }
};
