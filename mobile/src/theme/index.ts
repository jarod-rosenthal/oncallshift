import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';

const fontConfig = {
  displayLarge: { fontFamily: 'System', fontWeight: '400' as const },
  displayMedium: { fontFamily: 'System', fontWeight: '400' as const },
  displaySmall: { fontFamily: 'System', fontWeight: '400' as const },
  headlineLarge: { fontFamily: 'System', fontWeight: '400' as const },
  headlineMedium: { fontFamily: 'System', fontWeight: '400' as const },
  headlineSmall: { fontFamily: 'System', fontWeight: '400' as const },
  titleLarge: { fontFamily: 'System', fontWeight: '500' as const },
  titleMedium: { fontFamily: 'System', fontWeight: '500' as const },
  titleSmall: { fontFamily: 'System', fontWeight: '500' as const },
  labelLarge: { fontFamily: 'System', fontWeight: '500' as const },
  labelMedium: { fontFamily: 'System', fontWeight: '500' as const },
  labelSmall: { fontFamily: 'System', fontWeight: '500' as const },
  bodyLarge: { fontFamily: 'System', fontWeight: '400' as const },
  bodyMedium: { fontFamily: 'System', fontWeight: '400' as const },
  bodySmall: { fontFamily: 'System', fontWeight: '400' as const },
};

// Light mode colors - "Calm Confidence" palette
// Design philosophy: Muted, professional tones that lower stress during incident response
export const lightColors = {
  // Primary warm slate - approachable professionalism
  primary: '#4A5568',
  primaryLight: '#718096',
  primaryDark: '#2D3748',
  primaryContainer: '#EDF2F7',

  // Accent calming teal - professional, not playful (replaces indigo)
  accent: '#319795',
  accentLight: '#4FD1C5',
  accentMuted: '#81E6D9',

  // Backgrounds - warm, neutral off-whites
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F7FAFC',
  surfaceVariant: '#EDF2F7',

  // Text - softer contrast for less eye strain
  textPrimary: '#2D3748',
  textSecondary: '#718096',
  textMuted: '#A0AEC0',
  textDisabled: '#CBD5E0',

  // Borders - near-invisible structure
  border: '#E2E8F0',
  borderLight: '#EDF2F7',
  borderFocus: '#4A5568',

  // Status colors - desaturated for calm (serious but not alarming)
  success: '#38A169',       // Sage green - confirmation without celebration
  successLight: '#C6F6D5',
  warning: '#B7791F',       // Earthy ochre - noticeable without screaming
  warningLight: '#FAF089',
  warningMuted: '#D69E2E',
  error: '#C53030',         // Muted terracotta red - urgent but not panic-inducing
  errorLight: '#FED7D7',
  info: '#3182CE',          // Calm cerulean - informational only
  infoLight: '#BEE3F8',
};

// Dark mode colors - "Calm Confidence" dark palette
export const darkColors = {
  // Primary slate (lifted for visibility on dark)
  primary: '#A0AEC0',
  primaryLight: '#CBD5E0',
  primaryDark: '#718096',
  primaryContainer: '#2D3748',

  // Accent bright teal for dark backgrounds
  accent: '#4FD1C5',
  accentLight: '#81E6D9',
  accentMuted: '#319795',

  // Backgrounds - deep navy slate (easier on eyes than pure black)
  background: '#1A202C',
  surface: '#2D3748',
  surfaceSecondary: '#4A5568',
  surfaceVariant: '#4A5568',

  // Text - light for dark backgrounds
  textPrimary: '#F7FAFC',
  textSecondary: '#E2E8F0',
  textMuted: '#A0AEC0',
  textDisabled: '#718096',

  // Borders
  border: '#4A5568',
  borderLight: '#2D3748',
  borderFocus: '#A0AEC0',

  // Status colors - softened for night (visible without piercing)
  success: '#68D391',       // Mint green - soft confirmation
  successLight: '#276749',
  warning: '#F6AD55',       // Warm peach - gentle warning
  warningLight: '#744210',
  warningMuted: '#DD6B20',
  error: '#FC8181',         // Soft coral - visible without piercing
  errorLight: '#822727',
  info: '#63B3ED',          // Sky blue - informational
  infoLight: '#2A4365',
};

