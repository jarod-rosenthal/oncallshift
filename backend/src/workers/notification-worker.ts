import 'dotenv/config';
import { getDataSource } from '../shared/db/data-source';
import { processQueue, NotificationMessage } from '../shared/queues/sqs-client';
import { sendPushNotification } from '../shared/notifications/push-service';
import { sendSMSNotification } from '../shared/notifications/sms-service';
import { sendEmailNotification } from '../shared/notifications/email-service';
import { sendVoiceCall } from '../shared/notifications/voice-call';
import { Incident } from '../shared/models/Incident';
import { Service } from '../shared/models/Service';
import { User } from '../shared/models/User';
import { NotificationBundle } from '../shared/models/NotificationBundle';
import { logger } from '../shared/utils/logger';

const QUEUE_URL = process.env.NOTIFICATIONS_QUEUE_URL;
const BUNDLE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (reduced from 30 for faster low-urgency delivery)

/**
 * Check if user is currently in Do Not Disturb mode
 * Returns true if notification should be blocked by DND
 */
function isInDNDPeriod(user: User): boolean {
  if (!user.dndEnabled || !user.dndStartTime || !user.dndEndTime || !user.dndTimezone) {
    return false;
  }

  try {
    const now = new Date();
    const timezone = user.dndTimezone;

    // Convert current time to user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const hourPart = parts.find(p => p.type === 'hour');
    const minutePart = parts.find(p => p.type === 'minute');

    if (!hourPart || !minutePart) {
      logger.warn('Failed to parse timezone for DND check', { userId: user.id, timezone });
      return false; // If parsing fails, don't block notification
    }

    const currentTime = `${hourPart.value}:${minutePart.value}`;
    const startTime = user.dndStartTime;
    const endTime = user.dndEndTime;

    // Handle case where DND period crosses midnight
    if (startTime > endTime) {
      // e.g., 22:00 to 08:00 (overnight)
      return currentTime >= startTime || currentTime < endTime;
    } else {
      // e.g., 13:00 to 17:00 (same day)
      return currentTime >= startTime && currentTime < endTime;
    }
  } catch (error) {
    logger.error('Error checking DND period', { error, userId: user.id });
    return false; // If error, don't block notification
  }
}

/**
 * Check if notification should be sent based on service urgency and support hours
 */
function checkUrgencyBasedNotification(service: Service, incident: Incident): boolean {
  // High urgency: always notify immediately
  if (service.urgency === 'high') {
    return true;
  }

  // Critical and error incidents: always notify regardless of urgency settings
  if (incident.severity === 'critical' || incident.severity === 'error') {
    return true;
  }

  // Low urgency: only notify during support hours (if configured)
  if (service.urgency === 'low' || service.urgency === 'dynamic') {
    // If no support hours configured, notify immediately
    if (!service.supportHours || !service.supportHours.enabled) {
      return true;
    }

    // Check if current time is within support hours
    const now = new Date();
    const supportHours = service.supportHours;

    // Convert current time to service timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: supportHours.timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const weekdayPart = parts.find(p => p.type === 'weekday');
    const hourPart = parts.find(p => p.type === 'hour');
    const minutePart = parts.find(p => p.type === 'minute');

    if (!weekdayPart || !hourPart || !minutePart) {
      // If timezone parsing fails, default to notifying
      return true;
    }

    // Map weekday to number (0 = Sunday, 1 = Monday, etc.)
    const weekdayMap: Record<string, number> = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    const currentDay = weekdayMap[weekdayPart.value] ?? 0;
    const currentTime = `${hourPart.value}:${minutePart.value}`;

    // Check if current day is in support days
    if (!supportHours.days.includes(currentDay)) {
      logger.debug('Outside support days', {
        currentDay,
        supportDays: supportHours.days,
      });
      return false;
    }

    // Check if current time is within support hours
    if (currentTime < supportHours.startTime || currentTime >= supportHours.endTime) {
      logger.debug('Outside support hours', {
        currentTime,
        supportStart: supportHours.startTime,
        supportEnd: supportHours.endTime,
      });
      return false;
    }

    // Within support hours
    return true;
  }

  // Default: notify
  return true;
}

/**
 * Add notification to bundle for low-urgency incidents
 * Returns true if notification was bundled, false if should send immediately
 */
