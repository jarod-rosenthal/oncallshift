import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Heartbeat, Service, Incident, IncidentEvent } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { parsePaginationParams, paginatedResponse, validateSortField, VALID_SORT_FIELDS } from '../../shared/utils/pagination';
import { paginationValidators, searchFilterValidator, uuidFilterValidator } from '../../shared/validators/pagination';
import { badRequest, notFound, internalError, validationError, fromExpressValidator } from '../../shared/utils/problem-details';

// Add heartbeats to valid sort fields
VALID_SORT_FIELDS.heartbeats = ['name', 'createdAt', 'updatedAt', 'status', 'lastPingAt'];

const router = Router();

/**
 * Format heartbeat for API response
 */
function formatHeartbeat(heartbeat: Heartbeat) {
  return {
    id: heartbeat.id,
    name: heartbeat.name,
    description: heartbeat.description,
    heartbeatKey: heartbeat.heartbeatKey,
    intervalSeconds: heartbeat.intervalSeconds,
    alertAfterMissedCount: heartbeat.alertAfterMissedCount,
    lastPingAt: heartbeat.lastPingAt?.toISOString() || null,
    status: heartbeat.status,
    missedCount: heartbeat.missedCount,
    enabled: heartbeat.enabled,
    serviceId: heartbeat.serviceId,
    serviceName: heartbeat.service?.name || null,
    activeIncidentId: heartbeat.activeIncidentId,
    createdAt: heartbeat.createdAt.toISOString(),
    updatedAt: heartbeat.updatedAt.toISOString(),
  };
}

// ============================================================================
// Authenticated Routes (require login)
// ============================================================================

/**
 * GET /api/v1/heartbeats
 * List all heartbeats for the authenticated user's organization
 * Supports pagination, filtering by service_id, status, and search
 */
router.get(
  '/',
  authenticateUser,
  [
    ...paginationValidators,
    uuidFilterValidator('service_id'),
    query('status')
      .optional()
      .isIn(['unknown', 'healthy', 'expired'])
      .withMessage('status must be unknown, healthy, or expired'),
    searchFilterValidator,
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const pagination = parsePaginationParams(req.query);
      const sortField = validateSortField('heartbeats', pagination.sort, 'name');
      const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';

      const { service_id, status, search } = req.query;

      const dataSource = await getDataSource();
      const heartbeatRepo = dataSource.getRepository(Heartbeat);

      // Build where conditions
      const whereConditions: any = { orgId };

      if (service_id) {
        whereConditions.serviceId = service_id;
      }

      if (status) {
        whereConditions.status = status;
      }

      // For search, we need to use QueryBuilder for ILIKE support
      let heartbeats: Heartbeat[];
      let total: number;

      if (search) {
        const queryBuilder = heartbeatRepo.createQueryBuilder('heartbeat')
          .leftJoinAndSelect('heartbeat.service', 'service')
          .where('heartbeat.orgId = :orgId', { orgId });

        if (service_id) {
          queryBuilder.andWhere('heartbeat.serviceId = :serviceId', { serviceId: service_id });
        }

        if (status) {
          queryBuilder.andWhere('heartbeat.status = :status', { status });
        }

        queryBuilder.andWhere('(heartbeat.name ILIKE :search OR heartbeat.description ILIKE :search)', {
          search: `%${search}%`,
        });

        queryBuilder
          .orderBy(`heartbeat.${sortField}`, sortOrder)
          .skip(pagination.offset)
          .take(pagination.limit);

        [heartbeats, total] = await queryBuilder.getManyAndCount();
      } else {
        [heartbeats, total] = await heartbeatRepo.findAndCount({
          where: whereConditions,
          relations: ['service'],
          order: { [sortField]: sortOrder },
          skip: pagination.offset,
          take: pagination.limit,
        });
      }

      const lastItem = heartbeats[heartbeats.length - 1];
      return res.json(paginatedResponse(
        heartbeats.map(formatHeartbeat),
        total,
        pagination,
        lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
        'heartbeats'
      ));
    } catch (error) {
      logger.error('Error fetching heartbeats:', error);
      return internalError(res);
    }
  }
);

/**
 * GET /api/v1/heartbeats/:id
 * Get a single heartbeat by ID
 */
router.get('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const heartbeatRepo = dataSource.getRepository(Heartbeat);

    const heartbeat = await heartbeatRepo.findOne({
      where: { id, orgId },
      relations: ['service'],
    });

    if (!heartbeat) {
      return notFound(res, 'Heartbeat', id);
    }

    return res.json({ heartbeat: formatHeartbeat(heartbeat) });
  } catch (error) {
    logger.error('Error fetching heartbeat:', error);
    return internalError(res);
  }
});

/**
 * POST /api/v1/heartbeats
 * Create a new heartbeat
 */