// Default to light colors (will be overridden by context)
export let colors = lightColors;

// Function to update colors based on theme
export const setColors = (isDark: boolean) => {
  colors = isDark ? darkColors : lightColors;
};

export const lightTheme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    primary: lightColors.primary,
    primaryContainer: lightColors.surfaceVariant,
    secondary: lightColors.accent,
    secondaryContainer: '#E6FFFA', // Teal container
    tertiary: lightColors.primaryLight,
    tertiaryContainer: lightColors.surfaceSecondary,
    surface: lightColors.surface,
    surfaceVariant: lightColors.surfaceSecondary,
    background: lightColors.background,
    error: lightColors.error,
    errorContainer: lightColors.errorLight,
    onPrimary: '#FFFFFF',
    onPrimaryContainer: lightColors.primaryDark,
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#234E52', // Dark teal text
    onSurface: lightColors.textPrimary,
    onSurfaceVariant: lightColors.textSecondary,
    onBackground: lightColors.textPrimary,
    onError: '#FFFFFF',
    onErrorContainer: '#822727',
    outline: lightColors.border,
    outlineVariant: lightColors.borderLight,
    elevation: {
      level0: 'transparent',
      level1: lightColors.surface,
      level2: lightColors.surface,
      level3: lightColors.surface,
      level4: lightColors.surface,
      level5: lightColors.surface,
    },
  },
  roundness: 12,
};

export const darkTheme = {
  ...MD3DarkTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3DarkTheme.colors,
    primary: darkColors.primary,
    primaryContainer: darkColors.primaryContainer,
    secondary: darkColors.accent,
    secondaryContainer: '#234E52', // Dark teal container
    tertiary: darkColors.primaryLight,
    tertiaryContainer: darkColors.surfaceSecondary,
    surface: darkColors.surface,
    surfaceVariant: darkColors.surfaceSecondary,
    background: darkColors.background,
    error: darkColors.error,
    errorContainer: darkColors.errorLight,
    onPrimary: '#1A202C',
    onPrimaryContainer: darkColors.primaryLight,
    onSecondary: '#1A202C',
    onSecondaryContainer: '#81E6D9', // Light teal text
    onSurface: darkColors.textPrimary,
    onSurfaceVariant: darkColors.textSecondary,
    onBackground: darkColors.textPrimary,
    onError: '#1A202C',
    onErrorContainer: '#FED7D7',
    outline: darkColors.border,
    outlineVariant: darkColors.borderLight,
    elevation: {
      level0: 'transparent',
      level1: darkColors.surface,
      level2: '#374151',
      level3: '#4B5563',
      level4: '#6B7280',
      level5: '#9CA3AF',
    },
  },
  roundness: 12,
};

// Default theme export (light)
export const theme = lightTheme;

// Severity colors - graduated calm (urgent but not panic-inducing)
export const severityColors = {
  critical: '#C53030',   // Muted red - urgent but not panic-inducing
  high: '#B7791F',       // Ochre - elevated attention
  error: '#C53030',      // Same as critical for consistency
  warning: '#B7791F',    // Earthy ochre
  moderate: '#3182CE',   // Blue - standard awareness
  medium: '#3182CE',     // Alias for moderate
  info: '#3182CE',       // Calm cerulean - informational only
  low: '#718096',        // Slate - minimal concern
  default: '#A0AEC0',    // Barely noticeable
};

// Status colors - calm but clear state indication
export const statusColors = {
  triggered: '#C53030',   // Muted terracotta - needs action, not alarm
  acknowledged: '#B7791F', // Earthy ochre - being handled
  resolved: '#38A169',    // Sage green - confirmation without celebration
};

// Dark mode status colors (for reference when needed)
export const statusColorsDark = {
  triggered: '#FC8181',   // Soft coral
  acknowledged: '#F6AD55', // Warm peach
  resolved: '#68D391',    // Mint green
};

export type AppTheme = typeof theme;