async function addToNotificationBundle(
  userId: string,
  orgId: string,
  incidentId: string
): Promise<boolean> {
  try {
    const dataSource = await getDataSource();
    const bundleRepo = dataSource.getRepository(NotificationBundle);

    // Find or create pending bundle for this user
    let bundle = await bundleRepo.findOne({
      where: { userId, status: 'pending' },
    });

    if (!bundle) {
      // Create new bundle
      bundle = bundleRepo.create({
        userId,
        orgId,
        status: 'pending',
        notificationCount: 0,
        incidentIds: [],
      });
    }

    // Add incident to bundle if not already included
    if (!bundle.incidentIds.includes(incidentId)) {
      bundle.incidentIds.push(incidentId);
      bundle.notificationCount = bundle.incidentIds.length;
      await bundleRepo.save(bundle);

      logger.info('Added notification to bundle', {
        bundleId: bundle.id,
        incidentId,
        userId,
        totalCount: bundle.notificationCount,
      });
    }

    return true; // Notification was bundled
  } catch (error) {
    logger.error('Error adding notification to bundle', { error, userId, incidentId });
    return false; // If bundling fails, send immediately
  }
}

/**
 * Send notification bundle digest to user
 */
async function sendNotificationBundle(bundle: NotificationBundle): Promise<void> {
  try {
    logger.info('Sending notification bundle', {
      bundleId: bundle.id,
      userId: bundle.userId,
      incidentCount: bundle.notificationCount,
    });

    // For now, send email digest (can be extended to other channels)
    // Note: bundleId and bundledIncidentIds would be sent once email service supports bundles
    await sendEmailNotification({
      incidentId: bundle.incidentIds[0], // Use first incident as reference
      userId: bundle.userId,
      priority: 'normal',
      incidentState: 'triggered',
    });

    // Mark bundle as sent
    const dataSource = await getDataSource();
    const bundleRepo = dataSource.getRepository(NotificationBundle);
    bundle.status = 'sent';
    bundle.sentAt = new Date();
    await bundleRepo.save(bundle);

    logger.info('Notification bundle sent successfully', {
      bundleId: bundle.id,
      userId: bundle.userId,
    });
  } catch (error) {
    logger.error('Error sending notification bundle', { error, bundleId: bundle.id });
    throw error;
  }
}

