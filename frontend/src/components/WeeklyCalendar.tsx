import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { schedulesAPI } from '../lib/api-client';
import { UserAvatar } from './UserAvatar';

interface WeeklyForecast {
  forecast: Array<{
    schedule: { id: string; name: string; type: string };
    days: Array<{
      date: string;
      dayOfWeek: string;
      isToday: boolean;
      oncallUser: { id: string; fullName: string; email: string; profilePictureUrl?: string | null } | null;
    }>;
  }>;
  weekStart: string;
}

export function WeeklyCalendar() {
  const [forecast, setForecast] = useState<WeeklyForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
          <CardTitle>On-Call Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-muted rounded"></div>
            <div className="h-40 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!forecast || forecast.forecast.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>On-Call Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-3">No schedules configured</p>
            <Link to="/schedules">
              <Button variant="outline">Create Schedule</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get who's currently on call (today)
  const getCurrentlyOnCall = () => {
    return forecast.forecast.map(schedule => {
      const today = schedule.days.find(d => d.isToday);
      return {
        schedule: schedule.schedule,
        oncallUser: today?.oncallUser || null,
      };
    });
  };

  const currentlyOnCall = getCurrentlyOnCall();

  // Show 7 days (current week)
  const allDays = forecast.forecast[0]?.days.slice(0, 7) || [];

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return {
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    };
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">On-Call Schedule</CardTitle>
          <Link to="/schedules">
            <Button variant="outline" size="sm">Manage Schedules</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Currently On Call - Prominent Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-lg p-4 border border-blue-100 dark:border-blue-900">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            Currently On Call
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentlyOnCall.map(({ schedule, oncallUser }) => (
              <div
                key={schedule.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700"
              >
                <div className="text-xs text-muted-foreground mb-1 capitalize">
                  {schedule.name}
                </div>
                {oncallUser ? (
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={oncallUser.profilePictureUrl}
                      name={oncallUser.fullName}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{oncallUser.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">{oncallUser.email}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <span className="text-gray-400 dark:text-gray-500">?</span>
                    </div>
                    <div className="text-sm text-muted-foreground">No one assigned</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 14-Day Calendar View */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Weekly Schedule
          </h3>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr>
                  <th className="text-left text-sm font-medium text-muted-foreground p-2 min-w-[140px] sticky left-0 bg-background z-10">
                    Schedule
                  </th>
                  {allDays.map((day) => {
                    const { day: dayNum, month } = formatDate(day.date);
                    return (
                      <th
                        key={day.date}
                        className={`text-center p-1 min-w-[70px] ${
                          day.isToday
                            ? 'bg-blue-100 dark:bg-blue-900/50 rounded-t-lg'
                            : ''
                        }`}
                      >
                        <div className="text-[10px] text-muted-foreground uppercase">{day.dayOfWeek}</div>
                        <div className={`text-sm font-semibold ${day.isToday ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                          {dayNum}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{month}</div>
                        {day.isToday && (
                          <div className="text-[9px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">TODAY</div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {forecast.forecast.map((schedule) => (
                  <tr key={schedule.schedule.id} className="border-t">
                    <td className="p-2 sticky left-0 bg-background z-10">
                      <Link
                        to={`/schedules/${schedule.schedule.id}`}
                        className="text-sm font-medium hover:text-blue-600 transition-colors block"
                      >
                        {schedule.schedule.name}
                      </Link>
                      <div className="text-xs text-muted-foreground capitalize">
                        {schedule.schedule.type} rotation
                      </div>
                    </td>
                    {schedule.days.slice(0, 7).map((day) => (
                      <td
                        key={day.date}
                        className={`text-center p-1.5 ${
                          day.isToday
                            ? 'bg-blue-100 dark:bg-blue-900/50'
                            : ''
                        }`}
                      >
                        {day.oncallUser ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <UserAvatar
                              src={day.oncallUser.profilePictureUrl}
                              name={day.oncallUser.fullName}
                              size="sm"
                              className={day.isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                            />
                            <span
                              className="text-[10px] truncate max-w-[60px] font-medium"
                              title={day.oncallUser.fullName}
                            >
                              {day.oncallUser.fullName.split(' ')[0]}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                              <span className="text-gray-400 text-xs">-</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">None</span>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="pt-2 border-t flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700"></div>
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600"></div>
            <span>No one assigned</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-blue-500 ring-2 ring-blue-500 ring-offset-1"></div>
            <span>Currently on call</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
