import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Incident, IncidentEvent, User, Service, EscalationStep, Schedule } from '../../shared/models';
import { sendNotificationMessage } from '../../shared/queues/sqs-client';
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
        .leftJoinAndSelect('incident.assignedToUser', 'assignedUser')
        .leftJoinAndSelect('incident.snoozedByUser', 'snoozedUser')
        .where('incident.org_id = :orgId', { orgId })
        .orderBy('incident.triggeredAt', 'DESC')
        .take(limit as number)
        .skip(offset as number);

      if (state) {
        queryBuilder.andWhere('incident.state = :state', { state });
      }

      if (service_id) {
        queryBuilder.andWhere('incident.service_id = :serviceId', { serviceId: service_id });
      }

      const [incidents, total] = await queryBuilder.getManyAndCount();

      return res.json({
        incidents: incidents.map(incident => formatIncident(incident)),
        pagination: {
          total,
          limit,
          offset,
        },
      });
    } catch (error) {
      logger.error('Error fetching incidents:', error);
      return res.status(500).json({ error: 'Failed to fetch incidents' });
    }
  }
);

/**
 * GET /api/v1/incidents/:id
 * Get incident details with escalation status
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const serviceRepo = dataSource.getRepository(Service);
    const scheduleRepo = dataSource.getRepository(Schedule);
    const userRepo = dataSource.getRepository(User);

    const incident = await incidentRepo.findOne({
      where: { id, orgId },
      relations: ['service', 'acknowledgedByUser', 'resolvedByUser', 'assignedToUser', 'snoozedByUser'],
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Get escalation status
    const escalation = await getEscalationStatus(
      incident,
      serviceRepo,
      scheduleRepo,
      userRepo
    );

    return res.json({
      incident: formatIncident(incident),
      escalation,
    });
  } catch (error) {
    logger.error('Error fetching incident:', error);
    return res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

/**
 * GET /api/v1/incidents/:id/timeline
 * Get incident timeline (events)
 */
