import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getDataSource } from '../db/data-source';
import { Incident, Notification, User } from '../models';
import { logger } from '../utils/logger';

const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

export interface EmailNotificationPayload {
  incidentId: string;
  userId: string;
  priority: 'high' | 'normal';
  incidentState: 'triggered' | 'acknowledged' | 'resolved';
}

/**
 * Check if email notification should be sent based on user preferences
 */
function shouldSendEmail(
  user: User,
  incidentState: 'triggered' | 'acknowledged' | 'resolved'
): boolean {
  const prefs = user.settings?.notificationPreferences?.email;

  // If no preferences set, default to enabled for all states
  if (!prefs) {
    return true;
  }

  // Check if email is enabled
  if (!prefs.enabled) {
    return false;
  }

  // Check if this incident state is in the types array
  return prefs.types?.includes(incidentState) ?? false;
}

/**
 * Send email notification to a user for an incident
 */
export async function sendEmailNotification(payload: EmailNotificationPayload): Promise<void> {
  const { incidentId, userId, incidentState } = payload;

  try {
    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);
    const incidentRepo = dataSource.getRepository(Incident);
    const notificationRepo = dataSource.getRepository(Notification);

    // Get user and incident
    const [user, incident] = await Promise.all([
      userRepo.findOne({ where: { id: userId } }),
      incidentRepo.findOne({ where: { id: incidentId }, relations: ['service'] }),
    ]);

    if (!user || !incident) {
      logger.error('User or incident not found', { userId, incidentId });
      return;
    }

    // Check user notification preferences
    if (!shouldSendEmail(user, incidentState)) {
      logger.info('Email notification skipped due to user preferences', {
        userId,
        userEmail: user.email,
        incidentState,
        emailEnabled: user.settings?.notificationPreferences?.email?.enabled,
        emailTypes: user.settings?.notificationPreferences?.email?.types,
      });
      return;
    }

    // Create notification record
    const notification = notificationRepo.create({
      incidentId,
      userId,
      channel: 'email',
      status: 'pending',
    });
    await notificationRepo.save(notification);

    try {
      const fromEmail = process.env.SES_FROM_EMAIL || 'noreply@pagerduty-lite.com';
      const sourceEmail = `OnCallShift Alerts <${fromEmail}>`;
      const subject = createEmailSubject(incident);
      const htmlBody = createEmailHTMLBody(incident, user);
      const textBody = createEmailTextBody(incident, user);

      // Send via SES
      const command = new SendEmailCommand({
        Source: sourceEmail,
        Destination: {
          ToAddresses: [user.email],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          },
        },
      });

      const result = await sesClient.send(command);

      // Update notification status
      notification.status = 'sent';
      notification.sentAt = new Date();
      notification.externalId = result.MessageId || null;
      await notificationRepo.save(notification);

      logger.info('Email notification sent', {
        notificationId: notification.id,
        incidentId,
        userId,
        userEmail: user.email,
        messageId: result.MessageId,
      });
    } catch (error) {
      logger.error('Error sending email notification:', error);
      notification.status = 'failed';
      notification.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      notification.failedAt = new Date();
      await notificationRepo.save(notification);
    }
  } catch (error) {
    logger.error('Error in sendEmailNotification:', error);
    throw error;
  }
}

/**
 * Create email subject line
 */
function createEmailSubject(incident: Incident): string {
  const severity = incident.severity.toUpperCase();
  const service = incident.service.name;
  return `[${severity}] Incident #${incident.incidentNumber}: ${service}`;
}

/**
 * Create email HTML body
 */
function createEmailHTMLBody(incident: Incident, user: User): string {
  const severity = incident.severity.toUpperCase();
  const severityColor = incident.severity === 'critical' ? '#e74c3c' : incident.severity === 'warning' ? '#f39c12' : '#3498db';
  const service = incident.service.name;
  const summary = incident.summary;
  const incidentNumber = incident.incidentNumber;
  const triggeredAt = incident.triggeredAt.toISOString();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${severityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; background: ${severityColor}; color: white; }
    .detail { margin: 10px 0; }
    .label { font-weight: bold; color: #555; }
    .button { display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🚨 New Incident Alert</h1>
    </div>
    <div class="content">
      <div class="detail">
        <span class="badge">${severity}</span>
        <span class="badge" style="background: #95a5a6;">Incident #${incidentNumber}</span>
      </div>
      <div class="detail">
        <span class="label">Service:</span> ${service}
      </div>
      <div class="detail">
        <span class="label">Summary:</span> ${summary}
      </div>
      <div class="detail">
        <span class="label">Triggered:</span> ${new Date(triggeredAt).toLocaleString()}
      </div>
      <div class="detail">
        <span class="label">Assigned to:</span> ${user.fullName}
      </div>
      <p style="margin-top: 20px;">Please acknowledge and respond to this incident as soon as possible.</p>
      <a href="#" class="button">Open PagerDuty-Lite App</a>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Create email text body (plain text fallback)
 */
function createEmailTextBody(incident: Incident, user: User): string {
  const severity = incident.severity.toUpperCase();
  const service = incident.service.name;
  const summary = incident.summary;
  const incidentNumber = incident.incidentNumber;
  const triggeredAt = incident.triggeredAt.toISOString();

  return `
NEW INCIDENT ALERT

[${severity}] Incident #${incidentNumber}

Service: ${service}
Summary: ${summary}
Triggered: ${new Date(triggeredAt).toLocaleString()}
Assigned to: ${user.fullName}

Please acknowledge and respond to this incident as soon as possible using the PagerDuty-Lite app.
  `.trim();
}
