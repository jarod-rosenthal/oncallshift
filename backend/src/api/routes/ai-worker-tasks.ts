/**
 * AI Worker Tasks API Routes
 *
 * Manage AI worker tasks (Jira issues being processed)
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateRequest } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { AIWorkerTask, AIWorkerTaskStatus } from '../../shared/models/AIWorkerTask';
import { AIWorkerTaskLog } from '../../shared/models/AIWorkerTaskLog';
import { AIWorkerConversation } from '../../shared/models/AIWorkerConversation';
import { AIWorkerInstance } from '../../shared/models/AIWorkerInstance';
import { logger } from '../../shared/utils/logger';
import { setLocationHeader } from '../../shared/utils/location-header';
import { parsePaginationParams, paginatedResponse } from '../../shared/utils/pagination';
import { paginationValidators } from '../../shared/validators/pagination';
import { SQS, SendMessageCommand } from '@aws-sdk/client-sqs';
import { In } from 'typeorm';

const router = Router();

// All routes require authentication
router.use(authenticateRequest);

// Initialize SQS client
const sqs = new SQS({ region: process.env.AWS_REGION || 'us-east-1' });
const queueUrl = process.env.AI_WORKER_QUEUE_URL;

/**
 * GET /api/v1/ai-worker-tasks/summary
 * Get summary statistics for tasks
 * NOTE: This route MUST be defined before /:id to avoid "summary" being matched as a UUID
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const taskRepo = dataSource.getRepository(AIWorkerTask);
    const workerRepo = dataSource.getRepository(AIWorkerInstance);

    // Count tasks by status
    const statusCounts = await taskRepo
      .createQueryBuilder('task')
      .select('task.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('task.org_id = :orgId', { orgId })
      .groupBy('task.status')
      .getRawMany();

    // Calculate total cost
    const costResult = await taskRepo
      .createQueryBuilder('task')
      .select('SUM(task.estimated_cost_usd)', 'totalCost')
      .where('task.org_id = :orgId', { orgId })
      .getRawOne();

    // Get worker counts
    const workerCounts = await workerRepo
      .createQueryBuilder('worker')
      .select('worker.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('worker.org_id = :orgId', { orgId })
      .groupBy('worker.status')
      .getRawMany();

    return res.json({
      tasks: {
        byStatus: statusCounts.reduce((acc, { status, count }) => {
          acc[status] = parseInt(count, 10);
          return acc;
        }, {} as Record<string, number>),
        totalCostUsd: parseFloat(costResult?.totalCost || '0'),
      },
      workers: {
        byStatus: workerCounts.reduce((acc, { status, count }) => {
          acc[status] = parseInt(count, 10);
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    logger.error('Error fetching task summary:', error);
    return res.status(500).json({ error: 'Failed to fetch task summary' });
  }
});

/**
 * GET /api/v1/ai-worker-tasks
 * List all AI worker tasks for the organization
 */
router.get('/', [...paginationValidators], async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const pagination = parsePaginationParams(req.query);
    const sortField = pagination.sort || 'createdAt';
    const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';

    // Filters
    const status = req.query.status as AIWorkerTaskStatus | undefined;
    const persona = req.query.persona as string | undefined;
    const jiraProjectKey = req.query.project as string | undefined;

    const dataSource = await getDataSource();
    const taskRepo = dataSource.getRepository(AIWorkerTask);

    const where: any = { orgId };
    if (status) where.status = status;
    if (persona) where.workerPersona = persona;
    if (jiraProjectKey) where.jiraProjectKey = jiraProjectKey;

    const [tasks, total] = await taskRepo.findAndCount({
      where,
      relations: ['assignedWorker'],
      order: { [sortField]: sortOrder },
      skip: pagination.offset,
      take: pagination.limit,
    });

    const lastItem = tasks[tasks.length - 1];
    return res.json(paginatedResponse(
      tasks.map(formatTask),
      total,
      pagination,
      lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
      'tasks'
    ));
  } catch (error) {
    logger.error('Error fetching AI worker tasks:', error);
    return res.status(500).json({ error: 'Failed to fetch AI worker tasks' });
  }
});

/**
 * POST /api/v1/ai-worker-tasks
 * Manually create a task (bypassing Jira webhook)
 */
