import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { DeviceToken, User } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { notFound, internalError, validationError, fromExpressValidator } from '../../shared/utils/problem-details';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * POST /api/v1/devices/register
 * Register a device token for push notifications
 */
router.post(
  '/register',
  [
    body('token').isString().notEmpty().withMessage('Device token is required'),
    body('platform').isIn(['ios', 'android']).withMessage('Invalid platform'),
    body('deviceName').optional().isString(),
    body('appVersion').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { token, platform, deviceName, appVersion } = req.body;
      const user = req.user!;

      const dataSource = await getDataSource();
      const deviceRepo = dataSource.getRepository(DeviceToken);

      // Check if token already exists for this user
      let device = await deviceRepo.findOne({
        where: { userId: user.id, token },
      });

      if (device) {
        // Update existing device
        device.platform = platform;
        device.deviceName = deviceName || device.deviceName;
        device.appVersion = appVersion || device.appVersion;
        device.isActive = true;
        device.lastUsedAt = new Date();
      } else {
        // Create new device
        device = deviceRepo.create({
          userId: user.id,
          token,
          platform,
          deviceName,
          appVersion,
          isActive: true,
        });
      }

      await deviceRepo.save(device);

      // Auto-enable push notifications when a device is registered
      // This makes the experience seamless - if user installed the app and granted
      // notification permissions, they want to receive push notifications
      const userRepo = dataSource.getRepository(User);
      const fullUser = await userRepo.findOne({ where: { id: user.id } });
      if (fullUser) {
        const currentSettings = fullUser.settings || {};
        const currentNotifPrefs = currentSettings.notificationPreferences || {};
        const currentPushPrefs = currentNotifPrefs.push || {};

        // Only set defaults if push isn't explicitly configured
        if (currentPushPrefs.enabled === undefined) {
          fullUser.settings = {
            ...currentSettings,
            notificationPreferences: {
              ...currentNotifPrefs,
              push: {
                enabled: true,
                types: ['triggered', 'acknowledged'],
                ...currentPushPrefs,
              },
            },
          };
          await userRepo.save(fullUser);
          logger.info('Auto-enabled push notifications for user', {
            userId: user.id,
            email: fullUser.email,
          });
        }
      }

      logger.info('Device token registered', {
        userId: user.id,
        platform,
        deviceId: device.id,
        token: token.substring(0, 30) + '...',
      });

      return res.status(201).json({
        device: {
          id: device.id,
          platform: device.platform,
          isActive: device.isActive,
          createdAt: device.createdAt,
        },
        message: 'Device registered successfully',
      });
    } catch (error) {
      logger.error('Error registering device:', error);
      return internalError(res);
    }
  }
);

/**
 * GET /api/v1/devices
 * List user's registered devices
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const dataSource = await getDataSource();
    const deviceRepo = dataSource.getRepository(DeviceToken);

    const devices = await deviceRepo.find({
      where: { userId: user.id, isActive: true },
      order: { lastUsedAt: 'DESC' },
    });

    return res.json({
      devices: devices.map(device => ({
        id: device.id,
        platform: device.platform,
        deviceName: device.deviceName,
        appVersion: device.appVersion,
        lastUsedAt: device.lastUsedAt,
        createdAt: device.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching devices:', error);
    return internalError(res);
  }
});

/**
 * DELETE /api/v1/devices/cleanup
 * Remove all non-Expo device tokens (old FCM tokens that won't work with Expo)
 * NOTE: This route must be defined BEFORE /:id to avoid "cleanup" being treated as an id
 */
router.delete('/cleanup', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const dataSource = await getDataSource();
    const deviceRepo = dataSource.getRepository(DeviceToken);

    const devices = await deviceRepo.find({
      where: { userId: user.id },
    });

    const nonExpoDevices = devices.filter(
      d => !d.token.startsWith('ExponentPushToken[') && !d.token.startsWith('ExpoPushToken[')
    );

    if (nonExpoDevices.length === 0) {
      return res.json({
        message: 'No non-Expo devices found to clean up',
        removedCount: 0,
      });
    }

    // Delete non-Expo devices
    await deviceRepo.remove(nonExpoDevices);

    logger.info('Cleaned up non-Expo device tokens', {
      userId: user.id,
      removedCount: nonExpoDevices.length,
      removedDevices: nonExpoDevices.map(d => ({
        id: d.id,
        platform: d.platform,
        tokenPrefix: d.token.substring(0, 30),
      })),
    });

    return res.json({
      message: `Removed ${nonExpoDevices.length} non-Expo device(s)`,
      removedCount: nonExpoDevices.length,
      removedDevices: nonExpoDevices.map(d => ({
        id: d.id,
        platform: d.platform,
      })),
    });
  } catch (error) {
    logger.error('Error cleaning up devices:', error);
    return internalError(res);
  }
});

/**
 * GET /api/v1/devices/debug
 * Debug endpoint to check push notification configuration
 */
router.get('/debug', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const dataSource = await getDataSource();
    const deviceRepo = dataSource.getRepository(DeviceToken);
    const userRepo = dataSource.getRepository(User);

    const [devices, fullUser] = await Promise.all([
      deviceRepo.find({
        where: { userId: user.id },
        order: { createdAt: 'DESC' },
      }),
      userRepo.findOne({ where: { id: user.id } }),
    ]);

    const notificationPrefs = fullUser?.settings?.notificationPreferences || {};

    return res.json({
      userId: user.id,
      email: fullUser?.email,
      devices: devices.map(device => ({
        id: device.id,
        platform: device.platform,
        isActive: device.isActive,
        tokenPrefix: device.token.substring(0, 40) + '...',
        isExpoToken: device.token.startsWith('ExponentPushToken[') || device.token.startsWith('ExpoPushToken['),
        createdAt: device.createdAt,
        lastUsedAt: device.lastUsedAt,
      })),
      notificationPreferences: {
        push: notificationPrefs.push || { enabled: undefined, types: undefined },
        email: notificationPrefs.email || { enabled: undefined },
        sms: notificationPrefs.sms || { enabled: undefined },
      },
      pushWillWork: {
        hasActiveDevice: devices.some(d => d.isActive),
        hasExpoToken: devices.some(d => d.isActive && (d.token.startsWith('ExponentPushToken[') || d.token.startsWith('ExpoPushToken['))),
        pushEnabled: notificationPrefs.push?.enabled !== false, // undefined = enabled by default
        willReceiveTriggered: notificationPrefs.push?.enabled !== false &&
          (!notificationPrefs.push?.types || notificationPrefs.push.types.includes('triggered')),
      },
    });
  } catch (error) {
    logger.error('Error in debug endpoint:', error);
    return internalError(res);
  }
});

/**
 * DELETE /api/v1/devices/:id
 * Unregister a device token
 * NOTE: This route must be defined AFTER /cleanup and /debug to avoid those paths being treated as IDs
 */
router.delete('/:id',
  param('id').isUUID().withMessage('Invalid device ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const user = req.user!;

      const dataSource = await getDataSource();
      const deviceRepo = dataSource.getRepository(DeviceToken);

      const device = await deviceRepo.findOne({
        where: { id, userId: user.id },
      });

      if (!device) {
        return notFound(res, 'Device', id);
      }

      // Mark as inactive instead of deleting
      device.isActive = false;
      await deviceRepo.save(device);

      logger.info('Device token unregistered', {
        userId: user.id,
        deviceId: device.id,
      });

      return res.json({
        message: 'Device unregistered successfully',
      });
    } catch (error) {
      logger.error('Error unregistering device:', error);
      return internalError(res);
    }
  }
);

export default router;