router.post(
  '/',
  authenticateUser,
  [
    body('name').isString().trim().notEmpty().withMessage('Name is required'),
    body('description').optional().isString(),
    body('intervalSeconds').optional().isInt({ min: 1 }).withMessage('Interval must be positive'),
    body('alertAfterMissedCount').optional().isInt({ min: 1 }).withMessage('Alert threshold must be positive'),
    body('serviceId').optional({ nullable: true }).isUUID().withMessage('Invalid service ID'),
    body('enabled').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const { name, description, intervalSeconds, alertAfterMissedCount, serviceId, enabled } = req.body;

      const dataSource = await getDataSource();
      const heartbeatRepo = dataSource.getRepository(Heartbeat);

      // Verify service exists if provided
      if (serviceId) {
        const serviceRepo = dataSource.getRepository(Service);
        const service = await serviceRepo.findOne({ where: { id: serviceId, orgId } });
        if (!service) {
          return notFound(res, 'Service', serviceId);
        }
      }

      // Check for duplicate name
      const existing = await heartbeatRepo.findOne({ where: { name, orgId } });
      if (existing) {
        return badRequest(res, 'A heartbeat with this name already exists');
      }

      const heartbeat = heartbeatRepo.create({
        orgId,
        name,
        description: description || null,
        intervalSeconds: intervalSeconds || 300,
        alertAfterMissedCount: alertAfterMissedCount || 1,
        serviceId: serviceId || null,
        enabled: enabled !== false,
        status: 'unknown',
      });

      await heartbeatRepo.save(heartbeat);

      logger.info('Heartbeat created:', { id: heartbeat.id, name: heartbeat.name, orgId });

      return res.status(201).json({ heartbeat: formatHeartbeat(heartbeat) });
    } catch (error) {
      logger.error('Error creating heartbeat:', error);
      return internalError(res);
    }
  }
);

/**
 * PUT /api/v1/heartbeats/:id
 * Update a heartbeat
 */
router.put(
  '/:id',
  authenticateUser,
  [
    param('id').isUUID(),
    body('name').optional().isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('intervalSeconds').optional().isInt({ min: 1 }),
    body('alertAfterMissedCount').optional().isInt({ min: 1 }),
    body('serviceId').optional({ nullable: true }).custom((value) => {
      if (value === null || value === '') return true;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) throw new Error('Invalid service ID');
      return true;
    }),
    body('enabled').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const heartbeatRepo = dataSource.getRepository(Heartbeat);

      const heartbeat = await heartbeatRepo.findOne({
        where: { id, orgId },
        relations: ['service'],
      });

      if (!heartbeat) {
        return notFound(res, 'Heartbeat', id);
      }

      const { name, description, intervalSeconds, alertAfterMissedCount, serviceId, enabled } = req.body;

      // Verify service exists if provided
      if (serviceId !== undefined && serviceId !== null && serviceId !== '') {
        const serviceRepo = dataSource.getRepository(Service);
        const service = await serviceRepo.findOne({ where: { id: serviceId, orgId } });
        if (!service) {
          return notFound(res, 'Service', serviceId);
        }
      }

      // Check for duplicate name if changing
      if (name && name !== heartbeat.name) {
        const existing = await heartbeatRepo.findOne({ where: { name, orgId } });
        if (existing) {
          return badRequest(res, 'A heartbeat with this name already exists');
        }
      }

      // Update fields
      if (name !== undefined) heartbeat.name = name;
      if (description !== undefined) heartbeat.description = description || null;
      if (intervalSeconds !== undefined) heartbeat.intervalSeconds = intervalSeconds;
      if (alertAfterMissedCount !== undefined) heartbeat.alertAfterMissedCount = alertAfterMissedCount;
      if (serviceId !== undefined) heartbeat.serviceId = serviceId || null;
      if (enabled !== undefined) heartbeat.enabled = enabled;

      await heartbeatRepo.save(heartbeat);

      // Reload with service relation
      const updated = await heartbeatRepo.findOne({
        where: { id },
        relations: ['service'],
      });

      logger.info('Heartbeat updated:', { id: heartbeat.id, name: heartbeat.name });

      return res.json({ heartbeat: formatHeartbeat(updated!) });
    } catch (error) {
      logger.error('Error updating heartbeat:', error);
      return internalError(res);
    }
  }
);

/**
 * DELETE /api/v1/heartbeats/:id
 * Delete a heartbeat
 */
router.delete('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const heartbeatRepo = dataSource.getRepository(Heartbeat);

    const heartbeat = await heartbeatRepo.findOne({ where: { id, orgId } });

    if (!heartbeat) {
      return notFound(res, 'Heartbeat', id);
    }

    await heartbeatRepo.remove(heartbeat);

    logger.info('Heartbeat deleted:', { id, name: heartbeat.name });

    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting heartbeat:', error);
    return internalError(res);
  }
});

// ============================================================================
// Ping Routes (can be called without authentication using heartbeat key)
// ============================================================================

/**
 * Helper function to process a heartbeat ping
 */
