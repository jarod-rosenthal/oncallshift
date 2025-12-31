import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Service, Schedule, MaintenanceWindow, AlertGroupingRule, EventTransformRule } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { LessThanOrEqual, MoreThan } from 'typeorm';

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

// ==========================================
// Maintenance Window Endpoints
// ==========================================

/**
 * Format maintenance window for API response
 */
function formatMaintenanceWindow(mw: MaintenanceWindow) {
  return {
    id: mw.id,
    serviceId: mw.serviceId,
    startTime: mw.startTime,
    endTime: mw.endTime,
    description: mw.description,
    suppressAlerts: mw.suppressAlerts,
    createdBy: mw.createdBy,
    createdAt: mw.createdAt,
    updatedAt: mw.updatedAt,
    isActive: mw.isActive(),
    isFuture: mw.isFuture(),
    hasEnded: mw.hasEnded(),
    remainingTime: mw.getRemainingTime(),
    duration: mw.getDurationString(),
  };
}

/**
 * GET /api/v1/services/maintenance-windows/active
 * Get all active maintenance windows across all services in the org
 * NOTE: This route must be defined before /:id routes to avoid matching
 */
router.get('/maintenance-windows/active', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const now = new Date();

    const dataSource = await getDataSource();
    const mwRepo = dataSource.getRepository(MaintenanceWindow);

    const activeWindows = await mwRepo.find({
      where: {
        orgId,
        startTime: LessThanOrEqual(now),
        endTime: MoreThan(now),
      },
      relations: ['service'],
      order: { endTime: 'ASC' },
    });

    return res.json({
      maintenanceWindows: activeWindows.map(mw => ({
        ...formatMaintenanceWindow(mw),
        service: mw.service ? {
          id: mw.service.id,
          name: mw.service.name,
        } : null,
      })),
    });
  } catch (error) {
    logger.error('Error fetching active maintenance windows:', error);
    return res.status(500).json({ error: 'Failed to fetch active maintenance windows' });
  }
});

/**
 * GET /api/v1/services/:id/maintenance-windows
 * Get all maintenance windows for a service
 */
router.get('/:id/maintenance-windows', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const { status } = req.query; // 'active', 'upcoming', 'past', or undefined for all

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);
    const mwRepo = dataSource.getRepository(MaintenanceWindow);

    // Verify service exists and belongs to org
    const service = await serviceRepo.findOne({
      where: { id, orgId },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    let whereClause: any = { serviceId: id, orgId };
    const now = new Date();

    if (status === 'active') {
      whereClause = {
        ...whereClause,
        startTime: LessThanOrEqual(now),
        endTime: MoreThan(now),
      };
    } else if (status === 'upcoming') {
      whereClause = {
        ...whereClause,
        startTime: MoreThan(now),
      };
    } else if (status === 'past') {
      whereClause = {
        ...whereClause,
        endTime: LessThanOrEqual(now),
      };
    }

    const maintenanceWindows = await mwRepo.find({
      where: whereClause,
      order: { startTime: 'ASC' },
    });

    return res.json({
      maintenanceWindows: maintenanceWindows.map(formatMaintenanceWindow),
    });
  } catch (error) {
    logger.error('Error fetching maintenance windows:', error);
    return res.status(500).json({ error: 'Failed to fetch maintenance windows' });
  }
});

/**
 * GET /api/v1/services/:serviceId/maintenance-windows/:windowId
 * Get a single maintenance window
 */
router.get(
  '/:serviceId/maintenance-windows/:windowId',
  [
    param('serviceId').isUUID(),
    param('windowId').isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { serviceId, windowId } = req.params;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);
      const mwRepo = dataSource.getRepository(MaintenanceWindow);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id: serviceId, orgId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const maintenanceWindow = await mwRepo.findOne({
        where: { id: windowId, serviceId, orgId },
      });

      if (!maintenanceWindow) {
        return res.status(404).json({ error: 'Maintenance window not found' });
      }

      return res.json({
        maintenanceWindow: formatMaintenanceWindow(maintenanceWindow),
      });
    } catch (error) {
      logger.error('Error fetching maintenance window:', error);
      return res.status(500).json({ error: 'Failed to fetch maintenance window' });
    }
  }
);

/**
 * POST /api/v1/services/:id/maintenance-windows
 * Create a maintenance window for a service
 */
