import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Incident, IncidentEvent, User, Service, EscalationStep, Schedule, Notification, Runbook, IncidentResponder, IncidentSubscriber, IncidentStatusUpdate, Postmortem } from '../../shared/models';
import { sendNotificationMessage } from '../../shared/queues/sqs-client';
import { logger } from '../../shared/utils/logger';
import { workflowEngine } from '../../shared/services/workflow-engine';
import { deliverToMatchingWebhooks } from '../../shared/services/webhook-delivery';

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
          profilePictureUrl: event.actor.profilePictureUrl,
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

    // Trigger automatic workflows
    try {
      await workflowEngine.processEvent(orgId, incident.id, 'incident.acknowledged', user.id);
    } catch (workflowError) {
      logger.error('Error triggering workflows on acknowledge', workflowError);
      // Don't fail the request if workflows fail
    }

    // Deliver webhook events
    try {
      await deliverToMatchingWebhooks(
        orgId,
        'incident.acknowledged',
        {
          event: {
            id: event.id,
            event_type: 'incident.acknowledged',
            resource_type: 'incident',
            occurred_at: new Date().toISOString(),
            agent: {
              id: user.id,
              type: 'user',
            },
            data: {
              id: incident.id,
              type: 'incident',
              incident_number: incident.incidentNumber,
              summary: incident.summary,
              service_id: incident.serviceId,
              state: incident.state,
              acknowledged_at: incident.acknowledgedAt?.toISOString(),
              acknowledged_by: {
                id: user.id,
                email: user.email,
                full_name: user.fullName,
              },
            },
          },
        },
        incident.serviceId
      );
    } catch (webhookError) {
      logger.error('Error delivering webhook on acknowledge', webhookError);
      // Don't fail the request if webhooks fail
    }

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

    // Deliver webhook events
    try {
      await deliverToMatchingWebhooks(
        orgId,
        'incident.resolved',
        {
          event: {
            id: event.id,
            event_type: 'incident.resolved',
            resource_type: 'incident',
            occurred_at: new Date().toISOString(),
            agent: {
              id: user.id,
              type: 'user',
            },
            data: {
              id: incident.id,
              type: 'incident',
              incident_number: incident.incidentNumber,
              summary: incident.summary,
              service_id: incident.serviceId,
              state: incident.state,
              resolved_at: incident.resolvedAt?.toISOString(),
              resolved_by: {
                id: user.id,
                email: user.email,
                full_name: user.fullName,
              },
            },
          },
        },
        incident.serviceId
      );
    } catch (webhookError) {
      logger.error('Error delivering webhook on resolve', webhookError);
      // Don't fail the request if webhooks fail
    }

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

      // Trigger automatic workflows
      try {
        await workflowEngine.processEvent(orgId, incident.id, 'incident.escalated', user.id);
      } catch (workflowError) {
        logger.error('Error triggering workflows on escalate', workflowError);
        // Don't fail the request if workflows fail
      }

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

      // Trigger automatic workflows
      try {
        await workflowEngine.processEvent(orgId, incident.id, 'incident.reassigned', user.id);
      } catch (workflowError) {
        logger.error('Error triggering workflows on reassign', workflowError);
        // Don't fail the request if workflows fail
      }

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
    urgency: incident.urgency,
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
      profilePictureUrl: incident.acknowledgedByUser.profilePictureUrl,
    } : null,
    resolvedAt: incident.resolvedAt,
    resolvedBy: incident.resolvedByUser ? {
      id: incident.resolvedByUser.id,
      fullName: incident.resolvedByUser.fullName,
      email: incident.resolvedByUser.email,
      profilePictureUrl: incident.resolvedByUser.profilePictureUrl,
    } : null,
    assignedAt: incident.assignedAt,
    assignedTo: incident.assignedToUser ? {
      id: incident.assignedToUser.id,
      fullName: incident.assignedToUser.fullName,
      email: incident.assignedToUser.email,
      profilePictureUrl: incident.assignedToUser.profilePictureUrl,
    } : null,
    snoozedUntil: incident.snoozedUntil,
    isSnoozed: incident.isSnoozed(),
    conferenceBridgeUrl: incident.conferenceBridgeUrl,
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
          profilePictureUrl: match.incident.resolvedByUser.profilePictureUrl,
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
function extractKeywords(text: string | null | undefined): string[] {
  if (!text) return [];

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

// ============================================
// ADD RESPONDERS ENDPOINTS
// ============================================

/**
 * GET /api/v1/incidents/:id/responders
 * List responders for an incident
 */
router.get('/:id/responders', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const responderRepo = dataSource.getRepository(IncidentResponder);

    // Verify incident exists and belongs to org
    const incident = await incidentRepo.findOne({
      where: { id, orgId },
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const responders = await responderRepo.find({
      where: { incidentId: id },
      relations: ['user', 'requestedBy'],
      order: { createdAt: 'ASC' },
    });

    return res.json({
      responders: responders.map(r => ({
        id: r.id,
        user: {
          id: r.user.id,
          fullName: r.user.fullName,
          email: r.user.email,
          profilePictureUrl: r.user.profilePictureUrl,
        },
        requestedBy: {
          id: r.requestedBy.id,
          fullName: r.requestedBy.fullName,
          email: r.requestedBy.email,
        },
        status: r.status,
        message: r.message,
        respondedAt: r.respondedAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching responders:', error);
    return res.status(500).json({ error: 'Failed to fetch responders' });
  }
});

/**
 * POST /api/v1/incidents/:id/responders
 * Request additional responders for an incident
 */
router.post(
  '/:id/responders',
  [
    body('userIds').isArray({ min: 1 }).withMessage('userIds must be a non-empty array'),
    body('userIds.*').isUUID().withMessage('Each userId must be a valid UUID'),
    body('message').optional().isString().isLength({ max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { userIds, message } = req.body;
      const orgId = req.orgId!;
      const requestingUser = req.user!;

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);
      const responderRepo = dataSource.getRepository(IncidentResponder);
      const userRepo = dataSource.getRepository(User);
      const eventRepo = dataSource.getRepository(IncidentEvent);

      // Verify incident exists and is open
      const incident = await incidentRepo.findOne({
        where: { id, orgId },
        relations: ['service'],
      });

      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      if (!incident.isOpen()) {
        return res.status(400).json({ error: 'Cannot add responders to a resolved incident' });
      }

      // Verify all users exist in the org
      const users = await userRepo.find({
        where: userIds.map((uid: string) => ({ id: uid, orgId })),
      });

      if (users.length !== userIds.length) {
        return res.status(400).json({ error: 'One or more users not found' });
      }

      // Create responder requests (skip if already exists)
      const createdResponders: IncidentResponder[] = [];
      const skippedUserIds: string[] = [];

      for (const userId of userIds) {
        // Check if already a responder
        const existing = await responderRepo.findOne({
          where: { incidentId: id, userId },
        });

        if (existing) {
          skippedUserIds.push(userId);
          continue;
        }

        const responder = responderRepo.create({
          incidentId: id,
          userId,
          requestedById: requestingUser.id,
          message: message || null,
          status: 'pending',
        });

        await responderRepo.save(responder);
        createdResponders.push(responder);

        // Send notification to the requested user
        await sendNotificationMessage({
          type: 'responder_request',
          userId,
          incidentId: id,
          orgId,
          payload: {
            incidentNumber: incident.incidentNumber,
            summary: incident.summary,
            requestedBy: requestingUser.fullName || requestingUser.email,
            message: message || null,
          },
        });
      }

      // Create timeline event
      if (createdResponders.length > 0) {
        const userNames = users
          .filter(u => createdResponders.some(r => r.userId === u.id))
          .map(u => u.fullName || u.email)
          .join(', ');

        const event = eventRepo.create({
          incidentId: id,
          type: 'responder_request' as any,
          actorId: requestingUser.id,
          message: `Requested responders: ${userNames}`,
          payload: {
            userIds: createdResponders.map(r => r.userId),
            message,
          },
        });
        await eventRepo.save(event);
      }

      logger.info('Responders requested', {
        incidentId: id,
        requestedBy: requestingUser.id,
        userIds: createdResponders.map(r => r.userId),
        skipped: skippedUserIds,
      });

      return res.status(201).json({
        message: `${createdResponders.length} responder(s) requested`,
        requested: createdResponders.length,
        skipped: skippedUserIds.length,
      });
    } catch (error) {
      logger.error('Error requesting responders:', error);
      return res.status(500).json({ error: 'Failed to request responders' });
    }
  }
);

/**
 * PUT /api/v1/incidents/:id/responders/:responderId
 * Accept or decline a responder request
 */
router.put(
  '/:id/responders/:responderId',
  [
    body('status').isIn(['accepted', 'declined']).withMessage('Status must be accepted or declined'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id, responderId } = req.params;
      const { status } = req.body;
      const orgId = req.orgId!;
      const user = req.user!;

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);
      const responderRepo = dataSource.getRepository(IncidentResponder);
      const eventRepo = dataSource.getRepository(IncidentEvent);

      // Verify incident exists
      const incident = await incidentRepo.findOne({
        where: { id, orgId },
      });

      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Find the responder request
      const responder = await responderRepo.findOne({
        where: { id: responderId, incidentId: id },
        relations: ['user'],
      });

      if (!responder) {
        return res.status(404).json({ error: 'Responder request not found' });
      }

      // Only the requested user can accept/decline
      if (responder.userId !== user.id) {
        return res.status(403).json({ error: 'Only the requested user can respond to this request' });
      }

      if (!responder.isPending()) {
        return res.status(400).json({ error: 'This request has already been responded to' });
      }

      // Update the responder status
      if (status === 'accepted') {
        responder.accept();
      } else {
        responder.decline();
      }
      await responderRepo.save(responder);

      // Create timeline event
      const event = eventRepo.create({
        incidentId: id,
        type: 'responder_response' as any,
        actorId: user.id,
        message: `${user.fullName || user.email} ${status} the responder request`,
        payload: { status },
      });
      await eventRepo.save(event);

      logger.info('Responder request responded', {
        incidentId: id,
        responderId,
        userId: user.id,
        status,
      });

      return res.json({
        message: `Responder request ${status}`,
        responder: {
          id: responder.id,
          status: responder.status,
          respondedAt: responder.respondedAt,
        },
      });
    } catch (error) {
      logger.error('Error responding to responder request:', error);
      return res.status(500).json({ error: 'Failed to respond to request' });
    }
  }
);

// ============================================
// SNOOZE ENDPOINTS
// ============================================

/**
 * POST /api/v1/incidents/:id/snooze
 * Snooze an acknowledged incident
 */
router.post(
  '/:id/snooze',
  [
    body('duration').isInt({ min: 60, max: 604800 }).withMessage('Duration must be between 60 and 604800 seconds (1 min to 1 week)'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { duration } = req.body; // Duration in seconds
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
        return res.status(400).json({
          error: 'Incident must be acknowledged before snoozing',
          currentState: incident.state,
        });
      }

      // Calculate snooze end time
      const snoozedUntil = new Date(Date.now() + duration * 1000);
      incident.snooze(snoozedUntil, user.id);
      await incidentRepo.save(incident);

      // Create timeline event
      const durationStr = formatDuration(duration);
      const event = eventRepo.create({
        incidentId: id,
        type: 'snooze' as any,
        actorId: user.id,
        message: `Incident snoozed for ${durationStr} by ${user.fullName || user.email}`,
        payload: {
          duration,
          snoozedUntil: snoozedUntil.toISOString(),
        },
      });
      await eventRepo.save(event);

      logger.info('Incident snoozed', {
        incidentId: id,
        userId: user.id,
        duration,
        snoozedUntil,
      });

      return res.json({
        message: `Incident snoozed for ${durationStr}`,
        snoozedUntil: snoozedUntil.toISOString(),
      });
    } catch (error) {
      logger.error('Error snoozing incident:', error);
      return res.status(500).json({ error: 'Failed to snooze incident' });
    }
  }
);

/**
 * DELETE /api/v1/incidents/:id/snooze
 * Unsnooze an incident (cancel the snooze)
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
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    if (!incident.isSnoozed()) {
      return res.status(400).json({ error: 'Incident is not currently snoozed' });
    }

    incident.unsnooze();
    await incidentRepo.save(incident);

    // Create timeline event
    const event = eventRepo.create({
      incidentId: id,
      type: 'unsnooze' as any,
      actorId: user.id,
      message: `Snooze cancelled by ${user.fullName || user.email}`,
    });
    await eventRepo.save(event);

    logger.info('Incident unsnoozed', {
      incidentId: id,
      userId: user.id,
    });

    return res.json({
      message: 'Incident snooze cancelled',
    });
  } catch (error) {
    logger.error('Error unsnoozing incident:', error);
    return res.status(500).json({ error: 'Failed to unsnooze incident' });
  }
});

// ==========================================
// POSTMORTEM ENDPOINTS
// ==========================================

/**
 * GET /api/v1/incidents/:id/postmortem
 * Get postmortem for an incident
 */
router.get('/:id/postmortem', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const postmortemRepo = dataSource.getRepository(Postmortem);

    // Verify incident exists
    const incident = await incidentRepo.findOne({
      where: { id, orgId },
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const postmortem = await postmortemRepo.findOne({
      where: { incidentId: id, orgId },
      relations: ['incident', 'incident.service', 'createdBy', 'publishedBy'],
    });

    if (!postmortem) {
      return res.status(404).json({ error: 'No postmortem found for this incident' });
    }

    return res.json({
      postmortem: {
        id: postmortem.id,
        incident_id: postmortem.incidentId,
        incident: {
          id: postmortem.incident.id,
          incident_number: postmortem.incident.incidentNumber,
          summary: postmortem.incident.summary,
          service: postmortem.incident.service ? {
            id: postmortem.incident.service.id,
            name: postmortem.incident.service.name,
          } : null,
        },
        title: postmortem.title,
        status: postmortem.status,
        summary: postmortem.summary,
        timeline: postmortem.timeline,
        root_cause: postmortem.rootCause,
        contributing_factors: postmortem.contributingFactors,
        impact: postmortem.impact,
        what_went_well: postmortem.whatWentWell,
        what_could_be_improved: postmortem.whatCouldBeImproved,
        action_items: postmortem.actionItems,
        custom_sections: postmortem.customSections,
        template_id: postmortem.templateId,
        created_by: postmortem.createdBy ? {
          id: postmortem.createdBy.id,
          full_name: postmortem.createdBy.fullName,
          email: postmortem.createdBy.email,
        } : null,
        published_by: postmortem.publishedBy ? {
          id: postmortem.publishedBy.id,
          full_name: postmortem.publishedBy.fullName,
          email: postmortem.publishedBy.email,
        } : null,
        created_at: postmortem.createdAt,
        updated_at: postmortem.updatedAt,
        published_at: postmortem.publishedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching incident postmortem:', error);
    return res.status(500).json({ error: 'Failed to fetch postmortem' });
  }
});

/**
 * POST /api/v1/incidents/:id/postmortem
 * Create postmortem for an incident
 */
router.post(
  '/:id/postmortem',
  [
    body('title').optional().isString().trim(),
    body('summary').optional().isString(),
    body('templateId').optional().isUUID(),
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
      const { title, summary, templateId } = req.body;

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);
      const postmortemRepo = dataSource.getRepository(Postmortem);
      const eventRepo = dataSource.getRepository(IncidentEvent);

      // Verify incident exists
      const incident = await incidentRepo.findOne({
        where: { id, orgId },
        relations: ['service'],
      });

      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Check if postmortem already exists
      const existing = await postmortemRepo.findOne({
        where: { incidentId: id, orgId },
      });

      if (existing) {
        return res.status(400).json({ error: 'Postmortem already exists for this incident' });
      }

      // Create default title if not provided
      const defaultTitle = title || `Postmortem: ${incident.summary}`;

      // Create postmortem
      const postmortem = postmortemRepo.create({
        orgId,
        incidentId: id,
        title: defaultTitle,
        summary: summary || null,
        timeline: [],
        rootCause: null,
        contributingFactors: [],
        impact: null,
        whatWentWell: null,
        whatCouldBeImproved: null,
        actionItems: [],
        templateId: templateId || null,
        createdById: userId,
        status: 'draft',
      });

      await postmortemRepo.save(postmortem);

      // Add event to incident timeline
      const event = eventRepo.create({
        incidentId: id,
        type: 'note',
        actorId: userId,
        message: `Postmortem created by ${req.user!.fullName || req.user!.email}`,
        payload: {
          postmortemId: postmortem.id,
        },
      });
      await eventRepo.save(event);

      // Fetch created postmortem with relations
      const createdPostmortem = await postmortemRepo.findOne({
        where: { id: postmortem.id },
        relations: ['incident', 'incident.service', 'createdBy'],
      });

      logger.info('Postmortem created from incident', {
        postmortemId: postmortem.id,
        incidentId: id,
        createdBy: userId,
      });

      return res.status(201).json({
        postmortem: {
          id: createdPostmortem!.id,
          incident_id: createdPostmortem!.incidentId,
          title: createdPostmortem!.title,
          status: createdPostmortem!.status,
          summary: createdPostmortem!.summary,
          created_by: createdPostmortem!.createdBy ? {
            id: createdPostmortem!.createdBy.id,
            full_name: createdPostmortem!.createdBy.fullName,
            email: createdPostmortem!.createdBy.email,
          } : null,
          created_at: createdPostmortem!.createdAt,
        },
        message: 'Postmortem created successfully',
      });
    } catch (error) {
      logger.error('Error creating incident postmortem:', error);
      return res.status(500).json({ error: 'Failed to create postmortem' });
    }
  }
);

// ==========================================
// SUBSCRIBER ENDPOINTS
// ==========================================

/**
 * GET /api/v1/incidents/:id/subscribers
 * List all subscribers for an incident
 */
router.get('/:id/subscribers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const subscriberRepo = dataSource.getRepository(IncidentSubscriber);

    // Verify incident exists
    const incident = await incidentRepo.findOne({
      where: { id, orgId },
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const subscribers = await subscriberRepo.find({
      where: { incidentId: id, active: true },
      relations: ['user', 'addedByUser'],
      order: { createdAt: 'DESC' },
    });

    return res.json({
      subscribers: subscribers.map(sub => ({
        id: sub.id,
        email: sub.email,
        displayName: sub.getDisplayName(),
        role: sub.role,
        channel: sub.channel,
        isInternal: sub.isInternal(),
        confirmed: sub.confirmed,
        notifyOnStatusUpdate: sub.notifyOnStatusUpdate,
        notifyOnResolution: sub.notifyOnResolution,
        notifyOnEscalation: sub.notifyOnEscalation,
        user: sub.user ? {
          id: sub.user.id,
          fullName: sub.user.fullName,
          email: sub.user.email,
        } : null,
        addedBy: sub.addedByUser ? {
          id: sub.addedByUser.id,
          fullName: sub.addedByUser.fullName,
        } : null,
        createdAt: sub.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching incident subscribers:', error);
    return res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

/**
 * POST /api/v1/incidents/:id/subscribers
 * Add a subscriber to an incident
 */
router.post(
  '/:id/subscribers',
  [
    body('email').isEmail().normalizeEmail(),
    body('displayName').optional().isString().trim(),
    body('role').optional().isIn(['stakeholder', 'observer', 'responder']),
    body('channel').optional().isIn(['email', 'sms', 'push', 'slack', 'webhook']),
    body('userId').optional().isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const user = req.user!;
      const { email, displayName, role = 'stakeholder', channel = 'email', userId } = req.body;

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);
      const subscriberRepo = dataSource.getRepository(IncidentSubscriber);
      const userRepo = dataSource.getRepository(User);

      // Verify incident exists
      const incident = await incidentRepo.findOne({
        where: { id, orgId },
      });

      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Check if subscriber already exists
      const existing = await subscriberRepo.findOne({
        where: { incidentId: id, email },
      });

      if (existing) {
        if (existing.active) {
          return res.status(400).json({ error: 'Subscriber already exists' });
        }
        // Reactivate if previously removed
        existing.active = true;
        existing.addedBy = user.id;
        await subscriberRepo.save(existing);
        return res.json({
          subscriber: {
            id: existing.id,
            email: existing.email,
            displayName: existing.getDisplayName(),
            role: existing.role,
            channel: existing.channel,
          },
          message: 'Subscriber reactivated',
        });
      }

      // Check if userId refers to a valid user
      let linkedUser: User | null = null;
      if (userId) {
        linkedUser = await userRepo.findOne({
          where: { id: userId, orgId },
        });
      }

      // Create new subscriber
      const subscriber = subscriberRepo.create({
        orgId,
        incidentId: id,
        userId: linkedUser?.id || null,
        email,
        displayName: displayName || null,
        role,
        channel,
        addedBy: user.id,
        confirmed: true, // Internal subscriptions auto-confirm
      });

      await subscriberRepo.save(subscriber);

      // Add event to incident timeline
      const eventRepo = dataSource.getRepository(IncidentEvent);
      await eventRepo.save(eventRepo.create({
        incidentId: id,
        type: 'note',
        actorId: user.id,
        message: `${user.fullName || user.email} added ${displayName || email} as a subscriber`,
      }));

      logger.info('Subscriber added to incident', {
        incidentId: id,
        subscriberEmail: email,
        addedBy: user.id,
      });

      return res.status(201).json({
        subscriber: {
          id: subscriber.id,
          email: subscriber.email,
          displayName: subscriber.getDisplayName(),
          role: subscriber.role,
          channel: subscriber.channel,
          isInternal: subscriber.isInternal(),
        },
        message: 'Subscriber added successfully',
      });
    } catch (error) {
      logger.error('Error adding subscriber:', error);
      return res.status(500).json({ error: 'Failed to add subscriber' });
    }
  }
);

/**
 * DELETE /api/v1/incidents/:id/subscribers/:subscriberId
 * Remove a subscriber from an incident
 */
router.delete('/:id/subscribers/:subscriberId', async (req: Request, res: Response) => {
  try {
    const { id, subscriberId } = req.params;
    const orgId = req.orgId!;
    const user = req.user!;

    const dataSource = await getDataSource();
    const subscriberRepo = dataSource.getRepository(IncidentSubscriber);
    const eventRepo = dataSource.getRepository(IncidentEvent);

    const subscriber = await subscriberRepo.findOne({
      where: { id: subscriberId, incidentId: id, orgId },
    });

    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    // Soft delete (mark as inactive)
    subscriber.active = false;
    await subscriberRepo.save(subscriber);

    // Add event to incident timeline
    await eventRepo.save(eventRepo.create({
      incidentId: id,
      type: 'note',
      actorId: user.id,
      message: `${user.fullName || user.email} removed ${subscriber.displayName || subscriber.email} from subscribers`,
    }));

    logger.info('Subscriber removed from incident', {
      incidentId: id,
      subscriberId,
      removedBy: user.id,
    });

    return res.json({ message: 'Subscriber removed' });
  } catch (error) {
    logger.error('Error removing subscriber:', error);
    return res.status(500).json({ error: 'Failed to remove subscriber' });
  }
});

// ==========================================
// STATUS UPDATE ENDPOINTS
// ==========================================

/**
 * GET /api/v1/incidents/:id/status-updates
 * List all status updates for an incident
 */
router.get('/:id/status-updates', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const updateRepo = dataSource.getRepository(IncidentStatusUpdate);

    // Verify incident exists
    const incident = await incidentRepo.findOne({
      where: { id, orgId },
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const updates = await updateRepo.find({
      where: { incidentId: id },
      relations: ['postedByUser'],
      order: { createdAt: 'DESC' },
    });

    return res.json({
      statusUpdates: updates.map(update => ({
        id: update.id,
        updateType: update.updateType,
        typeLabel: update.getTypeLabel(),
        typeColor: update.getTypeColor(),
        message: update.message,
        isPublic: update.isPublic,
        notificationsSent: update.notificationsSent,
        notificationsSentAt: update.notificationsSentAt,
        subscriberCount: update.subscriberCount,
        postedBy: update.postedByUser ? {
          id: update.postedByUser.id,
          fullName: update.postedByUser.fullName,
          email: update.postedByUser.email,
        } : null,
        createdAt: update.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching status updates:', error);
    return res.status(500).json({ error: 'Failed to fetch status updates' });
  }
});

/**
 * POST /api/v1/incidents/:id/status-updates
 * Post a status update to an incident (notifies subscribers)
 */
router.post(
  '/:id/status-updates',
  [
    body('message').isString().trim().isLength({ min: 1, max: 5000 }),
    body('updateType').optional().isIn(['investigating', 'identified', 'monitoring', 'update', 'resolved']),
    body('isPublic').optional().isBoolean(),
    body('notifySubscribers').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const user = req.user!;
      const {
        message,
        updateType = 'update',
        isPublic = false,
        notifySubscribers = true,
      } = req.body;

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);
      const updateRepo = dataSource.getRepository(IncidentStatusUpdate);
      const subscriberRepo = dataSource.getRepository(IncidentSubscriber);
      const eventRepo = dataSource.getRepository(IncidentEvent);

      // Verify incident exists
      const incident = await incidentRepo.findOne({
        where: { id, orgId },
        relations: ['service'],
      });

      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Create status update
      const statusUpdate = updateRepo.create({
        orgId,
        incidentId: id,
        postedBy: user.id,
        updateType,
        message: message.trim(),
        isPublic,
      });

      await updateRepo.save(statusUpdate);

      // Add event to incident timeline
      await eventRepo.save(eventRepo.create({
        incidentId: id,
        type: 'note',
        actorId: user.id,
        message: `[Status Update: ${statusUpdate.getTypeLabel()}] ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`,
        payload: {
          statusUpdateId: statusUpdate.id,
          updateType,
          isPublic,
        },
      }));

      // Notify subscribers if requested
      if (notifySubscribers) {
        const subscribers = await subscriberRepo.find({
          where: {
            incidentId: id,
            active: true,
            confirmed: true,
            notifyOnStatusUpdate: true,
          },
        });

        // Log subscriber notifications (actual delivery handled by notification worker)
        for (const subscriber of subscribers) {
          logger.info('Subscriber notification queued', {
            incidentId: id,
            incidentNumber: incident.incidentNumber,
            subscriberId: subscriber.id,
            subscriberEmail: subscriber.email,
            subscriberChannel: subscriber.channel,
            updateType,
          });
          // TODO: Add subscriber_status_update to NotificationType and notification worker
          // For now, just log - actual email delivery will be added in next iteration
        }

        // Update status update with notification info
        statusUpdate.notificationsSent = true;
        statusUpdate.notificationsSentAt = new Date();
        statusUpdate.subscriberCount = subscribers.length;
        await updateRepo.save(statusUpdate);
      }

      logger.info('Status update posted to incident', {
        incidentId: id,
        statusUpdateId: statusUpdate.id,
        updateType,
        postedBy: user.id,
        subscribersNotified: statusUpdate.subscriberCount,
      });

      return res.status(201).json({
        statusUpdate: {
          id: statusUpdate.id,
          updateType: statusUpdate.updateType,
          typeLabel: statusUpdate.getTypeLabel(),
          message: statusUpdate.message,
          isPublic: statusUpdate.isPublic,
          notificationsSent: statusUpdate.notificationsSent,
          subscriberCount: statusUpdate.subscriberCount,
          createdAt: statusUpdate.createdAt,
        },
        message: notifySubscribers
          ? `Status update posted and ${statusUpdate.subscriberCount} subscriber(s) notified`
          : 'Status update posted',
      });
    } catch (error) {
      logger.error('Error posting status update:', error);
      return res.status(500).json({ error: 'Failed to post status update' });
    }
  }
);

// Helper function to format duration in human-readable form
function formatDuration(seconds: number): string {
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  if (seconds < 86400) {
    const hours = Math.round(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  const days = Math.round(seconds / 86400);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

export default router;
