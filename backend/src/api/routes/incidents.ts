import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Incident, IncidentEvent, User, Service, EscalationStep, Schedule, Notification, Runbook } from '../../shared/models';
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
      relations: ['service', 'acknowledgedByUser', 'resolvedByUser', 'assignedToUser'],
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
 * GET /api/v1/incidents/:id/notifications
 * Get notification statuses for an incident
 */
router.get('/:id/notifications', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const notificationRepo = dataSource.getRepository(Notification);

    // Verify incident exists and belongs to org
    const incident = await incidentRepo.findOne({
      where: { id, orgId },
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Get all notifications for this incident
    const notifications = await notificationRepo.find({
      where: { incidentId: id },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    // Group by user and format
    const userNotifications = new Map<string, {
      userId: string;
      userName: string;
      userEmail: string;
      channels: Array<{
        channel: string;
        status: string;
        sentAt: Date | null;
        deliveredAt: Date | null;
        failedAt: Date | null;
        errorMessage: string | null;
      }>;
    }>();

    for (const notification of notifications) {
      const userId = notification.userId;
      if (!userNotifications.has(userId)) {
        userNotifications.set(userId, {
          userId,
          userName: notification.user?.fullName || notification.user?.email || 'Unknown',
          userEmail: notification.user?.email || '',
          channels: [],
        });
      }

      userNotifications.get(userId)!.channels.push({
        channel: notification.channel,
        status: notification.status,
        sentAt: notification.sentAt,
        deliveredAt: notification.deliveredAt,
        failedAt: notification.failedAt,
        errorMessage: notification.errorMessage,
      });
    }

    // Summary stats
    const summary = {
      total: notifications.length,
      pending: notifications.filter(n => n.status === 'pending').length,
      sent: notifications.filter(n => n.status === 'sent').length,
      delivered: notifications.filter(n => n.status === 'delivered').length,
      failed: notifications.filter(n => n.status === 'failed').length,
    };

    return res.json({
      notifications: Array.from(userNotifications.values()),
      summary,
    });
  } catch (error) {
    logger.error('Error fetching incident notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch incident notifications' });
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
    const { note } = req.body || {};
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

    // Create resolve event
    const event = eventRepo.create({
      incidentId: incident.id,
      type: 'resolve',
      actorId: user.id,
      message: `Incident resolved by ${user.fullName || user.email}`,
    });
    await eventRepo.save(event);

    // If a resolution note was provided, create a note event
    if (note && typeof note === 'string' && note.trim()) {
      const noteEvent = eventRepo.create({
        incidentId: incident.id,
        type: 'note',
        actorId: user.id,
        message: `[Resolution Note] ${note.trim()}`,
      });
      await eventRepo.save(noteEvent);
    }

    logger.info('Incident resolved', {
      incidentId: incident.id,
      userId: user.id,
      incidentNumber: incident.incidentNumber,
      hasNote: !!note,
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
  policyId: string | null;
  currentStep: number;
  totalSteps: number;
  stepStartedAt: Date | null;
  timeoutAt: Date | null;
  currentStepTimeoutSeconds: number | null;
  currentTargets: Array<{ userId: string; name: string; email: string }>;
  nextTargets: Array<{ userId: string; name: string; email: string }> | null;
  steps: Array<{
    position: number;
    status: 'completed' | 'active' | 'pending';
    targetDescription: string;
    delayMinutes: number;
  }>;
  loopsRemaining: number | null;
  repeatEnabled: boolean;
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
  const nextStep = steps[currentStepIndex + 1];

  // Calculate timeout
  let timeoutAt: Date | null = null;
  let currentStepTimeoutSeconds: number | null = null;

  if (currentStep && incident.escalationStartedAt && incident.state === 'triggered') {
    currentStepTimeoutSeconds = currentStep.timeoutSeconds;
    timeoutAt = new Date(
      new Date(incident.escalationStartedAt).getTime() + currentStep.timeoutSeconds * 1000
    );
  }

  // Helper to get target description for a step
  const getTargetDescription = async (step: EscalationStep): Promise<string> => {
    if (step.targetType === 'users' && step.userIds && step.userIds.length > 0) {
      const users = await userRepo.find({
        where: step.userIds.map((userId: string) => ({ id: userId })),
      });
      return users.map((u: any) => u.fullName || u.email).join(', ');
    } else if (step.targetType === 'schedule' && step.scheduleId) {
      const schedule = await scheduleRepo.findOne({ where: { id: step.scheduleId } });
      if (schedule) {
        const oncallUserId = schedule.getCurrentOncallUserId();
        if (oncallUserId) {
          const oncallUser = await userRepo.findOne({ where: { id: oncallUserId } });
          if (oncallUser) {
            return `${oncallUser.fullName || oncallUser.email} (${schedule.name})`;
          }
        }
        return `${schedule.name} (no one on-call)`;
      }
    }
    return 'Unknown target';
  };

  // Helper to get targets for a step
  const getTargetsForStep = async (step: EscalationStep): Promise<Array<{ userId: string; name: string; email: string }>> => {
    const targets: Array<{ userId: string; name: string; email: string }> = [];

    if (step.targetType === 'users' && step.userIds) {
      const users = await userRepo.find({
        where: step.userIds.map((userId: string) => ({ id: userId })),
      });
      for (const user of users) {
        targets.push({
          userId: user.id,
          name: user.fullName || user.email,
          email: user.email,
        });
      }
    } else if (step.targetType === 'schedule' && step.scheduleId) {
      const schedule = await scheduleRepo.findOne({ where: { id: step.scheduleId } });
      if (schedule) {
        const oncallUserId = schedule.getCurrentOncallUserId();
        if (oncallUserId) {
          const oncallUser = await userRepo.findOne({ where: { id: oncallUserId } });
          if (oncallUser) {
            targets.push({
              userId: oncallUser.id,
              name: oncallUser.fullName || oncallUser.email,
              email: oncallUser.email,
            });
          }
        }
      }
    }
    return targets;
  };

  // Get current target users
  const currentTargets = currentStep ? await getTargetsForStep(currentStep) : [];

  // Get next target users (who will be notified if escalation happens)
  const nextTargets = nextStep ? await getTargetsForStep(nextStep) : null;

  // Build steps array for visual progress bar
  const stepsInfo = await Promise.all(steps.map(async (step: EscalationStep, index: number) => {
    let status: 'completed' | 'active' | 'pending' = 'pending';
    if (index < currentStepIndex) {
      status = 'completed';
    } else if (index === currentStepIndex) {
      status = 'active';
    }

    return {
      position: step.stepOrder,
      status,
      targetDescription: await getTargetDescription(step),
      delayMinutes: Math.round(step.timeoutSeconds / 60),
    };
  }));

  return {
    policyName: policy.name,
    policyId: policy.id,
    currentStep: incident.currentEscalationStep,
    totalSteps,
    stepStartedAt: incident.escalationStartedAt,
    timeoutAt,
    currentStepTimeoutSeconds,
    currentTargets,
    nextTargets,
    steps: stepsInfo,
    loopsRemaining: null, // TODO: Add escalationLoopsRemaining to Incident model
    repeatEnabled: policy.repeatEnabled,
    isEscalating: incident.state === 'triggered',
  };
}

/**
 * GET /api/v1/incidents/:id/similar
 * Find similar incidents for context and resolution hints
 */
router.get('/:id/similar', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);

    // Get the current incident
    const currentIncident = await incidentRepo.findOne({
      where: { id, orgId },
      relations: ['service'],
    });

    if (!currentIncident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Find similar incidents from the same service in the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const candidates = await incidentRepo
      .createQueryBuilder('incident')
      .leftJoinAndSelect('incident.service', 'service')
      .leftJoinAndSelect('incident.resolvedByUser', 'resolver')
      .where('incident.org_id = :orgId', { orgId })
      .andWhere('incident.service_id = :serviceId', { serviceId: currentIncident.serviceId })
      .andWhere('incident.id != :currentId', { currentId: id })
      .andWhere('incident.triggered_at > :since', { since: ninetyDaysAgo })
      .orderBy('incident.triggered_at', 'DESC')
      .take(50) // Get more candidates for scoring
      .getMany();

    // Score and rank candidates
    const scored = candidates.map(incident => {
      let score = 0;

      // Same severity = +3 points
      if (incident.severity === currentIncident.severity) {
        score += 3;
      }

      // Word overlap in summary = +2 points per matching word
      const currentWords = extractKeywords(currentIncident.summary);
      const candidateWords = extractKeywords(incident.summary);
      const matchingWords = currentWords.filter(w => candidateWords.includes(w));
      score += matchingWords.length * 2;

      // Resolved incidents are more valuable = +5 points (they have resolution info)
      if (incident.state === 'resolved') {
        score += 5;
      }

      // Recency bonus (more recent = more relevant)
      const daysSince = (Date.now() - new Date(incident.triggeredAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) score += 3;
      else if (daysSince < 14) score += 2;
      else if (daysSince < 30) score += 1;

      // Calculate similarity percentage (rough estimate)
      const maxPossibleScore = 3 + (currentWords.length * 2) + 5 + 3;
      const similarityPercent = Math.min(100, Math.round((score / maxPossibleScore) * 100));

      return {
        incident,
        score,
        similarityPercent,
        matchingWords,
      };
    });

    // Sort by score and take top results
    const topMatches = scored
      .filter(s => s.score >= 3) // Minimum threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // For the top match, try to get resolution note if resolved
    const results = await Promise.all(topMatches.map(async (match) => {
      let resolutionNote: string | null = null;

      if (match.incident.state === 'resolved') {
        // Find resolution note from events
        const resolveEvents = await eventRepo.find({
          where: {
            incidentId: match.incident.id,
            type: 'note',
          },
          order: { createdAt: 'DESC' },
          take: 5,
        });

        // Look for resolution-related notes
        const resolutionEvent = resolveEvents.find(e =>
          e.message?.toLowerCase().includes('resolution') ||
          e.message?.toLowerCase().includes('fixed') ||
          e.message?.toLowerCase().includes('resolved') ||
          e.message?.startsWith('[Resolution Note]') ||
          e.message?.startsWith('[')
        ) || resolveEvents[0];

        if (resolutionEvent) {
          resolutionNote = resolutionEvent.message?.replace('[Resolution Note] ', '') || null;
        }
      }

      return {
        id: match.incident.id,
        incidentNumber: match.incident.incidentNumber,
        summary: match.incident.summary,
        severity: match.incident.severity,
        state: match.incident.state,
        triggeredAt: match.incident.triggeredAt,
        resolvedAt: match.incident.resolvedAt,
        resolvedBy: match.incident.resolvedByUser ? {
          id: match.incident.resolvedByUser.id,
          fullName: match.incident.resolvedByUser.fullName,
        } : null,
        similarityPercent: match.similarityPercent,
        matchingKeywords: match.matchingWords,
        resolutionNote,
      };
    }));

    // Get the best match for the "hint" display
    const bestMatch = results.length > 0 && results[0].similarityPercent >= 40 ? results[0] : null;

    return res.json({
      currentIncidentId: id,
      bestMatch,
      similarIncidents: results,
      total: results.length,
    });
  } catch (error) {
    logger.error('Error finding similar incidents:', error);
    return res.status(500).json({ error: 'Failed to find similar incidents' });
  }
});

/**
 * GET /api/v1/incidents/:id/suggested-runbooks
 * Get runbooks suggested for this incident based on content matching
 */
router.get('/:id/suggested-runbooks', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const runbookRepo = dataSource.getRepository(Runbook);

    // Get the current incident
    const incident = await incidentRepo.findOne({
      where: { id, orgId },
      relations: ['service'],
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Get all active runbooks for this service
    const runbooks = await runbookRepo.find({
      where: { serviceId: incident.serviceId, orgId, isActive: true },
      relations: ['service', 'createdBy'],
    });

    if (runbooks.length === 0) {
      return res.json({
        incidentId: id,
        suggestedRunbooks: [],
        total: 0,
      });
    }

    // Extract keywords from incident summary
    const incidentKeywords = extractKeywords(incident.summary);

    // Score each runbook
    const scored = runbooks.map(runbook => {
      let score = 0;
      const matchReasons: string[] = [];

      // Tag matching: +5 points per matching tag
      const matchingTags = (runbook.tags || []).filter(tag =>
        incidentKeywords.some(keyword =>
          keyword.includes(tag.toLowerCase()) || tag.toLowerCase().includes(keyword)
        )
      );
      if (matchingTags.length > 0) {
        score += matchingTags.length * 5;
        matchReasons.push(`Tags: ${matchingTags.join(', ')}`);
      }

      // Title keyword matching: +3 points per match
      const titleKeywords = extractKeywords(runbook.title);
      const titleMatches = titleKeywords.filter(k => incidentKeywords.includes(k));
      if (titleMatches.length > 0) {
        score += titleMatches.length * 3;
        matchReasons.push(`Title keywords: ${titleMatches.join(', ')}`);
      }

      // Description keyword matching: +1 point per match
      if (runbook.description) {
        const descKeywords = extractKeywords(runbook.description);
        const descMatches = descKeywords.filter(k => incidentKeywords.includes(k));
        if (descMatches.length > 0) {
          score += descMatches.length;
          matchReasons.push(`${descMatches.length} description keyword matches`);
        }
      }

      // Severity matching: +3 points if runbook targets this severity
      if (runbook.severity && runbook.severity.length > 0) {
        if (runbook.severity.includes(incident.severity)) {
          score += 3;
          matchReasons.push(`Severity: ${incident.severity}`);
        }
      } else {
        // No severity filter = applies to all = +1 bonus
        score += 1;
      }

      // Calculate relevance percentage
      const maxScore = (runbook.tags?.length || 0) * 5 + titleKeywords.length * 3 + 10;
      const relevancePercent = Math.min(100, Math.round((score / Math.max(maxScore, 10)) * 100));

      return {
        runbook,
        score,
        relevancePercent,
        matchReasons,
      };
    });

    // Filter to only runbooks with some relevance and sort by score
    const suggested = scored
      .filter(s => s.score >= 3) // Minimum threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 suggestions

    return res.json({
      incidentId: id,
      suggestedRunbooks: suggested.map(s => ({
        id: s.runbook.id,
        title: s.runbook.title,
        description: s.runbook.description,
        stepCount: s.runbook.steps?.length || 0,
        tags: s.runbook.tags || [],
        relevancePercent: s.relevancePercent,
        matchReasons: s.matchReasons,
        externalUrl: s.runbook.externalUrl,
      })),
      total: suggested.length,
    });
  } catch (error) {
    logger.error('Error getting suggested runbooks:', error);
    return res.status(500).json({ error: 'Failed to get suggested runbooks' });
  }
});

/**
 * Helper to extract meaningful keywords from incident summary
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'under', 'again', 'further', 'then', 'once', 'and',
    'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'not',
    'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also', 'now',
    'alert', 'firing', 'resolved', 'warning', 'error', 'critical', 'info',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
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
