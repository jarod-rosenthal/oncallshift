import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  ChevronDown,
  Check,
  X,
  Clock,
  Server,
  LayoutGrid,
  LayoutList,
  BellOff,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '../components/ui/dialog';
import { Select } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { showToast } from '../components/Toast';
import { triggerConfetti } from '../components/Confetti';
import { ResolveModal } from '../components/ResolveModal';
import { incidentsAPI, usersAPI, servicesAPI, teamsAPI } from '../lib/api-client';
import { useAuthStore } from '../store/auth-store';
import { cn } from '../lib/utils';
import type { Incident, User as UserType, Service } from '../types/api';
import type { Team } from '../lib/api-client';

type DialogType = 'escalate' | 'reassign' | 'snooze' | null;
type StatusFilter = 'all' | 'triggered' | 'acknowledged' | 'resolved';
type SeverityFilter = 'all' | 'critical' | 'error' | 'warning' | 'info';
type SortOption = 'newest' | 'oldest' | 'severity' | 'updated';

// Severity configuration - using high contrast solid badges
const severityConfig = {
  critical: {
    label: 'SEV1',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-600',
    textColor: 'text-white',
  },
  error: {
    label: 'SEV2',
    dotColor: 'bg-orange-500',
    bgColor: 'bg-orange-600',
    textColor: 'text-white',
  },
  warning: {
    label: 'SEV3',
    dotColor: 'bg-yellow-500',
    bgColor: 'bg-yellow-600',
    textColor: 'text-black',
  },
  info: {
    label: 'SEV4',
    dotColor: 'bg-blue-500',
    bgColor: 'bg-blue-600',
    textColor: 'text-white',
  },
};

// Status configuration - stripes instead of text colors
const statusConfig = {
  triggered: {
    label: 'Triggered',
    stripeColor: 'bg-red-500',
    badgeColor: 'bg-red-500',
    textColor: 'text-neutral-400',
  },
  acknowledged: {
    label: "Ack'd",
    stripeColor: 'bg-yellow-500',
    badgeColor: 'bg-yellow-500',
    textColor: 'text-neutral-400',
  },
  resolved: {
    label: 'Resolved',
    stripeColor: 'bg-green-500',
    badgeColor: 'bg-green-500',
    textColor: 'text-neutral-500',
  },
};

// Snooze duration options
const snoozeDurations = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
  { value: 1440, label: '24 hours' },
];

// Format relative time
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Filter Chip component
function FilterChip({
  label,
  active,
  onClick,
  options,
  value,
  onChange,
}: {
  label: string;
  active: boolean;
  onClick?: () => void;
  options?: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (options && onChange) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
            'hover:border-primary flex items-center gap-1',
            active
              ? 'bg-primary/10 border-primary text-primary'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
          )}
        >
          {label}
          <ChevronDown className="w-3 h-3" />
        </button>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg py-1 min-w-[150px]">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-between',
                    'text-gray-700 dark:text-gray-200',
                    value === option.value && 'text-primary font-medium'
                  )}
                >
                  {option.label}
                  {value === option.value && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
        'hover:border-primary',
        active
          ? 'bg-primary/10 border-primary text-primary'
          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
      )}
    >
      {label}
    </button>
  );
}

// Status Tab component
function StatusTab({
  label,
  count,
  active,
  onClick,
  badgeColor,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  badgeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium transition-colors relative',
        active
          ? 'text-primary border-b-2 border-primary'
          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
      )}
    >
      <span className="flex items-center gap-2">
        {label}
        {count !== undefined && count > 0 && (
          <span
            className={cn(
              'px-1.5 py-0.5 rounded-full text-xs font-semibold text-white',
              badgeColor || 'bg-neutral-500'
            )}
          >
            {count}
          </span>
        )}
      </span>
    </button>
  );
}

