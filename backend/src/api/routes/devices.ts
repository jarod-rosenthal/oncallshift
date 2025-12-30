import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { DeviceToken } from '../../shared/models';
import { logger } from '../../shared/utils/logger';

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
        return res.status(400).json({ errors: errors.array() });
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

      logger.info('Device token registered', {
        userId: user.id,
        platform,
        deviceId: device.id,
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
      return res.status(500).json({ error: 'Failed to register device' });
    }
  }
);

/**
 * DELETE /api/v1/devices/:id
 * Unregister a device token
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const dataSource = await getDataSource();
    const deviceRepo = dataSource.getRepository(DeviceToken);

    const device = await deviceRepo.findOne({
      where: { id, userId: user.id },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
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
    return res.status(500).json({ error: 'Failed to unregister device' });
  }
});

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
    return res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

export default router;
