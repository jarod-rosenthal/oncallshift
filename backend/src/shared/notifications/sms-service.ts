import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { getDataSource } from '../db/data-source';
import { Incident, Notification, User } from '../models';
import { logger } from '../utils/logger';

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

export interface SMSNotificationPayload {
  incidentId: string;
  userId: string;
  priority: 'high' | 'normal';
  incidentState: 'triggered' | 'acknowledged' | 'resolved';
}

/**
 * Check if SMS notification should be sent based on user preferences
 */
function shouldSendSMS(
  user: User,
  incidentState: 'triggered' | 'acknowledged' | 'resolved'
): boolean {
  const prefs = user.settings?.notificationPreferences?.sms;

  // If no preferences set, default to enabled for triggered/acknowledged
  if (!prefs) {
    return incidentState !== 'resolved';
  }

  // Check if SMS is enabled
  if (!prefs.enabled) {
    return false;
  }

  // Check if this incident state is in the types array
  return prefs.types?.includes(incidentState) ?? false;
}

/**
 * Send SMS notification to a user for an incident
 */
export async function sendSMSNotification(payload: SMSNotificationPayload): Promise<void> {
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
    if (!shouldSendSMS(user, incidentState)) {
      logger.info('SMS notification skipped due to user preferences', {
        userId,
        userEmail: user.email,
        incidentState,
        smsEnabled: user.settings?.notificationPreferences?.sms?.enabled,
        smsTypes: user.settings?.notificationPreferences?.sms?.types,
      });
      return;
    }

    if (!user.phoneNumber) {
      logger.warn('User does not have a phone number configured', { userId, userEmail: user.email });
      return;
    }

    // Create notification record
    const notification = notificationRepo.create({
      orgId: incident.orgId,
      incidentId,
      userId,
      channel: 'sms',
      status: 'pending',
    });
    await notificationRepo.save(notification);

    try {
      // Format phone number (ensure it includes country code)
      const phoneNumber = formatPhoneNumber(user.phoneNumber);

      // Create SMS message
      const message = createSMSMessage(incident);

      // Send via SNS
      const command = new PublishCommand({
        PhoneNumber: phoneNumber,
        Message: message,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: payload.priority === 'high' ? 'Transactional' : 'Promotional',
          },
        },
      });

      const result = await snsClient.send(command);

      // Update notification status
      notification.status = 'sent';
      notification.sentAt = new Date();
      notification.externalId = result.MessageId || null;
      await notificationRepo.save(notification);

      logger.info('SMS notification sent', {
        notificationId: notification.id,
        incidentId,
        userId,
        phoneNumber: maskPhoneNumber(phoneNumber),
        messageId: result.MessageId,
      });
    } catch (error) {
      logger.error('Error sending SMS notification:', error);
      notification.status = 'failed';
      notification.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      notification.failedAt = new Date();
      await notificationRepo.save(notification);
    }
  } catch (error) {
    logger.error('Error in sendSMSNotification:', error);
    throw error;
  }
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // If it doesn't start with +, assume US number and add +1
  if (!phoneNumber.startsWith('+')) {
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
  }

  return phoneNumber.startsWith('+') ? phoneNumber : `+${cleaned}`;
}

/**
 * Mask phone number for logging (show last 4 digits)
 */
function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length <= 4) return phoneNumber;
  return `***${phoneNumber.slice(-4)}`;
}

/**
 * Create SMS message text
 */
function createSMSMessage(incident: Incident): string {
  const severity = incident.severity.toUpperCase();
  const service = incident.service.name;
  const summary = incident.summary;
  const incidentNumber = incident.incidentNumber;

  return `[${severity}] Incident #${incidentNumber}: ${service}\n${summary}\n\nRespond via PagerDuty-Lite app`;
}
