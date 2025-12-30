import { Audio } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_ENABLED_KEY = '@sound_enabled';
const SOUND_VOLUME_KEY = '@sound_volume';

type Severity = 'critical' | 'error' | 'warning' | 'info';

// Sound frequencies and patterns for different severities
// Using simple tone generation since we don't have actual sound files
const SEVERITY_CONFIG: Record<Severity, { frequency: number; duration: number; pattern: number[] }> = {
  critical: { frequency: 880, duration: 200, pattern: [1, 0.5, 1, 0.5, 1] }, // Urgent triple beep
  error: { frequency: 660, duration: 250, pattern: [1, 0.5, 1] }, // Double beep
  warning: { frequency: 440, duration: 300, pattern: [1] }, // Single beep
  info: { frequency: 330, duration: 200, pattern: [0.5] }, // Soft single beep
};

let soundsEnabled = true;
let soundVolume = 1.0;
let currentSound: Sound | null = null;

// Initialize sound settings from storage
export const initSoundService = async (): Promise<void> => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });

    const [enabledStr, volumeStr] = await Promise.all([
      AsyncStorage.getItem(SOUND_ENABLED_KEY),
      AsyncStorage.getItem(SOUND_VOLUME_KEY),
    ]);

    if (enabledStr !== null) {
      soundsEnabled = enabledStr === 'true';
    }
    if (volumeStr !== null) {
      soundVolume = parseFloat(volumeStr);
    }
  } catch (error) {
    console.error('Failed to initialize sound service:', error);
  }
};

// Check if sounds are enabled
export const isSoundEnabled = (): boolean => soundsEnabled;

// Toggle sound on/off
export const setSoundEnabled = async (enabled: boolean): Promise<void> => {
  soundsEnabled = enabled;
  await AsyncStorage.setItem(SOUND_ENABLED_KEY, enabled.toString());
};

// Get current volume
export const getSoundVolume = (): number => soundVolume;

// Set volume (0.0 to 1.0)
export const setSoundVolume = async (volume: number): Promise<void> => {
  soundVolume = Math.max(0, Math.min(1, volume));
  await AsyncStorage.setItem(SOUND_VOLUME_KEY, soundVolume.toString());
};

// Stop any currently playing sound
export const stopCurrentSound = async (): Promise<void> => {
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      currentSound = null;
    } catch (error) {
      console.error('Failed to stop sound:', error);
    }
  }
};

// Sound file mapping - these would be actual bundled sounds in production
// For now, we use a placeholder approach
const getSoundSource = (type: string) => {
  // In production, you'd have actual sound files:
  // return require(`../../assets/sounds/${type}.mp3`);
  // For development, we return null and handle gracefully
  return null;
};

// Play alert sound for a specific severity
export const playAlertSound = async (severity: Severity): Promise<void> => {
  if (!soundsEnabled) return;

  await stopCurrentSound();

  const config = SEVERITY_CONFIG[severity];

  try {
    const soundSource = getSoundSource(severity);

    if (soundSource) {
      const { sound } = await Audio.Sound.createAsync(soundSource, {
        shouldPlay: false,
        volume: soundVolume * config.pattern[0],
      });

      currentSound = sound;
      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          currentSound = null;
        }
      });
    } else {
      // Log for development - in production this would play actual sounds
      console.log(`[SoundService] Would play ${severity} alert (${config.frequency}Hz, ${config.duration}ms)`);
    }
  } catch (error) {
    console.log('Sound playback not available:', error);
  }
};

// Fallback to system sound generation
const playSystemSound = async (severity: Severity): Promise<void> => {
  // On real devices, this would trigger a system notification sound
  // For now, we log the intent
  console.log(`Playing ${severity} alert sound at volume ${soundVolume}`);
};

// Play a specific action sound (for feedback)
export const playActionSound = async (action: 'acknowledge' | 'resolve' | 'snooze'): Promise<void> => {
  if (!soundsEnabled) return;

  try {
    const soundSource = getSoundSource(action);

    if (soundSource) {
      const { sound } = await Audio.Sound.createAsync(soundSource, {
        shouldPlay: true,
        volume: soundVolume * 0.5, // Action sounds are quieter
      });

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } else {
      console.log(`[SoundService] Would play ${action} action sound`);
    }
  } catch (error) {
    console.log('Action sound not available');
  }
};

// Test sound at a specific volume
export const testSound = async (severity: Severity = 'info'): Promise<void> => {
  const wasEnabled = soundsEnabled;
  soundsEnabled = true;
  await playAlertSound(severity);
  soundsEnabled = wasEnabled;
};

// Get severity config for UI display
export const getSeverityConfig = () => SEVERITY_CONFIG;
