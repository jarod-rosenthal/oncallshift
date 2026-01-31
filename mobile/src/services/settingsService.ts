import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const KEYS = {
  THEME_MODE: 'app_theme_mode',
  ONBOARDING_COMPLETE: 'app_onboarding_complete',
  HAPTIC_ENABLED: 'app_haptic_enabled',
  SOUND_ENABLED: 'app_sound_enabled',
  SNOOZED_INCIDENTS: 'app_snoozed_incidents',
  CACHED_INCIDENTS: 'app_cached_incidents',
  CACHED_ONCALL: 'app_cached_oncall',
  CACHED_PROFILE: 'app_cached_profile',
  LAST_SYNC: 'app_last_sync',
  APP_VERSION_CHECK: 'app_version_check',
};

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  themeMode: ThemeMode;
  onboardingComplete: boolean;
  hapticEnabled: boolean;
  soundEnabled: boolean;
}

export interface SnoozedIncident {
  incidentId: string;
  snoozeUntil: string;
}

// Theme
export const getThemeMode = async (): Promise<ThemeMode> => {
  try {
    const value = await AsyncStorage.getItem(KEYS.THEME_MODE);
    if (value && ['light', 'dark', 'system'].includes(value)) {
      return value as ThemeMode;
    }
    return 'system';
  } catch {
    return 'system';
  }
};

export const setThemeMode = async (mode: ThemeMode): Promise<void> => {
  await AsyncStorage.setItem(KEYS.THEME_MODE, mode);
};

// Onboarding
export const isOnboardingComplete = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    return value === 'true';
  } catch {
    return false;
  }
};

export const setOnboardingComplete = async (complete: boolean): Promise<void> => {
  await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETE, complete.toString());
};

// Haptic feedback
export const isHapticEnabled = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(KEYS.HAPTIC_ENABLED);
    return value !== 'false'; // Default to true
  } catch {
    return true;
  }
};

export const setHapticEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(KEYS.HAPTIC_ENABLED, enabled.toString());
};

// Sound
export const isSoundEnabled = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(KEYS.SOUND_ENABLED);
    return value !== 'false'; // Default to true
  } catch {
    return true;
  }
};

export const setSoundEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(KEYS.SOUND_ENABLED, enabled.toString());
};

// Snoozed incidents
export const getSnoozedIncidents = async (): Promise<SnoozedIncident[]> => {
  try {
    const value = await AsyncStorage.getItem(KEYS.SNOOZED_INCIDENTS);
    if (value) {
      const snoozed = JSON.parse(value) as SnoozedIncident[];
      // Filter out expired snoozes
      const now = new Date().toISOString();
      return snoozed.filter(s => s.snoozeUntil > now);
    }
    return [];
  } catch {
    return [];
  }
};

export const snoozeIncident = async (incidentId: string, minutes: number): Promise<void> => {
  const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const existing = await getSnoozedIncidents();
  const updated = existing.filter(s => s.incidentId !== incidentId);
  updated.push({ incidentId, snoozeUntil });
  await AsyncStorage.setItem(KEYS.SNOOZED_INCIDENTS, JSON.stringify(updated));
};

export const unsnoozeIncident = async (incidentId: string): Promise<void> => {
  const existing = await getSnoozedIncidents();
  const updated = existing.filter(s => s.incidentId !== incidentId);
  await AsyncStorage.setItem(KEYS.SNOOZED_INCIDENTS, JSON.stringify(updated));
};

export const isIncidentSnoozed = async (incidentId: string): Promise<boolean> => {
  const snoozed = await getSnoozedIncidents();
  return snoozed.some(s => s.incidentId === incidentId);
};

// Offline cache
export const cacheIncidents = async (incidents: any[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.CACHED_INCIDENTS, JSON.stringify(incidents));
    await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
  } catch (error) {
  }
};

export const getCachedIncidents = async (): Promise<any[] | null> => {
  try {
    const value = await AsyncStorage.getItem(KEYS.CACHED_INCIDENTS);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const cacheOnCallData = async (data: any[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.CACHED_ONCALL, JSON.stringify(data));
  } catch (error) {
  }
};

export const getCachedOnCallData = async (): Promise<any[] | null> => {
  try {
    const value = await AsyncStorage.getItem(KEYS.CACHED_ONCALL);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const cacheProfile = async (profile: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.CACHED_PROFILE, JSON.stringify(profile));
  } catch (error) {
  }
};

export const getCachedProfile = async (): Promise<any | null> => {
  try {
    const value = await AsyncStorage.getItem(KEYS.CACHED_PROFILE);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const getLastSyncTime = async (): Promise<Date | null> => {
  try {
    const value = await AsyncStorage.getItem(KEYS.LAST_SYNC);
    return value ? new Date(value) : null;
  } catch {
    return null;
  }
};

// Version check
export const getLastVersionCheck = async (): Promise<{ version: string; checkedAt: string } | null> => {
  try {
    const value = await AsyncStorage.getItem(KEYS.APP_VERSION_CHECK);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const setLastVersionCheck = async (version: string): Promise<void> => {
  await AsyncStorage.setItem(KEYS.APP_VERSION_CHECK, JSON.stringify({
    version,
    checkedAt: new Date().toISOString(),
  }));
};

// Clear all settings (for logout)
export const clearAllSettings = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      KEYS.CACHED_INCIDENTS,
      KEYS.CACHED_ONCALL,
      KEYS.CACHED_PROFILE,
      KEYS.SNOOZED_INCIDENTS,
      KEYS.LAST_SYNC,
    ]);
  } catch (error) {
  }
};
