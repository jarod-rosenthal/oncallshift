import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Incident, IncidentEvent } from '../../shared/models';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/incidents
 * List incidents for the organization
 */
router.get(
  '/',
  [
    query('state').optional().isIn(['triggered', 'acknowledged', 'resolved']),
    query('service_id').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { state, service_id, limit = 50, offset = 0 } = req.query;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);

      // Build query
      const queryBuilder = incidentRepo
        .createQueryBuilder('incident')
        .leftJoinAndSelect('incident.service', 'service')
        .leftJoinAndSelect('incident.acknowledgedByUser', 'ackUser')
        .leftJoinAndSelect('incident.resolvedByUser', 'resUser')
        .where('incident.org_id = :orgId', { orgId })
        .orderBy('incident.triggered_at', 'DESC')
        .take(limit as number)
        .skip(offset as number);

      if (state) {
        queryBuilder.andWhere('incident.state = :state', { state });
      }

      if (service_id) {
        queryBuilder.andWhere('incident.service_id = :serviceId', { serviceId: service_id });
      }

      const [incidents, total] = await queryBuilder.getManyAndCount();

      res.json({
        incidents: incidents.map(incident => formatIncident(incident)),
        pagination: {
          total,
          limit,
          offset,
        },
      });
    } catch (error) {
      logger.error('Error fetching incidents:', error);
      res.status(500).json({ error: 'Failed to fetch incidents' });
    }
  }
);

/**
 * GET /api/v1/incidents/:id
 * Get incident details with timeline
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);

    const incident = await incidentRepo.findOne({
      where: { id, orgId },
      relations: ['service', 'acknowledgedByUser', 'resolvedByUser'],
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Get incident events (timeline)
    const events = await eventRepo.find({
      where: { incidentId: id },
      relations: ['actor'],
      order: { createdAt: 'ASC' },
    });

    res.json({
      incident: formatIncident(incident),
      events: events.map(event => ({
        id: event.id,
        type: event.type,
        message: event.message,
        payload: event.payload,
        actor: event.actor ? {
          id: event.actor.id,
          fullName: event.actor.fullName,
          email: event.actor.email,
        } : null,
        createdAt: event.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching incident:', error);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

/**
 * PUT /api/v1/incidents/:id/acknowledge
 * Acknowledge an incident
 */
router.put('/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const user = req.user!;

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);

    const incident = await incidentRepo.findOne({
      where: { id, orgId },
      relations: ['service'],
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    if (!incident.canAcknowledge()) {
      return res.status(400).json({ error: 'Incident cannot be acknowledged in current state' });
    }

    // Update incident
    incident.state = 'acknowledged';
    incident.acknowledgedAt = new Date();
    incident.acknowledgedBy = user.id;
    await incidentRepo.save(incident);

    // Create event
    const event = eventRepo.create({
      incidentId: incident.id,
      type: 'acknowledge',
      actorId: user.id,
      message: `Incident acknowledged by ${user.fullName || user.email}`,
    });
    await eventRepo.save(event);

    logger.info('Incident acknowledged', {
      incidentId: incident.id,
      userId: user.id,
      incidentNumber: incident.incidentNumber,
    });

    res.json({
      incident: formatIncident(incident),
      message: 'Incident acknowledged successfully',
    });
  } catch (error) {
    logger.error('Error acknowledging incident:', error);
    res.status(500).json({ error: 'Failed to acknowledge incident' });
  }
});

/**
 * PUT /api/v1/incidents/:id/resolve
 * Resolve an incident
 */
router.put('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const user = req.user!;

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);

    const incident = await incidentRepo.findOne({
      where: { id, orgId },
      relations: ['service'],
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    if (!incident.canResolve()) {
      return res.status(400).json({ error: 'Incident is already resolved' });
    }

    // Update incident
    incident.state = 'resolved';
    incident.resolvedAt = new Date();
    incident.resolvedBy = user.id;
    await incidentRepo.save(incident);

    // Create event
    const event = eventRepo.create({
      incidentId: incident.id,
      type: 'resolve',
      actorId: user.id,
      message: `Incident resolved by ${user.fullName || user.email}`,
    });
    await eventRepo.save(event);

    logger.info('Incident resolved', {
      incidentId: incident.id,
      userId: user.id,
      incidentNumber: incident.incidentNumber,
    });

    res.json({
      incident: formatIncident(incident),
      message: 'Incident resolved successfully',
    });
  } catch (error) {
    logger.error('Error resolving incident:', error);
    res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

/**
 * POST /api/v1/incidents/:id/notes
 * Add a note to an incident
 */
router.post(
  '/:id/notes',
  [body('content').isString().notEmpty().withMessage('Note content is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { content } = req.body;
      const orgId = req.orgId!;
      const user = req.user!;

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);
      const eventRepo = dataSource.getRepository(IncidentEvent);

      const incident = await incidentRepo.findOne({
        where: { id, orgId },
      });

      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Create note event
      const event = eventRepo.create({
        incidentId: incident.id,
        type: 'note',
        actorId: user.id,
        message: content,
      });
      await eventRepo.save(event);

      logger.info('Note added to incident', {
        incidentId: incident.id,
        userId: user.id,
      });

      res.status(201).json({
        event: {
          id: event.id,
          type: event.type,
          message: event.message,
          createdAt: event.createdAt,
        },
        message: 'Note added successfully',
      });
    } catch (error) {
      logger.error('Error adding note:', error);
      res.status(500).json({ error: 'Failed to add note' });
    }
  }
);

// Helper function to format incident response
function formatIncident(incident: Incident) {
  return {
    id: incident.id,
    incidentNumber: incident.incidentNumber,
    summary: incident.summary,
    details: incident.details,
    severity: incident.severity,
    state: incident.state,
    service: {
      id: incident.service.id,
      name: incident.service.name,
    },
    triggeredAt: incident.triggeredAt,
    acknowledgedAt: incident.acknowledgedAt,
    acknowledgedBy: incident.acknowledgedByUser ? {
      id: incident.acknowledgedByUser.id,
      fullName: incident.acknowledgedByUser.fullName,
      email: incident.acknowledgedByUser.email,
    } : null,
    resolvedAt: incident.resolvedAt,
    resolvedBy: incident.resolvedByUser ? {
      id: incident.resolvedByUser.id,
      fullName: incident.resolvedByUser.fullName,
      email: incident.resolvedByUser.email,
    } : null,
    eventCount: incident.eventCount,
    lastEventAt: incident.lastEventAt,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  };
}

export default router;
