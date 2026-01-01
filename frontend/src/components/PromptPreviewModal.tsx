import { useState, useEffect } from 'react';
import { X, Cloud, Check, Loader2 } from 'lucide-react';
import type { CloudProvider } from '../types/api';

interface AvailableCredential {
  id: string;
  name: string;
  provider: CloudProvider;
}

interface PromptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string, credentialIds: string[]) => void;
  defaultPrompt: string;
  availableCredentials: AvailableCredential[];
  incidentSummary: string;
  isLoading?: boolean;
}

const providerColors: Record<CloudProvider, string> = {
  aws: 'bg-orange-100 text-orange-800 border-orange-200',
  azure: 'bg-blue-100 text-blue-800 border-blue-200',
  gcp: 'bg-green-100 text-green-800 border-green-200',
};

const providerLabels: Record<CloudProvider, string> = {
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'GCP',
};

export function PromptPreviewModal({
  isOpen,
  onClose,
  onSend,
  defaultPrompt,
  availableCredentials,
  incidentSummary,
  isLoading = false,
}: PromptPreviewModalProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([]);

  // Reset prompt when modal opens with new default
  useEffect(() => {
    if (isOpen) {
      setPrompt(defaultPrompt);
      // Select all credentials by default
      setSelectedCredentials(availableCredentials.map(c => c.id));
    }
  }, [isOpen, defaultPrompt, availableCredentials]);

  const toggleCredential = (id: string) => {
    setSelectedCredentials(prev =>
      prev.includes(id)
        ? prev.filter(c => c !== id)
        : [...prev, id]
    );
  };

  const handleSend = () => {
    if (prompt.trim()) {
      onSend(prompt.trim(), selectedCredentials);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Ask Claude
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {incidentSummary}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-gray-100 transition-colors"
              disabled={isLoading}
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            {/* Cloud Credentials Section */}
            {availableCredentials.length > 0 && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Cloud className="h-4 w-4" />
                  Enable Cloud Access
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Select credentials Claude can use to investigate your cloud infrastructure:
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableCredentials.map(cred => {
                    const isSelected = selectedCredentials.includes(cred.id);
                    return (
                      <button
                        key={cred.id}
                        onClick={() => toggleCredential(cred.id)}
                        disabled={isLoading}
                        className={`
                          inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-all
                          ${isSelected
                            ? providerColors[cred.provider]
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                          }
                        `}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                        <span className="font-medium">{providerLabels[cred.provider]}</span>
                        <span className="text-xs opacity-75">{cred.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prompt Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Message
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isLoading}
                rows={8}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
                placeholder="Ask Claude to help diagnose this incident..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Claude will have access to incident details, timeline, and alerts.
                {selectedCredentials.length > 0 && (
                  <span className="text-indigo-600">
                    {' '}Cloud investigation tools are enabled.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t px-6 py-4 bg-gray-50 rounded-b-lg">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isLoading || !prompt.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send to Claude'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
