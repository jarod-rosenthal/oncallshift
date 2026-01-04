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
  Search,
  Filter,
  RotateCcw,
  StopCircle,
  Eye,
  Zap,
  Shield,
  X,
  History,
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

// Self-recovery types
interface WatcherStatus {
  enabled: boolean;
  lastRunAt: string | null;
  stuckTasks: number;
  pendingRetries: number;
  loopsDetected: number;
  globalTimeouts: number;
  tasksMonitored: number;
}

interface TaskRun {
  id: string;
  runNumber: number;
  outcome: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  errorMessage: string | null;
  errorCategory: string | null;
  capturedContext: string | null;
  ecsTaskArn: string | null;
  claudeInputTokens: number;
  claudeOutputTokens: number;
  estimatedCostUsd: number;
  filesModified: string[];
  gitBranch: string | null;
  gitCommitSha: string | null;
}

interface TaskWithRuns {
  id: string;
  jiraIssueKey: string;
  summary: string;
  status: string;
  retryCount: number;
  maxRetries: number;
  lastHeartbeatAt: string | null;
  globalTimeoutAt: string | null;
  nextRetryAt: string | null;
  retryBackoffSeconds: number;
  failureCategory: string | null;
  errorMessage: string | null;
  watcherNotes: string | null;
  estimatedCostUsd: number;
  startedAt: string | null;
  completedAt: string | null;
  ecsTaskArn: string | null;
  runs?: TaskRun[];
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

