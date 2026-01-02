/**
 * Shared color utility functions for consistent styling across the application.
 * These functions map incident properties to Tailwind CSS classes.
 */

/**
 * Returns Tailwind classes for severity badge styling (background + text colors with dark mode support).
 * Use for badge-style displays where you need bg and text colors together.
 */
export function getSeverityBadgeColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'error':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    default:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  }
}

/**
 * Returns Tailwind classes for severity solid color (single background color).
 * Use for progress bars, dots, or simple indicators.
 */
export function getSeveritySolidColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500';
    case 'high':
    case 'error':
      return 'bg-orange-500';
    case 'medium':
    case 'warning':
      return 'bg-yellow-500';
    case 'low':
    case 'info':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Returns Tailwind classes for incident state badge styling (background + text colors with dark mode support).
 * Use for badge-style displays where you need bg and text colors together.
 */
export function getStateBadgeColor(state: string): string {
  switch (state) {
    case 'triggered':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'acknowledged':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'resolved':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

/**
 * Returns emoji icon for event types in timeline displays.
 */
export function getEventIcon(type: string): string {
  switch (type) {
    case 'alert':
      return '\uD83D\uDD14'; // Bell emoji
    case 'acknowledge':
      return '\u2713'; // Checkmark
    case 'resolve':
      return '\u2713\u2713'; // Double checkmark
    case 'escalate':
      return '\u2191'; // Up arrow
    case 'reassign':
      return '\u2192'; // Right arrow
    case 'note':
      return '\uD83D\uDCDD'; // Note emoji
    default:
      return '\u2022'; // Bullet
  }
}

/**
 * Returns Tailwind classes for event type styling in timeline displays.
 * Includes background, text, and border colors with dark mode support.
 */
export function getEventColor(type: string): string {
  switch (type) {
    case 'alert':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700';
    case 'acknowledge':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700';
    case 'resolve':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700';
    case 'escalate':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700';
    case 'reassign':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700';
    case 'note':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600';
  }
}