async function handleNotificationMessage(message: NotificationMessage): Promise<void> {
  logger.info('Processing notification message', {
    incidentId: message.incidentId,
    userId: message.userId,
    channel: message.channel,
  });

  try {
    // Fetch incident and user data
    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const userRepo = dataSource.getRepository(User);

    const [incident, user] = await Promise.all([
      incidentRepo.findOne({
        where: { id: message.incidentId },
        relations: ['service'],
        select: ['id', 'snoozedUntil', 'severity', 'urgency', 'orgId'],
      }),
      userRepo.findOne({
        where: { id: message.userId },
        select: ['id', 'dndEnabled', 'dndStartTime', 'dndEndTime', 'dndTimezone'],
      }),
    ]);

    if (!incident) {
      logger.warn('Incident not found for notification', {
        incidentId: message.incidentId,
      });
      return; // Skip notification
    }

    if (!user) {
      logger.warn('User not found for notification', {
        userId: message.userId,
      });
      return; // Skip notification
    }

    // Check if incident is snoozed
    if (incident.snoozedUntil && new Date(incident.snoozedUntil) > new Date()) {
      logger.info('Skipping notification - incident is snoozed', {
        incidentId: message.incidentId,
        snoozedUntil: incident.snoozedUntil,
      });
      return; // Skip notification, don't retry
    }

    // Check urgency settings - delay notifications for low urgency incidents outside support hours
    const service = incident.service;
    if (service) {
      const shouldNotify = checkUrgencyBasedNotification(service, incident);
      if (!shouldNotify) {
        logger.info('Skipping notification - outside support hours for low/dynamic urgency service', {
          incidentId: message.incidentId,
          serviceId: service.id,
          urgency: service.urgency,
          severity: incident.severity,
        });
        return; // Skip notification - will be sent during support hours
      }
    }

    // Determine if this is a critical incident (bypass DND)
    const isCritical = incident.severity === 'critical' || incident.severity === 'error';

    // Check Do Not Disturb
    if (!isCritical && isInDNDPeriod(user)) {
      logger.info('Notification blocked by Do Not Disturb', {
        userId: user.id,
        incidentId: message.incidentId,
        severity: incident.severity,
        dndStart: user.dndStartTime,
        dndEnd: user.dndEndTime,
      });
      // Still log the notification attempt but don't send
      return;
    }

    // Determine if should bundle - ONLY bundle explicitly low-urgency incidents
    // High urgency incidents should ALWAYS send immediately regardless of severity
    const isHighUrgency = incident.urgency === 'high' ||
                          (!incident.urgency && service?.urgency === 'high') ||
                          incident.severity === 'critical' ||
                          incident.severity === 'error';

    const isLowUrgency = !isHighUrgency && (
                          incident.urgency === 'low' ||
                          (service?.urgency === 'low' && !incident.urgency)
                        );

    if (isLowUrgency && !isCritical) {
      // Add to notification bundle instead of sending immediately
      const bundled = await addToNotificationBundle(
        message.userId,
        incident.orgId,
        message.incidentId
      );

      if (bundled) {
        logger.info('Notification added to bundle for low-urgency incident', {
          incidentId: message.incidentId,
          userId: message.userId,
          severity: incident.severity,
          urgency: incident.urgency,
        });
        return; // Don't send immediately
      }
      // If bundling fails, fall through to send immediately
    }

    // Default values for backward compatibility
    const priority = message.priority || 'high';
    const incidentState = message.incidentState || 'triggered';

    if (message.channel === 'push') {
      await sendPushNotification({
        incidentId: message.incidentId,
        userId: message.userId,
        priority,
        incidentState,
      });
    } else if (message.channel === 'sms') {
      await sendSMSNotification({
        incidentId: message.incidentId,
        userId: message.userId,
        priority,
        incidentState,
      });
    } else if (message.channel === 'email') {
      await sendEmailNotification({
        incidentId: message.incidentId,
        userId: message.userId,
        priority,
        incidentState,
      });
    } else if (message.channel === 'voice') {
      await sendVoiceCall({
        incidentId: message.incidentId,
        userId: message.userId,
        priority,
        incidentState,
      });
    } else {
      logger.warn(`Channel ${message.channel} not implemented`);
    }
  } catch (error) {
    logger.error('Error handling notification message:', error);
    throw error; // Let SQS retry
  }
}

/**
 * Process pending notification bundles and send digests
 */
async function processPendingBundles() {
  try {
    const dataSource = await getDataSource();
    const bundleRepo = dataSource.getRepository(NotificationBundle);

    // Find pending bundles older than the bundle interval (30 minutes)
    const cutoffTime = new Date(Date.now() - BUNDLE_INTERVAL_MS);
    const pendingBundles = await bundleRepo.find({
      where: { status: 'pending' },
    });

    for (const bundle of pendingBundles) {
      // Only send if bundle has been pending for at least 30 minutes
      if (bundle.createdAt <= cutoffTime && bundle.notificationCount > 0) {
        await sendNotificationBundle(bundle);
      }
    }

    if (pendingBundles.length > 0) {
      logger.info('Processed pending notification bundles', {
        totalBundles: pendingBundles.length,
        sentBundles: pendingBundles.filter(b => b.createdAt <= cutoffTime).length,
      });
    }
  } catch (error) {
    logger.error('Error processing pending bundles', { error });
  }
}

async function startWorker() {
  try {
    logger.info('Starting notification worker...');

    if (!QUEUE_URL) {
      throw new Error('NOTIFICATIONS_QUEUE_URL environment variable not set');
    }

    // Initialize database connection
    logger.info('Connecting to database...');
    await getDataSource();
    logger.info('Database connected successfully');

    // Start periodic bundle processing (every 5 minutes)
    setInterval(processPendingBundles, 5 * 60 * 1000);
    logger.info('Bundle processor started (runs every 5 minutes)');

    logger.info(`Notification worker started, listening to queue: ${QUEUE_URL}`);

    // Start processing queue
    await processQueue<NotificationMessage>(QUEUE_URL, handleNotificationMessage, {
      batchSize: 1,
    });
  } catch (error) {
    logger.error('Failed to start notification worker:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the worker
startWorker();
