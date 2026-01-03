import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { schedulesAPI, usersAPI, teamsAPI, servicesAPI, escalationPoliciesAPI } from '../lib/api-client';
import type { Schedule, User, RenderedScheduleEntry, Service } from '../types/api';
import type { Team } from '../lib/api-client';

// Color palette for users in timeline
const USER_COLORS = [
  { bg: 'bg-indigo-500', text: 'text-white', light: 'bg-indigo-100 dark:bg-indigo-900' },
  { bg: 'bg-emerald-500', text: 'text-white', light: 'bg-emerald-100 dark:bg-emerald-900' },
  { bg: 'bg-amber-500', text: 'text-white', light: 'bg-amber-100 dark:bg-amber-900' },
  { bg: 'bg-rose-500', text: 'text-white', light: 'bg-rose-100 dark:bg-rose-900' },
  { bg: 'bg-cyan-500', text: 'text-white', light: 'bg-cyan-100 dark:bg-cyan-900' },
  { bg: 'bg-purple-500', text: 'text-white', light: 'bg-purple-100 dark:bg-purple-900' },
  { bg: 'bg-orange-500', text: 'text-white', light: 'bg-orange-100 dark:bg-orange-900' },
  { bg: 'bg-teal-500', text: 'text-white', light: 'bg-teal-100 dark:bg-teal-900' },
];

// Duration presets
type DurationPreset = '1W' | '2W' | '1M';

// Common timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

