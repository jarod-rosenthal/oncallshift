import {
  SESClient,
  SendEmailCommand,
  GetSendQuotaCommand,
} from "@aws-sdk/client-ses";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const ses = new SESClient({ region: env.awsRegion });

export interface EmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Send an email via AWS SES.
 */
export async function sendEmail(params: EmailParams): Promise<string> {
  const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

  const result = await ses.send(
    new SendEmailCommand({
      Source: params.from || env.sesFromEmail,
      Destination: { ToAddresses: toAddresses },
      Message: {
        Subject: { Data: params.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: params.html, Charset: "UTF-8" },
          ...(params.text
            ? { Text: { Data: params.text, Charset: "UTF-8" } }
            : {}),
        },
      },
      ...(params.replyTo ? { ReplyToAddresses: [params.replyTo] } : {}),
    }),
  );

  logger.info("Email sent via SES", {
    messageId: result.MessageId,
    to: toAddresses,
  });
  return result.MessageId!;
}

/**
 * Check if SES is reachable (for health checks).
 */
export async function checkEmailHealth(): Promise<boolean> {
  try {
    await ses.send(new GetSendQuotaCommand({}));
    return true;
  } catch {
    return false;
  }
}

export { ses as sesClient };
