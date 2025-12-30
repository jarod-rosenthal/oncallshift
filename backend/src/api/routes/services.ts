import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Service, Schedule } from '../../shared/models';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/services
 * Get all services for the authenticated user's organization
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    const services = await serviceRepo.find({
      where: { orgId },
      relations: ['schedule', 'escalationPolicy'],
      order: { name: 'ASC' },
    });

    return res.json({
      services: services.map(formatService),
    });
  } catch (error) {
    logger.error('Error fetching services:', error);
    return res.status(500).json({ error: 'Failed to fetch services' });
  }
});

/**
 * GET /api/v1/services/:id
 * Get a single service by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    const service = await serviceRepo.findOne({
      where: { id, orgId },
      relations: ['schedule', 'escalationPolicy'],
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    return res.json({ service: formatService(service) });
  } catch (error) {
    logger.error('Error fetching service:', error);
    return res.status(500).json({ error: 'Failed to fetch service' });
  }
});

/**
 * PUT /api/v1/services/:id
 * Update a service (including schedule assignment)
 */
router.put(
  '/:id',
  [
    body('name').optional().isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('scheduleId').optional({ nullable: true }).custom((value) => {
      // Allow null, undefined, empty string (to clear), or valid UUID format
      if (value === null || value === undefined || value === '') return true;
      // Relaxed UUID format check (8-4-4-4-12 hex chars)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) throw new Error('Valid schedule ID required');
      return true;
    }),
    body('escalationPolicyId').optional({ nullable: true }).custom((value) => {
      // Allow null, undefined, empty string (to clear), or valid UUID format
      if (value === null || value === undefined || value === '') return true;
      // Relaxed UUID format check (8-4-4-4-12 hex chars)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) throw new Error('Valid escalation policy ID required');
      return true;
    }),
    body('status').optional().isIn(['active', 'inactive', 'maintenance']),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      let { name, description, scheduleId, escalationPolicyId, status } = req.body;

      // Convert empty strings to null for clearing associations
      if (scheduleId === '') scheduleId = null;
      if (escalationPolicyId === '') escalationPolicyId = null;

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);
      const scheduleRepo = dataSource.getRepository(Schedule);

      const service = await serviceRepo.findOne({
        where: { id, orgId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      // Verify schedule belongs to same org if provided
      if (scheduleId) {
        const schedule = await scheduleRepo.findOne({
          where: { id: scheduleId, orgId },
        });
        if (!schedule) {
          return res.status(400).json({ error: 'Schedule not found or does not belong to your organization' });
        }
      }

      // Update fields
      if (name !== undefined) service.name = name;
      if (description !== undefined) service.description = description;
      if (scheduleId !== undefined) service.scheduleId = scheduleId;
      if (escalationPolicyId !== undefined) service.escalationPolicyId = escalationPolicyId;
      if (status !== undefined) service.status = status;

      await serviceRepo.save(service);

      // Fetch updated service with relations
      const updatedService = await serviceRepo.findOne({
        where: { id },
        relations: ['schedule', 'escalationPolicy'],
      });

      logger.info('Service updated', { serviceId: id, orgId });

      return res.json({
        service: formatService(updatedService!),
        message: 'Service updated successfully',
      });
    } catch (error) {
      logger.error('Error updating service:', error);
      return res.status(500).json({ error: 'Failed to update service' });
    }
  }
);

/**
 * POST /api/v1/services
 * Create a new service
 */
router.post(
  '/',
  [
    body('name').isString().trim().notEmpty().withMessage('Service name is required'),
    body('description').optional().isString(),
    body('scheduleId').optional().isUUID(),
    body('escalationPolicyId').optional().isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { name, description, scheduleId, escalationPolicyId } = req.body;

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);

      const service = serviceRepo.create({
        orgId,
        name,
        description,
        scheduleId: scheduleId || null,
        escalationPolicyId: escalationPolicyId || null,
        status: 'active',
      });

      await serviceRepo.save(service);

      // Fetch with relations
      const createdService = await serviceRepo.findOne({
        where: { id: service.id },
        relations: ['schedule', 'escalationPolicy'],
      });

      logger.info('Service created', { serviceId: service.id, orgId });

      return res.status(201).json({
        service: formatService(createdService!),
        message: 'Service created successfully',
      });
    } catch (error) {
      logger.error('Error creating service:', error);
      return res.status(500).json({ error: 'Failed to create service' });
    }
  }
);

/**
 * POST /api/v1/services/:id/regenerate-key
 * Regenerate API key for a service (admin-only)
 */
router.post('/:id/regenerate-key', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const currentUser = req.user!;

    // Only admins can regenerate API keys
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    const service = await serviceRepo.findOne({
      where: { id, orgId },
      relations: ['schedule', 'escalationPolicy'],
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Generate new API key
    const newApiKey = `svc_${uuidv4().replace(/-/g, '')}`;
    service.apiKey = newApiKey;
    await serviceRepo.save(service);

    logger.info('Service API key regenerated', { serviceId: id, orgId, regeneratedBy: currentUser.id });

    return res.json({
      message: 'API key regenerated successfully',
      service: formatService(service),
    });
  } catch (error) {
    logger.error('Error regenerating API key:', error);
    return res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

/**
 * DELETE /api/v1/services/:id
 * Delete a service (soft delete - sets status to inactive) (admin-only)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const currentUser = req.user!;

    // Only admins can delete services
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    const service = await serviceRepo.findOne({
      where: { id, orgId },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Soft delete - set status to inactive
    service.status = 'inactive';
    await serviceRepo.save(service);

    logger.info('Service deleted (soft)', { serviceId: id, orgId, deletedBy: currentUser.id });

    return res.json({
      message: 'Service deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting service:', error);
    return res.status(500).json({ error: 'Failed to delete service' });
  }
});

/**
 * Format service for API response
 */
function formatService(service: Service) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    apiKey: service.apiKey,
    status: service.status,
    schedule: service.schedule ? {
      id: service.schedule.id,
      name: service.schedule.name,
    } : null,
    escalationPolicy: service.escalationPolicy ? {
      id: service.escalationPolicy.id,
      name: service.escalationPolicy.name,
    } : null,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}

export default router;
