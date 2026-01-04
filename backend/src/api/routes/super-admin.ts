/**
 * Super Admin API Routes
 *
 * Control Center endpoints for monitoring and managing AI Workers
 * Only accessible by users with role='super_admin'
 */

import { Router, Request, Response } from 'express';
import { authenticateRequest } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { AIWorkerInstance } from '../../shared/models/AIWorkerInstance';
import { AIWorkerTask } from '../../shared/models/AIWorkerTask';
import { AIWorkerTaskLog } from '../../shared/models/AIWorkerTaskLog';
import { AIWorkerConversation } from '../../shared/models/AIWorkerConversation';
import { logger } from '../../shared/utils/logger';
import { SQS, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { MoreThan, In } from 'typeorm';

const router = Router();

// Initialize SQS client for queue depth
const sqs = new SQS({ region: process.env.AWS_REGION || 'us-east-1' });
const queueUrl = process.env.AI_WORKER_QUEUE_URL;

// Middleware to check super admin role
// Supports both user JWT auth (req.user) and org API key auth (req.orgId)
const requireSuperAdmin = async (req: Request, res: Response, next: Function): Promise<void> => {
  // If authenticated via org API key, allow access (org admins can use control center)
  if (req.authMethod === 'api_key' && req.orgId) {
    return next();
  }

  // If authenticated via user JWT, check for super_admin role
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.user.role !== 'super_admin') {
    res.status(403).json({ error: 'Super admin access required' });
    return;
  }
  next();
};

// All routes require authentication + super admin role
router.use(authenticateRequest);
router.use(requireSuperAdmin);

/**
 * GET /api/v1/super-admin/control-center
 * Get aggregated data for the AI Workers Control Center
 */
router.get('/control-center', async (_req: Request, res: Response) => {
  try {
    const dataSource = await getDataSource();
    const workerRepo = dataSource.getRepository(AIWorkerInstance);
    const taskRepo = dataSource.getRepository(AIWorkerTask);
    const logRepo = dataSource.getRepository(AIWorkerTaskLog);
    const conversationRepo = dataSource.getRepository(AIWorkerConversation);

    // Get today's start (midnight)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get all workers
    const workers = await workerRepo.find({
      order: { displayName: 'ASC' },
    });

    // Get active tasks (not completed/failed/cancelled)
    const activeTasks = await taskRepo.find({
      where: {
        status: In(['queued', 'claimed', 'environment_setup', 'executing', 'pr_created', 'review_pending']),
      },
      order: { createdAt: 'DESC' },
    });

    // Get recent completed tasks (today)
    const recentCompleted = await taskRepo.find({
      where: {
        status: In(['completed', 'failed', 'cancelled']),
        completedAt: MoreThan(todayStart),
      },
      order: { completedAt: 'DESC' },
      take: 10,
    });

    // Calculate today's cost
    const todayTasks = await taskRepo.find({
      where: {
        createdAt: MoreThan(todayStart),
      },
    });
    const todayCost = todayTasks.reduce((sum, t) => sum + Number(t.estimatedCostUsd || 0), 0);

    // Get queue depth from SQS
    let queueDepth = 0;
    if (queueUrl) {
      try {
        const queueAttrs = await sqs.send(new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ['ApproximateNumberOfMessages'],
        }));
        queueDepth = parseInt(queueAttrs.Attributes?.ApproximateNumberOfMessages || '0', 10);
      } catch (err) {
        logger.warn('Failed to get SQS queue depth:', err);
      }
    }

    // Get logs for active tasks
    const activeTaskIds = activeTasks.map(t => t.id);
    let taskLogs: AIWorkerTaskLog[] = [];
    if (activeTaskIds.length > 0) {
      taskLogs = await logRepo.find({
        where: {
          taskId: In(activeTaskIds),
        },
        order: { createdAt: 'DESC' },
        take: 100, // Last 100 logs across all active tasks
      });
    }

    // Get conversations for turn counts
    let conversations: AIWorkerConversation[] = [];
    if (activeTaskIds.length > 0) {
      conversations = await conversationRepo.find({
        where: {
          taskId: In(activeTaskIds),
        },
      });
    }

    // Build response
    const stats = {
      totalWorkers: workers.length,
      activeWorkers: workers.filter(w => w.status === 'working').length,
      queueDepth,
      todayCost: Math.round(todayCost * 100) / 100,
      todayCompleted: todayTasks.filter(t => t.status === 'completed').length,
      todayFailed: todayTasks.filter(t => t.status === 'failed').length,
    };

    // Map workers with current task info
    const workersData = workers.map(w => {
      const currentTask = activeTasks.find(t => t.assignedWorkerId === w.id);
      const conversation = currentTask ? conversations.find(c => c.taskId === currentTask.id) : null;

      return {
        id: w.id,
        displayName: w.displayName,
        persona: w.persona,
        status: w.status,
        tasksCompleted: w.tasksCompleted,
        tasksFailed: w.tasksFailed,
        totalCostUsd: Number(w.totalCostUsd),
        currentTask: currentTask ? {
          id: currentTask.id,
          jiraKey: currentTask.jiraIssueKey,
          summary: currentTask.summary,
          status: currentTask.status,
          turnCount: conversation?.turnCount || 0,
          maxTurns: 50, // Default max turns
        } : null,
      };
    });

    // Map active tasks with logs and progress
    const activeTasksData = activeTasks.map(t => {
      const worker = workers.find(w => w.id === t.assignedWorkerId);
      const conversation = conversations.find(c => c.taskId === t.id);
      const logs = taskLogs.filter(l => l.taskId === t.id).slice(0, 10);

      // Calculate step progress
      const steps = getTaskSteps(t.status);

      return {
        id: t.id,
        jiraIssueKey: t.jiraIssueKey,
        summary: t.summary,
        status: t.status,
        workerName: worker?.displayName || 'Unassigned',
        workerPersona: t.workerPersona,
        turnCount: conversation?.turnCount || 0,
        maxTurns: 50,
        estimatedCostUsd: Number(t.estimatedCostUsd),
        startedAt: t.startedAt,
        recentLogs: logs.map(l => ({
          timestamp: l.createdAt,
          message: l.message,
          type: l.type,
          severity: l.severity,
        })),
        steps,
      };
    });

    // Map recent completed tasks
    const recentCompletedData = recentCompleted.map(t => ({
      id: t.id,
      jiraIssueKey: t.jiraIssueKey,
      summary: t.summary,
      status: t.status,
      costUsd: Number(t.estimatedCostUsd),
      durationMinutes: t.completedAt && t.startedAt
        ? Math.round((t.completedAt.getTime() - t.startedAt.getTime()) / 60000)
        : null,
      completedAt: t.completedAt,
      githubPrUrl: t.githubPrUrl,
    }));

    return res.json({
      stats,
      workers: workersData,
      activeTasks: activeTasksData,
      recentCompleted: recentCompletedData,
    });
  } catch (error) {
    logger.error('Error fetching control center data:', error);
    return res.status(500).json({ error: 'Failed to fetch control center data' });
  }
});

