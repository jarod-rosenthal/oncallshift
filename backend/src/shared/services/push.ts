import {
  SNSClient,
  PublishCommand,
  type PublishCommandInput,
} from "@aws-sdk/client-sns";
import { logger } from "../utils/logger.js";

const client = new SNSClient({
  region: process.env.AWS_REGION || "us-east-2",
});

export interface PushNotificationParams {
  topicArn: string;
  message: Record<string, unknown>;
  subject?: string;
  messageAttributes?: Record<
    string,
    { DataType: string; StringValue: string }
  >;
}

export async function publishToTopic(
  params: PushNotificationParams,
): Promise<string | undefined> {
  const input: PublishCommandInput = {
    TopicArn: params.topicArn,
    Message: JSON.stringify(params.message),
    ...(params.subject && { Subject: params.subject }),
    ...(params.messageAttributes && {
      MessageAttributes: params.messageAttributes,
    }),
  };

  const result = await client.send(new PublishCommand(input));
  logger.debug("SNS message published", {
    topicArn: params.topicArn,
    messageId: result.MessageId,
  });
  return result.MessageId;
}

export async function publishDirectPush(
  targetArn: string,
  message: Record<string, unknown>,
): Promise<string | undefined> {
  const result = await client.send(
    new PublishCommand({
      TargetArn: targetArn,
      Message: JSON.stringify(message),
      MessageStructure: "json",
    }),
  );
  return result.MessageId;
}

export { client as snsClient };
