import { useState, useEffect, useCallback, useRef } from "react";
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
  Plus,
  Play,
  Power,
  Trash2,
} from "lucide-react";

interface ControlCenterStats {
  totalWorkers: number;
  activeWorkers: number;
  queueDepth: number;
  todayCost: number;
  todayCompleted: number;
  todayFailed: number;
  cumulativeCost: number;
  cumulativeCostResetAt: string | null;
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
  role: "worker" | "manager";
  status: string;
  tasksCompleted: number;
  tasksFailed: number;
  totalCostUsd: number;
  // Manager-specific stats
  reviewCount?: number;
  approvalsCount?: number;
  rejectionsCount?: number;
  revisionsRequestedCount?: number;
  currentTask: WorkerTask | null;
}

interface TaskStep {
  name: string;
  status: "done" | "active" | "pending";
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
  workerModel?: string;
  workerRole?: "worker" | "manager";
  turnCount: number;
  maxTurns: number;
  estimatedCostUsd: number;
  startedAt: string | null;
  hasPr?: boolean;
  githubPrUrl?: string | null;
  recentLogs: TaskLog[];
  steps: TaskStep[];
}

interface CompletedTask {
  id: string;
  jiraIssueKey: string;
  summary: string;
  status: string;
  workerModel?: string;
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

// Virtual Manager types
interface ManagerStatus {
  enabled: boolean;
  managers: Array<{
    id: string;
    displayName: string;
    modelId: string;
    status: string;
    reviewCount: number;
    approvalsCount: number;
    rejectionsCount: number;
    revisionsRequestedCount: number;
    approvalRate: number;
  }>;
  queue: {
    awaitingReview: number;
    underReview: number;
    revisionNeeded: number;
  };
  last24Hours: {
    totalReviews: number;
    approved: number;
    rejected: number;
    revisionsRequested: number;
    totalCost: number;
    avgDurationSeconds: number;
  };
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
  workerModel?: string;
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
  githubPrUrl: string | null;
  githubPrNumber: number | null;
  githubBranch: string | null;
  runs?: TaskRun[];
}

const API_BASE = import.meta.env.VITE_API_URL || "";

// Persona definitions with full details
const PERSONA_CONFIG: Record<
  string,
  { emoji: string; title: string; description: string; skills: string[] }
> = {
  frontend_developer: {
    emoji: "🎨",
    title: "Frontend Developer",
    description: "UI/UX implementation, React components, styling",
    skills: ["React", "TypeScript", "Tailwind CSS", "Accessibility"],
  },
  backend_developer: {
    emoji: "⚙️",
    title: "Backend Developer",
    description: "API development, database design, server logic",
    skills: ["Node.js", "Express", "PostgreSQL", "REST APIs"],
  },
  devops_engineer: {
    emoji: "🔧",
    title: "DevOps Engineer",
    description: "Infrastructure, CI/CD, deployment automation",
    skills: ["Terraform", "AWS", "Docker", "GitHub Actions"],
  },
  security_engineer: {
    emoji: "🔒",
    title: "Security Engineer",
    description: "Security audits, vulnerability fixes, compliance",
    skills: ["OWASP", "Penetration Testing", "IAM", "Encryption"],
  },
  qa_engineer: {
    emoji: "🧪",
    title: "QA Engineer",
    description: "Test writing, quality assurance, bug verification",
    skills: ["Jest", "Playwright", "Test Design", "Bug Triage"],
  },
  tech_writer: {
    emoji: "📝",
    title: "Technical Writer",
    description: "Documentation, API docs, user guides",
    skills: ["Markdown", "API Documentation", "User Guides"],
  },
  project_manager: {
    emoji: "📋",
    title: "Project Manager",
    description: "Task planning, coordination, status updates",
    skills: ["Jira", "Project Planning", "Stakeholder Management"],
  },
  manager: {
    emoji: "👔",
    title: "Virtual Manager",
    description: "Reviews PRs from workers, provides feedback, approves or requests revisions",
    skills: ["Code Review", "Quality Assurance", "Feedback", "Approval Workflow"],
  },
};

export default function SuperAdminControlCenter() {
  const [data, setData] = useState<ControlCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Initialize expanded workers from localStorage (collapsed ones are stored)
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(() => {
    // Start with empty set - will be populated when data loads
    return new Set();
  });
  const [collapsedWorkers, setCollapsedWorkers] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("control-center-collapsed-workers");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Self-recovery state
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus | null>(
    null,
  );
  const [taskList, setTaskList] = useState<TaskWithRuns[]>([]);
  const [taskListLoading, setTaskListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskWithRuns | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [retryOptions, setRetryOptions] = useState({
    resetRetryCount: false,
    customContext: "",
  });
  const [cancelReason, setCancelReason] = useState("");

  // Virtual Manager state
  const [managerStatus, setManagerStatus] = useState<ManagerStatus | null>(
    null,
  );

  // Create Worker/Task state
  const [showCreateWorkerModal, setShowCreateWorkerModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [createWorkerForm, setCreateWorkerForm] = useState({
    persona: "developer" as string,
    displayName: "",
    description: "",
  });
  const [createTaskForm, setCreateTaskForm] = useState({
    jiraIssueKey: "",
    workerPersona: "developer" as string,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [deleteWorkerId, setDeleteWorkerId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showResetCostModal, setShowResetCostModal] = useState(false);
  const [resetCostLoading, setResetCostLoading] = useState(false);

  // Terminal output state
  const [terminalLogs, setTerminalLogs] = useState<Record<string, string[]>>({});

  // System on/off state
  const [systemStatus, setSystemStatus] = useState<{
    systemEnabled: boolean;
    orchestrator: { running: boolean; desiredCount: number };
    executors: { running: number };
  } | null>(null);
  const [systemToggleLoading, setSystemToggleLoading] = useState(false);
  const [watcherToggleLoading, setWatcherToggleLoading] = useState(false);
  const [orchestratorToggleLoading, setOrchestratorToggleLoading] = useState(false);
  const [expandedTerminals, setExpandedTerminals] = useState<Set<string>>(
    new Set(),
  );
  const [terminalLoading, setTerminalLoading] = useState<Set<string>>(
    new Set(),
  );
  const [streamingTerminals, setStreamingTerminals] = useState<Set<string>>(
    new Set(),
  );
  const [terminalCursors, setTerminalCursors] = useState<Record<string, string | null>>({});
  const controlCenterStreamRef = useRef<EventSource | null>(null);
  // Track EventSource connections for SSE streaming
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
  // Fallback polling timers when SSE drops
  const pollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  // Track terminal scroll containers for auto-scroll
  const terminalScrollRefs = useRef<Map<string, HTMLDivElement | null>>(
    new Map(),
  );

  // Auto-scroll terminal to bottom when new logs arrive
  useEffect(() => {
    Object.keys(terminalLogs).forEach((taskId) => {
      const scrollEl = terminalScrollRefs.current.get(taskId);
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
    });
  }, [terminalLogs]);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch control center data");
      }

      const result = await response.json();

      // Merge updates instead of replacing to reduce re-renders
      setData(prevData => {
        if (!prevData) return result;

        // Only update if data actually changed
        const hasChanges =
          JSON.stringify(prevData.stats) !== JSON.stringify(result.stats) ||
          JSON.stringify(prevData.workers) !== JSON.stringify(result.workers) ||
          JSON.stringify(prevData.activeTasks) !== JSON.stringify(result.activeTasks) ||
          JSON.stringify(prevData.recentCompleted) !== JSON.stringify(result.recentCompleted);

        return hasChanges ? result : prevData;
      });

      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch system status (on/off state)
  const fetchSystemStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center/system/status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const result = await response.json();
        setSystemStatus(result);
      }
    } catch (err) {
      console.error("Failed to fetch system status:", err);
    }
  }, []);

