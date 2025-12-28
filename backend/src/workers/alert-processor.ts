import 'dotenv/config';
import { getDataSource } from '../shared/db/data-source';
import { processQueue, AlertMessage, sendNotificationMessage } from '../shared/queues/sqs-client';
import { Incident, IncidentEvent, Service, Schedule } from '../shared/models';
import { logger } from '../shared/utils/logger';

const QUEUE_URL = process.env.ALERTS_QUEUE_URL;

async function handleAlertMessage(message: AlertMessage): Promise<void> {
  logger.info('Processing alert message', {
    serviceId: message.serviceId,
    summary: message.summary,
    severity: message.severity,
  });

  try {
    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);
    const serviceRepo = dataSource.getRepository(Service);

    // Get service
    const service = await serviceRepo.findOne({
      where: { id: message.serviceId },
      relations: ['organization', 'schedule'],
    });

    if (!service) {
      logger.error('Service not found', { serviceId: message.serviceId });
      return;
    }

    // Check for deduplication
    let incident: Incident | null = null;
    if (message.dedupKey) {
      incident = await incidentRepo.findOne({
        where: {
          serviceId: service.id,
          dedupKey: message.dedupKey,
          state: 'triggered', // Only match open incidents
        },
      });

      // Also check acknowledged incidents
      if (!incident) {
        incident = await incidentRepo.findOne({
          where: {
            serviceId: service.id,
            dedupKey: message.dedupKey,
            state: 'acknowledged',
          },
        });
      }
    }

    if (incident) {
      // Deduplicated - append to existing incident
      incident.eventCount += 1;
      incident.lastEventAt = new Date();
      await incidentRepo.save(incident);

      // Create alert event
      const event = eventRepo.create({
        incidentId: incident.id,
        type: 'alert',
        message: `New alert: ${message.summary}`,
        payload: message.details,
      });
      await eventRepo.save(event);

      logger.info('Alert deduplicated to existing incident', {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        eventCount: incident.eventCount,
      });
    } else {
      // Create new incident
      const incidentNumber = await getNextIncidentNumber(service.orgId);

      incident = incidentRepo.create({
        orgId: service.orgId,
        serviceId: service.id,
        incidentNumber,
        summary: message.summary,
        details: message.details,
        severity: message.severity,
        state: 'triggered',
        dedupKey: message.dedupKey,
        eventCount: 1,
      });
      await incidentRepo.save(incident);

      // Create initial alert event
      const event = eventRepo.create({
        incidentId: incident.id,
        type: 'alert',
        message: `Incident created: ${message.summary}`,
        payload: message.details,
      });
      await eventRepo.save(event);

      logger.info('New incident created', {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        serviceId: service.id,
        severity: message.severity,
      });

      // Trigger notifications to on-call user(s)
      await triggerNotifications(incident, service);
    }
  } catch (error) {
    logger.error('Error handling alert message:', error);
    throw error; // Let SQS retry
  }
}

/**
 * Get next incident number for organization
 */
async function getNextIncidentNumber(orgId: string): Promise<number> {
  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);

  const lastIncident = await incidentRepo.findOne({
    where: { orgId },
    order: { incidentNumber: 'DESC' },
  });

  return (lastIncident?.incidentNumber || 0) + 1;
}

/**
 * Trigger notifications to on-call users
 */
async function triggerNotifications(incident: Incident, service: Service): Promise<void> {
  try {
    // MVP: Simple notification to current on-call user only
    if (!service.schedule) {
      logger.warn('Service has no schedule assigned, no notifications sent', {
        serviceId: service.id,
        incidentId: incident.id,
      });
      return;
    }

    const schedule = service.schedule;
    const oncallUserId = schedule.getCurrentOncallUserId();

    if (!oncallUserId) {
      logger.warn('No on-call user in schedule, no notifications sent', {
        scheduleId: schedule.id,
        incidentId: incident.id,
      });
      return;
    }

    // Send push notification
    await sendNotificationMessage({
      incidentId: incident.id,
      userId: oncallUserId,
      channel: 'push',
      priority: incident.severity === 'critical' || incident.severity === 'error' ? 'high' : 'normal',
    });

    logger.info('Notification queued for on-call user', {
      incidentId: incident.id,
      userId: oncallUserId,
      scheduleId: schedule.id,
    });
  } catch (error) {
    logger.error('Error triggering notifications:', error);
    // Don't throw - incident is created, notification failure shouldn't fail alert processing
  }
}

async function startWorker() {
  try {
    logger.info('Starting alert processor worker...');

    if (!QUEUE_URL) {
      throw new Error('ALERTS_QUEUE_URL environment variable not set');
    }

    // Initialize database connection
    logger.info('Connecting to database...');
    await getDataSource();
    logger.info('Database connected successfully');

    logger.info(`Alert processor worker started, listening to queue: ${QUEUE_URL}`);

    // Start processing queue
    await processQueue<AlertMessage>(QUEUE_URL, handleAlertMessage, {
      batchSize: 1,
    });
  } catch (error) {
    logger.error('Failed to start alert processor worker:', error);
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