/**
 * GET /api/v1/super-admin/control-center/logs/:taskId
 * Stream logs for a specific task (for CLI tool)
 */
router.get('/control-center/logs/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const since = req.query.since ? new Date(req.query.since as string) : undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    const dataSource = await getDataSource();
    const logRepo = dataSource.getRepository(AIWorkerTaskLog);
    const taskRepo = dataSource.getRepository(AIWorkerTask);

    // Verify task exists
    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get logs
    const whereClause: any = { taskId };
    if (since) {
      whereClause.createdAt = MoreThan(since);
    }

    const logs = await logRepo.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return res.json({
      taskId,
      taskStatus: task.status,
      logs: logs.reverse().map(l => ({
        id: l.id,
        timestamp: l.createdAt,
        type: l.type,
        message: l.message,
        severity: l.severity,
        command: l.command,
        exitCode: l.exitCode,
        filePath: l.filePath,
        durationMs: l.durationMs,
      })),
    });
  } catch (error) {
    logger.error('Error fetching task logs:', error);
    return res.status(500).json({ error: 'Failed to fetch task logs' });
  }
});

/**
 * Helper: Get task step progress based on status
 */
function getTaskSteps(status: string): Array<{ name: string; status: 'done' | 'active' | 'pending' }> {
  const statusOrder = [
    'queued',
    'claimed',
    'environment_setup',
    'executing',
    'pr_created',
    'review_pending',
    'review_approved',
    'completed',
  ];

  const statusIndex = statusOrder.indexOf(status);
  const steps = [
    { name: 'Queued', statuses: ['queued'] },
    { name: 'Claimed', statuses: ['claimed'] },
    { name: 'Environment Setup', statuses: ['environment_setup'] },
    { name: 'Executing', statuses: ['executing'] },
    { name: 'PR Created', statuses: ['pr_created', 'review_pending', 'review_approved'] },
    { name: 'Completed', statuses: ['completed'] },
  ];

  return steps.map(step => {
    const isActive = step.statuses.includes(status);
    const isDone = !isActive && statusOrder.indexOf(step.statuses[0]) < statusIndex;

    return {
      name: step.name,
      status: isActive ? 'active' as const : isDone ? 'done' as const : 'pending' as const,
    };
  });
}

export default router;