// Date utilities
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDateRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', options);
  const endStr = end.toLocaleDateString('en-US', { ...options, year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

function getDayAbbrev(date: Date): string {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return days[date.getDay()];
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function getDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function getTimezoneAbbr(timezone: string): string {
  try {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { timeZone: timezone, timeZoneName: 'short' };
    const formatted = date.toLocaleString('en-US', options);
    const match = formatted.match(/[A-Z]{2,5}$/);
    return match ? match[0] : timezone;
  } catch {
    return timezone;
  }
}

// Extended schedule type with rendered entries
interface ScheduleWithEntries extends Schedule {
  currentOncallUser?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  escalationPolicy?: {
    id: string;
    name: string;
  } | null;
  renderedEntries?: RenderedScheduleEntry[];
  associatedServices?: Array<{ id: string; name: string }>;
}

interface ScheduleCardProps {
  schedule: ScheduleWithEntries;
  dateRange: { start: Date; end: Date };
  userColorMap: Map<string, (typeof USER_COLORS)[0]>;
  onExport: (scheduleId: string, format: string) => void;
}

function ScheduleCard({ schedule, dateRange, userColorMap, onExport }: ScheduleCardProps) {
  const days = getDaysInRange(dateRange.start, dateRange.end);
  const today = startOfDay(new Date());

  // Calculate which user is on-call for each day based on rendered entries
  const dayAssignments = useMemo(() => {
    const assignments = new Map<string, { userId: string; userName: string; color: (typeof USER_COLORS)[0] }>();

    if (schedule.renderedEntries && schedule.renderedEntries.length > 0) {
      days.forEach(day => {
        const dayStart = startOfDay(day);
        const dayEnd = addDays(dayStart, 1);

        // Find entry that covers this day (prefer entries that start on this day)
        const entry = schedule.renderedEntries?.find(e => {
          const entryStart = new Date(e.start);
          const entryEnd = new Date(e.end);
          return entryStart < dayEnd && entryEnd > dayStart;
        });

        if (entry && entry.user) {
          const color = userColorMap.get(entry.userId) || USER_COLORS[0];
          assignments.set(day.toISOString().split('T')[0], {
            userId: entry.userId,
            userName: entry.user.fullName,
            color,
          });
        }
      });
    }

    return assignments;
  }, [schedule.renderedEntries, days, userColorMap]);

  // Get current on-call user info
  const currentOncall = schedule.currentOncallUser;

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        {/* Schedule Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <Link to={`/schedules/${schedule.id}`} className="hover:underline">
              <h3 className="text-lg font-semibold text-foreground">{schedule.name}</h3>
            </Link>
            {schedule.description && (
              <p className="text-sm text-muted-foreground mt-1">{schedule.description}</p>
            )}
          </div>

          {/* Export dropdown */}
          <div className="relative">
            <select
              className="h-8 px-3 text-xs rounded-md border border-input bg-background cursor-pointer"
              onChange={(e) => {
                if (e.target.value) {
                  onExport(schedule.id, e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Export</option>
              <option value="ical">iCal (.ics)</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
        </div>

        {/* Current On-Call & Escalation Policy Row */}
        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
          {currentOncall ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-semibold">
                {currentOncall.fullName.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-foreground">{currentOncall.fullName}</span>
              <span className="px-2 py-0.5 text-xs font-bold bg-green-500 text-white rounded">
                Now
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400"></span>
              <span className="text-muted-foreground">No one on-call</span>
            </div>
          )}

          {/* Escalation Policy chip */}
          {schedule.escalationPolicy && (
            <Link
              to={`/escalation-policies`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded text-xs font-medium transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {schedule.escalationPolicy.name}
            </Link>
          )}

          {/* Associated Services chips */}
          {schedule.associatedServices && schedule.associatedServices.length > 0 && (
            <>
              {schedule.associatedServices.slice(0, 3).map((service) => (
                <Link
                  key={service.id}
                  to={`/services/${service.id}/config`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs font-medium transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                  {service.name}
                </Link>
              ))}
              {schedule.associatedServices.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{schedule.associatedServices.length - 3} more
                </span>
              )}
            </>
          )}
        </div>

        {/* Timeline Strip */}
        <div className="border rounded-lg overflow-hidden bg-muted/30">
          {/* Day Headers */}
          <div
            className="grid border-b bg-muted/50"
            style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
          >
            {days.map((day, idx) => {
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={idx}
                  className={`px-1 py-2 text-center text-xs font-medium ${
                    isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <div>{getDayAbbrev(day)}{day.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Timeline Blocks */}
          <div
            className="grid relative h-10"
            style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
          >
            {/* Today marker line */}
            {days.some((d, idx) => isSameDay(d, today) && idx >= 0) && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                style={{
                  left: `${((days.findIndex(d => isSameDay(d, today)) + 0.5) / days.length) * 100}%`
                }}
              />
            )}

            {days.map((day, idx) => {
              const dayKey = day.toISOString().split('T')[0];
              const assignment = dayAssignments.get(dayKey);

              return (
                <div
                  key={idx}
                  className={`relative group ${
                    assignment ? assignment.color.bg : 'bg-muted'
                  }`}
                  title={assignment ? `${assignment.userName}` : 'Unassigned'}
                >
                  {/* Tooltip on hover */}
                  {assignment && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                      {assignment.userName}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="px-3 py-2 bg-muted/30 border-t flex flex-wrap gap-3 text-xs">
            {Array.from(new Set(Array.from(dayAssignments.values()).map(a => a.userId))).map(userId => {
              const assignment = Array.from(dayAssignments.values()).find(a => a.userId === userId);
              if (!assignment) return null;
              return (
                <div key={userId} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded ${assignment.color.bg}`}></span>
                  <span className="text-muted-foreground">{assignment.userName}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Schedules() {
  const navigate = useNavigate();

  // Core data
  const [schedules, setSchedules] = useState<ScheduleWithEntries[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'my-oncall' | 'all'>('all');

  // Date controls
  const [timezone, setTimezone] = useState(() => {
    return localStorage.getItem('schedules-timezone') || 'America/New_York';
  });
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('2W');
  const [dateRangeStart, setDateRangeStart] = useState(() => startOfDay(new Date()));

  // Filters
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'manual' as 'manual' | 'daily' | 'weekly',
    timezone: 'America/New_York',
  });

  // Calculate date range based on duration preset
  const dateRange = useMemo(() => {
    let endDate: Date;
    switch (durationPreset) {
      case '1W':
        endDate = addDays(dateRangeStart, 6);
        break;
      case '2W':
        endDate = addDays(dateRangeStart, 13);
        break;
      case '1M':
        endDate = addDays(dateRangeStart, 29);
        break;
      default:
        endDate = addDays(dateRangeStart, 13);
    }
    return { start: dateRangeStart, end: endDate };
  }, [dateRangeStart, durationPreset]);

  // Build a consistent color map for all users
  const userColorMap = useMemo(() => {
    const map = new Map<string, (typeof USER_COLORS)[0]>();
    const allUserIds = new Set<string>();

    schedules.forEach(schedule => {
      schedule.renderedEntries?.forEach(entry => {
        if (entry.userId) allUserIds.add(entry.userId);
      });
    });

    let colorIndex = 0;
    allUserIds.forEach(userId => {
      map.set(userId, USER_COLORS[colorIndex % USER_COLORS.length]);
      colorIndex++;
    });

    return map;
  }, [schedules]);

  // Persist timezone preference
  useEffect(() => {
    localStorage.setItem('schedules-timezone', timezone);
  }, [timezone]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Fetch rendered schedules when date range changes
  useEffect(() => {
    if (schedules.length > 0) {
      loadRenderedSchedules();
    }
  }, [dateRange.start, dateRange.end, schedules.length]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [schedulesRes, usersRes, teamsRes, meRes, servicesRes, policiesRes] = await Promise.all([
        schedulesAPI.list(),
        usersAPI.listUsers(),
        teamsAPI.list(),
        usersAPI.getMe(),
        servicesAPI.list().catch(() => ({ services: [] })),
        escalationPoliciesAPI.list().catch(() => ({ policies: [] })),
      ]);

      // Build a map of escalation policy ID to services
      const policyToServices = new Map<string, Array<{ id: string; name: string }>>();
      servicesRes.services.forEach((service: Service) => {
        const policyId = (service as any).escalationPolicyId || service.escalationPolicy?.id;
        if (policyId) {
          if (!policyToServices.has(policyId)) {
            policyToServices.set(policyId, []);
          }
          policyToServices.get(policyId)!.push({
            id: service.id,
            name: service.name,
          });
        }
      });

      // Build a map of schedule ID to escalation policies (via policy steps)
      const scheduleToPolicy = new Map<string, { id: string; name: string }>();
      policiesRes.policies.forEach((policy: any) => {
        policy.steps?.forEach((step: any) => {
          if (step.scheduleId) {
            scheduleToPolicy.set(step.scheduleId, { id: policy.id, name: policy.name });
          }
        });
      });

      // Enhance schedules with escalation policy and services
      const enhancedSchedules = schedulesRes.schedules.map((schedule: Schedule) => {
        const policy = scheduleToPolicy.get(schedule.id);
        const services = policy ? policyToServices.get(policy.id) : [];
        return {
          ...schedule,
          escalationPolicy: policy || null,
          associatedServices: services || [],
        };
      });

      setSchedules(enhancedSchedules);
      setUsers(usersRes.users);
      setTeams(teamsRes.teams);
      setCurrentUserId(meRes.user.id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load schedules');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRenderedSchedules = async () => {
    const since = dateRange.start.toISOString();
    const until = dateRange.end.toISOString();

    // Fetch rendered entries for each schedule
    const updatedSchedules = await Promise.all(
      schedules.map(async (schedule) => {
        try {
          const rendered = await schedulesAPI.getRenderedSchedule(schedule.id, since, until);
          return {
            ...schedule,
            currentOncallUser: rendered.currentOncallUserId
              ? users.find(u => u.id === rendered.currentOncallUserId)
                ? {
                    id: rendered.currentOncallUserId,
                    fullName: users.find(u => u.id === rendered.currentOncallUserId)?.fullName || 'Unknown',
                    email: users.find(u => u.id === rendered.currentOncallUserId)?.email || ''
                  }
                : rendered.entries[0]?.user || null
              : null,
            renderedEntries: rendered.entries,
          } as ScheduleWithEntries;
        } catch {
          return schedule;
        }
      })
    );

    setSchedules(updatedSchedules);
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Schedule name is required');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      const response = await schedulesAPI.create(formData);
      setShowCreateForm(false);
      setFormData({
        name: '',
        description: '',
        type: 'manual',
        timezone: 'America/New_York',
      });
      navigate(`/schedules/${response.schedule.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create schedule');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDateNavigation = useCallback((direction: 'prev' | 'next') => {
    const daysToMove = durationPreset === '1W' ? 7 : durationPreset === '2W' ? 14 : 30;
    setDateRangeStart(prev =>
      direction === 'prev'
        ? addDays(prev, -daysToMove)
        : addDays(prev, daysToMove)
    );
  }, [durationPreset]);

  const handleGoToToday = useCallback(() => {
    setDateRangeStart(startOfDay(new Date()));
  }, []);

  const handleExport = useCallback((scheduleId: string, format: string) => {
    // In a real implementation, this would call an export API
    console.log(`Exporting schedule ${scheduleId} as ${format}`);
    // Placeholder for future implementation
    alert(`Export as ${format.toUpperCase()} - Feature coming soon!`);
  }, []);

  // Filter schedules based on current tab and filters
  const filteredSchedules = useMemo(() => {
    let result = [...schedules];

    // Filter by tab
    if (activeTab === 'my-oncall' && currentUserId) {
      result = result.filter(schedule => {
        // Include if current user is currently on-call
        if (schedule.currentOncallUser?.id === currentUserId) return true;
        // Or if they have any shifts in the current date range
        return schedule.renderedEntries?.some(e => e.userId === currentUserId);
      });
    }

    // Filter by user if selected
    if (userFilter) {
      result = result.filter(schedule =>
        schedule.renderedEntries?.some(e => e.userId === userFilter)
      );
    }

    return result;
  }, [schedules, activeTab, currentUserId, teamFilter, userFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredSchedules.length / perPage);
  const paginatedSchedules = filteredSchedules.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Schedules</h1>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            + New Schedule
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab('my-oncall')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'my-oncall'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            My On-Call
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            All Schedules
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {/* Create Schedule Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create New Schedule</CardTitle>
              <CardDescription>
                Set up a new on-call rotation schedule for your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSchedule} className="space-y-4">
                <div>
                  <Label htmlFor="name">Schedule Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Primary On-Call"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>

                <div>
                  <Label htmlFor="type">Schedule Type</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'manual' | 'daily' | 'weekly' })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="manual">Manual (admin sets who is on-call)</option>
                    <option value="daily">Daily Rotation</option>
                    <option value="weekly">Weekly Rotation</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <select
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {TIMEZONES.map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? 'Creating...' : 'Create Schedule'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Date Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card border rounded-lg mb-4">
          {/* Timezone Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Timezone:</span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-8 px-2 text-sm rounded-md border border-input bg-background"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({getTimezoneAbbr(tz.value)})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDateNavigation('prev')}
            >
              &lt;
            </Button>
            <button
              onClick={handleGoToToday}
              className="px-3 py-1 text-sm font-medium hover:bg-accent rounded"
            >
              {formatDateRange(dateRange.start, dateRange.end)}
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDateNavigation('next')}
            >
              &gt;
            </Button>
          </div>

          {/* Duration Preset */}
          <div className="flex items-center gap-1">
            {(['1W', '2W', '1M'] as DurationPreset[]).map(preset => (
              <button
                key={preset}
                onClick={() => setDurationPreset(preset)}
                className={`px-3 py-1 text-sm rounded ${
                  durationPreset === preset
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
              >
                {preset === '1W' ? '1 Week' : preset === '2W' ? '2 Weeks' : 'Month'}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-card border rounded-lg mb-6">
          <div className="flex items-center gap-3">
            {/* Team Filter */}
            <select
              value={teamFilter}
              onChange={(e) => { setTeamFilter(e.target.value); setPage(1); }}
              className="h-8 px-2 text-sm rounded-md border border-input bg-background"
            >
              <option value="">All Teams</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>

            {/* User Filter */}
            <select
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
              className="h-8 px-2 text-sm rounded-md border border-input bg-background"
            >
              <option value="">All Users</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.fullName}</option>
              ))}
            </select>
          </div>

          {/* Pagination Info */}
          <div className="text-sm text-muted-foreground">
            {filteredSchedules.length > 0 && (
              <>
                {perPage} per page | Page {page} of {totalPages || 1}
              </>
            )}
          </div>
        </div>

        {/* Schedules List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading schedules...</p>
          </div>
        ) : paginatedSchedules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                {activeTab === 'my-oncall'
                  ? 'You are not assigned to any schedules in this date range.'
                  : 'No schedules found'}
              </p>
              {activeTab === 'all' && (
                <Button onClick={() => setShowCreateForm(true)}>Create Your First Schedule</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {paginatedSchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                dateRange={dateRange}
                userColorMap={userColorMap}
                onExport={handleExport}
              />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="flex items-center px-3 text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
