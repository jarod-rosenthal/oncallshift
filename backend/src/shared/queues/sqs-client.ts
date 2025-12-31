import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, Message } from '@aws-sdk/client-sqs';
import { logger } from '../utils/logger';

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });

export interface AlertMessage {
  serviceId: string;
  summary: string;
  details?: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  dedupKey?: string;
  source?: string;
}

export interface NotificationMessage {
  incidentId: string;
  userId: string;
  channel: 'push' | 'sms' | 'email' | 'voice';
  priority: 'high' | 'normal';
  incidentState: 'triggered' | 'acknowledged' | 'resolved';
}

/**
 * Send alert message to SQS queue
 */
export async function sendAlertMessage(alert: AlertMessage): Promise<void> {
  const queueUrl = process.env.ALERTS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error('ALERTS_QUEUE_URL not configured');
  }

  try {
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(alert),
      MessageAttributes: {
        severity: {
          DataType: 'String',
          StringValue: alert.severity,
        },
      },
    });

    await sqsClient.send(command);
    logger.info(`Alert message sent to queue`, { serviceId: alert.serviceId, summary: alert.summary });
  } catch (error) {
    logger.error('Error sending alert message to SQS:', error);
    throw error;
  }
}

/**
 * Send notification message to SQS queue
 */
export async function sendNotificationMessage(notification: NotificationMessage): Promise<void> {
  const queueUrl = process.env.NOTIFICATIONS_QUEUE_URL;
  if (!queueUrl) {
    throw new Error('NOTIFICATIONS_QUEUE_URL not configured');
  }

  try {
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(notification),
      MessageAttributes: {
        channel: {
          DataType: 'String',
          StringValue: notification.channel,
        },
        priority: {
          DataType: 'String',
          StringValue: notification.priority,
        },
      },
    });

    await sqsClient.send(command);
    logger.info(`Notification message sent to queue`, {
      incidentId: notification.incidentId,
      userId: notification.userId,
      channel: notification.channel,
    });
  } catch (error) {
    logger.error('Error sending notification message to SQS:', error);
    throw error;
  }
}

/**
 * Receive messages from SQS queue
 */
export async function receiveMessages(queueUrl: string, maxMessages: number = 1): Promise<Message[]> {
  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: 20, // Long polling
      MessageAttributeNames: ['All'],
    });

    const response = await sqsClient.send(command);
    return response.Messages || [];
  } catch (error) {
    logger.error('Error receiving messages from SQS:', error);
    throw error;
  }
}

/**
 * Delete message from SQS queue
 */
export async function deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
  try {
    const command = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await sqsClient.send(command);
  } catch (error) {
    logger.error('Error deleting message from SQS:', error);
    throw error;
  }
}

/**
 * Process messages from queue with a handler function
 */
export async function processQueue<T>(
  queueUrl: string,
  handler: (message: T) => Promise<void>,
  options: { maxMessages?: number; batchSize?: number } = {}
): Promise<void> {
  const { batchSize = 1 } = options;

  while (true) {
    try {
      const messages = await receiveMessages(queueUrl, batchSize);

      if (messages.length === 0) {
        // No messages, wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      for (const message of messages) {
        try {
          if (!message.Body) {
            logger.warn('Received message without body');
            continue;
          }

          const parsedMessage = JSON.parse(message.Body) as T;
          await handler(parsedMessage);

          // Delete message after successful processing
          if (message.ReceiptHandle) {
            await deleteMessage(queueUrl, message.ReceiptHandle);
          }
        } catch (error) {
          logger.error('Error processing message:', error);
          // Message will be returned to queue after visibility timeout
        }
      }
    } catch (error) {
      logger.error('Error in queue processing loop:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}
