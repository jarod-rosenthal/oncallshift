import {
  SESClient,
  SendEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import { logger } from "../utils/logger.js";

const client = new SESClient({
  region: process.env.AWS_REGION || "us-east-2",
});

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string[];
}

export async function sendEmail(params: SendEmailParams): Promise<string | undefined> {
  const fromAddress = params.from || process.env.SES_FROM_EMAIL || "noreply@oncallshift.com";
  const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

  const input: SendEmailCommandInput = {
    Source: fromAddress,
    Destination: {
      ToAddresses: toAddresses,
    },
    Message: {
      Subject: { Data: params.subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: params.html, Charset: "UTF-8" },
        ...(params.text && { Text: { Data: params.text, Charset: "UTF-8" } }),
      },
    },
    ...(params.replyTo && { ReplyToAddresses: params.replyTo }),
  };

  const result = await client.send(new SendEmailCommand(input));
  logger.debug("Email sent", { messageId: result.MessageId, to: toAddresses });
  return result.MessageId;
}

export { client as sesClient };
