import crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { WebhookSubscription } from '../models/WebhookSubscription';
import { getDataSource } from '../db/data-source';
import { logger } from '../utils/logger';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });

export interface WebhookEvent {
  event: {
    id: string;
    event_type: string;
    resource_type: string;
    occurred_at: string;
    agent?: {
      id: string;
      type: string;
    };
    data: Record<string, any>;
  };
}

/**
 * Generate HMAC SHA256 signature for webhook payload
 * Compatible with PagerDuty webhook v3 signature format
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `v1=${hmac.digest('hex')}`;
}

/**
 * Deliver a webhook event to a subscription endpoint
 * Includes retry logic with exponential backoff
 */
export async function deliverWebhookEvent(
  subscription: WebhookSubscription,
  event: WebhookEvent,
  attemptNumber: number = 1
): Promise<void> {
  const payload = JSON.stringify(event);
  const signature = generateWebhookSignature(payload, subscription.secret);

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'OnCallShift-Webhook/1.0',
    'X-PagerDuty-Signature': signature,
    'X-Webhook-Id': event.event.id,
  };

  logger.info('Delivering webhook event', {
    subscriptionId: subscription.id,
    eventType: event.event.event_type,
    url: subscription.url,
    attempt: attemptNumber,
  });

  try {
    const response = await axios.post(subscription.url, event, {
      headers,
      timeout: subscription.deliveryTimeoutSeconds * 1000,
      validateStatus: (status: number) => status >= 200 && status < 300,
    });

    // Success - update statistics
    await updateDeliveryStatistics(subscription.id, true);

    logger.info('Webhook delivered successfully', {
      subscriptionId: subscription.id,
      eventType: event.event.event_type,
      statusCode: response.status,
      attempt: attemptNumber,
    });
  } catch (error) {
    const axiosError = error as AxiosError;
    const statusCode = axiosError.response?.status;
    const errorMessage = axiosError.message;

    logger.error('Webhook delivery failed', {
      subscriptionId: subscription.id,
      eventType: event.event.event_type,
      attempt: attemptNumber,
      statusCode,
      error: errorMessage,
    });

    // Retry logic with exponential backoff
    if (attemptNumber < subscription.maxRetries) {
      const retryDelay = calculateRetryDelay(attemptNumber);

      logger.info('Scheduling webhook retry', {
        subscriptionId: subscription.id,
        nextAttempt: attemptNumber + 1,
        delayMs: retryDelay,
      });

      // Schedule retry after delay
      await sleep(retryDelay);
      return deliverWebhookEvent(subscription, event, attemptNumber + 1);
    } else {
      // Max retries exceeded - update statistics and optionally queue to DLQ
      await updateDeliveryStatistics(subscription.id, false);

      // Optionally queue to dead letter queue for manual review
      await queueFailedWebhook(subscription, event, errorMessage);

      throw new Error(
        `Webhook delivery failed after ${subscription.maxRetries} attempts: ${errorMessage}`
      );
    }
  }
}

/**
 * Calculate exponential backoff delay for retry attempts
 * Returns delay in milliseconds
 */
