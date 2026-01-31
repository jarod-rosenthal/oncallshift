/**
 * Unified Color System for OnCallShift
 *
 * This module provides a centralized color system using semantic tokens
 * that map to Tailwind CSS classes and design tokens.
 *
 * Architecture:
 * - Semantic colors (severity, state, event types)
 * - Returns Tailwind class strings for composability
 * - Supports light and dark modes via Tailwind modifiers
 * - Type-safe with TypeScript
 */

/**
 * Color configuration for severity levels
 *
 * Structure:
 * - badge: For badge-style displays (bg + text + border)
 * - solid: For solid indicators (progress bars, dots)
 * - border: For left borders on cards
 */
const SEVERITY_COLORS = {
  critical: {
    badge: 'bg-danger/10 text-danger border-danger/20',
    solid: 'bg-danger',
    border: 'border-l-danger',
    label: 'Critical',
  },
  error: {
    badge: 'bg-warning/10 text-warning border-warning/20',
    solid: 'bg-warning',
    border: 'border-l-warning',
    label: 'Error',
  },
  warning: {
    badge: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    solid: 'bg-yellow-500',
    border: 'border-l-yellow-500',
    label: 'Warning',
  },
  info: {
    badge: 'bg-primary/10 text-primary border-primary/20',
    solid: 'bg-primary',
    border: 'border-l-primary',
    label: 'Info',
  },
  low: {
    badge: 'bg-neutral-100 text-neutral-600 border-neutral-300',
    solid: 'bg-neutral-400',
    border: 'border-l-neutral-400',
    label: 'Low',
  },
} as const;

/**
 * Color configuration for incident states
 *
 * Structure:
 * - badge: For badge-style displays (bg + text + border)
 * - solid: For solid indicators
 * - label: Display label for the state
 */
const STATE_COLORS = {
  triggered: {
    badge: 'bg-danger/10 text-danger border-danger/20',
    solid: 'bg-danger',
    label: 'Triggered',
  },
  acknowledged: {
    badge: 'bg-warning/10 text-warning border-warning/20',
    solid: 'bg-warning',
    label: 'Acknowledged',
  },
  resolved: {
    badge: 'bg-success/10 text-success border-success/20',
    solid: 'bg-success',
    label: 'Resolved',
  },
} as const;

/**
 * Color configuration for event types in timelines
 *
 * Structure:
 * - badge: For badge-style displays (bg + text + border)
 * - icon: Icon emoji or character
 * - label: Display label for the event type
 */
const EVENT_COLORS = {
  alert: {
    badge: 'bg-danger/10 text-danger border-danger/20',
    icon: '🔔',
    label: 'Alert',
  },
  acknowledge: {
    badge: 'bg-warning/10 text-warning border-warning/20',
    icon: '✓',
    label: 'Acknowledged',
  },
  resolve: {
    badge: 'bg-success/10 text-success border-success/20',
    icon: '✓✓',
    label: 'Resolved',
  },
  escalate: {
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700',
    icon: '↑',
    label: 'Escalated',
  },
  reassign: {
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    icon: '→',
    label: 'Reassigned',
  },
  note: {
    badge: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-600',
    icon: '📝',
    label: 'Note',
  },
} as const;

/**
 * Get severity colors for badge display (background + text + border)
 * Use this for badge-style displays where you need coordinated colors.
 *
 * @param severity - The severity level (critical, error, warning, info, low)
 * @returns Tailwind class string
 *
 * @example
 * <span className={getSeverityBadgeColor('critical')}>Critical</span>
 */
export function getSeverityBadgeColor(severity: string): string {
  const config = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS];
  return config?.badge ?? SEVERITY_COLORS.low.badge;
}

/**
 * Get severity colors for solid indicators (progress bars, dots, circles)
 * Use this when you need just the background color.
 *
 * @param severity - The severity level (critical, error, warning, info, low, high, medium)
 * @returns Tailwind class string
 *
 * @example
 * <div className={getSeveritySolidColor('critical')} />
 */
