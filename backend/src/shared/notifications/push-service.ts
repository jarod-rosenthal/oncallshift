import { SNSClient, CreatePlatformEndpointCommand, PublishCommand, DeleteEndpointCommand } from '@aws-sdk/client-sns';
import { getDataSource } from '../db/data-source';
import { DeviceToken, Incident, Notification, User } from '../models';
import { logger } from '../utils/logger';

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

export interface PushNotificationPayload {
  incidentId: string;
  userId: string;
  priority: 'high' | 'normal';
}

/**
 * Send push notification to a user for an incident
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<void> {
  const { incidentId, userId, priority } = payload;

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
        notification.externalId = result.MessageId;
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
