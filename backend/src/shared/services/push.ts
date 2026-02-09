import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const sns = new SNSClient({ region: config.aws.region });

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function publishToPushTopic(notification: PushNotification): Promise<string | undefined> {
  const command = new PublishCommand({
    TopicArn: config.aws.sns.pushTopicArn,
    Message: JSON.stringify(notification),
    MessageAttributes: {
      type: { DataType: "String", StringValue: "push" },
    },
  });

  const result = await sns.send(command);
  logger.debug("Push notification published", { messageId: result.MessageId });
  return result.MessageId;
}

export async function sendToEndpoint(
  endpointArn: string,
  notification: PushNotification,
): Promise<string | undefined> {
  const command = new PublishCommand({
    TargetArn: endpointArn,
    Message: JSON.stringify({
      default: notification.body,
      GCM: JSON.stringify({
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data,
      }),
    }),
    MessageStructure: "json",
  });

  const result = await sns.send(command);
  logger.debug("Push sent to endpoint", { endpointArn, messageId: result.MessageId });
  return result.MessageId;
}
