import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { tagsAPI } from '../lib/api-client';
import type { Tag, EntityType } from '../types/api';
import { useAuthStore } from '../store/auth-store';

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6b7280', // gray
  '#1f2937', // dark gray
];

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  service: 'Services',
  incident: 'Incidents',
  business_service: 'Business Services',
  schedule: 'Schedules',
  escalation_policy: 'Escalation Policies',
  runbook: 'Runbooks',
  user: 'Users',
  team: 'Teams',
};

export function Tags() {
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'admin';
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit modal state
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [editTagDescription, setEditTagDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Tag details state
  const [viewingTag, setViewingTag] = useState<Tag | null>(null);
  const [tagEntities, setTagEntities] = useState<Record<EntityType, string[]>>({} as Record<EntityType, string[]>);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);

  useEffect(() => {
    loadTags();
  }, [searchQuery]);

  const loadTags = async () => {
    try {
      setIsLoading(true);
      const params = searchQuery ? { search: searchQuery } : undefined;
      const response = await tagsAPI.list(params);
      setTags(response.tags);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load tags');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      setError(null);

      await tagsAPI.create({
        name: newTagName,
        color: newTagColor,
        description: newTagDescription || undefined,
      });

      setSuccess('Tag created successfully');
      setShowCreateForm(false);
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setNewTagDescription('');
      await loadTags();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create tag');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag) return;

    try {
      setIsUpdating(true);
      setError(null);

      await tagsAPI.update(editingTag.id, {
        name: editTagName,
        color: editTagColor,
        description: editTagDescription || undefined,
      });

      setSuccess('Tag updated successfully');
      setEditingTag(null);
      await loadTags();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update tag');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (tagId: string, tagName: string) => {
    if (!confirm(`Are you sure you want to delete "${tagName}"? This will remove it from all entities.`)) {
      return;
    }

    try {
      setError(null);
      await tagsAPI.delete(tagId);
      setSuccess('Tag deleted successfully');
      setTags(tags.filter(t => t.id !== tagId));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete tag');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setError(null);
      const response = await tagsAPI.seedDefaults();
      setSuccess(response.message);
      await loadTags();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to seed default tags');
    }
  };

  const openEditModal = (tag: Tag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setEditTagDescription(tag.description || '');
  };

  const viewTagDetails = async (tag: Tag) => {
    setViewingTag(tag);
    setIsLoadingEntities(true);
    try {
      const response = await tagsAPI.getEntitiesForTag(tag.id);
      setTagEntities(response.entities);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load tag usage');
    } finally {
      setIsLoadingEntities(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold mb-2">Tags</h2>
          <p className="text-muted-foreground">
            Organize and categorize resources with custom tags
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && tags.length === 0 && (
            <Button variant="outline" onClick={handleSeedDefaults}>
              Seed Default Tags
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? 'Cancel' : 'Create Tag'}
            </Button>
          )}
        </div>
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

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Create Form */}
      {showCreateForm && isAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Tag</CardTitle>
            <CardDescription>
              Add a new tag to categorize your resources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="tagName">Tag Name</Label>
                  <Input
                    id="tagName"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="e.g., Production"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tagColor">Color</Label>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTagColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          newTagColor === color ? 'border-gray-900 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="tagDescription">Description (Optional)</Label>
                  <Input
                    id="tagDescription"
                    value={newTagDescription}
                    onChange={(e) => setNewTagDescription(e.target.value)}
                    placeholder="What this tag represents..."
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create Tag'}
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Preview:</span>
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: newTagColor }}
                  >
                    {newTagName || 'Tag Name'}
                  </span>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tags List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading tags...</div>
      ) : tags.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Tags Yet</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-4">
              Tags help you organize and filter resources. Create your first tag or seed default tags to get started.
            </p>
            {isAdmin && (
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleSeedDefaults}>
                  Seed Default Tags
                </Button>
                <Button onClick={() => setShowCreateForm(true)}>
                  Create First Tag
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map((tag) => (
            <Card key={tag.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tag.usageCount} use{tag.usageCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {tag.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {tag.description}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => viewTagDetails(tag)}
                  >
                    View Usage
                  </Button>
                  {isAdmin && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(tag)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive hover:text-white"
                        onClick={() => handleDelete(tag.id, tag.name)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingTag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle>Edit Tag</CardTitle>
              <CardDescription>
                Update the tag details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="editTagName">Tag Name</Label>
                  <Input
                    id="editTagName"
                    value={editTagName}
                    onChange={(e) => setEditTagName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditTagColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          editTagColor === color ? 'border-gray-900 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="editTagDescription">Description (Optional)</Label>
                  <Input
                    id="editTagDescription"
                    value={editTagDescription}
                    onChange={(e) => setEditTagDescription(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Preview:</span>
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: editTagColor }}
                  >
                    {editTagName}
                  </span>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setEditingTag(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Usage Modal */}
      {viewingTag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: viewingTag.color }}
                  >
                    {viewingTag.name}
                  </span>
                  <CardTitle>Tag Usage</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setViewingTag(null)}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
              <CardDescription>
                This tag is applied to {viewingTag.usageCount} entit{viewingTag.usageCount !== 1 ? 'ies' : 'y'}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              {isLoadingEntities ? (
                <div className="text-center py-8 text-muted-foreground">Loading usage...</div>
              ) : (
                <div className="space-y-6">
                  {(Object.entries(tagEntities) as [EntityType, string[]][])
                    .filter(([, entityIds]) => entityIds.length > 0)
                    .map(([entityType, entityIds]) => (
                      <div key={entityType}>
                        <h4 className="font-medium text-sm text-muted-foreground mb-2">
                          {ENTITY_TYPE_LABELS[entityType]} ({entityIds.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {entityIds.map((entityId) => (
                            <span
                              key={entityId}
                              className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-sm font-mono text-xs"
                              title={entityId}
                            >
                              {entityId.slice(0, 8)}...
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  {Object.values(tagEntities).every(arr => arr.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">
                      This tag is not applied to any entities yet.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Tags;
