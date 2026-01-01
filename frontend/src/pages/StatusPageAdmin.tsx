import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe,
  Lock,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Users,
  Eye,
  EyeOff,
  Copy,
  Check,
  MessageSquare,
  Send,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { statusPagesAPI, servicesAPI } from '../lib/api-client';
import type {
  StatusPage,
  CreateStatusPageRequest,
  UpdateStatusPageRequest,
  StatusPageSubscriber,
  CreateStatusUpdateRequest,
} from '../lib/api-client';
import type { Service } from '../types/api';
import { showToast } from '../components/Toast';

export function StatusPageAdmin() {
  const [statusPages, setStatusPages] = useState<StatusPage[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPage, setEditingPage] = useState<StatusPage | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formVisibility, setFormVisibility] = useState<'internal' | 'public'>('internal');
  const [formPrimaryColor, setFormPrimaryColor] = useState('#007bff');
  const [formShowUptimeHistory, setFormShowUptimeHistory] = useState(true);
  const [formUptimeHistoryDays, setFormUptimeHistoryDays] = useState(90);
  const [formAllowSubscriptions, setFormAllowSubscriptions] = useState(true);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formServiceIds, setFormServiceIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Status update state
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedPageForUpdate, setSelectedPageForUpdate] = useState<StatusPage | null>(null);
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'investigating' | 'identified' | 'monitoring' | 'resolved'>('investigating');
  const [updateSeverity, setUpdateSeverity] = useState<'none' | 'minor' | 'major' | 'critical'>('none');
  const [postingUpdate, setPostingUpdate] = useState(false);

  // Subscriber state
  const [showSubscribersModal, setShowSubscribersModal] = useState(false);
  const [selectedPageForSubscribers, setSelectedPageForSubscribers] = useState<StatusPage | null>(null);
  const [subscribers, setSubscribers] = useState<StatusPageSubscriber[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pagesData, servicesData] = await Promise.all([
        statusPagesAPI.list(),
        servicesAPI.list(),
      ]);
      setStatusPages(pagesData.statusPages);
      setServices(servicesData.services);
      setError(null);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load status pages');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormVisibility('internal');
    setFormPrimaryColor('#007bff');
    setFormShowUptimeHistory(true);
    setFormUptimeHistoryDays(90);
    setFormAllowSubscriptions(true);
    setFormEnabled(true);
    setFormServiceIds([]);
    setEditingPage(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (page: StatusPage) => {
    setFormName(page.name);
    setFormSlug(page.slug);
    setFormDescription(page.description || '');
    setFormVisibility(page.visibility);
    setFormPrimaryColor(page.primaryColor);
    setFormShowUptimeHistory(page.showUptimeHistory);
    setFormUptimeHistoryDays(page.uptimeHistoryDays);
    setFormAllowSubscriptions(page.allowSubscriptions);
    setFormEnabled(page.enabled);
    setFormServiceIds(page.services.map(s => s.id));
    setEditingPage(page);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingPage) {
      setFormSlug(generateSlug(name));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) return;

    try {
      setSubmitting(true);

      if (editingPage) {
        const updateData: UpdateStatusPageRequest = {
          name: formName,
          slug: formSlug,
          description: formDescription || undefined,
          visibility: formVisibility,
          primaryColor: formPrimaryColor,
          showUptimeHistory: formShowUptimeHistory,
          uptimeHistoryDays: formUptimeHistoryDays,
          allowSubscriptions: formAllowSubscriptions,
          enabled: formEnabled,
          serviceIds: formServiceIds,
        };
        await statusPagesAPI.update(editingPage.id, updateData);
        showToast.success('Status page updated');
      } else {
        const createData: CreateStatusPageRequest = {
          name: formName,
          slug: formSlug,
          description: formDescription || undefined,
          visibility: formVisibility,
          primaryColor: formPrimaryColor,
          showUptimeHistory: formShowUptimeHistory,
          uptimeHistoryDays: formUptimeHistoryDays,
          allowSubscriptions: formAllowSubscriptions,
          serviceIds: formServiceIds,
        };
        await statusPagesAPI.create(createData);
        showToast.success('Status page created');
      }

      closeModal();
      loadData();
    } catch (err: any) {
      console.error('Failed to save status page:', err);
      showToast.error(err.response?.data?.error || 'Failed to save status page');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (page: StatusPage) => {
    if (!confirm(`Delete status page "${page.name}"? This cannot be undone.`)) return;

    try {
      await statusPagesAPI.delete(page.id);
      showToast.success('Status page deleted');
      loadData();
    } catch (err) {
      console.error('Failed to delete status page:', err);
      showToast.error('Failed to delete status page');
    }
  };

  const handleToggleEnabled = async (page: StatusPage) => {
    try {
      await statusPagesAPI.update(page.id, { enabled: !page.enabled });
      showToast.success(page.enabled ? 'Status page disabled' : 'Status page enabled');
      loadData();
    } catch (err) {
      console.error('Failed to toggle status page:', err);
      showToast.error('Failed to update status page');
    }
  };

  const copyToClipboard = async (slug: string) => {
    const url = `${window.location.origin}/status/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleServiceToggle = (serviceId: string) => {
    if (formServiceIds.includes(serviceId)) {
      setFormServiceIds(formServiceIds.filter(id => id !== serviceId));
    } else {
      setFormServiceIds([...formServiceIds, serviceId]);
    }
  };

  // Status update functions
  const openUpdateModal = (page: StatusPage) => {
    setSelectedPageForUpdate(page);
    setUpdateTitle('');
    setUpdateMessage('');
    setUpdateStatus('investigating');
    setUpdateSeverity('none');
    setShowUpdateModal(true);
  };

  const closeUpdateModal = () => {
    setShowUpdateModal(false);
    setSelectedPageForUpdate(null);
    setUpdateTitle('');
    setUpdateMessage('');
    setUpdateStatus('investigating');
    setUpdateSeverity('none');
  };

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPageForUpdate || !updateTitle.trim() || !updateMessage.trim()) return;

    try {
      setPostingUpdate(true);
      const updateData: CreateStatusUpdateRequest = {
        title: updateTitle,
        message: updateMessage,
        status: updateStatus,
        severity: updateSeverity,
      };
      await statusPagesAPI.createUpdate(selectedPageForUpdate.id, updateData);
      showToast.success('Status update posted');
      closeUpdateModal();
    } catch (err: any) {
      console.error('Failed to post update:', err);
      showToast.error(err.response?.data?.error || 'Failed to post update');
    } finally {
      setPostingUpdate(false);
    }
  };

  // Subscriber functions
  const openSubscribersModal = async (page: StatusPage) => {
    setSelectedPageForSubscribers(page);
    setShowSubscribersModal(true);
    setLoadingSubscribers(true);

    try {
      const data = await statusPagesAPI.getSubscribers(page.id);
      setSubscribers(data.subscribers);
    } catch (err) {
      console.error('Failed to load subscribers:', err);
      showToast.error('Failed to load subscribers');
      setSubscribers([]);
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const closeSubscribersModal = () => {
    setShowSubscribersModal(false);
    setSelectedPageForSubscribers(null);
    setSubscribers([]);
  };

  const handleRemoveSubscriber = async (subscriberId: string) => {
    if (!selectedPageForSubscribers) return;
    if (!confirm('Remove this subscriber?')) return;

    try {
      await statusPagesAPI.removeSubscriber(selectedPageForSubscribers.id, subscriberId);
      showToast.success('Subscriber removed');
      // Reload subscribers
      const data = await statusPagesAPI.getSubscribers(selectedPageForSubscribers.id);
      setSubscribers(data.subscribers);
    } catch (err) {
      console.error('Failed to remove subscriber:', err);
      showToast.error('Failed to remove subscriber');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Status Page Administration</h1>
          <p className="text-muted-foreground mt-1">
            Manage status pages, post updates, and view subscribers
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Create Status Page
        </Button>
      </div>

      {/* Status Pages List */}
      {statusPages.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Status Pages</h3>
            <p className="text-muted-foreground mb-4">
              Create a status page to communicate service health to your users.
            </p>
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Status Page
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {statusPages.map((page) => (
            <Card key={page.id} className={!page.enabled ? 'opacity-60' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: page.primaryColor }}
                      />
                      <h3 className="text-lg font-medium text-foreground">{page.name}</h3>
                      {page.visibility === 'public' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          <Globe className="w-3 h-3" />
                          Public
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded-full">
                          <Lock className="w-3 h-3" />
                          Internal
                        </span>
                      )}
                      {!page.enabled && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          <EyeOff className="w-3 h-3" />
                          Disabled
                        </span>
                      )}
                    </div>
                    {page.description && (
                      <p className="text-sm text-muted-foreground mt-1">{page.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Globe className="w-4 h-4" />
                        /{page.slug}
                        <button
                          onClick={() => copyToClipboard(page.slug)}
                          className="ml-1 p-1 hover:bg-muted rounded"
                          title="Copy URL"
                        >
                          {copiedSlug === page.slug ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </span>
                      <span>{page.services.length} services</span>
                      {page.allowSubscriptions && (
                        <button
                          onClick={() => openSubscribersModal(page)}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          <Users className="w-4 h-4" />
                          {page.subscriberCount} subscribers
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openUpdateModal(page)}
                      title="Post Update"
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Post Update
                    </Button>
                    <Link
                      to={`/status/${page.slug}`}
                      target="_blank"
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                      title="View Status Page"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleEnabled(page)}
                      title={page.enabled ? 'Disable' : 'Enable'}
                    >
                      {page.enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(page)}
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(page)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingPage ? 'Edit Status Page' : 'Create Status Page'}
              </CardTitle>
              <CardDescription>
                {editingPage
                  ? 'Update your status page settings'
                  : 'Set up a new status page for your services'}
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
                      value={formName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="My Company Status"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="slug">URL Slug *</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">/status/</span>
                      <Input
                        id="slug"
                        value={formSlug}
                        onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="my-company"
                        pattern="[a-z0-9-]+"
                        required
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Only lowercase letters, numbers, and hyphens
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="Service status for My Company"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Visibility & Branding */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium border-b pb-2">Visibility & Branding</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Visibility</Label>
                      <select
                        value={formVisibility}
                        onChange={(e) => setFormVisibility(e.target.value as 'internal' | 'public')}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="internal">Internal (authenticated users)</option>
                        <option value="public">Public (anyone)</option>
                      </select>
                    </div>

                    <div>
                      <Label>Brand Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formPrimaryColor}
                          onChange={(e) => setFormPrimaryColor(e.target.value)}
                          className="w-10 h-10 p-1 border rounded-md cursor-pointer"
                        />
                        <Input
                          type="text"
                          value={formPrimaryColor}
                          onChange={(e) => setFormPrimaryColor(e.target.value)}
                          className="flex-1"
                          pattern="#[0-9a-fA-F]{6}"
                        />
                      </div>
                    </div>
                  </div>

                  {editingPage && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="enabled"
                        checked={formEnabled}
                        onChange={(e) => setFormEnabled(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="enabled">Status page is enabled</Label>
                    </div>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium border-b pb-2">Features</h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showUptimeHistory"
                        checked={formShowUptimeHistory}
                        onChange={(e) => setFormShowUptimeHistory(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="showUptimeHistory">Show uptime history</Label>
                      {formShowUptimeHistory && (
                        <div className="flex items-center gap-2 ml-4">
                          <Input
                            type="number"
                            value={formUptimeHistoryDays}
                            onChange={(e) => setFormUptimeHistoryDays(parseInt(e.target.value) || 90)}
                            className="w-20"
                            min={1}
                            max={365}
                          />
                          <span className="text-sm text-muted-foreground">days</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="allowSubscriptions"
                        checked={formAllowSubscriptions}
                        onChange={(e) => setFormAllowSubscriptions(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="allowSubscriptions">Allow email subscriptions for status updates</Label>
                    </div>
                  </div>
                </div>

                {/* Services */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium border-b pb-2">
                    Services ({formServiceIds.length} selected)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Select which services to display on this status page
                  </p>

                  <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                    {services.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">No services available</p>
                    ) : (
                      services.map((service) => (
                        <label
                          key={service.id}
                          className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formServiceIds.includes(service.id)}
                            onChange={() => handleServiceToggle(service.id)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-foreground">{service.name}</span>
                          <span
                            className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                              service.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {service.status}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeModal}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || !formName.trim() || !formSlug.trim()}
                  >
                    {submitting
                      ? 'Saving...'
                      : editingPage
                      ? 'Update Status Page'
                      : 'Create Status Page'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Post Update Modal */}
      {showUpdateModal && selectedPageForUpdate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Post Status Update</CardTitle>
              <CardDescription>
                Publish an update to {selectedPageForUpdate.name}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handlePostUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="updateTitle">Title *</Label>
                  <Input
                    id="updateTitle"
                    value={updateTitle}
                    onChange={(e) => setUpdateTitle(e.target.value)}
                    placeholder="Investigating API Issues"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="updateMessage">Message *</Label>
                  <textarea
                    id="updateMessage"
                    value={updateMessage}
                    onChange={(e) => setUpdateMessage(e.target.value)}
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="We're currently investigating issues with the API..."
                    required
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="updateStatus">Status</Label>
                    <select
                      id="updateStatus"
                      value={updateStatus}
                      onChange={(e) => setUpdateStatus(e.target.value as any)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="investigating">Investigating</option>
                      <option value="identified">Identified</option>
                      <option value="monitoring">Monitoring</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="updateSeverity">Severity</Label>
                    <select
                      id="updateSeverity"
                      value={updateSeverity}
                      onChange={(e) => setUpdateSeverity(e.target.value as any)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="none">None</option>
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeUpdateModal}
                    disabled={postingUpdate}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={postingUpdate || !updateTitle.trim() || !updateMessage.trim()}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {postingUpdate ? 'Posting...' : 'Post Update'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subscribers Modal */}
      {showSubscribersModal && selectedPageForSubscribers && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader>
              <CardTitle>Subscribers</CardTitle>
              <CardDescription>
                Email subscribers for {selectedPageForSubscribers.name}
              </CardDescription>
            </CardHeader>

            <CardContent className="overflow-y-auto flex-1">
              {loadingSubscribers ? (
                <div className="text-center py-8">
                  <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full" />
                  <p className="text-sm text-muted-foreground mt-2">Loading subscribers...</p>
                </div>
              ) : subscribers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No subscribers yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {subscribers.map((subscriber) => (
                    <div
                      key={subscriber.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div>
                        <p className="font-medium">{subscriber.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {subscriber.confirmed ? (
                            <span className="text-green-600">Confirmed</span>
                          ) : (
                            <span className="text-yellow-600">Pending confirmation</span>
                          )}
                          {' • '}
                          {subscriber.active ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSubscriber(subscriber.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            <div className="p-6 border-t">
              <Button variant="outline" onClick={closeSubscribersModal} className="w-full">
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
