import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Filter } from 'lucide-react';
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
import { PageHeader } from '../components/layout/PageHeader';
import { Section } from '../components/layout/Section';
import { IncidentCard } from '../components/incidents/IncidentCard';
import { MetricsCard } from '../components/incidents/MetricsCard';
import { EmptyState } from '../components/EmptyState';
import { showToast } from '../components/Toast';
import { triggerConfetti } from '../components/Confetti';
import { ResolveModal } from '../components/ResolveModal';
import { incidentsAPI, usersAPI } from '../lib/api-client';
import { notifyIncidentChanged, onIncidentChanged } from '../lib/incident-events';
import type { Incident, User } from '../types/api';

type DialogType = 'escalate' | 'reassign' | null;

export function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resolve modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveIncidentId, setResolveIncidentId] = useState<string | null>(
    null
  );
  const [isResolving, setIsResolving] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
  const [escalateReason, setEscalateReason] = useState('');
  const [reassignUserId, setReassignUserId] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  const loadIncidents = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await incidentsAPI.list();
      const list = response?.incidents || [];
      setIncidents(list);
      // Keep sidebar indicator in sync
      notifyIncidentChanged();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to load incidents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const response = await usersAPI.listUsers();
      setUsers(response?.users || []);
    } catch {
      // Silently fail - users list is optional
    }
  }, []);

  const mergeIncidents = useCallback((incoming: Incident[]) => {
    setIncidents((prev) => {
      const map = new Map<string, Incident>();
      prev.forEach((inc) => map.set(inc.id, inc));
      incoming.forEach((inc) => map.set(inc.id, inc));
      return Array.from(map.values()).sort(
        (a, b) =>
          new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
      );
    });
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(loadIncidents, 15000);
  }, [loadIncidents]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    loadIncidents();
    loadUsers();

    const token = localStorage.getItem('accessToken');
    if (token) {
      const es = new EventSource(`/api/v1/incidents/stream?token=${token}`);
      eventSourceRef.current = es;

      es.addEventListener('open', () => {
        stopPolling();
      });

      es.addEventListener('incident_update', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data);
          if (payload?.incidents) {
            mergeIncidents(payload.incidents as Incident[]);
            notifyIncidentChanged();
          }
        } catch (e) {
          console.error('Failed to process incident_update event', e);
        }
      });

      es.addEventListener('error', () => {
        // Close and fall back to polling if SSE fails
        es.close();
        startPolling();
      });
    }
    // If no token (should not happen when authenticated), fall back to polling
    if (!token) {
      startPolling();
    }

    const unsubscribe = onIncidentChanged(loadIncidents);
    return () => {
      unsubscribe();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      stopPolling();
    };
  }, [loadIncidents, loadUsers, mergeIncidents, startPolling, stopPolling]);

  const handleAcknowledge = async (id: string) => {
    try {
      await incidentsAPI.acknowledge(id);
      showToast.acknowledge();
      notifyIncidentChanged(); // Update sidebar badge immediately
      await loadIncidents();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast.error(
        error.response?.data?.error || 'Failed to acknowledge incident'
      );
    }
  };

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
      notifyIncidentChanged(); // Update sidebar badge immediately
      await loadIncidents();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast.error(
        error.response?.data?.error || 'Failed to resolve incident'
      );
    } finally {
      setIsResolving(false);
    }
  };

  const openDialog = (type: DialogType, incident: Incident) => {
    setSelectedIncident(incident);
    setActiveDialog(type);
    setError(null);
    // Reset form values
    setEscalateReason('');
    setReassignUserId('');
    setReassignReason('');
  };

  const closeDialog = () => {
    setActiveDialog(null);
    setSelectedIncident(null);
  };

  const handleEscalate = async () => {
    if (!selectedIncident) return;
    setIsSubmitting(true);
    try {
      await incidentsAPI.escalate(
        selectedIncident.id,
        escalateReason || undefined
      );
      showToast.escalate();
      closeDialog();
      await loadIncidents();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      showToast.error(
        error.response?.data?.error || 'Failed to escalate incident'
      );
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
      showToast.error(
        error.response?.data?.error || 'Failed to reassign incident'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Separate active and resolved incidents
  const activeIncidents = incidents.filter((i) => i.state !== 'resolved');
  const resolvedIncidents = incidents.filter((i) => i.state === 'resolved');

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <PageHeader
        title="Incidents"
        subtitle="Monitor and manage all incidents across your services"
        primaryAction={{
          label: 'Create Incident',
          onClick: () => {},
          icon: <Plus className="w-4 h-4" />,
        }}
        secondaryActions={[
          {
            label: 'Filters',
            onClick: () => {},
            icon: <Filter className="w-4 h-4" />,
            variant: 'outline',
          },
        ]}
      />

      {/* Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 lg:px-10 mt-6">
          <div className="p-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg">
            {error}
            <button
              className="ml-2 underline hover:no-underline"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
          <div className="text-center">
            <p className="text-body-lg text-neutral-600">
              Loading incidents...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Active Incidents Section */}
          <Section title="Active Incidents" className="pt-8">
            {activeIncidents.length === 0 ? (
              <div className="bg-card border border-neutral-300 rounded-lg">
                <EmptyState preset="no-incidents" />
              </div>
            ) : (
              <div className="space-y-4">
                {activeIncidents.map((incident) => (
                  <IncidentCard
                    key={incident.id}
                    incident={incident}
                    onAcknowledge={() => handleAcknowledge(incident.id)}
                    onResolve={() => openResolveModal(incident.id)}
                    onEscalate={() => openDialog('escalate', incident)}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Metrics Section */}
          {incidents.length > 0 && (
            <Section variant="accent" className="mt-0">
              <MetricsCard incidents={incidents} />
            </Section>
          )}

          {/* Resolved Incidents Section */}
          {resolvedIncidents.length > 0 && (
            <Section title="Recently Resolved" className="pb-12">
              <details className="group">
                <summary className="cursor-pointer text-body-md text-neutral-600 hover:text-neutral-900 transition-colors list-none">
                  <span className="inline-flex items-center gap-2">
                    <span className="group-open:rotate-90 transition-transform">
                      ▶
                    </span>
                    Show {resolvedIncidents.length} resolved incident
                    {resolvedIncidents.length !== 1 ? 's' : ''}
                  </span>
                </summary>
                <div className="mt-4 space-y-4">
                  {resolvedIncidents.map((incident) => (
                    <IncidentCard
                      key={incident.id}
                      incident={incident}
                      readOnly
                    />
                  ))}
                </div>
              </details>
            </Section>
          )}
        </>
      )}

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
          <Button
            variant="outline"
            onClick={closeDialog}
            disabled={isSubmitting}
          >
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
          <DialogTitle>Reassign Incident</DialogTitle>
          <DialogDescription>
            Assign this incident to another team member.
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
          <Button
            variant="outline"
            onClick={closeDialog}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReassign}
            disabled={isSubmitting || !reassignUserId}
          >
            {isSubmitting ? 'Reassigning...' : 'Reassign'}
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
