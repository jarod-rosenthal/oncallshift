import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const ses = new SESClient({ region: config.aws.region });

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<string | undefined> {
  const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

  const command = new SendEmailCommand({
    Source: config.aws.ses.fromEmail,
    Destination: {
      ToAddresses: toAddresses,
    },
    Message: {
      Subject: { Data: options.subject },
      Body: {
        Html: { Data: options.html },
        ...(options.text ? { Text: { Data: options.text } } : {}),
      },
    },
  });

  const result = await ses.send(command);
  logger.debug("Email sent", { to: toAddresses, messageId: result.MessageId });
  return result.MessageId;
}