router.post(
  '/:id/maintenance-windows',
  [
    body('startTime').isISO8601().withMessage('Valid start time is required'),
    body('endTime').isISO8601().withMessage('Valid end time is required'),
    body('description').optional().isString(),
    body('suppressAlerts').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const userId = req.user!.id;
      const { startTime, endTime, description, suppressAlerts = true } = req.body;

      const start = new Date(startTime);
      const end = new Date(endTime);

      // Validate time range
      if (end <= start) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);
      const mwRepo = dataSource.getRepository(MaintenanceWindow);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id, orgId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      // Check for overlapping maintenance windows
      const overlapping = await mwRepo
        .createQueryBuilder('mw')
        .where('mw.serviceId = :serviceId', { serviceId: id })
        .andWhere('mw.startTime < :end', { end })
        .andWhere('mw.endTime > :start', { start })
        .getOne();

      if (overlapping) {
        return res.status(409).json({
          error: 'Maintenance window overlaps with existing window',
          overlappingWindow: formatMaintenanceWindow(overlapping),
        });
      }

      const maintenanceWindow = mwRepo.create({
        serviceId: id,
        orgId,
        startTime: start,
        endTime: end,
        description: description || null,
        suppressAlerts,
        createdBy: userId,
      });

      await mwRepo.save(maintenanceWindow);

      logger.info('Maintenance window created', {
        windowId: maintenanceWindow.id,
        serviceId: id,
        orgId,
        createdBy: userId,
      });

      return res.status(201).json({
        maintenanceWindow: formatMaintenanceWindow(maintenanceWindow),
        message: 'Maintenance window created successfully',
      });
    } catch (error) {
      logger.error('Error creating maintenance window:', error);
      return res.status(500).json({ error: 'Failed to create maintenance window' });
    }
  }
);

/**
 * PUT /api/v1/services/:serviceId/maintenance-windows/:windowId
 * Update a maintenance window
 */
router.put(
  '/:serviceId/maintenance-windows/:windowId',
  [
    param('serviceId').isUUID(),
    param('windowId').isUUID(),
    body('startTime').optional().isISO8601(),
    body('endTime').optional().isISO8601(),
    body('description').optional().isString(),
    body('suppressAlerts').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { serviceId, windowId } = req.params;
      const orgId = req.orgId!;
      const { startTime, endTime, description, suppressAlerts } = req.body;

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);
      const mwRepo = dataSource.getRepository(MaintenanceWindow);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id: serviceId, orgId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const maintenanceWindow = await mwRepo.findOne({
        where: { id: windowId, serviceId, orgId },
      });

      if (!maintenanceWindow) {
        return res.status(404).json({ error: 'Maintenance window not found' });
      }

      // Calculate new times
      const newStart = startTime ? new Date(startTime) : maintenanceWindow.startTime;
      const newEnd = endTime ? new Date(endTime) : maintenanceWindow.endTime;

      // Validate time range
      if (newEnd <= newStart) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }

      // Check for overlapping maintenance windows (excluding current)
      const overlapping = await mwRepo
        .createQueryBuilder('mw')
        .where('mw.serviceId = :serviceId', { serviceId })
        .andWhere('mw.id != :windowId', { windowId })
        .andWhere('mw.startTime < :end', { end: newEnd })
        .andWhere('mw.endTime > :start', { start: newStart })
        .getOne();

      if (overlapping) {
        return res.status(409).json({
          error: 'Updated maintenance window would overlap with existing window',
          overlappingWindow: formatMaintenanceWindow(overlapping),
        });
      }

      // Update fields
      if (startTime !== undefined) maintenanceWindow.startTime = newStart;
      if (endTime !== undefined) maintenanceWindow.endTime = newEnd;
      if (description !== undefined) maintenanceWindow.description = description;
      if (suppressAlerts !== undefined) maintenanceWindow.suppressAlerts = suppressAlerts;

      await mwRepo.save(maintenanceWindow);

      logger.info('Maintenance window updated', {
        windowId,
        serviceId,
        orgId,
      });

      return res.json({
        maintenanceWindow: formatMaintenanceWindow(maintenanceWindow),
        message: 'Maintenance window updated successfully',
      });
    } catch (error) {
      logger.error('Error updating maintenance window:', error);
      return res.status(500).json({ error: 'Failed to update maintenance window' });
    }
  }
);

