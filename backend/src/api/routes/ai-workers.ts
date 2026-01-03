/**
 * AI Workers API Routes
 *
 * Manage AI worker instances (virtual employees that execute tasks)
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateRequest } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { AIWorkerInstance, AIWorkerStatus } from '../../shared/models/AIWorkerInstance';
import { AIWorkerPersona } from '../../shared/models/AIWorkerTask';
import { AIWorkerTask } from '../../shared/models/AIWorkerTask';
import { logger } from '../../shared/utils/logger';
import { setLocationHeader } from '../../shared/utils/location-header';
import { parsePaginationParams, paginatedResponse } from '../../shared/utils/pagination';
import { paginationValidators } from '../../shared/validators/pagination';

const router = Router();

// All routes require authentication
router.use(authenticateRequest);

/**
 * GET /api/v1/ai-workers
 * List all AI worker instances for the organization
 */
router.get('/', [...paginationValidators], async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const pagination = parsePaginationParams(req.query);
    const sortField = pagination.sort || 'createdAt';
    const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';

    // Filter by persona if provided
    const persona = req.query.persona as AIWorkerPersona | undefined;
    const status = req.query.status as AIWorkerStatus | undefined;

    const dataSource = await getDataSource();
    const workerRepo = dataSource.getRepository(AIWorkerInstance);

    const where: any = { orgId };
    if (persona) where.persona = persona;
    if (status) where.status = status;

    const [workers, total] = await workerRepo.findAndCount({
      where,
      order: { [sortField]: sortOrder },
      skip: pagination.offset,
      take: pagination.limit,
    });

    const lastItem = workers[workers.length - 1];
    return res.json(paginatedResponse(
      workers.map(formatWorker),
      total,
      pagination,
      lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
      'workers'
    ));
  } catch (error) {
    logger.error('Error fetching AI workers:', error);
    return res.status(500).json({ error: 'Failed to fetch AI workers' });
  }
});

/**
 * POST /api/v1/ai-workers
 * Create a new AI worker instance
 */
router.post(
  '/',
  [
    body('persona').isIn(['developer', 'qa_engineer', 'devops', 'tech_writer', 'support', 'pm'])
      .withMessage('Invalid persona'),
    body('displayName').isString().isLength({ min: 1, max: 100 }).withMessage('Display name is required'),
    body('description').optional().isString().isLength({ max: 500 }),
    body('config').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { persona, displayName, description, config } = req.body;

      const dataSource = await getDataSource();
      const workerRepo = dataSource.getRepository(AIWorkerInstance);

      const worker = workerRepo.create({
        orgId,
        persona,
        displayName,
        description,
        config: config || {},
        status: 'idle',
      });

      await workerRepo.save(worker);

      setLocationHeader(res, req, '/api/v1/ai-workers', worker.id);
      return res.status(201).json(formatWorker(worker));
    } catch (error) {
      logger.error('Error creating AI worker:', error);
      return res.status(500).json({ error: 'Failed to create AI worker' });
    }
  }
);

/**
 * GET /api/v1/ai-workers/:id
 * Get a specific AI worker instance
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
      const workerRepo = dataSource.getRepository(AIWorkerInstance);

      const worker = await workerRepo.findOne({
        where: { id, orgId },
      });

      if (!worker) {
        return res.status(404).json({ error: 'AI worker not found' });
      }

      return res.json(formatWorker(worker));
    } catch (error) {
      logger.error('Error fetching AI worker:', error);
      return res.status(500).json({ error: 'Failed to fetch AI worker' });
    }
  }
);

/**
 * PUT /api/v1/ai-workers/:id
 * Update an AI worker instance
 */
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('displayName').optional().isString().isLength({ min: 1, max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
    body('config').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;
      const { displayName, description, config } = req.body;

      const dataSource = await getDataSource();
      const workerRepo = dataSource.getRepository(AIWorkerInstance);

      const worker = await workerRepo.findOne({
        where: { id, orgId },
      });

      if (!worker) {
        return res.status(404).json({ error: 'AI worker not found' });
      }

      if (displayName !== undefined) worker.displayName = displayName;
      if (description !== undefined) worker.description = description;
      if (config !== undefined) worker.config = config;

      await workerRepo.save(worker);

      return res.json(formatWorker(worker));
    } catch (error) {
      logger.error('Error updating AI worker:', error);
      return res.status(500).json({ error: 'Failed to update AI worker' });
    }
  }
);

/**
 * PUT /api/v1/ai-workers/:id/pause
 * Pause an AI worker (won't pick up new tasks)
 */
router.put(
  '/:id/pause',
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
      const workerRepo = dataSource.getRepository(AIWorkerInstance);

      const worker = await workerRepo.findOne({
        where: { id, orgId },
      });

      if (!worker) {
        return res.status(404).json({ error: 'AI worker not found' });
      }

      if (worker.status === 'disabled') {
        return res.status(400).json({ error: 'Cannot pause a disabled worker' });
      }

      if (worker.status === 'working') {
        return res.status(400).json({ error: 'Cannot pause while worker is executing a task' });
      }

      worker.status = 'paused';
      await workerRepo.save(worker);

      return res.json(formatWorker(worker));
    } catch (error) {
      logger.error('Error pausing AI worker:', error);
      return res.status(500).json({ error: 'Failed to pause AI worker' });
    }
  }
);

/**
 * PUT /api/v1/ai-workers/:id/resume
 * Resume a paused AI worker
 */
