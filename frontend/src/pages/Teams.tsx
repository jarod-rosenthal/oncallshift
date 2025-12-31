import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { teamsAPI, type Team } from '../lib/api-client';
import { useAuthStore } from '../store/auth-store';

export function Teams() {
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'admin';
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      setIsLoading(true);
      const response = await teamsAPI.list();
      setTeams(response.teams);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      setError(null);

      await teamsAPI.create({
        name: newTeamName,
        description: newTeamDescription || undefined,
      });

      setSuccess('Team created successfully');
      setShowCreateForm(false);
      setNewTeamName('');
      setNewTeamDescription('');
      await loadTeams();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create team');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete "${teamName}"? This cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await teamsAPI.delete(teamId);
      setSuccess('Team deleted successfully');
      setTeams(teams.filter(t => t.id !== teamId));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete team');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold mb-2">Teams</h2>
          <p className="text-muted-foreground">
            Organize users and resources into teams
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Cancel' : 'Create Team'}
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

      {/* Create Form */}
      {showCreateForm && isAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Team</CardTitle>
            <CardDescription>
              Add a new team to organize users and resources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="teamName">Team Name</Label>
                  <Input
                    id="teamName"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="e.g., Platform Engineering"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="teamDescription">Description (Optional)</Label>
                  <Input
                    id="teamDescription"
                    value={newTeamDescription}
                    onChange={(e) => setNewTeamDescription(e.target.value)}
                    placeholder="Team responsibilities..."
                  />
                </div>
              </div>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Team'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Teams List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading teams...</div>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Teams Yet</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-4">
              Teams help organize users and resources. Create your first team to get started.
            </p>
            {isAdmin && (
              <Button onClick={() => setShowCreateForm(true)}>
                Create First Team
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <Card key={team.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    {team.description && (
                      <CardDescription className="mt-1">{team.description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>{team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</span>
                  </div>

                  {team.members && team.members.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {team.members.slice(0, 3).map((member) => (
                        <span
                          key={member.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700"
                          title={member.user?.email || ''}
                        >
                          {member.user?.fullName || 'Unknown'}
                          {member.role === 'manager' && (
                            <svg className="w-3 h-3 ml-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                      ))}
                      {team.memberCount > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                          +{team.memberCount - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Link to={`/teams/${team.id}`} className="flex-1">
                      <Button variant="outline" className="w-full" size="sm">
                        View Details
                      </Button>
                    </Link>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive hover:text-white"
                        onClick={() => handleDelete(team.id, team.name)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default Teams;