/**
 * DELETE /api/v1/services/:serviceId/maintenance-windows/:windowId
 * Delete a maintenance window
 */
router.delete(
  '/:serviceId/maintenance-windows/:windowId',
  [
    param('serviceId').isUUID(),
    param('windowId').isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { serviceId, windowId } = req.params;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);
      const mwRepo = dataSource.getRepository(MaintenanceWindow);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id: serviceId, orgId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const maintenanceWindow = await mwRepo.findOne({
        where: { id: windowId, serviceId, orgId },
      });

      if (!maintenanceWindow) {
        return res.status(404).json({ error: 'Maintenance window not found' });
      }

      await mwRepo.remove(maintenanceWindow);

      logger.info('Maintenance window deleted', {
        windowId,
        serviceId,
        orgId,
      });

      return res.json({
        message: 'Maintenance window deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting maintenance window:', error);
      return res.status(500).json({ error: 'Failed to delete maintenance window' });
    }
  }
);

// ==========================================
// Alert Grouping Rule Endpoints
// ==========================================

/**
 * Format alert grouping rule for API response
 */
function formatGroupingRule(rule: AlertGroupingRule) {
  return {
    id: rule.id,
    serviceId: rule.serviceId,
    groupingType: rule.groupingType,
    timeWindowMinutes: rule.timeWindowMinutes,
    contentFields: rule.contentFields,
    dedupKeyTemplate: rule.dedupKeyTemplate,
    maxAlertsPerIncident: rule.maxAlertsPerIncident,
    description: rule.getDescription(),
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

/**
 * GET /api/v1/services/:id/grouping-rule
 * Get alert grouping rule for a service
 */
router.get('/:id/grouping-rule', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);
    const groupingRepo = dataSource.getRepository(AlertGroupingRule);

    // Verify service exists and belongs to org
    const service = await serviceRepo.findOne({
      where: { id, orgId },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const groupingRule = await groupingRepo.findOne({
      where: { serviceId: id },
    });

    if (!groupingRule) {
      // Return default configuration if no rule exists
      return res.json({
        groupingRule: null,
        defaults: {
          groupingType: 'intelligent',
          timeWindowMinutes: 5,
          contentFields: [],
          maxAlertsPerIncident: 1000,
        },
      });
    }

    return res.json({
      groupingRule: formatGroupingRule(groupingRule),
    });
  } catch (error) {
    logger.error('Error fetching grouping rule:', error);
    return res.status(500).json({ error: 'Failed to fetch grouping rule' });
  }
});

/**
 * PUT /api/v1/services/:id/grouping-rule
 * Create or update alert grouping rule for a service
 */
router.put(
  '/:id/grouping-rule',
  [
    body('groupingType').optional().isIn(['intelligent', 'time', 'content', 'disabled']).withMessage('Invalid grouping type'),
    body('timeWindowMinutes').optional().isInt({ min: 1, max: 1440 }).withMessage('Time window must be 1-1440 minutes'),
    body('contentFields').optional().isArray().withMessage('Content fields must be an array'),
    body('contentFields.*').optional().isString().withMessage('Content fields must be strings'),
    body('dedupKeyTemplate').optional({ nullable: true }).isString().withMessage('Dedup key template must be a string'),
    body('maxAlertsPerIncident').optional().isInt({ min: 1, max: 10000 }).withMessage('Max alerts must be 1-10000'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const {
        groupingType,
        timeWindowMinutes,
        contentFields,
        dedupKeyTemplate,
        maxAlertsPerIncident,
      } = req.body;

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);
      const groupingRepo = dataSource.getRepository(AlertGroupingRule);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id, orgId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      // Find or create grouping rule
      let groupingRule = await groupingRepo.findOne({
        where: { serviceId: id },
      });

      if (!groupingRule) {
        groupingRule = groupingRepo.create({
          serviceId: id,
        });
      }

      // Update fields
      if (groupingType !== undefined) groupingRule.groupingType = groupingType;
      if (timeWindowMinutes !== undefined) groupingRule.timeWindowMinutes = timeWindowMinutes;
      if (contentFields !== undefined) groupingRule.contentFields = contentFields;
      if (dedupKeyTemplate !== undefined) groupingRule.dedupKeyTemplate = dedupKeyTemplate;
      if (maxAlertsPerIncident !== undefined) groupingRule.maxAlertsPerIncident = maxAlertsPerIncident;

      await groupingRepo.save(groupingRule);

      logger.info('Alert grouping rule updated', {
        serviceId: id,
        orgId,
        groupingType: groupingRule.groupingType,
      });

      return res.json({
        groupingRule: formatGroupingRule(groupingRule),
        message: 'Grouping rule updated successfully',
      });
    } catch (error) {
      logger.error('Error updating grouping rule:', error);
      return res.status(500).json({ error: 'Failed to update grouping rule' });
    }
  }
);

