import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { aiWorkersAPI, aiWorkerTasksAPI, aiWorkerApprovalsAPI } from '../lib/api-client';

// Types matching backend models
interface AIWorker {
  id: string;
  orgId: string;
  persona: 'developer' | 'qa_engineer' | 'devops' | 'tech_writer' | 'support' | 'pm';
  displayName: string;
  description?: string;
  status: 'idle' | 'working' | 'paused' | 'disabled';
  currentTaskId?: string;
  tasksCompleted: number;
  tasksFailed: number;
  tasksCancelled: number;
  avgCompletionTimeSeconds?: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  lastTaskAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AIWorkerTask {
  id: string;
  jiraIssueKey?: string;
  summary: string;
  status: string;
  workerPersona: string;
  githubPrUrl?: string;
  estimatedCostUsd?: number;
  createdAt: string;
  completedAt?: string;
}

interface AIWorkerApproval {
  id: string;
  taskId: string;
  task?: {
    id: string;
    jiraIssueKey?: string;
    summary: string;
    status: string;
    githubPrUrl?: string;
  };
  approvalType: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'auto_approved';
  description: string;
  requestedAt: string;
  expiresAt?: string;
  riskLevel: string;
  isExpired: boolean;
}

const PERSONA_LABELS: Record<string, string> = {
  developer: 'Developer',
  qa_engineer: 'QA Engineer',
  devops: 'DevOps',
  tech_writer: 'Tech Writer',
  support: 'Support',
  pm: 'Product Manager',
};

const PERSONA_COLORS: Record<string, string> = {
  developer: 'bg-blue-100 text-blue-800',
  qa_engineer: 'bg-green-100 text-green-800',
  devops: 'bg-purple-100 text-purple-800',
  tech_writer: 'bg-yellow-100 text-yellow-800',
  support: 'bg-orange-100 text-orange-800',
  pm: 'bg-pink-100 text-pink-800',
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-100 text-gray-800',
  working: 'bg-blue-100 text-blue-800',
  paused: 'bg-yellow-100 text-yellow-800',
  disabled: 'bg-red-100 text-red-800',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  pr_created: 'bg-purple-100 text-purple-800',
  review_pending: 'bg-yellow-100 text-yellow-800',
  review_approved: 'bg-green-100 text-green-800',
  review_rejected: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  blocked: 'bg-orange-100 text-orange-800',
};

export function AIWorkers() {
  const [workers, setWorkers] = useState<AIWorker[]>([]);
  const [tasks, setTasks] = useState<AIWorkerTask[]>([]);
  const [approvals, setApprovals] = useState<AIWorkerApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Summary stats
  const [summary, setSummary] = useState<{
    activeTaskCount: number;
    completedToday: number;
    totalCostToday: number;
    pendingApprovals: number;
  } | null>(null);

  // Create worker form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    persona: 'developer' as AIWorker['persona'],
    displayName: '',
    description: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'workers' | 'tasks' | 'approvals'>('workers');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [workersRes, tasksRes, approvalsRes, summaryRes] = await Promise.all([
        aiWorkersAPI.list(),
        aiWorkerTasksAPI.list({ limit: 20 }),
        aiWorkerApprovalsAPI.getPending(),
        aiWorkerTasksAPI.getSummary(),
      ]);

      setWorkers(workersRes.workers || []);
      setTasks(tasksRes.tasks || []);
      setApprovals(approvalsRes.approvals || []);
      setSummary(summaryRes);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load AI workers data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWorker = async () => {
    if (!createForm.displayName.trim()) {
      setError('Display name is required');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      await aiWorkersAPI.create(createForm);
      setSuccess('AI Worker created successfully');
      setShowCreateForm(false);
      setCreateForm({ persona: 'developer', displayName: '', description: '' });
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create AI worker');
    } finally {
      setIsCreating(false);
    }
  };

  const handleWorkerAction = async (workerId: string, action: 'pause' | 'resume' | 'disable' | 'enable') => {
    try {
      setError(null);
      await aiWorkersAPI[action](workerId);
      setSuccess(`Worker ${action}d successfully`);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} worker`);
    }
  };

  const handleApprovalAction = async (approvalId: string, action: 'approve' | 'reject', notes?: string) => {
    try {
      setError(null);
      if (action === 'approve') {
        await aiWorkerApprovalsAPI.approve(approvalId, notes);
      } else {
        await aiWorkerApprovalsAPI.reject(approvalId, notes || 'Rejected by user');
      }
      setSuccess(`Approval ${action}d successfully`);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} approval`);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const formatCost = (cost?: number) => {
    if (cost === undefined || cost === null) return '-';
    return `$${cost.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Workers</h1>
          <p className="text-muted-foreground">
            Autonomous AI employees that execute tasks from Jira
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          Create Worker
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">&times;</button>
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
          {success}
          <button onClick={() => setSuccess(null)} className="float-right font-bold">&times;</button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.activeTaskCount}</div>
              <div className="text-sm text-muted-foreground">Active Tasks</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.completedToday}</div>
              <div className="text-sm text-muted-foreground">Completed Today</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{formatCost(summary.totalCostToday)}</div>
              <div className="text-sm text-muted-foreground">Cost Today</div>
            </CardContent>
          </Card>
          <Card className={summary.pendingApprovals > 0 ? 'border-yellow-400' : ''}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.pendingApprovals}</div>
              <div className="text-sm text-muted-foreground">Pending Approvals</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-4">
          {(['workers', 'tasks', 'approvals'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'approvals' && approvals.length > 0 && (
                <Badge className="ml-2 bg-yellow-100 text-yellow-800">{approvals.length}</Badge>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Workers Tab */}
      {activeTab === 'workers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No AI workers configured. Create one to get started.
            </div>
          ) : (
            workers.map((worker) => (
              <Card key={worker.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{worker.displayName}</CardTitle>
                    <Badge className={STATUS_COLORS[worker.status] || 'bg-gray-100'}>
                      {worker.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    <Badge className={PERSONA_COLORS[worker.persona] || 'bg-gray-100'}>
                      {PERSONA_LABELS[worker.persona] || worker.persona}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {worker.description && (
                    <p className="text-sm text-muted-foreground mb-4">{worker.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div>
                      <span className="text-muted-foreground">Completed:</span>{' '}
                      <span className="font-medium">{worker.tasksCompleted}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Failed:</span>{' '}
                      <span className="font-medium">{worker.tasksFailed}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg Time:</span>{' '}
                      <span className="font-medium">{formatDuration(worker.avgCompletionTimeSeconds)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Cost:</span>{' '}
                      <span className="font-medium">{formatCost(worker.totalCostUsd)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {worker.status === 'idle' && (
                      <Button size="sm" variant="outline" onClick={() => handleWorkerAction(worker.id, 'pause')}>
                        Pause
                      </Button>
                    )}
                    {worker.status === 'paused' && (
                      <Button size="sm" variant="outline" onClick={() => handleWorkerAction(worker.id, 'resume')}>
                        Resume
                      </Button>
                    )}
                    {worker.status !== 'disabled' && worker.status !== 'working' && (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleWorkerAction(worker.id, 'disable')}>
                        Disable
                      </Button>
                    )}
                    {worker.status === 'disabled' && (
                      <Button size="sm" variant="outline" onClick={() => handleWorkerAction(worker.id, 'enable')}>
                        Enable
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
            <CardDescription>Tasks processed by AI workers</CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tasks yet. Tasks are created from Jira issues with the AI worker label.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Issue</th>
                      <th className="text-left py-2 px-2">Summary</th>
                      <th className="text-left py-2 px-2">Persona</th>
                      <th className="text-left py-2 px-2">Status</th>
                      <th className="text-left py-2 px-2">PR</th>
                      <th className="text-left py-2 px-2">Cost</th>
                      <th className="text-left py-2 px-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2 font-medium">
                          {task.jiraIssueKey || '-'}
                        </td>
                        <td className="py-2 px-2 max-w-xs truncate">
                          {task.summary}
                        </td>
                        <td className="py-2 px-2">
                          <Badge className={PERSONA_COLORS[task.workerPersona] || 'bg-gray-100'}>
                            {PERSONA_LABELS[task.workerPersona] || task.workerPersona}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Badge className={TASK_STATUS_COLORS[task.status] || 'bg-gray-100'}>
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          {task.githubPrUrl ? (
                            <a
                              href={task.githubPrUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              View PR
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2 px-2">{formatCost(task.estimatedCostUsd)}</td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {new Date(task.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {approvals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending approvals.
              </CardContent>
            </Card>
          ) : (
            approvals.map((approval) => (
              <Card key={approval.id} className="border-yellow-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {approval.task?.jiraIssueKey || 'Unknown Task'}: {approval.task?.summary || 'No summary'}
                    </CardTitle>
                    <Badge className={
                      approval.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                      approval.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {approval.riskLevel} risk
                    </Badge>
                  </div>
                  <CardDescription>{approval.approvalType.replace('_', ' ')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-4">{approval.description}</p>
                  {approval.task?.githubPrUrl && (
                    <p className="text-sm mb-4">
                      <a
                        href={approval.task.githubPrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View Pull Request
                      </a>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprovalAction(approval.id, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => {
                        const notes = prompt('Reason for rejection:');
                        if (notes) {
                          handleApprovalAction(approval.id, 'reject', notes);
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                  {approval.expiresAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Expires: {new Date(approval.expiresAt).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Create Worker Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create AI Worker</CardTitle>
              <CardDescription>Add a new AI worker to your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="persona">Persona</Label>
                <select
                  id="persona"
                  className="w-full mt-1 border border-input rounded-md px-3 py-2 bg-background"
                  value={createForm.persona}
                  onChange={(e) => setCreateForm({ ...createForm, persona: e.target.value as AIWorker['persona'] })}
                >
                  {Object.entries(PERSONA_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                  placeholder="e.g., Backend Developer Bot"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="What this worker specializes in"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateWorker} disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default AIWorkers;
