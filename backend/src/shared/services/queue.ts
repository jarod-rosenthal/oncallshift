import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  type MessageAttributeValue,
} from "@aws-sdk/client-sqs";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const sqs = new SQSClient({ region: env.awsRegion });

export interface QueueMessage {
  body: Record<string, unknown>;
  attributes?: Record<string, MessageAttributeValue>;
  delaySeconds?: number;
}

/**
 * Send a message to an SQS queue.
 */
export async function sendMessage(
  queueUrl: string,
  message: QueueMessage,
): Promise<string | undefined> {
  const cmd = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(message.body),
    MessageAttributes: message.attributes,
    DelaySeconds: message.delaySeconds,
  });

  const result = await sqs.send(cmd);
  logger.debug("Message sent to SQS", {
    queueUrl,
    messageId: result.MessageId,
  });
  return result.MessageId;
}

/**
 * Receive messages from an SQS queue (long-polling, 20s).
 */
export async function receiveMessages(
  queueUrl: string,
  maxMessages = 10,
): Promise<
  Array<{ messageId: string; body: string; receiptHandle: string }>
> {
  const cmd = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds: 20,
    MessageAttributeNames: ["All"],
  });

  const result = await sqs.send(cmd);
  return (result.Messages || []).map((m) => ({
    messageId: m.MessageId!,
    body: m.Body!,
    receiptHandle: m.ReceiptHandle!,
  }));
}

/**
 * Delete a message from the queue after successful processing.
 */
export async function deleteMessage(
  queueUrl: string,
  receiptHandle: string,
): Promise<void> {
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    }),
  );
}

/**
 * Check if the SQS queue is reachable (for health checks).
 */
export async function checkQueueHealth(
  queueUrl: string,
): Promise<boolean> {
  try {
    await sqs.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["ApproximateNumberOfMessages"],
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Pre-configured queue URLs for convenience */
export const queues = {
  alerts: () => env.alertsQueueUrl,
  notifications: () => env.notificationsQueueUrl,
} as const;

export { sqs as sqsClient };
