import { Audio } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_ENABLED_KEY = '@sound_enabled';
const SOUND_VOLUME_KEY = '@sound_volume';
const ALERT_SOUND_KEY = '@alert_sound';

type Severity = 'critical' | 'error' | 'warning' | 'info';

// Available alert sound options
export type AlertSoundType =
  | 'classic'      // Classic phone ring
  | 'urgent'       // Urgent pulsing alarm
  | 'chime'        // Pleasant chime
  | 'siren'        // Emergency siren
  | 'beacon'       // Radar beacon
  | 'digital'      // Digital alert
  | 'gentle';      // Gentle notification

export interface AlertSoundOption {
  id: AlertSoundType;
  name: string;
  description: string;
}

export const ALERT_SOUND_OPTIONS: AlertSoundOption[] = [
  { id: 'classic', name: 'Classic Ring', description: 'Traditional phone ring tone' },
  { id: 'urgent', name: 'Urgent Pulse', description: 'Fast pulsing alarm for critical alerts' },
  { id: 'chime', name: 'Chime', description: 'Pleasant two-tone chime' },
  { id: 'siren', name: 'Siren', description: 'Emergency siren sound' },
  { id: 'beacon', name: 'Beacon', description: 'Radar-style beacon ping' },
  { id: 'digital', name: 'Digital', description: 'Modern digital alert tone' },
  { id: 'gentle', name: 'Gentle', description: 'Soft, less intrusive alert' },
];

let selectedAlertSound: AlertSoundType = 'urgent';

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

    const [enabledStr, volumeStr, alertSoundStr] = await Promise.all([
      AsyncStorage.getItem(SOUND_ENABLED_KEY),
      AsyncStorage.getItem(SOUND_VOLUME_KEY),
      AsyncStorage.getItem(ALERT_SOUND_KEY),
    ]);

    if (enabledStr !== null) {
      soundsEnabled = enabledStr === 'true';
    }
    if (volumeStr !== null) {
      soundVolume = parseFloat(volumeStr);
    }
    if (alertSoundStr !== null) {
      selectedAlertSound = alertSoundStr as AlertSoundType;
    }
  } catch (error) {
  }
};

// Get current alert sound
export const getAlertSound = (): AlertSoundType => selectedAlertSound;

// Set alert sound
export const setAlertSound = async (sound: AlertSoundType): Promise<void> => {
  selectedAlertSound = sound;
  await AsyncStorage.setItem(ALERT_SOUND_KEY, sound);
};

// Sound configurations for each alert type
const ALERT_SOUND_CONFIGS: Record<AlertSoundType, { frequency: number; duration: number; pattern: 'steady' | 'pulse' | 'chime' | 'siren' | 'beacon' }> = {
  classic: { frequency: 440, duration: 1.5, pattern: 'steady' },    // A4 - classic ring
  urgent: { frequency: 880, duration: 1.0, pattern: 'pulse' },      // A5 - urgent pulse
  chime: { frequency: 523, duration: 0.8, pattern: 'chime' },       // C5 - pleasant chime
  siren: { frequency: 660, duration: 2.0, pattern: 'siren' },       // E5 - siren
  beacon: { frequency: 1047, duration: 1.2, pattern: 'beacon' },    // C6 - radar beacon
  digital: { frequency: 1200, duration: 0.6, pattern: 'pulse' },    // Digital beep
  gentle: { frequency: 392, duration: 1.0, pattern: 'chime' },      // G4 - gentle
};

// Play a specific alert sound type
const playAlertSoundByType = async (type: AlertSoundType): Promise<void> => {
  const config = ALERT_SOUND_CONFIGS[type];

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });

    const sampleRate = 44100;
    const wavBuffer = createAlertWavBuffer(config.frequency, config.duration, sampleRate, config.pattern);
    const base64 = bufferToBase64(wavBuffer);
    const dataUri = `data:audio/wav;base64,${base64}`;

    const { sound } = await Audio.Sound.createAsync(
      { uri: dataUri },
      {
        shouldPlay: true,
        volume: soundVolume,
        isLooping: false,
      }
    );

    currentSound = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        currentSound = null;
      }
    });

  } catch (error) {
  }
};

// Preview a specific alert sound
export const previewAlertSound = async (sound: AlertSoundType): Promise<void> => {
  await stopCurrentSound();
  await playAlertSoundByType(sound);
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
    }
  }
};

// Sound file mapping - using bundled sounds or remote URLs
const getSoundSource = (type: string) => {
  // Try to use bundled sounds first
  try {
    // For development/testing, use a remote sound
    // In production, replace with: require(`../../assets/sounds/${type}.wav`)
    return null;
  } catch {
    return null;
  }
};

/**
 * Play a critical alert sound that works even in silent mode
 * Uses the user's selected alert sound preference
 */