// Incident Row component - Clean design with status stripe
function IncidentRow({
  incident,
  selected,
  onSelect,
  onClick,
}: {
  incident: Incident;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onClick: () => void;
}) {
  const severity = severityConfig[incident.severity as keyof typeof severityConfig] || severityConfig.info;
  const status = statusConfig[incident.state as keyof typeof statusConfig] || statusConfig.triggered;

  return (
    <div
      className={cn(
        'flex items-stretch border-b border-gray-200 dark:border-gray-700',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer',
        selected && 'bg-blue-50 dark:bg-blue-900/20'
      )}
    >
      {/* Status stripe - left edge indicator */}
      <div className={cn('w-1 flex-shrink-0', status.stripeColor)} />

      {/* Main row content */}
      <div className="flex items-center gap-4 px-4 py-3 flex-1 min-w-0">
        {/* Checkbox */}
        <div
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-primary focus:ring-primary"
          />
        </div>

        {/* Severity badge - solid high contrast */}
        <div className="flex-shrink-0">
          <span
            className={cn(
              'px-2 py-1 rounded text-xs font-bold tracking-wide',
              severity.bgColor,
              severity.textColor
            )}
          >
            {severity.label}
          </span>
        </div>

        {/* Incident number */}
        <div className="flex-shrink-0 w-16">
          <span className="font-mono text-sm text-gray-500 dark:text-gray-400">#{incident.incidentNumber}</span>
        </div>

        {/* Main content - summary and metadata */}
        <div className="flex-1 min-w-0" onClick={onClick}>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">
              {incident.summary}
            </h3>
            {incident.snoozedUntil && new Date(incident.snoozedUntil) > new Date() && (
              <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded">
                <BellOff className="w-3 h-3" />
                Snoozed
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm">
            {/* Service chip */}
            {incident.service && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 text-xs">
                <Server className="w-3 h-3" />
                {incident.service.name}
              </span>
            )}
            {/* Time */}
            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              {status.label} {formatRelativeTime(
                incident.state === 'resolved' && incident.resolvedAt
                  ? incident.resolvedAt
                  : incident.state === 'acknowledged' && incident.acknowledgedAt
                  ? incident.acknowledgedAt
                  : incident.triggeredAt
              )}
            </span>
          </div>
        </div>

        {/* Right side - Assignee */}
        <div className="flex-shrink-0 flex items-center gap-3">
          {incident.assignedTo && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
                {incident.assignedTo.fullName.charAt(0).toUpperCase()}
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                {incident.assignedTo.fullName.split(' ')[0]}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Bulk Action Bar component
function BulkActionBar({
  selectedCount,
  onAcknowledge,
  onResolve,
  onReassign,
  onSnooze,
  onClear,
  isLoading,
}: {
  selectedCount: number;
  onAcknowledge: () => void;
  onResolve: () => void;
  onReassign: () => void;
  onSnooze: () => void;
  onClear: () => void;
  isLoading: boolean;
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-neutral-900 dark:bg-neutral-800 text-white',
        'transform transition-transform duration-200 ease-out',
        'shadow-lg border-t border-neutral-700'
      )}
    >
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <span className="font-medium">
          {selectedCount} incident{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-neutral-700"
            onClick={onAcknowledge}
            disabled={isLoading}
          >
            Acknowledge
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-neutral-700"
            onClick={onResolve}
            disabled={isLoading}
          >
            Resolve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-neutral-700"
            onClick={onReassign}
            disabled={isLoading}
          >
            Reassign
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-neutral-700"
            onClick={onSnooze}
            disabled={isLoading}
          >
            Snooze
          </Button>
          <div className="w-px h-6 bg-neutral-600 mx-2" />
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-neutral-700"
            onClick={onClear}
            disabled={isLoading}
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Current user
  const currentUser = useAuthStore((state) => state.user);

  // Dialog state
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resolve modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveIncidentId, setResolveIncidentId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  // Form state
  const [escalateReason, setEscalateReason] = useState('');
  const [reassignUserId, setReassignUserId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [snoozeDuration, setSnoozeDuration] = useState(60);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter state from URL params
  const statusFilter = (searchParams.get('status') as StatusFilter) || 'all';
  const severityFilter = (searchParams.get('severity') as SeverityFilter) || 'all';
  const serviceFilter = searchParams.get('service') || 'all';
  const teamFilter = searchParams.get('team') || 'all';
  const sortBy = (searchParams.get('sort') as SortOption) || 'newest';
  const assignedToMe = searchParams.get('assignedToMe') === 'true';

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // View toggle
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    loadIncidents();
    loadUsers();
    loadServices();
    loadTeams();
  }, []);

  const loadIncidents = async () => {
    try {
      setIsLoading(true);
      const response = await incidentsAPI.list();
      setIncidents(response.incidents);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to load incidents');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await usersAPI.listUsers();
      setUsers(response.users);
    } catch {
      // Silently fail - users list is optional
    }
  };

  const loadServices = async () => {
    try {
      const response = await servicesAPI.list();
      setServices(response.services);
    } catch {
      // Silently fail
    }
  };

  const loadTeams = async () => {
    try {
      const response = await teamsAPI.list();
      setTeams(response.teams);
    } catch {
      // Silently fail
    }
  };

  // Compute counts
  const counts = useMemo(() => {
    return {
      triggered: incidents.filter((i) => i.state === 'triggered').length,
      acknowledged: incidents.filter((i) => i.state === 'acknowledged').length,
      resolved: incidents.filter((i) => i.state === 'resolved').length,
    };
  }, [incidents]);

  // Filtered and sorted incidents
  const filteredIncidents = useMemo(() => {
    let result = [...incidents];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((i) => i.state === statusFilter);
    }

    // Severity filter
    if (severityFilter !== 'all') {
      result = result.filter((i) => i.severity === severityFilter);
    }

    // Service filter
    if (serviceFilter !== 'all') {
      result = result.filter((i) => i.service?.id === serviceFilter);
    }

    // Assigned to me filter
    if (assignedToMe && currentUser) {
      result = result.filter((i) => i.assignedTo?.id === currentUser.id);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
        case 'oldest':
          return new Date(a.triggeredAt).getTime() - new Date(b.triggeredAt).getTime();
        case 'severity': {
          const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
          return (
            (severityOrder[a.severity as keyof typeof severityOrder] || 4) -
            (severityOrder[b.severity as keyof typeof severityOrder] || 4)
          );
        }
        case 'updated':
          const aTime = a.resolvedAt || a.acknowledgedAt || a.triggeredAt;
          const bTime = b.resolvedAt || b.acknowledgedAt || b.triggeredAt;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [incidents, statusFilter, severityFilter, serviceFilter, assignedToMe, currentUser, sortBy]);

  // Paginated incidents
  const paginatedIncidents = useMemo(() => {
    const start = 0;
    const end = page * pageSize;
    return filteredIncidents.slice(start, end);
  }, [filteredIncidents, page, pageSize]);

  const hasMore = paginatedIncidents.length < filteredIncidents.length;

  // Update URL params
  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all' || value === 'false') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams);
    setPage(1);
  };

  // Selection handlers
  const toggleSelection = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectAll = () => {
    const newSelected = new Set(paginatedIncidents.map((i) => i.id));
    setSelectedIds(newSelected);
  };

  // Single incident actions
  const openResolveModal = (id: string) => {
    setResolveIncidentId(id);
    setShowResolveModal(true);
  };

  const handleResolve = async (note?: string) => {
    if (!resolveIncidentId) return;
    setIsResolving(true);
    try {
      await incidentsAPI.resolve(resolveIncidentId, note);
      setShowResolveModal(false);
      setResolveIncidentId(null);
      showToast.resolve();
      triggerConfetti();
      await loadIncidents();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast.error(error.response?.data?.error || 'Failed to resolve incident');
    } finally {
      setIsResolving(false);
    }
  };

  const openDialog = (type: DialogType, incident: Incident) => {
    setSelectedIncident(incident);
    setActiveDialog(type);
    setError(null);
    setEscalateReason('');
    setReassignUserId('');
    setReassignReason('');
    setSnoozeDuration(60);
  };

  const closeDialog = () => {
    setActiveDialog(null);
    setSelectedIncident(null);
  };

  const handleEscalate = async () => {
    if (!selectedIncident) return;
    setIsSubmitting(true);
    try {
      await incidentsAPI.escalate(selectedIncident.id, escalateReason || undefined);
      showToast.escalate();
      closeDialog();
      await loadIncidents();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast.error(error.response?.data?.error || 'Failed to escalate incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedIncident || !reassignUserId) return;
    setIsSubmitting(true);
    try {
      const result = await incidentsAPI.reassign(
        selectedIncident.id,
        reassignUserId,
        reassignReason || undefined
      );
      showToast.success(result.message);
      closeDialog();
      await loadIncidents();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast.error(error.response?.data?.error || 'Failed to reassign incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSnooze = async () => {
    if (!selectedIncident) return;
    setIsSubmitting(true);
    try {
      await incidentsAPI.snooze(selectedIncident.id, snoozeDuration);
      showToast.success('Incident snoozed');
      closeDialog();
      await loadIncidents();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast.error(error.response?.data?.error || 'Failed to snooze incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk actions
  const handleBulkAcknowledge = async () => {
    setIsSubmitting(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => incidentsAPI.acknowledge(id)));
      showToast.success(`Acknowledged ${ids.length} incident(s)`);
      clearSelection();
      await loadIncidents();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast.error(error.response?.data?.error || 'Failed to acknowledge incidents');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkResolve = () => {
    // For bulk resolve, we'll just show a simple confirmation
    if (selectedIds.size === 1) {
      openResolveModal(Array.from(selectedIds)[0]);
    } else {
      // Bulk resolve without notes
      handleBulkResolveWithoutNote();
    }
  };

  const handleBulkResolveWithoutNote = async () => {
    setIsSubmitting(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => incidentsAPI.resolve(id)));
      showToast.success(`Resolved ${ids.length} incident(s)`);
      triggerConfetti();
      clearSelection();
      await loadIncidents();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast.error(error.response?.data?.error || 'Failed to resolve incidents');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkReassign = () => {
    if (selectedIds.size === 1) {
      const incident = incidents.find((i) => i.id === Array.from(selectedIds)[0]);
      if (incident) {
        openDialog('reassign', incident);
      }
    } else {
      // For multiple, just open a generic reassign dialog
      setActiveDialog('reassign');
    }
  };

  const handleBulkSnooze = () => {
    if (selectedIds.size === 1) {
      const incident = incidents.find((i) => i.id === Array.from(selectedIds)[0]);
      if (incident) {
        openDialog('snooze', incident);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Page Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-700 bg-card">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Incidents
            </h1>
            <Button onClick={() => {/* TODO: Open create modal */}}>
              <Plus className="w-4 h-4" />
              Create Incident
            </Button>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-700 bg-card">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <StatusTab
                label="All"
                active={statusFilter === 'all'}
                onClick={() => updateFilter('status', 'all')}
              />
              <StatusTab
                label="Triggered"
                count={counts.triggered}
                active={statusFilter === 'triggered'}
                onClick={() => updateFilter('status', 'triggered')}
                badgeColor="bg-red-500"
              />
              <StatusTab
                label="Acknowledged"
                count={counts.acknowledged}
                active={statusFilter === 'acknowledged'}
                onClick={() => updateFilter('status', 'acknowledged')}
                badgeColor="bg-yellow-500"
              />
              <StatusTab
                label="Resolved"
                active={statusFilter === 'resolved'}
                onClick={() => updateFilter('status', 'resolved')}
              />
            </div>
            <button
              onClick={() => updateFilter('assignedToMe', assignedToMe ? 'false' : 'true')}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                assignedToMe
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary'
              )}
            >
              Assigned to Me
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border-b border-neutral-200 dark:border-neutral-700 bg-card">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FilterChip
                label="Severity"
                active={severityFilter !== 'all'}
                options={[
                  { value: 'all', label: 'All Severities' },
                  { value: 'critical', label: 'SEV1 - Critical' },
                  { value: 'error', label: 'SEV2 - Error' },
                  { value: 'warning', label: 'SEV3 - Warning' },
                  { value: 'info', label: 'SEV4 - Info' },
                ]}
                value={severityFilter}
                onChange={(v) => updateFilter('severity', v)}
              />
              <FilterChip
                label="Service"
                active={serviceFilter !== 'all'}
                options={[
                  { value: 'all', label: 'All Services' },
                  ...services.map((s) => ({ value: s.id, label: s.name })),
                ]}
                value={serviceFilter}
                onChange={(v) => updateFilter('service', v)}
              />
              <FilterChip
                label="Team"
                active={teamFilter !== 'all'}
                options={[
                  { value: 'all', label: 'All Teams' },
                  ...teams.map((t) => ({ value: t.id, label: t.name })),
                ]}
                value={teamFilter}
                onChange={(v) => updateFilter('team', v)}
              />
            </div>
            <div className="flex items-center gap-3">
              <FilterChip
                label={`Sort: ${
                  sortBy === 'newest'
                    ? 'Newest'
                    : sortBy === 'oldest'
                    ? 'Oldest'
                    : sortBy === 'severity'
                    ? 'Severity'
                    : 'Updated'
                }`}
                active={false}
                options={[
                  { value: 'newest', label: 'Newest First' },
                  { value: 'oldest', label: 'Oldest First' },
                  { value: 'severity', label: 'By Severity' },
                  { value: 'updated', label: 'Recently Updated' },
                ]}
                value={sortBy}
                onChange={(v) => updateFilter('sort', v)}
              />
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-1.5 rounded-l-lg',
                    viewMode === 'list'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  )}
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-1.5 rounded-r-lg',
                    viewMode === 'grid'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 lg:px-10 mt-6">
          <div className="p-4 text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            {error}
            <button className="ml-2 underline hover:no-underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-primary rounded-full animate-spin" />
              Loading incidents...
            </div>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400">
              {statusFilter !== 'all' || severityFilter !== 'all' || serviceFilter !== 'all' || assignedToMe
                ? 'No incidents match your filters'
                : 'No incidents yet'}
            </div>
          </div>
        ) : (
          <div className="bg-card border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* List Header */}
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex-shrink-0">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size > 0 &&
                    selectedIds.size === paginatedIncidents.length &&
                    paginatedIncidents.every((i) => selectedIds.has(i.id))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      selectAll();
                    } else {
                      clearSelection();
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                />
              </div>
              <span className="flex-1">
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : `${filteredIncidents.length} incident${filteredIncidents.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            {/* Incident Rows */}
            {paginatedIncidents.map((incident) => (
              <IncidentRow
                key={incident.id}
                incident={incident}
                selected={selectedIds.has(incident.id)}
                onSelect={(checked) => toggleSelection(incident.id, checked)}
                onClick={() => window.location.href = `/incidents/${incident.id}`}
              />
            ))}

            {/* Load More / Pagination Footer */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Showing {Math.min(paginatedIncidents.length, 1)}-{paginatedIncidents.length} of{' '}
                  {filteredIncidents.length} incidents
                </span>
                {hasMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                  >
                    Load More
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onAcknowledge={handleBulkAcknowledge}
        onResolve={handleBulkResolve}
        onReassign={handleBulkReassign}
        onSnooze={handleBulkSnooze}
        onClear={clearSelection}
        isLoading={isSubmitting}
      />

      {/* Escalate Dialog */}
      <Dialog open={activeDialog === 'escalate'} onClose={closeDialog}>
        <DialogHeader>
          <DialogTitle>Escalate Incident</DialogTitle>
          <DialogDescription>
            Manually escalate to the next step in the escalation policy.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="escalateReason">Reason (optional)</Label>
              <Input
                id="escalateReason"
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder="e.g., Need additional support"
                className="mt-1"
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleEscalate} disabled={isSubmitting}>
            {isSubmitting ? 'Escalating...' : 'Escalate'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={activeDialog === 'reassign'} onClose={closeDialog}>
        <DialogHeader>
          <DialogTitle>Reassign Incident{selectedIds.size > 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            Assign {selectedIds.size > 1 ? 'these incidents' : 'this incident'} to another team
            member.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reassignUser">Assign to</Label>
              <Select
                id="reassignUser"
                value={reassignUserId}
                onChange={(e) => setReassignUserId(e.target.value)}
                className="w-full mt-1"
              >
                <option value="">Select a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName} ({user.email})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="reassignReason">Reason (optional)</Label>
              <Input
                id="reassignReason"
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="e.g., Domain expert needed"
                className="mt-1"
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleReassign} disabled={isSubmitting || !reassignUserId}>
            {isSubmitting ? 'Reassigning...' : 'Reassign'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Snooze Dialog */}
      <Dialog open={activeDialog === 'snooze'} onClose={closeDialog}>
        <DialogHeader>
          <DialogTitle>Snooze Incident</DialogTitle>
          <DialogDescription>
            Temporarily pause notifications for this incident.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="snoozeDuration">Snooze for</Label>
              <Select
                id="snoozeDuration"
                value={snoozeDuration.toString()}
                onChange={(e) => setSnoozeDuration(parseInt(e.target.value))}
                className="w-full mt-1"
              >
                {snoozeDurations.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSnooze} disabled={isSubmitting}>
            {isSubmitting ? 'Snoozing...' : 'Snooze'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Resolve Modal */}
      <ResolveModal
        open={showResolveModal}
        onClose={() => {
          setShowResolveModal(false);
          setResolveIncidentId(null);
        }}
        onResolve={handleResolve}
        isLoading={isResolving}
      />
    </div>
  );
}
