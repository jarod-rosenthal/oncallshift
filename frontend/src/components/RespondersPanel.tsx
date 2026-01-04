import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Check, X, Clock, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from './ui/dialog';
import { Select } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { incidentsAPI, usersAPI } from '../lib/api-client';
import { showToast } from './Toast';
import type { User } from '../types/api';

interface Responder {
  id: string;
  userId: string;
  user: { id: string; fullName: string; email: string };
  requestedBy: { id: string; fullName: string; email: string };
  status: 'pending' | 'accepted' | 'declined';
  message: string | null;
  respondedAt: string | null;
  createdAt: string;
}

interface RespondersPanelProps {
  incidentId: string;
  incidentState: string;
  currentUserId?: string;
  onRefresh?: () => void;
}

export function RespondersPanel({
  incidentId,
  incidentState,
  currentUserId,
  onRefresh,
}: RespondersPanelProps) {
  const [responders, setResponders] = useState<Responder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadResponders = useCallback(async () => {
    try {
      const response = await incidentsAPI.getResponders(incidentId);
      setResponders(response?.responders || []);
    } catch (error) {
      console.error('Failed to load responders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [incidentId]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await usersAPI.listUsers();
      setUsers(response?.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  useEffect(() => {
    loadResponders();
    loadUsers();
  }, [loadResponders, loadUsers]);

  const handleAddResponders = async () => {
    if (selectedUserIds.length === 0) return;
    setIsSubmitting(true);
    try {
      await incidentsAPI.addResponders(incidentId, selectedUserIds, requestMessage || undefined);
      showToast.success('Responder request sent');
      setShowAddDialog(false);
      setSelectedUserIds([]);
      setRequestMessage('');
      await loadResponders();
      onRefresh?.();
    } catch {
      showToast.error('Failed to add responders');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespondToRequest = async (responderId: string, accept: boolean) => {
    setIsSubmitting(true);
    try {
      await incidentsAPI.respondToRequest(incidentId, responderId, accept);
      showToast.success(accept ? 'Request accepted' : 'Request declined');
      await loadResponders();
      onRefresh?.();
    } catch {
      showToast.error('Failed to respond to request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Check className="w-4 h-4 text-success" />;
      case 'declined':
        return <X className="w-4 h-4 text-danger" />;
      default:
        return <Clock className="w-4 h-4 text-warning" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'Accepted';
      case 'declined':
        return 'Declined';
      default:
        return 'Pending';
    }
  };

  // Filter out users who are already responders
  const availableUsers = users.filter(
    (user) => !responders.some((r) => r.userId === user.id)
  );

  // Check if current user has a pending request
  const myPendingRequest = responders.find(
    (r) => r.userId === currentUserId && r.status === 'pending'
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Responders
          </CardTitle>
          {incidentState !== 'resolved' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddDialog(true)}
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Add
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-neutral-500">Loading...</p>
          ) : responders.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No additional responders requested yet.
            </p>
          ) : (
            <div className="space-y-3">
              {responders.map((responder) => (
                <div
                  key={responder.id}
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {responder.user.fullName}
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        {getStatusIcon(responder.status)}
                        {getStatusText(responder.status)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {responder.user.email}
                    </p>
                    {responder.message && (
                      <p className="text-xs text-neutral-600 mt-1 italic">
                        "{responder.message}"
                      </p>
                    )}
                    <p className="text-xs text-neutral-400 mt-1">
                      Requested by {responder.requestedBy.fullName}
                    </p>
                  </div>

                  {/* Show accept/decline buttons if this is my pending request */}
                  {responder.userId === currentUserId &&
                    responder.status === 'pending' && (
                      <div className="flex gap-2 ml-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRespondToRequest(responder.id, true)}
                          disabled={isSubmitting}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRespondToRequest(responder.id, false)}
                          disabled={isSubmitting}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}

          {/* Pending request banner for current user */}
          {myPendingRequest && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800 font-medium">
                You've been requested to help with this incident
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={() => handleRespondToRequest(myPendingRequest.id, true)}
                  disabled={isSubmitting}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRespondToRequest(myPendingRequest.id, false)}
                  disabled={isSubmitting}
                >
                  Decline
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Responders Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)}>
        <DialogHeader>
          <DialogTitle>Request Additional Responders</DialogTitle>
          <DialogDescription>
            Request help from team members. They'll receive a notification and can accept or decline.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="responderUser">Select responders</Label>
              <Select
                id="responderUser"
                value=""
                onChange={(e) => {
                  const userId = e.target.value;
                  if (userId && !selectedUserIds.includes(userId)) {
                    setSelectedUserIds([...selectedUserIds, userId]);
                  }
                }}
                className="w-full mt-1"
              >
                <option value="">Add a responder...</option>
                {availableUsers
                  .filter((u) => !selectedUserIds.includes(u.id))
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} ({user.email})
                    </option>
                  ))}
              </Select>
            </div>

            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedUserIds.map((userId) => {
                  const user = users.find((u) => u.id === userId);
                  return (
                    <span
                      key={userId}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 rounded-full text-sm"
                    >
                      {user?.fullName}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedUserIds(selectedUserIds.filter((id) => id !== userId))
                        }
                        className="text-neutral-500 hover:text-neutral-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div>
              <Label htmlFor="requestMessage">Message (optional)</Label>
              <Input
                id="requestMessage"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="e.g., Need help with database investigation"
                className="mt-1"
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowAddDialog(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddResponders}
            disabled={isSubmitting || selectedUserIds.length === 0}
          >
            {isSubmitting ? 'Sending...' : `Request ${selectedUserIds.length} Responder${selectedUserIds.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