async function processPingByName(name: string, res: Response): Promise<Response> {
  try {
    const dataSource = await getDataSource();
    const heartbeatRepo = dataSource.getRepository(Heartbeat);

    // Find by name (case-insensitive)
    const heartbeat = await heartbeatRepo
      .createQueryBuilder('heartbeat')
      .where('LOWER(heartbeat.name) = LOWER(:name)', { name })
      .getOne();

    if (!heartbeat) {
      return notFound(res, 'Heartbeat');
    }

    if (!heartbeat.enabled) {
      return badRequest(res, 'Heartbeat is disabled');
    }

    // Record the ping
    const previousStatus = heartbeat.status;
    heartbeat.recordPing();

    // If heartbeat was expired and had an active incident, resolve it
    if (previousStatus === 'expired' && heartbeat.activeIncidentId) {
      try {
        const incidentRepo = dataSource.getRepository(Incident);
        const eventRepo = dataSource.getRepository(IncidentEvent);

        const incident = await incidentRepo.findOne({ where: { id: heartbeat.activeIncidentId } });
        if (incident && incident.state !== 'resolved') {
          incident.state = 'resolved';
          incident.resolvedAt = new Date();
          await incidentRepo.save(incident);

          // Create resolution event
          const event = eventRepo.create({
            incidentId: incident.id,
            type: 'resolve',
            message: `Heartbeat "${heartbeat.name}" recovered - ping received`,
            payload: { heartbeatId: heartbeat.id, recoveredAt: new Date().toISOString() },
          });
          await eventRepo.save(event);

          logger.info('Heartbeat recovered, incident resolved:', {
            heartbeatId: heartbeat.id,
            incidentId: incident.id,
          });
        }

        heartbeat.activeIncidentId = null;
      } catch (incidentError) {
        logger.error('Error resolving heartbeat incident:', incidentError);
      }
    }

    await heartbeatRepo.save(heartbeat);

    logger.debug('Heartbeat ping received:', { id: heartbeat.id, name: heartbeat.name });

    return res.json({
      result: 'pong',
      heartbeat: {
        name: heartbeat.name,
        status: heartbeat.status,
        lastPingAt: heartbeat.lastPingAt?.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error processing heartbeat ping:', error);
    return internalError(res);
  }
}

/**
 * GET /api/v1/heartbeats/:name/ping
 * Ping a heartbeat by name (Opsgenie-compatible endpoint)
 * No authentication required - uses heartbeat name in URL
 */
router.get('/:name/ping', async (req: Request, res: Response) => {
  return processPingByName(req.params.name, res);
});

/**
 * POST /api/v1/heartbeats/:name/ping
 * Ping a heartbeat by name (POST version for compatibility)
 */
router.post('/:name/ping', async (req: Request, res: Response) => {
  return processPingByName(req.params.name, res);
});

/**
 * GET /api/v1/heartbeats/ping/:key
 * Ping a heartbeat by key (alternative endpoint using heartbeat_key)
 */
router.get('/ping/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const dataSource = await getDataSource();
    const heartbeatRepo = dataSource.getRepository(Heartbeat);

    const heartbeat = await heartbeatRepo.findOne({ where: { heartbeatKey: key } });

    if (!heartbeat) {
      return notFound(res, 'Heartbeat');
    }

    if (!heartbeat.enabled) {
      return badRequest(res, 'Heartbeat is disabled');
    }

    // Record the ping
    const previousStatus = heartbeat.status;
    heartbeat.recordPing();

    // If heartbeat was expired and had an active incident, resolve it
    if (previousStatus === 'expired' && heartbeat.activeIncidentId) {
      try {
        const incidentRepo = dataSource.getRepository(Incident);
        const eventRepo = dataSource.getRepository(IncidentEvent);

        const incident = await incidentRepo.findOne({ where: { id: heartbeat.activeIncidentId } });
        if (incident && incident.state !== 'resolved') {
          incident.state = 'resolved';
          incident.resolvedAt = new Date();
          await incidentRepo.save(incident);

          const event = eventRepo.create({
            incidentId: incident.id,
            type: 'resolve',
            message: `Heartbeat "${heartbeat.name}" recovered - ping received`,
            payload: { heartbeatId: heartbeat.id, recoveredAt: new Date().toISOString() },
          });
          await eventRepo.save(event);

          logger.info('Heartbeat recovered, incident resolved:', {
            heartbeatId: heartbeat.id,
            incidentId: incident.id,
          });
        }

        heartbeat.activeIncidentId = null;
      } catch (incidentError) {
        logger.error('Error resolving heartbeat incident:', incidentError);
      }
    }

    await heartbeatRepo.save(heartbeat);

    logger.debug('Heartbeat ping received (by key):', { id: heartbeat.id, name: heartbeat.name });

    return res.json({
      result: 'pong',
      heartbeat: {
        name: heartbeat.name,
        status: heartbeat.status,
        lastPingAt: heartbeat.lastPingAt?.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error processing heartbeat ping:', error);
    return internalError(res);
  }
});

export default router;
