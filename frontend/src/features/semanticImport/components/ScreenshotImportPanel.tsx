/**
 * Screenshot Import Panel
 * Drag & drop screenshot upload with AI-powered analysis
 */
import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  ImageIcon,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  ArrowUpCircle,
  Server,
  Lightbulb,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  semanticImportAPI,
  validateImageFile,
  RateLimitError,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_FILE_TYPES,
} from '../api/semanticImportApi';
import type {
  ImportExtraction,
  ExtractedTeam,
  ExtractedSchedule,
  ExtractedEscalationPolicy,
  ExtractedService,
  ImportSourceType,
} from '../types';

interface ScreenshotImportPanelProps {
  onAnalysisComplete: (extraction: ImportExtraction) => void;
  isLoading?: boolean;
}

type AnalysisState = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({
  title,
  icon,
  count,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-medium">{title}</span>
          <span className="text-sm text-gray-500">({count})</span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="p-4 border-t bg-white">{children}</div>}
    </div>
  );
}

function formatSourceType(source: ImportSourceType): string {
  switch (source) {
    case 'pagerduty':
      return 'PagerDuty';
    case 'opsgenie':
      return 'Opsgenie';
    case 'screenshot':
      return 'Screenshot';
    case 'natural_language':
      return 'Natural Language';
    default:
      return 'Unknown';
  }
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600 bg-green-50';
  if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

export function ScreenshotImportPanel({
  onAnalysisComplete,
  isLoading: externalLoading = false,
}: ScreenshotImportPanelProps) {
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ resetAt?: Date } | null>(null);
  const [extraction, setExtraction] = useState<ImportExtraction | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeMB = MAX_FILE_SIZE_BYTES / (1024 * 1024);
  const allowedExtensions = ALLOWED_FILE_TYPES.map((t) => t.split('/')[1].toUpperCase()).join(', ');

  const clearState = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setRateLimitInfo(null);
    setExtraction(null);
    setAnalysisState('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setRateLimitInfo(null);
    setExtraction(null);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the drop zone entirely
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setError(null);
    setRateLimitInfo(null);
    setAnalysisState('uploading');

    try {
      setAnalysisState('analyzing');
      const response = await semanticImportAPI.analyzeScreenshotFile(selectedFile);

      if (!response.success || !response.extraction) {
        setError(response.error || 'Failed to analyze screenshot');
        setAnalysisState('error');
        return;
      }

      setExtraction(response.extraction);
      setAnalysisState('complete');
    } catch (err) {
      if (err instanceof RateLimitError) {
        setError(err.message);
        setRateLimitInfo({ resetAt: err.resetAt });
        setAnalysisState('error');
      } else if (err instanceof Error) {
        setError(err.message);
        setAnalysisState('error');
      } else {
        setError('An unexpected error occurred');
        setAnalysisState('error');
      }
    }
  };

  const handleConfirm = () => {
    if (extraction) {
      onAnalysisComplete(extraction);
    }
  };

  const isLoading = externalLoading || analysisState === 'uploading' || analysisState === 'analyzing';

  // Render Teams Section
  const renderTeams = (teams: ExtractedTeam[]) => (
    <div className="space-y-2">
      {teams.map((team, idx) => (
        <div key={idx} className="p-3 bg-gray-50 rounded-lg">
          <div className="font-medium text-gray-900">{team.name}</div>
          {team.members.length > 0 && (
            <div className="mt-1 text-sm text-gray-600">
              Members: {team.members.map((m) => m.name).join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // Render Schedules Section
  const renderSchedules = (schedules: ExtractedSchedule[]) => (
    <div className="space-y-2">
      {schedules.map((schedule, idx) => (
        <div key={idx} className="p-3 bg-gray-50 rounded-lg">
          <div className="font-medium text-gray-900">{schedule.name}</div>
          <div className="mt-1 text-sm text-gray-600 space-y-1">
            {schedule.teamName && <div>Team: {schedule.teamName}</div>}
            <div>
              Rotation: {schedule.rotationType}
              {schedule.handoffTime && ` at ${schedule.handoffTime}`}
              {schedule.handoffDay && ` on ${schedule.handoffDay}`}
            </div>
            {schedule.timezone && <div>Timezone: {schedule.timezone}</div>}
            {schedule.participants.length > 0 && (
              <div>Participants: {schedule.participants.map((p) => p.name).join(', ')}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // Render Escalation Policies Section
  const renderEscalationPolicies = (policies: ExtractedEscalationPolicy[]) => (
    <div className="space-y-2">
      {policies.map((policy, idx) => (
        <div key={idx} className="p-3 bg-gray-50 rounded-lg">
          <div className="font-medium text-gray-900">{policy.name}</div>
          {policy.steps.length > 0 && (
            <div className="mt-2 space-y-1">
              {policy.steps.map((step, stepIdx) => (
                <div key={stepIdx} className="text-sm text-gray-600 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                    {stepIdx + 1}
                  </span>
                  <span>
                    {step.targets.map((t) => `${t.name} (${t.type})`).join(', ')}
                    {step.delayMinutes > 0 && (
                      <span className="text-gray-400 ml-2">
                        (wait {step.delayMinutes}m before next)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // Render Services Section
  const renderServices = (services: ExtractedService[]) => (
    <div className="space-y-2">
      {services.map((service, idx) => (
        <div key={idx} className="p-3 bg-gray-50 rounded-lg">
          <div className="font-medium text-gray-900">{service.name}</div>
          {service.description && (
            <div className="mt-1 text-sm text-gray-600">{service.description}</div>
          )}
          <div className="mt-1 text-sm text-gray-500 space-x-4">
            {service.teamName && <span>Team: {service.teamName}</span>}
            {service.escalationPolicyName && (
              <span>Escalation: {service.escalationPolicyName}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Screenshot Import
        </CardTitle>
        <CardDescription>
          Upload a screenshot of your PagerDuty or Opsgenie configuration. Our AI will analyze it
          and extract teams, schedules, escalation policies, and services.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Drop Zone */}
        {analysisState === 'idle' && !selectedFile && (
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer
              ${isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_FILE_TYPES.join(',')}
              onChange={handleInputChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-4">
              <div
                className={`
                  w-16 h-16 rounded-full flex items-center justify-center transition-colors
                  ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}
                `}
              >
                <ImageIcon
                  className={`h-8 w-8 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
                />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-700">
                  {isDragging ? 'Drop your screenshot here' : 'Drag & drop a screenshot'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  or{' '}
                  <span className="text-blue-600 hover:text-blue-700 font-medium">
                    click to browse
                  </span>
                </p>
              </div>
              <div className="text-xs text-gray-400">
                {allowedExtensions} up to {maxSizeMB}MB
              </div>
            </div>
          </div>
        )}

        {/* Selected File Preview */}
        {selectedFile && previewUrl && analysisState !== 'complete' && (
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border bg-white flex-shrink-0">
                <img
                  src={previewUrl}
                  alt="Screenshot preview"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  {!isLoading && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearState}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Loading State */}
                {isLoading && (
                  <div className="mt-4 flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    <span className="text-sm text-gray-600">
                      {analysisState === 'uploading'
                        ? 'Uploading screenshot...'
                        : 'Analyzing with AI...'}
                    </span>
                  </div>
                )}

                {/* Progress Bar (visual only) */}
                {isLoading && (
                  <div className="mt-3">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-1000 animate-pulse"
                        style={{
                          width: analysisState === 'uploading' ? '30%' : '80%',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Analyze Button */}
            {!isLoading && analysisState !== 'error' && (
              <div className="flex justify-end">
                <Button onClick={handleAnalyze} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Analyze Screenshot
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-800">Analysis Failed</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                {rateLimitInfo?.resetAt && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                    <Clock className="h-4 w-4" />
                    <span>
                      Try again after {rateLimitInfo.resetAt.toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={clearState}>
                Try Another Screenshot
              </Button>
              {!rateLimitInfo && (
                <Button variant="outline" size="sm" onClick={handleAnalyze}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Analysis Complete - Show Results */}
        {analysisState === 'complete' && extraction && (
          <div className="space-y-6">
            {/* Success Header */}
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <div className="flex-1">
                <p className="font-medium text-green-800">Analysis Complete</p>
                <p className="text-sm text-green-600">
                  Found {extraction.teams.length} teams, {extraction.schedules.length} schedules,{' '}
                  {extraction.escalationPolicies.length} escalation policies, and{' '}
                  {extraction.services.length} services
                </p>
              </div>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Source Detected:</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                  {formatSourceType(extraction.sourceDetected)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Confidence:</span>
                <span
                  className={`px-2 py-1 rounded text-sm font-medium ${getConfidenceColor(
                    extraction.confidence
                  )}`}
                >
                  {getConfidenceLabel(extraction.confidence)} ({Math.round(extraction.confidence * 100)}%)
                </span>
              </div>
            </div>

            {/* Warnings */}
            {extraction.warnings.length > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-yellow-800">Warnings</p>
                    <ul className="mt-2 space-y-1">
                      {extraction.warnings.map((warning, idx) => (
                        <li key={idx} className="text-sm text-yellow-700">
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {extraction.suggestions.length > 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-blue-800">Suggestions</p>
                    <ul className="mt-2 space-y-1">
                      {extraction.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="text-sm text-blue-700">
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Collapsible Entity Sections */}
            <div className="space-y-3">
              <CollapsibleSection
                title="Teams"
                icon={<Users className="h-5 w-5 text-purple-500" />}
                count={extraction.teams.length}
                defaultOpen={true}
              >
                {renderTeams(extraction.teams)}
              </CollapsibleSection>

              <CollapsibleSection
                title="Schedules"
                icon={<Calendar className="h-5 w-5 text-green-500" />}
                count={extraction.schedules.length}
                defaultOpen={true}
              >
                {renderSchedules(extraction.schedules)}
              </CollapsibleSection>

              <CollapsibleSection
                title="Escalation Policies"
                icon={<ArrowUpCircle className="h-5 w-5 text-orange-500" />}
                count={extraction.escalationPolicies.length}
                defaultOpen={true}
              >
                {renderEscalationPolicies(extraction.escalationPolicies)}
              </CollapsibleSection>

              <CollapsibleSection
                title="Services"
                icon={<Server className="h-5 w-5 text-blue-500" />}
                count={extraction.services.length}
                defaultOpen={true}
              >
                {renderServices(extraction.services)}
              </CollapsibleSection>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={clearState}>
                Start Over
              </Button>
              <Button onClick={handleConfirm} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Continue to Preview
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ScreenshotImportPanel;
