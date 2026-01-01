import { useState, useEffect, useCallback } from 'react';
import { Video, Phone, Copy, ExternalLink, X, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from './ui/dialog';
import { Select } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { incidentsAPI } from '../lib/api-client';
import type { ConferenceBridge } from '../lib/api-client';
import { showToast } from './Toast';

interface Provider {
  id: string;
  name: string;
  configured: boolean;
  description: string;
}

interface ConferenceBridgePanelProps {
  incidentId: string;
  incidentState: string;
  onRefresh?: () => void;
}

export function ConferenceBridgePanel({
  incidentId,
  incidentState,
  onRefresh,
}: ConferenceBridgePanelProps) {
  const [bridge, setBridge] = useState<ConferenceBridge | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualPasscode, setManualPasscode] = useState('');
  const [manualDialIn, setManualDialIn] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadBridge = useCallback(async () => {
    try {
      const response = await incidentsAPI.getConferenceBridge(incidentId);
      setBridge(response.bridge);
    } catch (error) {
      console.error('Failed to load conference bridge:', error);
    } finally {
      setIsLoading(false);
    }
  }, [incidentId]);

  const loadProviders = useCallback(async () => {
    try {
      const response = await incidentsAPI.getConferenceBridgeProviders();
      setProviders(response.providers);
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  }, []);

  useEffect(() => {
    loadBridge();
    loadProviders();
  }, [loadBridge, loadProviders]);

  const handleCreateBridge = async () => {
    if (!selectedProvider) return;

    setIsSubmitting(true);
    try {
      const data: {
        provider: 'zoom' | 'google_meet' | 'microsoft_teams' | 'manual';
        meetingUrl?: string;
        passcode?: string;
        dialInNumber?: string;
      } = {
        provider: selectedProvider as 'zoom' | 'google_meet' | 'microsoft_teams' | 'manual',
      };

      if (selectedProvider === 'manual') {
        if (!manualUrl) {
          showToast.error('Meeting URL is required');
          setIsSubmitting(false);
          return;
        }
        data.meetingUrl = manualUrl;
        data.passcode = manualPasscode || undefined;
        data.dialInNumber = manualDialIn || undefined;
      }

      await incidentsAPI.createConferenceBridge(incidentId, data);
      showToast.success('Conference bridge created');
      setShowCreateDialog(false);
      resetForm();
      await loadBridge();
      onRefresh?.();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      showToast.error(err.response?.data?.error || 'Failed to create conference bridge');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndBridge = async () => {
    if (!bridge) return;

    setIsSubmitting(true);
    try {
      await incidentsAPI.endConferenceBridge(incidentId, bridge.id);
      showToast.success('Conference bridge ended');
      await loadBridge();
      onRefresh?.();
    } catch {
      showToast.error('Failed to end conference bridge');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast.success(`${label} copied to clipboard`);
    } catch {
      showToast.error('Failed to copy');
    }
  };

  const resetForm = () => {
    setSelectedProvider('');
    setManualUrl('');
    setManualPasscode('');
    setManualDialIn('');
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'zoom':
        return <Video className="w-4 h-4 text-blue-500" />;
      case 'google_meet':
        return <Video className="w-4 h-4 text-green-500" />;
      case 'microsoft_teams':
        return <Video className="w-4 h-4 text-purple-500" />;
      default:
        return <Video className="w-4 h-4 text-neutral-500" />;
    }
  };

  const selectedProviderInfo = providers.find(p => p.id === selectedProvider);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Video className="w-5 h-5" />
            Conference Bridge
          </CardTitle>
          {incidentState !== 'resolved' && !bridge && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Start
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-neutral-500">Loading...</p>
          ) : !bridge ? (
            <p className="text-sm text-neutral-500">
              No conference bridge active. Start a call to coordinate response.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Bridge Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getProviderIcon(bridge.provider)}
                  <span className="font-medium">{bridge.providerLabel}</span>
                  {bridge.status === 'active' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  )}
                  {bridge.status === 'ended' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                      Ended
                    </span>
                  )}
                </div>
                {bridge.status === 'active' && incidentState !== 'resolved' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEndBridge}
                    disabled={isSubmitting}
                    className="text-neutral-500 hover:text-danger"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Meeting URL */}
              <div className="bg-neutral-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Meeting Link</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(bridge.meetingUrl, 'Meeting URL')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <a
                      href={bridge.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-neutral-200"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
                <p className="text-sm font-mono text-neutral-800 break-all">
                  {bridge.meetingUrl}
                </p>
              </div>

              {/* Passcode */}
              {bridge.passcode && (
                <div className="flex items-center justify-between p-2 bg-neutral-50 rounded">
                  <div>
                    <span className="text-xs text-neutral-500">Passcode</span>
                    <p className="font-mono">{bridge.passcode}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(bridge.passcode!, 'Passcode')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Dial-in */}
              {bridge.dialInNumber && (
                <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded">
                  <Phone className="w-4 h-4 text-neutral-500" />
                  <div className="flex-1">
                    <span className="text-xs text-neutral-500">Dial-in</span>
                    <p className="font-mono text-sm">{bridge.dialInNumber}</p>
                    {bridge.dialInPin && (
                      <p className="text-xs text-neutral-500">PIN: {bridge.dialInPin}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(bridge.dialInNumber!, 'Dial-in number')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Created info */}
              {bridge.createdBy && (
                <p className="text-xs text-neutral-400">
                  Started by {bridge.createdBy.fullName}
                  {bridge.startedAt && ` at ${new Date(bridge.startedAt).toLocaleTimeString()}`}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Bridge Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)}>
        <DialogHeader>
          <DialogTitle>Start Conference Bridge</DialogTitle>
          <DialogDescription>
            Start a video call to coordinate incident response with your team.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="provider">Conference Provider</Label>
              <Select
                id="provider"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full mt-1"
              >
                <option value="">Select a provider...</option>
                {providers.map((provider) => (
                  <option
                    key={provider.id}
                    value={provider.id}
                    disabled={!provider.configured && provider.id !== 'manual'}
                  >
                    {provider.name} {!provider.configured && provider.id !== 'manual' && '(Not configured)'}
                  </option>
                ))}
              </Select>
              {selectedProviderInfo && (
                <p className="text-xs text-neutral-500 mt-1">
                  {selectedProviderInfo.description}
                </p>
              )}
            </div>

            {selectedProvider === 'manual' && (
              <>
                <div>
                  <Label htmlFor="meetingUrl">Meeting URL *</Label>
                  <Input
                    id="meetingUrl"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://zoom.us/j/123456789"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="passcode">Passcode (optional)</Label>
                  <Input
                    id="passcode"
                    value={manualPasscode}
                    onChange={(e) => setManualPasscode(e.target.value)}
                    placeholder="123456"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="dialIn">Dial-in Number (optional)</Label>
                  <Input
                    id="dialIn"
                    value={manualDialIn}
                    onChange={(e) => setManualDialIn(e.target.value)}
                    placeholder="+1-555-123-4567"
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {selectedProvider && selectedProvider !== 'manual' && !selectedProviderInfo?.configured && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-md">
                <p className="text-sm text-warning-foreground">
                  {selectedProviderInfo?.name} is not configured. Please add API credentials in organization settings, or use Manual entry.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowCreateDialog(false);
              resetForm();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateBridge}
            disabled={
              isSubmitting ||
              !selectedProvider ||
              (selectedProvider !== 'manual' && !selectedProviderInfo?.configured)
            }
          >
            {isSubmitting ? 'Starting...' : 'Start Bridge'}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
