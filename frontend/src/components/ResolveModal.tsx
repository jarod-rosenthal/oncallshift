import { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

interface ResolveTemplate {
  id: string;
  label: string;
  note: string;
  icon: string;
}

const defaultResolveTemplates: ResolveTemplate[] = [
  {
    id: 'restart',
    label: 'Service Restart',
    note: 'Resolved by restarting the affected service. Root cause under investigation.',
    icon: '🔄',
  },
  {
    id: 'config',
    label: 'Config Update',
    note: 'Configuration issue identified and corrected. Monitoring for recurrence.',
    icon: '⚙️',
  },
  {
    id: 'scaling',
    label: 'Auto-Scaling',
    note: 'System auto-scaled to handle increased load. Performance restored.',
    icon: '📈',
  },
  {
    id: 'deployment',
    label: 'Deployment Fix',
    note: 'Fixed in latest deployment. Issue should not recur.',
    icon: '🚀',
  },
  {
    id: 'false_positive',
    label: 'False Positive',
    note: 'Alert triggered incorrectly. No actual issue detected. Alert threshold adjusted.',
    icon: '✅',
  },
  {
    id: 'third_party',
    label: 'Third-Party Issue',
    note: 'Issue caused by external dependency. Has been resolved upstream.',
    icon: '☁️',
  },
  {
    id: 'transient',
    label: 'Transient Error',
    note: 'Transient issue self-resolved. No action required.',
    icon: '⚡',
  },
  {
    id: 'manual_fix',
    label: 'Manual Fix',
    note: 'Issue manually remediated. Follow-up ticket created for permanent fix.',
    icon: '🔧',
  },
];

interface ResolveModalProps {
  open: boolean;
  onClose: () => void;
  onResolve: (note: string) => void;
  isLoading?: boolean;
}

export function ResolveModal({ open, onClose, onResolve, isLoading }: ResolveModalProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customNote, setCustomNote] = useState('');

  const handleTemplateSelect = (template: ResolveTemplate) => {
    onResolve(template.note);
  };

  const handleCustomSubmit = () => {
    if (customNote.trim()) {
      onResolve(customNote.trim());
      setCustomNote('');
      setShowCustom(false);
    }
  };

  const handleClose = () => {
    setShowCustom(false);
    setCustomNote('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader>
        <DialogTitle>Resolve with Note</DialogTitle>
        <DialogDescription>
          Choose a template or write a custom resolution note
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
        {!showCustom ? (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {defaultResolveTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                disabled={isLoading}
                className="w-full flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
              >
                <span className="text-xl">{template.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{template.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{template.note}</p>
                </div>
              </button>
            ))}

            <button
              onClick={() => setShowCustom(true)}
              disabled={isLoading}
              className="w-full flex items-start gap-3 p-3 rounded-lg border border-dashed hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
            >
              <span className="text-xl">✏️</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Custom Note</p>
                <p className="text-xs text-muted-foreground">Write your own resolution note</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <textarea
              placeholder="Describe how the incident was resolved..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
            />
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        {showCustom ? (
          <>
            <Button variant="outline" onClick={() => setShowCustom(false)} disabled={isLoading}>
              Back
            </Button>
            <Button
              onClick={handleCustomSubmit}
              disabled={!customNote.trim() || isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Resolving...' : 'Resolve'}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
