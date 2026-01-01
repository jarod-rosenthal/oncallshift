import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import api from '../lib/api-client';
import { Plus, Edit, Trash2, ChevronUp, ChevronDown, X, Copy, AlertTriangle } from 'lucide-react';

// Types
interface WorkflowCondition {
  field: string;
  operator: string;
  value: string | string[] | number | boolean | null;
}

interface WorkflowAction {
  id?: string;
  actionOrder: number;
  actionType: string;
  config: any;
  conditionField?: string | null;
  conditionOperator?: string | null;
  conditionValue?: string | null;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggerType: 'manual' | 'automatic';
  triggerEvents: string[];
  matchType: 'all' | 'any';
  conditions: WorkflowCondition[];
  serviceIds: string[] | null;
  teamIds: string[] | null;
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    fullName: string;
  };
}

interface WorkflowOptions {
  services: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  schedules: { id: string; name: string }[];
  users: { id: string; fullName: string; email: string }[];
  actionTypes: { type: string; label: string; description: string }[];
  triggerEvents: { event: string; label: string }[];
  conditionFields: { field: string; label: string; type: string; options?: string[] }[];
}

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'in', label: 'In' },
  { value: 'not_in', label: 'Not In' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
];

export function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [options, setOptions] = useState<WorkflowOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
    triggerType: 'manual' as 'manual' | 'automatic',
    triggerEvents: [] as string[],
    matchType: 'all' as 'all' | 'any',
    conditions: [] as WorkflowCondition[],
    serviceIds: null as string[] | null,
    teamIds: null as string[] | null,
    actions: [] as WorkflowAction[],
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Workflow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [workflowsRes, optionsRes] = await Promise.all([
        api.get('/workflows'),
        api.get('/workflows/available-options'),
      ]);
      setWorkflows(workflowsRes.data.workflows);
      setOptions(optionsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      enabled: true,
      triggerType: 'manual',
      triggerEvents: [],
      matchType: 'all',
      conditions: [],
      serviceIds: null,
      teamIds: null,
      actions: [],
    });
    setEditingWorkflow(null);
    setShowForm(false);
  };

  const handleStartEdit = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setFormData({
      name: workflow.name,
      description: workflow.description || '',
      enabled: workflow.enabled,
      triggerType: workflow.triggerType,
      triggerEvents: workflow.triggerEvents || [],
      matchType: workflow.matchType,
      conditions: workflow.conditions || [],
      serviceIds: workflow.serviceIds,
      teamIds: workflow.teamIds,
      actions: workflow.actions || [],
    });
    setShowForm(true);
  };

  const handleStartCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleToggleTriggerEvent = (event: string) => {
    if (formData.triggerEvents.includes(event)) {
      setFormData({ ...formData, triggerEvents: formData.triggerEvents.filter(e => e !== event) });
    } else {
      setFormData({ ...formData, triggerEvents: [...formData.triggerEvents, event] });
    }
  };

  const handleAddCondition = () => {
    setFormData({
      ...formData,
      conditions: [...formData.conditions, { field: 'severity', operator: 'equals', value: '' }],
    });
  };

  const handleUpdateCondition = (index: number, field: keyof WorkflowCondition, value: any) => {
    const newConditions = [...formData.conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setFormData({ ...formData, conditions: newConditions });
  };

  const handleRemoveCondition = (index: number) => {
    setFormData({ ...formData, conditions: formData.conditions.filter((_, i) => i !== index) });
  };

  const handleAddAction = () => {
    setFormData({
      ...formData,
      actions: [
        ...formData.actions,
        {
          actionOrder: formData.actions.length,
          actionType: 'add_responders',
          config: {},
        },
      ],
    });
  };

  const handleUpdateAction = (index: number, updates: Partial<WorkflowAction>) => {
    const newActions = [...formData.actions];
    newActions[index] = { ...newActions[index], ...updates };
    setFormData({ ...formData, actions: newActions });
  };

  const handleRemoveAction = (index: number) => {
    const newActions = formData.actions.filter((_, i) => i !== index);
    newActions.forEach((action, i) => {
      action.actionOrder = i;
    });
    setFormData({ ...formData, actions: newActions });
  };

  const handleMoveAction = (index: number, direction: 'up' | 'down') => {
    const newActions = [...formData.actions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newActions.length) return;

    [newActions[index], newActions[targetIndex]] = [newActions[targetIndex], newActions[index]];
    newActions.forEach((action, i) => {
      action.actionOrder = i;
    });
    setFormData({ ...formData, actions: newActions });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingWorkflow) {
        await api.put(`/workflows/${editingWorkflow.id}`, formData);
        setSuccess('Workflow updated successfully');
      } else {
        await api.post('/workflows', formData);
        setSuccess('Workflow created successfully');
      }
      await loadData();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (workflow: Workflow) => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/workflows/${workflow.id}`);
      setSuccess('Workflow deleted successfully');
      setDeleteConfirm(null);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete workflow');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleEnabled = async (workflow: Workflow) => {
    try {
      await api.put(`/workflows/${workflow.id}`, { enabled: !workflow.enabled });
      await loadData();
      setSuccess(`Workflow ${workflow.enabled ? 'disabled' : 'enabled'} successfully`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update workflow');
    }
  };

  const handleDuplicate = (workflow: Workflow) => {
    setFormData({
      name: `${workflow.name} (Copy)`,
      description: workflow.description || '',
      enabled: false,
      triggerType: workflow.triggerType,
      triggerEvents: workflow.triggerEvents || [],
      matchType: workflow.matchType,
      conditions: workflow.conditions || [],
      serviceIds: workflow.serviceIds,
      teamIds: workflow.teamIds,
      actions: workflow.actions.map(a => ({ ...a, id: undefined })),
    });
    setShowForm(true);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <p>Loading workflows...</p>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>{editingWorkflow ? 'Edit Workflow' : 'Create Workflow'}</CardTitle>
              <CardDescription>
                {editingWorkflow
                  ? 'Update workflow configuration and actions'
                  : 'Create an automated workflow to respond to incidents'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Add responders for critical incidents"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                      rows={2}
                      placeholder="Describe what this workflow does..."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="enabled" className="!mb-0">Enabled</Label>
                  </div>
                </div>

                {/* Trigger Type */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Trigger</h3>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.triggerType === 'manual'}
                        onChange={() => setFormData({ ...formData, triggerType: 'manual', triggerEvents: [] })}
                      />
                      <span>Manual (run manually on incidents)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.triggerType === 'automatic'}
                        onChange={() => setFormData({ ...formData, triggerType: 'automatic' })}
                      />
                      <span>Automatic (trigger on events)</span>
                    </label>
                  </div>

                  {formData.triggerType === 'automatic' && (
                    <div>
                      <Label>Trigger Events *</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {options?.triggerEvents.map((event) => (
                          <label key={event.event} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.triggerEvents.includes(event.event)}
                              onChange={() => handleToggleTriggerEvent(event.event)}
                            />
                            <span className="text-sm">{event.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Conditions */}
                {formData.triggerType === 'automatic' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Conditions</h3>
                      <Button type="button" onClick={handleAddCondition} variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-1" /> Add Condition
                      </Button>
                    </div>

                    {formData.conditions.length > 0 && (
                      <>
                        <div className="flex gap-2 items-center text-sm">
                          <span>Match</span>
                          <select
                            value={formData.matchType}
                            onChange={(e) => setFormData({ ...formData, matchType: e.target.value as 'all' | 'any' })}
                            className="px-2 py-1 border rounded"
                          >
                            <option value="all">All</option>
                            <option value="any">Any</option>
                          </select>
                          <span>of the following:</span>
                        </div>

                        <div className="space-y-2">
                          {formData.conditions.map((condition, index) => (
                            <div key={index} className="flex gap-2 items-start p-3 border rounded">
                              <select
                                value={condition.field}
                                onChange={(e) => handleUpdateCondition(index, 'field', e.target.value)}
                                className="px-2 py-1 border rounded flex-1"
                              >
                                {options?.conditionFields.map((field) => (
                                  <option key={field.field} value={field.field}>{field.label}</option>
                                ))}
                              </select>

                              <select
                                value={condition.operator}
                                onChange={(e) => handleUpdateCondition(index, 'operator', e.target.value)}
                                className="px-2 py-1 border rounded flex-1"
                              >
                                {CONDITION_OPERATORS.map((op) => (
                                  <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                              </select>

                              <Input
                                value={String(condition.value || '')}
                                onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                                placeholder="Value"
                                className="flex-1"
                              />

                              <Button
                                type="button"
                                onClick={() => handleRemoveCondition(index)}
                                variant="outline"
                                size="sm"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Service/Team Filters */}
                {formData.triggerType === 'automatic' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Filters (Optional)</h3>

                    <div>
                      <Label>Services</Label>
                      <select
                        multiple
                        value={formData.serviceIds || []}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setFormData({ ...formData, serviceIds: selected.length > 0 ? selected : null });
                        }}
                        className="w-full px-3 py-2 border rounded"
                        size={4}
                      >
                        {options?.services.map((service) => (
                          <option key={service.id} value={service.id}>{service.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                    </div>

                    <div>
                      <Label>Teams</Label>
                      <select
                        multiple
                        value={formData.teamIds || []}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setFormData({ ...formData, teamIds: selected.length > 0 ? selected : null });
                        }}
                        className="w-full px-3 py-2 border rounded"
                        size={4}
                      >
                        {options?.teams.map((team) => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Actions *</h3>
                    <Button type="button" onClick={handleAddAction} variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-1" /> Add Action
                    </Button>
                  </div>

                  {formData.actions.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                      <p className="text-sm text-gray-500">No actions configured. Add at least one action.</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {formData.actions.map((action, index) => (
                      <ActionBuilder
                        key={index}
                        action={action}
                        index={index}
                        options={options}
                        onUpdate={(updates) => handleUpdateAction(index, updates)}
                        onRemove={() => handleRemoveAction(index)}
                        onMoveUp={index > 0 ? () => handleMoveAction(index, 'up') : undefined}
                        onMoveDown={index < formData.actions.length - 1 ? () => handleMoveAction(index, 'down') : undefined}
                      />
                    ))}
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button type="submit" disabled={isSaving || formData.actions.length === 0}>
                    {isSaving ? 'Saving...' : editingWorkflow ? 'Update Workflow' : 'Create Workflow'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Incident Workflows</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Automate incident response with workflows (Response Plays)
          </p>
        </div>
        <Button onClick={handleStartCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No workflows configured yet. Create your first workflow to automate incident response.
            </p>
            <Button onClick={handleStartCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className={!workflow.enabled ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{workflow.name}</CardTitle>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          workflow.enabled
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {workflow.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          workflow.triggerType === 'automatic'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        }`}
                      >
                        {workflow.triggerType === 'automatic' ? 'Automatic' : 'Manual'}
                      </span>
                    </div>
                    {workflow.description && (
                      <CardDescription className="mt-1">{workflow.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleEnabled(workflow)}
                      title={workflow.enabled ? 'Disable' : 'Enable'}
                    >
                      {workflow.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicate(workflow)}
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartEdit(workflow)}
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirm(workflow)}
                      title="Delete"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {workflow.triggerType === 'automatic' && (
                    <div>
                      <span className="font-semibold">Triggers on: </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {workflow.triggerEvents.map(e => e.replace('incident.', '')).join(', ')}
                      </span>
                    </div>
                  )}

                  {workflow.conditions && workflow.conditions.length > 0 && (
                    <div>
                      <span className="font-semibold">Conditions: </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        Match {workflow.matchType} of {workflow.conditions.length} condition(s)
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="font-semibold">Actions: </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {workflow.actions.length} action(s)
                    </span>
                  </div>

                  {workflow.createdBy && (
                    <div className="text-xs text-gray-500">
                      Created by {workflow.createdBy.fullName}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Delete Workflow</CardTitle>
              <CardDescription>
                Are you sure you want to delete "{deleteConfirm.name}"? This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Workflow'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Action Builder Component
interface ActionBuilderProps {
  action: WorkflowAction;
  index: number;
  options: WorkflowOptions | null;
  onUpdate: (updates: Partial<WorkflowAction>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function ActionBuilder({ action, index, options, onUpdate, onRemove, onMoveUp, onMoveDown }: ActionBuilderProps) {
  const actionType = options?.actionTypes.find(at => at.type === action.actionType);

  const handleConfigChange = (key: string, value: any) => {
    onUpdate({ config: { ...action.config, [key]: value } });
  };

  const renderConfigFields = () => {
    switch (action.actionType) {
      case 'add_responders':
        return (
          <div>
            <Label className="text-xs">Users *</Label>
            <select
              multiple
              value={action.config.userIds || []}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                handleConfigChange('userIds', selected);
              }}
              className="w-full px-2 py-1 border rounded text-sm"
              size={3}
              required
            >
              {options?.users.map((user) => (
                <option key={user.id} value={user.id}>{user.fullName} ({user.email})</option>
              ))}
            </select>
            <Input
              value={action.config.message || ''}
              onChange={(e) => handleConfigChange('message', e.target.value)}
              placeholder="Optional message"
              className="mt-2 text-sm"
            />
          </div>
        );

      case 'add_on_call':
        return (
          <div>
            <Label className="text-xs">Schedules *</Label>
            <select
              multiple
              value={action.config.scheduleIds || []}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                handleConfigChange('scheduleIds', selected);
              }}
              className="w-full px-2 py-1 border rounded text-sm"
              size={3}
              required
            >
              {options?.schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>{schedule.name}</option>
              ))}
            </select>
          </div>
        );

      case 'set_conference_bridge':
        return (
          <div className="space-y-2">
            <Input
              value={action.config.url || ''}
              onChange={(e) => handleConfigChange('url', e.target.value)}
              placeholder="Conference URL *"
              className="text-sm"
              required
            />
            <Input
              value={action.config.meetingId || ''}
              onChange={(e) => handleConfigChange('meetingId', e.target.value)}
              placeholder="Meeting ID (optional)"
              className="text-sm"
            />
          </div>
        );

      case 'add_note':
        return (
          <textarea
            value={action.config.noteTemplate || ''}
            onChange={(e) => handleConfigChange('noteTemplate', e.target.value)}
            placeholder="Note content (use {{incident.field}} for placeholders) *"
            className="w-full px-2 py-1 border rounded text-sm"
            rows={2}
            required
          />
        );

      case 'webhook':
        return (
          <div className="space-y-2">
            <Input
              value={action.config.url || ''}
              onChange={(e) => handleConfigChange('url', e.target.value)}
              placeholder="Webhook URL *"
              className="text-sm"
              required
            />
            <select
              value={action.config.method || 'POST'}
              onChange={(e) => handleConfigChange('method', e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
            </select>
          </div>
        );

      default:
        return (
          <div className="text-xs text-gray-500">
            Configure {actionType?.label || action.actionType}
          </div>
        );
    }
  };

  return (
    <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1">
          {onMoveUp && (
            <Button type="button" variant="outline" size="sm" onClick={onMoveUp} className="p-1 h-6 w-6">
              <ChevronUp className="w-3 h-3" />
            </Button>
          )}
          {onMoveDown && (
            <Button type="button" variant="outline" size="sm" onClick={onMoveDown} className="p-1 h-6 w-6">
              <ChevronDown className="w-3 h-3" />
            </Button>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">#{index + 1}</span>
            <select
              value={action.actionType}
              onChange={(e) => onUpdate({ actionType: e.target.value, config: {} })}
              className="flex-1 px-2 py-1 border rounded text-sm"
            >
              {options?.actionTypes.map((at) => (
                <option key={at.type} value={at.type}>{at.label}</option>
              ))}
            </select>
          </div>

          {renderConfigFields()}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={onRemove} className="mt-1">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