/**
 * DELETE /api/v1/services/:id/grouping-rule
 * Delete alert grouping rule for a service (reverts to defaults)
 */
router.delete('/:id/grouping-rule', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);
    const groupingRepo = dataSource.getRepository(AlertGroupingRule);

    // Verify service exists and belongs to org
    const service = await serviceRepo.findOne({
      where: { id, orgId },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const groupingRule = await groupingRepo.findOne({
      where: { serviceId: id },
    });

    if (!groupingRule) {
      return res.status(404).json({ error: 'No grouping rule configured for this service' });
    }

    await groupingRepo.remove(groupingRule);

    logger.info('Alert grouping rule deleted', {
      serviceId: id,
      orgId,
    });

    return res.json({
      message: 'Grouping rule deleted successfully. Service will use default grouping.',
    });
  } catch (error) {
    logger.error('Error deleting grouping rule:', error);
    return res.status(500).json({ error: 'Failed to delete grouping rule' });
  }
});

// ==========================================
// Event Transform Rule Endpoints
// ==========================================

/**
 * Format event transform rule for API response
 */
function formatTransformRule(rule: EventTransformRule) {
  return {
    id: rule.id,
    serviceId: rule.serviceId,
    name: rule.name,
    description: rule.description,
    ruleOrder: rule.ruleOrder,
    enabled: rule.enabled,
    conditions: rule.conditions,
    matchType: rule.matchType,
    transformations: rule.transformations,
    action: rule.action,
    routeToServiceId: rule.routeToServiceId,
    routeToService: rule.routeToService ? {
      id: rule.routeToService.id,
      name: rule.routeToService.name,
    } : null,
    eventsMatched: rule.eventsMatched,
    lastMatchedAt: rule.lastMatchedAt,
    createdBy: rule.createdBy,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

/**
 * GET /api/v1/services/:id/event-rules
 * Get all event transform rules for a service
 */
router.get('/:id/event-rules', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);
    const ruleRepo = dataSource.getRepository(EventTransformRule);

    // Verify service exists and belongs to org
    const service = await serviceRepo.findOne({
      where: { id, orgId },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const rules = await ruleRepo.find({
      where: { serviceId: id },
      relations: ['routeToService'],
      order: { ruleOrder: 'ASC' },
    });

    return res.json({
      rules: rules.map(formatTransformRule),
    });
  } catch (error) {
    logger.error('Error fetching event transform rules:', error);
    return res.status(500).json({ error: 'Failed to fetch event transform rules' });
  }
});

/**
 * GET /api/v1/services/:serviceId/event-rules/:ruleId
 * Get a single event transform rule
 */
router.get(
  '/:serviceId/event-rules/:ruleId',
  [
    param('serviceId').isUUID(),
    param('ruleId').isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { serviceId, ruleId } = req.params;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);
      const ruleRepo = dataSource.getRepository(EventTransformRule);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id: serviceId, orgId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const rule = await ruleRepo.findOne({
        where: { id: ruleId, serviceId },
        relations: ['routeToService'],
      });

      if (!rule) {
        return res.status(404).json({ error: 'Event transform rule not found' });
      }

      return res.json({
        rule: formatTransformRule(rule),
      });
    } catch (error) {
      logger.error('Error fetching event transform rule:', error);
      return res.status(500).json({ error: 'Failed to fetch event transform rule' });
    }
  }
);

/**
 * POST /api/v1/services/:id/event-rules
 * Create an event transform rule for a service
 */