  // Self-recovery state
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus | null>(null);
  const [taskList, setTaskList] = useState<TaskWithRuns[]>([]);
  const [taskListLoading, setTaskListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskWithRuns | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [retryOptions, setRetryOptions] = useState({ resetRetryCount: false, customContext: '' });
  const [cancelReason, setCancelReason] = useState('');

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

  // Fetch watcher status
  const fetchWatcherStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE}/api/v1/super-admin/control-center/watcher/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setWatcherStatus(result);
      }
    } catch (err) {
      console.error('Failed to fetch watcher status:', err);
    }
  }, []);

  // Fetch task list with filters
  const fetchTaskList = useCallback(async () => {
    setTaskListLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '50');

      const response = await fetch(`${API_BASE}/api/v1/super-admin/control-center/tasks?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setTaskList(result.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch task list:', err);
    } finally {
      setTaskListLoading(false);
    }
  }, [statusFilter, searchQuery]);

  // Fetch task runs for detail modal
  const fetchTaskRuns = useCallback(async (taskId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE}/api/v1/super-admin/control-center/tasks/${taskId}/runs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setSelectedTask((prev) => (prev ? { ...prev, runs: result.runs } : null));
      }
    } catch (err) {
      console.error('Failed to fetch task runs:', err);
    }
  }, []);

  // Retry task
  const handleRetryTask = async () => {
    if (!selectedTask) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE}/api/v1/super-admin/control-center/tasks/${selectedTask.id}/retry`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(retryOptions),
      });
      if (response.ok) {
        setShowRetryModal(false);
        setRetryOptions({ resetRetryCount: false, customContext: '' });
        fetchTaskList();
        fetchData();
      }
    } catch (err) {
      console.error('Failed to retry task:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel task
  const handleCancelTask = async () => {
    if (!selectedTask) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE}/api/v1/super-admin/control-center/tasks/${selectedTask.id}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (response.ok) {
        setShowCancelModal(false);
        setCancelReason('');
        fetchTaskList();
        fetchData();
      }
    } catch (err) {
      console.error('Failed to cancel task:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Open detail modal
  const openDetailModal = (task: TaskWithRuns) => {
    setSelectedTask(task);
    setShowDetailModal(true);
    fetchTaskRuns(task.id);
  };

  useEffect(() => {
    fetchData();
    fetchWatcherStatus();
    fetchTaskList();

    // Poll every 5 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData();
        fetchWatcherStatus();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchData, fetchWatcherStatus, fetchTaskList]);

  // Refetch task list when filters change
  useEffect(() => {
    fetchTaskList();
  }, [statusFilter, searchQuery, fetchTaskList]);

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

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'timeout':
        return 'text-orange-500';
      case 'killed':
        return 'text-yellow-500';
      case 'cancelled':
        return 'text-gray-500';
      default:
        return 'text-muted-foreground';
    }
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

      {/* Watcher Status Panel */}
      {watcherStatus && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Watcher Service</h3>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded ${
                  watcherStatus.enabled
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-red-500/10 text-red-500'
                }`}
              >
                {watcherStatus.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Last run: {formatRelativeTime(watcherStatus.lastRunAt)}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Monitored</div>
              <div className="text-lg font-semibold">{watcherStatus.tasksMonitored}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Stuck</div>
              <div className={`text-lg font-semibold ${watcherStatus.stuckTasks > 0 ? 'text-red-500' : ''}`}>
                {watcherStatus.stuckTasks}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Pending Retries</div>
              <div className={`text-lg font-semibold ${watcherStatus.pendingRetries > 0 ? 'text-yellow-500' : ''}`}>
                {watcherStatus.pendingRetries}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Loops Detected</div>
              <div className={`text-lg font-semibold ${watcherStatus.loopsDetected > 0 ? 'text-orange-500' : ''}`}>
                {watcherStatus.loopsDetected}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Timeouts</div>
              <div className={`text-lg font-semibold ${watcherStatus.globalTimeouts > 0 ? 'text-red-500' : ''}`}>
                {watcherStatus.globalTimeouts}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task List with Filtering */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-semibold flex items-center gap-2">
            <History className="w-4 h-4" />
            All Tasks
          </h2>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search Jira key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md w-40 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {/* Status Filter */}
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Status</option>
                <option value="executing">Executing</option>
                <option value="queued">Queued</option>
                <option value="failed">Failed</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Task Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Task</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Summary</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">Retries</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Cost</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {taskListLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : taskList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No tasks found
                  </td>
                </tr>
              ) : (
                taskList.map((task) => (
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
                      <div className="flex flex-col gap-0.5">
                        <span className={`flex items-center gap-1 ${getStatusColor(task.status)}`}>
                          {task.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                          {task.status === 'failed' && <XCircle className="w-3 h-3" />}
                          {task.status === 'executing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                          {task.status === 'queued' && <Clock className="w-3 h-3" />}
                          <span className="capitalize text-xs">{task.status.replace(/_/g, ' ')}</span>
                        </span>
                        {task.failureCategory && (
                          <span className="text-xs text-muted-foreground">{task.failureCategory}</span>
                        )}
                        {task.nextRetryAt && (
                          <span className="text-xs text-yellow-500">
                            Retry: {formatRelativeTime(task.nextRetryAt)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={task.retryCount > 0 ? 'text-yellow-500' : ''}>
                        {task.retryCount}/{task.maxRetries}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">${task.estimatedCostUsd.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetailModal(task)}
                          className="p-1.5 hover:bg-muted rounded"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {['failed', 'blocked', 'cancelled'].includes(task.status) && (
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setShowRetryModal(true);
                            }}
                            className="p-1.5 hover:bg-muted rounded text-green-500"
                            title="Retry Task"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {['executing', 'queued', 'environment_setup'].includes(task.status) && (
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setShowCancelModal(true);
                            }}
                            className="p-1.5 hover:bg-muted rounded text-red-500"
                            title="Cancel Task"
                          >
                            <StopCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

      {/* Task Detail Modal */}
      {showDetailModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <a
                  href={`https://oncallshift.atlassian.net/browse/${selectedTask.jiraIssueKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  {selectedTask.jiraIssueKey}
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(selectedTask.status)}`}>
                  {selectedTask.status.replace(/_/g, ' ')}
                </span>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-muted-foreground">{selectedTask.summary}</p>

              {/* Task Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Retries</div>
                  <div className="font-medium">{selectedTask.retryCount}/{selectedTask.maxRetries}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Cost</div>
                  <div className="font-medium">${selectedTask.estimatedCostUsd.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Last Heartbeat</div>
                  <div className="font-medium">{formatRelativeTime(selectedTask.lastHeartbeatAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Global Timeout</div>
                  <div className="font-medium">
                    {selectedTask.globalTimeoutAt ? new Date(selectedTask.globalTimeoutAt).toLocaleTimeString() : 'Not set'}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {selectedTask.errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                  <div className="flex items-center gap-2 text-red-500 text-sm font-medium mb-1">
                    <AlertCircle className="w-4 h-4" />
                    Error {selectedTask.failureCategory && `(${selectedTask.failureCategory})`}
                  </div>
                  <pre className="text-xs text-red-400 whitespace-pre-wrap overflow-x-auto">
                    {selectedTask.errorMessage}
                  </pre>
                </div>
              )}

              {/* Watcher Notes */}
              {selectedTask.watcherNotes && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                  <div className="flex items-center gap-2 text-yellow-500 text-sm font-medium mb-1">
                    <Shield className="w-4 h-4" />
                    Watcher Notes
                  </div>
                  <pre className="text-xs text-yellow-400 whitespace-pre-wrap overflow-x-auto">
                    {selectedTask.watcherNotes}
                  </pre>
                </div>
              )}

              {/* Run History Timeline */}
              {selectedTask.runs && selectedTask.runs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Run History
                  </h4>
                  <div className="space-y-3">
                    {selectedTask.runs.map((run) => (
                      <div
                        key={run.id}
                        className="border border-border rounded-lg p-3 bg-muted/20"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Run #{run.runNumber}</span>
                            <span className={`text-xs font-medium ${getOutcomeColor(run.outcome)}`}>
                              {run.outcome.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(run.startedAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Duration:</span>{' '}
                            {run.durationSeconds ? `${Math.floor(run.durationSeconds / 60)}m ${run.durationSeconds % 60}s` : '-'}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cost:</span> ${run.estimatedCostUsd.toFixed(3)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tokens:</span>{' '}
                            {run.claudeInputTokens.toLocaleString()} / {run.claudeOutputTokens.toLocaleString()}
                          </div>
                          {run.gitBranch && (
                            <div className="flex items-center gap-1">
                              <GitBranch className="w-3 h-3" />
                              <span className="truncate">{run.gitBranch}</span>
                            </div>
                          )}
                        </div>

                        {run.errorMessage && (
                          <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded p-2">
                            {run.errorCategory && <span className="font-medium">[{run.errorCategory}] </span>}
                            {run.errorMessage}
                          </div>
                        )}

                        {run.filesModified && run.filesModified.length > 0 && (
                          <div className="mt-2 text-xs">
                            <span className="text-muted-foreground">Files: </span>
                            {run.filesModified.slice(0, 5).join(', ')}
                            {run.filesModified.length > 5 && ` +${run.filesModified.length - 5} more`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              {['failed', 'blocked', 'cancelled'].includes(selectedTask.status) && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowRetryModal(true);
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry
                </button>
              )}
              {['executing', 'queued', 'environment_setup'].includes(selectedTask.status) && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowCancelModal(true);
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
                >
                  <StopCircle className="w-4 h-4" />
                  Cancel
                </button>
              )}
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retry Modal */}
      {showRetryModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Retry Task
              </h3>
              <button
                onClick={() => setShowRetryModal(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Retry <span className="text-primary font-medium">{selectedTask.jiraIssueKey}</span>?
              </p>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={retryOptions.resetRetryCount}
                  onChange={(e) => setRetryOptions((prev) => ({ ...prev, resetRetryCount: e.target.checked }))}
                  className="rounded"
                />
                Reset retry count to 0
              </label>

              <div>
                <label className="block text-sm font-medium mb-1">Custom Context (optional)</label>
                <textarea
                  value={retryOptions.customContext}
                  onChange={(e) => setRetryOptions((prev) => ({ ...prev, customContext: e.target.value }))}
                  placeholder="Additional instructions for the retry attempt..."
                  className="w-full h-24 px-3 py-2 text-sm bg-background border border-border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setShowRetryModal(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleRetryTask}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
              >
                {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                Retry Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2 text-red-500">
                <StopCircle className="w-4 h-4" />
                Cancel Task
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Cancel <span className="text-primary font-medium">{selectedTask.jiraIssueKey}</span>?
                This will stop the running ECS task.
              </p>

              <div>
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Why are you cancelling this task?"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg"
                disabled={actionLoading}
              >
                Keep Running
              </button>
              <button
                onClick={handleCancelTask}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
              >
                {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                Cancel Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
