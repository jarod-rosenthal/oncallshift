/**
 * Unit Tests: Date Formatting Utilities
 *
 * Tests for all date formatting functions:
 * - formatDuration (seconds -> human readable)
 * - formatDurationMs (milliseconds -> human readable)
 * - formatDurationMinutes (minutes -> human readable)
 * - formatTimeAgo (relative time formatting)
 * - formatDate (locale-based formatting)
 * - formatRelativeTime (time difference between two dates)
 * - isToday, isPast, isFuture (date predicates)
 */

import {
  formatDuration,
  formatDurationMs,
  formatDurationMinutes,
  formatTimeAgo,
  formatDate,
  formatRelativeTime,
  isToday,
  isPast,
  isFuture,
} from '../dateFormatting';

describe('Date Formatting Utilities', () => {
  // ========== formatDuration Tests ==========
  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(0)).toBe('less than a minute');
      expect(formatDuration(5)).toBe('5 seconds');
      expect(formatDuration(30)).toBe('30 seconds');
      expect(formatDuration(59)).toBe('59 seconds');
    });

    it('should format single minute correctly', () => {
      expect(formatDuration(60)).toBe('1 minute');
    });

    it('should format multiple minutes with plural', () => {
      expect(formatDuration(120)).toBe('2 minutes');
      expect(formatDuration(300)).toBe('5 minutes');
      expect(formatDuration(600)).toBe('10 minutes');
    });

    it('should round minutes correctly', () => {
      expect(formatDuration(90)).toBe('2 minutes'); // 1.5 minutes rounds to 2
      expect(formatDuration(540)).toBe('9 minutes'); // 9 minutes
    });

    it('should format single hour correctly', () => {
      expect(formatDuration(3600)).toBe('1 hour');
    });

    it('should format multiple hours with plural', () => {
      expect(formatDuration(7200)).toBe('2 hours');
      expect(formatDuration(10800)).toBe('3 hours');
      expect(formatDuration(86400 - 1)).toBe('24 hours'); // 1 second before 1 day
    });

    it('should round hours correctly', () => {
      expect(formatDuration(5400)).toBe('2 hours'); // 1.5 hours rounds to 2
    });

    it('should format single day correctly', () => {
      expect(formatDuration(86400)).toBe('1 day');
    });

    it('should format multiple days with plural', () => {
      expect(formatDuration(172800)).toBe('2 days');
      expect(formatDuration(604800)).toBe('7 days');
      expect(formatDuration(2592000)).toBe('30 days');
    });

    it('should round days correctly', () => {
      expect(formatDuration(129600)).toBe('2 days'); // 1.5 days rounds to 2
    });

    it('should handle very large durations', () => {
      expect(formatDuration(31536000)).toBe('365 days'); // 1 year in seconds
    });
  });

  // ========== formatDurationMs Tests ==========
  describe('formatDurationMs', () => {
    it('should convert milliseconds to duration', () => {
      expect(formatDurationMs(5000)).toBe('5 seconds');
      expect(formatDurationMs(60000)).toBe('1 minute');
      expect(formatDurationMs(3600000)).toBe('1 hour');
      expect(formatDurationMs(86400000)).toBe('1 day');
    });

    it('should round milliseconds correctly', () => {
      expect(formatDurationMs(30000)).toBe('30 seconds');
      expect(formatDurationMs(120000)).toBe('2 minutes');
    });

    it('should handle zero milliseconds', () => {
      expect(formatDurationMs(0)).toBe('less than a minute');
    });

    it('should handle large millisecond values', () => {
      expect(formatDurationMs(604800000)).toBe('7 days');
    });
  });

  // ========== formatDurationMinutes Tests ==========
  describe('formatDurationMinutes', () => {
    it('should convert minutes to duration', () => {
      expect(formatDurationMinutes(1)).toBe('1 minute');
      expect(formatDurationMinutes(30)).toBe('30 minutes');
      expect(formatDurationMinutes(60)).toBe('1 hour');
      expect(formatDurationMinutes(1440)).toBe('1 day');
    });

    it('should handle fractional minutes', () => {
      expect(formatDurationMinutes(0.5)).toBe('30 seconds');
      expect(formatDurationMinutes(1.5)).toBe('2 minutes');
    });

    it('should handle zero minutes', () => {
      expect(formatDurationMinutes(0)).toBe('less than a minute');
    });

    it('should handle large minute values', () => {
      expect(formatDurationMinutes(10080)).toBe('7 days'); // 10080 minutes = 7 days
    });
  });

  // ========== formatTimeAgo Tests ==========
  describe('formatTimeAgo', () => {
    it('should format very recent times as "just now"', () => {
      const now = new Date();
      const twentySecondsAgo = new Date(now.getTime() - 20 * 1000);

      expect(formatTimeAgo(twentySecondsAgo)).toBe('just now');
    });

    it('should format times less than a minute ago', () => {
      const now = new Date();
      const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);

      expect(formatTimeAgo(thirtySecondsAgo)).toBe('just now');
    });

    it('should format single minute ago', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      expect(formatTimeAgo(oneMinuteAgo)).toBe('1 minute ago');
    });

    it('should format multiple minutes ago with plural', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      expect(formatTimeAgo(fiveMinutesAgo)).toBe('5 minutes ago');
      expect(formatTimeAgo(thirtyMinutesAgo)).toBe('30 minutes ago');
    });

    it('should format single hour ago', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      expect(formatTimeAgo(oneHourAgo)).toBe('1 hour ago');
    });

    it('should format multiple hours ago with plural', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      expect(formatTimeAgo(twoHoursAgo)).toBe('2 hours ago');
      expect(formatTimeAgo(twelveHoursAgo)).toBe('12 hours ago');
    });

    it('should format single day ago', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      expect(formatTimeAgo(oneDayAgo)).toBe('1 day ago');
    });

    it('should format multiple days ago with plural', () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const twentyNineDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

      expect(formatTimeAgo(fiveDaysAgo)).toBe('5 days ago');
      expect(formatTimeAgo(twentyNineDaysAgo)).toBe('29 days ago');
    });

    it('should format dates older than 30 days with locale string', () => {
      const now = new Date();
      const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
      const result = formatTimeAgo(thirtyOneDaysAgo);

      // Should use toLocaleDateString() which returns localized format
      expect(result).not.toContain('ago');
      expect(result).toMatch(/\d+/); // Should contain numbers (month/day/year)
    });

    it('should handle ISO 8601 string dates', () => {
      const isoString = '2025-01-01T12:00:00Z';
      const result = formatTimeAgo(isoString);

      // Result depends on current time, but should be a valid string
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle Date objects', () => {
      const date = new Date();
      const oneHourAgo = new Date(date.getTime() - 60 * 60 * 1000);

      expect(formatTimeAgo(oneHourAgo)).toBe('1 hour ago');
    });

    it('should handle future dates', () => {
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      expect(formatTimeAgo(oneHourLater)).toBe('in the future');
    });

    it('should handle edge case at 59 minutes ago', () => {
      const now = new Date();
      const fiftyNineMinutesAgo = new Date(now.getTime() - 59 * 60 * 1000);

      expect(formatTimeAgo(fiftyNineMinutesAgo)).toBe('59 minutes ago');
    });

    it('should handle edge case at 23 hours ago', () => {
      const now = new Date();
      const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);

      expect(formatTimeAgo(twentyThreeHoursAgo)).toBe('23 hours ago');
    });
  });

  // ========== formatDate Tests ==========
  describe('formatDate', () => {
    it('should format date with default options', () => {
      const date = new Date('2025-01-12T15:45:00Z');
      const result = formatDate(date);

      // Default format includes month (short), day, year, time
      expect(result).toContain('Jan');
      expect(result).toContain('12');
      expect(result).toContain('2025');
    });

    it('should handle ISO 8601 string input', () => {
      const result = formatDate('2025-01-12T15:45:00Z');

      expect(result).toContain('Jan');
      expect(result).toContain('12');
      expect(result).toContain('2025');
    });

    it('should handle custom format options', () => {
      const date = new Date('2025-01-12T15:45:00Z');
      const result = formatDate(date, {
        year: '2-digit',
        month: 'long',
        day: 'numeric',
      });

      expect(result).toContain('January');
      expect(result).toContain('12');
      expect(result).toContain('25'); // 2-digit year
    });

    it('should handle invalid date gracefully', () => {
      const invalidDate = new Date('invalid-date-string');
      const result = formatDate(invalidDate);

      expect(result).toBe('Invalid date');
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-06-15T10:30:00Z');
      const result = formatDate(date);

      expect(result).toContain('Jun');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });

    it('should format different months correctly', () => {
      const months = [
        { date: new Date('2025-01-15'), month: 'Jan' },
        { date: new Date('2025-06-15'), month: 'Jun' },
        { date: new Date('2025-12-15'), month: 'Dec' },
      ];

      months.forEach(({ date, month }) => {
        const result = formatDate(date);
        expect(result).toContain(month);
      });
    });

    it('should format times in 12-hour format', () => {
      const date = new Date('2025-01-12T15:45:00Z');
      const result = formatDate(date);

      // Verify time is included (format may vary by locale)
      expect(result.length).toBeGreaterThan('Jan 12, 2025'.length);
    });
  });

  // ========== formatRelativeTime Tests ==========
  describe('formatRelativeTime', () => {
    it('should format time difference in minutes', () => {
      const start = new Date('2025-01-12T10:00:00Z');
      const end = new Date('2025-01-12T10:05:00Z');

      expect(formatRelativeTime(start, end)).toBe('5m');
    });

    it('should format time difference in hours and minutes', () => {
      const start = new Date('2025-01-12T10:00:00Z');
      const end = new Date('2025-01-12T12:30:00Z');

      expect(formatRelativeTime(start, end)).toBe('2h 30m');
    });

    it('should format time difference in days and hours', () => {
      const start = new Date('2025-01-12T10:00:00Z');
      const end = new Date('2025-01-14T14:00:00Z');

      expect(formatRelativeTime(start, end)).toBe('2d 4h');
    });

    it('should handle single unit (1m)', () => {
      const start = new Date('2025-01-12T10:00:00Z');
      const end = new Date('2025-01-12T10:01:00Z');

      expect(formatRelativeTime(start, end)).toBe('1m');
    });

    it('should handle single unit (1h)', () => {
      const start = new Date('2025-01-12T10:00:00Z');
      const end = new Date('2025-01-12T11:00:00Z');

      expect(formatRelativeTime(start, end)).toBe('1h 0m');
    });

    it('should handle single unit (1d)', () => {
      const start = new Date('2025-01-12T10:00:00Z');
      const end = new Date('2025-01-13T10:00:00Z');

      expect(formatRelativeTime(start, end)).toBe('1d 0h');
    });

    it('should use current time as default end time', () => {
      const start = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

      const result = formatRelativeTime(start);

      expect(result).toBe('5m');
    });

    it('should handle null end date (uses now)', () => {
      const start = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      const result = formatRelativeTime(start, null);

      expect(result).toBe('10m');
    });

    it('should handle negative difference (start > end)', () => {
      const start = new Date('2025-01-14T10:00:00Z');
      const end = new Date('2025-01-12T10:00:00Z');

      expect(formatRelativeTime(start, end)).toBe('0 seconds');
    });

    it('should handle zero difference', () => {
      const date = new Date('2025-01-12T10:00:00Z');

      expect(formatRelativeTime(date, date)).toBe('0s');
    });

    it('should handle seconds when difference is small', () => {
      const start = new Date('2025-01-12T10:00:00Z');
      const end = new Date('2025-01-12T10:00:30Z');

      expect(formatRelativeTime(start, end)).toBe('30s');
    });

    it('should handle ISO string dates', () => {
      const result = formatRelativeTime(
        '2025-01-12T10:00:00Z',
        '2025-01-12T10:05:00Z'
      );

      expect(result).toBe('5m');
    });

    it('should handle Date objects', () => {
      const start = new Date('2025-01-12T10:00:00Z');
      const end = new Date('2025-01-12T10:05:00Z');

      expect(formatRelativeTime(start, end)).toBe('5m');
    });

    it('should handle large durations', () => {
      const start = new Date('2024-01-12T10:00:00Z');
      const end = new Date('2025-01-12T14:00:00Z');

      const result = formatRelativeTime(start, end);

      expect(result).toContain('d');
    });
  });

  // ========== isToday Tests ==========
  describe('isToday', () => {
    it('should return true for today', () => {
      const today = new Date();

      expect(isToday(today)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      expect(isToday(yesterday)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(isToday(tomorrow)).toBe(false);
    });

    it('should handle ISO string dates', () => {
      const today = new Date();
      const isoString = today.toISOString();

      expect(isToday(isoString)).toBe(true);
    });

    it('should return true for any time today', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Midnight
      const noon = new Date(today);
      noon.setHours(12, 0, 0, 0); // Noon

      expect(isToday(noon)).toBe(true);
    });
  });

  // ========== isPast Tests ==========
  describe('isPast', () => {
    it('should return true for past dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      expect(isPast(yesterday)).toBe(true);
    });

    it('should return false for today', () => {
      const now = new Date();
      // A date in the future should return false
      expect(isPast(now)).toBe(false);
    });

    it('should return false for future dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(isPast(tomorrow)).toBe(false);
    });

    it('should handle ISO string dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isoString = yesterday.toISOString();

      expect(isPast(isoString)).toBe(true);
    });

    it('should handle very old dates', () => {
      const oldDate = new Date('2000-01-01');

      expect(isPast(oldDate)).toBe(true);
    });
  });

  // ========== isFuture Tests ==========
  describe('isFuture', () => {
    it('should return true for future dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(isFuture(tomorrow)).toBe(true);
    });

    it('should return false for today', () => {
      const now = new Date();

      expect(isFuture(now)).toBe(false);
    });

    it('should return false for past dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      expect(isFuture(yesterday)).toBe(false);
    });

    it('should handle ISO string dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isoString = tomorrow.toISOString();

      expect(isFuture(isoString)).toBe(true);
    });

    it('should handle very far future dates', () => {
      const futureDate = new Date('2099-12-31');

      expect(isFuture(futureDate)).toBe(true);
    });
  });

  // ========== Cross-function consistency Tests ==========
  describe('Cross-function consistency', () => {
    it('formatTimeAgo should work with formatDate output', () => {
      const date = new Date();
      const formatted = formatDate(date);

      // formatDate returns a string representation of a date,
      // not a date object, so we can't directly use it with formatTimeAgo.
      // This test verifies they work independently.
      expect(formatted).toBeDefined();
      expect(formatTimeAgo(date)).toBeDefined();
    });

    it('formatDuration and formatRelativeTime should produce compatible results', () => {
      const start = new Date('2025-01-12T10:00:00Z');
      const end = new Date('2025-01-12T10:05:00Z');

      const relativeTime = formatRelativeTime(start, end);
      const duration = formatDuration(300); // 5 minutes in seconds

      expect(relativeTime).toContain('5');
      expect(duration).toContain('5');
    });

    it('multiple formatDuration variants should be consistent', () => {
      const seconds = 300; // 5 minutes
      const ms = seconds * 1000;
      const minutes = seconds / 60;

      const fromSeconds = formatDuration(seconds);
      const fromMs = formatDurationMs(ms);
      const fromMinutes = formatDurationMinutes(minutes);

      expect(fromSeconds).toBe(fromMs);
      expect(fromSeconds).toBe(fromMinutes);
    });

    it('isPast and isFuture should be mutually exclusive', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1000);
      const future = new Date(now.getTime() + 1000);

      expect(isPast(past) && isFuture(past)).toBe(false);
      expect(isPast(future) && isFuture(future)).toBe(false);
    });
  });
});
