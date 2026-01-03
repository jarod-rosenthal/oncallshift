import { useEffect, useState, useMemo, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';
import { servicesAPI, schedulesAPI, incidentsAPI, teamsAPI } from '../lib/api-client';
import type { Service, Schedule, MaintenanceWindow, ServiceUrgency, SupportHours, Incident, OnCallInfo } from '../types/api';
import type { Team } from '../lib/api-client';
import { UserAvatar } from '../components/UserAvatar';

interface EscalationPolicy {
  id: string;
  name: string;
}

type TabType = 'services' | 'maintenance';
type SortOption = 'name-asc' | 'name-desc' | 'created-desc' | 'created-asc';

// Extended service with additional display data
interface ServiceWithDetails extends Service {
  teamName?: string;
  onCallUser?: { id: string; fullName: string; email: string; profilePictureUrl?: string | null } | null;
  lastIncident?: { id: string; triggeredAt: string; state: string } | null;
  openIncidentsCount: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

export function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [servicesWithDetails, setServicesWithDetails] = useState<ServiceWithDetails[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [escalationPolicies, setEscalationPolicies] = useState<EscalationPolicy[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [onCallInfo, setOnCallInfo] = useState<OnCallInfo[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState<Record<string, MaintenanceWindow[]>>({});
  const [allMaintenanceWindows, setAllMaintenanceWindows] = useState<MaintenanceWindow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('services');

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');

  // Dropdown states
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);

  // Create/Edit form state
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDescription, setNewServiceDescription] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedEscalationPolicyId, setSelectedEscalationPolicyId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Urgency settings
  const [urgency, setUrgency] = useState<ServiceUrgency>('high');
  const [supportHoursEnabled, setSupportHoursEnabled] = useState(false);
  const [supportHoursTimezone, setSupportHoursTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [supportHoursDays, setSupportHoursDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [supportHoursStart, setSupportHoursStart] = useState('09:00');
  const [supportHoursEnd, setSupportHoursEnd] = useState('17:00');
  const [ackTimeoutEnabled, setAckTimeoutEnabled] = useState(false);
  const [ackTimeoutMinutes, setAckTimeoutMinutes] = useState(30);

  // API key visibility
  const [visibleApiKeys, setVisibleApiKeys] = useState<Set<string>>(new Set());

  // Maintenance window form state
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [maintenanceServiceId, setMaintenanceServiceId] = useState<string>('');
  const [maintenanceForm, setMaintenanceForm] = useState({
    startTime: '',
    endTime: '',
    description: '',
    suppressAlerts: true,
  });
  const [isCreatingMaintenance, setIsCreatingMaintenance] = useState(false);

  // Webhook info dialog
  const [showWebhookInfo, setShowWebhookInfo] = useState(false);
  const webhookUrl = `${window.location.origin}/api/v1/alerts/webhook`;

  // Dropdown refs for click outside
  const teamDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const timeDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
        setShowTeamDropdown(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target as Node)) {
        setShowTimeDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
      // Close actions menu
      setShowActionsMenu(null);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // Compute services with details when data changes
  useEffect(() => {
    if (services.length > 0) {
      computeServicesWithDetails();
    }
  }, [services, onCallInfo, incidents, maintenanceWindows, teams]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [servicesRes, schedulesRes, onCallRes, incidentsRes, teamsRes] = await Promise.all([
        servicesAPI.list(),
        schedulesAPI.list(),
        schedulesAPI.getOnCall(),
        incidentsAPI.list(),
        teamsAPI.list(),
      ]);
      setServices(servicesRes.services);
      setSchedules(schedulesRes.schedules);
      setOnCallInfo(onCallRes.oncall);
      setIncidents(incidentsRes.incidents);
      setTeams(teamsRes.teams);

      // Fetch escalation policies
      const token = localStorage.getItem('accessToken');
      if (token) {
        const policiesRes = await fetch('/api/v1/escalation-policies', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (policiesRes.ok) {
          const policiesData = await policiesRes.json();
          setEscalationPolicies(policiesData.policies || []);
        }
      }

      // Load maintenance windows for all services
      const windowsMap: Record<string, MaintenanceWindow[]> = {};
      const allWindows: MaintenanceWindow[] = [];
      await Promise.all(
        servicesRes.services.map(async (service) => {
          try {
            const mwRes = await servicesAPI.listMaintenanceWindows(service.id);
            const serviceWindows = (mwRes.maintenanceWindows || []).filter(
              (mw) => mw.isActive || mw.isFuture
            );
            windowsMap[service.id] = serviceWindows;
            allWindows.push(...serviceWindows.map(w => ({ ...w, service: { id: service.id, name: service.name } })));
          } catch {
            windowsMap[service.id] = [];
          }
        })
      );
      setMaintenanceWindows(windowsMap);
      setAllMaintenanceWindows(allWindows);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const computeServicesWithDetails = () => {
    const enrichedServices: ServiceWithDetails[] = services
      .filter(s => s.status === 'active')
      .map(service => {
        // Find on-call user for this service
        const serviceOnCall = onCallInfo.find(oc => oc.service.id === service.id);
        const onCallUser = serviceOnCall?.oncallUser || null;

        // Find incidents for this service
        const serviceIncidents = incidents.filter(inc => inc.service.id === service.id);
        const openIncidents = serviceIncidents.filter(inc => inc.state !== 'resolved');
        const lastIncident = serviceIncidents.length > 0
          ? serviceIncidents.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())[0]
          : null;

        // Determine health status
        let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (openIncidents.some(inc => inc.state === 'triggered')) {
          healthStatus = 'critical';
        } else if (openIncidents.length > 0) {
          healthStatus = 'warning';
        }

        // Find team (from escalation policy or schedule - approximation)
        // This would ideally come from backend, but we approximate here
        const teamName = teams.length > 0 ? teams[0].name : undefined;

        return {
          ...service,
          teamName,
          onCallUser: onCallUser ? {
            id: onCallUser.id,
            fullName: onCallUser.fullName,
            email: onCallUser.email,
            profilePictureUrl: null,
          } : null,
          lastIncident: lastIncident ? {
            id: lastIncident.id,
            triggeredAt: lastIncident.triggeredAt,
            state: lastIncident.state,
          } : null,
          openIncidentsCount: openIncidents.length,
          healthStatus,
        };
      });
    setServicesWithDetails(enrichedServices);
  };

  // Filter and sort services
  const filteredServices = useMemo(() => {
    let result = [...servicesWithDetails];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        s => s.name.toLowerCase().includes(query) ||
          (s.description && s.description.toLowerCase().includes(query))
      );
    }

    // Team filter - skip for now as we don't have proper team assignment
    // Status filter based on health
    if (statusFilter !== 'all') {
      if (statusFilter === 'healthy') {
        result = result.filter(s => s.healthStatus === 'healthy');
      } else if (statusFilter === 'warning') {
        result = result.filter(s => s.healthStatus === 'warning');
      } else if (statusFilter === 'critical') {
        result = result.filter(s => s.healthStatus === 'critical');
      }
    }

    // Time filter for last incident
    if (timeFilter !== 'all') {
      const now = new Date();
      result = result.filter(s => {
        if (!s.lastIncident) return timeFilter === 'never';
        const incidentTime = new Date(s.lastIncident.triggeredAt);
        const diffHours = (now.getTime() - incidentTime.getTime()) / (1000 * 60 * 60);
        switch (timeFilter) {
          case '24h': return diffHours <= 24;
          case '7d': return diffHours <= 168;
          case '30d': return diffHours <= 720;
          case 'never': return false;
          default: return true;
        }
      });
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
  }, [servicesWithDetails, searchQuery, teamFilter, statusFilter, timeFilter, sortOption]);

  const resetForm = () => {
    setNewServiceName('');
    setNewServiceDescription('');
    setSelectedScheduleId('');
    setSelectedEscalationPolicyId('');
    setUrgency('high');
    setSupportHoursEnabled(false);
    setSupportHoursTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setSupportHoursDays([1, 2, 3, 4, 5]);
    setSupportHoursStart('09:00');
    setSupportHoursEnd('17:00');
    setAckTimeoutEnabled(false);
    setAckTimeoutMinutes(30);
    setEditingService(null);
    setShowCreatePanel(false);
  };

  const handleStartEdit = (service: Service) => {
    setEditingService(service);
    setNewServiceName(service.name);
    setNewServiceDescription(service.description || '');
    setSelectedScheduleId(service.schedule?.id || '');
    setSelectedEscalationPolicyId(service.escalationPolicy?.id || '');
    setUrgency(service.urgency || 'high');
    if (service.supportHours) {
      setSupportHoursEnabled(service.supportHours.enabled);
      setSupportHoursTimezone(service.supportHours.timezone);
      setSupportHoursDays(service.supportHours.days);
      setSupportHoursStart(service.supportHours.startTime);
      setSupportHoursEnd(service.supportHours.endTime);
    } else {
      setSupportHoursEnabled(false);
      setSupportHoursTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      setSupportHoursDays([1, 2, 3, 4, 5]);
      setSupportHoursStart('09:00');
      setSupportHoursEnd('17:00');
    }
    setAckTimeoutEnabled(!!service.ackTimeoutSeconds);
    setAckTimeoutMinutes(service.ackTimeoutSeconds ? Math.round(service.ackTimeoutSeconds / 60) : 30);
    setShowCreatePanel(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      setError(null);

      const supportHours: SupportHours | undefined = urgency === 'dynamic' && supportHoursEnabled ? {
        enabled: true,
        timezone: supportHoursTimezone,
        days: supportHoursDays,
        startTime: supportHoursStart,
        endTime: supportHoursEnd,
      } : undefined;

      const serviceData = {
        name: newServiceName,
        description: newServiceDescription || undefined,
        scheduleId: selectedScheduleId || undefined,
        escalationPolicyId: selectedEscalationPolicyId || undefined,
        urgency,
        supportHours: urgency === 'dynamic' ? supportHours : undefined,
        ackTimeoutSeconds: ackTimeoutEnabled ? ackTimeoutMinutes * 60 : undefined,
      };

      if (editingService) {
        await servicesAPI.update(editingService.id, {
          ...serviceData,
          supportHours: urgency === 'dynamic' ? supportHours : null,
          ackTimeoutSeconds: ackTimeoutEnabled ? ackTimeoutMinutes * 60 : null,
        });
        setSuccess('Service updated successfully');
      } else {
        await servicesAPI.create(serviceData);
        setSuccess('Service created successfully');
      }

      resetForm();
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save service');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRegenerateKey = async (serviceId: string, serviceName: string) => {
    if (!confirm(`Are you sure you want to regenerate the API key for "${serviceName}"? Any integrations using the old key will stop working.`)) {
      return;
    }

    try {
      setError(null);
      const result = await servicesAPI.regenerateApiKey(serviceId);
      setServices(services.map(s => s.id === serviceId ? result.service : s));
      setVisibleApiKeys(new Set([...visibleApiKeys, serviceId]));
      setSuccess('API key regenerated successfully. Make sure to copy the new key.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to regenerate API key');
    }
  };

  const handleDelete = async (serviceId: string, serviceName: string) => {
    if (!confirm(`Are you sure you want to delete "${serviceName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      await servicesAPI.delete(serviceId);
      setServices(services.filter(s => s.id !== serviceId));
      setSuccess('Service deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete service');
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`${label} copied to clipboard`);
      setTimeout(() => setSuccess(null), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const toggleApiKeyVisibility = (serviceId: string) => {
    const newVisibleKeys = new Set(visibleApiKeys);
    if (newVisibleKeys.has(serviceId)) {
      newVisibleKeys.delete(serviceId);
    } else {
      newVisibleKeys.add(serviceId);
    }
    setVisibleApiKeys(newVisibleKeys);
  };

  const maskApiKey = (apiKey: string) => {
    return apiKey.substring(0, 8) + '************';
  };

  // Maintenance window handlers
  const formatDateTimeLocal = (date: Date) => {
    return date.toISOString().slice(0, 16);
  };

  const handleOpenMaintenanceForm = (serviceId?: string) => {
    const now = new Date();
    const endTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    setMaintenanceForm({
      startTime: formatDateTimeLocal(now),
      endTime: formatDateTimeLocal(endTime),
      description: '',
      suppressAlerts: true,
    });
    setMaintenanceServiceId(serviceId || '');
    setShowMaintenanceForm(true);
  };

  const handleCreateMaintenanceWindow = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!maintenanceForm.startTime || !maintenanceForm.endTime || !maintenanceServiceId) {
      setError('Service, start time, and end time are required');
      return;
    }

    try {
      setIsCreatingMaintenance(true);
      setError(null);
      await servicesAPI.createMaintenanceWindow(maintenanceServiceId, {
        startTime: new Date(maintenanceForm.startTime).toISOString(),
        endTime: new Date(maintenanceForm.endTime).toISOString(),
        description: maintenanceForm.description || undefined,
        suppressAlerts: maintenanceForm.suppressAlerts,
      });
      setShowMaintenanceForm(false);
      setMaintenanceForm({ startTime: '', endTime: '', description: '', suppressAlerts: true });
      setMaintenanceServiceId('');
      setSuccess('Maintenance window created successfully');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create maintenance window');
    } finally {
      setIsCreatingMaintenance(false);
    }
  };

  const handleDeleteMaintenanceWindow = async (serviceId: string, windowId: string) => {
    if (!confirm('Are you sure you want to delete this maintenance window?')) return;

    try {
      setError(null);
      await servicesAPI.deleteMaintenanceWindow(serviceId, windowId);
      setSuccess('Maintenance window deleted');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete maintenance window');
    }
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Health status icon
  const HealthIcon = ({ status }: { status: 'healthy' | 'warning' | 'critical' }) => {
    if (status === 'healthy') {
      return (
        <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }
    if (status === 'warning') {
      return (
        <div className="w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  };

  // Export services to CSV
  const handleExport = () => {
    const headers = ['Name', 'Description', 'Status', 'Schedule', 'Escalation Policy', 'Created'];
    const rows = filteredServices.map(s => [
      s.name,
      s.description || '',
      s.status,
      s.schedule?.name || '',
      s.escalationPolicy?.name || '',
      new Date(s.createdAt).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'services.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold mb-1">Service Directory</h1>
          <p className="text-muted-foreground text-sm">
            A service represents a component or piece of infrastructure that can generate alerts and incidents.
          </p>
        </div>
        <Button onClick={() => setShowCreatePanel(true)}>
          + New Service
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">x</button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 text-sm text-green-800 bg-green-50 dark:bg-green-900/20 dark:text-green-200 rounded-md flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 hover:opacity-70">x</button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b mb-4">
        <div className="flex gap-6">
          <button
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'services'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('services')}
          >
            Services
          </button>
          <button
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'maintenance'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('maintenance')}
          >
            Maintenance Windows
          </button>
        </div>
      </div>

      {activeTab === 'services' && (
        <>
          {/* Search and Filters */}
          <div className="mb-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter chips row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Team Filter */}
              <div className="relative" ref={teamDropdownRef}>
                <button
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1 ${
                    teamFilter !== 'all'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:border-primary/50'
                  }`}
                  onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                >
                  {teamFilter === 'all' ? 'All Teams' : teams.find(t => t.id === teamFilter)?.name || 'Team'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showTeamDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-background border rounded-md shadow-lg z-10">
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => { setTeamFilter('all'); setShowTeamDropdown(false); }}
                    >
                      All Teams
                    </button>
                    {teams.map(team => (
                      <button
                        key={team.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => { setTeamFilter(team.id); setShowTeamDropdown(false); }}
                      >
                        {team.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Filter */}
              <div className="relative" ref={statusDropdownRef}>
                <button
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1 ${
                    statusFilter !== 'all'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:border-primary/50'
                  }`}
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                >
                  {statusFilter === 'all' ? 'Any status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showStatusDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-background border rounded-md shadow-lg z-10">
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => { setStatusFilter('all'); setShowStatusDropdown(false); }}
                    >
                      Any status
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                      onClick={() => { setStatusFilter('healthy'); setShowStatusDropdown(false); }}
                    >
                      <span className="w-2 h-2 rounded-full bg-green-500"></span> Healthy
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                      onClick={() => { setStatusFilter('warning'); setShowStatusDropdown(false); }}
                    >
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Warning
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                      onClick={() => { setStatusFilter('critical'); setShowStatusDropdown(false); }}
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500"></span> Critical
                    </button>
                  </div>
                )}
              </div>

              {/* Time Filter */}
              <div className="relative" ref={timeDropdownRef}>
                <button
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1 ${
                    timeFilter !== 'all'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:border-primary/50'
                  }`}
                  onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                >
                  {timeFilter === 'all' ? 'Any time' :
                    timeFilter === '24h' ? 'Last 24 hours' :
                      timeFilter === '7d' ? 'Last 7 days' :
                        timeFilter === '30d' ? 'Last 30 days' :
                          'No incidents'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showTimeDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-background border rounded-md shadow-lg z-10">
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => { setTimeFilter('all'); setShowTimeDropdown(false); }}
                    >
                      Any time
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => { setTimeFilter('24h'); setShowTimeDropdown(false); }}
                    >
                      Last 24 hours
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => { setTimeFilter('7d'); setShowTimeDropdown(false); }}
                    >
                      Last 7 days
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => { setTimeFilter('30d'); setShowTimeDropdown(false); }}
                    >
                      Last 30 days
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => { setTimeFilter('never'); setShowTimeDropdown(false); }}
                    >
                      No incidents
                    </button>
                  </div>
                )}
              </div>

              {/* Sort */}
              <div className="relative" ref={sortDropdownRef}>
                <button
                  className="px-3 py-1.5 text-sm rounded-full border bg-background border-input hover:border-primary/50 transition-colors flex items-center gap-1"
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                >
                  {sortOption === 'name-asc' ? 'Name A-Z' :
                    sortOption === 'name-desc' ? 'Name Z-A' :
                      sortOption === 'created-desc' ? 'Newest first' :
                        'Oldest first'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showSortDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-background border rounded-md shadow-lg z-10">
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => { setSortOption('name-asc'); setShowSortDropdown(false); }}
                    >
                      Name A-Z
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => { setSortOption('name-desc'); setShowSortDropdown(false); }}
                    >
                      Name Z-A
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => { setSortOption('created-desc'); setShowSortDropdown(false); }}
                    >
                      Newest first
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => { setSortOption('created-asc'); setShowSortDropdown(false); }}
                    >
                      Oldest first
                    </button>
                  </div>
                )}
              </div>

              {/* Spacer */}
              <div className="flex-1"></div>

              {/* Webhook Info Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWebhookInfo(true)}
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Webhook Info
              </Button>

              {/* Export Button */}
              <Button variant="outline" size="sm" onClick={handleExport}>
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </Button>
            </div>
          </div>

          {/* Results count */}
          <div className="mb-4 text-sm text-muted-foreground">
            Total results: {filteredServices.length}
          </div>

          {/* Services Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/30">
              <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-muted-foreground mb-4">
                {searchQuery || teamFilter !== 'all' || statusFilter !== 'all' || timeFilter !== 'all'
                  ? 'No services match your filters'
                  : 'No services yet. Create one to start receiving alerts.'}
              </p>
              {!searchQuery && teamFilter === 'all' && statusFilter === 'all' && timeFilter === 'all' && (
                <Button onClick={() => setShowCreatePanel(true)}>Create your first service</Button>
              )}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-10">
                      <span className="sr-only">Status</span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      On Call Now
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Last Incident
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredServices.map((service) => (
                    <tr
                      key={service.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => handleStartEdit(services.find(s => s.id === service.id)!)}
                    >
                      <td className="px-4 py-4">
                        <HealthIcon status={service.healthStatus} />
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-medium text-foreground">{service.name}</div>
                          {service.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {service.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {service.teamName ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            {service.teamName}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {service.onCallUser ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              src={service.onCallUser.profilePictureUrl}
                              name={service.onCallUser.fullName}
                              size="xs"
                            />
                            <span className="text-sm">{service.onCallUser.fullName}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No one on call</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {service.lastIncident ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {formatRelativeTime(service.lastIncident.triggeredAt)}
                            </span>
                            {service.openIncidentsCount > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                {service.openIncidentsCount} open
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No incidents</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="relative">
                          <button
                            className="p-1 rounded hover:bg-muted"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowActionsMenu(showActionsMenu === service.id ? null : service.id);
                            }}
                          >
                            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                          {showActionsMenu === service.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-background border rounded-md shadow-lg z-20">
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(services.find(s => s.id === service.id)!);
                                  setShowActionsMenu(null);
                                }}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Service
                              </button>
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenMaintenanceForm(service.id);
                                  setShowActionsMenu(null);
                                }}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Schedule Maintenance
                              </button>
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const svc = services.find(s => s.id === service.id);
                                  if (svc) copyToClipboard(svc.apiKey, 'API key');
                                  setShowActionsMenu(null);
                                }}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                Copy API Key
                              </button>
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRegenerateKey(service.id, service.name);
                                  setShowActionsMenu(null);
                                }}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Regenerate API Key
                              </button>
                              <div className="border-t my-1"></div>
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(service.id, service.name);
                                  setShowActionsMenu(null);
                                }}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete Service
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'maintenance' && (
        <>
          {/* Maintenance Windows Tab */}
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Schedule maintenance windows to suppress alerts during planned outages.
            </p>
            <Button onClick={() => handleOpenMaintenanceForm()}>
              + Schedule Maintenance
            </Button>
          </div>

          {allMaintenanceWindows.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/30">
              <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-muted-foreground mb-4">No maintenance windows scheduled</p>
              <Button onClick={() => handleOpenMaintenanceForm()}>Schedule your first maintenance</Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Start Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      End Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allMaintenanceWindows.map((mw) => (
                    <tr key={mw.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            mw.isActive
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}
                        >
                          {mw.isActive ? 'Active' : 'Scheduled'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-medium">{mw.service?.name}</span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {new Date(mw.startTime).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {new Date(mw.endTime).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {mw.description || '-'}
                      </td>
                      <td className="px-4 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMaintenanceWindow(mw.serviceId, mw.id)}
                        >
                          {mw.isActive ? 'End' : 'Cancel'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Service Panel */}
      {showCreatePanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
          <div className="relative w-full max-w-lg bg-background shadow-xl overflow-auto">
            <div className="sticky top-0 bg-background border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingService ? 'Edit Service' : 'Create New Service'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {editingService
                    ? 'Update service settings and configurations'
                    : 'A service represents a component that can trigger incidents'}
                </p>
              </div>
              <button
                onClick={resetForm}
                className="p-2 hover:bg-muted rounded-md"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="serviceName">Service Name *</Label>
                  <Input
                    id="serviceName"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    placeholder="e.g., Production API"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="serviceDescription">Description</Label>
                  <Input
                    id="serviceDescription"
                    value={newServiceDescription}
                    onChange={(e) => setNewServiceDescription(e.target.value)}
                    placeholder="e.g., Main production API server"
                  />
                </div>
              </div>

              {/* Routing */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm uppercase text-muted-foreground">Incident Routing</h3>
                <div>
                  <Label htmlFor="scheduleId">On-Call Schedule</Label>
                  <select
                    id="scheduleId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={selectedScheduleId}
                    onChange={(e) => setSelectedScheduleId(e.target.value)}
                  >
                    <option value="">No schedule assigned</option>
                    {schedules.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Determines who is on-call for this service
                  </p>
                </div>
                <div>
                  <Label htmlFor="escalationPolicyId">Escalation Policy</Label>
                  <select
                    id="escalationPolicyId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={selectedEscalationPolicyId}
                    onChange={(e) => setSelectedEscalationPolicyId(e.target.value)}
                  >
                    <option value="">No escalation policy</option>
                    {escalationPolicies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Defines how incidents are escalated if not acknowledged
                  </p>
                </div>
              </div>

              {/* Urgency Settings */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm uppercase text-muted-foreground">Notification Urgency</h3>
                <div>
                  <Label htmlFor="urgency">Urgency Mode</Label>
                  <select
                    id="urgency"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as ServiceUrgency)}
                  >
                    <option value="high">High urgency (always notify immediately)</option>
                    <option value="low">Low urgency (respect quiet hours)</option>
                    <option value="dynamic">Dynamic (based on support hours)</option>
                  </select>
                </div>

                {urgency === 'dynamic' && (
                  <div className="border rounded-md p-4 bg-muted/30 space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="supportHoursEnabled"
                        checked={supportHoursEnabled}
                        onChange={(e) => setSupportHoursEnabled(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="supportHoursEnabled" className="text-sm font-medium">
                        Enable support hours
                      </label>
                    </div>

                    {supportHoursEnabled && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="supportHoursStart">Start Time</Label>
                            <Input
                              id="supportHoursStart"
                              type="time"
                              value={supportHoursStart}
                              onChange={(e) => setSupportHoursStart(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="supportHoursEnd">End Time</Label>
                            <Input
                              id="supportHoursEnd"
                              type="time"
                              value={supportHoursEnd}
                              onChange={(e) => setSupportHoursEnd(e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Support Days</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                              <label
                                key={day}
                                className={`px-3 py-1 rounded-md cursor-pointer text-sm border transition-colors ${
                                  supportHoursDays.includes(index)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background border-input hover:border-primary/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={supportHoursDays.includes(index)}
                                  onChange={() => {
                                    if (supportHoursDays.includes(index)) {
                                      setSupportHoursDays(supportHoursDays.filter(d => d !== index));
                                    } else {
                                      setSupportHoursDays([...supportHoursDays, index].sort());
                                    }
                                  }}
                                />
                                {day}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="supportHoursTimezone">Timezone</Label>
                          <select
                            id="supportHoursTimezone"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={supportHoursTimezone}
                            onChange={(e) => setSupportHoursTimezone(e.target.value)}
                          >
                            <option value="America/New_York">Eastern Time (ET)</option>
                            <option value="America/Chicago">Central Time (CT)</option>
                            <option value="America/Denver">Mountain Time (MT)</option>
                            <option value="America/Los_Angeles">Pacific Time (PT)</option>
                            <option value="UTC">UTC</option>
                            <option value="Europe/London">London (GMT/BST)</option>
                            <option value="Europe/Paris">Central European (CET)</option>
                            <option value="Asia/Tokyo">Japan (JST)</option>
                            <option value="Asia/Shanghai">China (CST)</option>
                            <option value="Australia/Sydney">Sydney (AEST)</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Ack Timeout */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm uppercase text-muted-foreground">Acknowledgement Timeout</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ackTimeoutEnabled"
                    checked={ackTimeoutEnabled}
                    onChange={(e) => setAckTimeoutEnabled(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="ackTimeoutEnabled" className="text-sm font-medium">
                    Enable acknowledgement timeout
                  </label>
                </div>
                {ackTimeoutEnabled && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ackTimeoutMinutes" className="whitespace-nowrap">
                      Auto-unacknowledge after
                    </Label>
                    <Input
                      id="ackTimeoutMinutes"
                      type="number"
                      min={1}
                      max={1440}
                      value={ackTimeoutMinutes}
                      onChange={(e) => setAckTimeoutMinutes(parseInt(e.target.value) || 30)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                )}
              </div>

              {/* API Key Section (only for existing services) */}
              {editingService && (
                <div className="space-y-4">
                  <h3 className="font-medium text-sm uppercase text-muted-foreground">API Key</h3>
                  <div className="bg-muted rounded p-3">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-sm font-mono">
                        {visibleApiKeys.has(editingService.id)
                          ? editingService.apiKey
                          : maskApiKey(editingService.apiKey)}
                      </code>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleApiKeyVisibility(editingService.id)}
                        >
                          {visibleApiKeys.has(editingService.id) ? 'Hide' : 'Show'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(editingService.apiKey, 'API key')}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button type="submit" disabled={isCreating} className="flex-1">
                  {isCreating ? 'Saving...' : editingService ? 'Save Changes' : 'Create Service'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance Window Form Dialog */}
      <Dialog open={showMaintenanceForm} onClose={() => setShowMaintenanceForm(false)}>
        <DialogHeader>
          <DialogTitle>Schedule Maintenance Window</DialogTitle>
          <DialogDescription>
            Suppress alerts during planned maintenance
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleCreateMaintenanceWindow} className="space-y-4">
            <div>
              <Label htmlFor="mw-service">Service *</Label>
              <select
                id="mw-service"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={maintenanceServiceId}
                onChange={(e) => setMaintenanceServiceId(e.target.value)}
                required
              >
                <option value="">Select a service</option>
                {services.filter(s => s.status === 'active').map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="mw-start">Start Time *</Label>
                <Input
                  id="mw-start"
                  type="datetime-local"
                  value={maintenanceForm.startTime}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, startTime: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="mw-end">End Time *</Label>
                <Input
                  id="mw-end"
                  type="datetime-local"
                  value={maintenanceForm.endTime}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, endTime: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="mw-desc">Description</Label>
              <Input
                id="mw-desc"
                type="text"
                placeholder="e.g., Database upgrade"
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mw-suppress"
                checked={maintenanceForm.suppressAlerts}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, suppressAlerts: e.target.checked })}
                className="rounded border-input"
              />
              <Label htmlFor="mw-suppress" className="text-sm">
                Suppress alerts during maintenance
              </Label>
            </div>
          </form>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowMaintenanceForm(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateMaintenanceWindow} disabled={isCreatingMaintenance}>
            {isCreatingMaintenance ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Webhook Info Dialog */}
      <Dialog open={showWebhookInfo} onClose={() => setShowWebhookInfo(false)}>
        <DialogHeader>
          <DialogTitle>Webhook Integration</DialogTitle>
          <DialogDescription>
            Use this URL to send alerts from your monitoring tools
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <Label>Webhook URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
                  {webhookUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                >
                  Copy
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Include the <code className="bg-muted px-1 rounded">X-API-Key</code> header with your service's API key when making requests.
            </p>
            <div>
              <Label>Sample Request</Label>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto mt-1">
{`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_SERVICE_API_KEY" \\
  -d '{
    "summary": "High CPU usage",
    "severity": "warning",
    "details": { "host": "prod-1" }
  }'`}
              </pre>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>Severity levels:</strong> info, warning, error, critical
            </p>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button onClick={() => setShowWebhookInfo(false)}>Close</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
