import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { runbooksAPI, servicesAPI } from '../lib/api-client';
import type { Runbook, RunbookStep, Service } from '../types/api';

// Simple UUID generator for step IDs
function generateId(): string {
  return 'step-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

const SEVERITY_OPTIONS = ['critical', 'error', 'warning', 'info'];

export function AdminRunbooks() {
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create/Edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingRunbook, setEditingRunbook] = useState<Runbook | null>(null);
  const [formData, setFormData] = useState({
    serviceId: '',
    title: '',
    description: '',
    externalUrl: '',
    severity: [] as string[],
    tags: [] as string[],
    steps: [] as RunbookStep[],
  });
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Runbook | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [runbooksRes, servicesRes] = await Promise.all([
        runbooksAPI.list(),
        servicesAPI.list(),
      ]);
      setRunbooks(runbooksRes.runbooks);
      setServices(servicesRes.services.filter(s => s.status === 'active'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      serviceId: '',
      title: '',
      description: '',
      externalUrl: '',
      severity: [],
      tags: [],
      steps: [],
    });
    setTagInput('');
    setEditingRunbook(null);
    setShowForm(false);
  };

  const handleStartEdit = (runbook: Runbook) => {
    setEditingRunbook(runbook);
    setFormData({
      serviceId: runbook.serviceId,
      title: runbook.title,
      description: runbook.description || '',
      externalUrl: runbook.externalUrl || '',
      severity: runbook.severity || [],
      tags: runbook.tags || [],
      steps: runbook.steps || [],
    });
    setShowForm(true);
  };

  const handleStartCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleAddStep = () => {
    const newStep: RunbookStep = {
      id: generateId(),
      order: formData.steps.length + 1,
      title: '',
      description: '',
      isOptional: false,
      estimatedMinutes: undefined,
    };
    setFormData({ ...formData, steps: [...formData.steps, newStep] });
  };

  const handleUpdateStep = (index: number, field: keyof RunbookStep, value: any) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData({ ...formData, steps: newSteps });
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = formData.steps.filter((_, i) => i !== index);
    // Reorder steps
    newSteps.forEach((step, i) => {
      step.order = i + 1;
    });
    setFormData({ ...formData, steps: newSteps });
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...formData.steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;

    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    // Reorder steps
    newSteps.forEach((step, i) => {
      step.order = i + 1;
    });
    setFormData({ ...formData, steps: newSteps });
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  const handleToggleSeverity = (severity: string) => {
    if (formData.severity.includes(severity)) {
      setFormData({ ...formData, severity: formData.severity.filter(s => s !== severity) });
    } else {
      setFormData({ ...formData, severity: [...formData.severity, severity] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.serviceId) {
      setError('Please select a service');
      return;
    }

    if (!formData.title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (formData.steps.length === 0) {
      setError('Please add at least one step');
      return;
    }

    // Validate steps
    for (const step of formData.steps) {
      if (!step.title.trim()) {
        setError('All steps must have a title');
        return;
      }
    }

    try {
      setIsSaving(true);
      setError(null);

      const data = {
        serviceId: formData.serviceId,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        externalUrl: formData.externalUrl.trim() || undefined,
        severity: formData.severity,
        tags: formData.tags,
        steps: formData.steps.map(step => ({
          ...step,
          title: step.title.trim(),
          description: step.description.trim(),
        })),
      };

      if (editingRunbook) {
        await runbooksAPI.update(editingRunbook.id, data);
        setSuccess('Runbook updated successfully');
      } else {
        await runbooksAPI.create(data);
        setSuccess('Runbook created successfully');
      }

      resetForm();
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save runbook');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      setIsDeleting(true);
      await runbooksAPI.delete(deleteConfirm.id);
      setRunbooks(runbooks.filter(r => r.id !== deleteConfirm.id));
      setSuccess('Runbook deleted successfully');
      setDeleteConfirm(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete runbook');
    } finally {
      setIsDeleting(false);
    }
  };

  // Group runbooks by service
  const runbooksByService = runbooks.reduce((acc, runbook) => {
    const serviceName = runbook.service?.name || 'Unknown Service';
    if (!acc[serviceName]) {
      acc[serviceName] = [];
    }
    acc[serviceName].push(runbook);
    return acc;
  }, {} as Record<string, Runbook[]>);

  return (
    <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold mb-2">Runbooks</h2>
            <p className="text-muted-foreground">
              Create and manage incident response runbooks for your services
            </p>
          </div>
          <Button onClick={showForm ? resetForm : handleStartCreate}>
            {showForm ? 'Cancel' : 'Create Runbook'}
          </Button>
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

        {/* Create/Edit Form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingRunbook ? 'Edit Runbook' : 'Create New Runbook'}</CardTitle>
              <CardDescription>
                {editingRunbook
                  ? 'Update the runbook configuration and steps'
                  : 'Define step-by-step procedures for incident response'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="serviceId">Service *</Label>
                    <select
                      id="serviceId"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={formData.serviceId}
                      onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                      disabled={!!editingRunbook}
                    >
                      <option value="">Select a service...</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., API Outage Response"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of when to use this runbook"
                  />
                </div>

                <div>
                  <Label htmlFor="externalUrl">External Documentation URL</Label>
                  <Input
                    id="externalUrl"
                    type="url"
                    value={formData.externalUrl}
                    onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value })}
                    placeholder="https://docs.example.com/runbooks/api-outage"
                  />
                </div>

                {/* Severity Filter */}
                <div>
                  <Label>Apply to Severity Levels</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Leave empty to apply to all severities
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SEVERITY_OPTIONS.map((severity) => (
                      <button
                        key={severity}
                        type="button"
                        onClick={() => handleToggleSeverity(severity)}
                        className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors ${
                          formData.severity.includes(severity)
                            ? severity === 'critical'
                              ? 'bg-red-600 text-white'
                              : severity === 'error'
                              ? 'bg-orange-600 text-white'
                              : severity === 'warning'
                              ? 'bg-yellow-600 text-white'
                              : 'bg-blue-600 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {severity}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <Label>Tags</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Add a tag and press Enter"
                    />
                    <Button type="button" variant="outline" onClick={handleAddTag}>
                      Add
                    </Button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-sm"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Steps */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label>Steps *</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddStep}>
                      + Add Step
                    </Button>
                  </div>

                  {formData.steps.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                      No steps yet. Click "Add Step" to create your first step.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {formData.steps.map((step, index) => (
                        <div
                          key={step.id}
                          className="border rounded-lg p-4 space-y-3 bg-muted/20"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">Step {index + 1}</span>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveStep(index, 'up')}
                                disabled={index === 0}
                              >
                                &uarr;
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveStep(index, 'down')}
                                disabled={index === formData.steps.length - 1}
                              >
                                &darr;
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleRemoveStep(index)}
                              >
                                &times;
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Title *</Label>
                              <Input
                                value={step.title}
                                onChange={(e) => handleUpdateStep(index, 'title', e.target.value)}
                                placeholder="e.g., Check logs"
                              />
                            </div>
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <Label className="text-xs">Est. Minutes</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={step.estimatedMinutes || ''}
                                  onChange={(e) =>
                                    handleUpdateStep(
                                      index,
                                      'estimatedMinutes',
                                      e.target.value ? parseInt(e.target.value) : undefined
                                    )
                                  }
                                  placeholder="5"
                                />
                              </div>
                              <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={step.isOptional}
                                    onChange={(e) =>
                                      handleUpdateStep(index, 'isOptional', e.target.checked)
                                    }
                                    className="rounded"
                                  />
                                  Optional
                                </label>
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs">Description</Label>
                            <textarea
                              value={step.description}
                              onChange={(e) => handleUpdateStep(index, 'description', e.target.value)}
                              placeholder="Detailed instructions for this step..."
                              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : editingRunbook ? 'Save Changes' : 'Create Runbook'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Runbooks List */}
        <Card>
          <CardHeader>
            <CardTitle>Runbooks</CardTitle>
            <CardDescription>
              {runbooks.length} runbook{runbooks.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading runbooks...</p>
            ) : runbooks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No runbooks yet. Create one to help your team respond to incidents consistently.
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(runbooksByService).map(([serviceName, serviceRunbooks]) => (
                  <div key={serviceName}>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                      </svg>
                      {serviceName}
                    </h3>
                    <div className="space-y-3 pl-7">
                      {serviceRunbooks.map((runbook) => (
                        <div
                          key={runbook.id}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-medium">{runbook.title}</h4>
                                {runbook.severity.length > 0 && (
                                  <div className="flex gap-1">
                                    {runbook.severity.map((sev) => (
                                      <span
                                        key={sev}
                                        className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${
                                          sev === 'critical'
                                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                                            : sev === 'error'
                                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200'
                                            : sev === 'warning'
                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                                        }`}
                                      >
                                        {sev}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {runbook.description && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {runbook.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{runbook.steps.length} steps</span>
                                {runbook.tags.length > 0 && (
                                  <span>Tags: {runbook.tags.join(', ')}</span>
                                )}
                                {runbook.externalUrl && (
                                  <a
                                    href={runbook.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    External docs &rarr;
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartEdit(runbook)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteConfirm(runbook)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-destructive">Delete Runbook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete the runbook "{deleteConfirm.title}"? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