router.get('/:id/timeline', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);

    // Verify incident exists and belongs to org
    const incident = await incidentRepo.findOne({
      where: { id, orgId },
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

    return res.json({
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
    logger.error('Error fetching incident timeline:', error);
    return res.status(500).json({ error: 'Failed to fetch incident timeline' });
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

    return res.json({
      incident: formatIncident(incident),
      message: 'Incident acknowledged successfully',
    });
  } catch (error) {
    logger.error('Error acknowledging incident:', error);
    return res.status(500).json({ error: 'Failed to acknowledge incident' });
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

    return res.json({
      incident: formatIncident(incident),
      message: 'Incident resolved successfully',
    });
  } catch (error) {
    logger.error('Error resolving incident:', error);
    return res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

/**
 * PUT /api/v1/incidents/:id/unacknowledge
 * Revert an acknowledged incident back to triggered state
 */
router.put('/:id/unacknowledge', async (req: Request, res: Response) => {
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

    if (incident.state !== 'acknowledged') {
      return res.status(400).json({ error: 'Incident must be in acknowledged state to unacknowledge' });
    }

    // Update incident
    incident.state = 'triggered';
    incident.acknowledgedAt = null;
    incident.acknowledgedBy = null;
    await incidentRepo.save(incident);

    // Create event
    const event = eventRepo.create({
      incidentId: incident.id,
      type: 'state_change',
      actorId: user.id,
      message: `Incident unacknowledged by ${user.fullName || user.email}`,
      payload: {
        fromState: 'acknowledged',
        toState: 'triggered',
        action: 'unacknowledge',
      },
    });
    await eventRepo.save(event);

    logger.info('Incident unacknowledged', {
      incidentId: incident.id,
      userId: user.id,
      incidentNumber: incident.incidentNumber,
    });

    return res.json({
      incident: formatIncident(incident),
      message: 'Incident unacknowledged successfully',
    });
  } catch (error) {
    logger.error('Error unacknowledging incident:', error);
    return res.status(500).json({ error: 'Failed to unacknowledge incident' });
  }
});

/**
 * PUT /api/v1/incidents/:id/unresolve
 * Revert a resolved incident back to triggered state
 */
router.put('/:id/unresolve', async (req: Request, res: Response) => {
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

    if (incident.state !== 'resolved') {
      return res.status(400).json({ error: 'Incident must be in resolved state to unresolve' });
    }

    // Update incident
    incident.state = 'triggered';
    incident.resolvedAt = null;
    incident.resolvedBy = null;
    // Also clear acknowledgment since we're going back to triggered
    incident.acknowledgedAt = null;
    incident.acknowledgedBy = null;
    await incidentRepo.save(incident);

    // Create event
    const event = eventRepo.create({
      incidentId: incident.id,
      type: 'state_change',
      actorId: user.id,
      message: `Incident reopened by ${user.fullName || user.email}`,
      payload: {
        fromState: 'resolved',
        toState: 'triggered',
        action: 'unresolve',
      },
    });
    await eventRepo.save(event);

    logger.info('Incident unresolved', {
      incidentId: incident.id,
      userId: user.id,
      incidentNumber: incident.incidentNumber,
    });

    return res.json({
      incident: formatIncident(incident),
      message: 'Incident reopened successfully',
    });
  } catch (error) {
    logger.error('Error unresolved incident:', error);
    return res.status(500).json({ error: 'Failed to unresolve incident' });
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

      return res.status(201).json({
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
      return res.status(500).json({ error: 'Failed to add note' });
    }
  }
);

/**
 * POST /api/v1/incidents/:id/escalate
 * Manually escalate incident to next step
 */
router.post(
  '/:id/escalate',
  [body('reason').optional().isString().isLength({ max: 500 })],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { reason } = req.body;
      const orgId = req.orgId!;
      const user = req.user!;

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);
      const eventRepo = dataSource.getRepository(IncidentEvent);
      const serviceRepo = dataSource.getRepository(Service);
      const scheduleRepo = dataSource.getRepository(Schedule);

      const incident = await incidentRepo.findOne({
        where: { id, orgId },
        relations: ['service'],
      });

      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      if (!incident.canEscalate()) {
        return res.status(400).json({ error: 'Incident cannot be escalated in current state' });
      }

      // Get service with escalation policy
      const service = await serviceRepo.findOne({
        where: { id: incident.serviceId },
        relations: ['escalationPolicy', 'escalationPolicy.steps'],
      });

      if (!service?.escalationPolicy) {
        return res.status(400).json({ error: 'Service has no escalation policy configured' });
      }

      const steps = service.escalationPolicy.steps.sort((a, b) => a.stepOrder - b.stepOrder);
      const currentStepIndex = incident.currentEscalationStep - 1;
      const nextStepIndex = currentStepIndex + 1;

      if (nextStepIndex >= steps.length) {
        return res.status(400).json({ error: 'Already at final escalation step' });
      }

      const previousStep = incident.currentEscalationStep;
      const nextStep = steps[nextStepIndex];

      // Update incident
      incident.currentEscalationStep = nextStepIndex + 1;
      incident.escalationStartedAt = new Date();
      await incidentRepo.save(incident);

      // Create escalation event
      const event = eventRepo.create({
        incidentId: incident.id,
        type: 'escalate',
        actorId: user.id,
        message: `Incident manually escalated from step ${previousStep} to step ${nextStepIndex + 1}${reason ? `: ${reason}` : ''}`,
        payload: {
          fromStep: previousStep,
          toStep: nextStepIndex + 1,
          reason: reason || 'manual',
          triggeredBy: user.id,
        },
      });
      await eventRepo.save(event);

      // Get target users for next step and send notifications
      const targetUserIds = await getStepTargetUsers(nextStep, scheduleRepo);
      const priority = incident.severity === 'critical' || incident.severity === 'error' ? 'high' : 'normal';

      for (const userId of targetUserIds) {
        await sendNotificationMessage({
          incidentId: incident.id,
          userId,
          channel: 'push',
          priority,
          incidentState: 'triggered',
        });
        await sendNotificationMessage({
          incidentId: incident.id,
          userId,
          channel: 'email',
          priority,
          incidentState: 'triggered',
        });
        if (incident.severity === 'critical' || incident.severity === 'error') {
          await sendNotificationMessage({
            incidentId: incident.id,
            userId,
            channel: 'sms',
            priority: 'high',
            incidentState: 'triggered',
          });
        }
      }

      logger.info('Incident manually escalated', {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        fromStep: previousStep,
        toStep: nextStepIndex + 1,
        triggeredBy: user.id,
        targetUsers: targetUserIds.length,
      });

      return res.json({
        incident: formatIncident(incident),
        message: `Incident escalated to step ${nextStepIndex + 1}`,
      });
    } catch (error) {
      logger.error('Error escalating incident:', error);
      return res.status(500).json({ error: 'Failed to escalate incident' });
    }
  }
);

/**
 * POST /api/v1/incidents/:id/snooze
 * Snooze incident notifications for a duration
 */
router.post(
  '/:id/snooze',
  [
    body('durationMinutes').isInt({ min: 5, max: 1440 }).withMessage('Duration must be between 5 and 1440 minutes'),
    body('reason').optional().isString().isLength({ max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { durationMinutes, reason } = req.body;
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

      if (!incident.canSnooze()) {
        return res.status(400).json({ error: 'Incident cannot be snoozed in current state' });
      }

      // Set snooze
      const snoozedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
      incident.snoozedUntil = snoozedUntil;
      incident.snoozedBy = user.id;
      await incidentRepo.save(incident);

      // Create snooze event
      const event = eventRepo.create({
        incidentId: incident.id,
        type: 'snooze',
        actorId: user.id,
        message: `Incident snoozed for ${durationMinutes} minutes${reason ? `: ${reason}` : ''}`,
        payload: {
          durationMinutes,
          snoozedUntil: snoozedUntil.toISOString(),
          reason,
        },
      });
      await eventRepo.save(event);

      logger.info('Incident snoozed', {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        durationMinutes,
        snoozedUntil,
        snoozedBy: user.id,
      });

      return res.json({
        incident: formatIncident(incident),
        message: `Incident snoozed until ${snoozedUntil.toISOString()}`,
      });
    } catch (error) {
      logger.error('Error snoozing incident:', error);
      return res.status(500).json({ error: 'Failed to snooze incident' });
    }
  }
);

/**
 * DELETE /api/v1/incidents/:id/snooze
 * Cancel snooze on incident
 */
router.delete('/:id/snooze', async (req: Request, res: Response) => {
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

    if (!incident.isSnoozed()) {
      return res.status(400).json({ error: 'Incident is not snoozed' });
    }

    // Clear snooze
    incident.snoozedUntil = null;
    incident.snoozedBy = null;
    await incidentRepo.save(incident);

    // Create unsnooze event
    const event = eventRepo.create({
      incidentId: incident.id,
      type: 'unsnooze',
      actorId: user.id,
      message: `Snooze cancelled by ${user.fullName || user.email}`,
    });
    await eventRepo.save(event);

    logger.info('Incident snooze cancelled', {
      incidentId: incident.id,
      incidentNumber: incident.incidentNumber,
      cancelledBy: user.id,
    });

    return res.json({
      incident: formatIncident(incident),
      message: 'Snooze cancelled',
    });
  } catch (error) {
    logger.error('Error cancelling snooze:', error);
    return res.status(500).json({ error: 'Failed to cancel snooze' });
  }
});

/**
 * PUT /api/v1/incidents/:id/reassign
 * Reassign incident to another user
 */
router.put(
  '/:id/reassign',
  [
    body('assignToUserId').isUUID().withMessage('Valid user ID is required'),
    body('reason').optional().isString().isLength({ max: 500 }),
    body('notifyOriginalAssignee').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { assignToUserId, reason, notifyOriginalAssignee = true } = req.body;
      const orgId = req.orgId!;
      const user = req.user!;

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);
      const eventRepo = dataSource.getRepository(IncidentEvent);
      const userRepo = dataSource.getRepository(User);

      const incident = await incidentRepo.findOne({
        where: { id, orgId },
        relations: ['service', 'assignedToUser'],
      });

      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      if (!incident.canReassign()) {
        return res.status(400).json({ error: 'Incident cannot be reassigned in current state' });
      }

      // Verify target user exists and is in same org
      const targetUser = await userRepo.findOne({
        where: { id: assignToUserId, orgId },
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found' });
      }

      const previousAssignee = incident.assignedToUserId;
      const previousAssigneeName = incident.assignedToUser?.fullName || incident.assignedToUser?.email;

      // Update incident
      incident.assignedToUserId = assignToUserId;
      incident.assignedAt = new Date();
      await incidentRepo.save(incident);

      // Create reassign event
      const event = eventRepo.create({
        incidentId: incident.id,
        type: 'reassign',
        actorId: user.id,
        message: `Incident reassigned to ${targetUser.fullName || targetUser.email}${reason ? `: ${reason}` : ''}`,
        payload: {
          fromUserId: previousAssignee,
          fromUserName: previousAssigneeName,
          toUserId: assignToUserId,
          toUserName: targetUser.fullName || targetUser.email,
          reason,
        },
      });
      await eventRepo.save(event);

      // Send notification to new assignee
      const priority = incident.severity === 'critical' || incident.severity === 'error' ? 'high' : 'normal';
      await sendNotificationMessage({
        incidentId: incident.id,
        userId: assignToUserId,
        channel: 'push',
        priority,
        incidentState: 'triggered',
      });
      await sendNotificationMessage({
        incidentId: incident.id,
        userId: assignToUserId,
        channel: 'email',
        priority,
        incidentState: 'triggered',
      });

      // Optionally notify original assignee
      if (notifyOriginalAssignee && previousAssignee) {
        await sendNotificationMessage({
          incidentId: incident.id,
          userId: previousAssignee,
          channel: 'email',
          priority: 'normal',
          incidentState: 'acknowledged', // Use acknowledged to indicate it's been handled
        });
      }

      logger.info('Incident reassigned', {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        fromUserId: previousAssignee,
        toUserId: assignToUserId,
        reassignedBy: user.id,
      });

      return res.json({
        incident: formatIncident(incident),
        message: `Incident reassigned to ${targetUser.fullName || targetUser.email}`,
      });
    } catch (error) {
      logger.error('Error reassigning incident:', error);
      return res.status(500).json({ error: 'Failed to reassign incident' });
    }
  }
);

