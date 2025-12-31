import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { PriorityLevel } from '../../shared/models';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/priorities
 * List all priority levels for the organization
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const priorityRepo = dataSource.getRepository(PriorityLevel);

    const priorities = await priorityRepo.find({
      where: { orgId },
      order: { orderValue: 'ASC' },
    });

    return res.json({
      priorities: priorities.map(formatPriority),
    });
  } catch (error) {
    logger.error('Error fetching priorities:', error);
    return res.status(500).json({ error: 'Failed to fetch priorities' });
  }
});

/**
 * POST /api/v1/priorities
 * Create a new priority level
 */
router.post(
  '/',
  [
    body('name').isString().notEmpty().withMessage('Priority name is required'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('color').optional().isString().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Color must be a valid hex code'),
    body('urgency').optional().isIn(['high', 'low']).withMessage('Urgency must be high or low'),
    body('autoEscalate').optional().isBoolean().withMessage('Auto-escalate must be a boolean'),
    body('escalateAfterMinutes').optional().isInt({ min: 1, max: 1440 }).withMessage('Escalate after must be 1-1440 minutes'),
    body('isDefault').optional().isBoolean().withMessage('Is default must be a boolean'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const currentUser = req.user!;

      // Only admins can create priorities
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const {
        name,
        description,
        color = '#6366f1',
        urgency = 'high',
        autoEscalate = false,
        escalateAfterMinutes = 30,
        isDefault = false,
      } = req.body;

      const dataSource = await getDataSource();
      const priorityRepo = dataSource.getRepository(PriorityLevel);

      // Check for duplicate name
      const existingName = await priorityRepo.findOne({
        where: { orgId, name },
      });
      if (existingName) {
        return res.status(409).json({ error: 'A priority with this name already exists' });
      }

      // Get max order value
      const maxOrderResult = await priorityRepo
        .createQueryBuilder('p')
        .select('MAX(p.orderValue)', 'max')
        .where('p.orgId = :orgId', { orgId })
        .getRawOne();
      const orderValue = (maxOrderResult?.max ?? -1) + 1;

      // If setting as default, clear other defaults
      if (isDefault) {
        await priorityRepo.update(
          { orgId, isDefault: true },
          { isDefault: false }
        );
      }

      const priority = priorityRepo.create({
        orgId,
        name,
        description: description || null,
        color,
        orderValue,
        urgency,
        autoEscalate,
        escalateAfterMinutes,
        isDefault,
      });

      await priorityRepo.save(priority);

      logger.info('Priority level created', { priorityId: priority.id, name, orgId });

      return res.status(201).json({
        priority: formatPriority(priority),
        message: 'Priority level created successfully',
      });
    } catch (error) {
      logger.error('Error creating priority:', error);
      return res.status(500).json({ error: 'Failed to create priority level' });
    }
  }
);

/**
 * GET /api/v1/priorities/:id
 * Get a specific priority level
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const priorityRepo = dataSource.getRepository(PriorityLevel);

    const priority = await priorityRepo.findOne({
      where: { id, orgId },
    });

    if (!priority) {
      return res.status(404).json({ error: 'Priority level not found' });
    }

    return res.json({ priority: formatPriority(priority) });
  } catch (error) {
    logger.error('Error fetching priority:', error);
    return res.status(500).json({ error: 'Failed to fetch priority level' });
  }
});

/**
 * PUT /api/v1/priorities/:id
 * Update a priority level
 */
router.put(
  '/:id',
  [
    body('name').optional().isString().notEmpty().withMessage('Priority name cannot be empty'),
    body('description').optional({ nullable: true }).isString().withMessage('Description must be a string'),
    body('color').optional().isString().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Color must be a valid hex code'),
    body('urgency').optional().isIn(['high', 'low']).withMessage('Urgency must be high or low'),
    body('autoEscalate').optional().isBoolean().withMessage('Auto-escalate must be a boolean'),
    body('escalateAfterMinutes').optional().isInt({ min: 1, max: 1440 }).withMessage('Escalate after must be 1-1440 minutes'),
    body('isDefault').optional().isBoolean().withMessage('Is default must be a boolean'),
    body('orderValue').optional().isInt({ min: 0 }).withMessage('Order value must be a non-negative integer'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const currentUser = req.user!;

      // Only admins can update priorities
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const {
        name,
        description,
        color,
        urgency,
        autoEscalate,
        escalateAfterMinutes,
        isDefault,
        orderValue,
      } = req.body;

      const dataSource = await getDataSource();
      const priorityRepo = dataSource.getRepository(PriorityLevel);

      const priority = await priorityRepo.findOne({
        where: { id, orgId },
      });

      if (!priority) {
        return res.status(404).json({ error: 'Priority level not found' });
      }

      // Check for duplicate name if changing
      if (name && name !== priority.name) {
        const existingName = await priorityRepo.findOne({
          where: { orgId, name },
        });
        if (existingName) {
          return res.status(409).json({ error: 'A priority with this name already exists' });
        }
      }

      // If setting as default, clear other defaults
      if (isDefault && !priority.isDefault) {
        await priorityRepo.update(
          { orgId, isDefault: true },
          { isDefault: false }
        );
      }

      // Update fields
      if (name !== undefined) priority.name = name;
      if (description !== undefined) priority.description = description;
      if (color !== undefined) priority.color = color;
      if (urgency !== undefined) priority.urgency = urgency;
      if (autoEscalate !== undefined) priority.autoEscalate = autoEscalate;
      if (escalateAfterMinutes !== undefined) priority.escalateAfterMinutes = escalateAfterMinutes;
      if (isDefault !== undefined) priority.isDefault = isDefault;
      if (orderValue !== undefined) priority.orderValue = orderValue;

      await priorityRepo.save(priority);

      logger.info('Priority level updated', { priorityId: id, orgId });

      return res.json({
        priority: formatPriority(priority),
        message: 'Priority level updated successfully',
      });
    } catch (error) {
      logger.error('Error updating priority:', error);
      return res.status(500).json({ error: 'Failed to update priority level' });
    }
  }
);

/**
 * DELETE /api/v1/priorities/:id
 * Delete a priority level
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const currentUser = req.user!;

    // Only admins can delete priorities
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const dataSource = await getDataSource();
    const priorityRepo = dataSource.getRepository(PriorityLevel);

    const priority = await priorityRepo.findOne({
      where: { id, orgId },
    });

    if (!priority) {
      return res.status(404).json({ error: 'Priority level not found' });
    }

    await priorityRepo.remove(priority);

    logger.info('Priority level deleted', { priorityId: id, orgId });

    return res.json({ message: 'Priority level deleted successfully' });
  } catch (error) {
    logger.error('Error deleting priority:', error);
    return res.status(500).json({ error: 'Failed to delete priority level' });
  }
});

/**
 * PUT /api/v1/priorities/reorder
 * Reorder priority levels
 */
router.put(
  '/reorder',
  [
    body('priorityIds').isArray({ min: 1 }).withMessage('Priority IDs array is required'),
    body('priorityIds.*').isUUID().withMessage('All priority IDs must be valid UUIDs'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const currentUser = req.user!;
      const { priorityIds } = req.body;

      // Only admins can reorder priorities
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const dataSource = await getDataSource();
      const priorityRepo = dataSource.getRepository(PriorityLevel);

      // Update order for each priority
      for (let i = 0; i < priorityIds.length; i++) {
        await priorityRepo.update(
          { id: priorityIds[i], orgId },
          { orderValue: i }
        );
      }

      logger.info('Priorities reordered', { orgId, count: priorityIds.length });

      return res.json({ message: 'Priorities reordered successfully' });
    } catch (error) {
      logger.error('Error reordering priorities:', error);
      return res.status(500).json({ error: 'Failed to reorder priorities' });
    }
  }
);

/**
 * POST /api/v1/priorities/seed-defaults
 * Seed default priority levels for an organization
 */
router.post('/seed-defaults', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const currentUser = req.user!;

    // Only admins can seed defaults
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const dataSource = await getDataSource();
    const priorityRepo = dataSource.getRepository(PriorityLevel);

    // Check if any priorities already exist
    const existingCount = await priorityRepo.count({ where: { orgId } });
    if (existingCount > 0) {
      return res.status(409).json({
        error: 'Priorities already exist for this organization',
        existingCount,
      });
    }

    // Create default priorities
    const defaults = [
      { name: 'P1 - Critical', color: '#dc2626', urgency: 'high', autoEscalate: true, escalateAfterMinutes: 5 },
      { name: 'P2 - High', color: '#ea580c', urgency: 'high', autoEscalate: false, escalateAfterMinutes: 30 },
      { name: 'P3 - Medium', color: '#ca8a04', urgency: 'low', autoEscalate: false, escalateAfterMinutes: 60, isDefault: true },
      { name: 'P4 - Low', color: '#2563eb', urgency: 'low', autoEscalate: false, escalateAfterMinutes: 120 },
      { name: 'P5 - Informational', color: '#6b7280', urgency: 'low', autoEscalate: false, escalateAfterMinutes: 0 },
    ];

    const created = [];
    for (let i = 0; i < defaults.length; i++) {
      const def = defaults[i];
      const priority = priorityRepo.create({
        orgId,
        name: def.name,
        color: def.color,
        orderValue: i,
        urgency: def.urgency as 'high' | 'low',
        autoEscalate: def.autoEscalate,
        escalateAfterMinutes: def.escalateAfterMinutes,
        isDefault: (def as any).isDefault || false,
      });
      await priorityRepo.save(priority);
      created.push(priority);
    }

    logger.info('Default priorities seeded', { orgId, count: created.length });

    return res.status(201).json({
      message: 'Default priorities created successfully',
      priorities: created.map(formatPriority),
    });
  } catch (error) {
    logger.error('Error seeding priorities:', error);
    return res.status(500).json({ error: 'Failed to seed default priorities' });
  }
});

/**
 * Format priority for API response
 */
function formatPriority(priority: PriorityLevel) {
  return {
    id: priority.id,
    name: priority.name,
    description: priority.description,
    color: priority.color,
    orderValue: priority.orderValue,
    urgency: priority.urgency,
    autoEscalate: priority.autoEscalate,
    escalateAfterMinutes: priority.escalateAfterMinutes,
    isDefault: priority.isDefault,
    createdAt: priority.createdAt,
    updatedAt: priority.updatedAt,
  };
}

export default router;
