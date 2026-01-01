import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { postmortemsAPI, incidentsAPI } from '../lib/api-client';
import type { Postmortem, PostmortemActionItem, PostmortemTimelineEntry, Incident } from '../types/api';
import { Plus, Edit, Trash2, CheckSquare, Calendar, AlertTriangle, CheckCircle, XCircle, Clock, User, Eye } from 'lucide-react';

// Helper to generate UUIDs for action items
function generateId(): string {
  return 'item-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function Postmortems() {
  const [postmortems, setPostmortems] = useState<Postmortem[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'in_review' | 'published'>('all');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingPostmortem, setEditingPostmortem] = useState<Postmortem | null>(null);
  const [viewingPostmortem, setViewingPostmortem] = useState<Postmortem | null>(null);
  const [formData, setFormData] = useState({
    incidentId: '',
    title: '',
    summary: '',
    rootCause: '',
    impact: '',
    whatWentWell: '',
    whatCouldBeImproved: '',
    timeline: [] as PostmortemTimelineEntry[],
    actionItems: [] as PostmortemActionItem[],
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Postmortem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Publishing
  const [publishingId, setPublishingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [postmortemsRes, incidentsRes] = await Promise.all([
        postmortemsAPI.list(),
        incidentsAPI.list(),
      ]);
      setPostmortems(postmortemsRes.postmortems);
      setIncidents(incidentsRes.incidents.filter(i => i.state === 'resolved'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      incidentId: '',
      title: '',
      summary: '',
      rootCause: '',
      impact: '',
      whatWentWell: '',
      whatCouldBeImproved: '',
      timeline: [],
      actionItems: [],
    });
    setEditingPostmortem(null);
    setShowForm(false);
  };

  const handleStartEdit = (postmortem: Postmortem) => {
    setEditingPostmortem(postmortem);
    setFormData({
      incidentId: postmortem.incident_id,
      title: postmortem.title,
      summary: postmortem.summary || '',
      rootCause: postmortem.root_cause || '',
      impact: postmortem.impact || '',
      whatWentWell: postmortem.what_went_well || '',
      whatCouldBeImproved: postmortem.what_could_be_improved || '',
      timeline: postmortem.timeline || [],
      actionItems: postmortem.action_items || [],
    });
    setShowForm(true);
  };

  const handleStartCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleAddTimelineEntry = () => {
    const newEntry: PostmortemTimelineEntry = {
      timestamp: new Date().toISOString(),
      event: '',
      description: '',
    };
    setFormData({ ...formData, timeline: [...formData.timeline, newEntry] });
  };

  const handleUpdateTimelineEntry = (index: number, field: keyof PostmortemTimelineEntry, value: string) => {
    const newTimeline = [...formData.timeline];
    newTimeline[index] = { ...newTimeline[index], [field]: value };
    setFormData({ ...formData, timeline: newTimeline });
  };

  const handleRemoveTimelineEntry = (index: number) => {
    const newTimeline = formData.timeline.filter((_, i) => i !== index);
    setFormData({ ...formData, timeline: newTimeline });
  };

  const handleAddActionItem = () => {
    const newItem: PostmortemActionItem = {
      id: generateId(),
      description: '',
      completed: false,
    };
    setFormData({ ...formData, actionItems: [...formData.actionItems, newItem] });
  };

  const handleUpdateActionItem = (index: number, field: keyof PostmortemActionItem, value: any) => {
    const newItems = [...formData.actionItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, actionItems: newItems });
  };

  const handleRemoveActionItem = (index: number) => {
    const newItems = formData.actionItems.filter((_, i) => i !== index);
    setFormData({ ...formData, actionItems: newItems });
  };

  const handleToggleActionItem = (index: number) => {
    const newItems = [...formData.actionItems];
    const item = newItems[index];
    newItems[index] = {
      ...item,
      completed: !item.completed,
      completedAt: !item.completed ? new Date().toISOString() : undefined,
    };
    setFormData({ ...formData, actionItems: newItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingPostmortem && !formData.incidentId) {
      setError('Please select an incident');
      return;
    }

    if (!formData.title.trim()) {
      setError('Please enter a title');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const data = {
        incidentId: formData.incidentId,
        title: formData.title.trim(),
        summary: formData.summary.trim() || undefined,
        rootCause: formData.rootCause.trim() || undefined,
        impact: formData.impact.trim() || undefined,
        whatWentWell: formData.whatWentWell.trim() || undefined,
        whatCouldBeImproved: formData.whatCouldBeImproved.trim() || undefined,
        timeline: formData.timeline.filter(t => t.event.trim()),
        actionItems: formData.actionItems.filter(a => a.description.trim()),
      };

      if (editingPostmortem) {
        await postmortemsAPI.update(editingPostmortem.id, data);
        setSuccess('Postmortem updated successfully');
      } else {
        await postmortemsAPI.create(data);
        setSuccess('Postmortem created successfully');
      }

      resetForm();
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save postmortem');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (postmortem: Postmortem) => {
    try {
      setPublishingId(postmortem.id);
      await postmortemsAPI.publish(postmortem.id);
      setSuccess('Postmortem published successfully');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to publish postmortem');
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      setIsDeleting(true);
      await postmortemsAPI.delete(deleteConfirm.id);
      setSuccess('Postmortem deleted successfully');
      await loadData();
      setDeleteConfirm(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete postmortem');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const filteredPostmortems = postmortems.filter(pm => {
    if (filterStatus === 'all') return true;
    return pm.status === filterStatus;
  });

  // Find incidents without postmortems
  const availableIncidents = incidents.filter(
    incident => !postmortems.some(pm => pm.incident_id === incident.id)
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold mb-2">Postmortems</h2>
          <p className="text-muted-foreground">
            Document lessons learned and action items from resolved incidents
          </p>
        </div>
        <Button onClick={showForm ? resetForm : handleStartCreate}>
          {showForm ? 'Cancel' : <><Plus className="w-4 h-4 mr-2" />Create Postmortem</>}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </span>
          <button onClick={() => setError(null)} className="text-destructive hover:text-destructive/80">
            &times;
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 text-sm text-green-800 bg-green-50 dark:bg-green-900/20 dark:text-green-200 rounded-md flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </span>
          <button onClick={() => setSuccess(null)} className="text-green-800 dark:text-green-200 hover:opacity-80">
            &times;
          </button>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingPostmortem ? 'Edit Postmortem' : 'Create New Postmortem'}</CardTitle>
            <CardDescription>
              {editingPostmortem
                ? 'Update postmortem details and action items'
                : 'Document the incident retrospective and lessons learned'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="incidentId">Incident *</Label>
                  <select
                    id="incidentId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.incidentId}
                    onChange={(e) => {
                      setFormData({ ...formData, incidentId: e.target.value });
                      const selectedIncident = incidents.find(i => i.id === e.target.value);
                      if (selectedIncident && !editingPostmortem) {
                        setFormData({
                          ...formData,
                          incidentId: e.target.value,
                          title: `Postmortem: ${selectedIncident.summary}`,
                        });
                      }
                    }}
                    disabled={!!editingPostmortem}
                  >
                    <option value="">Select an incident...</option>
                    {availableIncidents.map((incident) => (
                      <option key={incident.id} value={incident.id}>
                        #{incident.incidentNumber} - {incident.summary}
                      </option>
                    ))}
                    {editingPostmortem && editingPostmortem.incident && (
                      <option value={editingPostmortem.incident_id}>
                        #{editingPostmortem.incident.incident_number} - {editingPostmortem.incident.summary}
                      </option>
                    )}
                  </select>
                </div>
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Postmortem: API Outage on 2025-01-15"
                  />
                </div>
              </div>

              {/* Summary */}
              <div>
                <Label htmlFor="summary">Executive Summary</Label>
                <textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="High-level overview of what happened and the impact"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                />
              </div>

              {/* Timeline */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Timeline</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddTimelineEntry}>
                    + Add Entry
                  </Button>
                </div>
                {formData.timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                    No timeline entries yet. Click "Add Entry" to document the incident timeline.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {formData.timeline.map((entry, index) => (
                      <div key={index} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <Input
                            type="datetime-local"
                            value={entry.timestamp.slice(0, 16)}
                            onChange={(e) => handleUpdateTimelineEntry(index, 'timestamp', new Date(e.target.value).toISOString())}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveTimelineEntry(index)}
                          >
                            &times;
                          </Button>
                        </div>
                        <Input
                          value={entry.event}
                          onChange={(e) => handleUpdateTimelineEntry(index, 'event', e.target.value)}
                          placeholder="Event (e.g., Alert triggered, Team notified)"
                        />
                        <Input
                          value={entry.description || ''}
                          onChange={(e) => handleUpdateTimelineEntry(index, 'description', e.target.value)}
                          placeholder="Description (optional)"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rootCause">Root Cause</Label>
                  <textarea
                    id="rootCause"
                    value={formData.rootCause}
                    onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
                    placeholder="What was the underlying cause of the incident?"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px]"
                  />
                </div>
                <div>
                  <Label htmlFor="impact">Impact</Label>
                  <textarea
                    id="impact"
                    value={formData.impact}
                    onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                    placeholder="What was the business and technical impact?"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px]"
                  />
                </div>
              </div>

              {/* Learnings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="whatWentWell">What Went Well</Label>
                  <textarea
                    id="whatWentWell"
                    value={formData.whatWentWell}
                    onChange={(e) => setFormData({ ...formData, whatWentWell: e.target.value })}
                    placeholder="What worked well during the incident response?"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px]"
                  />
                </div>
                <div>
                  <Label htmlFor="whatCouldBeImproved">What Could Be Improved</Label>
                  <textarea
                    id="whatCouldBeImproved"
                    value={formData.whatCouldBeImproved}
                    onChange={(e) => setFormData({ ...formData, whatCouldBeImproved: e.target.value })}
                    placeholder="What could we do better next time?"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px]"
                  />
                </div>
              </div>

              {/* Action Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Action Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddActionItem}>
                    + Add Action Item
                  </Button>
                </div>
                {formData.actionItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                    No action items yet. Click "Add Action Item" to track follow-up tasks.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {formData.actionItems.map((item, index) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => handleToggleActionItem(index)}
                            className="rounded"
                          />
                          <Input
                            value={item.description}
                            onChange={(e) => handleUpdateActionItem(index, 'description', e.target.value)}
                            placeholder="Action item description"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveActionItem(index)}
                          >
                            &times;
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pl-6">
                          <div>
                            <Label className="text-xs">Assigned To</Label>
                            <Input
                              value={item.assignedTo || ''}
                              onChange={(e) => handleUpdateActionItem(index, 'assignedTo', e.target.value)}
                              placeholder="Username or email"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Due Date</Label>
                            <Input
                              type="date"
                              value={item.dueDate ? item.dueDate.split('T')[0] : ''}
                              onChange={(e) => handleUpdateActionItem(index, 'dueDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingPostmortem ? 'Save Changes' : 'Create Postmortem'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-2 flex-wrap">
        <Button
          variant={filterStatus === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('all')}
        >
          All ({postmortems.length})
        </Button>
        <Button
          variant={filterStatus === 'draft' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('draft')}
        >
          Draft ({postmortems.filter(p => p.status === 'draft').length})
        </Button>
        <Button
          variant={filterStatus === 'in_review' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('in_review')}
        >
          In Review ({postmortems.filter(p => p.status === 'in_review').length})
        </Button>
        <Button
          variant={filterStatus === 'published' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('published')}
        >
          Published ({postmortems.filter(p => p.status === 'published').length})
        </Button>
      </div>

      {/* Postmortems List */}
      <Card>
        <CardHeader>
          <CardTitle>Postmortems</CardTitle>
          <CardDescription>
            {filteredPostmortems.length} postmortem{filteredPostmortems.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPostmortems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {filterStatus === 'all'
                ? 'No postmortems yet. Create one to document your incident retrospectives.'
                : `No ${filterStatus} postmortems.`}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredPostmortems.map((postmortem) => (
                <div
                  key={postmortem.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h4 className="font-medium">{postmortem.title}</h4>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            postmortem.status === 'published'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                              : postmortem.status === 'in_review'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                          }`}
                        >
                          {postmortem.status === 'in_review' ? 'In Review' : postmortem.status}
                        </span>
                      </div>
                      {postmortem.incident && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Incident #{postmortem.incident.incident_number}: {postmortem.incident.summary}
                          {postmortem.incident.service && ` (${postmortem.incident.service.name})`}
                        </p>
                      )}
                      {postmortem.summary && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {postmortem.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {postmortem.timeline.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {postmortem.timeline.length} timeline {postmortem.timeline.length === 1 ? 'entry' : 'entries'}
                          </span>
                        )}
                        {postmortem.action_items.length > 0 && (
                          <span className="flex items-center gap-1">
                            <CheckSquare className="w-3 h-3" />
                            {postmortem.action_items.filter(a => a.completed).length}/{postmortem.action_items.length} actions completed
                          </span>
                        )}
                        {postmortem.created_by && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {postmortem.created_by.full_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(postmortem.created_at)}
                        </span>
                        {postmortem.published_at && (
                          <span className="flex items-center gap-1">
                            Published {formatDate(postmortem.published_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingPostmortem(postmortem)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {(postmortem.status === 'draft' || postmortem.status === 'in_review') && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartEdit(postmortem)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handlePublish(postmortem)}
                            disabled={publishingId === postmortem.id}
                          >
                            {publishingId === postmortem.id ? 'Publishing...' : 'Publish'}
                          </Button>
                        </>
                      )}
                      {(postmortem.status === 'draft' || postmortem.status === 'in_review') && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteConfirm(postmortem)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Modal */}
      {viewingPostmortem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-4xl my-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>{viewingPostmortem.title}</CardTitle>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      viewingPostmortem.status === 'published'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                        : viewingPostmortem.status === 'in_review'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                    }`}
                  >
                    {viewingPostmortem.status === 'in_review' ? 'In Review' : viewingPostmortem.status}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setViewingPostmortem(null)}>
                  &times;
                </Button>
              </div>
              {viewingPostmortem.incident && (
                <CardDescription>
                  Incident #{viewingPostmortem.incident.incident_number}: {viewingPostmortem.incident.summary}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {viewingPostmortem.summary && (
                <div>
                  <h4 className="font-medium mb-2">Executive Summary</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingPostmortem.summary}</p>
                </div>
              )}

              {viewingPostmortem.timeline.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Timeline</h4>
                  <div className="space-y-2">
                    {viewingPostmortem.timeline.map((entry, index) => (
                      <div key={index} className="border-l-2 border-primary pl-4 py-1">
                        <div className="text-xs text-muted-foreground">{formatDate(entry.timestamp)}</div>
                        <div className="font-medium text-sm">{entry.event}</div>
                        {entry.description && (
                          <div className="text-sm text-muted-foreground">{entry.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {viewingPostmortem.root_cause && (
                  <div>
                    <h4 className="font-medium mb-2">Root Cause</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingPostmortem.root_cause}</p>
                  </div>
                )}
                {viewingPostmortem.impact && (
                  <div>
                    <h4 className="font-medium mb-2">Impact</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingPostmortem.impact}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {viewingPostmortem.what_went_well && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      What Went Well
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingPostmortem.what_went_well}</p>
                  </div>
                )}
                {viewingPostmortem.what_could_be_improved && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      What Could Be Improved
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingPostmortem.what_could_be_improved}</p>
                  </div>
                )}
              </div>

              {viewingPostmortem.action_items.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Action Items</h4>
                  <div className="space-y-2">
                    {viewingPostmortem.action_items.map((item) => (
                      <div key={item.id} className="flex items-start gap-2 p-2 border rounded">
                        {item.completed ? (
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {item.description}
                          </p>
                          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                            {item.assignedTo && <span>Assigned to: {item.assignedTo}</span>}
                            {item.dueDate && <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>}
                            {item.completedAt && <span>Completed: {formatDate(item.completedAt)}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-input text-xs text-muted-foreground">
                <div className="grid grid-cols-2 gap-2">
                  {viewingPostmortem.created_by && (
                    <div>Created by: {viewingPostmortem.created_by.full_name}</div>
                  )}
                  <div>Created: {formatDate(viewingPostmortem.created_at)}</div>
                  {viewingPostmortem.published_by && (
                    <div>Published by: {viewingPostmortem.published_by.full_name}</div>
                  )}
                  {viewingPostmortem.published_at && (
                    <div>Published: {formatDate(viewingPostmortem.published_at)}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-destructive">Delete Postmortem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete the postmortem "{deleteConfirm.title}"? This action cannot be undone.
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
