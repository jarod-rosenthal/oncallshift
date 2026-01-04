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
import { AIWorkerTask, AIWorkerTaskStatus } from '../../shared/models/AIWorkerTask';
import { AIWorkerTaskLog } from '../../shared/models/AIWorkerTaskLog';
import { AIWorkerTaskRun } from '../../shared/models/AIWorkerTaskRun';
import { AIWorkerConversation } from '../../shared/models/AIWorkerConversation';
import { logger } from '../../shared/utils/logger';
import { SQS, GetQueueAttributesCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import { ECS, StopTaskCommand } from '@aws-sdk/client-ecs';
import { MoreThan, In } from 'typeorm';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();

// Initialize AWS clients
const awsRegion = process.env.AWS_REGION || 'us-east-1';
const sqs = new SQS({ region: awsRegion });
const ecs = new ECS({ region: awsRegion });
const queueUrl = process.env.AI_WORKER_QUEUE_URL;
const ecsCluster = process.env.ECS_CLUSTER_NAME || 'pagerduty-lite-dev';

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
 * GET /api/v1/super-admin/control-center/tasks
 * List tasks with filtering and pagination
 */
router.get('/control-center/tasks', [
  query('status').optional().isIn(['queued', 'claimed', 'environment_setup', 'executing', 'pr_created', 'review_pending', 'review_approved', 'review_rejected', 'completed', 'failed', 'blocked', 'cancelled']),
  query('search').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const status = req.query.status as AIWorkerTaskStatus | undefined;
    const search = req.query.search as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const dataSource = await getDataSource();
    const taskRepo = dataSource.getRepository(AIWorkerTask);

    const queryBuilder = taskRepo.createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedWorker', 'worker')
      .orderBy('task.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (status) {
      queryBuilder.andWhere('task.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere('(task.jiraIssueKey ILIKE :search OR task.summary ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [tasks, total] = await queryBuilder.getManyAndCount();

    return res.json({
      tasks: tasks.map(t => ({
        id: t.id,
        jiraIssueKey: t.jiraIssueKey,
        summary: t.summary,
        status: t.status,
        workerPersona: t.workerPersona,
        workerName: t.assignedWorker?.displayName || 'Unassigned',
        retryCount: t.retryCount,
        maxRetries: t.maxRetries,
        estimatedCostUsd: Number(t.estimatedCostUsd),
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        errorMessage: t.errorMessage,
        failureCategory: t.failureCategory,
        lastHeartbeatAt: t.lastHeartbeatAt,
        nextRetryAt: t.nextRetryAt,
        globalTimeoutAt: t.globalTimeoutAt,
        githubPrUrl: t.githubPrUrl,
        createdAt: t.createdAt,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * GET /api/v1/super-admin/control-center/tasks/:id/runs
 * Get all run attempts for a task
 */
router.get('/control-center/tasks/:taskId/runs', [
  param('taskId').isUUID(),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { taskId } = req.params;

    const dataSource = await getDataSource();
    const taskRepo = dataSource.getRepository(AIWorkerTask);
    const runRepo = dataSource.getRepository(AIWorkerTaskRun);

    // Verify task exists
    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get all runs
    const runs = await runRepo.find({
      where: { taskId },
      order: { runNumber: 'ASC' },
    });

    return res.json({
      taskId,
      taskStatus: task.status,
      runs: runs.map(r => ({
        id: r.id,
        runNumber: r.runNumber,
        outcome: r.outcome,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        durationSeconds: r.durationSeconds,
        errorMessage: r.errorMessage,
        errorCategory: r.errorCategory,
        ecsTaskId: r.ecsTaskId,
        claudeInputTokens: r.claudeInputTokens,
        claudeOutputTokens: r.claudeOutputTokens,
        estimatedCostUsd: Number(r.estimatedCostUsd),
        filesModified: r.filesModified,
        gitBranch: r.gitBranch,
        gitCommitSha: r.gitCommitSha,
      })),
    });
  } catch (error) {
    logger.error('Error fetching task runs:', error);
    return res.status(500).json({ error: 'Failed to fetch task runs' });
  }
});

/**
 * POST /api/v1/super-admin/control-center/tasks/:id/retry
 * Enhanced retry with options to reset retry count and provide custom context
 */
router.post('/control-center/tasks/:taskId/retry', [
  param('taskId').isUUID(),
  body('resetRetryCount').optional().isBoolean(),
  body('customContext').optional().isString().isLength({ max: 10000 }),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { taskId } = req.params;
    const { resetRetryCount, customContext } = req.body;

    const dataSource = await getDataSource();
    const taskRepo = dataSource.getRepository(AIWorkerTask);

    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!['failed', 'cancelled', 'blocked'].includes(task.status)) {
      return res.status(400).json({ error: 'Only failed, cancelled, or blocked tasks can be retried' });
    }

    // Reset retry count if requested
    if (resetRetryCount) {
      task.retryCount = 0;
      task.retryBackoffSeconds = 60;
    }

    // Add custom context if provided
    if (customContext) {
      const existingContext = task.previousRunContext || '';
      task.previousRunContext = existingContext + '\n\n## Manual Retry Context\n' + customContext;
    }

    // Set global timeout if not already set (4 hours from now)
    if (!task.globalTimeoutAt) {
      task.globalTimeoutAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    }

    // Update task state for retry
    task.status = 'queued';
    task.errorMessage = null;
    task.failureCategory = null;
    task.nextRetryAt = null;
    task.watcherNotes = (task.watcherNotes || '') + `\n[${new Date().toISOString()}] Manual retry triggered`;

    await taskRepo.save(task);

    // Send retry message to queue
    if (queueUrl) {
      await sqs.send(new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ taskId: task.id, action: 'retry' }),
      }));
    }

    logger.info('Manual retry triggered for task', { taskId, resetRetryCount, hasCustomContext: !!customContext });

    return res.json({
      message: 'Retry initiated',
      taskId: task.id,
      retryCount: task.retryCount,
      globalTimeoutAt: task.globalTimeoutAt,
    });
  } catch (error) {
    logger.error('Error retrying task:', error);
    return res.status(500).json({ error: 'Failed to retry task' });
  }
});

/**
 * POST /api/v1/super-admin/control-center/tasks/:id/cancel
 * Cancel a running task with reason
 */
router.post('/control-center/tasks/:taskId/cancel', [
  param('taskId').isUUID(),
  body('reason').optional().isString().isLength({ max: 500 }),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { taskId } = req.params;
    const { reason } = req.body;

    const dataSource = await getDataSource();
    const taskRepo = dataSource.getRepository(AIWorkerTask);

    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      return res.status(400).json({ error: 'Task is already finished' });
    }

    // Stop ECS task if running
    if (task.ecsTaskArn) {
      try {
        await ecs.send(new StopTaskCommand({
          cluster: ecsCluster,
          task: task.ecsTaskArn,
          reason: reason || 'Cancelled via Control Center',
        }));
        logger.info('Stopped ECS task', { taskId, ecsTaskArn: task.ecsTaskArn });
      } catch (err) {
        logger.warn('Failed to stop ECS task (may already be stopped):', err);
      }
    }

    // Update task state
    task.status = 'cancelled';
    task.completedAt = new Date();
    task.errorMessage = reason || 'Cancelled via Control Center';
    task.watcherNotes = (task.watcherNotes || '') + `\n[${new Date().toISOString()}] Cancelled: ${reason || 'No reason provided'}`;

    await taskRepo.save(task);

    logger.info('Task cancelled via Control Center', { taskId, reason });

    return res.json({
      message: 'Task cancelled',
      taskId: task.id,
      status: task.status,
    });
  } catch (error) {
    logger.error('Error cancelling task:', error);
    return res.status(500).json({ error: 'Failed to cancel task' });
  }
});

/**
 * GET /api/v1/super-admin/control-center/watcher/status
 * Get watcher Lambda status and metrics
 */
router.get('/control-center/watcher/status', async (_req: Request, res: Response) => {
  try {
    const dataSource = await getDataSource();
    const taskRepo = dataSource.getRepository(AIWorkerTask);

    // Count tasks in various states that watcher monitors
    const stuckThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 mins ago

    const [
      monitoringCount,
      stuckCount,
      pendingRetryCount,
      globalTimeoutCount,
    ] = await Promise.all([
      // Active tasks being monitored
      taskRepo.count({
        where: { status: In(['executing', 'environment_setup']) },
      }),
      // Stuck tasks (no heartbeat for 15+ mins)
      taskRepo.createQueryBuilder('task')
        .where('task.status IN (:...statuses)', { statuses: ['executing', 'environment_setup'] })
        .andWhere('task.lastHeartbeatAt < :threshold', { threshold: stuckThreshold })
        .getCount(),
      // Tasks pending retry
      taskRepo.count({
        where: {
          status: In(['failed', 'blocked']),
          nextRetryAt: MoreThan(new Date()),
        },
      }),
      // Tasks approaching global timeout
      taskRepo.createQueryBuilder('task')
        .where('task.globalTimeoutAt IS NOT NULL')
        .andWhere('task.globalTimeoutAt < :soon', { soon: new Date(Date.now() + 30 * 60 * 1000) })
        .andWhere('task.status NOT IN (:...statuses)', { statuses: ['completed', 'failed', 'cancelled'] })
        .getCount(),
    ]);

    return res.json({
      status: 'operational',
      monitoring: {
        activeTasks: monitoringCount,
        stuckTasks: stuckCount,
        pendingRetries: pendingRetryCount,
        approachingTimeout: globalTimeoutCount,
      },
      config: {
        heartbeatInterval: 60,
        stuckThresholdMinutes: 15,
        maxBackoffSeconds: 3600,
        globalTimeoutHours: 4,
      },
    });
  } catch (error) {
    logger.error('Error fetching watcher status:', error);
    return res.status(500).json({ error: 'Failed to fetch watcher status' });
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