router.post(
  '/',
  [
    body('jiraIssueKey').isString().matches(/^[A-Z]+-\d+$/).withMessage('Invalid Jira issue key format'),
    body('summary').isString().isLength({ min: 1, max: 500 }).withMessage('Summary is required'),
    body('description').optional().isString(),
    body('workerPersona').isIn(['developer', 'qa_engineer', 'devops', 'tech_writer', 'support', 'pm'])
      .withMessage('Invalid persona'),
    body('githubRepo').isString().withMessage('GitHub repo is required'),
    body('priority').optional().isInt({ min: 1, max: 5 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const {
        jiraIssueKey,
        summary,
        description,
        workerPersona,
        githubRepo,
        priority,
      } = req.body;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      // Check for duplicate active task
      const existing = await taskRepo.findOne({
        where: {
          orgId,
          jiraIssueKey,
          status: In(['queued', 'claimed', 'environment_setup', 'executing', 'pr_created', 'awaiting_approval']),
        },
      });

      if (existing) {
        return res.status(409).json({
          error: 'Task already exists for this Jira issue',
          existingTaskId: existing.id,
        });
      }

      const task = taskRepo.create({
        orgId,
        jiraIssueKey,
        jiraIssueId: jiraIssueKey, // Placeholder when created manually
        jiraProjectKey: jiraIssueKey.split('-')[0],
        jiraProjectType: 'software',
        jiraIssueType: 'Task',
        summary,
        description,
        workerPersona,
        githubRepo,
        priority: priority || 3,
        status: 'queued',
      });

      await taskRepo.save(task);

      // Queue the task for execution
      if (queueUrl) {
        await sqs.send(new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({ taskId: task.id, action: 'execute' }),
        }));
      }

      setLocationHeader(res, req, '/api/v1/ai-worker-tasks', task.id);
      return res.status(201).json(formatTask(task));
    } catch (error) {
      logger.error('Error creating AI worker task:', error);
      return res.status(500).json({ error: 'Failed to create AI worker task' });
    }
  }
);

/**
 * GET /api/v1/ai-worker-tasks/:id
 * Get a specific task
 */
