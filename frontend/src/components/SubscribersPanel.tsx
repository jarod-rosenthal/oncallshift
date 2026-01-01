import { useState, useEffect, useCallback } from 'react';
import { Bell, UserPlus, X, Mail, MessageSquare, Send, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import api from '../lib/api-client';
import { showToast } from './Toast';

interface Subscriber {
  id: string;
  email: string;
  displayName: string;
  role: 'stakeholder' | 'observer' | 'responder';
  channel: 'email' | 'sms' | 'push' | 'slack' | 'webhook';
  isInternal: boolean;
  confirmed: boolean;
  notifyOnStatusUpdate: boolean;
  notifyOnResolution: boolean;
  user?: { id: string; fullName: string; email: string } | null;
  addedBy?: { id: string; fullName: string } | null;
  createdAt: string;
}

interface StatusUpdate {
  id: string;
  updateType: string;
  typeLabel: string;
  typeColor: string;
  message: string;
  isPublic: boolean;
  notificationsSent: boolean;
  subscriberCount: number;
  postedBy: { id: string; fullName: string; email: string } | null;
  createdAt: string;
}

interface SubscribersPanelProps {
  incidentId: string;
  incidentState: string;
  onRefresh?: () => void;
}

const UPDATE_TYPES = [
  { value: 'investigating', label: 'Investigating', color: 'text-yellow-500' },
  { value: 'identified', label: 'Identified', color: 'text-orange-500' },
  { value: 'monitoring', label: 'Monitoring', color: 'text-blue-500' },
  { value: 'update', label: 'Update', color: 'text-gray-500' },
  { value: 'resolved', label: 'Resolved', color: 'text-green-500' },
];

export function SubscribersPanel({
  incidentId,
  incidentState,
  onRefresh,
}: SubscribersPanelProps) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateType, setUpdateType] = useState('update');
  const [notifySubscribers, setNotifySubscribers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSubscribers = useCallback(async () => {
    try {
      const response = await api.get(`/incidents/${incidentId}/subscribers`);
      setSubscribers(response.data.subscribers);
    } catch (error) {
      console.error('Failed to load subscribers:', error);
    }
  }, [incidentId]);

  const loadStatusUpdates = useCallback(async () => {
    try {
      const response = await api.get(`/incidents/${incidentId}/status-updates`);
      setStatusUpdates(response.data.statusUpdates);
    } catch (error) {
      console.error('Failed to load status updates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    loadSubscribers();
    loadStatusUpdates();
  }, [loadSubscribers, loadStatusUpdates]);

  const handleAddSubscriber = async () => {
    if (!newEmail.trim()) return;
    setIsSubmitting(true);
    try {
      await api.post(`/incidents/${incidentId}/subscribers`, {
        email: newEmail.trim(),
        displayName: newDisplayName.trim() || undefined,
      });
      showToast.success('Subscriber added');
      setShowAddDialog(false);
      setNewEmail('');
      setNewDisplayName('');
      await loadSubscribers();
      onRefresh?.();
    } catch (err: any) {
      showToast.error(err.response?.data?.error || 'Failed to add subscriber');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSubscriber = async (subscriberId: string) => {
    try {
      await api.delete(`/incidents/${incidentId}/subscribers/${subscriberId}`);
      showToast.success('Subscriber removed');
      await loadSubscribers();
      onRefresh?.();
    } catch {
      showToast.error('Failed to remove subscriber');
    }
  };

  const handlePostStatusUpdate = async () => {
    if (!updateMessage.trim()) return;
    setIsSubmitting(true);
    try {
      await api.post(`/incidents/${incidentId}/status-updates`, {
        message: updateMessage.trim(),
        updateType,
        notifySubscribers,
      });
      showToast.success(
        notifySubscribers
          ? `Status update posted and ${subscribers.length} subscriber(s) notified`
          : 'Status update posted'
      );
      setShowUpdateDialog(false);
      setUpdateMessage('');
      setUpdateType('update');
      await loadStatusUpdates();
      onRefresh?.();
    } catch {
      showToast.error('Failed to post status update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getUpdateTypeColor = (type: string) => {
    const found = UPDATE_TYPES.find(t => t.value === type);
    return found?.color || 'text-gray-500';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="w-5 h-5" />
            Subscribers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Subscribers
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddDialog(true)}
          >
            <UserPlus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {/* Subscribers List */}
          {subscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No subscribers yet. Add stakeholders to receive status updates.
            </p>
          ) : (
            <div className="space-y-2 mb-4">
              {subscribers.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      {sub.channel === 'email' ? (
                        <Mail className="w-4 h-4 text-primary" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{sub.displayName}</div>
                      <div className="text-xs text-muted-foreground">{sub.email}</div>
                    </div>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">
                      {sub.role}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSubscriber(sub.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Post Update Button */}
          {incidentState !== 'resolved' && (
            <div className="pt-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowUpdateDialog(true)}
              >
                <Send className="w-4 h-4 mr-2" />
                Post Status Update to Subscribers
              </Button>
            </div>
          )}

          {/* Recent Status Updates */}
          {statusUpdates.length > 0 && (
            <div className="border-t border-border pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">Recent Status Updates</h4>
              <div className="space-y-3">
                {statusUpdates.slice(0, 3).map((update) => (
                  <div
                    key={update.id}
                    className="text-sm border-l-2 border-primary/50 pl-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium ${getUpdateTypeColor(update.updateType)}`}>
                        {update.typeLabel}
                      </span>
                      {update.notificationsSent && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle className="w-3 h-3" />
                          {update.subscriberCount} notified
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground line-clamp-2">{update.message}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      {update.postedBy?.fullName} - {formatDate(update.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Subscriber Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Subscriber</DialogTitle>
            <DialogDescription>
              Add a stakeholder to receive status updates about this incident
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="stakeholder@company.com"
              />
            </div>
            <div>
              <Label htmlFor="displayName">Display Name (optional)</Label>
              <Input
                id="displayName"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSubscriber} disabled={isSubmitting || !newEmail.trim()}>
              {isSubmitting ? 'Adding...' : 'Add Subscriber'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Status Update Dialog */}
      <Dialog open={showUpdateDialog} onClose={() => setShowUpdateDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post Status Update</DialogTitle>
            <DialogDescription>
              Share an update with all subscribers ({subscribers.length} stakeholder{subscribers.length !== 1 ? 's' : ''})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="updateType">Update Type</Label>
              <select
                id="updateType"
                value={updateType}
                onChange={(e) => setUpdateType(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
              >
                {UPDATE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="message">Message *</Label>
              <textarea
                id="message"
                value={updateMessage}
                onChange={(e) => setUpdateMessage(e.target.value)}
                placeholder="Describe the current status..."
                rows={4}
                className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notifySubscribers"
                checked={notifySubscribers}
                onChange={(e) => setNotifySubscribers(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="notifySubscribers">
                Notify subscribers via email
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePostStatusUpdate}
              disabled={isSubmitting || !updateMessage.trim()}
            >
              {isSubmitting ? 'Posting...' : 'Post Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SubscribersPanel;
