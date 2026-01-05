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
  Check
} from 'lucide-react';
import { statusPagesAPI, servicesAPI } from '../lib/api-client';
import type {
  StatusPage,
  CreateStatusPageRequest,
  UpdateStatusPageRequest
} from '../lib/api-client';
import type { Service } from '../types/api';
import { showToast } from '../components/Toast';

export function StatusPages() {
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
      // Handle paginated responses - prefer legacy key, fall back to data array
      setStatusPages(pagesData.statusPages || (pagesData as any).data || []);
      setServices(servicesData.services || (servicesData as any).data || []);
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
          <h1 className="text-2xl font-bold text-foreground">Status Pages</h1>
          <p className="text-muted-foreground mt-1">
            Communicate service status to stakeholders and customers
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Status Page
        </button>
      </div>

      {/* Status Pages List */}
      {statusPages.length === 0 ? (
        <div className="bg-card border rounded-lg p-8 text-center">
          <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Status Pages</h3>
          <p className="text-muted-foreground mb-4">
            Create a status page to communicate service health to your users.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Your First Status Page
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {statusPages.map((page) => (
            <div
              key={page.id}
              className={`bg-card border rounded-lg p-5 ${!page.enabled ? 'opacity-60' : ''}`}
            >
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
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {page.subscriberCount} subscribers
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/status/${page.slug}`}
                    target="_blank"
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                    title="View Status Page"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleToggleEnabled(page)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                    title={page.enabled ? 'Disable' : 'Enable'}
                  >
                    {page.enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEditModal(page)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(page)}
                    className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-foreground">
                {editingPage ? 'Edit Status Page' : 'Create Status Page'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {editingPage
                  ? 'Update your status page settings'
                  : 'Set up a new status page for your services'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="My Company Status"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="slug" className="block text-sm font-medium text-foreground mb-1">
                    URL Slug *
                  </label>
                  <div className="flex items-center">
                    <span className="text-sm text-muted-foreground mr-1">/status/</span>
                    <input
                      type="text"
                      id="slug"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="flex-1 px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="my-company"
                      pattern="[a-z0-9-]+"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Only lowercase letters, numbers, and hyphens
                  </p>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Service status for My Company"
                    rows={2}
                  />
                </div>
              </div>

              {/* Visibility & Branding */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground border-b pb-2">Visibility & Branding</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Visibility
                    </label>
                    <select
                      value={formVisibility}
                      onChange={(e) => setFormVisibility(e.target.value as 'internal' | 'public')}
                      className="w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="internal">Internal (authenticated users)</option>
                      <option value="public">Public (anyone)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Brand Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formPrimaryColor}
                        onChange={(e) => setFormPrimaryColor(e.target.value)}
                        className="w-10 h-10 p-1 border rounded-md cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formPrimaryColor}
                        onChange={(e) => setFormPrimaryColor(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                    <label htmlFor="enabled" className="text-sm text-foreground">
                      Status page is enabled
                    </label>
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground border-b pb-2">Features</h3>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="showUptimeHistory"
                      checked={formShowUptimeHistory}
                      onChange={(e) => setFormShowUptimeHistory(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="showUptimeHistory" className="text-sm text-foreground">
                      Show uptime history
                    </label>
                    {formShowUptimeHistory && (
                      <div className="flex items-center gap-2 ml-4">
                        <input
                          type="number"
                          value={formUptimeHistoryDays}
                          onChange={(e) => setFormUptimeHistoryDays(parseInt(e.target.value) || 90)}
                          className="w-20 px-2 py-1 border rounded-md bg-background text-foreground text-sm"
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
                    <label htmlFor="allowSubscriptions" className="text-sm text-foreground">
                      Allow email subscriptions for status updates
                    </label>
                  </div>
                </div>
              </div>

              {/* Services */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground border-b pb-2">
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
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                  disabled={submitting || !formName.trim() || !formSlug.trim()}
                >
                  {submitting
                    ? 'Saving...'
                    : editingPage
                    ? 'Update Status Page'
                    : 'Create Status Page'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
