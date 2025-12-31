import * as Calendar from 'expo-calendar';
import { Platform, Alert, Linking } from 'react-native';
import type { UpcomingShift } from './apiService';

const CALENDAR_NAME = 'OnCallShift';
const CALENDAR_COLOR = '#6366F1'; // Accent color

export interface CalendarExportResult {
  success: boolean;
  message: string;
  eventsCreated?: number;
}

/**
 * Request calendar permissions
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to request calendar permissions:', error);
    return false;
  }
}

/**
 * Check if calendar permissions are granted
 */
export async function hasCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to check calendar permissions:', error);
    return false;
  }
}

/**
 * Get or create the OnCallShift calendar
 */
async function getOrCreateOnCallCalendar(): Promise<string | null> {
  try {
    // Get all calendars
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    // Look for existing OnCallShift calendar
    const existingCalendar = calendars.find(cal => cal.title === CALENDAR_NAME);
    if (existingCalendar) {
      return existingCalendar.id;
    }

    // Create new calendar
    let defaultCalendarSource: Calendar.Source | undefined;

    if (Platform.OS === 'ios') {
      // On iOS, find the default calendar source (usually iCloud or local)
      defaultCalendarSource = calendars.find(
        cal => cal.source?.name === 'iCloud' || cal.source?.name === 'Default'
      )?.source;

      if (!defaultCalendarSource) {
        defaultCalendarSource = calendars.find(cal => cal.source?.isLocalAccount)?.source;
      }

      if (!defaultCalendarSource) {
        defaultCalendarSource = calendars[0]?.source;
      }
    } else {
      // On Android, find a local account
      defaultCalendarSource = calendars.find(cal => cal.accessLevel === 'owner')?.source;

      if (!defaultCalendarSource) {
        defaultCalendarSource = calendars[0]?.source;
      }
    }

    if (!defaultCalendarSource) {
      console.error('No calendar source found');
      return null;
    }

    const newCalendarId = await Calendar.createCalendarAsync({
      title: CALENDAR_NAME,
      color: CALENDAR_COLOR,
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: defaultCalendarSource.id,
      source: defaultCalendarSource,
      name: CALENDAR_NAME,
      ownerAccount: Platform.OS === 'ios' ? undefined : 'personal',
      accessLevel: Platform.OS === 'ios' ? undefined : Calendar.CalendarAccessLevel.OWNER,
    });

    return newCalendarId;
  } catch (error) {
    console.error('Failed to get or create calendar:', error);
    return null;
  }
}

/**
 * Export shifts to device calendar
 */
export async function exportShiftsToCalendar(
  shifts: UpcomingShift[]
): Promise<CalendarExportResult> {
  try {
    // Check/request permissions
    let hasPermission = await hasCalendarPermissions();
    if (!hasPermission) {
      hasPermission = await requestCalendarPermissions();
    }

    if (!hasPermission) {
      return {
        success: false,
        message: 'Calendar permission is required to export shifts. Please enable it in Settings.',
      };
    }

    // Get or create calendar
    const calendarId = await getOrCreateOnCallCalendar();
    if (!calendarId) {
      return {
        success: false,
        message: 'Failed to access device calendar. Please try again.',
      };
    }

    // Get existing events in the calendar to avoid duplicates
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const existingEvents = await Calendar.getEventsAsync(
      [calendarId],
      now,
      thirtyDaysLater
    );

    let eventsCreated = 0;
    let eventsSkipped = 0;

    for (const shift of shifts) {
      const startDate = new Date(shift.startTime);
      const endDate = new Date(shift.endTime);

      // Check if event already exists (by matching title and time)
      const eventTitle = `On-Call: ${shift.scheduleName}`;
      const isDuplicate = existingEvents.some(event => {
        const eventStart = new Date(event.startDate);
        return (
          event.title === eventTitle &&
          Math.abs(eventStart.getTime() - startDate.getTime()) < 60000 // Within 1 minute
        );
      });

      if (isDuplicate) {
        eventsSkipped++;
        continue;
      }

      // Create calendar event
      await Calendar.createEventAsync(calendarId, {
        title: eventTitle,
        startDate,
        endDate,
        notes: shift.serviceName
          ? `On-call shift for ${shift.serviceName}`
          : 'On-call shift',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        alarms: [
          { relativeOffset: -60 }, // 1 hour before
          { relativeOffset: -15 }, // 15 minutes before
        ],
      });

      eventsCreated++;
    }

    if (eventsCreated === 0 && eventsSkipped > 0) {
      return {
        success: true,
        message: `All ${eventsSkipped} shifts are already in your calendar.`,
        eventsCreated: 0,
      };
    }

    return {
      success: true,
      message: `Added ${eventsCreated} shift${eventsCreated !== 1 ? 's' : ''} to your calendar${
        eventsSkipped > 0 ? ` (${eventsSkipped} already existed)` : ''
      }.`,
      eventsCreated,
    };
  } catch (error: any) {
    console.error('Failed to export shifts to calendar:', error);
    return {
      success: false,
      message: error.message || 'Failed to export shifts. Please try again.',
    };
  }
}

/**
 * Export a single shift to device calendar
 */
export async function exportSingleShift(shift: UpcomingShift): Promise<CalendarExportResult> {
  return exportShiftsToCalendar([shift]);
}

/**
 * Open device calendar app
 */
export async function openCalendarApp(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL('calshow://');
  } else {
    await Linking.openURL('content://com.android.calendar/time/');
  }
}

/**
 * Show permission denied alert with option to open settings
 */
export function showPermissionDeniedAlert(): void {
  Alert.alert(
    'Calendar Access Required',
    'To export on-call shifts to your calendar, please enable calendar access in your device settings.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => Linking.openSettings(),
      },
    ]
  );
}

/**
 * Generate ICS file content for a shift (for sharing via other methods)
 */
export function generateICSContent(shift: UpcomingShift): string {
  const formatICSDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const startDate = new Date(shift.startTime);
  const endDate = new Date(shift.endTime);

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OnCallShift//EN
BEGIN:VEVENT
UID:oncallshift-${shift.scheduleId}-${startDate.getTime()}
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:On-Call: ${shift.scheduleName}
DESCRIPTION:${shift.serviceName ? `On-call shift for ${shift.serviceName}` : 'On-call shift'}
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:On-call shift starts in 1 hour
END:VALARM
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:On-call shift starts in 15 minutes
END:VALARM
END:VEVENT
END:VCALENDAR`;
}
