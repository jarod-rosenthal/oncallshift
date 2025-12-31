import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Runbook, Service } from '../../shared/models';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/runbooks
 * Get all runbooks for the organization
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const runbookRepo = dataSource.getRepository(Runbook);

    const runbooks = await runbookRepo.find({
      where: { orgId, isActive: true },
      relations: ['service', 'createdBy'],
      order: { createdAt: 'DESC' },
    });

    return res.json({
      runbooks: runbooks.map(formatRunbook),
    });
  } catch (error) {
    logger.error('Error fetching runbooks:', error);
    return res.status(500).json({ error: 'Failed to fetch runbooks' });
  }
});

/**
 * GET /api/v1/services/:serviceId/runbooks
 * Get runbooks for a specific service
 */
router.get('/service/:serviceId', async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const runbookRepo = dataSource.getRepository(Runbook);
    const serviceRepo = dataSource.getRepository(Service);

    // Verify service exists and belongs to org
    const service = await serviceRepo.findOne({
      where: { id: serviceId, orgId },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const runbooks = await runbookRepo.find({
      where: { serviceId, orgId, isActive: true },
      relations: ['service', 'createdBy'],
      order: { createdAt: 'DESC' },
    });

    return res.json({
      runbooks: runbooks.map(formatRunbook),
    });
  } catch (error) {
    logger.error('Error fetching runbooks for service:', error);
    return res.status(500).json({ error: 'Failed to fetch runbooks' });
  }
});

/**
 * GET /api/v1/runbooks/:id
 * Get a single runbook by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const runbookRepo = dataSource.getRepository(Runbook);

    const runbook = await runbookRepo.findOne({
      where: { id, orgId },
      relations: ['service', 'createdBy'],
    });

    if (!runbook) {
      return res.status(404).json({ error: 'Runbook not found' });
    }

    return res.json({ runbook: formatRunbook(runbook) });
  } catch (error) {
    logger.error('Error fetching runbook:', error);
    return res.status(500).json({ error: 'Failed to fetch runbook' });
  }
});

/**
 * POST /api/v1/runbooks
 * Create a new runbook (admin only)
 */
router.post(
  '/',
  [
    body('serviceId').isUUID().withMessage('Valid service ID is required'),
    body('title').isString().trim().notEmpty().withMessage('Title is required'),
    body('description').optional().isString(),
    body('steps').isArray().withMessage('Steps must be an array'),
    body('steps.*.id').isString().notEmpty(),
    body('steps.*.order').isInt({ min: 0 }),
    body('steps.*.title').isString().notEmpty(),
    body('steps.*.description').isString(),
    body('steps.*.isOptional').isBoolean(),
    body('steps.*.estimatedMinutes').optional().isInt({ min: 0 }),
    body('severity').optional().isArray(),
    body('tags').optional().isArray(),
    body('externalUrl').optional().isURL().withMessage('External URL must be a valid URL'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Only admins can create runbooks
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const { serviceId, title, description, steps, severity, tags, externalUrl } = req.body;

      const dataSource = await getDataSource();
      const runbookRepo = dataSource.getRepository(Runbook);
      const serviceRepo = dataSource.getRepository(Service);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id: serviceId, orgId },
      });

      if (!service) {
        return res.status(400).json({ error: 'Service not found or does not belong to your organization' });
      }

      const runbook = runbookRepo.create({
        orgId,
        serviceId,
        title,
        description: description || null,
        steps: steps || [],
        severity: severity || [],
        tags: tags || [],
        externalUrl: externalUrl || null,
        createdById: userId,
        isActive: true,
      });

      await runbookRepo.save(runbook);

      // Fetch with relations
      const createdRunbook = await runbookRepo.findOne({
        where: { id: runbook.id },
        relations: ['service', 'createdBy'],
      });

      logger.info('Runbook created', { runbookId: runbook.id, serviceId, orgId, createdBy: userId });

      return res.status(201).json({
        runbook: formatRunbook(createdRunbook!),
        message: 'Runbook created successfully',
      });
    } catch (error) {
      logger.error('Error creating runbook:', error);
      return res.status(500).json({ error: 'Failed to create runbook' });
    }
  }
);

/**
 * PUT /api/v1/runbooks/:id
 * Update a runbook (admin only)
 */
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('title').optional().isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('steps').optional().isArray(),
    body('severity').optional().isArray(),
    body('tags').optional().isArray(),
    body('externalUrl').optional({ nullable: true }).custom((value) => {
      if (value === null || value === '') return true;
      // Basic URL validation
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('External URL must be a valid URL');
      }
    }),
  ],
  async (req: Request, res: Response) => {
    try {
      // Only admins can update runbooks
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { title, description, steps, severity, tags, externalUrl } = req.body;

      const dataSource = await getDataSource();
      const runbookRepo = dataSource.getRepository(Runbook);

      const runbook = await runbookRepo.findOne({
        where: { id, orgId },
      });

      if (!runbook) {
        return res.status(404).json({ error: 'Runbook not found' });
      }

      // Update fields
      if (title !== undefined) runbook.title = title;
      if (description !== undefined) runbook.description = description || null;
      if (steps !== undefined) runbook.steps = steps;
      if (severity !== undefined) runbook.severity = severity;
      if (tags !== undefined) runbook.tags = tags;
      if (externalUrl !== undefined) runbook.externalUrl = externalUrl || null;

      await runbookRepo.save(runbook);

      // Fetch with relations
      const updatedRunbook = await runbookRepo.findOne({
        where: { id },
        relations: ['service', 'createdBy'],
      });

      logger.info('Runbook updated', { runbookId: id, orgId, updatedBy: req.user!.id });

      return res.json({
        runbook: formatRunbook(updatedRunbook!),
        message: 'Runbook updated successfully',
      });
    } catch (error) {
      logger.error('Error updating runbook:', error);
      return res.status(500).json({ error: 'Failed to update runbook' });
    }
  }
);

/**
 * DELETE /api/v1/runbooks/:id
 * Soft delete a runbook (admin only)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Only admins can delete runbooks
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const runbookRepo = dataSource.getRepository(Runbook);

    const runbook = await runbookRepo.findOne({
      where: { id, orgId },
    });

    if (!runbook) {
      return res.status(404).json({ error: 'Runbook not found' });
    }

    // Soft delete
    runbook.isActive = false;
    await runbookRepo.save(runbook);

    logger.info('Runbook deleted (soft)', { runbookId: id, orgId, deletedBy: req.user!.id });

    return res.json({ message: 'Runbook deleted successfully' });
  } catch (error) {
    logger.error('Error deleting runbook:', error);
    return res.status(500).json({ error: 'Failed to delete runbook' });
  }
});

/**
 * Format runbook for API response
 */
function formatRunbook(runbook: Runbook) {
  return {
    id: runbook.id,
    serviceId: runbook.serviceId,
    service: runbook.service ? {
      id: runbook.service.id,
      name: runbook.service.name,
    } : null,
    title: runbook.title,
    description: runbook.description,
    steps: runbook.steps,
    severity: runbook.severity,
    tags: runbook.tags,
    externalUrl: runbook.externalUrl,
    createdBy: runbook.createdBy ? {
      id: runbook.createdBy.id,
      fullName: runbook.createdBy.fullName,
      email: runbook.createdBy.email,
    } : null,
    isActive: runbook.isActive,
    createdAt: runbook.createdAt,
    updatedAt: runbook.updatedAt,
  };
}

export default router;
