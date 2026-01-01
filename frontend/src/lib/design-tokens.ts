/**
 * Design Tokens for OnCallShift
 * Atlassian-inspired design system
 *
 * These tokens provide programmatic access to the design system values.
 * For CSS usage, prefer the Tailwind classes or CSS variables.
 */

// Color palette (hex values for use in JS/Canvas/Charts)
export const colors = {
  // Primary (Atlassian Blue)
  primary: {
    DEFAULT: '#0052CC',
    hover: '#1868DB',
    foreground: '#FFFFFF',
  },

  // Neutral grays
  neutral: {
    50: '#FAFBFC',   // lightest
    100: '#F8F8F8',  // page background
    200: '#EEEFF1',  // card background alt
    300: '#DDDEE1',  // borders
    400: '#9FA1A6',  // disabled
    500: '#747579',  // muted text
    600: '#505258',  // secondary text
    700: '#2C2D30',  // headings
    900: '#101214',  // primary text
  },

  // Accent blues
  blue: {
    50: '#EDF5FF',
    100: '#CFE1FD',
    600: '#0052CC',
  },

  // Accent purple
  purple: {
    50: '#FAF8FF',
    100: '#EED7FC',
  },

  // Status colors
  success: '#2A9D5F',
  warning: '#FF9500',
  danger: '#E63946',
  info: '#0052CC',
} as const;

// Typography scale
export const typography = {
  display: {
    '2xl': {
      fontSize: '64px',
      lineHeight: '72px',
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    xl: {
      fontSize: '48px',
      lineHeight: '56px',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
  },
  heading: {
    '2xl': { fontSize: '40px', lineHeight: '48px', fontWeight: 600 },
    xl: { fontSize: '32px', lineHeight: '40px', fontWeight: 600 },
    lg: { fontSize: '24px', lineHeight: '32px', fontWeight: 600 },
    md: { fontSize: '20px', lineHeight: '28px', fontWeight: 600 },
    sm: { fontSize: '16px', lineHeight: '24px', fontWeight: 600 },
  },
  body: {
    lg: { fontSize: '18px', lineHeight: '28px', fontWeight: 400 },
    md: { fontSize: '16px', lineHeight: '24px', fontWeight: 400 },
    sm: { fontSize: '14px', lineHeight: '20px', fontWeight: 400 },
    xs: { fontSize: '12px', lineHeight: '16px', fontWeight: 400 },
  },
} as const;

// Spacing scale (in pixels)
export const spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

// Shadows
export const shadows = {
  sm: '0 1px 2px rgba(9, 30, 66, 0.08)',
  md: '0 4px 8px rgba(9, 30, 66, 0.12)',
  lg: '0 8px 12px rgba(9, 30, 66, 0.15)',
  xl: '0 12px 24px rgba(9, 30, 66, 0.18)',
} as const;

// Border radius
export const borderRadius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
} as const;

// Container max-widths
export const containers = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

// Severity color mapping (for incidents)
export const severityColors = {
  critical: {
    bg: colors.danger,
    bgLight: '#FEE2E2',
    text: colors.danger,
    border: colors.danger,
  },
  error: {
    bg: colors.warning,
    bgLight: '#FEF3C7',
    text: '#B45309',
    border: colors.warning,
  },
  warning: {
    bg: '#F59E0B',
    bgLight: '#FEF9C3',
    text: '#A16207',
    border: '#F59E0B',
  },
  info: {
    bg: colors.primary.DEFAULT,
    bgLight: colors.blue[100],
    text: colors.primary.DEFAULT,
    border: colors.primary.DEFAULT,
  },
} as const;

// State color mapping (for incidents)
export const stateColors = {
  triggered: {
    bg: colors.danger,
    bgLight: '#FEE2E2',
    text: colors.danger,
  },
  acknowledged: {
    bg: colors.warning,
    bgLight: '#FEF3C7',
    text: '#B45309',
  },
  resolved: {
    bg: colors.success,
    bgLight: '#D1FAE5',
    text: colors.success,
  },
} as const;

// Animation durations
export const animations = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
} as const;

// Z-index scale
export const zIndex = {
  dropdown: 50,
  sticky: 100,
  modal: 200,
  popover: 300,
  tooltip: 400,
} as const;

// Export all tokens
export const designTokens = {
  colors,
  typography,
  spacing,
  shadows,
  borderRadius,
  containers,
  severityColors,
  stateColors,
  animations,
  zIndex,
} as const;

export default designTokens;
