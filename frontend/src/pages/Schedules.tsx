import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { schedulesAPI, usersAPI } from '../lib/api-client';
import type { Schedule, User } from '../types/api';

export function Schedules() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'manual' as 'manual' | 'daily' | 'weekly',
    timezone: 'America/New_York',
  });

  useEffect(() => {
    loadSchedules();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const response = await usersAPI.getMe();
      setIsAdmin(response.user.role === 'admin');
    } catch (err) {
      console.error('Failed to load user role:', err);
    }
  };

  const loadSchedules = async () => {
    try {
      setIsLoading(true);
      const [schedulesRes, usersRes] = await Promise.all([
        schedulesAPI.list(),
        usersAPI.listUsers(),
      ]);
      setSchedules(schedulesRes.schedules);
      setUsers(usersRes.users);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load schedules');
    } finally {
      setIsLoading(false);
    }
  };

  const getUserName = (schedule: Schedule): string => {
    // Use the new currentOncallUser object if available
    if ((schedule as any).currentOncallUser) {
      const user = (schedule as any).currentOncallUser;
      return user.fullName || user.email;
    }
    // Fallback to looking up by ID
    if (!schedule.currentOncallUserId) return 'None assigned';
    const user = users.find(u => u.id === schedule.currentOncallUserId);
    return user ? (user.fullName || user.email) : 'Unknown user';
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
      // Navigate to the newly created schedule
      navigate(`/schedules/${response.schedule.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create schedule');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      return;
    }

    try {
      await schedulesAPI.delete(scheduleId);
      loadSchedules(); // Refresh the list
    } catch (err: any) {
      alert('Failed to delete schedule: ' + (err.response?.data?.error || err.message));
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'manual':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'daily':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'weekly':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div>
      <main className="container mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold mb-2">On-Call Schedules</h2>
            <p className="text-muted-foreground">
              Manage your team's on-call rotation schedules
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Cancel' : 'Create Schedule'}
          </Button>
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
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="UTC">UTC</option>
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

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading schedules...</p>
          </div>
        ) : schedules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No schedules found</p>
              <Button onClick={() => setShowCreateForm(true)}>Create Your First Schedule</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {schedules.map((schedule) => (
              <Link key={schedule.id} to={`/schedules/${schedule.id}`}>
                <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(schedule.type)}`}>
                        {schedule.type.toUpperCase()}
                      </span>
                      {schedule.isOverride && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          OVERRIDE
                        </span>
                      )}
                    </div>
                    <CardTitle>{schedule.name}</CardTitle>
                    {schedule.description && (
                      <CardDescription>{schedule.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Timezone:</span>{' '}
                        <span className="font-medium">{schedule.timezone}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Current On-Call:</span>{' '}
                        <span className={`font-medium ${!schedule.currentOncallUserId && !(schedule as any).currentOncallUser ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                          {getUserName(schedule)}
                        </span>
                      </div>
                      {schedule.isOverride && schedule.overrideUntil && (
                        <div>
                          <span className="text-muted-foreground">Override Until:</span>{' '}
                          <span className="font-medium">
                            {new Date(schedule.overrideUntil).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 space-y-2">
                      <Button variant="outline" className="w-full" size="sm">
                        Manage Schedule
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={(e) => handleDeleteSchedule(schedule.id, e)}
                        >
                          Delete Schedule
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
