import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  type SendMessageCommandInput,
  type ReceiveMessageCommandInput,
} from "@aws-sdk/client-sqs";
import { logger } from "../utils/logger.js";

const client = new SQSClient({
  region: process.env.AWS_REGION || "us-east-2",
});

export async function sendMessage(
  queueUrl: string,
  body: Record<string, unknown>,
  messageAttributes?: Record<string, { DataType: string; StringValue: string }>,
): Promise<string | undefined> {
  const params: SendMessageCommandInput = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(body),
    ...(messageAttributes && { MessageAttributes: messageAttributes }),
  };

  const result = await client.send(new SendMessageCommand(params));
  logger.debug("SQS message sent", { queueUrl, messageId: result.MessageId });
  return result.MessageId;
}

export async function receiveMessages(
  queueUrl: string,
  maxMessages = 10,
  waitTimeSeconds = 20,
): Promise<
  Array<{
    messageId: string | undefined;
    body: string | undefined;
    receiptHandle: string | undefined;
  }>
> {
  const params: ReceiveMessageCommandInput = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds: waitTimeSeconds,
    MessageAttributeNames: ["All"],
  };

  const result = await client.send(new ReceiveMessageCommand(params));
  return (result.Messages || []).map((msg) => ({
    messageId: msg.MessageId,
    body: msg.Body,
    receiptHandle: msg.ReceiptHandle,
  }));
}

export async function deleteMessage(
  queueUrl: string,
  receiptHandle: string,
): Promise<void> {
  await client.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    }),
  );
}

export { client as sqsClient };
