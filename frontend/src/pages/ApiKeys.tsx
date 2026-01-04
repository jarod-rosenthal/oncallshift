import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Plus, Key, Trash2, RefreshCw, Copy, Check, AlertTriangle } from 'lucide-react';
import apiClient from '../lib/api-client';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  created_by: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

export function ApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [rotateConfirmId, setRotateConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadApiKeys = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/api-keys');
      // Backend returns data in 'apiKeys' (camelCase) or 'data' array
      setApiKeys(response.data.apiKeys || response.data.data || []);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;

    try {
      setIsSubmitting(true);
      const response = await apiClient.post('/api-keys', { name: newKeyName.trim() });
      setNewToken(response.data.token);
      setNewKeyName('');
      setIsCreateOpen(false);
      loadApiKeys();
    } catch (error) {
      console.error('Failed to create API key:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setIsSubmitting(true);
      await apiClient.delete(`/api-keys/${id}`);
      setDeleteConfirmId(null);
      loadApiKeys();
    } catch (error) {
      console.error('Failed to delete API key:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRotate = async (id: string) => {
    try {
      setIsSubmitting(true);
      const response = await apiClient.post(`/api-keys/${id}/rotate`);
      setRotateConfirmId(null);
      setNewToken(response.data.token);
      loadApiKeys();
    } catch (error) {
      console.error('Failed to rotate API key:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (newToken) {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseTokenDialog = () => {
    setNewToken(null);
  };

  const keyToDelete = apiKeys.find(k => k.id === deleteConfirmId);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">API Keys</h2>
        <p className="text-muted-foreground">
          Create and manage API keys for programmatic access to OnCallShift. Use these keys with the MCP server, Terraform provider, or custom integrations.
        </p>
      </div>

      {/* Token Display Dialog */}
      <Dialog open={!!newToken} onClose={handleCloseTokenDialog}>
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <Key className="h-5 w-5 text-green-500" />
              API Key Created
            </span>
          </DialogTitle>
          <DialogDescription>
            Copy your API key now. You won't be able to see it again!
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm break-all">
              <code className="flex-1">{newToken}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Make sure to copy your API key now. For security reasons, it cannot be displayed again.
              </p>
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button onClick={handleCloseTokenDialog}>
            I've copied my key
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Create API Key Dialog */}
      <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)}>
        <DialogHeader>
          <DialogTitle>Create New API Key</DialogTitle>
          <DialogDescription>
            Give your API key a descriptive name so you can identify it later.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., terraform-provider, mcp-server, ci-cd"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsCreateOpen(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!newKeyName.trim() || isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Key'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
        <DialogHeader>
          <DialogTitle>Delete API Key?</DialogTitle>
          <DialogDescription>
            This will permanently revoke the API key "{keyToDelete?.name}". Any applications using this key will stop working immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Deleting...' : 'Delete Key'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Rotate Confirmation Dialog */}
      <Dialog open={!!rotateConfirmId} onClose={() => setRotateConfirmId(null)}>
        <DialogHeader>
          <DialogTitle>Rotate API Key?</DialogTitle>
          <DialogDescription>
            This will generate a new token and immediately invalidate the old one. Any applications using the old token will stop working.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRotateConfirmId(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => rotateConfirmId && handleRotate(rotateConfirmId)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Rotating...' : 'Rotate Key'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Create API Key Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Organization API Keys</span>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </CardTitle>
          <CardDescription>
            API keys allow external applications to access your OnCallShift data. Keys have full access to your organization's resources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading API keys...
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No API keys yet</p>
              <p className="text-sm">Create an API key to get started with programmatic access.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{apiKey.name}</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">
                        {apiKey.key_prefix}...
                      </code>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created {formatTimeAgo(apiKey.created_at)}
                      {apiKey.created_by && ` by ${apiKey.created_by.full_name}`}
                      {apiKey.last_used_at && (
                        <> · Last used {formatTimeAgo(apiKey.last_used_at)}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRotateConfirmId(apiKey.id)}
                      title="Rotate API Key"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(apiKey.id)}
                      className="text-destructive hover:text-destructive"
                      title="Delete API Key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Using API Keys</CardTitle>
          <CardDescription>
            Include your API key in the request headers to authenticate API calls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">HTTP Header</h4>
            <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
              <code>Authorization: Bearer org_YOUR_API_KEY</code>
            </pre>
          </div>
          <div>
            <h4 className="font-medium mb-2">MCP Server Configuration</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Use your API key with the OnCallShift MCP server for AI assistants like Claude Code and Cursor.{' '}
              <Link to="/docs/ai/mcp" className="text-blue-600 hover:underline">
                Learn more →
              </Link>
            </p>
            <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
              <code>{`{
  "mcpServers": {
    "oncallshift": {
      "command": "npx",
      "args": ["@oncallshift/mcp-server"],
      "env": {
        "ONCALLSHIFT_API_KEY": "org_YOUR_API_KEY"
      }
    }
  }
}`}</code>
            </pre>
          </div>
          <div>
            <h4 className="font-medium mb-2">cURL Example</h4>
            <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
              <code>{`curl -H "Authorization: Bearer org_YOUR_API_KEY" \\
  https://oncallshift.com/api/v1/incidents`}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
