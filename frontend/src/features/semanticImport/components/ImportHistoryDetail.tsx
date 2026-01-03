/**
 * Import History Detail Component
 * Shows detailed view of a single import
 */
import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Clock, User, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { semanticImportAPI } from '../api/semanticImportApi';
import type { ImportHistoryEntry, ImportStatus, ImportSourceType } from '../types';

interface ImportHistoryDetailProps {
  importId: string;
  onBack: () => void;
}

export function ImportHistoryDetail({ importId, onBack }: ImportHistoryDetailProps) {
  const [importData, setImportData] = useState<ImportHistoryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadImportDetail();
  }, [importId]);

  const loadImportDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await semanticImportAPI.getImportDetail(importId);
      setImportData(response.import);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to load import details');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: ImportStatus) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      rolled_back: 'bg-orange-100 text-orange-800',
      pending: 'bg-gray-100 text-gray-800',
      analyzing: 'bg-blue-100 text-blue-800',
      previewing: 'bg-blue-100 text-blue-800',
      executing: 'bg-blue-100 text-blue-800',
    };
    const icons = {
      completed: CheckCircle2,
      failed: XCircle,
      rolled_back: AlertTriangle,
      pending: Clock,
      analyzing: Loader2,
      previewing: Loader2,
      executing: Loader2,
    };
    const Icon = icons[status] || Clock;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${styles[status] || styles.pending}`}>
        <Icon className="h-4 w-4" />
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getSourceTypeBadge = (sourceType: ImportSourceType) => {
    const labels: Record<ImportSourceType, string> = {
      screenshot: 'Screenshot',
      natural_language: 'Natural Language',
      pagerduty: 'PagerDuty',
      opsgenie: 'OpsGenie',
      unknown: 'Unknown',
    };
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        {labels[sourceType] || sourceType}
      </span>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-500">Loading import details...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to History
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!importData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Button>
        {getStatusBadge(importData.status)}
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Import Summary</CardTitle>
          <CardDescription>
            {importData.inputSummary || 'No description available'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Source Type</div>
              {getSourceTypeBadge(importData.sourceType)}
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Created</div>
              <div className="flex items-center gap-1 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                {new Date(importData.createdAt).toLocaleString()}
              </div>
            </div>
            {importData.completedAt && (
              <div>
                <div className="text-sm text-gray-500 mb-1">Completed</div>
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="h-4 w-4 text-gray-400" />
                  {new Date(importData.completedAt).toLocaleString()}
                </div>
              </div>
            )}
            {importData.userName && (
              <div>
                <div className="text-sm text-gray-500 mb-1">User</div>
                <div className="flex items-center gap-1 text-sm">
                  <User className="h-4 w-4 text-gray-400" />
                  {importData.userName}
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{importData.entitiesCreated}</div>
              <div className="text-sm text-green-600">Created</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-700">{importData.entitiesSkipped}</div>
              <div className="text-sm text-yellow-600">Skipped</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{importData.entitiesFailed}</div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {importData.errorMessage && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-red-600 bg-red-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
              {importData.errorMessage}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Extraction Result */}
      {importData.extractionResult && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Configuration</CardTitle>
            <CardDescription>
              Confidence: {Math.round(importData.extractionResult.confidence * 100)}% |
              Source Detected: {importData.extractionResult.sourceDetected}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Teams */}
            {importData.extractionResult.teams.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-gray-700 mb-2">
                  Teams ({importData.extractionResult.teams.length})
                </h4>
                <div className="space-y-2">
                  {importData.extractionResult.teams.map((team, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                      <div className="font-medium">{team.name}</div>
                      <div className="text-sm text-gray-500">
                        {team.members.length} members
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schedules */}
            {importData.extractionResult.schedules.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-gray-700 mb-2">
                  Schedules ({importData.extractionResult.schedules.length})
                </h4>
                <div className="space-y-2">
                  {importData.extractionResult.schedules.map((schedule, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                      <div className="font-medium">{schedule.name}</div>
                      <div className="text-sm text-gray-500">
                        {schedule.rotationType} rotation | {schedule.participants.length} participants
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Escalation Policies */}
            {importData.extractionResult.escalationPolicies.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-gray-700 mb-2">
                  Escalation Policies ({importData.extractionResult.escalationPolicies.length})
                </h4>
                <div className="space-y-2">
                  {importData.extractionResult.escalationPolicies.map((policy, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                      <div className="font-medium">{policy.name}</div>
                      <div className="text-sm text-gray-500">
                        {policy.steps.length} steps
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Services */}
            {importData.extractionResult.services.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-gray-700 mb-2">
                  Services ({importData.extractionResult.services.length})
                </h4>
                <div className="space-y-2">
                  {importData.extractionResult.services.map((service, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                      <div className="font-medium">{service.name}</div>
                      {service.description && (
                        <div className="text-sm text-gray-500">{service.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {importData.extractionResult.warnings.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-medium text-sm text-orange-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </h4>
                <ul className="space-y-1 text-sm text-orange-600">
                  {importData.extractionResult.warnings.map((warning, idx) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Execution Result */}
      {importData.executionResult && (
        <Card>
          <CardHeader>
            <CardTitle>Execution Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Created */}
            {importData.executionResult.created.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-green-700 mb-2">Created Items</h4>
                <div className="space-y-1">
                  {importData.executionResult.created.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-green-50 rounded">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium capitalize">{item.type}:</span>
                      <span>{item.name}</span>
                      <span className="text-gray-400 text-xs ml-auto">{item.id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skipped */}
            {importData.executionResult.skipped.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-yellow-700 mb-2">Skipped Items</h4>
                <div className="space-y-1">
                  {importData.executionResult.skipped.map((item, idx) => (
                    <div key={idx} className="text-sm p-2 bg-yellow-50 rounded">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium capitalize">{item.type}:</span>
                        <span>{item.name}</span>
                      </div>
                      <div className="text-yellow-600 text-xs ml-6">{item.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed */}
            {importData.executionResult.failed.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-red-700 mb-2">Failed Items</h4>
                <div className="space-y-1">
                  {importData.executionResult.failed.map((item, idx) => (
                    <div key={idx} className="text-sm p-2 bg-red-50 rounded">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="font-medium capitalize">{item.type}:</span>
                        <span>{item.name}</span>
                      </div>
                      <div className="text-red-600 text-xs ml-6">{item.error}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rollback Notice */}
            {importData.executionResult.rollbackPerformed && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-orange-700 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <strong>Rollback performed:</strong> Due to errors, all changes were rolled back.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ImportHistoryDetail;