router.get(
  '/:id',
  [param('id').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({
        where: { id, orgId },
        relations: ['assignedWorker', 'approvals'],
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.json(formatTask(task));
    } catch (error) {
      logger.error('Error fetching AI worker task:', error);
      return res.status(500).json({ error: 'Failed to fetch AI worker task' });
    }
  }
);

/**
 * GET /api/v1/ai-worker-tasks/:id/logs
 * Get execution logs for a task
 */
router.get(
  '/:id/logs',
  [
    param('id').isUUID(),
    query('type').optional().isString(),
    query('severity').optional().isIn(['debug', 'info', 'warning', 'error']),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;
      const { type, severity } = req.query;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const logRepo = dataSource.getRepository(AIWorkerTaskLog);

      // Verify task exists and belongs to org
      const task = await taskRepo.findOne({
        where: { id, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const where: any = { taskId: id };
      if (type) where.type = type;
      if (severity) where.severity = severity;

      const logs = await logRepo.find({
        where,
        order: { createdAt: 'ASC' },
        take: 500, // Limit to 500 most recent logs
      });

      return res.json({
        taskId: id,
        logs: logs.map(log => ({
          id: log.id,
          type: log.type,
          message: log.message,
          severity: log.severity,
          metadata: log.metadata,
          command: log.command,
          exitCode: log.exitCode,
          stdout: log.stdout,
          stderr: log.stderr,
          filePath: log.filePath,
          durationMs: log.durationMs,
          createdAt: log.createdAt,
        })),
      });
    } catch (error) {
      logger.error('Error fetching task logs:', error);
      return res.status(500).json({ error: 'Failed to fetch task logs' });
    }
  }
);

/**
 * GET /api/v1/ai-worker-tasks/:id/conversation
 * Get Claude conversation history for a task
 */
router.get(
  '/:id/conversation',
  [param('id').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const conversationRepo = dataSource.getRepository(AIWorkerConversation);

      // Verify task exists and belongs to org
      const task = await taskRepo.findOne({
        where: { id, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const conversation = await conversationRepo.findOne({
        where: { taskId: id },
        order: { createdAt: 'DESC' },
      });

      if (!conversation) {
        return res.json({
          taskId: id,
          conversation: null,
        });
      }

      return res.json({
        taskId: id,
        conversation: {
          id: conversation.id,
          status: conversation.status,
          model: conversation.model,
          turnCount: conversation.turnCount,
          inputTokens: conversation.inputTokens,
          outputTokens: conversation.outputTokens,
          messages: conversation.messages,
          errorMessage: conversation.errorMessage,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Error fetching task conversation:', error);
      return res.status(500).json({ error: 'Failed to fetch task conversation' });
    }
  }
);

/**
 * POST /api/v1/ai-worker-tasks/:id/cancel
 * Cancel a running task
 */
router.post(
  '/:id/cancel',
  [param('id').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({
        where: { id, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (!task.isActive()) {
        return res.status(400).json({ error: 'Task is not active and cannot be cancelled' });
      }

      // Send cancel message to orchestrator
      if (queueUrl) {
        await sqs.send(new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({ taskId: task.id, action: 'cancel' }),
        }));
      }

      return res.json({ message: 'Cancel request sent', taskId: task.id });
    } catch (error) {
      logger.error('Error cancelling task:', error);
      return res.status(500).json({ error: 'Failed to cancel task' });
    }
  }
);

/**
 * POST /api/v1/ai-worker-tasks/:id/heartbeat
 * Update task heartbeat timestamp (called by running ECS tasks)
 */
router.post(
  '/:id/heartbeat',
  [param('id').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({
        where: { id, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Update heartbeat timestamp
      task.lastHeartbeatAt = new Date();
      await taskRepo.save(task);

      logger.debug('Heartbeat received for task', { taskId: id });

      return res.json({
        taskId: task.id,
        lastHeartbeatAt: task.lastHeartbeatAt,
        status: task.status,
      });
    } catch (error) {
      logger.error('Error updating task heartbeat:', error);
      return res.status(500).json({ error: 'Failed to update heartbeat' });
    }
  }
);

/**
 * POST /api/v1/ai-worker-tasks/:id/retry
 * Retry a failed task
 */
router.post(
  '/:id/retry',
  [param('id').isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({
        where: { id, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.status !== 'failed' && task.status !== 'cancelled') {
        return res.status(400).json({ error: 'Only failed or cancelled tasks can be retried' });
      }

      if (!task.canRetry()) {
        return res.status(400).json({
          error: 'Maximum retries exceeded',
          retryCount: task.retryCount,
          maxRetries: task.maxRetries,
        });
      }

      // Send retry message to orchestrator
      if (queueUrl) {
        await sqs.send(new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({ taskId: task.id, action: 'retry' }),
        }));
      }

      return res.json({ message: 'Retry request sent', taskId: task.id });
    } catch (error) {
      logger.error('Error retrying task:', error);
      return res.status(500).json({ error: 'Failed to retry task' });
    }
  }
);

// Helper function to format task response
function formatTask(task: AIWorkerTask) {
  return {
    id: task.id,
    orgId: task.orgId,
    jiraIssueKey: task.jiraIssueKey,
    jiraIssueId: task.jiraIssueId,
    jiraProjectKey: task.jiraProjectKey,
    jiraProjectType: task.jiraProjectType,
    jiraIssueType: task.jiraIssueType,
    summary: task.summary,
    description: task.description,
    jiraFields: task.jiraFields,
    workerPersona: task.workerPersona,
    assignedWorkerId: task.assignedWorkerId,
    assignedWorker: task.assignedWorker ? {
      id: task.assignedWorker.id,
      displayName: task.assignedWorker.displayName,
      persona: task.assignedWorker.persona,
    } : null,
    status: task.status,
    priority: task.priority,
    githubRepo: task.githubRepo,
    githubBranch: task.githubBranch,
    githubPrNumber: task.githubPrNumber,
    githubPrUrl: task.githubPrUrl,
    ecsTaskArn: task.ecsTaskArn,
    ecsTaskId: task.ecsTaskId,
    claudeInputTokens: task.claudeInputTokens,
    claudeOutputTokens: task.claudeOutputTokens,
    ecsTaskSeconds: task.ecsTaskSeconds,
    estimatedCostUsd: task.estimatedCostUsd,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    errorMessage: task.errorMessage,
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    // Self-recovery fields
    lastHeartbeatAt: task.lastHeartbeatAt,
    previousRunContext: task.previousRunContext,
    globalTimeoutAt: task.globalTimeoutAt,
    nextRetryAt: task.nextRetryAt,
    retryBackoffSeconds: task.retryBackoffSeconds,
    failureCategory: task.failureCategory,
    watcherNotes: task.watcherNotes,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    approvals: task.approvals?.map(a => ({
      id: a.id,
      approvalType: a.approvalType,
      status: a.status,
      description: a.description,
    })),
  };
}

export default router;
