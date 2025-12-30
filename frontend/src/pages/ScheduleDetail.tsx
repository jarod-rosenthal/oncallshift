import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { schedulesAPI, usersAPI } from '../lib/api-client';
import type { Schedule, ScheduleMember, User } from '../types/api';

export function ScheduleDetail() {
  const { id } = useParams<{ id: string }>();

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [members, setMembers] = useState<ScheduleMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);

  useEffect(() => {
    if (id) {
      loadScheduleData();
    }
  }, [id]);

  const loadScheduleData = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      console.log('Loading schedule data for ID:', id);

      const [scheduleData, membersData, usersData] = await Promise.all([
        schedulesAPI.get(id),
        schedulesAPI.getMembers(id),
        usersAPI.listUsers(true), // Only users with availability
      ]);

      console.log('Schedule data loaded:', scheduleData);
      console.log('Members data loaded:', membersData);
      console.log('Users data loaded:', usersData);

      setSchedule(scheduleData.schedule);
      setMembers(membersData.members);

      // Filter out users who are already members
      const memberUserIds = new Set(membersData.members.map(m => m.userId));
      const available = usersData.users.filter(u => !memberUserIds.has(u.id));
      setAvailableUsers(available);

      setError(null);
    } catch (err: any) {
      console.error('Error loading schedule:', err);
      console.error('Error response:', err.response);
      setError(err.response?.data?.error || err.message || 'Failed to load schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!id) return;

    try {
      console.log('Adding member:', { scheduleId: id, userId });
      const result = await schedulesAPI.addMember(id, userId);
      console.log('Member added successfully:', result);
      setShowAddMember(false);
      loadScheduleData(); // Reload to get updated list
    } catch (err: any) {
      console.error('Failed to add member:', err);
      console.error('Error response:', err.response);
      console.error('Error status:', err.response?.status);
      console.error('Error data:', err.response?.data);
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || err.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!id) return;
    if (!confirm('Are you sure you want to remove this member from the schedule?')) return;

    try {
      await schedulesAPI.removeMember(id, memberId);
      loadScheduleData(); // Reload to get updated list
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleMoveUp = async (member: ScheduleMember) => {
    if (!id || member.position === 0) return;

    try {
      await schedulesAPI.reorderMember(id, member.id, member.position - 1);
      loadScheduleData(); // Reload to get updated list
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reorder member');
    }
  };

  const handleMoveDown = async (member: ScheduleMember) => {
    if (!id || member.position === members.length - 1) return;

    try {
      await schedulesAPI.reorderMember(id, member.id, member.position + 1);
      loadScheduleData(); // Reload to get updated list
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reorder member');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading schedule...</p>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-muted-foreground mb-4">
            {error || 'Schedule not found'}
          </p>
          {error && (
            <p className="text-sm text-red-600 mb-4">
              {error}
            </p>
          )}
          <Link to="/schedules">
            <Button variant="outline">Back to Schedules</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link to="/schedules">
            <Button variant="ghost" size="sm">← Back to Schedules</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Schedule Info */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{schedule.name}</h1>
          {schedule.description && (
            <p className="text-muted-foreground">{schedule.description}</p>
          )}
          <div className="mt-2 text-sm text-muted-foreground">
            Type: {schedule.type} • Timezone: {schedule.timezone}
          </div>
        </div>

        {/* Rotation Members */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Rotation Members</CardTitle>
                <CardDescription>
                  {members.length === 0
                    ? 'No members assigned yet'
                    : `${members.length} member${members.length === 1 ? '' : 's'} in rotation`}
                </CardDescription>
              </div>
              <Button onClick={() => setShowAddMember(!showAddMember)}>
                Add Member
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Add Member Dropdown */}
            {showAddMember && (
              <div className="mb-4 p-4 border rounded-lg bg-accent">
                <h3 className="font-medium mb-3">Add Team Member</h3>
                {availableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No available users with on-call availability set.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2 border rounded hover:bg-background"
                      >
                        <div>
                          <p className="font-medium">{user.fullName}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddMember(user.id)}
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Members List */}
            {members.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No members in rotation. Add team members to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((member, index) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold text-muted-foreground w-8">
                        #{member.position + 1}
                      </div>
                      <div>
                        <p className="font-medium">
                          {member.user?.fullName || 'Unknown User'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {member.user?.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Reorder Buttons */}
                      <div className="flex flex-col">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMoveUp(member)}
                          disabled={index === 0}
                          className="h-6 px-2"
                        >
                          ↑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMoveDown(member)}
                          disabled={index === members.length - 1}
                          className="h-6 px-2"
                        >
                          ↓
                        </Button>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>How Rotation Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              • Team members are assigned in rotation order (#1, #2, #3, etc.)
            </p>
            <p>
              • The current on-call person is determined by the schedule type (manual, daily, weekly)
            </p>
            <p>
              • Only users who have set their availability can be added to schedules
            </p>
            <p>
              • Use the up/down arrows to change rotation order
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
