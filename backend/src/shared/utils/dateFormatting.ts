/**
 * Date Formatting Utilities
 *
 * Provides a centralized set of date formatting functions used across the application.
 * These utilities help maintain consistency in date/time display across backend and frontend.
 */

/**
 * Formats the duration in seconds to a human-readable string.
 *
 * Examples:
 * - 5 seconds -> "5 seconds"
 * - 30 seconds -> "30 seconds"
 * - 120 seconds -> "2 minutes"
 * - 3600 seconds -> "1 hour"
 * - 86400 seconds -> "1 day"
 *
 * @param seconds - Duration in seconds
 * @returns Human-readable duration string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 1) {
    return 'less than a minute';
  }
  if (seconds < 60) {
    const roundedSeconds = Math.round(seconds);
    return `${roundedSeconds} second${roundedSeconds !== 1 ? 's' : ''}`;
  }
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  if (seconds < 86400) {
    const hours = Math.round(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  const days = Math.round(seconds / 86400);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

/**
 * Formats the duration in milliseconds to a human-readable string.
 *
 * Examples:
 * - 5000 ms -> "5 seconds"
 * - 60000 ms -> "1 minute"
 * - 3600000 ms -> "1 hour"
 *
 * @param milliseconds - Duration in milliseconds
 * @returns Human-readable duration string
 */
export function formatDurationMs(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000);
  return formatDuration(seconds);
}

/**
 * Formats the duration in minutes to a human-readable string.
 *
 * Examples:
 * - 0.5 minutes -> "30 seconds"
 * - 1 minute -> "1 minute"
 * - 60 minutes -> "1 hour"
 *
 * @param minutes - Duration in minutes
 * @returns Human-readable duration string
 */
export function formatDurationMinutes(minutes: number): string {
  const seconds = Math.round(minutes * 60);
  return formatDuration(seconds);
}

/**
 * Formats a date as relative time (e.g., "5 minutes ago").
 *
 * Examples:
 * - 30 seconds ago -> "just now"
 * - 5 minutes ago -> "5 minutes ago"
 * - 2 hours ago -> "2 hours ago"
 * - 10 days ago -> "10 days ago"
 * - Older dates -> formatted with toLocaleDateString()
 *
 * @param dateString - ISO 8601 date string or Date object
 * @returns Human-readable relative time string
 */
export function formatTimeAgo(dateString: string | Date): string {
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle future dates or very recent times
  if (diffMs < 0) {
    return 'in the future';
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a date in locale-based format.
 *
 * Default format: "Jan 12, 2025, 03:45 PM"
 *
 * Examples:
 * - 2025-01-12T15:45:00Z -> "Jan 12, 2025, 03:45 PM"
 * - Invalid date -> "Invalid date"
 *
 * @param dateString - ISO 8601 date string or Date object
 * @param options - Optional Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  dateString: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = dateString instanceof Date ? dateString : new Date(dateString);

  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  return date.toLocaleDateString('en-US', options || defaultOptions);
}

/**
 * Formats a relative time difference between two dates.
 *
 * Examples:
 * - start: 5 mins ago, end: now -> "5 minutes"
 * - start: 2 hours ago, end: now -> "2 hours"
 * - start: 1 day ago, end: now -> "1 day"
 *
 * @param startDate - ISO 8601 date string or Date object (earlier time)
 * @param endDate - ISO 8601 date string or Date object (later time). Defaults to now.
 * @returns Human-readable duration
 */
export function formatRelativeTime(
  startDate: string | Date,
  endDate?: string | Date | null
): string {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end =
    endDate instanceof Date
      ? endDate
      : endDate
        ? new Date(endDate)
        : new Date();

  const diffMs = end.getTime() - start.getTime();

  if (diffMs < 0) {
    return '0 seconds';
  }

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    return `${diffDays}d ${remainingHours}h`;
  }
  if (diffHours > 0) {
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
  }
  if (diffMins > 0) {
    return `${diffMins}m`;
  }
  return `${diffSecs}s`;
}

/**
 * Checks if a date is today.
 *
 * @param dateString - ISO 8601 date string or Date object
 * @returns True if the date is today
 */
export function isToday(dateString: string | Date): boolean {
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  const today = new Date();

  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Checks if a date is in the past.
 *
 * @param dateString - ISO 8601 date string or Date object
 * @returns True if the date is in the past
 */
export function isPast(dateString: string | Date): boolean {
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  return date.getTime() < Date.now();
}

/**
 * Checks if a date is in the future.
 *
 * @param dateString - ISO 8601 date string or Date object
 * @returns True if the date is in the future
 */
export function isFuture(dateString: string | Date): boolean {
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  return date.getTime() > Date.now();
}
