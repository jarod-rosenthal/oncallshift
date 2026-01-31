import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometricEnabled';

export interface BiometricCapability {
  isAvailable: boolean;
  biometricType: 'fingerprint' | 'facial' | 'iris' | 'none';
  isEnrolled: boolean;
}

/**
 * Check if biometric authentication is available on the device
 */
export const getBiometricCapability = async (): Promise<BiometricCapability> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType: BiometricCapability['biometricType'] = 'none';

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'facial';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'fingerprint';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometricType = 'iris';
    }

    return {
      isAvailable: hasHardware && isEnrolled,
      biometricType,
      isEnrolled,
    };
  } catch (error) {
    return {
      isAvailable: false,
      biometricType: 'none',
      isEnrolled: false,
    };
  }
};

/**
 * Get user-friendly name for the biometric type
 */
export const getBiometricTypeName = (type: BiometricCapability['biometricType']): string => {
  switch (type) {
    case 'facial':
      return 'Face ID';
    case 'fingerprint':
      return 'Fingerprint';
    case 'iris':
      return 'Iris';
    default:
      return 'Biometric';
  }
};

/**
 * Check if biometric authentication is enabled by the user
 */
export const isBiometricEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  } catch (error) {
    return false;
  }
};

/**
 * Set biometric authentication enabled/disabled
 */
export const setBiometricEnabled = async (enabled: boolean): Promise<void> => {
  try {
    if (enabled) {
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
    } else {
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Authenticate using biometrics
 */
export const authenticateWithBiometrics = async (
  promptMessage?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const capability = await getBiometricCapability();

    if (!capability.isAvailable) {
      return { success: false, error: 'Biometric authentication not available' };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || 'Authenticate to continue',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      fallbackLabel: 'Use Passcode',
    });

    if (result.success) {
      return { success: true };
    } else {
      let errorMessage = 'Authentication failed';
      const errorCode = 'error' in result ? result.error : undefined;
      if (errorCode === 'user_cancel') {
        errorMessage = 'Authentication cancelled';
      } else if (errorCode === 'user_fallback') {
        errorMessage = 'User chose to use passcode';
      } else if (errorCode === 'lockout') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      return { success: false, error: errorMessage };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Authentication error' };
  }
};
