import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { cloudCredentialsAPI } from '../lib/api-client';
import type { CloudCredential, CloudAccessLog } from '../types/api';
import {
  Cloud,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Terminal,
  Copy,
  Check,
  Sparkles,
  Server,
  Lightbulb,
  Shield,
} from 'lucide-react';

interface CloudAnalysisPanelProps {
  incidentId: string;
  incidentState: string;
}

interface InvestigationResult {
  success: boolean;
  provider?: string;
  findings: string[];
  recommendations: any[];
  commands_executed: any[];
  error_message?: string;
  root_cause?: string;
  ai_analysis?: {
    root_cause: string;
    affected_resources: string[];
    recommendations: Array<{
      severity: string;
      title: string;
      description: string;
      command?: string;
      risk: string;
      automated: boolean;
      expectedImpact?: string;
      rollbackPlan?: string;
    }>;
    confidence: string;
    additional_investigation: string[];
    correlation_insights?: string;
  };
  incident_context?: {
    incidentNumber: number;
    summary: string;
    severity: string;
    serviceName: string;
    eventCount: number;
  };
}

const PROVIDER_COLORS: Record<string, string> = {
  aws: 'bg-orange-500',
  azure: 'bg-blue-500',
  gcp: 'bg-red-500',
};

const PROVIDER_NAMES: Record<string, string> = {
  aws: 'Amazon Web Services',
  azure: 'Microsoft Azure',
  gcp: 'Google Cloud Platform',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const RISK_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

export function CloudAnalysisPanel({ incidentId, incidentState }: CloudAnalysisPanelProps) {
  const [credentials, setCredentials] = useState<CloudCredential[]>([]);
  const [accessLogs, setAccessLogs] = useState<CloudAccessLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<InvestigationResult | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<number | null>(null);

  useEffect(() => {
    loadCredentials();
    loadAccessLogs();
  }, [incidentId]);

  const loadCredentials = async () => {
    try {
      setIsLoading(true);
      const response = await cloudCredentialsAPI.list();
      setCredentials((response?.credentials || []).filter((c: CloudCredential) => c.enabled));
    } catch (err) {
      console.error('Failed to load cloud credentials:', err);
      setCredentials([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccessLogs = async () => {
    try {
      const response = await cloudCredentialsAPI.getAccessLogs({ incident_id: incidentId, limit: 10 });
      setAccessLogs(response?.logs || []);
    } catch (err) {
      console.error('Failed to load access logs:', err);
      setAccessLogs([]);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedCredential) return;

    setIsAnalyzing(true);
    setError(null);
    setLatestResult(null);

    try {
      const result = await cloudCredentialsAPI.investigate(selectedCredential, incidentId);

      if (result.success) {
        setLatestResult(result);
        // Refresh access logs to show the new investigation
        loadAccessLogs();
      } else {
        setError(result.error_message || 'Investigation failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to run investigation');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyCommand = (command: string, index: number) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(index);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400';
      case 'high': return 'text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400';
      case 'medium': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400';
      case 'low': return 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900 dark:text-gray-400';
    }
  };

  // Don't show for resolved incidents unless there are previous analyses
  if (incidentState === 'resolved' && accessLogs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            Cloud Analysis
            {latestResult?.ai_analysis && (
              <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                AI Powered
              </span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-6 w-6 p-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : credentials.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No cloud credentials configured.{' '}
              <a href="/settings/cloud-credentials" className="text-primary hover:underline">
                Add credentials
              </a>
            </p>
          ) : (
            <>
              {/* Credential Selection and Analysis Button */}
              {incidentState !== 'resolved' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {credentials.map((credential) => (
                      <button
                        key={credential.id}
                        onClick={() => setSelectedCredential(
                          selectedCredential === credential.id ? null : credential.id
                        )}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          selectedCredential === credential.id
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-primary/50'
                        }`}
                      >
                        <div className={`w-6 h-6 ${PROVIDER_COLORS[credential.provider]} rounded flex items-center justify-center text-white text-xs font-bold`}>
                          {credential.provider.toUpperCase().slice(0, 2)}
                        </div>
                        <span>{credential.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          credential.permission_level === 'read_only'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                        }`}>
                          {credential.permission_level === 'read_only' ? 'RO' : 'RW'}
                        </span>
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={handleStartAnalysis}
                    disabled={!selectedCredential || isAnalyzing}
                    className="w-full"
                    size="sm"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing with AI...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Cloud Investigation
                      </>
                    )}
                  </Button>

                  {error && (
                    <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm text-red-700 dark:text-red-300">
                      <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {selectedCredential && !error && !latestResult && (
                    <p className="text-xs text-muted-foreground text-center">
                      Claude AI will investigate your {
                        PROVIDER_NAMES[credentials.find(c => c.id === selectedCredential)?.provider || ''] || 'cloud'
                      } resources and provide root cause analysis
                    </p>
                  )}
                </div>
              )}

              {/* Latest AI Analysis Results */}
              {latestResult?.ai_analysis && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      AI Analysis Results
                    </h4>
                    <span className={`text-xs px-2 py-0.5 rounded ${CONFIDENCE_COLORS[latestResult.ai_analysis.confidence]}`}>
                      {latestResult.ai_analysis.confidence.toUpperCase()} Confidence
                    </span>
                  </div>

                  {/* Root Cause */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-red-500" />
                      Root Cause
                    </h5>
                    <p className="text-sm bg-muted/50 p-3 rounded-lg">
                      {latestResult.ai_analysis.root_cause}
                    </p>
                  </div>

                  {/* Correlation Insights */}
                  {latestResult.ai_analysis.correlation_insights && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-yellow-500" />
                        Correlation Insights
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        {latestResult.ai_analysis.correlation_insights}
                      </p>
                    </div>
                  )}

                  {/* Affected Resources */}
                  {latestResult.ai_analysis.affected_resources.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium flex items-center gap-2">
                        <Server className="w-4 h-4 text-blue-500" />
                        Affected Resources ({latestResult.ai_analysis.affected_resources.length})
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {latestResult.ai_analysis.affected_resources.map((resource, i) => (
                          <span key={i} className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            {resource}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Recommendations */}
                  {latestResult.ai_analysis.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        Remediation Steps ({latestResult.ai_analysis.recommendations.length})
                      </h5>
                      <div className="space-y-3">
                        {latestResult.ai_analysis.recommendations.map((rec, i) => (
                          <div key={i} className={`p-3 rounded-lg border ${getSeverityColor(rec.severity)}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{rec.title}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${RISK_COLORS[rec.risk]}`}>
                                    {rec.risk} risk
                                  </span>
                                  {rec.automated && (
                                    <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                      automatable
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm opacity-80">{rec.description}</p>
                                {rec.expectedImpact && (
                                  <p className="text-xs opacity-70">
                                    <strong>Expected impact:</strong> {rec.expectedImpact}
                                  </p>
                                )}
                                {rec.rollbackPlan && (
                                  <p className="text-xs opacity-70">
                                    <strong>Rollback:</strong> {rec.rollbackPlan}
                                  </p>
                                )}
                              </div>
                            </div>
                            {rec.command && (
                              <div className="mt-2 relative">
                                <pre className="text-xs bg-black/10 dark:bg-white/10 p-2 rounded overflow-x-auto font-mono">
                                  {rec.command}
                                </pre>
                                <button
                                  onClick={() => copyCommand(rec.command!, i)}
                                  className="absolute top-1 right-1 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"
                                  title="Copy command"
                                >
                                  {copiedCommand === i ? (
                                    <Check className="w-3 h-3 text-green-500" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Investigation */}
                  {latestResult.ai_analysis.additional_investigation.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium">Additional Investigation Suggested:</h5>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {latestResult.ai_analysis.additional_investigation.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Commands Executed */}
              {latestResult && latestResult.commands_executed.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <h5 className="text-sm font-medium flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    API Calls Made ({latestResult.commands_executed.length})
                  </h5>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {latestResult.commands_executed.map((cmd, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {cmd.result === 'success' ? (
                          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                        ) : cmd.result === 'access_denied' ? (
                          <Shield className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                        )}
                        <span className="text-muted-foreground">{cmd.service}:</span>
                        <span className="font-mono truncate">{cmd.command}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Previous Analyses */}
              {accessLogs.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="flex items-center gap-2 text-sm font-medium w-full"
                  >
                    {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Previous Analyses ({accessLogs.length})
                  </button>

                  {showLogs && (
                    <div className="space-y-3 pt-2">
                      {accessLogs.map((log) => (
                        <div key={log.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 ${PROVIDER_COLORS[log.provider]} rounded flex items-center justify-center text-white text-xs font-bold`}>
                                {log.provider.toUpperCase().slice(0, 2)}
                              </div>
                              <span className={`flex items-center gap-1 text-xs font-medium ${
                                log.status === 'completed' ? 'text-green-600' :
                                log.status === 'failed' ? 'text-red-600' :
                                'text-yellow-600'
                              }`}>
                                {log.status === 'completed' ? <CheckCircle className="w-3 h-3" /> :
                                 log.status === 'failed' ? <XCircle className="w-3 h-3" /> :
                                 <Loader2 className="w-3 h-3 animate-spin" />}
                                {log.status}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                by {log.user?.full_name || 'Unknown'}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.session_start).toLocaleString()}
                            </span>
                          </div>

                          {/* Root Cause (if available) */}
                          {log.root_cause && (
                            <div className="text-sm bg-muted/50 p-2 rounded">
                              <strong className="text-xs text-muted-foreground">Root Cause:</strong>
                              <p className="mt-1">{log.root_cause}</p>
                            </div>
                          )}

                          {/* Findings */}
                          {log.findings && log.findings.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Findings:</p>
                              <ul className="text-sm space-y-1">
                                {log.findings.slice(0, 3).map((finding, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-primary">•</span>
                                    <span>{finding}</span>
                                  </li>
                                ))}
                                {log.findings.length > 3 && (
                                  <li className="text-xs text-muted-foreground">
                                    +{log.findings.length - 3} more findings
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}

                          {/* Recommendations */}
                          {log.recommendations && log.recommendations.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Recommendations:</p>
                              <div className="space-y-1">
                                {log.recommendations.slice(0, 2).map((rec, i) => (
                                  <div
                                    key={i}
                                    className={`flex items-start gap-2 p-2 rounded text-sm ${getSeverityColor(rec.severity)}`}
                                  >
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <p className="font-medium">{rec.title}</p>
                                      <p className="text-xs opacity-80">{rec.description}</p>
                                    </div>
                                  </div>
                                ))}
                                {log.recommendations.length > 2 && (
                                  <p className="text-xs text-muted-foreground">
                                    +{log.recommendations.length - 2} more recommendations
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Error message */}
                          {log.error_message && (
                            <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm text-red-700 dark:text-red-300">
                              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span>{log.error_message}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
