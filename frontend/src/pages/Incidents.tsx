import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from '../components/ui/dialog';
import { Select } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { incidentsAPI, usersAPI } from '../lib/api-client';
import type { Incident, User } from '../types/api';

type DialogType = 'escalate' | 'reassign' | null;

export function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dialog state
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [escalateReason, setEscalateReason] = useState('');
  const [reassignUserId, setReassignUserId] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  useEffect(() => {
    loadIncidents();
    loadUsers();
  }, []);

  const loadIncidents = async () => {
    try {
      setIsLoading(true);
      const response = await incidentsAPI.list();
      setIncidents(response.incidents);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load incidents');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await usersAPI.listUsers();
      setUsers(response.users);
    } catch (err) {
      // Silently fail - users list is optional
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await incidentsAPI.acknowledge(id);
      showSuccess('Incident acknowledged');
      await loadIncidents();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to acknowledge incident');
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await incidentsAPI.resolve(id);
      showSuccess('Incident resolved');
      await loadIncidents();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resolve incident');
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
      const result = await incidentsAPI.escalate(
        selectedIncident.id,
        escalateReason || undefined
      );
      showSuccess(result.message);
      closeDialog();
      await loadIncidents();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to escalate incident');
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
      showSuccess(result.message);
      closeDialog();
      await loadIncidents();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reassign incident');
    } finally {
      setIsSubmitting(false);
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

  return (
    <div>
      <main className="container mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Incidents</h2>
          <p className="text-muted-foreground">
            Manage and respond to active incidents
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
            <button
              className="ml-2 underline"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 text-sm text-green-800 bg-green-50 dark:bg-green-900/20 dark:text-green-200 rounded-md">
            {successMessage}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading incidents...</p>
          </div>
        ) : incidents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No incidents found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {incidents.map((incident) => (
              <Card key={incident.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(incident.severity)}`}>
                          {incident.severity.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStateColor(incident.state)}`}>
                          {incident.state.toUpperCase()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          #{incident.incidentNumber}
                        </span>
                        {incident.currentEscalationStep > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Step {incident.currentEscalationStep}
                          </span>
                        )}
                      </div>
                      <CardTitle>
                        <Link
                          to={`/incidents/${incident.id}`}
                          className="hover:underline hover:text-primary"
                        >
                          {incident.summary}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        Service: {incident.service.name} | Triggered: {new Date(incident.triggeredAt).toLocaleString()}
                        {incident.assignedTo && (
                          <> | Assigned to: {incident.assignedTo.fullName}</>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {incident.state === 'triggered' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAcknowledge(incident.id)}
                          >
                            Acknowledge
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDialog('escalate', incident)}
                          >
                            Escalate
                          </Button>
                        </>
                      )}
                      {incident.state !== 'resolved' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDialog('reassign', incident)}
                          >
                            Reassign
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleResolve(incident.id)}
                          >
                            Resolve
                          </Button>
                        </>
                      )}
                      <Link to={`/incidents/${incident.id}`}>
                        <Button variant="ghost" size="sm">
                          View &rarr;
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                {incident.details && (
                  <CardContent>
                    <pre className="text-sm bg-muted p-3 rounded overflow-x-auto">
                      {JSON.stringify(incident.details, null, 2)}
                    </pre>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>

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
          <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleReassign} disabled={isSubmitting || !reassignUserId}>
            {isSubmitting ? 'Reassigning...' : 'Reassign'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
