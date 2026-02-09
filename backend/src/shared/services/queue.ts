import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const sqs = new SQSClient({ region: config.aws.region });

export async function sendMessage(queueUrl: string, body: object): Promise<string | undefined> {
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(body),
  });

  const result = await sqs.send(command);
  logger.debug("SQS message sent", { queueUrl, messageId: result.MessageId });
  return result.MessageId;
}

export async function receiveMessages(
  queueUrl: string,
  maxMessages = 10,
  waitTimeSeconds = 20,
) {
  const command = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds: waitTimeSeconds,
    MessageAttributeNames: ["All"],
  });

  const result = await sqs.send(command);
  return result.Messages || [];
}

export async function deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
  const command = new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle,
  });

  await sqs.send(command);
}

export function sendAlert(body: object) {
  return sendMessage(config.aws.sqs.alertsQueueUrl, body);
}

export function sendNotification(body: object) {
  return sendMessage(config.aws.sqs.notificationsQueueUrl, body);
}
