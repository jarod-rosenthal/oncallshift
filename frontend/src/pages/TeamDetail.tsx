import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { teamsAPI, usersAPI, type Team } from '../lib/api-client';
import type { User } from '../types/api';
import { useAuthStore } from '../store/auth-store';

export function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const [team, setTeam] = useState<Team | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Add member form state
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'manager' | 'member'>('member');
  const [isAddingMember, setIsAddingMember] = useState(false);

  useEffect(() => {
    if (id) {
      loadTeam();
      loadUsers();
    }
  }, [id]);

  const loadTeam = async () => {
    try {
      setIsLoading(true);
      const response = await teamsAPI.get(id!);
      setTeam(response.team);
      setEditName(response.team.name);
      setEditDescription(response.team.description || '');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load team');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await usersAPI.listAllUsers();
      // Handle paginated response - prefer legacy key, fall back to data array
      setAllUsers(response.users || (response as any).data || []);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    }
  };

  const handleSave = async () => {
    if (!team) return;

    try {
      setIsSaving(true);
      setError(null);

      await teamsAPI.update(team.id, {
        name: editName,
        description: editDescription || undefined,
      });

      setSuccess('Team updated successfully');
      setIsEditing(false);
      await loadTeam();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update team');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !selectedUserId) return;

    try {
      setIsAddingMember(true);
      setError(null);

      await teamsAPI.addMember(team.id, selectedUserId, selectedRole);

      setSuccess('Member added successfully');
      setShowAddMember(false);
      setSelectedUserId('');
      setSelectedRole('member');
      await loadTeam();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'manager' | 'member') => {
    if (!team) return;

    try {
      setError(null);
      await teamsAPI.updateMemberRole(team.id, userId, newRole);
      setSuccess('Role updated successfully');
      await loadTeam();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!team) return;
    if (!confirm(`Remove ${userName} from this team?`)) return;

    try {
      setError(null);
      await teamsAPI.removeMember(team.id, userId);
      setSuccess('Member removed successfully');
      await loadTeam();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  // Get users not already in team
  const availableUsers = allUsers.filter(
    user => !team?.members?.some(m => m.userId === user.id)
  );

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12 text-muted-foreground">Loading team...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Team Not Found</h2>
          <Link to="/teams">
            <Button variant="outline">Back to Teams</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/teams" className="text-muted-foreground hover:text-foreground">
              Teams
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{team.name}</span>
          </div>
          <h2 className="text-3xl font-bold mb-2">{team.name}</h2>
          {team.description && (
            <p className="text-muted-foreground">{team.description}</p>
          )}
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Cancel' : 'Edit Team'}
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 text-sm text-green-800 bg-green-50 dark:bg-green-900/20 dark:text-green-200 rounded-md">
          {success}
        </div>
      )}

      {/* Edit Form */}
      {isEditing && isAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Edit Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editName">Team Name</Label>
                  <Input
                    id="editName"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="editDescription">Description</Label>
                  <Input
                    id="editDescription"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              {isAdmin && (
                <Button size="sm" onClick={() => setShowAddMember(!showAddMember)}>
                  {showAddMember ? 'Cancel' : 'Add Member'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {/* Add Member Form */}
              {showAddMember && isAdmin && (
                <form onSubmit={handleAddMember} className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="selectUser">User</Label>
                      <Select
                        id="selectUser"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full"
                        required
                      >
                        <option value="">Select a user...</option>
                        {availableUsers.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.fullName} ({user.email})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="selectRole">Role</Label>
                      <Select
                        id="selectRole"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as 'manager' | 'member')}
                        className="w-full"
                      >
                        <option value="member">Member</option>
                        <option value="manager">Manager</option>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" size="sm" className="mt-4" disabled={isAddingMember || !selectedUserId}>
                    {isAddingMember ? 'Adding...' : 'Add to Team'}
                  </Button>
                </form>
              )}

              {/* Members List */}
              {!team.members || team.members.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No members yet</p>
              ) : (
                <div className="divide-y">
                  {team.members.map((member) => (
                    <div key={member.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-lg font-medium text-gray-600">
                            {member.user?.fullName?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{member.user?.fullName || 'Unknown User'}</div>
                          <div className="text-sm text-muted-foreground">{member.user?.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin ? (
                          <Select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.userId, e.target.value as 'manager' | 'member')}
                            className="w-28"
                          >
                            <option value="member">Member</option>
                            <option value="manager">Manager</option>
                          </Select>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            member.role === 'manager'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {member.role}
                          </span>
                        )}
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleRemoveMember(member.userId, member.user?.fullName || 'this user')}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resources */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Assigned Resources</CardTitle>
              <CardDescription>
                Resources owned by this team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Services */}
              <div>
                <h4 className="text-sm font-medium mb-2">Services</h4>
                {team.resources?.services && team.resources.services.length > 0 ? (
                  <ul className="space-y-1">
                    {team.resources.services.map(service => (
                      <li key={service.id}>
                        <Link
                          to={`/services`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {service.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No services assigned</p>
                )}
              </div>

              {/* Schedules */}
              <div>
                <h4 className="text-sm font-medium mb-2">Schedules</h4>
                {team.resources?.schedules && team.resources.schedules.length > 0 ? (
                  <ul className="space-y-1">
                    {team.resources.schedules.map(schedule => (
                      <li key={schedule.id}>
                        <Link
                          to={`/schedules/${schedule.id}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {schedule.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No schedules assigned</p>
                )}
              </div>

              {/* Escalation Policies */}
              <div>
                <h4 className="text-sm font-medium mb-2">Escalation Policies</h4>
                {team.resources?.escalationPolicies && team.resources.escalationPolicies.length > 0 ? (
                  <ul className="space-y-1">
                    {team.resources.escalationPolicies.map(policy => (
                      <li key={policy.id}>
                        <Link
                          to={`/escalation-policies`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {policy.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No policies assigned</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default TeamDetail;
