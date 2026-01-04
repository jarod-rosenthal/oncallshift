import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  Users,
  DollarSign,
  AlertCircle,
  Activity,
  Terminal,
  GitBranch,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface ControlCenterStats {
  totalWorkers: number;
  activeWorkers: number;
  queueDepth: number;
  todayCost: number;
  todayCompleted: number;
  todayFailed: number;
}

interface WorkerTask {
  id: string;
  jiraKey: string;
  summary: string;
  status: string;
  turnCount: number;
  maxTurns: number;
}

interface Worker {
  id: string;
  displayName: string;
  persona: string;
  status: string;
  tasksCompleted: number;
  tasksFailed: number;
  totalCostUsd: number;
  currentTask: WorkerTask | null;
}

interface TaskStep {
  name: string;
  status: 'done' | 'active' | 'pending';
}

interface TaskLog {
  timestamp: string;
  message: string;
  type: string;
  severity: string;
}

interface ActiveTask {
  id: string;
  jiraIssueKey: string;
  summary: string;
  status: string;
  workerName: string;
  workerPersona: string;
  turnCount: number;
  maxTurns: number;
  estimatedCostUsd: number;
  startedAt: string | null;
  recentLogs: TaskLog[];
  steps: TaskStep[];
}

interface CompletedTask {
  id: string;
  jiraIssueKey: string;
  summary: string;
  status: string;
  costUsd: number;
  durationMinutes: number | null;
  completedAt: string;
  githubPrUrl: string | null;
}

interface ControlCenterData {
  stats: ControlCenterStats;
  workers: Worker[];
  activeTasks: ActiveTask[];
  recentCompleted: CompletedTask[];
}

const API_BASE = import.meta.env.VITE_API_URL || '';

// Persona definitions with full details
const PERSONA_CONFIG: Record<string, { emoji: string; title: string; description: string; skills: string[] }> = {
  developer: {
    emoji: '👨‍💻',
    title: 'Developer',
    description: 'General development tasks across the stack',
    skills: ['TypeScript', 'Node.js', 'React', 'SQL'],
  },
  senior_developer: {
    emoji: '👨‍💻',
    title: 'Senior Developer',
    description: 'Full-stack development, code reviews, architecture decisions',
    skills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL', 'System Design'],
  },
  qa_engineer: {
    emoji: '🧪',
    title: 'QA Engineer',
    description: 'Test writing, quality assurance, bug verification',
    skills: ['Jest', 'Playwright', 'Test Design', 'Bug Triage'],
  },
  devops: {
    emoji: '🔧',
    title: 'DevOps Engineer',
    description: 'Infrastructure, CI/CD, deployment automation',
    skills: ['Terraform', 'AWS', 'Docker', 'GitHub Actions'],
  },
  devops_engineer: {
    emoji: '🔧',
    title: 'DevOps Engineer',
    description: 'Infrastructure, CI/CD, deployment automation',
    skills: ['Terraform', 'AWS', 'Docker', 'GitHub Actions'],
  },
  security_engineer: {
    emoji: '🔒',
    title: 'Security Engineer',
    description: 'Security audits, vulnerability fixes, compliance',
    skills: ['OWASP', 'Penetration Testing', 'IAM', 'Encryption'],
  },
  frontend_developer: {
    emoji: '🎨',
    title: 'Frontend Developer',
    description: 'UI/UX implementation, React components, styling',
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'Accessibility'],
  },
  backend_developer: {
    emoji: '⚙️',
    title: 'Backend Developer',
    description: 'API development, database design, server logic',
    skills: ['Node.js', 'Express', 'PostgreSQL', 'REST APIs'],
  },
  tech_writer: {
    emoji: '📝',
    title: 'Technical Writer',
    description: 'Documentation, API docs, user guides',
    skills: ['Markdown', 'API Documentation', 'User Guides'],
  },
  support: {
    emoji: '🎧',
    title: 'Support Engineer',
    description: 'Customer issues, debugging, escalations',
    skills: ['Troubleshooting', 'Customer Communication', 'Log Analysis'],
  },
  pm: {
    emoji: '📋',
    title: 'Project Manager',
    description: 'Task planning, coordination, status updates',
    skills: ['Jira', 'Project Planning', 'Stakeholder Management'],
  },
};

