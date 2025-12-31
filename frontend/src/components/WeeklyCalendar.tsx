import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { schedulesAPI } from '../lib/api-client';

interface WeeklyForecast {
  forecast: Array<{
    schedule: { id: string; name: string; type: string };
    days: Array<{
      date: string;
      dayOfWeek: string;
      isToday: boolean;
      oncallUser: { id: string; fullName: string; email: string } | null;
    }>;
  }>;
  weekStart: string;
}

export function WeeklyCalendar() {
  const [forecast, setForecast] = useState<WeeklyForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, 1 = next week

  useEffect(() => {
    loadForecast();
  }, []);

  const loadForecast = async () => {
    try {
      const data = await schedulesAPI.getWeeklyForecast();
      setForecast(data);
    } catch (error) {
      console.error('Failed to load weekly forecast:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>On-Call This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!forecast || forecast.forecast.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>On-Call This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-2">No schedules configured</p>
            <Link to="/schedules">
              <Button variant="outline" size="sm">Create Schedule</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get days for current view (7 days based on weekOffset)
  const startIdx = weekOffset * 7;
  const visibleDays = forecast.forecast[0]?.days.slice(startIdx, startIdx + 7) || [];

  // Get initials from name
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get color for user (consistent color based on name)
  const getUserColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
      'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle>On-Call Schedule</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
              disabled={weekOffset === 0}
            >
              ← Prev
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {weekOffset === 0 ? 'This Week' : 'Next Week'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset(Math.min(1, weekOffset + 1))}
              disabled={weekOffset === 1}
            >
              Next →
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Calendar Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-sm font-medium text-muted-foreground p-2 min-w-[120px]">
                  Schedule
                </th>
                {visibleDays.map((day) => (
                  <th
                    key={day.date}
                    className={`text-center p-2 min-w-[80px] ${
                      day.isToday ? 'bg-blue-50 dark:bg-blue-950 rounded-t-lg' : ''
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">{day.dayOfWeek}</div>
                    <div className={`text-sm font-medium ${day.isToday ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                      {new Date(day.date + 'T00:00:00').getDate()}
                    </div>
                    {day.isToday && (
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">TODAY</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.forecast.map((schedule) => {
                const scheduleDays = schedule.days.slice(startIdx, startIdx + 7);
                return (
                  <tr key={schedule.schedule.id} className="border-t">
                    <td className="p-2">
                      <Link
                        to={`/schedules/${schedule.schedule.id}`}
                        className="text-sm font-medium hover:text-blue-600 transition-colors"
                      >
                        {schedule.schedule.name}
                      </Link>
                      <div className="text-xs text-muted-foreground capitalize">
                        {schedule.schedule.type} rotation
                      </div>
                    </td>
                    {scheduleDays.map((day) => (
                      <td
                        key={day.date}
                        className={`text-center p-2 ${
                          day.isToday ? 'bg-blue-50 dark:bg-blue-950' : ''
                        }`}
                      >
                        {day.oncallUser ? (
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className={`w-8 h-8 rounded-full ${getUserColor(day.oncallUser.fullName)} flex items-center justify-center text-white text-xs font-medium`}
                              title={day.oncallUser.fullName}
                            >
                              {getInitials(day.oncallUser.fullName)}
                            </div>
                            <span className="text-xs truncate max-w-[70px]" title={day.oncallUser.fullName}>
                              {day.oncallUser.fullName.split(' ')[0]}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <span className="text-gray-400 text-xs">?</span>
                            </div>
                            <span className="text-xs text-muted-foreground">None</span>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-950 border border-blue-300"></div>
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700"></div>
            <span>No one assigned</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
