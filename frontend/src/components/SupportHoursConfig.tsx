import { useState, useEffect } from 'react';
import { Label } from './ui/label';
import { Input } from './ui/input';

export interface SupportHoursData {
  enabled: boolean;
  timezone: string;
  days: number[];  // 0 = Sunday, 6 = Saturday
  startTime: string;  // HH:mm format
  endTime: string;    // HH:mm format
}

interface SupportHoursConfigProps {
  value: SupportHoursData;
  onChange: (value: SupportHoursData) => void;
}

// Get all available timezones
const getTimezones = (): string[] => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    // Fallback for older browsers
    return [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney',
    ];
  }
};

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SupportHoursConfig({ value, onChange }: SupportHoursConfigProps) {
  const [isWithinSupportHours, setIsWithinSupportHours] = useState(false);

  // Calculate if current time is within support hours
  useEffect(() => {
    if (!value.enabled) {
      setIsWithinSupportHours(false);
      return;
    }

    const checkSupportHours = () => {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: value.timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          weekday: 'short',
        });

        const parts = formatter.formatToParts(now);
        const dayName = parts.find(p => p.type === 'weekday')?.value;
        const hour = parts.find(p => p.type === 'hour')?.value;
        const minute = parts.find(p => p.type === 'minute')?.value;

        if (!dayName || !hour || !minute) {
          setIsWithinSupportHours(false);
          return;
        }

        // Get day of week (0 = Sunday)
        const dayMap: Record<string, number> = {
          'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
        };
        const currentDay = dayMap[dayName];

        // Check if current day is in support days
        if (!value.days.includes(currentDay)) {
          setIsWithinSupportHours(false);
          return;
        }

        // Check if current time is within start and end time
        const currentTime = `${hour}:${minute}`;
        const isAfterStart = currentTime >= value.startTime;
        const isBeforeEnd = currentTime < value.endTime;

        setIsWithinSupportHours(isAfterStart && isBeforeEnd);
      } catch (error) {
        console.error('Error checking support hours:', error);
        setIsWithinSupportHours(false);
      }
    };

    checkSupportHours();
    const interval = setInterval(checkSupportHours, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [value]);

  const handleDayToggle = (day: number) => {
    const newDays = value.days.includes(day)
      ? value.days.filter(d => d !== day)
      : [...value.days, day].sort((a, b) => a - b);

    onChange({ ...value, days: newDays });
  };

  return (
    <div className="space-y-4">
      {/* Enable checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="supportHoursEnabled"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          className="rounded border-gray-300"
        />
        <label htmlFor="supportHoursEnabled" className="text-sm font-medium">
          Enable support hours
        </label>
      </div>

      {value.enabled && (
        <>
          {/* Time range picker */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supportHoursStart">Start Time</Label>
              <Input
                id="supportHoursStart"
                type="time"
                value={value.startTime}
                onChange={(e) => onChange({ ...value, startTime: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="supportHoursEnd">End Time</Label>
              <Input
                id="supportHoursEnd"
                type="time"
                value={value.endTime}
                onChange={(e) => onChange({ ...value, endTime: e.target.value })}
              />
            </div>
          </div>

          {/* Day of week multi-select */}
          <div>
            <Label>Support Days</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {DAY_NAMES.map((day, index) => (
                <label
                  key={day}
                  className={`px-3 py-1 rounded-md cursor-pointer text-sm border transition-colors ${
                    value.days.includes(index)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:border-primary/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={value.days.includes(index)}
                    onChange={() => handleDayToggle(index)}
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>

          {/* Timezone dropdown */}
          <div>
            <Label htmlFor="supportHoursTimezone">Timezone</Label>
            <select
              id="supportHoursTimezone"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={value.timezone}
              onChange={(e) => onChange({ ...value, timezone: e.target.value })}
            >
              <optgroup label="Common Timezones">
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All Timezones">
                {getTimezones()
                  .filter(tz => !COMMON_TIMEZONES.find(ct => ct.value === tz))
                  .map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Preview */}
          <div className={`p-3 rounded-md border ${
            isWithinSupportHours
              ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
              : 'bg-muted border-border'
          }`}>
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                isWithinSupportHours ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <span className="font-medium">
                {isWithinSupportHours ? 'Currently within support hours' : 'Currently outside support hours'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {value.days.map(d => DAY_NAMES[d]).join(', ')} • {value.startTime} - {value.endTime} ({value.timezone})
            </p>
          </div>
        </>
      )}
    </div>
  );
}