export default function SuperAdminControlCenter() {
  const [data, setData] = useState<ControlCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE}/api/v1/super-admin/control-center`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch control center data');
      }

      const result = await response.json();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Poll every 5 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchData]);

  const toggleWorkerExpansion = (workerId: string) => {
    setExpandedWorkers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(workerId)) {
        newSet.delete(workerId);
      } else {
        newSet.add(workerId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'executing':
        return 'text-blue-500';
      case 'queued':
      case 'claimed':
      case 'environment_setup':
        return 'text-yellow-500';
      case 'failed':
        return 'text-red-500';
      case 'blocked':
        return 'text-orange-500';
      case 'cancelled':
        return 'text-gray-500';
      case 'pr_created':
      case 'review_pending':
        return 'text-purple-500';
      case 'review_approved':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  const getWorkerStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      working: 'bg-green-500/10 text-green-500 border-green-500/30',
      idle: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
      paused: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
      disabled: 'bg-red-500/10 text-red-500 border-red-500/30',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
  };

  const getPersonaInfo = (persona: string) => {
    return PERSONA_CONFIG[persona] || { emoji: '🤖', title: persona, description: 'AI Worker', skills: [] };
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return '-';
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'file_read':
        return '📝';
      case 'file_changed':
        return '✨';
      case 'command_executed':
        return '⚡';
      case 'test_run':
        return '🧪';
      case 'build_run':
        return '🔨';
      case 'git_operation':
        return '🔀';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'status_change':
        return '🔄';
      default:
        return '📋';
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-lg text-red-500">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Workers Control Center</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage AI worker instances
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            Last updated: {lastUpdated?.toLocaleTimeString() || 'Never'}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs uppercase">Workers</span>
          </div>
          <div className="text-2xl font-bold">{data?.stats.totalWorkers || 0}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Cpu className="w-4 h-4" />
            <span className="text-xs uppercase">Active</span>
          </div>
          <div className="text-2xl font-bold text-green-500">{data?.stats.activeWorkers || 0}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs uppercase">Queue</span>
          </div>
          <div className="text-2xl font-bold text-yellow-500">{data?.stats.queueDepth || 0}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs uppercase">Completed</span>
          </div>
          <div className="text-2xl font-bold text-green-500">{data?.stats.todayCompleted || 0}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <XCircle className="w-4 h-4" />
            <span className="text-xs uppercase">Failed</span>
          </div>
          <div className="text-2xl font-bold text-red-500">{data?.stats.todayFailed || 0}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs uppercase">Cost Today</span>
          </div>
          <div className="text-2xl font-bold">${data?.stats.todayCost?.toFixed(2) || '0.00'}</div>
        </div>
      </div>

      {/* Workers Section - Each worker is an expandable card */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Workers</h2>

        {data?.workers.map((worker) => {
          const personaInfo = getPersonaInfo(worker.persona);
          const isExpanded = expandedWorkers.has(worker.id);
          const workerActiveTask = data?.activeTasks.find((t) => t.workerName === worker.displayName);

          return (
            <div key={worker.id} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Worker Header - Always visible */}
              <button
                onClick={() => toggleWorkerExpansion(worker.id)}
                className="w-full px-4 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
              >
                {/* Status indicator */}
                <div className={`w-3 h-3 rounded-full ${
                  worker.status === 'working' ? 'bg-green-500 animate-pulse' :
                  worker.status === 'idle' ? 'bg-yellow-500' :
                  worker.status === 'paused' ? 'bg-orange-500' : 'bg-red-500'
                }`} />

                {/* Persona emoji */}
                <span className="text-2xl">{personaInfo.emoji}</span>

                {/* Worker info */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{worker.displayName}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium uppercase rounded border ${getWorkerStatusBadge(worker.status)}`}>
                      {worker.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">{personaInfo.title}</div>
                </div>

                {/* Current task preview */}
                {worker.currentTask && (
                  <div className="hidden md:flex items-center gap-3 text-sm">
                    <span className="text-primary font-mono">{worker.currentTask.jiraKey}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(worker.currentTask.turnCount / worker.currentTask.maxTurns) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {worker.currentTask.turnCount}/{worker.currentTask.maxTurns}
                      </span>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="hidden lg:flex items-center gap-4 text-sm">
                  <span className="text-green-500">{worker.tasksCompleted} done</span>
                  <span className="text-red-500">{worker.tasksFailed} failed</span>
                  <span className="text-muted-foreground">${worker.totalCostUsd.toFixed(2)}</span>
                </div>

                {/* Expand icon */}
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-border">
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left: Persona details */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">About This Worker</h4>
                        <p className="text-sm">{personaInfo.description}</p>
                      </div>

                      {personaInfo.skills.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Skills</h4>
                          <div className="flex flex-wrap gap-2">
                            {personaInfo.skills.map((skill) => (
                              <span
                                key={skill}
                                className="px-2 py-1 bg-muted text-xs rounded-full"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-4 pt-2">
                        <div>
                          <div className="text-xs text-muted-foreground">Completed</div>
                          <div className="text-lg font-semibold text-green-500">{worker.tasksCompleted}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Failed</div>
                          <div className="text-lg font-semibold text-red-500">{worker.tasksFailed}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Total Cost</div>
                          <div className="text-lg font-semibold">${worker.totalCostUsd.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Current task details */}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Current Task</h4>
                      {workerActiveTask ? (
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <a
                                href={`https://oncallshift.atlassian.net/browse/${workerActiveTask.jiraIssueKey}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1 font-medium"
                              >
                                {workerActiveTask.jiraIssueKey}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              <p className="text-sm text-muted-foreground mt-1">{workerActiveTask.summary}</p>
                            </div>
                            <span className={`text-xs uppercase font-medium ${getStatusColor(workerActiveTask.status)}`}>
                              {workerActiveTask.status.replace(/_/g, ' ')}
                            </span>
                          </div>

                          {/* Progress steps */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {workerActiveTask.steps.map((step, index) => (
                              <div key={step.name} className="flex items-center">
                                <div className="flex items-center gap-1">
                                  {step.status === 'done' && <CheckCircle className="w-3 h-3 text-green-500" />}
                                  {step.status === 'active' && <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />}
                                  {step.status === 'pending' && <div className="w-3 h-3 rounded-full border border-muted-foreground" />}
                                  <span className={`text-xs ${
                                    step.status === 'active' ? 'text-blue-500' :
                                    step.status === 'done' ? 'text-green-500' : 'text-muted-foreground'
                                  }`}>
                                    {step.name}
                                  </span>
                                </div>
                                {index < workerActiveTask.steps.length - 1 && <div className="w-4 h-px bg-border mx-1" />}
                              </div>
                            ))}
                          </div>

                          {/* Progress bar */}
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-muted-foreground" />
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${(workerActiveTask.turnCount / workerActiveTask.maxTurns) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {workerActiveTask.turnCount}/{workerActiveTask.maxTurns} turns
                            </span>
                          </div>

                          {/* Recent logs */}
                          {workerActiveTask.recentLogs.length > 0 && (
                            <div className="bg-muted/30 rounded p-2 max-h-32 overflow-y-auto">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                <Terminal className="w-3 h-3" />
                                Recent Activity
                              </div>
                              <div className="space-y-0.5 font-mono text-xs">
                                {workerActiveTask.recentLogs.slice(0, 5).map((log, index) => (
                                  <div key={index} className="flex items-start gap-1">
                                    <span className="text-muted-foreground">
                                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span>{getLogIcon(log.type)}</span>
                                    <span className={log.severity === 'error' ? 'text-red-500' : ''}>{log.message}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : worker.currentTask ? (
                        <div className="space-y-2">
                          <a
                            href={`https://oncallshift.atlassian.net/browse/${worker.currentTask.jiraKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {worker.currentTask.jiraKey}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <p className="text-sm text-muted-foreground">{worker.currentTask.summary}</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${(worker.currentTask.turnCount / worker.currentTask.maxTurns) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {worker.currentTask.turnCount}/{worker.currentTask.maxTurns}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Worker is idle</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {(!data?.workers || data.workers.length === 0) && (
          <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
            No workers configured
          </div>
        )}
      </div>

      {/* Recent Completed */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50">
          <h2 className="font-semibold">Recent Completed (Today)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Task</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Summary</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Cost</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Duration</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">PR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.recentCompleted.map((task) => (
                <tr key={task.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <a
                      href={`https://oncallshift.atlassian.net/browse/${task.jiraIssueKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {task.jiraIssueKey}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{task.summary}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 ${getStatusColor(task.status)}`}>
                      {task.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                      {task.status === 'failed' && <XCircle className="w-4 h-4" />}
                      <span className="capitalize">{task.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">${task.costUsd.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {formatDuration(task.durationMinutes)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {task.githubPrUrl ? (
                      <a
                        href={task.githubPrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 justify-end"
                      >
                        <GitBranch className="w-3 h-3" />
                        View PR
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!data?.recentCompleted || data.recentCompleted.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No completed tasks today
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
