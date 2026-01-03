/**
 * Import History Table Component
 * Displays paginated history of semantic imports with filtering and sorting
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Image,
  MessageSquareText,
  FileJson,
  AlertCircle,
  CheckCircle,
  XCircle,
  RotateCcw,
  Loader2,
  Clock,
  Filter,
  History,
  User,
  Package,
} from 'lucide-react';
import { semanticImportAPI } from '../api/semanticImportApi';
import type {
  ImportHistoryEntry,
  ImportHistoryFilters,
  ImportStatus,
  ImportSourceType,
} from '../types';

interface ImportHistoryTableProps {
  onSelectImport: (importId: string) => void;
}

// Status configuration with colors and icons
const STATUS_CONFIG: Record<
  ImportStatus,
  { label: string; bgColor: string; textColor: string; icon: React.ElementType }
> = {
  pending: {
    label: 'Pending',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300',
    icon: Clock,
  },
  analyzing: {
    label: 'Analyzing',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    icon: Loader2,
  },
  previewing: {
    label: 'Previewing',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    icon: Loader2,
  },
  executing: {
    label: 'Executing',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    icon: Loader2,
  },
  completed: {
    label: 'Completed',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-300',
    icon: XCircle,
  },
  rolled_back: {
    label: 'Rolled Back',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    textColor: 'text-orange-700 dark:text-orange-300',
    icon: RotateCcw,
  },
};

// Source type configuration with icons and labels
const SOURCE_TYPE_CONFIG: Record<
  ImportSourceType,
  { label: string; icon: React.ElementType; bgColor: string; textColor: string }
> = {
  screenshot: {
    label: 'Screenshot',
    icon: Image,
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-700 dark:text-purple-300',
  },
  natural_language: {
    label: 'Natural Language',
    icon: MessageSquareText,
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    textColor: 'text-indigo-700 dark:text-indigo-300',
  },
  pagerduty: {
    label: 'PagerDuty',
    icon: FileJson,
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
  },
  opsgenie: {
    label: 'Opsgenie',
    icon: FileJson,
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  unknown: {
    label: 'Unknown',
    icon: AlertCircle,
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300',
  },
};

function StatusBadge({ status }: { status: ImportStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  const isAnimated = ['analyzing', 'previewing', 'executing'].includes(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
    >
      <Icon className={`h-3.5 w-3.5 ${isAnimated ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}

function SourceTypeBadge({ sourceType }: { sourceType: ImportSourceType }) {
  const config = SOURCE_TYPE_CONFIG[sourceType] || SOURCE_TYPE_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function EntityCounts({
  created,
  skipped,
  failed,
}: {
  created: number;
  skipped: number;
  failed: number;
}) {
  const total = created + skipped + failed;

  if (total === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {created > 0 && (
        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
          <CheckCircle className="h-3.5 w-3.5" />
          {created}
        </span>
      )}
      {skipped > 0 && (
        <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
          <AlertCircle className="h-3.5 w-3.5" />
          {skipped}
        </span>
      )}
      {failed > 0 && (
        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
          <XCircle className="h-3.5 w-3.5" />
          {failed}
        </span>
      )}
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function ImportHistoryTable({ onSelectImport }: ImportHistoryTableProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ImportHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [hasMore, setHasMore] = useState(false);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ImportStatus | ''>('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<ImportSourceType | ''>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const filters: ImportHistoryFilters = {
        page,
        pageSize,
      };

      if (statusFilter) {
        filters.status = statusFilter;
      }
      if (sourceTypeFilter) {
        filters.sourceType = sourceTypeFilter;
      }
      if (startDate) {
        filters.startDate = new Date(startDate).toISOString();
      }
      if (endDate) {
        // Add one day to end date to include the entire day
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        filters.endDate = endDateTime.toISOString();
      }

      const response = await semanticImportAPI.getHistory(filters);
      setHistory(response.items);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load import history';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, statusFilter, sourceTypeFilter, startDate, endDate]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClearFilters = () => {
    setStatusFilter('');
    setSourceTypeFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleRowClick = (importId: string) => {
    onSelectImport(importId);
  };

  const totalPages = Math.ceil(total / pageSize);
  const hasFiltersApplied = statusFilter || sourceTypeFilter || startDate || endDate;

  // Quick date filters
  const setDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(formatDateForInput(start));
    setEndDate(formatDateForInput(end));
    setPage(1);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Import History
            </CardTitle>
            <CardDescription>
              {total} import{total !== 1 ? 's' : ''} total
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
              {hasFiltersApplied && (
                <span className="ml-1.5 h-2 w-2 rounded-full bg-primary-foreground" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 rounded-lg bg-muted/50 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="statusFilter">Status</Label>
                <Select
                  id="statusFilter"
                  value={statusFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setStatusFilter(e.target.value as ImportStatus | '');
                    setPage(1);
                  }}
                  className="w-full"
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="rolled_back">Rolled Back</option>
                  <option value="pending">Pending</option>
                  <option value="analyzing">Analyzing</option>
                  <option value="previewing">Previewing</option>
                  <option value="executing">Executing</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="sourceTypeFilter">Source Type</Label>
                <Select
                  id="sourceTypeFilter"
                  value={sourceTypeFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setSourceTypeFilter(e.target.value as ImportSourceType | '');
                    setPage(1);
                  }}
                  className="w-full"
                >
                  <option value="">All Sources</option>
                  <option value="screenshot">Screenshot</option>
                  <option value="natural_language">Natural Language</option>
                  <option value="pagerduty">PagerDuty</option>
                  <option value="opsgenie">Opsgenie</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Quick:</span>
                <Button variant="ghost" size="sm" onClick={() => setDateRange(7)}>
                  Last 7 days
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDateRange(30)}>
                  Last 30 days
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDateRange(90)}>
                  Last 90 days
                </Button>
              </div>
              {hasFiltersApplied && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 text-sm text-destructive bg-destructive/10 rounded-md flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadHistory}
              className="ml-auto"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && history.length === 0 && (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading import history...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && history.length === 0 && !error && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No imports found</h3>
            <p className="text-muted-foreground mb-4">
              {hasFiltersApplied
                ? 'No imports match your current filters. Try adjusting your search criteria.'
                : "You haven't imported any configurations yet. Start by uploading a screenshot or describing your setup."}
            </p>
            {hasFiltersApplied && (
              <Button variant="outline" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {/* Table */}
        {history.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-3 font-medium text-sm">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Timestamp
                      </div>
                    </th>
                    <th className="text-left py-3 px-3 font-medium text-sm">Source</th>
                    <th className="text-left py-3 px-3 font-medium text-sm">Status</th>
                    <th className="text-left py-3 px-3 font-medium text-sm">
                      <div className="flex items-center gap-1.5">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        Entities
                      </div>
                    </th>
                    <th className="text-left py-3 px-3 font-medium text-sm">
                      <div className="flex items-center gap-1.5">
                        <User className="h-4 w-4 text-muted-foreground" />
                        User
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => handleRowClick(entry.id)}
                      className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="text-sm font-medium">
                          {formatDate(entry.createdAt)}
                        </div>
                        {entry.completedAt && entry.completedAt !== entry.createdAt && (
                          <div className="text-xs text-muted-foreground">
                            Completed: {formatDate(entry.completedAt)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <SourceTypeBadge sourceType={entry.sourceType} />
                        {entry.inputSummary && (
                          <div
                            className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]"
                            title={entry.inputSummary}
                          >
                            {entry.inputSummary}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={entry.status} />
                        {entry.errorMessage && (
                          <div
                            className="text-xs text-red-600 dark:text-red-400 mt-1 truncate max-w-[200px]"
                            title={entry.errorMessage}
                          >
                            {entry.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <EntityCounts
                          created={entry.entitiesCreated}
                          skipped={entry.entitiesSkipped}
                          failed={entry.entitiesFailed}
                        />
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-sm text-muted-foreground">
                          {entry.userName || entry.userId.slice(0, 8)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} -{' '}
                {Math.min(page * pageSize, total)} of {total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground">Page</span>
                  <span className="font-medium">{page}</span>
                  <span className="text-muted-foreground">of</span>
                  <span className="font-medium">{totalPages || 1}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore || isLoading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ImportHistoryTable;