router.post(
  '/:id/event-rules',
  [
    body('name').isString().trim().notEmpty().isLength({ max: 255 }).withMessage('Name is required'),
    body('description').optional({ nullable: true }).isString(),
    body('enabled').optional().isBoolean(),
    body('conditions').optional().isArray(),
    body('matchType').optional().isIn(['all', 'any']),
    body('transformations').optional().isArray(),
    body('action').optional().isIn(['continue', 'suppress', 'route']),
    body('routeToServiceId').optional({ nullable: true }).isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const userId = req.user!.id;
      const {
        name,
        description,
        enabled = true,
        conditions = [],
        matchType = 'all',
        transformations = [],
        action = 'continue',
        routeToServiceId,
      } = req.body;

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);
      const ruleRepo = dataSource.getRepository(EventTransformRule);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id, orgId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      // Validate route-to service if provided
      if (action === 'route' && routeToServiceId) {
        const routeToService = await serviceRepo.findOne({
          where: { id: routeToServiceId, orgId },
        });
        if (!routeToService) {
          return res.status(400).json({ error: 'Route-to service not found' });
        }
      }

      // Get max rule order
      const maxOrderResult = await ruleRepo
        .createQueryBuilder('rule')
        .select('MAX(rule.ruleOrder)', 'maxOrder')
        .where('rule.serviceId = :serviceId', { serviceId: id })
        .getRawOne();

      const ruleOrder = (maxOrderResult?.maxOrder ?? -1) + 1;

      const rule = ruleRepo.create({
        orgId,
        serviceId: id,
        name,
        description: description || null,
        ruleOrder,
        enabled,
        conditions,
        matchType,
        transformations,
        action,
        routeToServiceId: action === 'route' ? routeToServiceId : null,
        createdBy: userId,
      });

      await ruleRepo.save(rule);

      // Reload with relations
      const createdRule = await ruleRepo.findOne({
        where: { id: rule.id },
        relations: ['routeToService'],
      });

      logger.info('Event transform rule created', {
        ruleId: rule.id,
        serviceId: id,
        orgId,
        createdBy: userId,
      });

      return res.status(201).json({
        rule: formatTransformRule(createdRule!),
        message: 'Event transform rule created successfully',
      });
    } catch (error) {
      logger.error('Error creating event transform rule:', error);
      return res.status(500).json({ error: 'Failed to create event transform rule' });
    }
  }
);

/**
 * PUT /api/v1/services/:serviceId/event-rules/:ruleId
 * Update an event transform rule
 */
router.put(
  '/:serviceId/event-rules/:ruleId',
  [
    param('serviceId').isUUID(),
    param('ruleId').isUUID(),
    body('name').optional().isString().trim().notEmpty().isLength({ max: 255 }),
    body('description').optional({ nullable: true }).isString(),
    body('enabled').optional().isBoolean(),
    body('conditions').optional().isArray(),
    body('matchType').optional().isIn(['all', 'any']),
    body('transformations').optional().isArray(),
    body('action').optional().isIn(['continue', 'suppress', 'route']),
    body('routeToServiceId').optional({ nullable: true }).isUUID(),
    body('ruleOrder').optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { serviceId, ruleId } = req.params;
      const orgId = req.orgId!;
      const {
        name,
        description,
        enabled,
        conditions,
        matchType,
        transformations,
        action,
        routeToServiceId,
        ruleOrder,
      } = req.body;

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);
      const ruleRepo = dataSource.getRepository(EventTransformRule);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id: serviceId, orgId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const rule = await ruleRepo.findOne({
        where: { id: ruleId, serviceId },
      });

      if (!rule) {
        return res.status(404).json({ error: 'Event transform rule not found' });
      }

      // Validate route-to service if provided
      const newAction = action ?? rule.action;
      const newRouteToServiceId = routeToServiceId !== undefined ? routeToServiceId : rule.routeToServiceId;
      if (newAction === 'route' && newRouteToServiceId) {
        const routeToService = await serviceRepo.findOne({
          where: { id: newRouteToServiceId, orgId },
        });
        if (!routeToService) {
          return res.status(400).json({ error: 'Route-to service not found' });
        }
      }

      // Update fields
      if (name !== undefined) rule.name = name;
      if (description !== undefined) rule.description = description;
      if (enabled !== undefined) rule.enabled = enabled;
      if (conditions !== undefined) rule.conditions = conditions;
      if (matchType !== undefined) rule.matchType = matchType;
      if (transformations !== undefined) rule.transformations = transformations;
      if (action !== undefined) rule.action = action;
      if (routeToServiceId !== undefined) {
        rule.routeToServiceId = action === 'route' ? routeToServiceId : null;
      }
      if (ruleOrder !== undefined) rule.ruleOrder = ruleOrder;

      await ruleRepo.save(rule);

      // Reload with relations
      const updatedRule = await ruleRepo.findOne({
        where: { id: ruleId },
        relations: ['routeToService'],
      });

      logger.info('Event transform rule updated', {
        ruleId,
        serviceId,
        orgId,
      });

      return res.json({
        rule: formatTransformRule(updatedRule!),
        message: 'Event transform rule updated successfully',
      });
    } catch (error) {
      logger.error('Error updating event transform rule:', error);
      return res.status(500).json({ error: 'Failed to update event transform rule' });
    }
  }
);