function calculateRetryDelay(attemptNumber: number): number {
  // Exponential backoff: 2^attempt * 1000ms (1s, 2s, 4s, 8s, etc.)
  const baseDelay = 1000;
  const maxDelay = 30000; // Cap at 30 seconds

  const delay = Math.min(baseDelay * Math.pow(2, attemptNumber - 1), maxDelay);

  // Add jitter (±20%) to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() - 0.5);

  return Math.floor(delay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Update webhook subscription delivery statistics
 */
async function updateDeliveryStatistics(subscriptionId: string, success: boolean): Promise<void> {
  try {
    const dataSource = await getDataSource();
    const subscriptionRepo = dataSource.getRepository(WebhookSubscription);

    const subscription = await subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      logger.warn('Subscription not found for statistics update', { subscriptionId });
      return;
    }

    subscription.totalDeliveries += 1;

    if (success) {
      subscription.successfulDeliveries += 1;
      subscription.lastDeliveryStatus = 'success';
    } else {
      subscription.failedDeliveries += 1;
      subscription.lastDeliveryStatus = 'failed';
    }

    subscription.lastDeliveryAt = new Date();

    await subscriptionRepo.save(subscription);

    logger.debug('Webhook statistics updated', {
      subscriptionId,
      success,
      totalDeliveries: subscription.totalDeliveries,
    });
  } catch (error) {
    logger.error('Error updating webhook statistics:', error);
    // Don't throw - statistics update failure shouldn't block delivery
  }
}

/**
 * Queue failed webhook delivery to SQS for manual review/retry
 * This allows administrators to investigate and potentially replay failed webhooks
 */
async function queueFailedWebhook(
  subscription: WebhookSubscription,
  event: WebhookEvent,
  errorMessage: string
): Promise<void> {
  const queueUrl = process.env.FAILED_WEBHOOKS_QUEUE_URL;

  if (!queueUrl) {
    logger.debug('Failed webhooks queue not configured, skipping DLQ');
    return;
  }

  try {
    const failedWebhook = {
      subscriptionId: subscription.id,
      url: subscription.url,
      event,
      errorMessage,
      failedAt: new Date().toISOString(),
    };

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(failedWebhook),
      MessageAttributes: {
        subscriptionId: {
          DataType: 'String',
          StringValue: subscription.id,
        },
        eventType: {
          DataType: 'String',
          StringValue: event.event.event_type,
        },
      },
    });

    await sqsClient.send(command);

    logger.info('Failed webhook queued to DLQ', {
      subscriptionId: subscription.id,
      eventType: event.event.event_type,
    });
  } catch (error) {
    logger.error('Error queueing failed webhook to DLQ:', error);
    // Don't throw - DLQ failure shouldn't block the main flow
  }
}

/**
 * Find all webhook subscriptions that match the given event type and scope
 */
export async function findMatchingSubscriptions(
  orgId: string,
  eventType: string,
  serviceId?: string,
  teamId?: string
): Promise<WebhookSubscription[]> {
  const dataSource = await getDataSource();
  const subscriptionRepo = dataSource.getRepository(WebhookSubscription);

  // Find all enabled subscriptions for this organization
  const allSubscriptions = await subscriptionRepo.find({
    where: { orgId, enabled: true },
  });

  // Filter subscriptions that match the event type and scope
  const matchingSubscriptions = allSubscriptions.filter((subscription) => {
    // Check if subscription includes this event type
    if (!subscription.eventTypes.includes(eventType)) {
      return false;
    }

    // Organization scope: match all events
    if (subscription.scope === 'organization') {
      return true;
    }

    // Service scope: match only events from this service
    if (subscription.scope === 'service' && subscription.serviceId === serviceId) {
      return true;
    }

    // Team scope: match only events from this team
    if (subscription.scope === 'team' && subscription.teamId === teamId) {
      return true;
    }

    return false;
  });

  return matchingSubscriptions;
}

/**
 * Deliver event to all matching webhook subscriptions
 * This is the main entry point called from incident lifecycle events
 */
export async function deliverToMatchingWebhooks(
  orgId: string,
  eventType: string,
  eventData: WebhookEvent,
  serviceId?: string,
  teamId?: string
): Promise<void> {
  const subscriptions = await findMatchingSubscriptions(orgId, eventType, serviceId, teamId);

  if (subscriptions.length === 0) {
    logger.debug('No matching webhook subscriptions found', { orgId, eventType });
    return;
  }

  logger.info('Delivering to matching webhook subscriptions', {
    orgId,
    eventType,
    subscriptionCount: subscriptions.length,
  });

  // Deliver to all subscriptions in parallel
  const deliveryPromises = subscriptions.map((subscription) =>
    deliverWebhookEvent(subscription, eventData).catch((error) => {
      // Log error but don't fail the entire batch
      logger.error('Webhook delivery failed for subscription', {
        subscriptionId: subscription.id,
        error: error.message,
      });
    })
  );

  await Promise.all(deliveryPromises);
}
