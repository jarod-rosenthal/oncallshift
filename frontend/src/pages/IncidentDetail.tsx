import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Navigation } from '../components/Navigation';
import { IncidentActions } from '../components/IncidentActions';
import { IncidentTimeline } from '../components/IncidentTimeline';
import { EscalationStatusPanel } from '../components/EscalationStatusPanel';
import { RunbookPanel } from '../components/RunbookPanel';
import { RelatedIncidents } from '../components/RelatedIncidents';
import { ResolveModal } from '../components/ResolveModal';
import { incidentsAPI, usersAPI } from '../lib/api-client';
import type { Incident, User, EscalationStatus, IncidentEvent } from '../types/api';

export function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [escalation, setEscalation] = useState<EscalationStatus | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTimelineLoading, setIsTimelineLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAIChatActive, setIsAIChatActive] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const loadIncidentData = useCallback(async (isInitialLoad = false) => {
    if (!id) return;

    try {
      // Only show loading spinner on initial load, not during auto-refresh
      // This prevents unmounting components (like RunbookPanel) and losing their state
      if (isInitialLoad) {
        setIsLoading(true);
      }
      const response = await incidentsAPI.get(id);
      setIncident(response.incident);
      setEscalation(response.escalation);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Incident not found');
      } else {
        setError(err.response?.data?.error || 'Failed to load incident');
      }
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, [id]);

  const loadTimeline = useCallback(async () => {
    if (!id) return;

    try {
      setIsTimelineLoading(true);
      const response = await incidentsAPI.getTimeline(id);
      setEvents(response.events);
    } catch (err: any) {
      // Timeline is non-critical, don't show error
      console.error('Failed to load timeline:', err);
    } finally {
      setIsTimelineLoading(false);
    }
  }, [id]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await usersAPI.listUsers();
      setUsers(response.users);
    } catch (err) {
      // Users list is optional
    }
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await usersAPI.getMe();
      setCurrentUser(response.user);
    } catch (err) {
      // Current user is optional for delete button display
    }
  }, []);

  useEffect(() => {
    loadIncidentData(true); // Initial load - show loading spinner
    loadTimeline();
    loadUsers();
    loadCurrentUser();
  }, [loadIncidentData, loadTimeline, loadUsers, loadCurrentUser]);

  // Auto-refresh data every 30 seconds for active incidents
  // Pause refresh when AI chat is active to avoid disrupting the conversation
  const incidentId = incident?.id;
  const incidentState = incident?.state;

  useEffect(() => {
    // Don't auto-refresh if incident is resolved or AI chat is active
    if (!incidentId || incidentState === 'resolved' || isAIChatActive) return;

    const interval = setInterval(() => {
      loadIncidentData();
      loadTimeline();
    }, 30000);

    return () => clearInterval(interval);
  }, [incidentId, incidentState, isAIChatActive, loadIncidentData, loadTimeline]);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const refreshData = async () => {
    await Promise.all([loadIncidentData(), loadTimeline()]);
  };

  // Action handlers
  const handleAcknowledge = async () => {
    if (!id) return;
    await incidentsAPI.acknowledge(id);
    showSuccess('Incident acknowledged');
    await refreshData();
  };

  const handleResolve = async (note?: string) => {
    if (!id) return;
    setIsResolving(true);
    try {
      await incidentsAPI.resolve(id, note);
      setShowResolveModal(false);
      showSuccess('Incident resolved');
      await refreshData();
    } finally {
      setIsResolving(false);
    }
  };

  const handleUnacknowledge = async () => {
    if (!id) return;
    await incidentsAPI.unacknowledge(id);
    showSuccess('Incident unacknowledged');
    await refreshData();
  };

  const handleUnresolve = async () => {
    if (!id) return;
    await incidentsAPI.unresolve(id);
    showSuccess('Incident reopened');
    await refreshData();
  };

  const handleEscalate = async (reason?: string) => {
    if (!id) return;
    const result = await incidentsAPI.escalate(id, reason);
    showSuccess(result.message);
    await refreshData();
  };

  const handleReassign = async (userId: string, reason?: string) => {
    if (!id) return;
    const result = await incidentsAPI.reassign(id, userId, reason);
    showSuccess(result.message);
    await refreshData();
  };

  const handleAddNote = async (content: string) => {
    if (!id) return;
    await incidentsAPI.addNote(id, content);
    showSuccess('Note added');
    await loadTimeline();
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await incidentsAPI.delete(id);
      navigate('/incidents', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete incident');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'error':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'triggered':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDuration = (startDate: string, endDate?: string | null) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
    if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
    return `${diffMins}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading incident...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <Link to="/incidents">
            <Button variant="ghost" size="sm" className="mb-4">
              &larr; Back to Incidents
            </Button>
          </Link>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive">{error || 'Incident not found'}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate('/incidents')}
              >
                Return to Incidents
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        {/* Back button */}
        <Link to="/incidents">
          <Button variant="ghost" size="sm" className="mb-4">
            &larr; Back to Incidents
          </Button>
        </Link>

        {/* Success message */}
        {successMessage && (
          <div className="mb-4 p-4 text-sm text-green-800 bg-green-50 dark:bg-green-900/20 dark:text-green-200 rounded-md">
            {successMessage}
          </div>
        )}

        {/* Incident Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(incident.severity)}`}>
                    {incident.severity.toUpperCase()}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStateColor(incident.state)}`}>
                    {incident.state.toUpperCase()}
                  </span>
                  {incident.isSnoozed && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      SNOOZED
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    #{incident.incidentNumber}
                  </span>
                </div>
                <CardTitle className="text-2xl mb-2">{incident.summary}</CardTitle>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium">Service:</span> {incident.service.name}
                  </p>
                  <p>
                    <span className="font-medium">Triggered:</span> {new Date(incident.triggeredAt).toLocaleString()}
                    {' '}
                    <span className="text-xs">
                      ({formatDuration(incident.triggeredAt, incident.resolvedAt)} {incident.state === 'resolved' ? 'total' : 'open'})
                    </span>
                  </p>
                  {incident.acknowledgedAt && incident.acknowledgedBy && (
                    <p>
                      <span className="font-medium">Acknowledged:</span> {new Date(incident.acknowledgedAt).toLocaleString()}
                      {' by '}{incident.acknowledgedBy.fullName || incident.acknowledgedBy.email}
                    </p>
                  )}
                  {incident.resolvedAt && incident.resolvedBy && (
                    <p>
                      <span className="font-medium">Resolved:</span> {new Date(incident.resolvedAt).toLocaleString()}
                      {' by '}{incident.resolvedBy.fullName || incident.resolvedBy.email}
                    </p>
                  )}
                  {incident.assignedTo && (
                    <p>
                      <span className="font-medium">Assigned to:</span> {incident.assignedTo.fullName || incident.assignedTo.email}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Incident Details */}
          {incident.details && Object.keys(incident.details).length > 0 && (
            <CardContent className="border-t">
              <h4 className="text-sm font-medium mb-2">Details</h4>
              <pre className="text-sm bg-muted p-3 rounded overflow-x-auto max-h-64">
                {JSON.stringify(incident.details, null, 2)}
              </pre>
            </CardContent>
          )}
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Actions and Escalation Status */}
          <div className="space-y-6">
            {/* Actions */}
            <IncidentActions
              incident={incident}
              users={users}
              onAcknowledge={handleAcknowledge}
              onResolve={async () => setShowResolveModal(true)}
              onUnacknowledge={handleUnacknowledge}
              onUnresolve={handleUnresolve}
              onEscalate={handleEscalate}
              onReassign={handleReassign}
              onAddNote={handleAddNote}
            />

            {/* Related Incidents */}
            <RelatedIncidents currentIncident={incident} />

            {/* Escalation Status */}
            <EscalationStatusPanel
              escalation={escalation}
              isSnoozed={incident.isSnoozed}
              snoozedUntil={incident.snoozedUntil}
            />
          </div>

          {/* Right Column: Runbook and Timeline (spans 2 columns on large screens) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Runbook */}
            <RunbookPanel
              incident={incident}
              onAddNote={handleAddNote}
              onAIChatActiveChange={setIsAIChatActive}
            />

            {/* Timeline */}
            <IncidentTimeline events={events} isLoading={isTimelineLoading} />
          </div>
        </div>

        {/* Admin Actions - Delete Incident */}
        {currentUser?.role === 'admin' && (
          <Card className="mt-8 border-destructive/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-destructive">Admin Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Incident
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-destructive">Delete Incident</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete incident #{incident.incidentNumber}? This action cannot be undone and will remove all associated timeline events and notes.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
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

      {/* Resolve Modal */}
      <ResolveModal
        open={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        onResolve={handleResolve}
        isLoading={isResolving}
      />
    </div>
  );
}