/**
 * DELETE /api/v1/services/:serviceId/event-rules/:ruleId
 * Delete an event transform rule
 */
router.delete(
  '/:serviceId/event-rules/:ruleId',
  [
    param('serviceId').isUUID(),
    param('ruleId').isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { serviceId, ruleId } = req.params;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);
      const ruleRepo = dataSource.getRepository(EventTransformRule);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id: serviceId, orgId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const rule = await ruleRepo.findOne({
        where: { id: ruleId, serviceId },
      });

      if (!rule) {
        return res.status(404).json({ error: 'Event transform rule not found' });
      }

      await ruleRepo.remove(rule);

      logger.info('Event transform rule deleted', {
        ruleId,
        serviceId,
        orgId,
      });

      return res.json({
        message: 'Event transform rule deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting event transform rule:', error);
      return res.status(500).json({ error: 'Failed to delete event transform rule' });
    }
  }
);

/**
 * PUT /api/v1/services/:serviceId/event-rules/reorder
 * Reorder event transform rules
 */
router.put(
  '/:serviceId/event-rules/reorder',
  [
    param('serviceId').isUUID(),
    body('ruleIds').isArray().withMessage('ruleIds must be an array'),
    body('ruleIds.*').isUUID().withMessage('Each rule ID must be a valid UUID'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { serviceId } = req.params;
      const { ruleIds } = req.body;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id: serviceId, orgId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      // Update rule orders
      await dataSource.transaction(async (manager) => {
        for (let i = 0; i < ruleIds.length; i++) {
          await manager.update(EventTransformRule, { id: ruleIds[i], serviceId }, { ruleOrder: i });
        }
      });

      logger.info('Event transform rules reordered', {
        serviceId,
        orgId,
        ruleCount: ruleIds.length,
      });

      return res.json({
        message: 'Event transform rules reordered successfully',
      });
    } catch (error) {
      logger.error('Error reordering event transform rules:', error);
      return res.status(500).json({ error: 'Failed to reorder event transform rules' });
    }
  }
);

/**
 * POST /api/v1/services/:serviceId/event-rules/:ruleId/test
 * Test an event transform rule against a sample payload
 */
router.post(
  '/:serviceId/event-rules/:ruleId/test',
  [
    param('serviceId').isUUID(),
    param('ruleId').isUUID(),
    body('payload').isObject().withMessage('Payload must be an object'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { serviceId, ruleId } = req.params;
      const { payload } = req.body;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);
      const ruleRepo = dataSource.getRepository(EventTransformRule);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id: serviceId, orgId },
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const rule = await ruleRepo.findOne({
        where: { id: ruleId, serviceId },
        relations: ['routeToService'],
      });

      if (!rule) {
        return res.status(404).json({ error: 'Event transform rule not found' });
      }

      // Evaluate rule
      const matches = rule.evaluate(payload);
      let transformedPayload = payload;

      if (matches) {
        transformedPayload = rule.applyTransformations({ ...payload });
      }

      return res.json({
        matches,
        action: matches ? rule.action : null,
        routeToService: matches && rule.action === 'route' && rule.routeToService ? {
          id: rule.routeToService.id,
          name: rule.routeToService.name,
        } : null,
        originalPayload: payload,
        transformedPayload: matches ? transformedPayload : null,
      });
    } catch (error) {
      logger.error('Error testing event transform rule:', error);
      return res.status(500).json({ error: 'Failed to test event transform rule' });
    }
  }
);

export default router;