export function getSeveritySolidColor(severity: string): string {
  // Map common severity variations to standard levels
  const normalizedSeverity = severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : severity;
  const config = SEVERITY_COLORS[normalizedSeverity as keyof typeof SEVERITY_COLORS];
  return config?.solid ?? SEVERITY_COLORS.low.solid;
}

/**
 * Get the left border color for severity indicators on cards
 *
 * @param severity - The severity level
 * @returns Tailwind class string for border-l-* classes
 *
 * @example
 * <div className={`border-l-4 ${getSeverityBorderColor('critical')}`}>
 */
export function getSeverityBorderColor(severity: string): string {
  const config = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS];
  return config?.border ?? SEVERITY_COLORS.low.border;
}

/**
 * Get the display label for a severity level
 *
 * @param severity - The severity level
 * @returns Human-readable label
 */
export function getSeverityLabel(severity: string): string {
  const config = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS];
  return config?.label ?? 'Unknown';
}

/**
 * Get state colors for badge display (background + text + border)
 * Use this for badge-style displays where you need coordinated colors.
 *
 * @param state - The incident state (triggered, acknowledged, resolved)
 * @returns Tailwind class string
 *
 * @example
 * <span className={getStateBadgeColor('triggered')}>Triggered</span>
 */
export function getStateBadgeColor(state: string): string {
  const config = STATE_COLORS[state as keyof typeof STATE_COLORS];
  return config?.badge ?? STATE_COLORS.triggered.badge;
}

/**
 * Get state colors for solid indicators (progress bars, dots, circles)
 * Use this when you need just the background color.
 *
 * @param state - The incident state
 * @returns Tailwind class string
 *
 * @example
 * <div className={getStateSolidColor('resolved')} />
 */
export function getStateSolidColor(state: string): string {
  const config = STATE_COLORS[state as keyof typeof STATE_COLORS];
  return config?.solid ?? STATE_COLORS.triggered.solid;
}

/**
 * Get the display label for an incident state
 *
 * @param state - The incident state
 * @returns Human-readable label
 */
export function getStateLabel(state: string): string {
  const config = STATE_COLORS[state as keyof typeof STATE_COLORS];
  return config?.label ?? 'Unknown';
}

/**
 * Get event colors for timeline display (background + text + border)
 * Use this for badge-style displays in timelines.
 *
 * @param type - The event type (alert, acknowledge, resolve, escalate, reassign, note)
 * @returns Tailwind class string
 *
 * @example
 * <span className={getEventColor('acknowledge')}>Acknowledged</span>
 */
export function getEventColor(type: string): string {
  const config = EVENT_COLORS[type as keyof typeof EVENT_COLORS];
  return config?.badge ?? EVENT_COLORS.note.badge;
}

/**
 * Get the icon/emoji for an event type
 *
 * @param type - The event type
 * @returns Icon emoji or character
 *
 * @example
 * <span>{getEventIcon('resolve')}</span>
 */
export function getEventIcon(type: string): string {
  const config = EVENT_COLORS[type as keyof typeof EVENT_COLORS];
  return config?.icon ?? EVENT_COLORS.note.icon;
}

/**
 * Get the display label for an event type
 *
 * @param type - The event type
 * @returns Human-readable label
 */
export function getEventLabel(type: string): string {
  const config = EVENT_COLORS[type as keyof typeof EVENT_COLORS];
  return config?.label ?? 'Unknown';
}

/**
 * Type-safe color configuration exports
 * Useful for components that need to work with color mappings
 */
export const severityColorConfig = SEVERITY_COLORS;
export const stateColorConfig = STATE_COLORS;
export const eventColorConfig = EVENT_COLORS;

/**
 * Export all functions as a namespace for easier testing
 */
export const colorSystem = {
  severity: {
    badge: getSeverityBadgeColor,
    solid: getSeveritySolidColor,
    border: getSeverityBorderColor,
    label: getSeverityLabel,
    config: SEVERITY_COLORS,
  },
  state: {
    badge: getStateBadgeColor,
    solid: getStateSolidColor,
    label: getStateLabel,
    config: STATE_COLORS,
  },
  event: {
    color: getEventColor,
    icon: getEventIcon,
    label: getEventLabel,
    config: EVENT_COLORS,
  },
} as const;
