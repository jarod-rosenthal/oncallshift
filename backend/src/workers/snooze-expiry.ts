import 'dotenv/config';
import { getDataSource } from '../shared/db/data-source';
import { sendNotificationMessage } from '../shared/queues/sqs-client';
import { Incident, IncidentEvent, Service, Schedule, User, EscalationTarget } from '../shared/models';
import { logger } from '../shared/utils/logger';
import { LessThanOrEqual } from 'typeorm';

const CHECK_INTERVAL_MS = parseInt(process.env.SNOOZE_CHECK_INTERVAL_MS || '30000', 10); // Default 30 seconds

/**
 * Snooze Expiry Worker
 *
 * Checks for incidents whose snooze period has expired and re-triggers notifications.
 * When a snooze expires:
 * 1. Clear the snoozedUntil timestamp
 * 2. Create an incident event for the snooze expiry
 * 3. Re-trigger notifications to the assigned responder
 */
async function checkExpiredSnoozes(): Promise<void> {
  try {
    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);
    const serviceRepo = dataSource.getRepository(Service);
    const scheduleRepo = dataSource.getRepository(Schedule);
    const targetRepo = dataSource.getRepository(EscalationTarget);

    const now = new Date();

    // Find incidents where snooze has expired and incident is still acknowledged
    const expiredSnoozes = await incidentRepo.find({
      where: {
        snoozedUntil: LessThanOrEqual(now),
        state: 'acknowledged', // Only process acknowledged incidents
      },
      relations: ['service', 'assignedToUser'],
    });

    if (expiredSnoozes.length === 0) {
      return;
    }

    logger.info(`Found ${expiredSnoozes.length} incidents with expired snoozes`);

    for (const incident of expiredSnoozes) {
      try {
        await processExpiredSnooze(
          incident,
          incidentRepo,
          eventRepo,
          serviceRepo,
          scheduleRepo,
          targetRepo
        );
      } catch (error) {
        logger.error('Error processing expired snooze:', {
          incidentId: incident.id,
          error,
        });
      }
    }
  } catch (error) {
    logger.error('Error in snooze expiry check:', error);
  }
}

async function processExpiredSnooze(
  incident: Incident,
  incidentRepo: any,
  eventRepo: any,
  serviceRepo: any,
  scheduleRepo: any,
  targetRepo: any
): Promise<void> {
  logger.info('Processing expired snooze', {
    incidentId: incident.id,
    snoozedUntil: incident.snoozedUntil,
  });

  // Clear the snooze
  await incidentRepo.update(incident.id, {
    snoozedUntil: null,
    snoozedBy: null,
  });

  // Create an event for the snooze expiry
  const event = eventRepo.create({
    incidentId: incident.id,
    orgId: incident.orgId,
    type: 'snooze_expired',
    message: 'Snooze period expired - notifications resumed',
    metadata: {
      previousSnoozedUntil: incident.snoozedUntil,
    },
  });
  await eventRepo.save(event);

  // Re-trigger notifications
  // Find who should be notified - either the assigned user or the on-call
  let userToNotify: User | null = null;

  if (incident.assignedToUser) {
    userToNotify = incident.assignedToUser;
  } else {
    // Get on-call from service schedule or escalation policy
    const service = await serviceRepo.findOne({
      where: { id: incident.serviceId },
      relations: ['escalationPolicy', 'escalationPolicy.steps'],
    });

    if (service?.escalationPolicy?.steps?.length > 0) {
      const firstStep = service.escalationPolicy.steps.sort(
        (a: any, b: any) => a.stepOrder - b.stepOrder
      )[0];

      // Get targets for this step
      const targets = await targetRepo.find({
        where: { escalationStepId: firstStep.id },
        relations: ['user', 'schedule'],
      });

      for (const target of targets) {
        if (target.targetType === 'user' && target.user) {
          userToNotify = target.user;
          break;
        } else if (target.targetType === 'schedule' && target.schedule) {
          // Get current on-call from schedule
          const schedule = await scheduleRepo.findOne({
            where: { id: target.schedule.id },
            relations: ['currentOnCall'],
          });
          if (schedule?.currentOnCall) {
            userToNotify = schedule.currentOnCall;
            break;
          }
        }
      }
    }
  }

  if (userToNotify) {
    logger.info('Sending snooze expiry notification', {
      incidentId: incident.id,
      userId: userToNotify.id,
    });

    // Send notifications via all channels
    const channels = ['push', 'email'];
    for (const channel of channels) {
      await sendNotificationMessage({
        incidentId: incident.id,
        userId: userToNotify.id,
        channel: channel as 'push' | 'email' | 'sms' | 'voice',
        priority: 'high',
        incidentState: 'acknowledged', // Still acknowledged, just snooze expired
      });
    }
  } else {
    logger.warn('No user found to notify for snooze expiry', {
      incidentId: incident.id,
    });
  }
}

async function startWorker() {
  try {
    logger.info('Starting snooze expiry worker...');

    // Initialize database connection
    logger.info('Connecting to database...');
    await getDataSource();
    logger.info('Database connected successfully');

    logger.info(`Snooze expiry worker started, checking every ${CHECK_INTERVAL_MS}ms`);

    // Run check immediately
    await checkExpiredSnoozes();

    // Then run on interval
    setInterval(async () => {
      await checkExpiredSnoozes();
    }, CHECK_INTERVAL_MS);
  } catch (error) {
    logger.error('Failed to start snooze expiry worker:', error);
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
