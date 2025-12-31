import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Navigation } from '../components/Navigation';
import { useAuthStore } from '../store/auth-store';

interface EscalationStep {
  id?: string;
  stepOrder: number;
  targetType: 'schedule' | 'users';
  scheduleId?: string;
  userIds?: string[];
  timeoutSeconds: number;
  schedule?: { id: string; name: string };
}

interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  steps: EscalationStep[];
  createdAt: string;
  updatedAt: string;
}

interface Schedule {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  email: string;
}

export function EscalationPolicies() {
  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<EscalationPolicy | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    steps: Array<{
      stepOrder: number;
      targetType: 'schedule' | 'users';
      scheduleId?: string;
      userIds?: string[];
      timeoutSeconds: number;
    }>;
  }>({
    name: '',
    description: '',
    steps: [
      { stepOrder: 1, targetType: 'schedule', scheduleId: '', timeoutSeconds: 300 }
    ]
  });

  const tokens = useAuthStore((state) => state.tokens);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    const fetchData = async () => {
      console.log('EscalationPolicies useEffect triggered');
      console.log('API_BASE:', API_BASE);
      console.log('tokens:', tokens);
      console.log('accessToken:', tokens?.accessToken);

      if (!tokens?.accessToken) {
        console.log('No access token found, skipping fetch');
        setLoading(false);
        return;
      }

      console.log('Fetching escalation policies, schedules, and users...');
      try {
        const [policiesRes, schedulesRes, usersRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/escalation-policies`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }),
          fetch(`${API_BASE}/api/v1/schedules`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }),
          fetch(`${API_BASE}/api/v1/users`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }),
        ]);

        console.log('Policies response status:', policiesRes.status);
        console.log('Schedules response status:', schedulesRes.status);
        console.log('Users response status:', usersRes.status);

        const [policiesData, schedulesData, usersData] = await Promise.all([
          policiesRes.json(),
          schedulesRes.json(),
          usersRes.json(),
        ]);

        console.log('Policies data:', policiesData);
        console.log('Schedules data:', schedulesData);
        console.log('Users data:', usersData);

        setPolicies(policiesData.policies || []);
        setSchedules(schedulesData.schedules || []);
        setUsers(usersData.users || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tokens?.accessToken, API_BASE]);

  const fetchPolicies = async () => {
    if (!tokens?.accessToken) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/escalation-policies`, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });
      const data = await response.json();
      setPolicies(data.policies || []);
    } catch (error) {
      console.error('Error fetching policies:', error);
    }
  };


  const handleStartEdit = (policy: EscalationPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      description: policy.description || '',
      steps: policy.steps.map(step => ({
        stepOrder: step.stepOrder,
        targetType: step.targetType,
        scheduleId: step.scheduleId,
        userIds: step.userIds,
        timeoutSeconds: step.timeoutSeconds,
      })),
    });
    setShowCreateForm(true);

    // Scroll to top to show the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tokens?.accessToken) {
      alert('Authentication required. Please log in again.');
      return;
    }

    // Validate form data
    if (!formData.name.trim()) {
      alert('Policy name is required');
      return;
    }

    for (let i = 0; i < formData.steps.length; i++) {
      const step = formData.steps[i] as EscalationStep;
      if (step.targetType === 'schedule' && !step.scheduleId) {
        alert(`Level ${i + 1}: Please select a schedule`);
        return;
      }
      if (step.targetType === 'users' && (!step.userIds || step.userIds.length === 0)) {
        alert(`Level ${i + 1}: Please select at least one user`);
        return;
      }
    }

    try {
      const url = editingPolicy
        ? `${API_BASE}/api/v1/escalation-policies/${editingPolicy.id}`
        : `${API_BASE}/api/v1/escalation-policies`;
      const method = editingPolicy ? 'PUT' : 'POST';

      console.log('Saving policy:', method, url);
      console.log('Form data:', JSON.stringify(formData, null, 2));

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowCreateForm(false);
        setEditingPolicy(null);
        setFormData({
          name: '',
          description: '',
          steps: [{ stepOrder: 1, targetType: 'schedule', scheduleId: '', timeoutSeconds: 300 }],
        });
        fetchPolicies();
      } else {
        const error = await response.json();
        console.error('Save error:', error);
        console.error('Full error details:', JSON.stringify(error, null, 2));
        if (error.errors && Array.isArray(error.errors)) {
          console.error('Validation errors:', error.errors);
          error.errors.forEach((err: any, idx: number) => {
            console.error(`Error ${idx + 1}:`, JSON.stringify(err, null, 2));
          });
        }
        alert(`Error: ${error.error || error.message || JSON.stringify(error) || 'Failed to save policy'}`);
      }
    } catch (error) {
      console.error('Error creating policy:', error);
      alert('Failed to create policy. Please check the console for details.');
    }
  };

  const handleDeletePolicy = async (id: string) => {
    if (!confirm('Are you sure you want to delete this escalation policy?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/escalation-policies/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });

      if (response.ok) {
        fetchPolicies();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to delete policy'}`);
      }
    } catch (error) {
      console.error('Error deleting policy:', error);
      alert('Failed to delete policy');
    }
  };

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [
        ...formData.steps,
        {
          stepOrder: formData.steps.length + 1,
          targetType: 'schedule',
          scheduleId: '',
          timeoutSeconds: 300,
        },
      ],
    });
  };

  const removeStep = (index: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index),
    });
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...formData.steps];
    const updatedStep = { ...newSteps[index], [field]: value };

    // When changing target type, initialize the appropriate fields
    if (field === 'targetType') {
      if (value === 'users') {
        updatedStep.userIds = updatedStep.userIds || [];
        updatedStep.scheduleId = undefined;
      } else if (value === 'schedule') {
        updatedStep.scheduleId = updatedStep.scheduleId || '';
        updatedStep.userIds = undefined;
      }
    }

    newSteps[index] = updatedStep;
    setFormData({ ...formData, steps: newSteps });
    console.log('Updated step:', updatedStep);
  };

  const getUserNamesByIds = (userIds: string[]) => {
    return userIds
      .map(id => users.find(u => u.id === id)?.fullName || 'Unknown User')
      .join(', ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto p-8">
          <p>Loading escalation policies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto max-w-6xl p-8">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" className="mb-4">← Back to Dashboard</Button>
        </Link>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Escalation Policies</h1>
            <p className="text-muted-foreground">Manage multi-level escalation workflows</p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>Create Policy</Button>
        </div>

        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingPolicy ? 'Edit' : 'Create'} Escalation Policy</CardTitle>
              <CardDescription>Define who gets notified and when if an incident isn't acknowledged</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePolicy} className="space-y-4">
                <div>
                  <Label htmlFor="name">Policy Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Escalation Levels</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    If the incident isn't acknowledged, it will escalate through these levels in order
                  </p>
                  {formData.steps.map((step, index) => (
                    <Card key={index} className="mb-4 mt-2">
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-sm">Level {index + 1}</CardTitle>
                          {formData.steps.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStep(index)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label>Notify</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={step.targetType}
                            onChange={(e) =>
                              updateStep(index, 'targetType', e.target.value as 'schedule' | 'users')
                            }
                          >
                            <option value="schedule">On-Call Schedule</option>
                            <option value="users">Specific User(s)</option>
                          </select>
                        </div>

                        {step.targetType === 'schedule' && (
                          <div>
                            <Label>Schedule</Label>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              value={step.scheduleId}
                              onChange={(e) => updateStep(index, 'scheduleId', e.target.value)}
                            >
                              <option value="">Select a schedule</option>
                              {schedules.map((schedule) => (
                                <option key={schedule.id} value={schedule.id}>
                                  {schedule.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {step.targetType === 'users' && (
                          <div>
                            <Label>Users</Label>
                            {users.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-2">Loading users...</p>
                            ) : (
                              <>
                                <select
                                  multiple
                                  size={5}
                                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  value={step.userIds || []}
                                  onChange={(e) => {
                                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                                    updateStep(index, 'userIds', selected);
                                  }}
                                >
                                  {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                      {user.fullName} ({user.email})
                                    </option>
                                  ))}
                                </select>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Hold Ctrl (Windows) or Cmd (Mac) to select multiple users
                                </p>
                              </>
                            )}
                          </div>
                        )}

                        <div>
                          <Label>Escalate after (minutes)</Label>
                          <Input
                            type="number"
                            value={Math.round(step.timeoutSeconds / 60)}
                            onChange={(e) =>
                              updateStep(index, 'timeoutSeconds', parseInt(e.target.value) * 60)
                            }
                            min={1}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            If not acknowledged, escalate to the next level after this time
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  <Button type="button" variant="outline" onClick={addStep} className="mt-2">
                    + Add Escalation Level
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button type="submit">{editingPolicy ? 'Save Changes' : 'Create Policy'}</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setEditingPolicy(null);
                      setFormData({
                        name: '',
                        description: '',
                        steps: [
                          { stepOrder: 1, targetType: 'schedule', scheduleId: '', timeoutSeconds: 300 },
                        ],
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {policies.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No escalation policies yet. Create one to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            policies
              .filter((policy) => !editingPolicy || policy.id !== editingPolicy.id)
              .map((policy) => (
              <Card key={policy.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{policy.name}</CardTitle>
                      <CardDescription>{policy.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEdit(policy)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePolicy(policy.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Escalation Levels:</p>
                    {policy.steps.map((step) => (
                      <div key={step.id} className="flex items-center gap-2 text-sm border-l-2 border-blue-500 pl-3 py-1">
                        <span className="font-medium">Level {step.stepOrder}:</span>
                        {step.targetType === 'schedule' ? (
                          <span>
                            Notify on-call from <strong>{step.schedule?.name || 'Unknown Schedule'}</strong>
                          </span>
                        ) : (
                          <span>
                            Notify <strong>{step.userIds && step.userIds.length > 0 ? getUserNamesByIds(step.userIds) : 'no users'}</strong>
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          → {Math.round(step.timeoutSeconds / 60)} min
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
