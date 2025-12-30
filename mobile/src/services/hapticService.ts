import * as Haptics from 'expo-haptics';
import * as settingsService from './settingsService';

let hapticEnabled = true;

// Initialize haptic settings
export const initHaptics = async (): Promise<void> => {
  hapticEnabled = await settingsService.isHapticEnabled();
};

// Light tap - for button presses, selections
export const lightTap = async (): Promise<void> => {
  if (!hapticEnabled) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    // Haptics may not be available on all devices
  }
};

// Medium tap - for toggle switches, confirmations
export const mediumTap = async (): Promise<void> => {
  if (!hapticEnabled) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (error) {
    // Haptics may not be available on all devices
  }
};

// Heavy tap - for destructive actions, important events
export const heavyTap = async (): Promise<void> => {
  if (!hapticEnabled) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch (error) {
    // Haptics may not be available on all devices
  }
};

// Success - for successful operations (acknowledge, resolve)
export const success = async (): Promise<void> => {
  if (!hapticEnabled) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    // Haptics may not be available on all devices
  }
};

// Warning - for warnings
export const warning = async (): Promise<void> => {
  if (!hapticEnabled) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (error) {
    // Haptics may not be available on all devices
  }
};

// Error - for errors
export const error = async (): Promise<void> => {
  if (!hapticEnabled) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (error) {
    // Haptics may not be available on all devices
  }
};

// Selection changed - for picker/list selection changes
export const selectionChanged = async (): Promise<void> => {
  if (!hapticEnabled) return;
  try {
    await Haptics.selectionAsync();
  } catch (error) {
    // Haptics may not be available on all devices
  }
};

// Update haptic enabled state
export const setHapticEnabled = async (enabled: boolean): Promise<void> => {
  hapticEnabled = enabled;
  await settingsService.setHapticEnabled(enabled);
};

// Get current haptic enabled state
export const isHapticEnabled = (): boolean => {
  return hapticEnabled;
};
