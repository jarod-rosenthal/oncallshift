import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { authenticateRequest } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Service, Schedule, MaintenanceWindow, AlertGroupingRule, EventTransformRule } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { generateEntityETag } from '../../shared/utils/etag';
import { checkETagAndRespond } from '../../shared/middleware/etag';
import { LessThanOrEqual, MoreThan } from 'typeorm';
import { setLocationHeader } from '../../shared/utils/location-header';
import { parsePaginationParams, paginatedResponse, validateSortField } from '../../shared/utils/pagination';
import { parseServiceFilters, applyServiceFilters } from '../../shared/utils/filtering';
import { serviceFilterValidators } from '../../shared/validators/pagination';
import { notFound, badRequest, internalError } from '../../shared/utils/problem-details';

const router = Router();

// All routes require authentication (supports JWT, service API key, and org API key)
router.use(authenticateRequest);

/**
 * @swagger
 * /api/v1/services:
 *   get:
 *     summary: List all services
 *     description: Retrieves all services in the authenticated user's organization with pagination and filtering.
 *     tags: [Services]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 25
 *         description: Maximum number of services to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Number of services to skip for pagination
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, createdAt, status]
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search services by name or description
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, warning, critical, maintenance]
 *         description: Filter by service status
 *       - in: query
 *         name: team_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by team ID
 *     responses:
 *       200:
 *         description: List of services retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Service'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', [...serviceFilterValidators], async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const pagination = parsePaginationParams(req.query);
    const filters = parseServiceFilters(req.query);

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    // Build query with filters
    const queryBuilder = serviceRepo
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.schedule', 'schedule')
      .leftJoinAndSelect('service.escalationPolicy', 'escalationPolicy')
      .where('service.org_id = :orgId', { orgId });

    // Apply service filters (search, status, teamId)
    applyServiceFilters(queryBuilder, filters, 'service');

    // Get valid sort field and apply sorting
    const sortField = validateSortField('services', pagination.sort, 'name');
    const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';

    // Map camelCase to snake_case for sorting
    const snakeCaseSortField = sortField === 'createdAt' ? 'created_at' : sortField;
    queryBuilder.orderBy(`service.${snakeCaseSortField}`, sortOrder);

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(pagination.offset).take(pagination.limit);

    const services = await queryBuilder.getMany();

    const formattedServices = services.map(formatService);

    const lastItem = services[services.length - 1];
    return res.json(paginatedResponse(formattedServices, total, pagination, lastItem, 'services'));
  } catch (error) {
    logger.error('Error fetching services:', error);
    return internalError(res, 'Failed to fetch services');
  }
});

/**
 * @swagger
 * /api/v1/services/{id}:
 *   get:
 *     summary: Get a service by ID
 *     description: Retrieves a specific service with its associated schedule and escalation policy.
 *     tags: [Services]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     responses:
 *       200:
 *         description: Service retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   $ref: '#/components/schemas/Service'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
      return notFound(res, 'Service', id);
    }

    // Generate ETag from service ID and updatedAt timestamp
    const etag = generateEntityETag(service.id, service.updatedAt);

    // Check If-None-Match - return 304 if client's cached version is current
    if (checkETagAndRespond(req, res, etag)) {
      return; // 304 was sent
    }

    return res.json({ service: formatService(service) });
  } catch (error) {
    logger.error('Error fetching service:', error);
    return internalError(res, 'Failed to fetch service');
  }
});

/**
 * @swagger
 * /api/v1/services/{id}:
 *   put:
 *     summary: Update a service
 *     description: Updates an existing service including schedule and escalation policy assignments.
 *     tags: [Services]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceUpdate'
 *     responses:
 *       200:
 *         description: Service updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   $ref: '#/components/schemas/Service'
 *                 message:
 *                   type: string
 *                   example: Service updated successfully
 *       400:
 *         description: Validation error or invalid schedule/escalation policy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
        return notFound(res, 'Service', id);
      }

      // Verify schedule belongs to same org if provided
      if (scheduleId) {
        const schedule = await scheduleRepo.findOne({
          where: { id: scheduleId, orgId },
        });
        if (!schedule) {
          return badRequest(res, 'Schedule not found or does not belong to your organization');
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
      return internalError(res, 'Failed to update service');
    }
  }
);

/**
 * @swagger
 * /api/v1/services:
 *   post:
 *     summary: Create a new service
 *     description: Creates a new service in the organization.
 *     tags: [Services]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceCreate'
 *     responses:
 *       201:
 *         description: Service created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   $ref: '#/components/schemas/Service'
 *                 message:
 *                   type: string
 *                   example: Service created successfully
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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

      setLocationHeader(res, req, '/api/v1/services', service.id);
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
 * @swagger
 * /api/v1/services/{id}/regenerate-key:
 *   post:
 *     summary: Regenerate service API key
 *     description: Regenerates the API key for a service. Requires admin privileges. The old API key will no longer work after regeneration.
 *     tags: [Services]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     responses:
 *       200:
 *         description: API key regenerated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: API key regenerated successfully
 *                 service:
 *                   $ref: '#/components/schemas/Service'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{id}:
 *   delete:
 *     summary: Delete a service
 *     description: Soft-deletes a service by setting its status to inactive. Requires admin privileges.
 *     tags: [Services]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     responses:
 *       200:
 *         description: Service deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Service deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    // Only admins or org API keys can delete services
    if (req.authMethod === 'jwt' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Service keys cannot delete services
    if (req.authMethod === 'service_key') {
      return res.status(403).json({ error: 'Cannot delete services using service API key' });
    }

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);

    const service = await serviceRepo.findOne({
      where: { id, orgId },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Hard delete - actually remove the service
    await serviceRepo.remove(service);

    logger.info('Service deleted', {
      serviceId: id,
      orgId,
      deletedBy: req.user?.id || 'api_key',
      authMethod: req.authMethod
    });

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
 * @swagger
 * components:
 *   schemas:
 *     MaintenanceWindowResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/MaintenanceWindow'
 *         - type: object
 *           properties:
 *             service:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 */

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
 * @swagger
 * /api/v1/services/maintenance-windows/active:
 *   get:
 *     summary: Get all active maintenance windows
 *     description: Retrieves all currently active maintenance windows across all services in the organization.
 *     tags: [Services - Maintenance Windows]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Active maintenance windows retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 maintenanceWindows:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/MaintenanceWindow'
 *                       - type: object
 *                         properties:
 *                           service:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               name:
 *                                 type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{id}/maintenance-windows:
 *   get:
 *     summary: List maintenance windows for a service
 *     description: Retrieves all maintenance windows for a specific service, optionally filtered by status.
 *     tags: [Services - Maintenance Windows]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, upcoming, past]
 *         description: Filter by maintenance window status
 *     responses:
 *       200:
 *         description: Maintenance windows retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 maintenanceWindows:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MaintenanceWindow'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{serviceId}/maintenance-windows/{windowId}:
 *   get:
 *     summary: Get a maintenance window by ID
 *     description: Retrieves a specific maintenance window for a service.
 *     tags: [Services - Maintenance Windows]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *       - in: path
 *         name: windowId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Maintenance window ID
 *     responses:
 *       200:
 *         description: Maintenance window retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 maintenanceWindow:
 *                   $ref: '#/components/schemas/MaintenanceWindow'
 *       400:
 *         description: Invalid UUID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service or maintenance window not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{id}/maintenance-windows:
 *   post:
 *     summary: Create a maintenance window
 *     description: Creates a new maintenance window for a service. The window cannot overlap with existing windows.
 *     tags: [Services - Maintenance Windows]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MaintenanceWindowCreate'
 *     responses:
 *       201:
 *         description: Maintenance window created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 maintenanceWindow:
 *                   $ref: '#/components/schemas/MaintenanceWindow'
 *                 message:
 *                   type: string
 *                   example: Maintenance window created successfully
 *       400:
 *         description: Validation error or end time before start time
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       409:
 *         description: Maintenance window overlaps with existing window
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Maintenance window overlaps with existing window
 *                 overlappingWindow:
 *                   $ref: '#/components/schemas/MaintenanceWindow'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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

      setLocationHeader(res, req, `/api/v1/services/${id}/maintenance-windows`, maintenanceWindow.id);
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
 * @swagger
 * /api/v1/services/{serviceId}/maintenance-windows/{windowId}:
 *   put:
 *     summary: Update a maintenance window
 *     description: Updates an existing maintenance window. The updated window cannot overlap with other windows.
 *     tags: [Services - Maintenance Windows]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *       - in: path
 *         name: windowId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Maintenance window ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: New start time (ISO 8601)
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: New end time (ISO 8601)
 *               description:
 *                 type: string
 *                 nullable: true
 *               suppressAlerts:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Maintenance window updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 maintenanceWindow:
 *                   $ref: '#/components/schemas/MaintenanceWindow'
 *                 message:
 *                   type: string
 *                   example: Maintenance window updated successfully
 *       400:
 *         description: Validation error or end time before start time
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service or maintenance window not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       409:
 *         description: Updated maintenance window would overlap with existing window
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 overlappingWindow:
 *                   $ref: '#/components/schemas/MaintenanceWindow'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{serviceId}/maintenance-windows/{windowId}:
 *   delete:
 *     summary: Delete a maintenance window
 *     description: Deletes a maintenance window for a service.
 *     tags: [Services - Maintenance Windows]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *       - in: path
 *         name: windowId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Maintenance window ID
 *     responses:
 *       200:
 *         description: Maintenance window deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Maintenance window deleted successfully
 *       400:
 *         description: Invalid UUID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service or maintenance window not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{id}/grouping-rule:
 *   get:
 *     summary: Get alert grouping rule for a service
 *     description: Retrieves the alert grouping configuration for a service. Returns default configuration if no custom rule is set.
 *     tags: [Services - Alert Grouping]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     responses:
 *       200:
 *         description: Grouping rule retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 groupingRule:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/AlertGroupingRule'
 *                     - type: 'null'
 *                 defaults:
 *                   type: object
 *                   description: Default values if no rule is configured
 *                   properties:
 *                     groupingType:
 *                       type: string
 *                       example: intelligent
 *                     timeWindowMinutes:
 *                       type: integer
 *                       example: 5
 *                     contentFields:
 *                       type: array
 *                       items:
 *                         type: string
 *                     maxAlertsPerIncident:
 *                       type: integer
 *                       example: 1000
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{id}/grouping-rule:
 *   put:
 *     summary: Create or update alert grouping rule
 *     description: Creates or updates the alert grouping configuration for a service.
 *     tags: [Services - Alert Grouping]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupingType:
 *                 type: string
 *                 enum: [intelligent, time, content, disabled]
 *                 description: Type of alert grouping
 *               timeWindowMinutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 1440
 *                 description: Time window in minutes for grouping alerts
 *               contentFields:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Fields to use for content-based grouping
 *               dedupKeyTemplate:
 *                 type: string
 *                 nullable: true
 *                 description: Template for generating deduplication keys
 *               maxAlertsPerIncident:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10000
 *                 description: Maximum alerts per incident
 *     responses:
 *       200:
 *         description: Grouping rule updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 groupingRule:
 *                   $ref: '#/components/schemas/AlertGroupingRule'
 *                 message:
 *                   type: string
 *                   example: Grouping rule updated successfully
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{id}/grouping-rule:
 *   delete:
 *     summary: Delete alert grouping rule
 *     description: Deletes the alert grouping rule for a service, reverting to default behavior.
 *     tags: [Services - Alert Grouping]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     responses:
 *       200:
 *         description: Grouping rule deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Grouping rule deleted successfully. Service will use default grouping.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service not found or no grouping rule configured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * tags:
 *   - name: Services - Event Rules
 *     description: Event transform rules for services
 */

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
 * @swagger
 * /api/v1/services/{id}/event-rules:
 *   get:
 *     summary: List event transform rules for a service
 *     description: Retrieves all event transform rules for a service, ordered by rule priority.
 *     tags: [Services - Event Rules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     responses:
 *       200:
 *         description: Event rules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rules:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EventTransformRule'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{serviceId}/event-rules/{ruleId}:
 *   get:
 *     summary: Get an event transform rule by ID
 *     description: Retrieves a specific event transform rule for a service.
 *     tags: [Services - Event Rules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Event rule ID
 *     responses:
 *       200:
 *         description: Event rule retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rule:
 *                   $ref: '#/components/schemas/EventTransformRule'
 *       400:
 *         description: Invalid UUID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service or event rule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{id}/event-rules:
 *   post:
 *     summary: Create an event transform rule
 *     description: Creates a new event transform rule for a service. Rules are evaluated in order based on ruleOrder.
 *     tags: [Services - Event Rules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *                 description: Rule name
 *               description:
 *                 type: string
 *                 nullable: true
 *                 description: Rule description
 *               enabled:
 *                 type: boolean
 *                 default: true
 *                 description: Whether the rule is enabled
 *               conditions:
 *                 type: array
 *                 description: Conditions for matching events
 *                 items:
 *                   type: object
 *                   properties:
 *                     field:
 *                       type: string
 *                     operator:
 *                       type: string
 *                       enum: [equals, contains, matches, exists, not_exists]
 *                     value:
 *                       type: string
 *               matchType:
 *                 type: string
 *                 enum: [all, any]
 *                 default: all
 *                 description: Whether all or any conditions must match
 *               transformations:
 *                 type: array
 *                 description: Transformations to apply
 *                 items:
 *                   type: object
 *                   properties:
 *                     action:
 *                       type: string
 *                       enum: [set, copy, delete, regex_extract]
 *                     field:
 *                       type: string
 *                     value:
 *                       type: string
 *                     sourceField:
 *                       type: string
 *               action:
 *                 type: string
 *                 enum: [continue, suppress, route]
 *                 default: continue
 *                 description: Action to take after transformations
 *               routeToServiceId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: Service ID to route events to (if action is route)
 *     responses:
 *       201:
 *         description: Event rule created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rule:
 *                   $ref: '#/components/schemas/EventTransformRule'
 *                 message:
 *                   type: string
 *                   example: Event transform rule created successfully
 *       400:
 *         description: Validation error or invalid route-to service
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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

      setLocationHeader(res, req, `/api/v1/services/${id}/event-rules`, rule.id);
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
 * @swagger
 * /api/v1/services/{serviceId}/event-rules/{ruleId}:
 *   put:
 *     summary: Update an event transform rule
 *     description: Updates an existing event transform rule for a service.
 *     tags: [Services - Event Rules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Event rule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 nullable: true
 *               enabled:
 *                 type: boolean
 *               conditions:
 *                 type: array
 *                 items:
 *                   type: object
 *               matchType:
 *                 type: string
 *                 enum: [all, any]
 *               transformations:
 *                 type: array
 *                 items:
 *                   type: object
 *               action:
 *                 type: string
 *                 enum: [continue, suppress, route]
 *               routeToServiceId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               ruleOrder:
 *                 type: integer
 *                 minimum: 0
 *                 description: Order in which rules are evaluated
 *     responses:
 *       200:
 *         description: Event rule updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rule:
 *                   $ref: '#/components/schemas/EventTransformRule'
 *                 message:
 *                   type: string
 *                   example: Event transform rule updated successfully
 *       400:
 *         description: Validation error or invalid route-to service
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service or event rule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{serviceId}/event-rules/{ruleId}:
 *   delete:
 *     summary: Delete an event transform rule
 *     description: Deletes an event transform rule for a service.
 *     tags: [Services - Event Rules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Event rule ID
 *     responses:
 *       200:
 *         description: Event rule deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Event transform rule deleted successfully
 *       400:
 *         description: Invalid UUID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service or event rule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{serviceId}/event-rules/reorder:
 *   put:
 *     summary: Reorder event transform rules
 *     description: Updates the order in which event transform rules are evaluated.
 *     tags: [Services - Event Rules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ruleIds
 *             properties:
 *               ruleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Ordered array of rule IDs
 *     responses:
 *       200:
 *         description: Event rules reordered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Event transform rules reordered successfully
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/v1/services/{serviceId}/event-rules/{ruleId}/test:
 *   post:
 *     summary: Test an event transform rule
 *     description: Tests an event transform rule against a sample payload to see if it matches and what transformations would be applied.
 *     tags: [Services - Event Rules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Event rule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payload
 *             properties:
 *               payload:
 *                 type: object
 *                 description: Sample event payload to test against the rule
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: Test results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 matches:
 *                   type: boolean
 *                   description: Whether the rule conditions matched
 *                 action:
 *                   type: string
 *                   nullable: true
 *                   enum: [continue, suppress, route]
 *                   description: Action that would be taken if matched
 *                 routeToService:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                 originalPayload:
 *                   type: object
 *                   description: The original payload submitted
 *                 transformedPayload:
 *                   type: object
 *                   nullable: true
 *                   description: The payload after transformations (null if not matched)
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Service or event rule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
