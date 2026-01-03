import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Notification, Incident } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { IsNull } from 'typeorm';
import { parsePaginationParams, paginatedResponse, validateSortField } from '../../shared/utils/pagination';
import { notificationFilterValidators } from '../../shared/validators/pagination';
import { notFound, internalError } from '../../shared/utils/problem-details';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * Map notification to mobile-friendly format
 */
function mapNotificationToResponse(notification: Notification & { incident?: Incident }) {
  const incident = notification.incident;

  // Determine notification type based on incident state and timing
  let type: string = 'incident_triggered';
  if (incident) {
    if (incident.resolvedAt) {
      type = 'incident_resolved';
    } else if (incident.acknowledgedAt) {
      type = 'incident_acknowledged';
    }
  }

  // Check if this was an escalation (via metadata)
  if (notification.metadata?.escalation) {
    type = 'escalated';
  }

  // Check if user was assigned
  if (notification.metadata?.assigned) {
    type = 'assigned';
  }

  return {
    id: notification.id,
    type,
    title: getNotificationTitle(type, incident),
    body: incident?.summary || 'Incident notification',
    incidentId: notification.incidentId,
    incidentSummary: incident?.summary,
    severity: incident?.severity || 'info',
    isRead: notification.openedAt !== null,
    createdAt: notification.createdAt.toISOString(),
    actor: notification.metadata?.actor || null,
  };
}

function getNotificationTitle(type: string, incident?: Incident): string {
  const serviceName = incident?.service?.name || 'Service';

  switch (type) {
    case 'incident_triggered':
      return `New incident: ${serviceName}`;
    case 'incident_acknowledged':
      return 'Incident acknowledged';
    case 'incident_resolved':
      return 'Incident resolved';
    case 'escalated':
      return 'Incident escalated to you';
    case 'assigned':
      return 'You were assigned an incident';
    case 'mention':
      return 'You were mentioned';
    default:
      return 'Notification';
  }
}

/**
 * GET /api/v1/notifications
 * Get notification history for the authenticated user
 */
router.get('/', [...notificationFilterValidators], async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const pagination = parsePaginationParams(req.query);
    const sortField = validateSortField('notifications', pagination.sort, 'createdAt');
    const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';
    const unreadOnly = req.query.unread === 'true';

    const dataSource = await getDataSource();
    const notificationRepo = dataSource.getRepository(Notification);

    const queryBuilder = notificationRepo
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.incident', 'incident')
      .leftJoinAndSelect('incident.service', 'service')
      .where('notification.userId = :userId', { userId: user.id })
      .orderBy(`notification.${sortField}`, sortOrder)
      .skip(pagination.offset)
      .take(pagination.limit);

    if (unreadOnly) {
      queryBuilder.andWhere('notification.openedAt IS NULL');
    }

    const [notifications, total] = await queryBuilder.getManyAndCount();

    // Count unread
    const unreadCount = await notificationRepo.count({
      where: {
        userId: user.id,
        openedAt: IsNull(),
      },
    });

    const mappedNotifications = notifications.map(mapNotificationToResponse);
    const lastItem = notifications[notifications.length - 1];

    const response = paginatedResponse(
      mappedNotifications,
      total,
      pagination,
      lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
      'notifications'
    );

    return res.json({
      ...response,
      unreadCount,
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    return internalError(res, req.requestId);
  }
});

/**
 * PUT /api/v1/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const dataSource = await getDataSource();
    const notificationRepo = dataSource.getRepository(Notification);

    const notification = await notificationRepo.findOne({
      where: { id, userId: user.id },
    });

    if (!notification) {
      return notFound(res, 'Notification', id);
    }

    if (!notification.openedAt) {
      notification.openedAt = new Date();
      await notificationRepo.save(notification);
    }

    return res.json({
      message: 'Notification marked as read',
      notification: {
        id: notification.id,
        isRead: true,
      },
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    return internalError(res, req.requestId);
  }
});

/**
 * PUT /api/v1/notifications/read-all
 * Mark all notifications as read for the authenticated user
 */
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const dataSource = await getDataSource();
    const notificationRepo = dataSource.getRepository(Notification);

    const result = await notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ openedAt: new Date() })
      .where('userId = :userId', { userId: user.id })
      .andWhere('openedAt IS NULL')
      .execute();

    return res.json({
      message: 'All notifications marked as read',
      updatedCount: result.affected || 0,
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    return internalError(res, req.requestId);
  }
});

/**
 * GET /api/v1/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const dataSource = await getDataSource();
    const notificationRepo = dataSource.getRepository(Notification);

    const count = await notificationRepo.count({
      where: {
        userId: user.id,
        openedAt: IsNull(),
      },
    });

    return res.json({ count });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    return internalError(res, req.requestId);
  }
});

export default router;
