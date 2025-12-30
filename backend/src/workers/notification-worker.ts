import 'dotenv/config';
import { getDataSource } from '../shared/db/data-source';
import { processQueue, NotificationMessage } from '../shared/queues/sqs-client';
import { sendPushNotification } from '../shared/notifications/push-service';
import { sendSMSNotification } from '../shared/notifications/sms-service';
import { sendEmailNotification } from '../shared/notifications/email-service';
import { logger } from '../shared/utils/logger';

const QUEUE_URL = process.env.NOTIFICATIONS_QUEUE_URL;

async function handleNotificationMessage(message: NotificationMessage): Promise<void> {
  logger.info('Processing notification message', {
    incidentId: message.incidentId,
    userId: message.userId,
    channel: message.channel,
  });

  try {
    if (message.channel === 'push') {
      await sendPushNotification({
        incidentId: message.incidentId,
        userId: message.userId,
        priority: message.priority,
        incidentState: message.incidentState,
      });
    } else if (message.channel === 'sms') {
      await sendSMSNotification({
        incidentId: message.incidentId,
        userId: message.userId,
        priority: message.priority,
        incidentState: message.incidentState,
      });
    } else if (message.channel === 'email') {
      await sendEmailNotification({
        incidentId: message.incidentId,
        userId: message.userId,
        priority: message.priority,
        incidentState: message.incidentState,
      });
    } else {
      // Voice is Phase 3
      logger.warn(`Channel ${message.channel} not yet implemented`);
    }
  } catch (error) {
    logger.error('Error handling notification message:', error);
    throw error; // Let SQS retry
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
