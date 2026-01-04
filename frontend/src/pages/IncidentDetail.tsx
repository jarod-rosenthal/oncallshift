import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, User as UserIcon, Server, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { PageHeader } from '../components/layout/PageHeader';
import { Section } from '../components/layout/Section';
import { SeverityBadge } from '../components/incidents/SeverityBadge';
import { StateBadge } from '../components/incidents/StateBadge';
import { IncidentActions } from '../components/IncidentActions';
import { IncidentTimeline } from '../components/IncidentTimeline';
import { EscalationStatusPanel } from '../components/EscalationStatusPanel';
import { NotificationStatusPanel } from '../components/NotificationStatusPanel';
import { RunbookPanel } from '../components/RunbookPanel';
import { SimilarIncidentHint } from '../components/SimilarIncidentHint';
import { ResolveModal } from '../components/ResolveModal';
import { RespondersPanel } from '../components/RespondersPanel';
import { SubscribersPanel } from '../components/SubscribersPanel';
import { ConferenceBridgePanel } from '../components/ConferenceBridgePanel';
import { PostmortemPanel } from '../components/PostmortemPanel';
import { StickyActionBar, StickyActionBarSpacer } from '../components/StickyActionBar';
import { showToast } from '../components/Toast';
import { triggerConfetti } from '../components/Confetti';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const loadIncidentData = useCallback(async (isInitialLoad = false) => {
    if (!id) return;

    try {
      if (isInitialLoad) {
        setIsLoading(true);
      }
      const response = await incidentsAPI.get(id);
      setIncident(response.incident);
      setEscalation(response.escalation);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string } } };
      if (error.response?.status === 404) {
        setError('Incident not found');
      } else {
        setError(error.response?.data?.error || 'Failed to load incident');
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
      setEvents(response?.events || []);
    } catch {
      console.error('Failed to load timeline');
    } finally {
      setIsTimelineLoading(false);
    }
  }, [id]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await usersAPI.listUsers();
      setUsers(response?.users || []);
    } catch {
      // Users list is optional
    }
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await usersAPI.getMe();
      setCurrentUser(response.user);
    } catch {
      // Current user is optional
    }
  }, []);

  useEffect(() => {
    loadIncidentData(true);
    loadTimeline();
    loadUsers();
    loadCurrentUser();
  }, [loadIncidentData, loadTimeline, loadUsers, loadCurrentUser]);

  // Auto-refresh for active incidents
  const incidentId = incident?.id;
  const incidentState = incident?.state;

  useEffect(() => {
    if (!incidentId || incidentState === 'resolved') return;

    const interval = setInterval(() => {
      loadIncidentData();
      loadTimeline();
    }, 30000);

    return () => clearInterval(interval);
  }, [incidentId, incidentState, loadIncidentData, loadTimeline]);

  const refreshData = async () => {
    await Promise.all([loadIncidentData(), loadTimeline()]);
  };

  // Action handlers
  const handleAcknowledge = async () => {
    if (!id) return;
    try {
      await incidentsAPI.acknowledge(id);
      showToast.acknowledge();
      await refreshData();
    } catch {
      showToast.error('Failed to acknowledge incident');
    }
  };

  const handleResolve = async (note?: string) => {
    if (!id) return;
    setIsResolving(true);
    try {
      await incidentsAPI.resolve(id, note);
      setShowResolveModal(false);
      showToast.resolve();
      triggerConfetti();
      await refreshData();
    } catch {
      showToast.error('Failed to resolve incident');
    } finally {
      setIsResolving(false);
    }
  };

  const handleUnacknowledge = async () => {
    if (!id) return;
    try {
      await incidentsAPI.unacknowledge(id);
      showToast.success('Incident unacknowledged');
      await refreshData();
    } catch {
      showToast.error('Failed to unacknowledge incident');
    }
  };

  const handleUnresolve = async () => {
    if (!id) return;
    try {
      await incidentsAPI.unresolve(id);
      showToast.success('Incident reopened');
      await refreshData();
    } catch {
      showToast.error('Failed to reopen incident');
    }
  };

  const handleEscalate = async (reason?: string) => {
    if (!id) return;
    try {
      await incidentsAPI.escalate(id, reason);
      showToast.escalate();
      await refreshData();
    } catch {
      showToast.error('Failed to escalate incident');
    }
  };

  const handleReassign = async (userId: string, reason?: string) => {
    if (!id) return;
    try {
      const result = await incidentsAPI.reassign(id, userId, reason);
      showToast.success(result.message);
      await refreshData();
    } catch {
      showToast.error('Failed to reassign incident');
    }
  };

  const handleAddNote = async (content: string) => {
    if (!id) return;
    try {
      await incidentsAPI.addNote(id, content);
      showToast.noteAdded();
      await loadTimeline();
    } catch {
      showToast.error('Failed to add note');
    }
  };

  const handleSnooze = async (duration: number) => {
    if (!id) return;
    try {
      await incidentsAPI.snooze(id, duration);
      showToast.success('Incident snoozed');
      await refreshData();
    } catch {
      showToast.error('Failed to snooze incident');
    }
  };

  const handleUnsnooze = async () => {
    if (!id) return;
    try {
      await incidentsAPI.unsnooze(id);
      showToast.success('Snooze cancelled');
      await refreshData();
    } catch {
      showToast.error('Failed to cancel snooze');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await incidentsAPI.delete(id);
      showToast.success('Incident deleted');
      navigate('/incidents', { replace: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast.error(error.response?.data?.error || 'Failed to delete incident');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl xl:max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-6 lg:px-10 py-12">
          <div className="text-center">
            <p className="text-body-lg text-neutral-600">Loading incident...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !incident) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title="Incident Not Found"
          breadcrumb={{ label: 'Back to Incidents', href: '/incidents' }}
        />
        <div className="max-w-7xl xl:max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-6 lg:px-10 py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-danger text-body-lg">{error || 'Incident not found'}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate('/incidents')}
              >
                Return to Incidents
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <PageHeader
        title={`#${incident.incidentNumber}: ${incident.summary}`}
        breadcrumb={{ label: 'Back to Incidents', href: '/incidents' }}
      >
        {/* Badges and metadata in header */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <SeverityBadge severity={incident.severity} />
          <StateBadge state={incident.state} />
          <span className="text-body-sm text-neutral-500">
            <Clock className="w-4 h-4 inline mr-1" />
            {formatDuration(incident.triggeredAt, incident.resolvedAt)} {incident.state === 'resolved' ? 'total' : 'open'}
          </span>
        </div>
      </PageHeader>

      {/* Main Content */}
      <div className="max-w-7xl xl:max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-6 lg:px-10 py-8">
        {/* Incident Summary Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-start gap-3">
                <Server className="w-5 h-5 text-neutral-400 mt-0.5" />
                <div>
                  <p className="text-body-sm text-neutral-500">Service</p>
                  <p className="text-body-md text-neutral-900 font-medium">{incident.service.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-neutral-400 mt-0.5" />
                <div>
                  <p className="text-body-sm text-neutral-500">Triggered</p>
                  <p className="text-body-md text-neutral-900 font-medium">
                    {new Date(incident.triggeredAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {incident.assignedTo && (
                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-neutral-400 mt-0.5" />
                  <div>
                    <p className="text-body-sm text-neutral-500">Assigned To</p>
                    <p className="text-body-md text-neutral-900 font-medium">
                      {incident.assignedTo.fullName || incident.assignedTo.email}
                    </p>
                  </div>
                </div>
              )}
              {incident.acknowledgedAt && incident.acknowledgedBy && (
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-neutral-400 mt-0.5" />
                  <div>
                    <p className="text-body-sm text-neutral-500">Acknowledged</p>
                    <p className="text-body-md text-neutral-900 font-medium">
                      {new Date(incident.acknowledgedAt).toLocaleString()}
                    </p>
                    <p className="text-body-xs text-neutral-500">
                      by {incident.acknowledgedBy.fullName || incident.acknowledgedBy.email}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Alert Details */}
            {incident.details && Object.keys(incident.details).length > 0 && (
              <div className="mt-6 pt-6 border-t border-neutral-200">
                <h4 className="text-heading-sm text-neutral-900 mb-3">Alert Details</h4>
                <pre className="text-body-sm bg-neutral-900 text-neutral-100 p-4 rounded-lg overflow-x-auto max-h-48 font-mono">
                  {JSON.stringify(incident.details, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Similar Incident Hint */}
        {incident.state !== 'resolved' && (
          <div className="mb-6">
            <SimilarIncidentHint currentIncident={incident} />
          </div>
        )}

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Actions and Context */}
          <div className="space-y-6">
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
              onSnooze={handleSnooze}
              onUnsnooze={handleUnsnooze}
            />

            <ConferenceBridgePanel
              incidentId={incident.id}
              incidentState={incident.state}
              onRefresh={refreshData}
            />

            <RespondersPanel
              incidentId={incident.id}
              incidentState={incident.state}
              currentUserId={currentUser?.id}
              onRefresh={refreshData}
            />

            <SubscribersPanel
              incidentId={incident.id}
              incidentState={incident.state}
              onRefresh={refreshData}
            />

            <PostmortemPanel
              incidentId={incident.id}
              incidentState={incident.state}
              onRefresh={refreshData}
            />

            <EscalationStatusPanel
              escalation={escalation}
              onEscalateNow={() => handleEscalate('Manual escalation from incident detail')}
            />

            <NotificationStatusPanel incidentId={incident.id} />
          </div>

          {/* Right Column: Runbook and Timeline */}
          <div className="lg:col-span-2 space-y-6">
            <RunbookPanel
              incident={incident}
              onAddNote={handleAddNote}
            />

            <IncidentTimeline events={events} isLoading={isTimelineLoading} />
          </div>
        </div>

        {/* Admin Actions */}
        {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
          <Section variant="card" className="mt-8 border-danger/30">
            <h3 className="text-heading-sm text-danger mb-4">Admin Actions</h3>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Incident
            </Button>
          </Section>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-danger">Delete Incident</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-body-md text-neutral-600">
                Are you sure you want to delete incident #{incident.incidentNumber}? This action cannot be undone.
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

      {/* Sticky Action Bar */}
      <StickyActionBar
        state={incident.state as 'triggered' | 'acknowledged' | 'resolved'}
        onAcknowledge={handleAcknowledge}
        onResolve={() => setShowResolveModal(true)}
        onEscalate={() => handleEscalate('Quick escalation from action bar')}
        onAddNote={() => {
          const actionsCard = document.querySelector('[data-actions-card]');
          actionsCard?.scrollIntoView({ behavior: 'smooth' });
        }}
        isLoading={isResolving}
      />
      <StickyActionBarSpacer />
    </div>
  );
}
