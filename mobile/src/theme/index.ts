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

// Light mode colors - Calm, professional slate blue palette
export const lightColors = {
  // Primary slate blue
  primary: '#475569',
  primaryLight: '#64748B',
  primaryDark: '#334155',

  // Accent blue for interactive elements
  accent: '#6366F1',
  accentLight: '#818CF8',
  accentMuted: '#A5B4FC',

  // Backgrounds - warm, soft grays
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',

  // Text - softer for less harsh contrast
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',

  // Borders
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Status colors - slightly muted for calm feel
  success: '#059669',
  successLight: '#D1FAE5',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  info: '#0284C7',
  infoLight: '#E0F2FE',
};

// Dark mode colors
export const darkColors = {
  // Primary slate blue (lighter for dark mode)
  primary: '#94A3B8',
  primaryLight: '#CBD5E1',
  primaryDark: '#64748B',

  // Accent blue for interactive elements
  accent: '#818CF8',
  accentLight: '#A5B4FC',
  accentMuted: '#6366F1',

  // Backgrounds - dark slate
  background: '#0F172A',
  surface: '#1E293B',
  surfaceSecondary: '#334155',

  // Text - light for dark backgrounds
  textPrimary: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textMuted: '#64748B',

  // Borders
  border: '#475569',
  borderLight: '#334155',

  // Status colors - brighter for dark mode visibility
  success: '#10B981',
  successLight: '#064E3B',
  warning: '#F59E0B',
  warningLight: '#78350F',
  error: '#EF4444',
  errorLight: '#7F1D1D',
  info: '#38BDF8',
  infoLight: '#0C4A6E',
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
    primaryContainer: lightColors.surfaceSecondary,
    secondary: lightColors.accent,
    secondaryContainer: '#EEF2FF',
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
    onSecondaryContainer: '#3730A3',
    onSurface: lightColors.textPrimary,
    onSurfaceVariant: lightColors.textSecondary,
    onBackground: lightColors.textPrimary,
    onError: '#FFFFFF',
    onErrorContainer: '#991B1B',
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
    primaryContainer: darkColors.surfaceSecondary,
    secondary: darkColors.accent,
    secondaryContainer: '#312E81',
    tertiary: darkColors.primaryLight,
    tertiaryContainer: darkColors.surfaceSecondary,
    surface: darkColors.surface,
    surfaceVariant: darkColors.surfaceSecondary,
    background: darkColors.background,
    error: darkColors.error,
    errorContainer: darkColors.errorLight,
    onPrimary: '#0F172A',
    onPrimaryContainer: darkColors.primaryLight,
    onSecondary: '#0F172A',
    onSecondaryContainer: '#C7D2FE',
    onSurface: darkColors.textPrimary,
    onSurfaceVariant: darkColors.textSecondary,
    onBackground: darkColors.textPrimary,
    onError: '#FFFFFF',
    onErrorContainer: '#FECACA',
    outline: darkColors.border,
    outlineVariant: darkColors.borderLight,
    elevation: {
      level0: 'transparent',
      level1: darkColors.surface,
      level2: '#253349',
      level3: '#2D3D52',
      level4: '#35475B',
      level5: '#3D5164',
    },
  },
  roundness: 12,
};

// Default theme export (light)
export const theme = lightTheme;

// Severity colors - slightly muted for professional feel
export const severityColors = {
  critical: '#DC2626',
  error: '#E11D48',
  warning: '#D97706',
  info: '#0284C7',
  default: lightColors.textSecondary,
};

// Status colors - professional but clear
export const statusColors = {
  triggered: '#DC2626',
  acknowledged: '#D97706',
  resolved: '#059669',
};

export type AppTheme = typeof theme;
