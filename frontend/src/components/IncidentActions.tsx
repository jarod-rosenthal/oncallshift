import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from './ui/dialog';
import { Select } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { Incident, User } from '../types/api';

interface IncidentActionsProps {
  incident: Incident;
  users: User[];
  onAcknowledge: () => Promise<void>;
  onResolve: () => Promise<void>;
  onUnacknowledge: () => Promise<void>;
  onUnresolve: () => Promise<void>;
  onEscalate: (reason?: string) => Promise<void>;
  onReassign: (userId: string, reason?: string) => Promise<void>;
  onAddNote: (content: string) => Promise<void>;
}

type DialogType = 'escalate' | 'reassign' | 'note' | null;

export function IncidentActions({
  incident,
  users,
  onAcknowledge,
  onResolve,
  onUnacknowledge,
  onUnresolve,
  onEscalate,
  onReassign,
  onAddNote,
}: IncidentActionsProps) {
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [escalateReason, setEscalateReason] = useState('');
  const [reassignUserId, setReassignUserId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const closeDialog = () => {
    setActiveDialog(null);
    setEscalateReason('');
    setReassignUserId('');
    setReassignReason('');
    setNoteContent('');
  };

  const handleEscalate = async () => {
    setIsSubmitting(true);
    try {
      await onEscalate(escalateReason || undefined);
      closeDialog();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignUserId) return;
    setIsSubmitting(true);
    try {
      await onReassign(reassignUserId, reassignReason || undefined);
      closeDialog();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddNote(noteContent);
      closeDialog();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledge = async () => {
    setIsSubmitting(true);
    try {
      await onAcknowledge();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    setIsSubmitting(true);
    try {
      await onResolve();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnacknowledge = async () => {
    setIsSubmitting(true);
    try {
      await onUnacknowledge();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnresolve = async () => {
    setIsSubmitting(true);
    try {
      await onUnresolve();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Primary Actions */}
          {incident.state === 'triggered' && (
            <Button
              className="w-full"
              onClick={handleAcknowledge}
              disabled={isSubmitting}
            >
              Acknowledge
            </Button>
          )}

          {incident.state !== 'resolved' && (
            <Button
              className="w-full"
              variant="default"
              onClick={handleResolve}
              disabled={isSubmitting}
            >
              Resolve
            </Button>
          )}

          {/* Undo Actions - for fat finger mistakes */}
          {incident.state === 'acknowledged' && (
            <Button
              className="w-full"
              variant="outline"
              onClick={handleUnacknowledge}
              disabled={isSubmitting}
            >
              Unacknowledge (Undo)
            </Button>
          )}

          {incident.state === 'resolved' && (
            <Button
              className="w-full"
              variant="outline"
              onClick={handleUnresolve}
              disabled={isSubmitting}
            >
              Reopen Incident
            </Button>
          )}

          {/* Secondary Actions */}
          {incident.state === 'triggered' && (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => setActiveDialog('escalate')}
              disabled={isSubmitting}
            >
              Escalate Now
            </Button>
          )}

          {incident.state !== 'resolved' && (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => setActiveDialog('reassign')}
              disabled={isSubmitting}
            >
              Reassign
            </Button>
          )}

          {/* Add Note - always available */}
          <Button
            className="w-full"
            variant="ghost"
            onClick={() => setActiveDialog('note')}
            disabled={isSubmitting}
          >
            Add Note
          </Button>
        </CardContent>
      </Card>

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

      {/* Add Note Dialog */}
      <Dialog open={activeDialog === 'note'} onClose={closeDialog}>
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
          <DialogDescription>
            Add a note to the incident timeline.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="noteContent">Note</Label>
              <textarea
                id="noteContent"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Enter your note..."
                className="w-full mt-1 min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleAddNote} disabled={isSubmitting || !noteContent.trim()}>
            {isSubmitting ? 'Adding...' : 'Add Note'}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
