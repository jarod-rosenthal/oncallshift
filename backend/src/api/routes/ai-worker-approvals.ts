/**
 * AI Worker Approvals API Routes
 *
 * Human-in-the-loop approval workflow for AI worker actions
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateRequest } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { AIWorkerApproval, ApprovalStatus, ApprovalType } from '../../shared/models/AIWorkerApproval';
import { AIWorkerTask } from '../../shared/models/AIWorkerTask';
import { AIWorkerTaskLog } from '../../shared/models/AIWorkerTaskLog';
import { logger } from '../../shared/utils/logger';
import { parsePaginationParams, paginatedResponse } from '../../shared/utils/pagination';
import { paginationValidators } from '../../shared/validators/pagination';
import { In } from 'typeorm';

const router = Router();

// All routes require authentication
router.use(authenticateRequest);

/**
 * GET /api/v1/ai-worker-approvals
 * List all pending approvals for the organization
 */
router.get('/', [...paginationValidators], async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const pagination = parsePaginationParams(req.query);
    const sortField = pagination.sort || 'requestedAt';
    const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';

    // Filters
    const status = req.query.status as ApprovalStatus | undefined;
    const approvalType = req.query.type as ApprovalType | undefined;

    const dataSource = await getDataSource();
    const approvalRepo = dataSource.getRepository(AIWorkerApproval);
    const taskRepo = dataSource.getRepository(AIWorkerTask);

    // Get all task IDs for this org
    const orgTasks = await taskRepo.find({
      where: { orgId },
      select: ['id'],
    });
    const taskIds = orgTasks.map(t => t.id);

    if (taskIds.length === 0) {
      return res.json(paginatedResponse([], 0, pagination, undefined, 'approvals'));
    }

    const where: any = { taskId: In(taskIds) };
    if (status) where.status = status;
    if (approvalType) where.approvalType = approvalType;

    const [approvals, total] = await approvalRepo.findAndCount({
      where,
      relations: ['task', 'respondedBy'],
      order: { [sortField]: sortOrder },
      skip: pagination.offset,
      take: pagination.limit,
    });

    const lastItem = approvals[approvals.length - 1];
    return res.json(paginatedResponse(
      approvals.map(formatApproval),
      total,
      pagination,
      lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
      'approvals'
    ));
  } catch (error) {
    logger.error('Error fetching approvals:', error);
    return res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

/**
 * GET /api/v1/ai-worker-approvals/pending
 * Get count and list of pending approvals (quick view)
 */
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const approvalRepo = dataSource.getRepository(AIWorkerApproval);
    const taskRepo = dataSource.getRepository(AIWorkerTask);

    // Get all task IDs for this org
    const orgTasks = await taskRepo.find({
      where: { orgId },
      select: ['id'],
    });
    const taskIds = orgTasks.map(t => t.id);

    if (taskIds.length === 0) {
      return res.json({ count: 0, approvals: [] });
    }

    const [approvals, count] = await approvalRepo.findAndCount({
      where: {
        taskId: In(taskIds),
        status: 'pending',
      },
      relations: ['task'],
      order: { requestedAt: 'DESC' },
      take: 10, // Only return the 10 most recent
    });

    return res.json({
      count,
      approvals: approvals.map(formatApproval),
    });
  } catch (error) {
    logger.error('Error fetching pending approvals:', error);
    return res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

/**
 * GET /api/v1/ai-worker-approvals/:id
 * Get a specific approval
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
      const approvalRepo = dataSource.getRepository(AIWorkerApproval);
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const approval = await approvalRepo.findOne({
        where: { id },
        relations: ['task', 'respondedBy'],
      });

      if (!approval) {
        return res.status(404).json({ error: 'Approval not found' });
      }

      // Verify task belongs to org
      const task = await taskRepo.findOne({
        where: { id: approval.taskId, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: 'Approval not found' });
      }

      return res.json(formatApproval(approval));
    } catch (error) {
      logger.error('Error fetching approval:', error);
      return res.status(500).json({ error: 'Failed to fetch approval' });
    }
  }
);

/**
 * POST /api/v1/ai-worker-approvals/:id/approve
 * Approve a pending request
 */
router.post(
  '/:id/approve',
  [
    param('id').isUUID(),
    body('notes').optional().isString().isLength({ max: 1000 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const { id } = req.params;
      const { notes } = req.body;

      const dataSource = await getDataSource();
      const approvalRepo = dataSource.getRepository(AIWorkerApproval);
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const logRepo = dataSource.getRepository(AIWorkerTaskLog);

      const approval = await approvalRepo.findOne({
        where: { id },
        relations: ['task'],
      });

      if (!approval) {
        return res.status(404).json({ error: 'Approval not found' });
      }

      // Verify task belongs to org
      const task = await taskRepo.findOne({
        where: { id: approval.taskId, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: 'Approval not found' });
      }

      if (!approval.isPending()) {
        return res.status(400).json({ error: 'Approval is not pending' });
      }

      if (approval.isExpired()) {
        approval.status = 'expired';
        await approvalRepo.save(approval);
        return res.status(400).json({ error: 'Approval has expired' });
      }

      // Approve
      approval.approve(userId, notes);
      await approvalRepo.save(approval);

      // Log the approval
      const log = AIWorkerTaskLog.create(task.id, 'approval_response', `Approved by user: ${notes || 'No notes'}`, { severity: 'info' });
      await logRepo.save(logRepo.create(log));

      // If this was a PR review approval and the task is waiting, transition it
      if (approval.approvalType === 'pr_review' && task.status === 'review_pending') {
        task.status = 'completed';
        task.completedAt = new Date();
        await taskRepo.save(task);
      }

      return res.json({
        message: 'Approval granted',
        approval: formatApproval(approval),
      });
    } catch (error) {
      logger.error('Error approving:', error);
      return res.status(500).json({ error: 'Failed to approve' });
    }
  }
);

/**
 * POST /api/v1/ai-worker-approvals/:id/reject
 * Reject a pending request
 */
router.post(
  '/:id/reject',
  [
    param('id').isUUID(),
    body('notes').isString().isLength({ min: 1, max: 1000 }).withMessage('Rejection reason is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const { id } = req.params;
      const { notes } = req.body;

      const dataSource = await getDataSource();
      const approvalRepo = dataSource.getRepository(AIWorkerApproval);
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const logRepo = dataSource.getRepository(AIWorkerTaskLog);

      const approval = await approvalRepo.findOne({
        where: { id },
        relations: ['task'],
      });

      if (!approval) {
        return res.status(404).json({ error: 'Approval not found' });
      }

      // Verify task belongs to org
      const task = await taskRepo.findOne({
        where: { id: approval.taskId, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: 'Approval not found' });
      }

      if (!approval.isPending()) {
        return res.status(400).json({ error: 'Approval is not pending' });
      }

      // Reject
      approval.reject(userId, notes);
      await approvalRepo.save(approval);

      // Log the rejection
      const log = AIWorkerTaskLog.create(task.id, 'approval_response', `Rejected by user: ${notes}`, { severity: 'warning' });
      await logRepo.save(logRepo.create(log));

      // If this was a PR review rejection and the task is waiting, handle it
      if (approval.approvalType === 'pr_review' && task.status === 'review_pending') {
        // Task stays in review_pending or could be moved to review_rejected status
        task.status = 'review_rejected';
        await taskRepo.save(task);

        const retryLog = AIWorkerTaskLog.create(
          task.id,
          'status_change',
          'PR rejected - awaiting revisions',
          { severity: 'info' }
        );
        await logRepo.save(logRepo.create(retryLog));
      }

      return res.json({
        message: 'Approval rejected',
        approval: formatApproval(approval),
      });
    } catch (error) {
      logger.error('Error rejecting:', error);
      return res.status(500).json({ error: 'Failed to reject' });
    }
  }
);

/**
 * POST /api/v1/ai-worker-approvals/:id/expire
 * Manually expire an approval (admin action)
 */
router.post(
  '/:id/expire',
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
      const approvalRepo = dataSource.getRepository(AIWorkerApproval);
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const approval = await approvalRepo.findOne({
        where: { id },
      });

      if (!approval) {
        return res.status(404).json({ error: 'Approval not found' });
      }

      // Verify task belongs to org
      const task = await taskRepo.findOne({
        where: { id: approval.taskId, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: 'Approval not found' });
      }

      if (!approval.isPending()) {
        return res.status(400).json({ error: 'Approval is not pending' });
      }

      approval.status = 'expired';
      approval.respondedAt = new Date();
      approval.responseNotes = 'Manually expired by admin';
      await approvalRepo.save(approval);

      return res.json({
        message: 'Approval expired',
        approval: formatApproval(approval),
      });
    } catch (error) {
      logger.error('Error expiring approval:', error);
      return res.status(500).json({ error: 'Failed to expire approval' });
    }
  }
);

// Helper function to format approval response
function formatApproval(approval: AIWorkerApproval) {
  return {
    id: approval.id,
    taskId: approval.taskId,
    task: approval.task ? {
      id: approval.task.id,
      jiraIssueKey: approval.task.jiraIssueKey,
      summary: approval.task.summary,
      status: approval.task.status,
      githubPrUrl: approval.task.githubPrUrl,
    } : null,
    approvalType: approval.approvalType,
    status: approval.status,
    description: approval.description,
    payload: approval.payload,
    requestedAt: approval.requestedAt,
    expiresAt: approval.expiresAt,
    respondedAt: approval.respondedAt,
    respondedBy: approval.respondedBy ? {
      id: approval.respondedBy.id,
      fullName: approval.respondedBy.fullName,
      email: approval.respondedBy.email,
    } : null,
    responseNotes: approval.responseNotes,
    riskLevel: approval.getRiskLevel(),
    isExpired: approval.isExpired(),
    createdAt: approval.createdAt,
  };
}

export default router;
