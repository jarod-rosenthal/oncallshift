import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { schedulesAPI, usersAPI } from '../lib/api-client';
import type { Schedule, ScheduleMember, ScheduleOverride, ScheduleLayer, User, RotationType } from '../types/api';

export function ScheduleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [members, setMembers] = useState<ScheduleMember[]>([]);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [layers, setLayers] = useState<ScheduleLayer[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [showAddLayer, setShowAddLayer] = useState(false);
  const [editingLayer, setEditingLayer] = useState<ScheduleLayer | null>(null);
  const [isCreatingOverride, setIsCreatingOverride] = useState(false);
  const [isCreatingLayer, setIsCreatingLayer] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    userId: '',
    startTime: '',
    endTime: '',
    reason: '',
  });
  const [layerForm, setLayerForm] = useState({
    name: '',
    rotationType: 'weekly' as RotationType,
    startDate: '',
    handoffTime: '09:00',
    handoffDay: 1,
    rotationLength: 1,
    userIds: [] as string[],
  });

  useEffect(() => {
    if (id) {
      loadScheduleData();
    }
    loadCurrentUser();
  }, [id]);

  const loadCurrentUser = async () => {
    try {
      const response = await usersAPI.getMe();
      setIsAdmin(response.user.role === 'admin');
    } catch (err) {
      console.error('Failed to load user role:', err);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!id) return;

    try {
      setIsDeleting(true);
      await schedulesAPI.delete(id);
      navigate('/schedules', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete schedule');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const loadScheduleData = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      console.log('Loading schedule data for ID:', id);

      const [scheduleData, membersData, usersData, overridesData, layersData] = await Promise.all([
        schedulesAPI.get(id),
        schedulesAPI.getMembers(id),
        usersAPI.listUsers(true), // Only users with availability
        schedulesAPI.listOverrides(id),
        schedulesAPI.listLayers(id),
      ]);

      console.log('Schedule data loaded:', scheduleData);
      console.log('Members data loaded:', membersData);
      console.log('Users data loaded:', usersData);
      console.log('Overrides data loaded:', overridesData);
      console.log('Layers data loaded:', layersData);

      setSchedule(scheduleData.schedule);
      setMembers(membersData.members);
      setOverrides(overridesData.overrides || []);
      setLayers(layersData.layers || []);
      setAllUsers(usersData.users);

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

  const handleCreateOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!overrideForm.userId || !overrideForm.startTime || !overrideForm.endTime) {
      setError('User, start time, and end time are required');
      return;
    }

    try {
      setIsCreatingOverride(true);
      setError(null);
      await schedulesAPI.createOverrideNew(id, {
        userId: overrideForm.userId,
        startTime: new Date(overrideForm.startTime).toISOString(),
        endTime: new Date(overrideForm.endTime).toISOString(),
        reason: overrideForm.reason || undefined,
      });
      setShowAddOverride(false);
      setOverrideForm({ userId: '', startTime: '', endTime: '', reason: '' });
      loadScheduleData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create override');
    } finally {
      setIsCreatingOverride(false);
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this override?')) return;

    try {
      await schedulesAPI.deleteOverride(id, overrideId);
      loadScheduleData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete override');
    }
  };

  // Layer handlers
  const handleOpenLayerForm = () => {
    const now = new Date();
    setLayerForm({
      name: '',
      rotationType: 'weekly',
      startDate: now.toISOString().split('T')[0],
      handoffTime: '09:00',
      handoffDay: 1,
      rotationLength: 1,
      userIds: [],
    });
    setEditingLayer(null);
    setShowAddLayer(true);
  };

  const handleEditLayer = (layer: ScheduleLayer) => {
    setLayerForm({
      name: layer.name,
      rotationType: layer.rotationType,
      startDate: layer.startDate.split('T')[0],
      handoffTime: layer.handoffTime.substring(0, 5),
      handoffDay: layer.handoffDay ?? 1,
      rotationLength: layer.rotationLength,
      userIds: layer.members.map(m => m.userId),
    });
    setEditingLayer(layer);
    setShowAddLayer(true);
  };

  const handleCreateOrUpdateLayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!layerForm.name || !layerForm.startDate) {
      setError('Layer name and start date are required');
      return;
    }

    try {
      setIsCreatingLayer(true);
      setError(null);

      if (editingLayer) {
        // Update existing layer
        await schedulesAPI.updateLayer(id, editingLayer.id, {
          name: layerForm.name,
          rotationType: layerForm.rotationType,
          startDate: new Date(layerForm.startDate).toISOString(),
          handoffTime: layerForm.handoffTime + ':00',
          handoffDay: layerForm.rotationType === 'weekly' ? layerForm.handoffDay : undefined,
          rotationLength: layerForm.rotationType === 'custom' ? layerForm.rotationLength : undefined,
        });
        // Update members separately if changed
        await schedulesAPI.updateLayerMembers(id, editingLayer.id, layerForm.userIds);
      } else {
        // Create new layer
        await schedulesAPI.createLayer(id, {
          name: layerForm.name,
          rotationType: layerForm.rotationType,
          startDate: new Date(layerForm.startDate).toISOString(),
          handoffTime: layerForm.handoffTime + ':00',
          handoffDay: layerForm.rotationType === 'weekly' ? layerForm.handoffDay : undefined,
          rotationLength: layerForm.rotationType === 'custom' ? layerForm.rotationLength : undefined,
          userIds: layerForm.userIds,
        });
      }

      setShowAddLayer(false);
      setEditingLayer(null);
      loadScheduleData();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${editingLayer ? 'update' : 'create'} layer`);
    } finally {
      setIsCreatingLayer(false);
    }
  };

  const handleDeleteLayer = async (layerId: string) => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this layer? All rotation members will be removed.')) return;

    try {
      await schedulesAPI.deleteLayer(id, layerId);
      loadScheduleData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete layer');
    }
  };

  const toggleUserInLayer = (userId: string) => {
    setLayerForm(prev => ({
      ...prev,
      userIds: prev.userIds.includes(userId)
        ? prev.userIds.filter(id => id !== userId)
        : [...prev.userIds, userId],
    }));
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Helper to format date for datetime-local input
  const formatDateTimeLocal = (date: Date) => {
    return date.toISOString().slice(0, 16);
  };

  // Set default times when opening the override form
  const handleOpenOverrideForm = () => {
    const now = new Date();
    const endTime = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours from now
    setOverrideForm({
      userId: '',
      startTime: formatDateTimeLocal(now),
      endTime: formatDateTimeLocal(endTime),
      reason: '',
    });
    setShowAddOverride(true);
  };

  // Filter overrides into active/upcoming
  const activeOverrides = overrides.filter(o => o.isActive);
  const upcomingOverrides = overrides.filter(o => o.isFuture);

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

        {/* Schedule Overrides */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Schedule Overrides</CardTitle>
                <CardDescription>
                  Temporarily assign on-call duty to a different person
                </CardDescription>
              </div>
              <Button onClick={handleOpenOverrideForm}>
                Create Override
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Create Override Form */}
            {showAddOverride && (
              <div className="mb-6 p-4 border rounded-lg bg-accent">
                <h3 className="font-medium mb-4">Create New Override</h3>
                <form onSubmit={handleCreateOverride} className="space-y-4">
                  <div>
                    <Label htmlFor="override-user">Assign To *</Label>
                    <select
                      id="override-user"
                      value={overrideForm.userId}
                      onChange={(e) => setOverrideForm({ ...overrideForm, userId: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      required
                    >
                      <option value="">Select a user...</option>
                      {allUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.fullName} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="override-start">Start Time *</Label>
                      <Input
                        id="override-start"
                        type="datetime-local"
                        value={overrideForm.startTime}
                        onChange={(e) => setOverrideForm({ ...overrideForm, startTime: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="override-end">End Time *</Label>
                      <Input
                        id="override-end"
                        type="datetime-local"
                        value={overrideForm.endTime}
                        onChange={(e) => setOverrideForm({ ...overrideForm, endTime: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="override-reason">Reason (optional)</Label>
                    <Input
                      id="override-reason"
                      type="text"
                      placeholder="e.g., Covering for vacation"
                      value={overrideForm.reason}
                      onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={isCreatingOverride}>
                      {isCreatingOverride ? 'Creating...' : 'Create Override'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddOverride(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Active Overrides */}
            {activeOverrides.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Active Overrides</h4>
                <div className="space-y-2">
                  {activeOverrides.map((override) => (
                    <div
                      key={override.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs rounded bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200">
                            ACTIVE
                          </span>
                          <span className="font-medium">
                            {override.user?.fullName || 'Unknown User'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Until {new Date(override.endTime).toLocaleString()}
                          {override.reason && ` • ${override.reason}`}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteOverride(override.id)}
                      >
                        End Override
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Overrides */}
            {upcomingOverrides.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Upcoming Overrides</h4>
                <div className="space-y-2">
                  {upcomingOverrides.map((override) => (
                    <div
                      key={override.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            SCHEDULED
                          </span>
                          <span className="font-medium">
                            {override.user?.fullName || 'Unknown User'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(override.startTime).toLocaleString()} — {new Date(override.endTime).toLocaleString()}
                          {override.reason && ` • ${override.reason}`}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteOverride(override.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeOverrides.length === 0 && upcomingOverrides.length === 0 && !showAddOverride && (
              <p className="text-center text-muted-foreground py-8">
                No overrides scheduled. Create an override to temporarily assign on-call duty to someone else.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Schedule Layers */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Rotation Layers</CardTitle>
                <CardDescription>
                  Configure automated rotation layers (PagerDuty-style). Lower layer number = higher priority.
                </CardDescription>
              </div>
              <Button onClick={handleOpenLayerForm}>
                Add Layer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Add/Edit Layer Form */}
            {showAddLayer && (
              <div className="mb-6 p-4 border rounded-lg bg-accent">
                <h3 className="font-medium mb-4">
                  {editingLayer ? 'Edit Layer' : 'Create New Layer'}
                </h3>
                <form onSubmit={handleCreateOrUpdateLayer} className="space-y-4">
                  <div>
                    <Label htmlFor="layer-name">Layer Name *</Label>
                    <Input
                      id="layer-name"
                      type="text"
                      placeholder="e.g., Primary On-Call"
                      value={layerForm.name}
                      onChange={(e) => setLayerForm({ ...layerForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="layer-rotation-type">Rotation Type *</Label>
                      <select
                        id="layer-rotation-type"
                        value={layerForm.rotationType}
                        onChange={(e) => setLayerForm({ ...layerForm, rotationType: e.target.value as RotationType })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="layer-start-date">Start Date *</Label>
                      <Input
                        id="layer-start-date"
                        type="date"
                        value={layerForm.startDate}
                        onChange={(e) => setLayerForm({ ...layerForm, startDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="layer-handoff-time">Handoff Time</Label>
                      <Input
                        id="layer-handoff-time"
                        type="time"
                        value={layerForm.handoffTime}
                        onChange={(e) => setLayerForm({ ...layerForm, handoffTime: e.target.value })}
                      />
                    </div>
                    {layerForm.rotationType === 'weekly' && (
                      <div>
                        <Label htmlFor="layer-handoff-day">Handoff Day</Label>
                        <select
                          id="layer-handoff-day"
                          value={layerForm.handoffDay}
                          onChange={(e) => setLayerForm({ ...layerForm, handoffDay: parseInt(e.target.value) })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {dayNames.map((day, index) => (
                            <option key={index} value={index}>{day}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {layerForm.rotationType === 'custom' && (
                      <div>
                        <Label htmlFor="layer-rotation-length">Rotation Length (days)</Label>
                        <Input
                          id="layer-rotation-length"
                          type="number"
                          min="1"
                          value={layerForm.rotationLength}
                          onChange={(e) => setLayerForm({ ...layerForm, rotationLength: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Rotation Members (select in order)</Label>
                    <div className="mt-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
                      {allUsers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No users available.</p>
                      ) : (
                        <div className="space-y-2">
                          {allUsers.map((user) => (
                            <label
                              key={user.id}
                              className="flex items-center gap-3 p-2 border rounded hover:bg-background cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={layerForm.userIds.includes(user.id)}
                                onChange={() => toggleUserInLayer(user.id)}
                                className="h-4 w-4"
                              />
                              <div className="flex-1">
                                <p className="font-medium">{user.fullName}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                              {layerForm.userIds.includes(user.id) && (
                                <span className="text-sm font-medium text-primary">
                                  #{layerForm.userIds.indexOf(user.id) + 1}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    {layerForm.userIds.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {layerForm.userIds.length} member(s) selected
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={isCreatingLayer}>
                      {isCreatingLayer ? 'Saving...' : (editingLayer ? 'Update Layer' : 'Create Layer')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddLayer(false);
                        setEditingLayer(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Layers List */}
            {layers.length === 0 && !showAddLayer ? (
              <p className="text-center text-muted-foreground py-8">
                No rotation layers configured. Add a layer to set up automated on-call rotations.
              </p>
            ) : (
              <div className="space-y-4">
                {layers.map((layer) => (
                  <div
                    key={layer.id}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                            Layer {layer.layerOrder + 1}
                          </span>
                          <h4 className="font-medium">{layer.name}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {layer.rotationType.charAt(0).toUpperCase() + layer.rotationType.slice(1)} rotation
                          {layer.rotationType === 'weekly' && layer.handoffDay !== null && (
                            <> • Handoff: {dayNames[layer.handoffDay]} at {layer.handoffTime?.substring(0, 5) || '09:00'}</>
                          )}
                          {layer.rotationType === 'daily' && (
                            <> • Handoff at {layer.handoffTime?.substring(0, 5) || '09:00'}</>
                          )}
                          {layer.rotationType === 'custom' && (
                            <> • Every {layer.rotationLength} day(s) at {layer.handoffTime?.substring(0, 5) || '09:00'}</>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditLayer(layer)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteLayer(layer.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    {/* Layer Members */}
                    {layer.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No members in this layer.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {layer.members.map((member, idx) => (
                          <div
                            key={member.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                              layer.currentOncallUserId === member.userId
                                ? 'bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700'
                                : 'bg-slate-100 dark:bg-slate-800'
                            }`}
                          >
                            <span className="font-medium text-muted-foreground">#{idx + 1}</span>
                            <span>{member.user?.fullName || 'Unknown'}</span>
                            {layer.currentOncallUserId === member.userId && (
                              <span className="text-green-600 dark:text-green-400 text-xs font-medium">
                                ON-CALL
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
            <p>
              • Create overrides to temporarily assign on-call duty to a different person
            </p>
          </CardContent>
        </Card>

        {/* Admin Actions */}
        {isAdmin && (
          <Card className="mt-6 border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Destructive actions that cannot be undone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Schedule
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="text-destructive">Delete Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete <strong>{schedule.name}</strong>? This action cannot be undone.
                  All rotation members, overrides, and layers will be permanently removed.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteSchedule}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Schedule'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
