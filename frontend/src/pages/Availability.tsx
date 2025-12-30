import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Navigation } from '../components/Navigation';
import { usersAPI } from '../lib/api-client';
import type { UserAvailability, WeeklyHours, BlackoutDate } from '../types/api';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  monday: { available: true, start: '09:00', end: '17:00' },
  tuesday: { available: true, start: '09:00', end: '17:00' },
  wednesday: { available: true, start: '09:00', end: '17:00' },
  thursday: { available: true, start: '09:00', end: '17:00' },
  friday: { available: true, start: '09:00', end: '17:00' },
  saturday: { available: false, start: '09:00', end: '17:00' },
  sunday: { available: false, start: '09:00', end: '17:00' },
};

export function Availability() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasExistingAvailability, setHasExistingAvailability] = useState(false);

  const [timezone, setTimezone] = useState('America/New_York');
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>(DEFAULT_WEEKLY_HOURS);
  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([]);

  // New blackout date form
  const [newBlackoutStart, setNewBlackoutStart] = useState('');
  const [newBlackoutEnd, setNewBlackoutEnd] = useState('');
  const [newBlackoutReason, setNewBlackoutReason] = useState('');

  useEffect(() => {
    loadAvailability();
  }, []);

  const loadAvailability = async () => {
    try {
      setIsLoading(true);
      const response = await usersAPI.getMyAvailability();

      if (response.availability) {
        setTimezone(response.availability.timezone);
        setWeeklyHours(response.availability.weeklyHours);
        setBlackoutDates(response.availability.blackoutDates);
        setHasExistingAvailability(response.hasAvailability);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load availability');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      const data: UserAvailability = {
        timezone,
        weeklyHours,
        blackoutDates,
      };

      await usersAPI.updateMyAvailability(data);
      setSuccess(true);
      setHasExistingAvailability(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save availability');
    } finally {
      setIsSaving(false);
    }
  };

  const updateDayHours = (day: keyof WeeklyHours, field: 'available' | 'start' | 'end', value: boolean | string) => {
    setWeeklyHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const addBlackoutDate = () => {
    if (!newBlackoutStart || !newBlackoutEnd) {
      setError('Please provide both start and end dates for blackout period');
      return;
    }

    const newBlackout: BlackoutDate = {
      start: newBlackoutStart,
      end: newBlackoutEnd,
      reason: newBlackoutReason || undefined,
    };

    setBlackoutDates(prev => [...prev, newBlackout]);
    setNewBlackoutStart('');
    setNewBlackoutEnd('');
    setNewBlackoutReason('');
    setError(null);
  };

  const removeBlackoutDate = (index: number) => {
    setBlackoutDates(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" className="mb-4">← Back to Dashboard</Button>
        </Link>
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">My On-Call Availability</h2>
          <p className="text-muted-foreground">
            Set your availability to be assigned to on-call schedules
          </p>
          {!hasExistingAvailability && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ You must set your availability before you can be assigned to on-call schedules
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 text-sm text-green-800 bg-green-50 dark:bg-green-900/20 dark:text-green-200 rounded-md">
            ✓ Availability saved successfully!
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading availability...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Timezone Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Timezone</CardTitle>
                <CardDescription>
                  Select your local timezone for accurate on-call scheduling
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </Select>
              </CardContent>
            </Card>

            {/* Weekly Hours */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Availability</CardTitle>
                <CardDescription>
                  Set the hours you're available for on-call duty each day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {DAYS.map(day => (
                    <div key={day} className="flex items-center gap-4">
                      <div className="w-32">
                        <Label className="capitalize">{day}</Label>
                      </div>
                      <Switch
                        checked={weeklyHours[day].available}
                        onCheckedChange={(checked: boolean) => updateDayHours(day, 'available', checked)}
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="time"
                          value={weeklyHours[day].start}
                          onChange={(e) => updateDayHours(day, 'start', e.target.value)}
                          disabled={!weeklyHours[day].available}
                          className="w-32"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={weeklyHours[day].end}
                          onChange={(e) => updateDayHours(day, 'end', e.target.value)}
                          disabled={!weeklyHours[day].available}
                          className="w-32"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Blackout Dates */}
            <Card>
              <CardHeader>
                <CardTitle>Blackout Dates</CardTitle>
                <CardDescription>
                  Mark dates when you're unavailable (vacation, holidays, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Add Blackout Date Form */}
                  <div className="grid gap-4 p-4 border rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="blackout-start">Start Date</Label>
                        <Input
                          id="blackout-start"
                          type="date"
                          value={newBlackoutStart}
                          onChange={(e) => setNewBlackoutStart(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="blackout-end">End Date</Label>
                        <Input
                          id="blackout-end"
                          type="date"
                          value={newBlackoutEnd}
                          onChange={(e) => setNewBlackoutEnd(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="blackout-reason">Reason (optional)</Label>
                      <Input
                        id="blackout-reason"
                        type="text"
                        placeholder="e.g., Vacation, Conference"
                        value={newBlackoutReason}
                        onChange={(e) => setNewBlackoutReason(e.target.value)}
                      />
                    </div>
                    <Button onClick={addBlackoutDate} variant="outline" size="sm">
                      Add Blackout Date
                    </Button>
                  </div>

                  {/* Existing Blackout Dates */}
                  {blackoutDates.length > 0 && (
                    <div className="space-y-2">
                      {blackoutDates.map((blackout, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">
                              {new Date(blackout.start).toLocaleDateString()} - {new Date(blackout.end).toLocaleDateString()}
                            </p>
                            {blackout.reason && (
                              <p className="text-sm text-muted-foreground">{blackout.reason}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBlackoutDate(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {blackoutDates.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No blackout dates set
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Availability'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
