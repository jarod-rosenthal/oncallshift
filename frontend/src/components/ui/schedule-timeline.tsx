import { useMemo } from 'react';

interface Shift {
  userId: string;
  userName: string;
  startTime: Date;
  endTime: Date;
}

interface ScheduleTimelineProps {
  startDate: Date;
  endDate: Date;
  shifts: Shift[];
  className?: string;
}

// Color palette for different users
const USER_COLORS = [
  { bg: 'bg-indigo-500', text: 'text-indigo-100' },
  { bg: 'bg-emerald-500', text: 'text-emerald-100' },
  { bg: 'bg-amber-500', text: 'text-amber-100' },
  { bg: 'bg-rose-500', text: 'text-rose-100' },
  { bg: 'bg-cyan-500', text: 'text-cyan-100' },
  { bg: 'bg-purple-500', text: 'text-purple-100' },
  { bg: 'bg-orange-500', text: 'text-orange-100' },
  { bg: 'bg-teal-500', text: 'text-teal-100' },
];

function getDaysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function formatDayHeader(date: Date): string {
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return `${dayNames[date.getDay()]}${date.getDate()}`;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function ScheduleTimeline({ startDate, endDate, shifts, className = '' }: ScheduleTimelineProps) {
  const days = useMemo(() => getDaysBetween(startDate, endDate), [startDate, endDate]);

  // Create a map of userId to color index
  const userColorMap = useMemo(() => {
    const map = new Map<string, number>();
    const uniqueUsers = [...new Set(shifts.map(s => s.userId))];
    uniqueUsers.forEach((userId, index) => {
      map.set(userId, index % USER_COLORS.length);
    });
    return map;
  }, [shifts]);

  // Calculate which user is on-call for each day
  const dayAssignments = useMemo(() => {
    return days.map(day => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      // Find shift that covers this day
      const shift = shifts.find(s => {
        const shiftStart = new Date(s.startTime);
        const shiftEnd = new Date(s.endTime);
        return shiftStart <= dayEnd && shiftEnd >= dayStart;
      });

      return shift ? { userId: shift.userId, userName: shift.userName } : null;
    });
  }, [days, shifts]);

  // Group consecutive days with the same user into spans
  const spans = useMemo(() => {
    type SpanType = { startIndex: number; endIndex: number; userId: string; userName: string };
    const result: SpanType[] = [];
    let spanStart: number | null = null;
    let spanUserId: string | null = null;
    let spanUserName: string | null = null;

    dayAssignments.forEach((assignment, index) => {
      if (!assignment) {
        if (spanStart !== null && spanUserId !== null && spanUserName !== null) {
          result.push({ startIndex: spanStart, endIndex: index - 1, userId: spanUserId, userName: spanUserName });
          spanStart = null;
          spanUserId = null;
          spanUserName = null;
        }
        return;
      }

      if (spanUserId === null || spanUserId !== assignment.userId) {
        if (spanStart !== null && spanUserId !== null && spanUserName !== null) {
          result.push({ startIndex: spanStart, endIndex: index - 1, userId: spanUserId, userName: spanUserName });
        }
        spanStart = index;
        spanUserId = assignment.userId;
        spanUserName = assignment.userName;
      }
    });

    if (spanStart !== null && spanUserId !== null && spanUserName !== null) {
      result.push({ startIndex: spanStart, endIndex: dayAssignments.length - 1, userId: spanUserId, userName: spanUserName });
    }

    return result;
  }, [dayAssignments]);

  const todayIndex = days.findIndex(isToday);

  return (
    <div className={`relative ${className}`}>
      {/* Day headers */}
      <div className="flex border-b border-border">
        {days.map((day, index) => (
          <div
            key={index}
            className={`flex-1 text-center text-xs py-1 ${
              isToday(day) ? 'font-bold text-primary' : 'text-muted-foreground'
            }`}
          >
            {formatDayHeader(day)}
          </div>
        ))}
      </div>

      {/* Timeline grid with shift blocks */}
      <div className="relative h-8 mt-1">
        {/* Grid lines */}
        <div className="absolute inset-0 flex">
          {days.map((_, index) => (
            <div key={index} className="flex-1 border-r border-border/30 last:border-r-0" />
          ))}
        </div>

        {/* Shift blocks */}
        {spans.map((span, index) => {
          const colorIndex = userColorMap.get(span.userId) || 0;
          const color = USER_COLORS[colorIndex];
          const leftPercent = (span.startIndex / days.length) * 100;
          const widthPercent = ((span.endIndex - span.startIndex + 1) / days.length) * 100;

          return (
            <div
              key={index}
              className={`absolute top-0 h-full ${color.bg} rounded-sm flex items-center justify-center overflow-hidden group cursor-default`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
              }}
              title={`${span.userName}: ${days[span.startIndex].toLocaleDateString()} - ${days[span.endIndex].toLocaleDateString()}`}
            >
              <span className={`text-xs font-medium ${color.text} truncate px-1`}>
                {span.userName}
              </span>
            </div>
          );
        })}

        {/* Today marker */}
        {todayIndex >= 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
            style={{
              left: `${((todayIndex + 0.5) / days.length) * 100}%`,
            }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full" />
          </div>
        )}
      </div>

      {/* Legend (user names below if multiple users) */}
      {spans.length > 1 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {[...userColorMap.entries()].map(([userId, colorIndex]) => {
            const userName = shifts.find(s => s.userId === userId)?.userName || 'Unknown';
            const color = USER_COLORS[colorIndex];
            return (
              <div key={userId} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className={`w-3 h-3 rounded-sm ${color.bg}`} />
                <span>{userName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ScheduleTimeline;
