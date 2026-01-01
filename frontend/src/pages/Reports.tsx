import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import api from '../lib/api-client';
import { Plus, Edit, Trash2, Play, X, Clock, FileText, Mail, MessageSquare, Webhook, History, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

// Types
interface Report {
  id: string;
  name: string;
  description?: string;
  schedule: 'manual' | 'daily' | 'weekly' | 'monthly';
  scheduleDay?: number;
  scheduleHour?: number;
  scheduleDescription?: string;
  format: 'summary' | 'detailed' | 'rca_only';
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  config: ReportConfig;
  deliveryConfig: DeliveryConfig;
  createdBy?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ReportConfig {
  includeServices?: boolean;
  includeResponders?: boolean;
  includeRcas?: boolean;
  includeTrends?: boolean;
  serviceIds?: string[];
  teamIds?: string[];
}

interface DeliveryConfig {
  email?: {
    enabled: boolean;
    recipients: string[];
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
  };
  teams?: {
    enabled: boolean;
    webhookUrl: string;
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };
}

interface ReportExecution {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  periodStart: string;
  periodEnd: string;
  data?: any;
  deliveryStatus?: Record<string, { channel: string; sent: boolean; error?: string }>;
  triggeredBy?: {
    id: string;
    name: string;
  };
  createdAt: string;
  completedAt?: string;
  durationSeconds?: number;
}

const SCHEDULE_OPTIONS = [
  { value: 'manual', label: 'Manual Only' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const FORMAT_OPTIONS = [
  { value: 'summary', label: 'Summary', description: 'Overview with key metrics' },
  { value: 'detailed', label: 'Detailed', description: 'Full breakdown with service and responder data' },
  { value: 'rca_only', label: 'RCAs Only', description: 'Focus on root cause analyses' },
];

const DAY_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schedule: 'manual' as 'manual' | 'daily' | 'weekly' | 'monthly',
    scheduleDay: 1,
    scheduleHour: 9,
    format: 'summary' as 'summary' | 'detailed' | 'rca_only',
    enabled: true,
    config: {
      includeServices: true,
      includeResponders: true,
      includeRcas: true,
      includeTrends: false,
    },
    deliveryConfig: {
      email: { enabled: false, recipients: [] as string[] },
      slack: { enabled: false, webhookUrl: '' },
      teams: { enabled: false, webhookUrl: '' },
      webhook: { enabled: false, url: '', headers: {} },
    },
  });
  const [emailInput, setEmailInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Report | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Execution history
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);

  // Run report
  const [runningReportId, setRunningReportId] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/reports');
      setReports(response.data.reports);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      schedule: 'manual',
      scheduleDay: 1,
      scheduleHour: 9,
      format: 'summary',
      enabled: true,
      config: {
        includeServices: true,
        includeResponders: true,
        includeRcas: true,
        includeTrends: false,
      },
      deliveryConfig: {
        email: { enabled: false, recipients: [] },
        slack: { enabled: false, webhookUrl: '' },
        teams: { enabled: false, webhookUrl: '' },
        webhook: { enabled: false, url: '', headers: {} },
      },
    });
    setEmailInput('');
    setEditingReport(null);
    setShowForm(false);
  };

  const handleStartEdit = (report: Report) => {
    setEditingReport(report);
    setFormData({
      name: report.name,
      description: report.description || '',
      schedule: report.schedule,
      scheduleDay: report.scheduleDay ?? 1,
      scheduleHour: report.scheduleHour ?? 9,
      format: report.format,
      enabled: report.enabled,
      config: {
        includeServices: report.config?.includeServices ?? true,
        includeResponders: report.config?.includeResponders ?? true,
        includeRcas: report.config?.includeRcas ?? true,
        includeTrends: report.config?.includeTrends ?? false,
      },
      deliveryConfig: {
        email: report.deliveryConfig?.email || { enabled: false, recipients: [] },
        slack: report.deliveryConfig?.slack || { enabled: false, webhookUrl: '' },
        teams: report.deliveryConfig?.teams || { enabled: false, webhookUrl: '' },
        webhook: {
          enabled: report.deliveryConfig?.webhook?.enabled || false,
          url: report.deliveryConfig?.webhook?.url || '',
          headers: report.deliveryConfig?.webhook?.headers || {},
        },
      },
    });
    setShowForm(true);
  };

  const handleStartCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Report name is required');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        schedule: formData.schedule,
        scheduleDay: formData.schedule === 'weekly' ? formData.scheduleDay : null,
        scheduleHour: formData.schedule !== 'manual' ? formData.scheduleHour : null,
        format: formData.format,
        enabled: formData.enabled,
        config: formData.config,
        deliveryConfig: formData.deliveryConfig,
      };

      if (editingReport) {
        await api.put(`/reports/${editingReport.id}`, payload);
        setSuccess('Report updated successfully');
      } else {
        await api.post('/reports', payload);
        setSuccess('Report created successfully');
      }

      await loadReports();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save report');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      setIsDeleting(true);
      await api.delete(`/reports/${deleteConfirm.id}`);
      setSuccess('Report deleted successfully');
      await loadReports();
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete report');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRunReport = async (report: Report) => {
    try {
      setRunningReportId(report.id);
      setError(null);
      await api.post(`/reports/${report.id}/run`);
      setSuccess(`Report "${report.name}" executed successfully`);
      await loadReports();

      // Show execution history for this report
      setSelectedReport(report);
      await loadExecutions(report.id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to run report');
    } finally {
      setRunningReportId(null);
    }
  };

  const loadExecutions = async (reportId: string) => {
    try {
      setLoadingExecutions(true);
      const response = await api.get(`/reports/${reportId}/executions`);
      setExecutions(response.data.executions);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load executions');
    } finally {
      setLoadingExecutions(false);
    }
  };

  const handleViewHistory = async (report: Report) => {
    setSelectedReport(report);
    await loadExecutions(report.id);
  };

  const handleDeliverExecution = async (executionId: string) => {
    try {
      await api.post(`/reports/executions/${executionId}/deliver`);
      setSuccess('Report delivery triggered');
      if (selectedReport) {
        await loadExecutions(selectedReport.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to deliver report');
    }
  };

  const addEmailRecipient = () => {
    const email = emailInput.trim();
    if (email && !formData.deliveryConfig.email.recipients.includes(email)) {
      setFormData({
        ...formData,
        deliveryConfig: {
          ...formData.deliveryConfig,
          email: {
            ...formData.deliveryConfig.email,
            recipients: [...formData.deliveryConfig.email.recipients, email],
          },
        },
      });
      setEmailInput('');
    }
  };

  const removeEmailRecipient = (email: string) => {
    setFormData({
      ...formData,
      deliveryConfig: {
        ...formData.deliveryConfig,
        email: {
          ...formData.deliveryConfig.email,
          recipients: formData.deliveryConfig.email.recipients.filter(e => e !== email),
        },
      },
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incident Reports</h1>
          <p className="text-muted-foreground">Generate and schedule incident summary reports</p>
        </div>
        <Button onClick={handleStartCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Create Report
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 p-4 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Reports List */}
      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No reports yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a report to generate incident summaries on-demand or on a schedule.
            </p>
            <Button onClick={handleStartCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{report.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        report.enabled
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {report.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    {report.description && (
                      <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {report.scheduleDescription || 'Manual only'}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {FORMAT_OPTIONS.find(f => f.value === report.format)?.label || report.format}
                      </span>
                      {report.lastRunAt && (
                        <span>Last run: {formatDate(report.lastRunAt)}</span>
                      )}
                      {report.nextRunAt && (
                        <span>Next run: {formatDate(report.nextRunAt)}</span>
                      )}
                    </div>
                    {/* Delivery indicators */}
                    <div className="flex items-center gap-2 mt-2">
                      {report.deliveryConfig?.email?.enabled && (
                        <span className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
                          <Mail className="w-3 h-3" />
                          Email ({report.deliveryConfig.email.recipients?.length || 0})
                        </span>
                      )}
                      {report.deliveryConfig?.slack?.enabled && (
                        <span className="flex items-center gap-1 text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-1 rounded">
                          <MessageSquare className="w-3 h-3" />
                          Slack
                        </span>
                      )}
                      {report.deliveryConfig?.teams?.enabled && (
                        <span className="flex items-center gap-1 text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded">
                          <MessageSquare className="w-3 h-3" />
                          Teams
                        </span>
                      )}
                      {report.deliveryConfig?.webhook?.enabled && (
                        <span className="flex items-center gap-1 text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-1 rounded">
                          <Webhook className="w-3 h-3" />
                          Webhook
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewHistory(report)}
                    >
                      <History className="w-4 h-4 mr-1" />
                      History
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunReport(report)}
                      disabled={runningReportId === report.id}
                    >
                      {runningReportId === report.id ? (
                        <span className="flex items-center gap-1">
                          <span className="animate-spin">...</span>
                          Running
                        </span>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-1" />
                          Run Now
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(report)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(report)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingReport ? 'Edit Report' : 'Create Report'}</CardTitle>
              <CardDescription>
                Configure your incident report settings and delivery options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Report Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Weekly Incident Summary"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Summary of all incidents from the past week"
                  />
                </div>
              </div>

              {/* Schedule */}
              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Schedule</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Frequency</Label>
                    <select
                      className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                      value={formData.schedule}
                      onChange={(e) => setFormData({ ...formData, schedule: e.target.value as any })}
                    >
                      {SCHEDULE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {formData.schedule === 'weekly' && (
                    <div>
                      <Label>Day of Week</Label>
                      <select
                        className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                        value={formData.scheduleDay}
                        onChange={(e) => setFormData({ ...formData, scheduleDay: parseInt(e.target.value) })}
                      >
                        {DAY_OF_WEEK.map((day) => (
                          <option key={day.value} value={day.value}>{day.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {formData.schedule !== 'manual' && (
                    <div>
                      <Label>Time (Hour)</Label>
                      <select
                        className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                        value={formData.scheduleHour}
                        onChange={(e) => setFormData({ ...formData, scheduleHour: parseInt(e.target.value) })}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="rounded border-input"
                  />
                  <Label htmlFor="enabled">Enable scheduled execution</Label>
                </div>
              </div>

              {/* Format */}
              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Report Format</h3>
                <div className="grid grid-cols-3 gap-2">
                  {FORMAT_OPTIONS.map((format) => (
                    <button
                      key={format.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, format: format.value as any })}
                      className={`p-3 rounded-lg border text-left ${
                        formData.format === format.value
                          ? 'border-primary bg-primary/10'
                          : 'border-input hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-sm">{format.label}</div>
                      <div className="text-xs text-muted-foreground">{format.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Options */}
              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Content Options</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeServices"
                      checked={formData.config.includeServices}
                      onChange={(e) => setFormData({
                        ...formData,
                        config: { ...formData.config, includeServices: e.target.checked }
                      })}
                      className="rounded border-input"
                    />
                    <Label htmlFor="includeServices">Include service breakdown</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeResponders"
                      checked={formData.config.includeResponders}
                      onChange={(e) => setFormData({
                        ...formData,
                        config: { ...formData.config, includeResponders: e.target.checked }
                      })}
                      className="rounded border-input"
                    />
                    <Label htmlFor="includeResponders">Include responder metrics</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeRcas"
                      checked={formData.config.includeRcas}
                      onChange={(e) => setFormData({
                        ...formData,
                        config: { ...formData.config, includeRcas: e.target.checked }
                      })}
                      className="rounded border-input"
                    />
                    <Label htmlFor="includeRcas">Include RCA summaries</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeTrends"
                      checked={formData.config.includeTrends}
                      onChange={(e) => setFormData({
                        ...formData,
                        config: { ...formData.config, includeTrends: e.target.checked }
                      })}
                      className="rounded border-input"
                    />
                    <Label htmlFor="includeTrends">Include trend analysis</Label>
                  </div>
                </div>
              </div>

              {/* Delivery Options */}
              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Delivery Options</h3>

                {/* Email */}
                <div className="border border-input rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="emailEnabled"
                      checked={formData.deliveryConfig.email.enabled}
                      onChange={(e) => setFormData({
                        ...formData,
                        deliveryConfig: {
                          ...formData.deliveryConfig,
                          email: { ...formData.deliveryConfig.email, enabled: e.target.checked }
                        }
                      })}
                      className="rounded border-input"
                    />
                    <Label htmlFor="emailEnabled" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Email
                    </Label>
                  </div>
                  {formData.deliveryConfig.email.enabled && (
                    <div className="space-y-2 ml-6">
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="Add recipient email"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmailRecipient())}
                        />
                        <Button type="button" variant="outline" onClick={addEmailRecipient}>Add</Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.deliveryConfig.email.recipients.map((email) => (
                          <span key={email} className="bg-muted px-2 py-1 rounded text-sm flex items-center gap-1">
                            {email}
                            <button onClick={() => removeEmailRecipient(email)}>
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Slack */}
                <div className="border border-input rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="slackEnabled"
                      checked={formData.deliveryConfig.slack.enabled}
                      onChange={(e) => setFormData({
                        ...formData,
                        deliveryConfig: {
                          ...formData.deliveryConfig,
                          slack: { ...formData.deliveryConfig.slack, enabled: e.target.checked }
                        }
                      })}
                      className="rounded border-input"
                    />
                    <Label htmlFor="slackEnabled" className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> Slack
                    </Label>
                  </div>
                  {formData.deliveryConfig.slack.enabled && (
                    <div className="ml-6">
                      <Input
                        type="url"
                        value={formData.deliveryConfig.slack.webhookUrl}
                        onChange={(e) => setFormData({
                          ...formData,
                          deliveryConfig: {
                            ...formData.deliveryConfig,
                            slack: { ...formData.deliveryConfig.slack, webhookUrl: e.target.value }
                          }
                        })}
                        placeholder="https://hooks.slack.com/services/..."
                      />
                    </div>
                  )}
                </div>

                {/* Teams */}
                <div className="border border-input rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="teamsEnabled"
                      checked={formData.deliveryConfig.teams.enabled}
                      onChange={(e) => setFormData({
                        ...formData,
                        deliveryConfig: {
                          ...formData.deliveryConfig,
                          teams: { ...formData.deliveryConfig.teams, enabled: e.target.checked }
                        }
                      })}
                      className="rounded border-input"
                    />
                    <Label htmlFor="teamsEnabled" className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> Microsoft Teams
                    </Label>
                  </div>
                  {formData.deliveryConfig.teams.enabled && (
                    <div className="ml-6">
                      <Input
                        type="url"
                        value={formData.deliveryConfig.teams.webhookUrl}
                        onChange={(e) => setFormData({
                          ...formData,
                          deliveryConfig: {
                            ...formData.deliveryConfig,
                            teams: { ...formData.deliveryConfig.teams, webhookUrl: e.target.value }
                          }
                        })}
                        placeholder="https://outlook.office.com/webhook/..."
                      />
                    </div>
                  )}
                </div>

                {/* Webhook */}
                <div className="border border-input rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="webhookEnabled"
                      checked={formData.deliveryConfig.webhook.enabled}
                      onChange={(e) => setFormData({
                        ...formData,
                        deliveryConfig: {
                          ...formData.deliveryConfig,
                          webhook: { ...formData.deliveryConfig.webhook, enabled: e.target.checked }
                        }
                      })}
                      className="rounded border-input"
                    />
                    <Label htmlFor="webhookEnabled" className="flex items-center gap-2">
                      <Webhook className="w-4 h-4" /> Custom Webhook
                    </Label>
                  </div>
                  {formData.deliveryConfig.webhook.enabled && (
                    <div className="ml-6">
                      <Input
                        type="url"
                        value={formData.deliveryConfig.webhook.url}
                        onChange={(e) => setFormData({
                          ...formData,
                          deliveryConfig: {
                            ...formData.deliveryConfig,
                            webhook: { ...formData.deliveryConfig.webhook, url: e.target.value }
                          }
                        })}
                        placeholder="https://your-server.com/reports/webhook"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-input">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingReport ? 'Update Report' : 'Create Report'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Delete Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>?
                This will also delete all execution history.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete Report'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Execution History Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Execution History</CardTitle>
                <CardDescription>{selectedReport.name}</CardDescription>
              </div>
              <Button variant="ghost" onClick={() => setSelectedReport(null)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {loadingExecutions ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : executions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No executions yet. Run the report to generate data.
                </div>
              ) : (
                <div className="space-y-4">
                  {executions.map((execution) => (
                    <div key={execution.id} className="border border-input rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            {execution.status === 'completed' ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : execution.status === 'failed' ? (
                              <XCircle className="w-4 h-4 text-destructive" />
                            ) : (
                              <Clock className="w-4 h-4 text-yellow-500" />
                            )}
                            <span className="font-medium capitalize">{execution.status}</span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Period: {formatDate(execution.periodStart)} - {formatDate(execution.periodEnd)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Created: {formatDate(execution.createdAt)}
                            {execution.durationSeconds && ` (${execution.durationSeconds}s)`}
                          </div>
                          {execution.triggeredBy && (
                            <div className="text-sm text-muted-foreground">
                              Triggered by: {execution.triggeredBy.name}
                            </div>
                          )}
                        </div>
                        {execution.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeliverExecution(execution.id)}
                          >
                            <Mail className="w-4 h-4 mr-1" />
                            Re-deliver
                          </Button>
                        )}
                      </div>

                      {/* Delivery Status */}
                      {execution.deliveryStatus && Object.keys(execution.deliveryStatus).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-input">
                          <div className="text-sm font-medium mb-2">Delivery Status:</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(execution.deliveryStatus).map(([channel, status]) => (
                              <span
                                key={channel}
                                className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                                  status.sent
                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                    : 'bg-destructive/10 text-destructive'
                                }`}
                              >
                                {status.sent ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {channel}
                                {!status.sent && status.error && `: ${status.error}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Summary Data */}
                      {execution.status === 'completed' && execution.data?.summary && (
                        <div className="mt-3 pt-3 border-t border-input">
                          <div className="grid grid-cols-4 gap-4 text-center">
                            <div>
                              <div className="text-2xl font-bold">{execution.data.summary.totalIncidents}</div>
                              <div className="text-xs text-muted-foreground">Incidents</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold">
                                {Math.floor((execution.data.summary.avgTimeToAcknowledge || 0) / 60)}m
                              </div>
                              <div className="text-xs text-muted-foreground">Avg MTTA</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold">
                                {Math.floor((execution.data.summary.avgTimeToResolve || 0) / 60)}m
                              </div>
                              <div className="text-xs text-muted-foreground">Avg MTTR</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold">{execution.data.rcas?.length || 0}</div>
                              <div className="text-xs text-muted-foreground">RCAs</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Reports;
