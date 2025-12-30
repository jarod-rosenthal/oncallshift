import { SNSClient, CreatePlatformEndpointCommand, PublishCommand, DeleteEndpointCommand } from '@aws-sdk/client-sns';
import { getDataSource } from '../db/data-source';
import { DeviceToken, Incident, Notification, User } from '../models';
import { logger } from '../utils/logger';

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Expo Push API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Check if token is an Expo push token
 */
function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

/**
 * Send push notification via Expo Push API
 */
async function sendExpoNotification(
  expoPushToken: string,
  incident: Incident,
  notificationId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const title = `🚨 ${incident.severity.toUpperCase()}: ${incident.service?.name || 'Alert'}`;
    const body = incident.summary;

    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data: {
        incidentId: incident.id,
        summary: incident.summary,
        severity: incident.severity,
        state: incident.state,
        serviceName: incident.service?.name,
      },
      priority: 'high',
      channelId: 'incidents',
      categoryId: 'incident',
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.data && result.data.status === 'ok') {
      return { success: true, messageId: result.data.id };
    } else if (result.data && result.data.status === 'error') {
      return { success: false, error: result.data.message || 'Expo push error' };
    } else if (result.errors) {
      return { success: false, error: JSON.stringify(result.errors) };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    logger.error('Error sending Expo push notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export interface PushNotificationPayload {
  incidentId: string;
  userId: string;
  priority: 'high' | 'normal';
  incidentState: 'triggered' | 'acknowledged' | 'resolved';
}

/**
 * Check if push notification should be sent based on user preferences
 */
function shouldSendPush(
  user: User,
  incidentState: 'triggered' | 'acknowledged' | 'resolved'
): boolean {
  const prefs = user.settings?.notificationPreferences?.push;

  // If no preferences set, default to enabled for triggered/acknowledged
  if (!prefs) {
    return incidentState !== 'resolved';
  }

  // Check if push is enabled
  if (!prefs.enabled) {
    return false;
  }

  // Check if this incident state is in the types array
  return prefs.types?.includes(incidentState) ?? false;
}

/**
 * Send push notification to a user for an incident
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<void> {
  const { incidentId, userId, incidentState } = payload;

  try {
    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);
    const incidentRepo = dataSource.getRepository(Incident);
    const deviceRepo = dataSource.getRepository(DeviceToken);
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
    if (!shouldSendPush(user, incidentState)) {
      logger.info('Push notification skipped due to user preferences', {
        userId,
        userEmail: user.email,
        incidentState,
        pushEnabled: user.settings?.notificationPreferences?.push?.enabled,
        pushTypes: user.settings?.notificationPreferences?.push?.types,
      });
      return;
    }

    // Get active device tokens for user
    const devices = await deviceRepo.find({
      where: { userId, isActive: true },
    });

    if (devices.length === 0) {
      logger.warn('No active devices found for user', { userId, userEmail: user.email });
      return;
    }

    // Send notification to each device
    for (const device of devices) {
      const notification = notificationRepo.create({
        incidentId,
        userId,
        channel: 'push',
        status: 'pending',
      });
      await notificationRepo.save(notification);

      try {
        // Check if this is an Expo push token
        if (isExpoPushToken(device.token)) {
          // Send via Expo Push API
          const result = await sendExpoNotification(device.token, incident, notification.id);

          if (result.success) {
            notification.status = 'sent';
            notification.sentAt = new Date();
            notification.externalId = result.messageId || null;
            await notificationRepo.save(notification);

            logger.info('Expo push notification sent', {
              notificationId: notification.id,
              incidentId,
              userId,
              platform: device.platform,
              messageId: result.messageId,
            });
          } else {
            notification.status = 'failed';
            notification.errorMessage = result.error || 'Unknown Expo error';
            notification.failedAt = new Date();
            await notificationRepo.save(notification);

            logger.error('Expo push notification failed', {
              notificationId: notification.id,
              error: result.error,
            });
          }
          continue;
        }

        // For non-Expo tokens, use SNS
        // Get or create SNS platform endpoint
        const endpointArn = await getOrCreatePlatformEndpoint(device);

        if (!endpointArn) {
          notification.status = 'failed';
          notification.errorMessage = 'Failed to create platform endpoint';
          notification.failedAt = new Date();
          await notificationRepo.save(notification);
          continue;
        }

        // Prepare notification payload
        const message = createNotificationMessage(incident, device.platform);

        // Publish to SNS
        const publishCommand = new PublishCommand({
          TargetArn: endpointArn,
          Message: JSON.stringify(message),
          MessageStructure: 'json',
        });

        const result = await snsClient.send(publishCommand);

        // Update notification status
        notification.status = 'sent';
        notification.sentAt = new Date();
        notification.externalId = result.MessageId || null;
        await notificationRepo.save(notification);

        logger.info('Push notification sent', {
          notificationId: notification.id,
          incidentId,
          userId,
          platform: device.platform,
          messageId: result.MessageId,
        });
      } catch (error) {
        logger.error('Error sending push notification to device:', error);
        notification.status = 'failed';
        notification.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        notification.failedAt = new Date();
        await notificationRepo.save(notification);
      }
    }
  } catch (error) {
    logger.error('Error in sendPushNotification:', error);
    throw error;
  }
}

/**
 * Get or create SNS platform endpoint for device
 */
async function getOrCreatePlatformEndpoint(device: DeviceToken): Promise<string | null> {
  try {
    // If we already have an endpoint ARN, return it
    if (device.snsEndpointArn) {
      return device.snsEndpointArn;
    }

    // Determine platform application ARN
    const platformAppArn = device.platform === 'ios'
      ? process.env.APNS_PLATFORM_APP_ARN
      : process.env.FCM_PLATFORM_APP_ARN;

    if (!platformAppArn) {
      logger.error(`Platform application ARN not configured for ${device.platform}`);
      return null;
    }

    // Create platform endpoint
    const command = new CreatePlatformEndpointCommand({
      PlatformApplicationArn: platformAppArn,
      Token: device.token,
      CustomUserData: JSON.stringify({ userId: device.userId }),
    });

    const response = await snsClient.send(command);
    const endpointArn = response.EndpointArn;

    if (!endpointArn) {
      logger.error('No endpoint ARN returned from SNS');
      return null;
    }

    // Save endpoint ARN to device
    const dataSource = await getDataSource();
    const deviceRepo = dataSource.getRepository(DeviceToken);
    device.snsEndpointArn = endpointArn;
    await deviceRepo.save(device);

    logger.info('Created SNS platform endpoint', {
      deviceId: device.id,
      platform: device.platform,
      endpointArn,
    });

    return endpointArn;
  } catch (error) {
    logger.error('Error creating platform endpoint:', error);
    return null;
  }
}

/**
 * Create notification message payload for different platforms
 */
function createNotificationMessage(incident: Incident, platform: 'ios' | 'android') {
  const title = `🚨 ${incident.severity.toUpperCase()}: ${incident.service.name}`;
  const body = incident.summary;
  const data = {
    incidentId: incident.id,
    action: 'open_incident',
  };

  if (platform === 'ios') {
    return {
      APNS: JSON.stringify({
        aps: {
          alert: {
            title,
            body,
          },
          sound: 'default',
          'content-available': 1,
          'interruption-level': 'critical', // High priority
        },
        data,
      }),
    };
  } else {
    // Android (FCM)
    return {
      GCM: JSON.stringify({
        notification: {
          title,
          body,
          sound: 'default',
        },
        data,
        priority: 'high',
        android: {
          priority: 'high',
          notification: {
            channel_id: 'incidents',
            priority: 'high',
          },
        },
      }),
    };
  }
}

/**
 * Delete SNS platform endpoint (when device is unregistered)
 */
export async function deletePlatformEndpoint(endpointArn: string): Promise<void> {
  try {
    const command = new DeleteEndpointCommand({
      EndpointArn: endpointArn,
    });
    await snsClient.send(command);
    logger.info('Deleted SNS platform endpoint', { endpointArn });
  } catch (error) {
    logger.error('Error deleting platform endpoint:', error);
  }
}