router.put(
  '/:id/resume',
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
      const workerRepo = dataSource.getRepository(AIWorkerInstance);

      const worker = await workerRepo.findOne({
        where: { id, orgId },
      });

      if (!worker) {
        return res.status(404).json({ error: 'AI worker not found' });
      }

      if (worker.status !== 'paused') {
        return res.status(400).json({ error: 'Worker is not paused' });
      }

      worker.status = 'idle';
      await workerRepo.save(worker);

      return res.json(formatWorker(worker));
    } catch (error) {
      logger.error('Error resuming AI worker:', error);
      return res.status(500).json({ error: 'Failed to resume AI worker' });
    }
  }
);

/**
 * PUT /api/v1/ai-workers/:id/disable
 * Disable an AI worker (permanent until re-enabled)
 */
router.put(
  '/:id/disable',
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
      const workerRepo = dataSource.getRepository(AIWorkerInstance);

      const worker = await workerRepo.findOne({
        where: { id, orgId },
      });

      if (!worker) {
        return res.status(404).json({ error: 'AI worker not found' });
      }

      if (worker.status === 'working') {
        return res.status(400).json({ error: 'Cannot disable while worker is executing a task' });
      }

      worker.status = 'disabled';
      await workerRepo.save(worker);

      return res.json(formatWorker(worker));
    } catch (error) {
      logger.error('Error disabling AI worker:', error);
      return res.status(500).json({ error: 'Failed to disable AI worker' });
    }
  }
);

/**
 * PUT /api/v1/ai-workers/:id/enable
 * Re-enable a disabled AI worker
 */
router.put(
  '/:id/enable',
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
      const workerRepo = dataSource.getRepository(AIWorkerInstance);

      const worker = await workerRepo.findOne({
        where: { id, orgId },
      });

      if (!worker) {
        return res.status(404).json({ error: 'AI worker not found' });
      }

      if (worker.status !== 'disabled') {
        return res.status(400).json({ error: 'Worker is not disabled' });
      }

      worker.status = 'idle';
      await workerRepo.save(worker);

      return res.json(formatWorker(worker));
    } catch (error) {
      logger.error('Error enabling AI worker:', error);
      return res.status(500).json({ error: 'Failed to enable AI worker' });
    }
  }
);

/**
 * GET /api/v1/ai-workers/:id/stats
 * Get performance statistics for an AI worker
 */
router.get(
  '/:id/stats',
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
      const workerRepo = dataSource.getRepository(AIWorkerInstance);
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const worker = await workerRepo.findOne({
        where: { id, orgId },
      });

      if (!worker) {
        return res.status(404).json({ error: 'AI worker not found' });
      }

      // Get recent tasks
      const recentTasks = await taskRepo.find({
        where: { assignedWorkerId: id },
        order: { createdAt: 'DESC' },
        take: 10,
      });

      // Calculate success rate
      const totalTasks = worker.tasksCompleted + worker.tasksFailed + worker.tasksCancelled;
      const successRate = totalTasks > 0 ? (worker.tasksCompleted / totalTasks) * 100 : 0;

      return res.json({
        workerId: worker.id,
        persona: worker.persona,
        displayName: worker.displayName,
        status: worker.status,
        stats: {
          tasksCompleted: worker.tasksCompleted,
          tasksFailed: worker.tasksFailed,
          tasksCancelled: worker.tasksCancelled,
          totalTasks,
          successRate: Math.round(successRate * 100) / 100,
          avgCompletionTimeSeconds: worker.avgCompletionTimeSeconds,
          totalTokensUsed: worker.totalTokensUsed,
          totalCostUsd: Number(worker.totalCostUsd),
          lastTaskAt: worker.lastTaskAt,
        },
        recentTasks: recentTasks.map(t => ({
          id: t.id,
          jiraIssueKey: t.jiraIssueKey,
          summary: t.summary,
          status: t.status,
          estimatedCostUsd: t.estimatedCostUsd,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
        })),
      });
    } catch (error) {
      logger.error('Error fetching AI worker stats:', error);
      return res.status(500).json({ error: 'Failed to fetch AI worker stats' });
    }
  }
);

/**
 * DELETE /api/v1/ai-workers/:id
 * Delete an AI worker instance
 */
router.delete(
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
      const workerRepo = dataSource.getRepository(AIWorkerInstance);

      const worker = await workerRepo.findOne({
        where: { id, orgId },
      });

      if (!worker) {
        return res.status(404).json({ error: 'AI worker not found' });
      }

      if (worker.status === 'working') {
        return res.status(400).json({ error: 'Cannot delete while worker is executing a task' });
      }

      await workerRepo.remove(worker);

      return res.status(204).send();
    } catch (error) {
      logger.error('Error deleting AI worker:', error);
      return res.status(500).json({ error: 'Failed to delete AI worker' });
    }
  }
);

// Helper function to format worker response
function formatWorker(worker: AIWorkerInstance) {
  return {
    id: worker.id,
    orgId: worker.orgId,
    persona: worker.persona,
    displayName: worker.displayName,
    description: worker.description,
    status: worker.status,
    currentTaskId: worker.currentTaskId,
    config: worker.config,
    tasksCompleted: worker.tasksCompleted,
    tasksFailed: worker.tasksFailed,
    tasksCancelled: worker.tasksCancelled,
    avgCompletionTimeSeconds: worker.avgCompletionTimeSeconds,
    totalTokensUsed: worker.totalTokensUsed,
    totalCostUsd: Number(worker.totalCostUsd),
    lastTaskAt: worker.lastTaskAt,
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
  };
}

export default router;
