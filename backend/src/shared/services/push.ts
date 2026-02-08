import {
  SNSClient,
  PublishCommand,
  GetTopicAttributesCommand,
} from "@aws-sdk/client-sns";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const sns = new SNSClient({ region: env.awsRegion });

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Publish a push notification message to the SNS topic.
 */
export async function publishPushNotification(
  message: PushMessage,
  topicArn = env.snsPushTopicArn,
): Promise<string> {
  const result = await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message),
      MessageAttributes: {
        title: { DataType: "String", StringValue: message.title },
      },
    }),
  );

  logger.debug("Push notification published", {
    messageId: result.MessageId,
  });
  return result.MessageId!;
}

/**
 * Check if SNS topic is reachable (for health checks).
 */
export async function checkPushHealth(
  topicArn = env.snsPushTopicArn,
): Promise<boolean> {
  if (!topicArn) return false;
  try {
    await sns.send(new GetTopicAttributesCommand({ TopicArn: topicArn }));
    return true;
  } catch {
    return false;
  }
}

export { sns as snsClient };
