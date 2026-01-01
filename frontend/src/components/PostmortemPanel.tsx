import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, ExternalLink, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { incidentsAPI } from '../lib/api-client';
import { showToast } from './Toast';
import type { Postmortem } from '../types/api';

interface PostmortemPanelProps {
  incidentId: string;
  incidentState: string;
  onRefresh?: () => void;
}

export function PostmortemPanel({
  incidentId,
  incidentState,
  onRefresh,
}: PostmortemPanelProps) {
  const [postmortem, setPostmortem] = useState<Postmortem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const loadPostmortem = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await incidentsAPI.getPostmortem(incidentId);
      setPostmortem(response.postmortem);
      setNotFound(false);
    } catch (error: any) {
      if (error.response?.status === 404) {
        setNotFound(true);
        setPostmortem(null);
      } else {
        console.error('Failed to load postmortem:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    loadPostmortem();
  }, [loadPostmortem]);

  const handleCreatePostmortem = async () => {
    setIsSubmitting(true);
    try {
      await incidentsAPI.createPostmortem(incidentId, title || undefined);
      showToast.success('Postmortem created');
      setShowCreateDialog(false);
      setTitle('');
      await loadPostmortem();
      onRefresh?.();
    } catch (error: any) {
      showToast.error(error.response?.data?.error || 'Failed to create postmortem');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Only show the panel for resolved incidents
  if (incidentState !== 'resolved') {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
            Published
          </span>
        );
      case 'in_review':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
            In Review
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
            Draft
          </span>
        );
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Postmortem
          </CardTitle>
          {notFound && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Create
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          ) : postmortem ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm truncate flex-1 mr-2">
                  {postmortem.title}
                </h4>
                {getStatusBadge(postmortem.status)}
              </div>

              {postmortem.summary && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {postmortem.summary}
                </p>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {postmortem.action_items && postmortem.action_items.length > 0 && (
                  <span>
                    {postmortem.action_items.filter((a: any) => a.completed).length}/
                    {postmortem.action_items.length} action items completed
                  </span>
                )}
                {postmortem.created_by && (
                  <span>by {postmortem.created_by.full_name}</span>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Link to="/postmortems" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
                </Link>
                {postmortem.status !== 'published' && (
                  <Link to="/postmortems" className="flex-1">
                    <Button variant="default" size="sm" className="w-full">
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ) : notFound ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                No postmortem has been created for this incident yet.
              </p>
              <p className="text-xs text-muted-foreground">
                Document lessons learned and action items to prevent similar incidents.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Unable to load postmortem information.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Create Postmortem Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Postmortem</DialogTitle>
            <DialogDescription>
              Create a postmortem to document the incident retrospective and lessons learned.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="postmortem-title">Title (optional)</Label>
              <Input
                id="postmortem-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Postmortem: API Outage on 2025-01-15"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank to auto-generate from incident summary.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePostmortem}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Postmortem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
