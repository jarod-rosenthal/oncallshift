import { useState, useEffect, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuthStore } from '../store/auth-store';

interface EscalationTarget {
  id: string;
  targetType: 'user' | 'schedule';
  userId?: string;
  user?: { id: string; fullName: string; email: string };
  scheduleId?: string;
  schedule?: { id: string; name: string };
}

interface EscalationStep {
  id?: string;
  stepOrder: number;
  targetType: 'schedule' | 'users';
  scheduleId?: string;
  userIds?: string[];
  timeoutSeconds: number;
  schedule?: { id: string; name: string };
  targets?: EscalationTarget[];
  // Resolved user info from backend
  resolvedOncallUser?: { id: string; fullName: string; email: string };
  resolvedUsers?: Array<{ id: string; fullName: string; email: string }>;
}

interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  repeatEnabled: boolean;
  repeatCount: number;
  steps: EscalationStep[];
  createdAt: string;
  updatedAt: string;
}

interface Schedule {
  id: string;
  name: string;
  currentOncallUser?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

interface User {
  id: string;
  fullName: string;
  email: string;
}

interface Service {
  id: string;
  name: string;
  escalationPolicyId?: string;
}

type SortOption = 'name-asc' | 'name-desc' | 'created-desc' | 'created-asc';

// Step Flow Preview Component - Horizontal visualization for list view
function StepFlowPreview({ steps }: { steps: EscalationStep[] }) {
  const getStepTargetSummary = (step: EscalationStep): string => {
    if (step.targets && step.targets.length > 0) {
      const names = step.targets.map(target => {
        if (target.targetType === 'user') {
          return target.user?.fullName || 'User';
        }
        return target.schedule?.name || 'Schedule';
      });
      return names.length > 2 ? `${names[0]} +${names.length - 1}` : names.join(', ');
    }

    if (step.targetType === 'schedule') {
      if (step.resolvedOncallUser) {
        return step.resolvedOncallUser.fullName;
      }
      return step.schedule?.name || 'On-call';
    }

    if (step.resolvedUsers && step.resolvedUsers.length > 0) {
      const names = step.resolvedUsers.map(u => u.fullName);
      return names.length > 2 ? `${names[0]} +${names.length - 1}` : names.join(', ');
    }

    return 'Users';
  };

  const formatTimeout = (seconds: number): string => {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {steps.map((step, idx) => (
        <div key={step.id || idx} className="flex items-center">
          {/* Step Box */}
          <div className="flex flex-col items-center min-w-[80px]">
            <div className="bg-primary/10 border border-primary/30 rounded-md px-3 py-2 text-center">
              <div className="text-xs font-semibold text-primary">Step {step.stepOrder}</div>
              <div className="text-xs text-muted-foreground">
                {idx < steps.length - 1 ? formatTimeout(step.timeoutSeconds) : 'Final'}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1 max-w-[100px] truncate text-center">
              {getStepTargetSummary(step)}
            </div>
          </div>
          {/* Arrow between steps */}
          {idx < steps.length - 1 && (
            <div className="flex items-center px-1 text-muted-foreground">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Step Editor Card - Vertical visualization for edit view
function StepEditorCard({
  step,
  index,
  isLast,
  schedules,
  users,
  onUpdate,
  onRemove,
  canRemove,
}: {
  step: {
    stepOrder: number;
    targetType: 'schedule' | 'users';
    scheduleId?: string;
    userIds?: string[];
    timeoutSeconds: number;
  };
  index: number;
  isLast: boolean;
  schedules: Schedule[];
  users: User[];
  onUpdate: (field: string, value: any) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const selectedSchedule = schedules.find(s => s.id === step.scheduleId);

  return (
    <div className="relative">
      {/* Step Card */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground text-sm font-bold px-3 py-1 rounded-md">
                STEP {index + 1}
              </div>
              {isLast && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  Final Step
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isLast && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Timeout:</Label>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    value={step.timeoutSeconds}
                    onChange={(e) => onUpdate('timeoutSeconds', parseInt(e.target.value))}
                  >
                    <option value={60}>1 min</option>
                    <option value={120}>2 min</option>
                    <option value={300}>5 min</option>
                    <option value={600}>10 min</option>
                    <option value={900}>15 min</option>
                    <option value={1800}>30 min</option>
                    <option value={3600}>1 hour</option>
                  </select>
                </div>
              )}
              {canRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={onRemove}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Notify:</Label>
            <select
              className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={step.targetType}
              onChange={(e) => onUpdate('targetType', e.target.value as 'schedule' | 'users')}
            >
              <option value="schedule">On-Call Schedule</option>
              <option value="users">Specific User(s)</option>
            </select>
          </div>

          {step.targetType === 'schedule' && (
            <div>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={step.scheduleId || ''}
                onChange={(e) => onUpdate('scheduleId', e.target.value)}
              >
                <option value="">Select a schedule</option>
                {schedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.name}
                  </option>
                ))}
              </select>
              {/* Currently on-call preview */}
              {selectedSchedule?.currentOncallUser && (
                <div className="mt-3 flex items-center gap-2 text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-medium">
                    {selectedSchedule.currentOncallUser.fullName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-green-800 dark:text-green-200">
                    Currently on-call: <strong>{selectedSchedule.currentOncallUser.fullName}</strong>
                  </span>
                </div>
              )}
              {selectedSchedule && !selectedSchedule.currentOncallUser && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  No one currently on-call for this schedule
                </p>
              )}
            </div>
          )}

          {step.targetType === 'users' && (
            <div>
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Loading users...</p>
              ) : (
                <>
                  <select
                    multiple
                    size={5}
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={step.userIds || []}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      onUpdate('userIds', selected);
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

          {!isLast && (
            <p className="text-xs text-muted-foreground italic">
              If not acknowledged after {Math.round(step.timeoutSeconds / 60)} minutes, escalate to Step {index + 2}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Connector to next step */}
      {!isLast && (
        <div className="flex justify-center py-2">
          <div className="flex flex-col items-center text-muted-foreground">
            <div className="w-0.5 h-4 bg-border"></div>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

export function EscalationPolicies() {
  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<EscalationPolicy | null>(null);

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    repeatEnabled: boolean;
    repeatCount: number;
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
    repeatEnabled: false,
    repeatCount: 0,
    steps: [
      { stepOrder: 1, targetType: 'schedule', scheduleId: '', timeoutSeconds: 300 }
    ]
  });

  const tokens = useAuthStore((state) => state.tokens);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Count services using each policy
  const getServiceCount = (policyId: string): number => {
    return services.filter(s => s.escalationPolicyId === policyId).length;
  };

  const getServicesUsingPolicy = (policyId: string): Service[] => {
    return services.filter(s => s.escalationPolicyId === policyId);
  };

  // Filter and sort policies
  const filteredAndSortedPolicies = useMemo(() => {
    let result = [...policies];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(policy =>
        policy.name.toLowerCase().includes(query) ||
        policy.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'created-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'created-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [policies, searchQuery, sortOption]);

  useEffect(() => {
    const fetchData = async () => {
      if (!tokens?.accessToken) {
        setLoading(false);
        return;
      }

      try {
        const [policiesRes, schedulesRes, usersRes, servicesRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/escalation-policies`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }),
          fetch(`${API_BASE}/api/v1/schedules`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }),
          fetch(`${API_BASE}/api/v1/users`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }),
          fetch(`${API_BASE}/api/v1/services`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }),
        ]);

        const [policiesData, schedulesData, usersData, servicesData] = await Promise.all([
          policiesRes.json(),
          schedulesRes.json(),
          usersRes.json(),
          servicesRes.json(),
        ]);

        setPolicies(policiesData.policies || []);
        setSchedules(schedulesData.schedules || []);
        setUsers(usersData.users || []);
        setServices(servicesData.services || []);
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
      repeatEnabled: policy.repeatEnabled || false,
      repeatCount: policy.repeatCount || 0,
      steps: policy.steps.map(step => ({
        stepOrder: step.stepOrder,
        targetType: step.targetType,
        scheduleId: step.scheduleId,
        userIds: step.userIds,
        timeoutSeconds: step.timeoutSeconds,
      })),
    });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartCreate = () => {
    setEditingPolicy(null);
    setFormData({
      name: '',
      description: '',
      repeatEnabled: false,
      repeatCount: 0,
      steps: [{ stepOrder: 1, targetType: 'schedule', scheduleId: '', timeoutSeconds: 300 }],
    });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingPolicy(null);
    setFormData({
      name: '',
      description: '',
      repeatEnabled: false,
      repeatCount: 0,
      steps: [{ stepOrder: 1, targetType: 'schedule', scheduleId: '', timeoutSeconds: 300 }],
    });
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tokens?.accessToken) {
      alert('Authentication required. Please log in again.');
      return;
    }

    if (!formData.name.trim()) {
      alert('Policy name is required');
      return;
    }

    for (let i = 0; i < formData.steps.length; i++) {
      const step = formData.steps[i] as EscalationStep;
      if (step.targetType === 'schedule' && !step.scheduleId) {
        alert(`Step ${i + 1}: Please select a schedule`);
        return;
      }
      if (step.targetType === 'users' && (!step.userIds || step.userIds.length === 0)) {
        alert(`Step ${i + 1}: Please select at least one user`);
        return;
      }
    }

    try {
      const url = editingPolicy
        ? `${API_BASE}/api/v1/escalation-policies/${editingPolicy.id}`
        : `${API_BASE}/api/v1/escalation-policies`;
      const method = editingPolicy ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        handleCancel();
        fetchPolicies();
      } else {
        const error = await response.json();
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
    const newSteps = formData.steps.filter((_, i) => i !== index);
    // Reorder remaining steps
    newSteps.forEach((step, i) => {
      step.stepOrder = i + 1;
    });
    setFormData({ ...formData, steps: newSteps });
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...formData.steps];
    const updatedStep = { ...newSteps[index], [field]: value };

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
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl py-8">
        <div className="flex items-center justify-center">
          <div className="text-muted-foreground">Loading escalation policies...</div>
        </div>
      </div>
    );
  }

  // Detail/Edit View
  if (showCreateForm) {
    return (
      <div className="container mx-auto max-w-4xl py-6">
        {/* Header with back button */}
        <div className="mb-6">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Policies
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">
                {editingPolicy ? 'Edit Escalation Policy' : 'Create Escalation Policy'}
              </h1>
              <p className="text-muted-foreground mt-1">
                Define who gets notified and when if an incident isn't acknowledged
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSavePolicy}>
                {editingPolicy ? 'Save Changes' : 'Create Policy'}
              </Button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSavePolicy} className="space-y-6">
          {/* Policy Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Policy Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Policy Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Infrastructure Escalation"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe when this policy should be used..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Escalation Steps */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Escalation Steps</h2>
            <div className="space-y-0">
              {formData.steps.map((step, index) => (
                <StepEditorCard
                  key={index}
                  step={step}
                  index={index}
                  isLast={index === formData.steps.length - 1}
                  schedules={schedules}
                  users={users}
                  onUpdate={(field, value) => updateStep(index, field, value)}
                  onRemove={() => removeStep(index)}
                  canRemove={formData.steps.length > 1}
                />
              ))}
            </div>

            <div className="flex justify-center mt-4">
              <Button type="button" variant="outline" onClick={addStep} className="gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Escalation Step
              </Button>
            </div>
          </div>

          {/* Services Using This Policy */}
          {editingPolicy && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Services Using This Policy ({getServiceCount(editingPolicy.id)})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {getServiceCount(editingPolicy.id) > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {getServicesUsingPolicy(editingPolicy.id).map(service => (
                      <span
                        key={service.id}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-muted"
                      >
                        {service.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No services are currently using this policy.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Repeat Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Repeat Settings</CardTitle>
              <CardDescription>
                What happens after all escalation steps have been exhausted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="repeatMode"
                    checked={!formData.repeatEnabled}
                    onChange={() => setFormData({ ...formData, repeatEnabled: false, repeatCount: 0 })}
                    className="mt-1 h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-medium">Stop escalating after all steps</span>
                    <p className="text-sm text-muted-foreground">
                      Incident remains triggered after all rules exhausted
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="repeatMode"
                    checked={formData.repeatEnabled && formData.repeatCount > 0}
                    onChange={() => setFormData({ ...formData, repeatEnabled: true, repeatCount: formData.repeatCount || 2 })}
                    className="mt-1 h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <span className="font-medium">Repeat</span>
                    {formData.repeatEnabled && formData.repeatCount > 0 && (
                      <span className="ml-2">
                        <Input
                          type="number"
                          min={1}
                          value={formData.repeatCount}
                          onChange={(e) => setFormData({ ...formData, repeatCount: parseInt(e.target.value) || 1 })}
                          className="w-16 h-7 inline-block mx-1 text-center"
                        />
                        <span className="text-sm">times, then stop</span>
                      </span>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Restart from Step 1 after all rules exhausted
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="repeatMode"
                    checked={formData.repeatEnabled && formData.repeatCount === 0}
                    onChange={() => setFormData({ ...formData, repeatEnabled: true, repeatCount: 0 })}
                    className="mt-1 h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-medium">Repeat until acknowledged</span>
                    <p className="text-sm text-muted-foreground">
                      Keep escalating indefinitely until someone responds
                    </p>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons (bottom) */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {editingPolicy && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this policy?')) {
                    handleDeletePolicy(editingPolicy.id);
                    handleCancel();
                  }
                }}
                className="mr-auto"
              >
                Delete Policy
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {editingPolicy ? 'Save Changes' : 'Create Policy'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // List View
  return (
    <div className="container mx-auto max-w-6xl py-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">Escalation Policies</h1>
          <p className="text-muted-foreground mt-1">
            Define how incidents escalate through your team
          </p>
        </div>
        <Button onClick={handleStartCreate} className="gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Policy
        </Button>
      </div>

      {/* Search and Sort Bar */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Input
            placeholder="Search policies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[160px]"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
        >
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="created-desc">Newest First</option>
          <option value="created-asc">Oldest First</option>
        </select>
      </div>

      {/* Policy Cards */}
      <div className="space-y-4">
        {filteredAndSortedPolicies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              {searchQuery ? (
                <div>
                  <p className="text-muted-foreground mb-2">
                    No policies found matching "{searchQuery}"
                  </p>
                  <Button variant="link" onClick={() => setSearchQuery('')}>
                    Clear search
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium mb-1">No escalation policies yet</p>
                  <p className="text-muted-foreground mb-4">
                    Create your first policy to define how incidents escalate through your team.
                  </p>
                  <Button onClick={handleStartCreate}>Create Policy</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredAndSortedPolicies
            .filter((policy) => !editingPolicy || policy.id !== editingPolicy.id)
            .map((policy) => (
              <Card key={policy.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-xl">{policy.name}</CardTitle>
                      {policy.description && (
                        <CardDescription className="mt-1">{policy.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEdit(policy)}
                      >
                        Edit
                      </Button>
                      <div className="relative group">
                        <Button variant="ghost" size="sm" className="px-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </Button>
                        <div className="absolute right-0 top-full mt-1 bg-popover border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          <button
                            onClick={() => handleDeletePolicy(policy.id)}
                            className="px-4 py-2 text-sm text-destructive hover:bg-muted w-full text-left whitespace-nowrap"
                          >
                            Delete Policy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Step Flow Preview */}
                  <div className="mb-4">
                    <StepFlowPreview steps={policy.steps} />
                  </div>

                  {/* Footer info */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground pt-3 border-t">
                    <div className="flex items-center gap-4">
                      <span>
                        {policy.steps.length} step{policy.steps.length !== 1 ? 's' : ''}
                      </span>
                      <span>
                        {policy.repeatEnabled
                          ? policy.repeatCount === 0
                            ? 'Repeats indefinitely'
                            : `Repeats ${policy.repeatCount}x`
                          : 'No repeat'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span>Used by {getServiceCount(policy.id)} service{getServiceCount(policy.id) !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </div>
    </div>
  );
}