export const playCriticalAlert = async (): Promise<void> => {
  await stopCurrentSound();

  try {
    // Configure audio for critical alerts
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,  // KEY: Play even when muted
      staysActiveInBackground: true,
      shouldDuckAndroid: false,  // Don't duck - we're the priority
      interruptionModeIOS: 2,  // DuckOthers
      interruptionModeAndroid: 2,  // DuckOthers
    });

    // Use the user's selected alert sound
    const config = ALERT_SOUND_CONFIGS[selectedAlertSound];
    const sampleRate = 44100;

    // Create WAV file with the selected sound pattern
    const wavBuffer = createAlertWavBuffer(config.frequency, config.duration, sampleRate, config.pattern);
    const base64 = bufferToBase64(wavBuffer);
    const dataUri = `data:audio/wav;base64,${base64}`;

    const { sound } = await Audio.Sound.createAsync(
      { uri: dataUri },
      {
        shouldPlay: true,
        volume: 1.0,
        isLooping: false,
      }
    );

    currentSound = sound;
    await sound.playAsync();

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        currentSound = null;
      }
    });

  } catch (error) {
  }
};

/**
 * Create a WAV audio buffer with a sine wave
 */
function createWavBuffer(frequency: number, duration: number, sampleRate: number): Uint8Array {
  const numSamples = Math.floor(sampleRate * duration);
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate sine wave with envelope (attack/decay for less harsh sound)
  const attackSamples = Math.floor(sampleRate * 0.01); // 10ms attack
  const decaySamples = Math.floor(sampleRate * 0.1); // 100ms decay

  for (let i = 0; i < numSamples; i++) {
    let amplitude = 0.8; // 80% volume

    // Apply envelope
    if (i < attackSamples) {
      amplitude *= i / attackSamples;
    } else if (i > numSamples - decaySamples) {
      amplitude *= (numSamples - i) / decaySamples;
    }

    // Add some urgency with slight frequency modulation
    const freqMod = 1 + 0.02 * Math.sin(2 * Math.PI * 4 * i / sampleRate);
    const sample = Math.sin(2 * Math.PI * frequency * freqMod * i / sampleRate) * amplitude;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Create a WAV audio buffer with different sound patterns
 */
function createAlertWavBuffer(
  frequency: number,
  duration: number,
  sampleRate: number,
  pattern: 'steady' | 'pulse' | 'chime' | 'siren' | 'beacon'
): Uint8Array {
  const numSamples = Math.floor(sampleRate * duration);
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate audio samples based on pattern
  const attackSamples = Math.floor(sampleRate * 0.01);
  const decaySamples = Math.floor(sampleRate * 0.1);

  for (let i = 0; i < numSamples; i++) {
    let amplitude = 0.7;
    let freq = frequency;
    const t = i / sampleRate;

    // Apply envelope
    if (i < attackSamples) {
      amplitude *= i / attackSamples;
    } else if (i > numSamples - decaySamples) {
      amplitude *= (numSamples - i) / decaySamples;
    }

    // Apply pattern-specific modulation
    switch (pattern) {
      case 'steady':
        // Classic ring - slight tremolo
        amplitude *= 0.8 + 0.2 * Math.sin(2 * Math.PI * 8 * t);
        break;

      case 'pulse':
        // Urgent pulse - on/off pattern
        const pulseRate = 4; // 4 Hz pulse
        amplitude *= Math.sin(2 * Math.PI * pulseRate * t) > 0 ? 1 : 0.2;
        break;

      case 'chime':
        // Pleasant chime - two-tone with decay
        const chimeDecay = Math.exp(-t * 3);
        amplitude *= chimeDecay;
        // Add second harmonic for richness
        freq = frequency * (1 + 0.5 * Math.sin(2 * Math.PI * 2 * t));
        break;

      case 'siren':
        // Siren - frequency sweep up and down
        const sirenCycle = Math.sin(2 * Math.PI * 1 * t); // 1 Hz sweep
        freq = frequency * (1 + 0.3 * sirenCycle);
        break;

      case 'beacon':
        // Radar beacon - short pulses
        const beaconPulseWidth = 0.15; // 150ms pulse
        const beaconPeriod = 0.5; // 500ms period
        const beaconPhase = (t % beaconPeriod) / beaconPeriod;
        amplitude *= beaconPhase < beaconPulseWidth / beaconPeriod ? 1 : 0;
        // Quick decay on each pulse
        if (beaconPhase < beaconPulseWidth / beaconPeriod) {
          const pulseT = beaconPhase * beaconPeriod / beaconPulseWidth;
          amplitude *= 1 - pulseT * 0.5;
        }
        break;
    }

    const sample = Math.sin(2 * Math.PI * freq * t) * amplitude;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  return new Uint8Array(buffer);
}

function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

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
    }
  } catch (error) {
  }
};

// Fallback to system sound generation
const playSystemSound = async (severity: Severity): Promise<void> => {
  // On real devices, this would trigger a system notification sound
  // For now, we log the intent
};

// Play a specific action sound (for feedback)
export const playActionSound = async (action: 'acknowledge' | 'resolve'): Promise<void> => {
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
    }
  } catch (error) {
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