/**
 * Helper function to get target users from escalation step
 */
async function getStepTargetUsers(step: EscalationStep, scheduleRepo: any): Promise<string[]> {
  if (step.targetType === 'users' && step.userIds) {
    return step.userIds;
  }

  if (step.targetType === 'schedule' && step.scheduleId) {
    const schedule = await scheduleRepo.findOne({
      where: { id: step.scheduleId },
    });

    if (schedule) {
      const oncallUserId = schedule.getCurrentOncallUserId();
      if (oncallUserId) {
        return [oncallUserId];
      }
    }
  }

  return [];
}

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
    assignedAt: incident.assignedAt,
    assignedTo: incident.assignedToUser ? {
      id: incident.assignedToUser.id,
      fullName: incident.assignedToUser.fullName,
      email: incident.assignedToUser.email,
    } : null,
    snoozedUntil: incident.snoozedUntil,
    snoozedBy: incident.snoozedByUser ? {
      id: incident.snoozedByUser.id,
      fullName: incident.snoozedByUser.fullName,
      email: incident.snoozedByUser.email,
    } : null,
    isSnoozed: incident.isSnoozed(),
    currentEscalationStep: incident.currentEscalationStep,
    eventCount: incident.eventCount,
    lastEventAt: incident.lastEventAt,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  };
}

