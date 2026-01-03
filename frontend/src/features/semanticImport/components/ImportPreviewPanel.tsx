/**
 * ImportPreviewPanel Component
 * Displays a diff-like preview of what will be created/updated/skipped during import
 * and handles the execution of the import with confirmation.
 */
import { useState, useMemo, useEffect } from 'react';
import {
  Check,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  Users,
  Calendar,
  Shield,
  Server,
  ArrowLeft,
  Loader2,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { semanticImportAPI } from '../api/semanticImportApi';
import type {
  ImportExtraction,
  ImportExecutionResult,
  ImportPreviewResult,
  PreviewCreatedItem,
  PreviewSkippedItem,
  PreviewConflict,
} from '../types';

interface ImportPreviewPanelProps {
  extraction: ImportExtraction;
  onImportComplete: (result: ImportExecutionResult, importId?: string) => void;
  onBack: () => void;
}

type ItemType = 'team' | 'user' | 'schedule' | 'escalation_policy' | 'service';

interface ItemTypeConfig {
  label: string;
  pluralLabel: string;
  icon: React.ElementType;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const ITEM_TYPE_CONFIG: Record<ItemType, ItemTypeConfig> = {
  team: {
    label: 'Team',
    pluralLabel: 'Teams',
    icon: Users,
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
  },
  user: {
    label: 'User',
    pluralLabel: 'Users',
    icon: Users,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  schedule: {
    label: 'Schedule',
    pluralLabel: 'Schedules',
    icon: Calendar,
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
  },
  escalation_policy: {
    label: 'Escalation Policy',
    pluralLabel: 'Escalation Policies',
    icon: Shield,
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
  },
  service: {
    label: 'Service',
    pluralLabel: 'Services',
    icon: Server,
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
  },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

function getItemTypeConfig(type: string): ItemTypeConfig {
  return ITEM_TYPE_CONFIG[type as ItemType] || ITEM_TYPE_CONFIG.service;
}

interface CollapsibleSectionProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  variant: 'create' | 'skip' | 'conflict';
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  variant,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const variantStyles = {
    create: {
      header: 'bg-green-50 border-green-200 hover:bg-green-100',
      badge: 'bg-green-100 text-green-700',
      icon: <Check className="w-4 h-4 text-green-600" />,
    },
    skip: {
      header: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
      badge: 'bg-amber-100 text-amber-700',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
    },
    conflict: {
      header: 'bg-red-50 border-red-200 hover:bg-red-100',
      badge: 'bg-red-100 text-red-700',
      icon: <AlertCircle className="w-4 h-4 text-red-600" />,
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 border-b ${styles.header} transition-colors`}
      >
        <div className="flex items-center gap-2">
          {styles.icon}
          <span className="font-medium text-sm">{title}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>
            {count}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="p-4 space-y-2 bg-background">{children}</div>}
    </div>
  );
}

interface CreateItemRowProps {
  item: PreviewCreatedItem;
}

function CreateItemRow({ item }: CreateItemRowProps) {
  const config = getItemTypeConfig(item.type);
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-green-50/50 border-green-100">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <Icon className={`w-4 h-4 ${config.textColor}`} />
        </div>
        <div>
          <div className="font-medium text-sm">{item.name}</div>
          <div className="text-xs text-muted-foreground">{config.label}</div>
        </div>
      </div>
      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1">
        <Check className="w-3 h-3" />
        Create
      </span>
    </div>
  );
}

interface SkipItemRowProps {
  item: PreviewSkippedItem;
}

function SkipItemRow({ item }: SkipItemRowProps) {
  const config = getItemTypeConfig(item.type);
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-amber-50/50 border-amber-100">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <Icon className={`w-4 h-4 ${config.textColor}`} />
        </div>
        <div>
          <div className="font-medium text-sm">{item.name}</div>
          <div className="text-xs text-muted-foreground">{config.label}</div>
        </div>
      </div>
      <div className="text-right">
        <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Skip
        </span>
        <div className="text-xs text-amber-600 mt-1 max-w-48 truncate">{item.reason}</div>
      </div>
    </div>
  );
}

interface ConflictItemRowProps {
  conflict: PreviewConflict;
}

function ConflictItemRow({ conflict }: ConflictItemRowProps) {
  const config = getItemTypeConfig(conflict.type);
  const Icon = config.icon;

  const actionConfig = {
    skip: { label: 'Skip', color: 'bg-amber-100 text-amber-700' },
    update: { label: 'Update', color: 'bg-blue-100 text-blue-700' },
    error: { label: 'Error', color: 'bg-red-100 text-red-700' },
  };

  const action = actionConfig[conflict.action];

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-red-50/50 border-red-100">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <Icon className={`w-4 h-4 ${config.textColor}`} />
        </div>
        <div>
          <div className="font-medium text-sm">{conflict.name}</div>
          <div className="text-xs text-muted-foreground">
            {config.label} - Exists (ID: {conflict.existingId.substring(0, 8)}...)
          </div>
        </div>
      </div>
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${action.color}`}>
        {action.label}
      </span>
    </div>
  );
}

interface ExecutionResultDisplayProps {
  result: ImportExecutionResult;
  onViewDashboard: () => void;
}

function ExecutionResultDisplay({ result, onViewDashboard }: ExecutionResultDisplayProps) {
  const totalCreated = result.created.length;
  const totalSkipped = result.skipped.length;
  const totalFailed = result.failed.length;

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          {result.success ? (
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          )}
        </div>
        <CardTitle>
          {result.success ? 'Import Complete!' : 'Import Completed with Issues'}
        </CardTitle>
        <CardDescription>
          {result.success
            ? 'Your configuration has been successfully imported.'
            : result.errorMessage || 'Some items could not be imported.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="text-2xl font-bold text-green-700">{totalCreated}</div>
            <div className="text-sm text-green-600">Created</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="text-2xl font-bold text-amber-700">{totalSkipped}</div>
            <div className="text-sm text-amber-600">Skipped</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
            <div className="text-2xl font-bold text-red-700">{totalFailed}</div>
            <div className="text-sm text-red-600">Failed</div>
          </div>
        </div>

        {/* Rollback notice */}
        {result.rollbackPerformed && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <RotateCcw className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-amber-800">Rollback Performed</div>
              <div className="text-sm text-amber-700">
                Due to errors during import, all changes have been rolled back. Your data
                remains unchanged.
              </div>
            </div>
          </div>
        )}

        {/* Created items */}
        {result.created.length > 0 && (
          <CollapsibleSection
            title="Successfully Created"
            count={result.created.length}
            defaultOpen
            variant="create"
          >
            {result.created.map((item, idx) => {
              const config = getItemTypeConfig(item.type);
              const Icon = config.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-lg bg-green-50/50"
                >
                  <Icon className={`w-4 h-4 ${config.textColor}`} />
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">({config.label})</span>
                </div>
              );
            })}
          </CollapsibleSection>
        )}

        {/* Skipped items */}
        {result.skipped.length > 0 && (
          <CollapsibleSection
            title="Skipped"
            count={result.skipped.length}
            variant="skip"
          >
            {result.skipped.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <span className="text-xs text-amber-600">{item.reason}</span>
              </div>
            ))}
          </CollapsibleSection>
        )}

        {/* Failed items */}
        {result.failed.length > 0 && (
          <CollapsibleSection
            title="Failed"
            count={result.failed.length}
            defaultOpen
            variant="conflict"
          >
            {result.failed.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-red-50/50"
              >
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <span className="text-xs text-red-600 max-w-48 truncate">{item.error}</span>
              </div>
            ))}
          </CollapsibleSection>
        )}

        {/* Actions */}
        <div className="flex justify-center pt-4">
          <Button onClick={onViewDashboard} className="w-full max-w-xs">
            Go to Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ImportPreviewPanel({
  extraction,
  onImportComplete,
  onBack,
}: ImportPreviewPanelProps) {
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ImportExecutionResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Fetch preview on mount
  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setIsLoadingPreview(true);
        setPreviewError(null);
        const response = await semanticImportAPI.previewImport({ extraction });
        if (response.success && response.preview) {
          setPreview(response.preview);
        } else {
          setPreviewError(response.error || 'Failed to generate preview');
        }
      } catch (err) {
        setPreviewError(
          err instanceof Error ? err.message : 'An unexpected error occurred'
        );
      } finally {
        setIsLoadingPreview(false);
      }
    };
    fetchPreview();
  }, [extraction]);

  // Group items by type for summary
  const summaryStats = useMemo(() => {
    if (!preview) return null;

    const typeCount: Record<string, { create: number; skip: number; conflict: number }> = {};

    preview.willCreate.forEach((item) => {
      if (!typeCount[item.type]) {
        typeCount[item.type] = { create: 0, skip: 0, conflict: 0 };
      }
      typeCount[item.type].create++;
    });

    preview.willSkip.forEach((item) => {
      if (!typeCount[item.type]) {
        typeCount[item.type] = { create: 0, skip: 0, conflict: 0 };
      }
      typeCount[item.type].skip++;
    });

    preview.conflicts.forEach((item) => {
      if (!typeCount[item.type]) {
        typeCount[item.type] = { create: 0, skip: 0, conflict: 0 };
      }
      typeCount[item.type].conflict++;
    });

    return typeCount;
  }, [preview]);

  const handleExecuteImport = async () => {
    setIsConfirmDialogOpen(false);
    setIsExecuting(true);
    setExecutionError(null);

    try {
      const response = await semanticImportAPI.executeImport({
        extraction,
        skipConflicts: true,
      });

      if (response.success && response.result) {
        setExecutionResult(response.result);
        onImportComplete(response.result, response.importId);
      } else {
        setExecutionError(response.error || 'Import execution failed');
      }
    } catch (err) {
      setExecutionError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const handleViewDashboard = () => {
    window.location.href = '/dashboard';
  };

  // Show execution result if import is complete
  if (executionResult) {
    return (
      <ExecutionResultDisplay result={executionResult} onViewDashboard={handleViewDashboard} />
    );
  }

  // Loading state
  if (isLoadingPreview) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <div className="text-center">
              <div className="font-medium">Generating Preview</div>
              <div className="text-sm text-muted-foreground">
                Analyzing your configuration...
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (previewError || !preview) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="text-center">
              <div className="font-medium text-red-800">Failed to Generate Preview</div>
              <div className="text-sm text-red-600 mt-1">
                {previewError || 'An unexpected error occurred'}
              </div>
            </div>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalToCreate = preview.willCreate.length;
  const totalToSkip = preview.willSkip.length;
  const totalConflicts = preview.conflicts.length;
  const hasWarnings = preview.warnings.length > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Import Preview
          </CardTitle>
          <CardDescription>
            Review what will be created, updated, and skipped before executing the import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(summaryStats || {}).map(([type, counts]) => {
              const config = getItemTypeConfig(type);
              const Icon = config.icon;
              const total = counts.create + counts.skip + counts.conflict;
              return (
                <div
                  key={type}
                  className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${config.textColor}`} />
                    <span className={`text-xs font-medium ${config.textColor}`}>
                      {config.pluralLabel}
                    </span>
                  </div>
                  <div className={`text-2xl font-bold ${config.textColor}`}>{total}</div>
                  {counts.create > 0 && (
                    <div className="text-xs text-green-600 mt-1">
                      {counts.create} to create
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Estimated Duration */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              Estimated duration:{' '}
              <span className="font-medium">
                {formatDuration(preview.estimatedDuration)}
              </span>
            </span>
          </div>

          {/* Warnings Section */}
          {hasWarnings && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-amber-800 mb-2">Warnings</div>
                  <ul className="text-sm text-amber-700 space-y-1">
                    {preview.warnings.map((warning, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-amber-500">-</span>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Items to Create */}
          {totalToCreate > 0 && (
            <CollapsibleSection
              title="Items to Create"
              count={totalToCreate}
              defaultOpen
              variant="create"
            >
              {preview.willCreate.map((item, idx) => (
                <CreateItemRow key={idx} item={item} />
              ))}
            </CollapsibleSection>
          )}

          {/* Items to Skip */}
          {totalToSkip > 0 && (
            <CollapsibleSection
              title="Items to Skip"
              count={totalToSkip}
              variant="skip"
            >
              {preview.willSkip.map((item, idx) => (
                <SkipItemRow key={idx} item={item} />
              ))}
            </CollapsibleSection>
          )}

          {/* Conflicts */}
          {totalConflicts > 0 && (
            <CollapsibleSection
              title="Conflicts Detected"
              count={totalConflicts}
              defaultOpen
              variant="conflict"
            >
              {preview.conflicts.map((conflict, idx) => (
                <ConflictItemRow key={idx} conflict={conflict} />
              ))}
            </CollapsibleSection>
          )}

          {/* Execution Error */}
          {executionError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-800">Import Failed</div>
                  <div className="text-sm text-red-700 mt-1">{executionError}</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={onBack} disabled={isExecuting}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={() => setIsConfirmDialogOpen(true)}
              disabled={isExecuting || totalToCreate === 0}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Execute Import ({totalToCreate} items)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onClose={() => setIsConfirmDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>Confirm Import</DialogTitle>
          <DialogDescription>
            Are you sure you want to proceed with the import?
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-green-50">
                <div className="text-lg font-bold text-green-700">{totalToCreate}</div>
                <div className="text-xs text-green-600">Will Create</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-50">
                <div className="text-lg font-bold text-amber-700">{totalToSkip}</div>
                <div className="text-xs text-amber-600">Will Skip</div>
              </div>
              <div className="p-3 rounded-lg bg-red-50">
                <div className="text-lg font-bold text-red-700">{totalConflicts}</div>
                <div className="text-xs text-red-600">Conflicts</div>
              </div>
            </div>

            {totalConflicts > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    {totalConflicts} conflict{totalConflicts !== 1 ? 's' : ''} will be skipped
                    to avoid overwriting existing data.
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  If any errors occur during import, all changes will be automatically
                  rolled back.
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExecuteImport}>
            <Check className="w-4 h-4 mr-2" />
            Execute Import
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

export default ImportPreviewPanel;