  // Toggle system on/off
  const toggleSystem = async () => {
    if (!systemStatus) return;
    setSystemToggleLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const endpoint = systemStatus.systemEnabled ? "stop" : "start";
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center/system/${endpoint}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const result = await response.json();
        setCreateSuccess(result.message);
        setTimeout(() => setCreateSuccess(null), 3000);
        // Refresh all data
        fetchSystemStatus();
        fetchData();
      } else {
        const err = await response.json();
        setCreateError(err.error || `Failed to ${endpoint} system`);
      }
    } catch (err) {
      console.error("Failed to toggle system:", err);
      setCreateError("Failed to toggle system");
    } finally {
      setSystemToggleLoading(false);
    }
  };

  // Toggle watcher on/off
  const toggleWatcher = async () => {
    if (!watcherStatus) return;
    setWatcherToggleLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const endpoint = watcherStatus.enabled ? "disable" : "enable";
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center/watcher/${endpoint}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const result = await response.json();
        setCreateSuccess(result.message);
        setTimeout(() => setCreateSuccess(null), 3000);
        // Refresh watcher status
        fetchWatcherStatus();
      } else {
        const err = await response.json();
        setCreateError(err.error || `Failed to ${endpoint} watcher`);
      }
    } catch (err) {
      console.error("Failed to toggle watcher:", err);
      setCreateError("Failed to toggle watcher");
    } finally {
      setWatcherToggleLoading(false);
    }
  };

  // Toggle orchestrator on/off
  const toggleOrchestrator = async () => {
    if (!systemStatus) return;
    setOrchestratorToggleLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const endpoint = systemStatus.orchestrator.running ? "stop" : "start";
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center/orchestrator/${endpoint}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const result = await response.json();
        setCreateSuccess(result.message);
        setTimeout(() => setCreateSuccess(null), 3000);
        // Refresh system status
        fetchSystemStatus();
      } else {
        const err = await response.json();
        setCreateError(err.error || `Failed to ${endpoint} orchestrator`);
      }
    } catch (err) {
      console.error("Failed to toggle orchestrator:", err);
      setCreateError("Failed to toggle orchestrator");
    } finally {
      setOrchestratorToggleLoading(false);
    }
  };

  // Fetch watcher status
  const fetchWatcherStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center/watcher/status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const result = await response.json();
        setWatcherStatus(result);
      }
    } catch (err) {
      console.error("Failed to fetch watcher status:", err);
    }
  }, []);

  // Fetch manager status
  const fetchManagerStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center/manager/status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const result = await response.json();
        setManagerStatus(result);
      }
    } catch (err) {
      console.error("Failed to fetch manager status:", err);
    }
  }, []);

  // Fetch task list with filters
  const fetchTaskList = useCallback(async () => {
    setTaskListLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("limit", "50");

      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center/tasks?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const result = await response.json();
        const newTasks = result.tasks || [];

        // Merge updates to preserve component state
        setTaskList(prevTasks => {
          if (prevTasks.length === 0) return newTasks;

          // Only update if tasks actually changed
          if (JSON.stringify(prevTasks) === JSON.stringify(newTasks)) {
            return prevTasks;
          }

          return newTasks;
        });
      }
    } catch (err) {
      console.error("Failed to fetch task list:", err);
    } finally {
      setTaskListLoading(false);
    }
  }, [statusFilter, searchQuery]);

  // Refresh all data (called by refresh button)
  const refreshAll = useCallback(() => {
    fetchData();
    fetchSystemStatus();
    fetchWatcherStatus();
    fetchManagerStatus();
    fetchTaskList();
  }, [fetchData, fetchSystemStatus, fetchWatcherStatus, fetchManagerStatus, fetchTaskList]);

  // Fetch task runs for detail modal
  const fetchTaskRuns = useCallback(async (taskId: string) => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center/tasks/${taskId}/runs`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const result = await response.json();
        setSelectedTask((prev) =>
          prev ? { ...prev, runs: result.runs } : null,
        );
      }
    } catch (err) {
      console.error("Failed to fetch task runs:", err);
    }
  }, []);

  // Retry task
  const handleRetryTask = async () => {
    if (!selectedTask) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center/tasks/${selectedTask.id}/retry`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(retryOptions),
        },
      );
      if (response.ok) {
        setShowRetryModal(false);
        setRetryOptions({ resetRetryCount: false, customContext: "" });
        fetchTaskList();
        fetchData();
      }
    } catch (err) {
      console.error("Failed to retry task:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel task
  const handleCancelTask = async () => {
    if (!selectedTask) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center/tasks/${selectedTask.id}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: cancelReason }),
        },
      );
      if (response.ok) {
        setShowCancelModal(false);
        setCancelReason("");
        fetchTaskList();
        fetchData();
      }
    } catch (err) {
      console.error("Failed to cancel task:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Reset cumulative cost to zero
  const handleResetCost = async () => {
    setResetCostLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center/reset-cost`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (response.ok) {
        setShowResetCostModal(false);
        setCreateSuccess("Cumulative cost reset to $0.00");
        setTimeout(() => setCreateSuccess(null), 3000);
        fetchData();
      } else {
        const err = await response.json();
        setCreateError(err.error || "Failed to reset cost");
        setTimeout(() => setCreateError(null), 5000);
      }
    } catch (err) {
      console.error("Failed to reset cost:", err);
      setCreateError("Failed to reset cost");
      setTimeout(() => setCreateError(null), 5000);
    } finally {
      setResetCostLoading(false);
    }
  };

  // Fetch terminal logs for a task
  const fetchTerminalLogs = useCallback(async (taskId: string) => {
    setTerminalLoading((prev) => new Set([...prev, taskId]));
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/control-center/logs/${taskId}?limit=100`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const result = await response.json();
        const logLines = (result.logs || []).map(
          (log: { timestamp: string; message: string }) =>
            `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`,
        );
        setTerminalLogs((prev) => ({ ...prev, [taskId]: logLines }));
        if (result.logs && result.logs.length > 0) {
          const last = result.logs[result.logs.length - 1];
          setTerminalCursors((prev) => ({ ...prev, [taskId]: last.id || null }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch terminal logs:", err);
    } finally {
      setTerminalLoading((prev) => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  }, []);

  const startPolling = useCallback(
    (taskId: string, intervalMs = 5000) => {
      if (pollIntervalsRef.current.has(taskId)) return;
      const interval = setInterval(() => fetchTerminalLogs(taskId), intervalMs);
      pollIntervalsRef.current.set(taskId, interval);
    },
    [fetchTerminalLogs],
  );

  const stopPolling = useCallback((taskId: string) => {
    const interval = pollIntervalsRef.current.get(taskId);
    if (interval) {
      clearInterval(interval);
      pollIntervalsRef.current.delete(taskId);
    }
  }, []);

  // Start SSE log streaming for a task
  const startLogStream = useCallback(
    (taskId: string) => {
      // Don't start if already streaming
      if (eventSourcesRef.current.has(taskId)) {
        return;
      }

      const token = localStorage.getItem("accessToken");
      const tokenParam = token ? `token=${encodeURIComponent(token)}` : "";
      const sinceParam = terminalCursors[taskId] ? `since=${encodeURIComponent(terminalCursors[taskId]!)}` : "";
      const query = [tokenParam, sinceParam].filter(Boolean).join("&");
      const url = `${API_BASE}/api/v1/super-admin/control-center/logs/${taskId}/stream${query ? `?${query}` : ""}`;

      // EventSource doesn't support custom headers, so we need to use a different approach
      // We'll poll initially and use SSE for new logs
      // For now, fetch initial logs then connect to SSE
      fetchTerminalLogs(taskId);

      // Create EventSource with token in URL (backend should support this)
      // Note: EventSource doesn't support Authorization headers natively
      // We'll use a workaround by including token in query params
      const eventSource = new EventSource(url);

      eventSource.addEventListener("ping", () => {});

      eventSource.onopen = () => {
        stopPolling(taskId); // stop any fallback poll once SSE opens
        setStreamingTerminals((prev) => new Set([...prev, taskId]));
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "log") {
            const logLine = `[${new Date(data.timestamp).toLocaleTimeString()}] ${data.message}`;
            setTerminalLogs((prev) => ({
              ...prev,
              [taskId]: [...(prev[taskId] || []), logLine],
            }));
            setTerminalCursors((prev) => ({ ...prev, [taskId]: data.id || prev[taskId] || null }));
          } else if (data.type === "status") {
            // Task status changed - refresh main data
            fetchData();
          } else if (data.type === "complete") {
            // Task completed - close stream
            eventSource.close();
            eventSourcesRef.current.delete(taskId);
            setStreamingTerminals((prev) => {
              const newSet = new Set(prev);
              newSet.delete(taskId);
              return newSet;
            });
          }
        } catch (err) {
          console.error("Error parsing SSE data:", err);
        }
      };

      eventSource.onerror = () => {
        // Connection error - fall back to polling and retry SSE after a delay
        eventSource.close();
        eventSourcesRef.current.delete(taskId);
        setStreamingTerminals((prev) => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
        // Pull latest logs to avoid user refresh and try to reconnect once network is back
        fetchTerminalLogs(taskId);
        // Start fallback polling so terminal keeps moving
        startPolling(taskId);
        setTimeout(() => {
          // Only retry if not already reconnected/closed
          if (!eventSourcesRef.current.has(taskId)) {
            startLogStream(taskId);
          }
        }, 5000);
      };

      eventSourcesRef.current.set(taskId, eventSource);
    },
    [fetchTerminalLogs, fetchData, startPolling, stopPolling],
  );

  // Stop SSE log streaming for a task
  const stopLogStream = useCallback((taskId: string) => {
    const eventSource = eventSourcesRef.current.get(taskId);
    if (eventSource) {
      eventSource.close();
      eventSourcesRef.current.delete(taskId);
      setStreamingTerminals((prev) => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
    stopPolling(taskId);
  }, [stopPolling]);

  // Cleanup SSE connections on unmount
  useEffect(() => {
    return () => {
      eventSourcesRef.current.forEach((es) => es.close());
      eventSourcesRef.current.clear();
      pollIntervalsRef.current.forEach((interval) => clearInterval(interval));
      pollIntervalsRef.current.clear();
    };
  }, []);

  // Toggle terminal expansion
  const toggleTerminal = (taskId: string, isActiveTask: boolean = false) => {
    setExpandedTerminals((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
        // Stop streaming when closing
        stopLogStream(taskId);
      } else {
        newSet.add(taskId);
        // Start streaming for active tasks, fetch for completed
        if (isActiveTask) {
          startLogStream(taskId);
        } else if (!terminalLogs[taskId]) {
          fetchTerminalLogs(taskId);
        }
      }
      return newSet;
    });
  };

  // Open detail modal
  const openDetailModal = (task: TaskWithRuns) => {
    setSelectedTask(task);
    setShowDetailModal(true);
    fetchTaskRuns(task.id);
  };

  // Create worker handler (using super-admin endpoint)
  const handleCreateWorker = async () => {
    if (!createWorkerForm.displayName.trim()) {
      setCreateError("Display name is required");
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`${API_BASE}/api/v1/super-admin/workers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createWorkerForm),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create worker");
      }
      setCreateSuccess("Worker created successfully");
      setShowCreateWorkerModal(false);
      setCreateWorkerForm({
        persona: "backend_developer",
        displayName: "",
        description: "",
      });
      fetchData();
      setTimeout(() => setCreateSuccess(null), 3000);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create worker");
    } finally {
      setCreateLoading(false);
    }
  };

  // Delete worker handler
  const handleDeleteWorker = async (workerId: string) => {
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE}/api/v1/super-admin/workers/${workerId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete worker");
      }
      setCreateSuccess("Worker deleted successfully");
      setDeleteWorkerId(null);
      fetchData();
      setTimeout(() => setCreateSuccess(null), 3000);
    } catch (err: any) {
      setCreateError(err.message || "Failed to delete worker");
      setTimeout(() => setCreateError(null), 5000);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Create task handler (trigger from Jira key)
  const handleCreateTask = async () => {
    if (!createTaskForm.jiraIssueKey.trim()) {
      setCreateError("Jira issue key is required");
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE}/api/v1/ai-worker-tasks/trigger`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jiraIssueKey: createTaskForm.jiraIssueKey.trim().toUpperCase(),
            workerPersona: createTaskForm.workerPersona,
          }),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create task");
      }
      setCreateSuccess("Task queued successfully");
      setShowCreateTaskModal(false);
      setCreateTaskForm({ jiraIssueKey: "", workerPersona: "developer" });
      fetchData();
      fetchTaskList();
      setTimeout(() => setCreateSuccess(null), 3000);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create task");
    } finally {
      setCreateLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchSystemStatus();
    fetchWatcherStatus();
    fetchManagerStatus();
    fetchTaskList();

    // Live updates via SSE when auto-refresh is enabled
    if (!autoRefresh) return;

    const token = localStorage.getItem("accessToken");
    const params = new URLSearchParams();
    if (token) params.set("token", token);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (searchQuery) params.set("search", searchQuery);

    const streamUrl = `${API_BASE}/api/v1/super-admin/control-center/stream?${params.toString()}`;
    const es = new EventSource(streamUrl);
    controlCenterStreamRef.current = es;

    es.addEventListener("control_center_update", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload.controlCenter) {
          setData(payload.controlCenter);
        }
        if (payload.systemStatus) setSystemStatus(payload.systemStatus);
        if (payload.watcherStatus) setWatcherStatus(payload.watcherStatus);
        if (payload.managerStatus) setManagerStatus(payload.managerStatus);
        if (payload.taskList?.tasks) {
          setTaskList(payload.taskList.tasks);
        }
        if (payload.lastUpdated) {
          setLastUpdated(new Date(payload.lastUpdated));
        } else {
          setLastUpdated(new Date());
        }
        setError(null);
      } catch (e) {
        console.error("Failed to process control_center_update", e);
      }
    });

    es.addEventListener("error", () => {
      setError("Live updates disconnected");
      es.close();
    });

    return () => {
      if (controlCenterStreamRef.current) {
        controlCenterStreamRef.current.close();
        controlCenterStreamRef.current = null;
      }
    };
  }, [
    fetchData,
    fetchSystemStatus,
    fetchWatcherStatus,
    fetchManagerStatus,
    fetchTaskList,
    autoRefresh,
    statusFilter,
    searchQuery,
  ]);

  // Refetch task list when filters change
  useEffect(() => {
    fetchTaskList();
  }, [statusFilter, searchQuery, fetchTaskList]);

  // Auto-expand workers when data loads (except those that were collapsed by user)
  useEffect(() => {
    if (data?.workers && data.workers.length > 0) {
      // Expand all workers except those the user has collapsed
      const expanded = new Set(
        data.workers
          .map((w) => w.id)
          .filter((id) => !collapsedWorkers.has(id)),
      );
      setExpandedWorkers(expanded);
    }
  }, [data?.workers, collapsedWorkers]);

  const toggleWorkerExpansion = (workerId: string) => {
    setExpandedWorkers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(workerId)) {
        newSet.delete(workerId);
        // Remember this worker is collapsed
        setCollapsedWorkers((prevCollapsed) => {
          const newCollapsed = new Set(prevCollapsed);
          newCollapsed.add(workerId);
          localStorage.setItem(
            "control-center-collapsed-workers",
            JSON.stringify([...newCollapsed]),
          );
          return newCollapsed;
        });
      } else {
        newSet.add(workerId);
        // Remove from collapsed list
        setCollapsedWorkers((prevCollapsed) => {
          const newCollapsed = new Set(prevCollapsed);
          newCollapsed.delete(workerId);
          localStorage.setItem(
            "control-center-collapsed-workers",
            JSON.stringify([...newCollapsed]),
          );
          return newCollapsed;
        });
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500";
      case "executing":
        return "text-blue-500";
      case "queued":
      case "claimed":
      case "environment_setup":
        return "text-yellow-500";
      case "failed":
        return "text-red-500";
      case "blocked":
        return "text-orange-500";
      case "cancelled":
        return "text-gray-500";
      case "pr_created":
      case "review_pending":
        return "text-purple-500";
      case "manager_review":
        return "text-indigo-500";
      case "revision_needed":
        return "text-orange-500";
      case "review_approved":
        return "text-green-400";
      case "review_rejected":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getWorkerStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      working: "bg-green-500/10 text-green-500 border-green-500/30",
      idle: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
      paused: "bg-orange-500/10 text-orange-500 border-orange-500/30",
      disabled: "bg-red-500/10 text-red-500 border-red-500/30",
    };
    return colors[status] || "bg-gray-500/10 text-gray-500 border-gray-500/30";
  };

  const getPersonaInfo = (persona: string) => {
    return (
      PERSONA_CONFIG[persona] || {
        emoji: "🤖",
        title: persona,
        description: "AI Worker",
        skills: [],
      }
    );
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case "success":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      case "timeout":
        return "text-orange-500";
      case "killed":
        return "text-yellow-500";
      case "cancelled":
        return "text-gray-500";
      default:
        return "text-muted-foreground";
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
          <h1 className="text-2xl font-bold text-foreground">
            AI Workers Control Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage AI worker instances
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* System On/Off Toggle */}
          <button
            onClick={toggleSystem}
            disabled={systemToggleLoading || !systemStatus}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              systemStatus?.systemEnabled
                ? "bg-green-500/20 text-green-500 border border-green-500/30 hover:bg-green-500/30"
                : "bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30"
            } ${systemToggleLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            title={
              systemStatus?.systemEnabled
                ? "System ON - Click to stop all AI workers"
                : "System OFF - Click to start AI workers"
            }
          >
            <Power
              className={`w-4 h-4 ${systemToggleLoading ? "animate-pulse" : ""}`}
            />
            {systemToggleLoading
              ? "..."
              : systemStatus?.systemEnabled
                ? "System ON"
                : "System OFF"}
            {systemStatus && systemStatus.executors.running > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-green-500/30 rounded">
                {systemStatus.executors.running} running
              </span>
            )}
          </button>
          <div className="w-px h-6 bg-border" />
          <button
            onClick={() => setShowCreateTaskModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm"
          >
            <Play className="w-4 h-4" />
            Run Task
          </button>
          <button
            onClick={() => setShowCreateWorkerModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Worker
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              autoRefresh
                ? "bg-green-500/20 text-green-500 border border-green-500/30"
                : "bg-muted text-muted-foreground border border-border"
            }`}
            title={autoRefresh ? "Auto-refresh ON (10s)" : "Auto-refresh OFF"}
          >
            {autoRefresh ? "Auto: ON" : "Auto: OFF"}
          </button>
          <span className="text-xs text-muted-foreground">
            {lastUpdated?.toLocaleTimeString() || "Never"}
          </span>
          <button
            onClick={refreshAll}
            disabled={loading}
            className="flex items-center gap-2 px-2 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm"
            title="Refresh all data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {createSuccess && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-500 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{createSuccess}</span>
          <button onClick={() => setCreateSuccess(null)} className="font-bold">
            &times;
          </button>
        </div>
      )}
      {createError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{createError}</span>
          <button onClick={() => setCreateError(null)} className="font-bold">
            &times;
          </button>
        </div>
      )}

      {/* System Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs uppercase">Workers</span>
          </div>
          <div className="text-2xl font-bold">
            {data?.stats.totalWorkers || 0}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Cpu className="w-4 h-4" />
            <span className="text-xs uppercase">Active</span>
          </div>
          <div className="text-2xl font-bold text-green-500">
            {data?.stats.activeWorkers || 0}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs uppercase">Queue</span>
          </div>
          <div className="text-2xl font-bold text-yellow-500">
            {data?.stats.queueDepth || 0}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs uppercase">Completed</span>
          </div>
          <div className="text-2xl font-bold text-green-500">
            {data?.stats.todayCompleted || 0}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <XCircle className="w-4 h-4" />
            <span className="text-xs uppercase">Failed</span>
          </div>
          <div className="text-2xl font-bold text-red-500">
            {data?.stats.todayFailed || 0}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs uppercase">Cumulative Cost</span>
            </div>
            <button
              onClick={() => setShowResetCostModal(true)}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              title="Reset cumulative cost to $0.00"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
          <div className="text-2xl font-bold">
            ${data?.stats.cumulativeCost?.toFixed(2) || "0.00"}
          </div>
          {data?.stats.cumulativeCostResetAt && (
            <div className="text-xs text-muted-foreground mt-1">
              Reset {new Date(data.stats.cumulativeCostResetAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Manager Status Panel (with Watcher indicator) */}
      {managerStatus && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <h3 className="font-semibold">Virtual Manager</h3>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded ${
                  managerStatus.enabled
                    ? "bg-indigo-500/10 text-indigo-500"
                    : "bg-red-500/10 text-red-500"
                }`}
              >
                {managerStatus.enabled ? "Active" : "Disabled"}
              </span>
              {/* Watcher status indicator - clickable */}
              {watcherStatus && (
                <button
                  onClick={toggleWatcher}
                  disabled={watcherToggleLoading}
                  className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-all cursor-pointer hover:opacity-80 ${
                    watcherStatus.enabled
                      ? "bg-green-500/10 text-green-500 border border-green-500/30"
                      : "bg-red-500/10 text-red-500 border border-red-500/30"
                  } ${watcherToggleLoading ? "opacity-50 cursor-not-allowed animate-pulse" : ""}`}
                  title={`Click to ${watcherStatus.enabled ? "disable" : "enable"} watcher`}
                >
                  <Shield className="w-3 h-3" />
                  Watcher {watcherStatus.enabled ? "Active" : "Off"}
                </button>
              )}
              {/* Orchestrator status indicator - clickable */}
              {systemStatus && (
                <button
                  onClick={toggleOrchestrator}
                  disabled={orchestratorToggleLoading}
                  className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-all cursor-pointer hover:opacity-80 ${
                    systemStatus.orchestrator.running
                      ? "bg-blue-500/10 text-blue-500 border border-blue-500/30"
                      : "bg-gray-500/10 text-gray-500 border border-gray-500/30"
                  } ${orchestratorToggleLoading ? "opacity-50 cursor-not-allowed animate-pulse" : ""}`}
                  title={`Click to ${systemStatus.orchestrator.running ? "stop" : "start"} orchestrator`}
                >
                  <Activity className="w-3 h-3" />
                  Orchestrator{" "}
                  {systemStatus.orchestrator.running ? "Running" : "Off"}
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              Reviews PRs using Opus 4.5
            </span>
          </div>

          {/* Queue Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-muted-foreground">
                Awaiting Review
              </div>
              <div
                className={`text-lg font-semibold ${managerStatus.queue.awaitingReview > 0 ? "text-purple-500" : ""}`}
              >
                {managerStatus.queue.awaitingReview}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Under Review</div>
              <div
                className={`text-lg font-semibold ${managerStatus.queue.underReview > 0 ? "text-indigo-500" : ""}`}
              >
                {managerStatus.queue.underReview}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Revision Needed
              </div>
              <div
                className={`text-lg font-semibold ${managerStatus.queue.revisionNeeded > 0 ? "text-orange-500" : ""}`}
              >
                {managerStatus.queue.revisionNeeded}
              </div>
            </div>
          </div>

          {/* Last 24 Hours Stats */}
          <div className="border-t border-border pt-3">
            <div className="text-xs text-muted-foreground mb-2">
              Last 24 Hours
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Reviews</div>
                <div className="text-lg font-semibold">
                  {managerStatus.last24Hours.totalReviews}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Approved</div>
                <div className="text-lg font-semibold text-green-500">
                  {managerStatus.last24Hours.approved}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Rejected</div>
                <div className="text-lg font-semibold text-red-500">
                  {managerStatus.last24Hours.rejected}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Revisions</div>
                <div className="text-lg font-semibold text-orange-500">
                  {managerStatus.last24Hours.revisionsRequested}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Avg Duration
                </div>
                <div className="text-lg font-semibold">
                  {managerStatus.last24Hours.avgDurationSeconds > 0
                    ? `${Math.floor(managerStatus.last24Hours.avgDurationSeconds / 60)}m ${managerStatus.last24Hours.avgDurationSeconds % 60}s`
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cost</div>
                <div className="text-lg font-semibold">
                  ${managerStatus.last24Hours.totalCost.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Manager Instances (if any) */}
          {managerStatus.managers && managerStatus.managers.length > 0 && (
            <div className="border-t border-border pt-3 mt-3">
              <div className="text-xs text-muted-foreground mb-2">
                Manager Instances
              </div>
              <div className="space-y-2">
                {managerStatus.managers.map((manager) => (
                  <div
                    key={manager.id}
                    className="flex items-center justify-between text-sm bg-muted/20 rounded p-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          manager.status === "working"
                            ? "bg-green-500"
                            : manager.status === "idle"
                              ? "bg-yellow-500"
                              : "bg-gray-500"
                        }`}
                      />
                      <span className="font-medium">{manager.displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        ({manager.modelId})
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-green-500">
                        {manager.approvalsCount} approved
                      </span>
                      <span className="text-red-500">
                        {manager.rejectionsCount} rejected
                      </span>
                      <span className="text-orange-500">
                        {manager.revisionsRequestedCount} revisions
                      </span>
                      <span className="text-muted-foreground">
                        {manager.approvalRate > 0
                          ? `${(manager.approvalRate * 100).toFixed(0)}% approval`
                          : "-"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Tasks Workflow Visualization */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/50">
          <h2 className="font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Active Workflows
          </h2>
        </div>
        <div className="p-4 space-y-4">
          {!data?.activeTasks || data.activeTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No active workflows</p>
              <p className="text-xs mt-1">
                Trigger a task to see the workflow pipeline
              </p>
            </div>
          ) : (
            data.activeTasks.map((task) => {
              // Define workflow stages - PR step always shown but can be skipped
              const stages = [
                { id: "queued", label: "Queued", icon: Clock },
                { id: "executing", label: "Executing", icon: Cpu },
                { id: "pr_created", label: "PR Created", icon: GitBranch },
                { id: "manager_review", label: "Review", icon: Users },
                { id: "completed", label: "Complete", icon: CheckCircle },
              ];

              // Determine current stage index
              // If no PR, pr_created stage is auto-completed (skipped)
              const statusToStage: Record<string, number> = {
                queued: 0,
                dispatching: 0,
                claimed: 0,
                environment_setup: 1,
                executing: 1,
                pr_created: 2,
                manager_review: 3,
                revision_needed: 1, // Goes back to executing
                review_pending: 3,
                review_approved: 4,
                completed: 4,
                failed: -1,
                blocked: -1,
                cancelled: -1,
                review_rejected: -1,
              };

              // If task has no PR but is past executing, treat PR step as completed
              const noPrButPastExecuting = !task.hasPr &&
                ["manager_review", "review_pending", "review_approved", "completed"].includes(task.status);

              const currentStageIndex = statusToStage[task.status] ?? 0;
              const isFailed =
                task.status === "failed" || task.status === "blocked";
              const isRevision = task.status === "revision_needed";

              return (
                <div key={task.id} className="bg-muted/20 rounded-lg p-4">
                  {/* Task Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://oncallshift.atlassian.net/browse/${task.jiraIssueKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-mono font-medium flex items-center gap-1"
                      >
                        {task.jiraIssueKey}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <span className="text-sm text-muted-foreground truncate max-w-xs">
                        {task.summary}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {task.workerName}
                      </span>
                      {task.workerModel && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] font-medium">
                          {task.workerModel}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded font-medium ${
                          isFailed
                            ? "bg-red-500/10 text-red-500"
                            : isRevision
                              ? "bg-orange-500/10 text-orange-500"
                              : task.status === "completed"
                                ? "bg-green-500/10 text-green-500"
                                : "bg-blue-500/10 text-blue-500"
                        }`}
                      >
                        {task.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {/* Workflow Pipeline */}
                  <div className="flex items-center justify-between">
                    {stages.map((stage, index) => {
                      const StageIcon = stage.icon;
                      // PR step (index 2) is auto-completed if no PR but task is past executing
                      const isPrStepSkipped = stage.id === "pr_created" && noPrButPastExecuting;
                      const isCompleted =
                        !isFailed && (currentStageIndex > index || isPrStepSkipped);
                      const isCurrent =
                        !isFailed && currentStageIndex === index && !isPrStepSkipped;
                      const isPending = !isFailed && currentStageIndex < index && !isPrStepSkipped;
                      const isFailedStage =
                        isFailed && currentStageIndex === index;

                      return (
                        <div
                          key={stage.id}
                          className="flex items-center flex-1"
                        >
                          {/* Stage Node */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                                isCompleted
                                  ? "bg-green-500 border-green-500 text-white"
                                  : isCurrent
                                    ? "bg-blue-500 border-blue-500 text-white animate-pulse"
                                    : isFailedStage
                                      ? "bg-red-500 border-red-500 text-white"
                                      : isPending
                                        ? "bg-muted border-border text-muted-foreground"
                                        : "bg-muted border-border text-muted-foreground"
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle className="w-5 h-5" />
                              ) : isFailedStage ? (
                                <XCircle className="w-5 h-5" />
                              ) : (
                                <StageIcon className="w-5 h-5" />
                              )}
                            </div>
                            <span
                              className={`text-xs mt-1 ${
                                isCompleted || isCurrent
                                  ? "text-foreground font-medium"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {stage.label}
                            </span>
                          </div>

                          {/* Connector Line */}
                          {index < stages.length - 1 && (
                            <div
                              className={`flex-1 h-0.5 mx-2 ${
                                isCompleted
                                  ? "bg-green-500"
                                  : isCurrent
                                    ? "bg-gradient-to-r from-blue-500 to-muted"
                                    : "bg-border"
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress Bar and Turn Count */}
                  {task.status === "executing" && (
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{
                            width: `${(task.turnCount / task.maxTurns) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        Turn {task.turnCount}/{task.maxTurns}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ${task.estimatedCostUsd.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Revision Notice */}
                  {isRevision && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-orange-500 bg-orange-500/10 rounded px-3 py-2">
                      <RotateCcw className="w-3 h-3" />
                      Revision requested - worker will address feedback
                    </div>
                  )}

                  {/* Terminal Output Toggle */}
                  <div className="mt-3">
                    <button
                      onClick={() => toggleTerminal(task.id, true)}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Terminal className="w-3 h-3" />
                      {expandedTerminals.has(task.id)
                        ? "Hide Terminal Output"
                        : "Show Terminal Output"}
                      {streamingTerminals.has(task.id) && (
                        <span className="flex items-center gap-1 text-green-500">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          LIVE
                        </span>
                      )}
                      {expandedTerminals.has(task.id) ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </button>

                    {/* Terminal Output Box */}
                    {expandedTerminals.has(task.id) && (
                      <div className="mt-2 bg-black/90 border border-gray-700 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1.5">
                              <div className="w-3 h-3 rounded-full bg-red-500" />
                              <div className="w-3 h-3 rounded-full bg-yellow-500" />
                              <div className="w-3 h-3 rounded-full bg-green-500" />
                            </div>
                            <span className="text-xs text-gray-400 font-mono">
                              worker-{task.id.substring(0, 8)}
                            </span>
                            {streamingTerminals.has(task.id) && (
                              <span className="text-xs text-green-400 font-mono">
                                [streaming]
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => fetchTerminalLogs(task.id)}
                            className="text-gray-400 hover:text-white p-1"
                            title="Refresh logs"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${terminalLoading.has(task.id) ? "animate-spin" : ""}`}
                            />
                          </button>
                        </div>
                        <div
                          ref={(el) => {
                            terminalScrollRefs.current.set(task.id, el);
                          }}
                          className="p-3 h-72 overflow-y-auto font-mono text-xs text-green-400 leading-relaxed"
                        >
                          {terminalLoading.has(task.id) &&
                          !terminalLogs[task.id] ? (
                            <div className="flex items-center gap-2 text-gray-500">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Loading logs...
                            </div>
                          ) : terminalLogs[task.id]?.length === 0 ? (
                            <div className="text-gray-500">
                              No logs available yet...
                            </div>
                          ) : (
                            terminalLogs[task.id]?.map((line, idx) => (
                              <div
                                key={idx}
                                className={`whitespace-pre-wrap break-all ${
                                  line.includes("[ERROR]") ||
                                  line.includes("error")
                                    ? "text-red-400"
                                    : line.includes("[WARN]") ||
                                        line.includes("warning")
                                      ? "text-yellow-400"
                                      : line.includes("[Claude]") ||
                                          line.includes("Claude")
                                        ? "text-blue-400"
                                        : line.includes("[SUCCESS]") ||
                                            line.includes("✅")
                                          ? "text-green-400"
                                          : "text-gray-300"
                                }`}
                              >
                                {line}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Workers Section - Each worker is an expandable card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Workers
          </h2>
        </div>

        {data?.workers.map((worker) => {
          const personaInfo = getPersonaInfo(worker.persona);
          const isExpanded = expandedWorkers.has(worker.id);
          const workerActiveTask = data?.activeTasks.find(
            (t) => t.workerName === worker.displayName,
          );

          return (
            <div
              key={worker.id}
              className="bg-card border border-border rounded-lg overflow-hidden"
            >
              {/* Worker Header - Always visible */}
              <button
                onClick={() => toggleWorkerExpansion(worker.id)}
                className="w-full px-4 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
              >
                {/* Status indicator */}
                <div
                  className={`w-3 h-3 rounded-full ${
                    worker.status === "working"
                      ? "bg-green-500 animate-pulse"
                      : worker.status === "idle"
                        ? "bg-yellow-500"
                        : worker.status === "paused"
                          ? "bg-orange-500"
                          : "bg-red-500"
                  }`}
                />

                {/* Persona emoji */}
                <span className="text-2xl">{personaInfo.emoji}</span>

                {/* Worker info */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{worker.displayName}</span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium uppercase rounded border ${getWorkerStatusBadge(worker.status)}`}
                    >
                      {worker.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {personaInfo.title}
                  </div>
                </div>

                {/* Current task preview */}
                {worker.currentTask && (
                  <div className="hidden md:flex items-center gap-3 text-sm">
                    <span className="text-primary font-mono">
                      {worker.currentTask.jiraKey}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${(worker.currentTask.turnCount / worker.currentTask.maxTurns) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {worker.currentTask.turnCount}/
                        {worker.currentTask.maxTurns}
                      </span>
                    </div>
                  </div>
                )}

                {/* Stats - different for Manager vs Worker */}
                <div className="hidden lg:flex items-center gap-4 text-sm">
                  {worker.role === "manager" ? (
                    <>
                      <span className="text-blue-500">
                        {worker.reviewCount || 0} reviews
                      </span>
                      <span className="text-green-500">
                        {worker.approvalsCount || 0} approved
                      </span>
                      <span className="text-orange-500">
                        {worker.revisionsRequestedCount || 0} revisions
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-green-500">
                        {worker.tasksCompleted} done
                      </span>
                      <span className="text-red-500">
                        {worker.tasksFailed} failed
                      </span>
                      <span className="text-muted-foreground">
                        ${worker.totalCostUsd.toFixed(2)}
                      </span>
                    </>
                  )}
                </div>

                {/* Delete button (only when idle) */}
                {worker.status === "idle" && !worker.currentTask && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteWorkerId(worker.id);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete worker"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

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
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">
                          About This Worker
                        </h4>
                        <p className="text-sm">{personaInfo.description}</p>
                      </div>

                      {personaInfo.skills.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">
                            Skills
                          </h4>
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
                          <div className="text-xs text-muted-foreground">
                            Completed
                          </div>
                          <div className="text-lg font-semibold text-green-500">
                            {worker.tasksCompleted}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            Failed
                          </div>
                          <div className="text-lg font-semibold text-red-500">
                            {worker.tasksFailed}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            Total Cost
                          </div>
                          <div className="text-lg font-semibold">
                            ${worker.totalCostUsd.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Current task details */}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Current Task
                      </h4>
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
                              <p className="text-sm text-muted-foreground mt-1">
                                {workerActiveTask.summary}
                              </p>
                            </div>
                            <span
                              className={`text-xs uppercase font-medium ${getStatusColor(workerActiveTask.status)}`}
                            >
                              {workerActiveTask.status.replace(/_/g, " ")}
                            </span>
                          </div>

                          {/* Progress steps */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {workerActiveTask.steps.map((step, index) => (
                              <div
                                key={step.name}
                                className="flex items-center"
                              >
                                <div className="flex items-center gap-1">
                                  {step.status === "done" && (
                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                  )}
                                  {step.status === "active" && (
                                    <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
                                  )}
                                  {step.status === "pending" && (
                                    <div className="w-3 h-3 rounded-full border border-muted-foreground" />
                                  )}
                                  <span
                                    className={`text-xs ${
                                      step.status === "active"
                                        ? "text-blue-500"
                                        : step.status === "done"
                                          ? "text-green-500"
                                          : "text-muted-foreground"
                                    }`}
                                  >
                                    {step.name}
                                  </span>
                                </div>
                                {index < workerActiveTask.steps.length - 1 && (
                                  <div className="w-4 h-px bg-border mx-1" />
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Progress bar */}
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-muted-foreground" />
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{
                                  width: `${(workerActiveTask.turnCount / workerActiveTask.maxTurns) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {workerActiveTask.turnCount}/
                              {workerActiveTask.maxTurns} turns
                            </span>
                          </div>
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
                          <p className="text-sm text-muted-foreground">
                            {worker.currentTask.summary}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{
                                  width: `${(worker.currentTask.turnCount / worker.currentTask.maxTurns) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {worker.currentTask.turnCount}/
                              {worker.currentTask.maxTurns}
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
                <option value="pr_created">PR Created</option>
                <option value="manager_review">Manager Review</option>
                <option value="revision_needed">Revision Needed</option>
                <option value="review_approved">Approved</option>
                <option value="review_rejected">Rejected</option>
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
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  Task
                </th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  Time
                </th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  Summary
                </th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  Model
                </th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  Links
                </th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">
                  Retries
                </th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                  Cost
                </th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {taskListLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : taskList.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No tasks found
                  </td>
                </tr>
              ) : (
                taskList.map((task) => (
                  <tr
                    key={task.id}
                    className={`hover:bg-muted/20 ${task.errorMessage ? "bg-red-500/5" : ""}`}
                  >
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
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {task.startedAt ? (
                        <div className="flex flex-col">
                          <span>
                            {new Date(task.startedAt).toLocaleDateString()}
                          </span>
                          <span>
                            {new Date(task.startedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="truncate">{task.summary}</div>
                      {task.errorMessage && (
                        <div
                          className="text-xs text-red-400 mt-1 truncate max-w-[300px]"
                          title={task.errorMessage}
                        >
                          ❌ {task.errorMessage.split("\n")[0].substring(0, 80)}
                          ...
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`flex items-center gap-1 ${getStatusColor(task.status)}`}
                        >
                          {task.status === "completed" && (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          {task.status === "failed" && (
                            <XCircle className="w-3 h-3" />
                          )}
                          {task.status === "executing" && (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          )}
                          {task.status === "queued" && (
                            <Clock className="w-3 h-3" />
                          )}
                          {task.status === "pr_created" && (
                            <GitBranch className="w-3 h-3" />
                          )}
                          {task.status === "manager_review" && (
                            <Users className="w-3 h-3" />
                          )}
                          <span className="capitalize text-xs">
                            {task.status.replace(/_/g, " ")}
                          </span>
                        </span>
                        {task.failureCategory && (
                          <span className="text-xs text-muted-foreground">
                            {task.failureCategory}
                          </span>
                        )}
                        {task.nextRetryAt && (
                          <span className="text-xs text-yellow-500">
                            Retry: {formatRelativeTime(task.nextRetryAt)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {task.workerModel ? (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-xs font-medium">
                          {task.workerModel}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(task.githubPrUrl || task.githubPrNumber) && (
                          task.githubPrUrl ? (
                            <a
                              href={task.githubPrUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 text-xs"
                              title="View Pull Request"
                            >
                              <GitBranch className="w-3 h-3" />
                              {task.githubPrNumber ? `PR#${task.githubPrNumber}` : "PR"}
                            </a>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Pull request number">
                              <GitBranch className="w-3 h-3" />
                              {task.githubPrNumber ? `PR#${task.githubPrNumber}` : "PR"}
                            </span>
                          )
                        )}
                        {task.ecsTaskArn && (
                          <a
                            href={`https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Fecs$252Fpagerduty-lite-dev$252Fai-worker-executor`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs"
                            title="View CloudWatch Logs"
                          >
                            <Terminal className="w-3 h-3" />
                            Logs
                          </a>
                        )}
                        {!task.githubPrUrl && !task.ecsTaskArn && (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={task.retryCount > 0 ? "text-yellow-500" : ""}
                      >
                        {task.retryCount}/{task.maxRetries}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      ${task.estimatedCostUsd.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetailModal(task)}
                          className="p-1.5 hover:bg-muted rounded"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {["failed", "blocked", "cancelled"].includes(
                          task.status,
                        ) && (
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
                        {["executing", "queued", "environment_setup"].includes(
                          task.status,
                        ) && (
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
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(selectedTask.status)}`}
                >
                  {selectedTask.status.replace(/_/g, " ")}
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
                  <div className="font-medium">
                    {selectedTask.retryCount}/{selectedTask.maxRetries}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Cost</div>
                  <div className="font-medium">
                    ${selectedTask.estimatedCostUsd.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Last Heartbeat
                  </div>
                  <div className="font-medium">
                    {formatRelativeTime(selectedTask.lastHeartbeatAt)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Global Timeout
                  </div>
                  <div className="font-medium">
                    {selectedTask.globalTimeoutAt
                      ? new Date(
                          selectedTask.globalTimeoutAt,
                        ).toLocaleTimeString()
                      : "Not set"}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {selectedTask.errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                  <div className="flex items-center gap-2 text-red-500 text-sm font-medium mb-1">
                    <AlertCircle className="w-4 h-4" />
                    Error{" "}
                    {selectedTask.failureCategory &&
                      `(${selectedTask.failureCategory})`}
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
                            <span className="text-sm font-medium">
                              Run #{run.runNumber}
                            </span>
                            <span
                              className={`text-xs font-medium ${getOutcomeColor(run.outcome)}`}
                            >
                              {run.outcome.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(run.startedAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">
                              Duration:
                            </span>{" "}
                            {run.durationSeconds
                              ? `${Math.floor(run.durationSeconds / 60)}m ${run.durationSeconds % 60}s`
                              : "-"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cost:</span>{" "}
                            ${run.estimatedCostUsd.toFixed(3)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Tokens:
                            </span>{" "}
                            {run.claudeInputTokens.toLocaleString()} /{" "}
                            {run.claudeOutputTokens.toLocaleString()}
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
                            {run.errorCategory && (
                              <span className="font-medium">
                                [{run.errorCategory}]{" "}
                              </span>
                            )}
                            {run.errorMessage}
                          </div>
                        )}

                        {run.filesModified && run.filesModified.length > 0 && (
                          <div className="mt-2 text-xs">
                            <span className="text-muted-foreground">
                              Files:{" "}
                            </span>
                            {run.filesModified.slice(0, 5).join(", ")}
                            {run.filesModified.length > 5 &&
                              ` +${run.filesModified.length - 5} more`}
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
              {["failed", "blocked", "cancelled"].includes(
                selectedTask.status,
              ) && (
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
              {["executing", "queued", "environment_setup"].includes(
                selectedTask.status,
              ) && (
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
                Retry{" "}
                <span className="text-primary font-medium">
                  {selectedTask.jiraIssueKey}
                </span>
                ?
              </p>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={retryOptions.resetRetryCount}
                  onChange={(e) =>
                    setRetryOptions((prev) => ({
                      ...prev,
                      resetRetryCount: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                Reset retry count to 0
              </label>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Custom Context (optional)
                </label>
                <textarea
                  value={retryOptions.customContext}
                  onChange={(e) =>
                    setRetryOptions((prev) => ({
                      ...prev,
                      customContext: e.target.value,
                    }))
                  }
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
                {actionLoading && (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                )}
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
                Cancel{" "}
                <span className="text-primary font-medium">
                  {selectedTask.jiraIssueKey}
                </span>
                ? This will stop the running ECS task.
              </p>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Reason (optional)
                </label>
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
                {actionLoading && (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                )}
                Cancel Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Cost Confirmation Modal */}
      {showResetCostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2 text-amber-500">
                <RotateCcw className="w-4 h-4" />
                Reset Cumulative Cost
              </h3>
              <button
                onClick={() => setShowResetCostModal(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to reset the cumulative cost to{" "}
                <span className="text-primary font-medium">$0.00</span>?
              </p>
              <p className="text-sm text-muted-foreground">
                Current cost:{" "}
                <span className="text-foreground font-medium">
                  ${data?.stats.cumulativeCost?.toFixed(2) || "0.00"}
                </span>
              </p>
              <p className="text-xs text-amber-500">
                This action cannot be undone. The previous cost total will be lost.
              </p>
            </div>

            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setShowResetCostModal(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg"
                disabled={resetCostLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleResetCost}
                disabled={resetCostLoading}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2"
              >
                {resetCostLoading && (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                )}
                Reset to $0.00
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Worker Modal */}
      {showCreateWorkerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create AI Worker
              </h3>
              <button
                onClick={() => setShowCreateWorkerModal(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Persona
                </label>
                <select
                  value={createWorkerForm.persona}
                  onChange={(e) =>
                    setCreateWorkerForm((prev) => ({
                      ...prev,
                      persona: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {Object.entries(PERSONA_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.emoji} {config.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={createWorkerForm.displayName}
                  onChange={(e) =>
                    setCreateWorkerForm((prev) => ({
                      ...prev,
                      displayName: e.target.value,
                    }))
                  }
                  placeholder="e.g., Backend Developer Bot"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={createWorkerForm.description}
                  onChange={(e) =>
                    setCreateWorkerForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="What this worker specializes in"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setShowCreateWorkerModal(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg"
                disabled={createLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorker}
                disabled={createLoading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                {createLoading && (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                )}
                Create Worker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Play className="w-4 h-4" />
                Run AI Task
              </h3>
              <button
                onClick={() => setShowCreateTaskModal(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Trigger an AI worker to work on a Jira issue. The task will be
                queued and picked up by an available worker.
              </p>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Jira Issue Key
                </label>
                <input
                  type="text"
                  value={createTaskForm.jiraIssueKey}
                  onChange={(e) =>
                    setCreateTaskForm((prev) => ({
                      ...prev,
                      jiraIssueKey: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="e.g., OCS-123"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Worker Persona
                </label>
                <select
                  value={createTaskForm.workerPersona}
                  onChange={(e) =>
                    setCreateTaskForm((prev) => ({
                      ...prev,
                      workerPersona: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {Object.entries(PERSONA_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.emoji} {config.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setShowCreateTaskModal(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg"
                disabled={createLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={createLoading || !createTaskForm.jiraIssueKey.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
              >
                {createLoading && (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                )}
                <Play className="w-4 h-4" />
                Run Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Worker Confirmation Modal */}
      {deleteWorkerId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2 text-red-500">
                <Trash2 className="w-4 h-4" />
                Delete Worker
              </h3>
              <button
                onClick={() => setDeleteWorkerId(null)}
                className="p-1 hover:bg-muted rounded"
                disabled={deleteLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete this worker? This action cannot
                be undone.
              </p>
              <p className="text-sm">
                The worker will be permanently removed from the system. Any
                associated task history will be preserved.
              </p>
            </div>

            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setDeleteWorkerId(null)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteWorker(deleteWorkerId)}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
              >
                {deleteLoading && (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                )}
                <Trash2 className="w-4 h-4" />
                Delete Worker
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