/**
 * Helper function to get escalation status for an incident
 */
async function getEscalationStatus(
  incident: Incident,
  serviceRepo: any,
  scheduleRepo: any,
  userRepo: any
): Promise<{
  policyName: string | null;
  currentStep: number;
  totalSteps: number;
  stepStartedAt: Date | null;
  timeoutAt: Date | null;
  currentStepTimeoutSeconds: number | null;
  currentTargets: Array<{ userId: string; name: string; email: string }>;
  isEscalating: boolean;
} | null> {
  // Get service with escalation policy
  const service = await serviceRepo.findOne({
    where: { id: incident.serviceId },
    relations: ['escalationPolicy', 'escalationPolicy.steps'],
  });

  if (!service?.escalationPolicy) {
    return null;
  }

  const policy = service.escalationPolicy;
  const steps = policy.steps.sort((a: EscalationStep, b: EscalationStep) => a.stepOrder - b.stepOrder);
  const totalSteps = steps.length;
  const currentStepIndex = incident.currentEscalationStep - 1;
  const currentStep = steps[currentStepIndex];

  // Calculate timeout
  let timeoutAt: Date | null = null;
  let currentStepTimeoutSeconds: number | null = null;

  if (currentStep && incident.escalationStartedAt && incident.state === 'triggered') {
    currentStepTimeoutSeconds = currentStep.timeoutSeconds;
    timeoutAt = new Date(
      new Date(incident.escalationStartedAt).getTime() + currentStep.timeoutSeconds * 1000
    );
  }

  // Get current target users
  const currentTargets: Array<{ userId: string; name: string; email: string }> = [];

  if (currentStep) {
    if (currentStep.targetType === 'users' && currentStep.userIds) {
      // Direct user targets
      const users = await userRepo.find({
        where: currentStep.userIds.map((userId: string) => ({ id: userId })),
      });
      for (const user of users) {
        currentTargets.push({
          userId: user.id,
          name: user.fullName || user.email,
          email: user.email,
        });
      }
    } else if (currentStep.targetType === 'schedule' && currentStep.scheduleId) {
      // Schedule target - get current on-call user
      const schedule = await scheduleRepo.findOne({
        where: { id: currentStep.scheduleId },
      });
      if (schedule) {
        const oncallUserId = schedule.getCurrentOncallUserId();
        if (oncallUserId) {
          const oncallUser = await userRepo.findOne({ where: { id: oncallUserId } });
          if (oncallUser) {
            currentTargets.push({
              userId: oncallUser.id,
              name: oncallUser.fullName || oncallUser.email,
              email: oncallUser.email,
            });
          }
        }
      }
    }
  }

  return {
    policyName: policy.name,
    currentStep: incident.currentEscalationStep,
    totalSteps,
    stepStartedAt: incident.escalationStartedAt,
    timeoutAt,
    currentStepTimeoutSeconds,
    currentTargets,
    isEscalating: incident.state === 'triggered' && !incident.isSnoozed(),
  };
}

/**
 * DELETE /api/v1/incidents/:id
 * Delete an incident (admin only)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const user = req.user!;

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete incidents' });
    }

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);

    const incident = await incidentRepo.findOne({
      where: { id, orgId },
      relations: ['service'],
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const incidentNumber = incident.incidentNumber;
    const summary = incident.summary;

    // Delete the incident (cascade will delete events and notifications)
    await incidentRepo.remove(incident);

    logger.info('Incident deleted', {
      incidentId: id,
      incidentNumber,
      deletedBy: user.id,
    });

    return res.json({
      message: `Incident #${incidentNumber} deleted successfully`,
      deleted: {
        id,
        incidentNumber,
        summary,
      },
    });
  } catch (error) {
    logger.error('Error deleting incident:', error);
    return res.status(500).json({ error: 'Failed to delete incident' });
  }
});

export default router;
