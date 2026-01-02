import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { LessThanOrEqual, MoreThan } from 'typeorm';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Schedule, ScheduleMember, ScheduleOverride, ScheduleLayer, ScheduleLayerMember, Service, User, ShiftHandoffNote } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { generateEntityETag } from '../../shared/utils/etag';
import { checkETagAndRespond } from '../../shared/middleware/etag';
import { setLocationHeader } from '../../shared/utils/location-header';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * @swagger
 * /api/v1/schedules:
 *   get:
 *     summary: List all schedules
 *     description: Returns all on-call schedules for the authenticated user's organization, including the current on-call user for each schedule.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of schedules with current on-call user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 schedules:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Schedule'
 *                       - type: object
 *                         properties:
 *                           currentOncallUser:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               fullName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               profilePictureUrl:
 *                                 type: string
 *                                 nullable: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const userRepo = dataSource.getRepository(User);

    const schedules = await scheduleRepo.find({
      where: { orgId },
      order: { name: 'ASC' },
    });

    // Get user names for all on-call users
    const schedulesWithUsers = await Promise.all(
      schedules.map(async (schedule) => {
        const oncallUserId = schedule.getCurrentOncallUserId();
        let oncallUser = null;
        if (oncallUserId) {
          const user = await userRepo.findOne({ where: { id: oncallUserId } });
          if (user) {
            oncallUser = {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              profilePictureUrl: user.profilePictureUrl,
            };
          }
        }
        return {
          ...formatSchedule(schedule),
          currentOncallUser: oncallUser,
        };
      })
    );

    return res.json({
      schedules: schedulesWithUsers,
    });
  } catch (error) {
    logger.error('Error fetching schedules:', error);
    return res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

/**
 * @swagger
 * /api/v1/schedules/oncall:
 *   get:
 *     summary: Get current on-call users
 *     description: Returns the current on-call users for all active services in the organization that have schedules configured.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Current on-call information for all services
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 oncall:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       service:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                       schedule:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                       oncallUser:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           fullName:
 *                             type: string
 *                           email:
 *                             type: string
 *                           profilePictureUrl:
 *                             type: string
 *                             nullable: true
 *                       isOverride:
 *                         type: boolean
 *                         description: Whether the current on-call is due to an override
 *                       overrideUntil:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         description: When the override expires
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/oncall', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);
    const userRepo = dataSource.getRepository(User);

    // Get all active services with schedules
    const services = await serviceRepo.find({
      where: { orgId, status: 'active' },
      relations: ['schedule'],
    });

    const oncallData = [];

    for (const service of services) {
      if (service.schedule) {
        const schedule = service.schedule;
        const oncallUserId = schedule.getCurrentOncallUserId();

        let oncallUser = null;
        if (oncallUserId) {
          const user = await userRepo.findOne({
            where: { id: oncallUserId },
          });
          if (user) {
            oncallUser = {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              profilePictureUrl: user.profilePictureUrl,
            };
          }
        }

        // Always include services with schedules, even if no one is on-call
        oncallData.push({
          service: {
            id: service.id,
            name: service.name,
          },
          schedule: {
            id: schedule.id,
            name: schedule.name,
          },
          oncallUser,
          isOverride: schedule.overrideUserId !== null && schedule.overrideUntil !== null && new Date(schedule.overrideUntil) > new Date(),
          overrideUntil: schedule.overrideUntil,
        });
      }
    }

    return res.json({
      oncall: oncallData,
    });
  } catch (error) {
    logger.error('Error fetching on-call data:', error);
    return res.status(500).json({ error: 'Failed to fetch on-call data' });
  }
});

/**
 * @swagger
 * /api/v1/schedules/weekly-forecast:
 *   get:
 *     summary: Get weekly on-call forecast
 *     description: Returns a forecast showing who is on-call for each day over the next 2 weeks for all schedules.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Weekly on-call forecast for all schedules
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 forecast:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       schedule:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [manual, daily, weekly]
 *                       days:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             date:
 *                               type: string
 *                               format: date
 *                               example: '2024-01-15'
 *                             dayOfWeek:
 *                               type: string
 *                               example: 'Mon'
 *                             isToday:
 *                               type: boolean
 *                             oncallUser:
 *                               type: object
 *                               nullable: true
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                   format: uuid
 *                                 fullName:
 *                                   type: string
 *                                 email:
 *                                   type: string
 *                                 profilePictureUrl:
 *                                   type: string
 *                                   nullable: true
 *                 weekStart:
 *                   type: string
 *                   format: date
 *                   description: Start date of the forecast week
 *                 generated:
 *                   type: string
 *                   format: date-time
 *                   description: When the forecast was generated
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/weekly-forecast', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const userRepo = dataSource.getRepository(User);

    // Get all schedules with rotation config
    const schedules = await scheduleRepo.find({
      where: { orgId },
      order: { name: 'ASC' },
    });

    // Calculate dates for current week (Mon-Sun) and next week
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    // Generate 14 days (2 weeks)
    const dates: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }

    const forecast: Array<{
      schedule: { id: string; name: string; type: string };
      days: Array<{
        date: string;
        dayOfWeek: string;
        isToday: boolean;
        oncallUser: { id: string; fullName: string; email: string } | null;
      }>;
    }> = [];

    for (const schedule of schedules) {
      const days = await Promise.all(dates.map(async (date) => {
        const oncallUserId = calculateOncallForDate(schedule, date);
        let oncallUser = null;

        if (oncallUserId) {
          const user = await userRepo.findOne({ where: { id: oncallUserId } });
          if (user) {
            oncallUser = {
              id: user.id,
              fullName: user.fullName || user.email,
              email: user.email,
              profilePictureUrl: user.profilePictureUrl,
            };
          }
        }

        const isToday = date.toDateString() === today.toDateString();
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        return {
          date: date.toISOString().split('T')[0],
          dayOfWeek: dayNames[date.getDay()],
          isToday,
          oncallUser,
        };
      }));

      forecast.push({
        schedule: {
          id: schedule.id,
          name: schedule.name,
          type: schedule.type,
        },
        days,
      });
    }

    return res.json({
      forecast,
      weekStart: monday.toISOString().split('T')[0],
      generated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching weekly forecast:', error);
    return res.status(500).json({ error: 'Failed to fetch weekly forecast' });
  }
});

/**
 * Calculate who's on-call for a specific date based on schedule rotation
 */
function calculateOncallForDate(
  schedule: Schedule,
  targetDate: Date
): string | null {
  // If manual schedule, just return current on-call
  if (schedule.type === 'manual' || !schedule.rotation_config) {
    return schedule.getCurrentOncallUserId();
  }

  const rotationConfig = schedule.rotation_config as {
    userIds: string[];
    startDate: string;
    rotationHour: number;
    weekday?: number;
  };

  const { userIds, startDate, rotationHour } = rotationConfig;
  if (!userIds || userIds.length === 0) {
    return schedule.getCurrentOncallUserId();
  }

  const start = new Date(startDate);
  const target = new Date(targetDate);
  target.setHours(rotationHour, 0, 0, 0); // Set to rotation hour

  if (schedule.type === 'daily') {
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceStart = Math.floor((target.getTime() - start.getTime()) / msPerDay);
    const rotationIndex = Math.max(0, daysSinceStart) % userIds.length;
    return userIds[rotationIndex];
  } else if (schedule.type === 'weekly') {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSinceStart = Math.floor((target.getTime() - start.getTime()) / msPerWeek);
    const rotationIndex = Math.max(0, weeksSinceStart) % userIds.length;
    return userIds[rotationIndex];
  }

  return schedule.getCurrentOncallUserId();
}

/**
 * @swagger
 * /api/v1/schedules/{id}:
 *   get:
 *     summary: Get schedule by ID
 *     description: Returns detailed information about a specific schedule, including the current on-call user.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     responses:
 *       200:
 *         description: Schedule details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 schedule:
 *                   $ref: '#/components/schemas/Schedule'
 *                 oncallUser:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     profilePictureUrl:
 *                       type: string
 *                       nullable: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    logger.info('Fetching schedule by ID', { scheduleId: id, orgId, hasOrgId: !!orgId });

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);

    const schedule = await scheduleRepo.findOne({
      where: { id, orgId },
    });

    if (!schedule) {
      // Check if schedule exists without orgId filter
      const scheduleWithoutOrg = await scheduleRepo.findOne({ where: { id } });
      logger.warn('Schedule not found', {
        scheduleId: id,
        requestedOrgId: orgId,
        scheduleExists: !!scheduleWithoutOrg,
        actualOrgId: scheduleWithoutOrg?.orgId,
      });
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Generate ETag from schedule ID and updatedAt timestamp
    const etag = generateEntityETag(schedule.id, schedule.updatedAt);

    // Check If-None-Match - return 304 if client's cached version is current
    if (checkETagAndRespond(req, res, etag)) {
      return; // 304 was sent
    }

    // Get current on-call user if set
    let oncallUser = null;
    const oncallUserId = schedule.getCurrentOncallUserId();
    if (oncallUserId) {
      const userRepo = dataSource.getRepository(User);
      oncallUser = await userRepo.findOne({ where: { id: oncallUserId } });
    }

    return res.json({
      schedule: formatSchedule(schedule),
      oncallUser: oncallUser ? {
        id: oncallUser.id,
        fullName: oncallUser.fullName,
        email: oncallUser.email,
        profilePictureUrl: oncallUser.profilePictureUrl,
      } : null,
    });
  } catch (error) {
    logger.error('Error fetching schedule:', error);
    return res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

/**
 * @swagger
 * /api/v1/schedules:
 *   post:
 *     summary: Create a new schedule
 *     description: Creates a new on-call schedule in the organization.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScheduleCreate'
 *     responses:
 *       201:
 *         description: Schedule created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Schedule created successfully
 *                 schedule:
 *                   $ref: '#/components/schemas/Schedule'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/',
  [
    body('name').isString().notEmpty().withMessage('Schedule name is required'),
    body('description').optional().isString(),
    body('type').optional().isIn(['manual', 'daily', 'weekly']).withMessage('Type must be manual, daily, or weekly'),
    body('timezone').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { name, description, type, timezone } = req.body;

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);

      const schedule = scheduleRepo.create({
        orgId,
        name,
        description: description || null,
        type: type || 'manual',
        timezone: timezone || 'UTC',
      });

      await scheduleRepo.save(schedule);

      logger.info('Schedule created', { scheduleId: schedule.id, name, orgId });

      setLocationHeader(res, req, '/api/v1/schedules', schedule.id);
      return res.status(201).json({
        message: 'Schedule created successfully',
        schedule: formatSchedule(schedule),
      });
    } catch (error) {
      logger.error('Error creating schedule:', error);
      return res.status(500).json({ error: 'Failed to create schedule' });
    }
  }
);

/**
 * @swagger
 * /api/v1/schedules/{id}:
 *   put:
 *     summary: Update a schedule
 *     description: Updates an existing schedule's details.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScheduleUpdate'
 *     responses:
 *       200:
 *         description: Schedule updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Schedule updated successfully
 *                 schedule:
 *                   $ref: '#/components/schemas/Schedule'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:id',
  [
    body('name').optional().isString().notEmpty(),
    body('description').optional().isString(),
    body('type').optional().isIn(['manual', 'daily', 'weekly']),
    body('timezone').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { name, description, type, timezone } = req.body;

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);

      const schedule = await scheduleRepo.findOne({ where: { id, orgId } });

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      if (name !== undefined) schedule.name = name;
      if (description !== undefined) schedule.description = description;
      if (type !== undefined) schedule.type = type;
      if (timezone !== undefined) schedule.timezone = timezone;

      await scheduleRepo.save(schedule);

      logger.info('Schedule updated', { scheduleId: schedule.id, orgId });

      return res.json({
        message: 'Schedule updated successfully',
        schedule: formatSchedule(schedule),
      });
    } catch (error) {
      logger.error('Error updating schedule:', error);
      return res.status(500).json({ error: 'Failed to update schedule' });
    }
  }
);

/**
 * @swagger
 * /api/v1/schedules/{id}:
 *   delete:
 *     summary: Delete a schedule
 *     description: Deletes a schedule and unlinks all services that reference it. Schedule members are also removed.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     responses:
 *       200:
 *         description: Schedule deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Schedule deleted successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const memberRepo = dataSource.getRepository(ScheduleMember);
    const serviceRepo = dataSource.getRepository(Service);

    const schedule = await scheduleRepo.findOne({ where: { id, orgId } });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // First, unlink all services that reference this schedule
    await serviceRepo.update(
      { scheduleId: id },
      { scheduleId: null }
    );

    // Delete all schedule members (foreign key constraint)
    await memberRepo.delete({ scheduleId: id });

    // Delete the schedule
    await scheduleRepo.remove(schedule);

    logger.info('Schedule deleted', { scheduleId: id, orgId });

    return res.json({
      message: 'Schedule deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting schedule:', error);
    return res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

/**
 * @swagger
 * /api/v1/schedules/{id}/oncall:
 *   put:
 *     summary: Set current on-call user
 *     description: Manually sets the current on-call user for a schedule. This is typically used for manual schedules or to override the rotation.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID to set as on-call
 *     responses:
 *       200:
 *         description: On-call user set successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: On-call user set successfully
 *                 schedule:
 *                   $ref: '#/components/schemas/Schedule'
 *                 oncallUser:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     profilePictureUrl:
 *                       type: string
 *                       nullable: true
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:id/oncall',
  [
    body('userId').isUUID().withMessage('Valid user ID is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { userId } = req.body;

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);
      const userRepo = dataSource.getRepository(User);

      const schedule = await scheduleRepo.findOne({ where: { id, orgId } });

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Verify user exists and belongs to the same org
      const user = await userRepo.findOne({ where: { id: userId, orgId } });

      if (!user) {
        return res.status(404).json({ error: 'User not found or not in your organization' });
      }

      schedule.currentOncallUserId = userId;
      await scheduleRepo.save(schedule);

      logger.info('On-call user set', { scheduleId: schedule.id, userId, orgId });

      return res.json({
        message: 'On-call user set successfully',
        schedule: formatSchedule(schedule),
        oncallUser: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          profilePictureUrl: user.profilePictureUrl,
        },
      });
    } catch (error) {
      logger.error('Error setting on-call user:', error);
      return res.status(500).json({ error: 'Failed to set on-call user' });
    }
  }
);

/**
 * @swagger
 * /api/v1/schedules/{id}/override:
 *   post:
 *     summary: Create a temporary on-call override (legacy)
 *     description: Creates a temporary override to the current on-call user. The override expires at the specified time. This is the legacy single-override endpoint; prefer using the /overrides endpoints for multi-override support.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - until
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID to set as the override on-call
 *               until:
 *                 type: string
 *                 format: date-time
 *                 description: When the override should expire (must be in the future)
 *     responses:
 *       200:
 *         description: Override set successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: On-call override set successfully
 *                 schedule:
 *                   $ref: '#/components/schemas/Schedule'
 *                 overrideUser:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *       400:
 *         description: Validation error or end time in the past
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:id/override',
  [
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('until').isISO8601().withMessage('Valid end date/time is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { userId, until } = req.body;

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);
      const userRepo = dataSource.getRepository(User);

      const schedule = await scheduleRepo.findOne({ where: { id, orgId } });

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Verify user exists and belongs to the same org
      const user = await userRepo.findOne({ where: { id: userId, orgId } });

      if (!user) {
        return res.status(404).json({ error: 'User not found or not in your organization' });
      }

      const untilDate = new Date(until);

      if (untilDate <= new Date()) {
        return res.status(400).json({ error: 'Override end time must be in the future' });
      }

      schedule.overrideUserId = userId;
      schedule.overrideUntil = untilDate;
      await scheduleRepo.save(schedule);

      logger.info('On-call override set', { scheduleId: schedule.id, userId, until, orgId });

      return res.json({
        message: 'On-call override set successfully',
        schedule: formatSchedule(schedule),
        overrideUser: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        },
      });
    } catch (error) {
      logger.error('Error setting on-call override:', error);
      return res.status(500).json({ error: 'Failed to set on-call override' });
    }
  }
);

/**
 * @swagger
 * /api/v1/schedules/{id}/override:
 *   delete:
 *     summary: Remove on-call override (legacy)
 *     description: Removes the current on-call override, restoring the normal rotation or manual assignment. This is the legacy single-override endpoint.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     responses:
 *       200:
 *         description: Override removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: On-call override removed successfully
 *                 schedule:
 *                   $ref: '#/components/schemas/Schedule'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id/override', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);

    const schedule = await scheduleRepo.findOne({ where: { id, orgId } });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    schedule.overrideUserId = null;
    schedule.overrideUntil = null;
    await scheduleRepo.save(schedule);

    logger.info('On-call override removed', { scheduleId: schedule.id, orgId });

    return res.json({
      message: 'On-call override removed successfully',
      schedule: formatSchedule(schedule),
    });
  } catch (error) {
    logger.error('Error removing on-call override:', error);
    return res.status(500).json({ error: 'Failed to remove on-call override' });
  }
});

/**
 * @swagger
 * /api/v1/schedules/{id}/rotation:
 *   put:
 *     summary: Configure rotation settings
 *     description: Configures automatic rotation settings for a schedule. Sets up daily or weekly rotation with specified users and timing.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - userIds
 *               - startDate
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [daily, weekly]
 *                 description: Rotation type
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *                 description: User IDs in rotation order
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: When the rotation should start
 *               rotationHour:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 23
 *                 default: 9
 *                 description: Hour of day when rotation occurs (0-23)
 *               weekday:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *                 default: 1
 *                 description: Day of week for weekly rotations (0=Sunday, 6=Saturday)
 *     responses:
 *       200:
 *         description: Rotation configured successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Rotation configured successfully
 *                 schedule:
 *                   $ref: '#/components/schemas/Schedule'
 *                 rotation:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                     userIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                         format: uuid
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                     rotationHour:
 *                       type: integer
 *                     weekday:
 *                       type: integer
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:id/rotation',
  [
    body('type').isIn(['daily', 'weekly']).withMessage('Rotation type must be daily or weekly'),
    body('userIds').isArray({ min: 1 }).withMessage('At least one user is required in rotation'),
    body('userIds.*').isUUID().withMessage('All user IDs must be valid UUIDs'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('rotationHour').optional().isInt({ min: 0, max: 23 }).withMessage('Rotation hour must be between 0-23'),
    body('weekday').optional().isInt({ min: 0, max: 6 }).withMessage('Weekday must be between 0 (Sunday) - 6 (Saturday)'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { type, userIds, startDate, rotationHour, weekday } = req.body;

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);
      const userRepo = dataSource.getRepository(User);

      const schedule = await scheduleRepo.findOne({ where: { id, orgId } });

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Verify all users exist and belong to the same org
      const users = await userRepo.find({
        where: userIds.map((userId: string) => ({ id: userId, orgId })),
      });

      if (users.length !== userIds.length) {
        return res.status(404).json({ error: 'One or more users not found or not in your organization' });
      }

      // Configure rotation
      const rotationConfig = {
        userIds,
        startDate,
        rotationHour: rotationHour || 9, // Default 9 AM
        weekday: type === 'weekly' ? (weekday !== undefined ? weekday : 1) : undefined, // Default Monday for weekly
      };

      schedule.type = type;
      schedule.rotation_config = rotationConfig;

      // Calculate and set the current on-call user based on rotation
      const currentOncallUserId = calculateCurrentOncallUser(rotationConfig, type);
      schedule.currentOncallUserId = currentOncallUserId;

      await scheduleRepo.save(schedule);

      logger.info('Rotation configured', { scheduleId: schedule.id, type, userIds, orgId });

      return res.json({
        message: 'Rotation configured successfully',
        schedule: formatSchedule(schedule),
        rotation: {
          type,
          userIds,
          startDate,
          rotationHour: rotationConfig.rotationHour,
          weekday: rotationConfig.weekday,
        },
      });
    } catch (error) {
      logger.error('Error configuring rotation:', error);
      return res.status(500).json({ error: 'Failed to configure rotation' });
    }
  }
);

/**
 * Helper function to calculate current on-call user based on rotation configuration
 */
function calculateCurrentOncallUser(
  rotationConfig: { userIds: string[]; startDate: string; rotationHour: number; weekday?: number },
  type: string
): string {
  const { userIds, startDate, rotationHour, weekday } = rotationConfig;

  // Convert to timezone-aware dates (simplified - in production use proper timezone library)
  const now = new Date();
  const start = new Date(startDate);

  if (type === 'daily') {
    // Calculate days elapsed since start date
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / msPerDay);

    // Account for rotation hour
    const currentHour = now.getUTCHours(); // Simplified - should use timezone
    if (currentHour < rotationHour) {
      // Haven't rotated yet today
      const rotationIndex = Math.max(0, daysSinceStart - 1) % userIds.length;
      return userIds[rotationIndex];
    }

    const rotationIndex = daysSinceStart % userIds.length;
    return userIds[rotationIndex];
  } else if (type === 'weekly') {
    // Calculate weeks elapsed since start date
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSinceStart = Math.floor((now.getTime() - start.getTime()) / msPerWeek);

    // Check if we've passed the rotation day this week
    const currentDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const currentHour = now.getUTCHours();

    if (currentDay < (weekday || 1) || (currentDay === (weekday || 1) && currentHour < rotationHour)) {
      // Haven't rotated yet this week
      const rotationIndex = Math.max(0, weeksSinceStart - 1) % userIds.length;
      return userIds[rotationIndex];
    }

    const rotationIndex = weeksSinceStart % userIds.length;
    return userIds[rotationIndex];
  }

  // Fallback to first user
  return userIds[0];
}

/**
 * @swagger
 * /api/v1/schedules/{id}/members:
 *   get:
 *     summary: Get schedule members
 *     description: Returns the list of users in the schedule's rotation, ordered by position.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     responses:
 *       200:
 *         description: List of schedule members
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 members:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ScheduleMember'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const memberRepo = dataSource.getRepository(ScheduleMember);
    const userRepo = dataSource.getRepository(User);

    const schedule = await scheduleRepo.findOne({
      where: { id, orgId },
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const members = await memberRepo.find({
      where: { scheduleId: id },
      order: { position: 'ASC' },
    });

    const membersWithUsers = await Promise.all(
      members.map(async (member) => {
        const user = await userRepo.findOne({ where: { id: member.userId } });
        return {
          id: member.id,
          userId: member.userId,
          position: member.position,
          user: user ? {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            hasAvailability: user.settings?.availability !== null && user.settings?.availability !== undefined,
          } : null,
          createdAt: member.createdAt,
        };
      })
    );

    return res.json({
      members: membersWithUsers,
    });
  } catch (error) {
    logger.error('Error fetching schedule members:', error);
    return res.status(500).json({ error: 'Failed to fetch schedule members' });
  }
});

/**
 * @swagger
 * /api/v1/schedules/{id}/members:
 *   post:
 *     summary: Add a member to the schedule
 *     description: Adds a user to the schedule's rotation. The user must have availability configured.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID to add to the schedule
 *     responses:
 *       201:
 *         description: Member added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User added to schedule successfully
 *                 member:
 *                   $ref: '#/components/schemas/ScheduleMember'
 *       400:
 *         description: Validation error or user already member or user has no availability
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:id/members',
  [
    body('userId').isUUID().withMessage('Valid user ID is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = req.user!;
      logger.info('Add member request', {
        requestingUser: user.id,
        requestingUserRole: user.role,
        requestingUserOrgId: user.orgId
      });

      const { id } = req.params;
      const { userId } = req.body;
      const orgId = req.orgId!;

      logger.info('Adding user to schedule', { scheduleId: id, targetUserId: userId, orgId });

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);
      const memberRepo = dataSource.getRepository(ScheduleMember);
      const userRepo = dataSource.getRepository(User);

      const schedule = await scheduleRepo.findOne({ where: { id, orgId } });
      if (!schedule) {
        logger.warn('Schedule not found', { scheduleId: id, orgId });
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const targetUser = await userRepo.findOne({ where: { id: userId, orgId } });
      if (!targetUser) {
        logger.warn('Target user not found', { userId, orgId });
        return res.status(404).json({ error: 'User not found or not in your organization' });
      }

      // Check if user has set availability
      if (!targetUser.settings?.availability) {
        return res.status(400).json({ error: 'User must set their availability before being added to a schedule' });
      }

      // Check if user is already a member
      const existingMember = await memberRepo.findOne({
        where: { scheduleId: id, userId },
      });
      if (existingMember) {
        return res.status(400).json({ error: 'User is already a member of this schedule' });
      }

      // Get next position
      const maxPosition = await memberRepo
        .createQueryBuilder('member')
        .select('MAX(member.position)', 'max')
        .where('member.scheduleId = :scheduleId', { scheduleId: id })
        .getRawOne();

      const nextPosition = (maxPosition?.max !== null ? maxPosition.max : -1) + 1;

      // Create member
      const member = memberRepo.create({
        scheduleId: id,
        userId,
        position: nextPosition,
        addedBy: user.id,
      });

      await memberRepo.save(member);

      logger.info('User added to schedule', { scheduleId: id, userId, position: nextPosition, addedBy: user.id });

      setLocationHeader(res, req, `/api/v1/schedules/${id}/members`, member.id);
      return res.status(201).json({
        message: 'User added to schedule successfully',
        member: {
          id: member.id,
          userId: member.userId,
          position: member.position,
          user: {
            id: targetUser.id,
            email: targetUser.email,
            fullName: targetUser.fullName,
          },
        },
      });
    } catch (error) {
      logger.error('Error adding user to schedule:', error);
      return res.status(500).json({ error: 'Failed to add user to schedule' });
    }
  }
);

/**
 * @swagger
 * /api/v1/schedules/{id}/members/{memberId}:
 *   delete:
 *     summary: Remove a member from the schedule
 *     description: Removes a user from the schedule's rotation. Remaining members are reordered.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Member ID to remove
 *     responses:
 *       200:
 *         description: Member removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User removed from schedule successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or member not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id/members/:memberId', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id, memberId } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const memberRepo = dataSource.getRepository(ScheduleMember);

    const schedule = await scheduleRepo.findOne({ where: { id, orgId } });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const member = await memberRepo.findOne({
      where: { id: memberId, scheduleId: id },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const removedPosition = member.position;

    // Remove member
    await memberRepo.remove(member);

    // Reorder remaining members
    const remainingMembers = await memberRepo.find({
      where: { scheduleId: id },
      order: { position: 'ASC' },
    });

    for (let i = 0; i < remainingMembers.length; i++) {
      if (remainingMembers[i].position !== i) {
        await memberRepo.update(remainingMembers[i].id, { position: i });
      }
    }

    logger.info('User removed from schedule', { scheduleId: id, memberId, removedPosition, removedBy: user.id });

    return res.json({
      message: 'User removed from schedule successfully',
    });
  } catch (error) {
    logger.error('Error removing user from schedule:', error);
    return res.status(500).json({ error: 'Failed to remove user from schedule' });
  }
});

/**
 * @swagger
 * /api/v1/schedules/{id}/members/{memberId}/position:
 *   put:
 *     summary: Reorder a member in the rotation
 *     description: Changes the position of a member in the schedule's rotation order.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Member ID to reorder
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - position
 *             properties:
 *               position:
 *                 type: integer
 *                 minimum: 0
 *                 description: New position in the rotation (0-indexed)
 *     responses:
 *       200:
 *         description: Member position updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Member position updated successfully
 *       400:
 *         description: Invalid position
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or member not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:id/members/:memberId/position',
  [
    body('position').isInt({ min: 0 }).withMessage('Valid position is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = req.user!;
      const { id, memberId } = req.params;
      const { position: newPosition } = req.body;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);
      const memberRepo = dataSource.getRepository(ScheduleMember);

      const schedule = await scheduleRepo.findOne({ where: { id, orgId } });
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const member = await memberRepo.findOne({
        where: { id: memberId, scheduleId: id },
      });

      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      const oldPosition = member.position;

      if (oldPosition === newPosition) {
        return res.json({ message: 'Position unchanged' });
      }

      // Get all members
      const allMembers = await memberRepo.find({
        where: { scheduleId: id },
        order: { position: 'ASC' },
      });

      // Reorder logic
      if (newPosition >= allMembers.length) {
        return res.status(400).json({ error: 'Invalid position' });
      }

      // Remove member from current position
      const reorderedMembers = allMembers.filter(m => m.id !== memberId);
      // Insert at new position
      reorderedMembers.splice(newPosition, 0, member);

      // Update all positions
      for (let i = 0; i < reorderedMembers.length; i++) {
        await memberRepo.update(reorderedMembers[i].id, { position: i });
      }

      logger.info('Member position updated', {
        scheduleId: id,
        memberId,
        oldPosition,
        newPosition,
        updatedBy: user.id,
      });

      return res.json({
        message: 'Member position updated successfully',
      });
    } catch (error) {
      logger.error('Error updating member position:', error);
      return res.status(500).json({ error: 'Failed to update member position' });
    }
  }
);

// Helper function to format schedule response
function formatSchedule(schedule: Schedule) {
  return {
    id: schedule.id,
    name: schedule.name,
    description: schedule.description,
    type: schedule.type,
    timezone: schedule.timezone,
    currentOncallUserId: schedule.getCurrentOncallUserId(),
    isOverride: schedule.overrideUserId !== null,
    overrideUntil: schedule.overrideUntil,
    rotationConfig: schedule.rotation_config,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

// ============================================================================
// SCHEDULE OVERRIDES (New Multi-Override System)
// ============================================================================

/**
 * @swagger
 * /api/v1/schedules/{id}/overrides:
 *   get:
 *     summary: List schedule overrides
 *     description: Returns all overrides for a schedule, including active, upcoming, and recently ended (past 7 days) overrides.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     responses:
 *       200:
 *         description: List of schedule overrides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 schedule:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                 overrides:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       scheduleId:
 *                         type: string
 *                         format: uuid
 *                       userId:
 *                         type: string
 *                         format: uuid
 *                       user:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           fullName:
 *                             type: string
 *                           email:
 *                             type: string
 *                       startTime:
 *                         type: string
 *                         format: date-time
 *                       endTime:
 *                         type: string
 *                         format: date-time
 *                       reason:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         enum: [active, upcoming, ended]
 *                       createdBy:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           fullName:
 *                             type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 activeOverride:
 *                   type: object
 *                   nullable: true
 *                   description: The currently active override, if any
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/overrides', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const overrideRepo = dataSource.getRepository(ScheduleOverride);

    const schedule = await scheduleRepo.findOne({ where: { id, orgId } });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Get all overrides for this schedule (past 7 days + future)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const overrides = await overrideRepo.find({
      where: {
        scheduleId: id,
        endTime: MoreThan(sevenDaysAgo),
      },
      relations: ['user', 'createdByUser'],
      order: { startTime: 'ASC' },
    });

    const now = new Date();
    const formattedOverrides = overrides.map(o => ({
      id: o.id,
      scheduleId: o.scheduleId,
      userId: o.userId,
      user: o.user ? {
        id: o.user.id,
        fullName: o.user.fullName,
        email: o.user.email,
      } : null,
      startTime: o.startTime,
      endTime: o.endTime,
      reason: o.reason,
      status: o.endTime < now ? 'ended' : o.startTime <= now ? 'active' : 'upcoming',
      createdBy: o.createdByUser ? {
        id: o.createdByUser.id,
        fullName: o.createdByUser.fullName,
      } : null,
      createdAt: o.createdAt,
    }));

    return res.json({
      schedule: { id: schedule.id, name: schedule.name },
      overrides: formattedOverrides,
      activeOverride: formattedOverrides.find(o => o.status === 'active') || null,
    });
  } catch (error) {
    logger.error('Error fetching schedule overrides:', error);
    return res.status(500).json({ error: 'Failed to fetch overrides' });
  }
});

/**
 * @swagger
 * /api/v1/schedules/{id}/overrides:
 *   post:
 *     summary: Create a schedule override
 *     description: Creates a new override for the schedule. Overrides cannot overlap with existing overrides.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - startTime
 *               - endTime
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User who will cover the shift
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: When the override starts
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: When the override ends (must be after start and in the future)
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional reason for the override
 *     responses:
 *       201:
 *         description: Override created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Override created successfully
 *                 override:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     scheduleId:
 *                       type: string
 *                       format: uuid
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         fullName:
 *                           type: string
 *                         email:
 *                           type: string
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                     reason:
 *                       type: string
 *                       nullable: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error or end time before start
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       409:
 *         description: Override overlaps with existing override
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Override overlaps with an existing override
 *                 conflictingOverride:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:id/overrides',
  [
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('startTime').isISO8601().withMessage('Valid start date/time is required'),
    body('endTime').isISO8601().withMessage('Valid end date/time is required'),
    body('reason').optional().isString().isLength({ max: 500 }).withMessage('Reason must be a string under 500 characters'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const currentUser = req.user!;
      const { userId, startTime, endTime, reason } = req.body;

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);
      const userRepo = dataSource.getRepository(User);
      const overrideRepo = dataSource.getRepository(ScheduleOverride);

      const schedule = await scheduleRepo.findOne({ where: { id, orgId } });
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Verify the covering user exists and belongs to the same org
      const coveringUser = await userRepo.findOne({ where: { id: userId, orgId } });
      if (!coveringUser) {
        return res.status(404).json({ error: 'User not found or not in your organization' });
      }

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (end <= start) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }

      if (end <= new Date()) {
        return res.status(400).json({ error: 'Override end time must be in the future' });
      }

      // Check for overlapping overrides
      const overlapping = await overrideRepo.findOne({
        where: {
          scheduleId: id,
          startTime: LessThanOrEqual(end),
          endTime: MoreThan(start),
        },
      });

      if (overlapping) {
        return res.status(409).json({
          error: 'Override overlaps with an existing override',
          conflictingOverride: {
            id: overlapping.id,
            startTime: overlapping.startTime,
            endTime: overlapping.endTime,
          },
        });
      }

      // Create the override
      const override = overrideRepo.create({
        scheduleId: id,
        userId,
        startTime: start,
        endTime: end,
        reason: reason || null,
        createdBy: currentUser.id,
      });

      await overrideRepo.save(override);

      logger.info('Schedule override created', {
        overrideId: override.id,
        scheduleId: id,
        userId,
        startTime: start,
        endTime: end,
        createdBy: currentUser.id,
      });

      setLocationHeader(res, req, `/api/v1/schedules/${id}/overrides`, override.id);
      return res.status(201).json({
        message: 'Override created successfully',
        override: {
          id: override.id,
          scheduleId: override.scheduleId,
          userId: override.userId,
          user: {
            id: coveringUser.id,
            fullName: coveringUser.fullName,
            email: coveringUser.email,
          },
          startTime: override.startTime,
          endTime: override.endTime,
          reason: override.reason,
          createdAt: override.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error creating schedule override:', error);
      return res.status(500).json({ error: 'Failed to create override' });
    }
  }
);

/**
 * @swagger
 * /api/v1/schedules/{scheduleId}/overrides/{overrideId}:
 *   put:
 *     summary: Update a schedule override
 *     description: Updates an existing override's details.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *       - in: path
 *         name: overrideId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Override ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User who will cover the shift
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: When the override starts
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: When the override ends
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for the override
 *     responses:
 *       200:
 *         description: Override updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Override updated successfully
 *                 override:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     scheduleId:
 *                       type: string
 *                       format: uuid
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     user:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         fullName:
 *                           type: string
 *                         email:
 *                           type: string
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                     reason:
 *                       type: string
 *                       nullable: true
 *       400:
 *         description: Validation error or end time before start
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule, override, or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:scheduleId/overrides/:overrideId',
  [
    body('userId').optional().isUUID().withMessage('Valid user ID is required'),
    body('startTime').optional().isISO8601().withMessage('Valid start date/time is required'),
    body('endTime').optional().isISO8601().withMessage('Valid end date/time is required'),
    body('reason').optional().isString().isLength({ max: 500 }).withMessage('Reason must be under 500 characters'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { scheduleId, overrideId } = req.params;
      const orgId = req.orgId!;
      const { userId, startTime, endTime, reason } = req.body;

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);
      const userRepo = dataSource.getRepository(User);
      const overrideRepo = dataSource.getRepository(ScheduleOverride);

      const schedule = await scheduleRepo.findOne({ where: { id: scheduleId, orgId } });
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const override = await overrideRepo.findOne({
        where: { id: overrideId, scheduleId },
        relations: ['user'],
      });
      if (!override) {
        return res.status(404).json({ error: 'Override not found' });
      }

      // Update fields if provided
      if (userId) {
        const coveringUser = await userRepo.findOne({ where: { id: userId, orgId } });
        if (!coveringUser) {
          return res.status(404).json({ error: 'User not found or not in your organization' });
        }
        override.userId = userId;
      }

      if (startTime) {
        override.startTime = new Date(startTime);
      }

      if (endTime) {
        override.endTime = new Date(endTime);
      }

      if (reason !== undefined) {
        override.reason = reason || null;
      }

      // Validate time range
      if (override.endTime <= override.startTime) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }

      await overrideRepo.save(override);

      // Reload with relations
      const updated = await overrideRepo.findOne({
        where: { id: overrideId },
        relations: ['user'],
      });

      logger.info('Schedule override updated', { overrideId, scheduleId });

      return res.json({
        message: 'Override updated successfully',
        override: {
          id: updated!.id,
          scheduleId: updated!.scheduleId,
          userId: updated!.userId,
          user: updated!.user ? {
            id: updated!.user.id,
            fullName: updated!.user.fullName,
            email: updated!.user.email,
          } : null,
          startTime: updated!.startTime,
          endTime: updated!.endTime,
          reason: updated!.reason,
        },
      });
    } catch (error) {
      logger.error('Error updating schedule override:', error);
      return res.status(500).json({ error: 'Failed to update override' });
    }
  }
);

/**
 * @swagger
 * /api/v1/schedules/{scheduleId}/overrides/{overrideId}:
 *   delete:
 *     summary: Delete a schedule override
 *     description: Deletes an override from the schedule.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *       - in: path
 *         name: overrideId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Override ID
 *     responses:
 *       200:
 *         description: Override deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Override deleted successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or override not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:scheduleId/overrides/:overrideId', async (req: Request, res: Response) => {
  try {
    const { scheduleId, overrideId } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const overrideRepo = dataSource.getRepository(ScheduleOverride);

    const schedule = await scheduleRepo.findOne({ where: { id: scheduleId, orgId } });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const override = await overrideRepo.findOne({ where: { id: overrideId, scheduleId } });
    if (!override) {
      return res.status(404).json({ error: 'Override not found' });
    }

    await overrideRepo.remove(override);

    logger.info('Schedule override deleted', { overrideId, scheduleId });

    return res.json({ message: 'Override deleted successfully' });
  } catch (error) {
    logger.error('Error deleting schedule override:', error);
    return res.status(500).json({ error: 'Failed to delete override' });
  }
});

// ============================================================================
// SCHEDULE LAYERS (PagerDuty-style Rotation Layers)
// ============================================================================

/**
 * @swagger
 * /api/v1/schedules/{id}/layers:
 *   get:
 *     summary: List schedule layers
 *     description: Returns all rotation layers for a schedule. Layers allow complex rotation configurations with multiple overlapping schedules.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     responses:
 *       200:
 *         description: List of schedule layers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 schedule:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                 layers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ScheduleLayer'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/layers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const layerRepo = dataSource.getRepository(ScheduleLayer);

    const schedule = await scheduleRepo.findOne({ where: { id, orgId } });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const layers = await layerRepo.find({
      where: { scheduleId: id },
      relations: ['members', 'members.user'],
      order: { layerOrder: 'ASC' },
    });

    const formattedLayers = layers.map(layer => ({
      id: layer.id,
      scheduleId: layer.scheduleId,
      name: layer.name,
      rotationType: layer.rotationType,
      startDate: layer.startDate,
      endDate: layer.endDate,
      handoffTime: layer.handoffTime,
      handoffDay: layer.handoffDay,
      rotationLength: layer.rotationLength,
      layerOrder: layer.layerOrder,
      restrictions: layer.restrictions,
      members: layer.members
        .sort((a, b) => a.position - b.position)
        .map(m => ({
          id: m.id,
          userId: m.userId,
          position: m.position,
          user: m.user ? {
            id: m.user.id,
            fullName: m.user.fullName,
            email: m.user.email,
          } : null,
        })),
      currentOncallUserId: layer.calculateOncallUserId(new Date()),
      createdAt: layer.createdAt,
      updatedAt: layer.updatedAt,
    }));

    return res.json({
      schedule: { id: schedule.id, name: schedule.name },
      layers: formattedLayers,
    });
  } catch (error) {
    logger.error('Error fetching schedule layers:', error);
    return res.status(500).json({ error: 'Failed to fetch layers' });
  }
});

/**
 * @swagger
 * /api/v1/schedules/{id}/layers:
 *   post:
 *     summary: Create a schedule layer
 *     description: Creates a new rotation layer for the schedule. Layers can have different rotation types, handoff times, and restrictions.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScheduleLayerCreate'
 *     responses:
 *       201:
 *         description: Layer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Layer created successfully
 *                 layer:
 *                   $ref: '#/components/schemas/ScheduleLayer'
 *       400:
 *         description: Validation error or users not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:id/layers',
  [
    body('name').isString().notEmpty().withMessage('Layer name is required'),
    body('rotationType').isIn(['daily', 'weekly', 'custom']).withMessage('Rotation type must be daily, weekly, or custom'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').optional({ nullable: true }).isISO8601().withMessage('End date must be a valid date'),
    body('handoffTime').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Handoff time must be in HH:MM format'),
    body('handoffDay').optional().isInt({ min: 0, max: 6 }).withMessage('Handoff day must be 0-6 (Sunday-Saturday)'),
    body('rotationLength').optional().isInt({ min: 1 }).withMessage('Rotation length must be at least 1'),
    body('layerOrder').optional().isInt({ min: 0 }).withMessage('Layer order must be a non-negative integer'),
    body('restrictions').optional().isObject().withMessage('Restrictions must be an object'),
    body('userIds').optional().isArray().withMessage('User IDs must be an array'),
    body('userIds.*').optional().isUUID().withMessage('All user IDs must be valid UUIDs'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const {
        name,
        rotationType,
        startDate,
        endDate,
        handoffTime,
        handoffDay,
        rotationLength,
        layerOrder,
        restrictions,
        userIds,
      } = req.body;

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);
      const layerRepo = dataSource.getRepository(ScheduleLayer);
      const memberRepo = dataSource.getRepository(ScheduleLayerMember);
      const userRepo = dataSource.getRepository(User);

      const schedule = await scheduleRepo.findOne({ where: { id, orgId } });
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Get max layer order if not specified
      let effectiveLayerOrder = layerOrder;
      if (effectiveLayerOrder === undefined) {
        const maxOrderResult = await layerRepo
          .createQueryBuilder('layer')
          .select('MAX(layer.layerOrder)', 'max')
          .where('layer.scheduleId = :scheduleId', { scheduleId: id })
          .getRawOne();
        effectiveLayerOrder = (maxOrderResult?.max ?? -1) + 1;
      }

      // Create the layer
      const layer = layerRepo.create({
        scheduleId: id,
        name,
        rotationType,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        handoffTime: handoffTime || '09:00:00',
        handoffDay: handoffDay ?? (rotationType === 'weekly' ? 1 : null),
        rotationLength: rotationLength || 1,
        layerOrder: effectiveLayerOrder,
        restrictions: restrictions || null,
      });

      await layerRepo.save(layer);

      // Add users as members if provided
      if (userIds && userIds.length > 0) {
        // Verify all users exist
        const users = await userRepo.find({
          where: userIds.map((userId: string) => ({ id: userId, orgId })),
        });

        if (users.length !== userIds.length) {
          // Rollback layer creation
          await layerRepo.remove(layer);
          return res.status(400).json({ error: 'One or more users not found in your organization' });
        }

        // Create members
        for (let i = 0; i < userIds.length; i++) {
          const member = memberRepo.create({
            layerId: layer.id,
            userId: userIds[i],
            position: i,
          });
          await memberRepo.save(member);
        }
      }

      // Reload with members
      const savedLayer = await layerRepo.findOne({
        where: { id: layer.id },
        relations: ['members', 'members.user'],
      });

      logger.info('Schedule layer created', {
        layerId: layer.id,
        scheduleId: id,
        name,
        rotationType,
        memberCount: userIds?.length || 0,
      });

      setLocationHeader(res, req, `/api/v1/schedules/${id}/layers`, layer.id);
      return res.status(201).json({
        message: 'Layer created successfully',
        layer: {
          id: savedLayer!.id,
          scheduleId: savedLayer!.scheduleId,
          name: savedLayer!.name,
          rotationType: savedLayer!.rotationType,
          startDate: savedLayer!.startDate,
          endDate: savedLayer!.endDate,
          handoffTime: savedLayer!.handoffTime,
          handoffDay: savedLayer!.handoffDay,
          rotationLength: savedLayer!.rotationLength,
          layerOrder: savedLayer!.layerOrder,
          restrictions: savedLayer!.restrictions,
          members: savedLayer!.members
            .sort((a, b) => a.position - b.position)
            .map(m => ({
              id: m.id,
              userId: m.userId,
              position: m.position,
              user: m.user ? {
                id: m.user.id,
                fullName: m.user.fullName,
                email: m.user.email,
              } : null,
            })),
          currentOncallUserId: savedLayer!.calculateOncallUserId(new Date()),
          createdAt: savedLayer!.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error creating schedule layer:', error);
      return res.status(500).json({ error: 'Failed to create layer' });
    }
  }
);

/**
 * @swagger
 * /api/v1/schedules/{scheduleId}/layers/{layerId}:
 *   get:
 *     summary: Get a schedule layer
 *     description: Returns details of a specific layer in the schedule.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *       - in: path
 *         name: layerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Layer ID
 *     responses:
 *       200:
 *         description: Layer details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 layer:
 *                   $ref: '#/components/schemas/ScheduleLayer'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or layer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:scheduleId/layers/:layerId', async (req: Request, res: Response) => {
  try {
    const { scheduleId, layerId } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const layerRepo = dataSource.getRepository(ScheduleLayer);

    const schedule = await scheduleRepo.findOne({ where: { id: scheduleId, orgId } });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const layer = await layerRepo.findOne({
      where: { id: layerId, scheduleId },
      relations: ['members', 'members.user'],
    });

    if (!layer) {
      return res.status(404).json({ error: 'Layer not found' });
    }

    return res.json({
      layer: {
        id: layer.id,
        scheduleId: layer.scheduleId,
        name: layer.name,
        rotationType: layer.rotationType,
        startDate: layer.startDate,
        endDate: layer.endDate,
        handoffTime: layer.handoffTime,
        handoffDay: layer.handoffDay,
        rotationLength: layer.rotationLength,
        layerOrder: layer.layerOrder,
        restrictions: layer.restrictions,
        members: layer.members
          .sort((a, b) => a.position - b.position)
          .map(m => ({
            id: m.id,
            userId: m.userId,
            position: m.position,
            user: m.user ? {
              id: m.user.id,
              fullName: m.user.fullName,
              email: m.user.email,
            } : null,
          })),
        currentOncallUserId: layer.calculateOncallUserId(new Date()),
        createdAt: layer.createdAt,
        updatedAt: layer.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching schedule layer:', error);
    return res.status(500).json({ error: 'Failed to fetch layer' });
  }
});

/**
 * @swagger
 * /api/v1/schedules/{scheduleId}/layers/{layerId}:
 *   put:
 *     summary: Update a schedule layer
 *     description: Updates the configuration of an existing layer.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *       - in: path
 *         name: layerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Layer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Layer name
 *               rotationType:
 *                 type: string
 *                 enum: [daily, weekly, custom]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               handoffTime:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}(:\d{2})?$'
 *                 example: '09:00'
 *               handoffDay:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *               rotationLength:
 *                 type: integer
 *                 minimum: 1
 *               layerOrder:
 *                 type: integer
 *                 minimum: 0
 *               restrictions:
 *                 $ref: '#/components/schemas/LayerRestrictions'
 *     responses:
 *       200:
 *         description: Layer updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Layer updated successfully
 *                 layer:
 *                   $ref: '#/components/schemas/ScheduleLayer'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or layer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:scheduleId/layers/:layerId',
  [
    body('name').optional().isString().notEmpty().withMessage('Layer name cannot be empty'),
    body('rotationType').optional().isIn(['daily', 'weekly', 'custom']).withMessage('Rotation type must be daily, weekly, or custom'),
    body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
    body('endDate').optional({ nullable: true }).isISO8601().withMessage('End date must be a valid date'),
    body('handoffTime').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Handoff time must be in HH:MM format'),
    body('handoffDay').optional().isInt({ min: 0, max: 6 }).withMessage('Handoff day must be 0-6'),
    body('rotationLength').optional().isInt({ min: 1 }).withMessage('Rotation length must be at least 1'),
    body('layerOrder').optional().isInt({ min: 0 }).withMessage('Layer order must be non-negative'),
    body('restrictions').optional({ nullable: true }).isObject().withMessage('Restrictions must be an object'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { scheduleId, layerId } = req.params;
      const orgId = req.orgId!;
      const {
        name,
        rotationType,
        startDate,
        endDate,
        handoffTime,
        handoffDay,
        rotationLength,
        layerOrder,
        restrictions,
      } = req.body;

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);
      const layerRepo = dataSource.getRepository(ScheduleLayer);

      const schedule = await scheduleRepo.findOne({ where: { id: scheduleId, orgId } });
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const layer = await layerRepo.findOne({
        where: { id: layerId, scheduleId },
        relations: ['members', 'members.user'],
      });

      if (!layer) {
        return res.status(404).json({ error: 'Layer not found' });
      }

      // Update fields
      if (name !== undefined) layer.name = name;
      if (rotationType !== undefined) layer.rotationType = rotationType;
      if (startDate !== undefined) layer.startDate = new Date(startDate);
      if (endDate !== undefined) layer.endDate = endDate ? new Date(endDate) : null;
      if (handoffTime !== undefined) layer.handoffTime = handoffTime;
      if (handoffDay !== undefined) layer.handoffDay = handoffDay;
      if (rotationLength !== undefined) layer.rotationLength = rotationLength;
      if (layerOrder !== undefined) layer.layerOrder = layerOrder;
      if (restrictions !== undefined) layer.restrictions = restrictions;

      await layerRepo.save(layer);

      logger.info('Schedule layer updated', { layerId, scheduleId });

      return res.json({
        message: 'Layer updated successfully',
        layer: {
          id: layer.id,
          scheduleId: layer.scheduleId,
          name: layer.name,
          rotationType: layer.rotationType,
          startDate: layer.startDate,
          endDate: layer.endDate,
          handoffTime: layer.handoffTime,
          handoffDay: layer.handoffDay,
          rotationLength: layer.rotationLength,
          layerOrder: layer.layerOrder,
          restrictions: layer.restrictions,
          members: layer.members
            .sort((a, b) => a.position - b.position)
            .map(m => ({
              id: m.id,
              userId: m.userId,
              position: m.position,
              user: m.user ? {
                id: m.user.id,
                fullName: m.user.fullName,
                email: m.user.email,
              } : null,
            })),
          currentOncallUserId: layer.calculateOncallUserId(new Date()),
          updatedAt: layer.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Error updating schedule layer:', error);
      return res.status(500).json({ error: 'Failed to update layer' });
    }
  }
);

/**
 * @swagger
 * /api/v1/schedules/{scheduleId}/layers/{layerId}:
 *   delete:
 *     summary: Delete a schedule layer
 *     description: Deletes a layer from the schedule. Members of the layer are also removed.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *       - in: path
 *         name: layerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Layer ID
 *     responses:
 *       200:
 *         description: Layer deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Layer deleted successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or layer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:scheduleId/layers/:layerId', async (req: Request, res: Response) => {
  try {
    const { scheduleId, layerId } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const layerRepo = dataSource.getRepository(ScheduleLayer);

    const schedule = await scheduleRepo.findOne({ where: { id: scheduleId, orgId } });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const layer = await layerRepo.findOne({ where: { id: layerId, scheduleId } });
    if (!layer) {
      return res.status(404).json({ error: 'Layer not found' });
    }

    await layerRepo.remove(layer);

    logger.info('Schedule layer deleted', { layerId, scheduleId });

    return res.json({ message: 'Layer deleted successfully' });
  } catch (error) {
    logger.error('Error deleting schedule layer:', error);
    return res.status(500).json({ error: 'Failed to delete layer' });
  }
});

/**
 * @swagger
 * /api/v1/schedules/{scheduleId}/layers/{layerId}/members:
 *   put:
 *     summary: Set layer members
 *     description: Replaces all existing members of a layer with a new list. Members are added in the order provided.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *       - in: path
 *         name: layerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Layer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: User IDs in rotation order
 *     responses:
 *       200:
 *         description: Layer members updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Layer members updated successfully
 *                 members:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ScheduleLayerMember'
 *                 currentOncallUserId:
 *                   type: string
 *                   format: uuid
 *                   nullable: true
 *       400:
 *         description: Validation error or users not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or layer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:scheduleId/layers/:layerId/members',
  [
    body('userIds').isArray().withMessage('User IDs must be an array'),
    body('userIds.*').isUUID().withMessage('All user IDs must be valid UUIDs'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { scheduleId, layerId } = req.params;
      const orgId = req.orgId!;
      const { userIds } = req.body;

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);
      const layerRepo = dataSource.getRepository(ScheduleLayer);
      const memberRepo = dataSource.getRepository(ScheduleLayerMember);
      const userRepo = dataSource.getRepository(User);

      const schedule = await scheduleRepo.findOne({ where: { id: scheduleId, orgId } });
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      const layer = await layerRepo.findOne({ where: { id: layerId, scheduleId } });
      if (!layer) {
        return res.status(404).json({ error: 'Layer not found' });
      }

      // Verify all users exist in the org
      if (userIds.length > 0) {
        const users = await userRepo.find({
          where: userIds.map((userId: string) => ({ id: userId, orgId })),
        });

        if (users.length !== userIds.length) {
          return res.status(400).json({ error: 'One or more users not found in your organization' });
        }
      }

      // Delete existing members
      await memberRepo.delete({ layerId });

      // Create new members
      for (let i = 0; i < userIds.length; i++) {
        const member = memberRepo.create({
          layerId,
          userId: userIds[i],
          position: i,
        });
        await memberRepo.save(member);
      }

      // Reload layer with members
      const updatedLayer = await layerRepo.findOne({
        where: { id: layerId },
        relations: ['members', 'members.user'],
      });

      logger.info('Schedule layer members updated', {
        layerId,
        scheduleId,
        memberCount: userIds.length,
      });

      return res.json({
        message: 'Layer members updated successfully',
        members: updatedLayer!.members
          .sort((a, b) => a.position - b.position)
          .map(m => ({
            id: m.id,
            userId: m.userId,
            position: m.position,
            user: m.user ? {
              id: m.user.id,
              fullName: m.user.fullName,
              email: m.user.email,
            } : null,
          })),
        currentOncallUserId: updatedLayer!.calculateOncallUserId(new Date()),
      });
    } catch (error) {
      logger.error('Error updating layer members:', error);
      return res.status(500).json({ error: 'Failed to update layer members' });
    }
  }
);

/**
 * @swagger
 * /api/v1/schedules/{id}/rendered:
 *   get:
 *     summary: Get rendered schedule
 *     description: Returns a rendered view of the schedule showing who is on-call for each time period. Combines layers and overrides to show the effective on-call person.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start of time range (defaults to now)
 *       - in: query
 *         name: until
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End of time range (defaults to 14 days from start)
 *     responses:
 *       200:
 *         description: Rendered schedule entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 schedule:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     timezone:
 *                       type: string
 *                 since:
 *                   type: string
 *                   format: date-time
 *                 until:
 *                   type: string
 *                   format: date-time
 *                 entries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       start:
 *                         type: string
 *                         format: date-time
 *                       end:
 *                         type: string
 *                         format: date-time
 *                       userId:
 *                         type: string
 *                         format: uuid
 *                       user:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           fullName:
 *                             type: string
 *                             nullable: true
 *                           email:
 *                             type: string
 *                       source:
 *                         type: string
 *                         enum: [layer, override, legacy]
 *                         description: Where the on-call assignment came from
 *                       layerId:
 *                         type: string
 *                         format: uuid
 *                         description: Layer ID if source is layer
 *                       overrideId:
 *                         type: string
 *                         format: uuid
 *                         description: Override ID if source is override
 *                 currentOncallUserId:
 *                   type: string
 *                   format: uuid
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/rendered', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const { since, until } = req.query;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const userRepo = dataSource.getRepository(User);

    const schedule = await scheduleRepo.findOne({
      where: { id, orgId },
      relations: ['layers', 'layers.members', 'layers.members.user', 'overrides', 'overrides.user'],
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Parse time range (default to next 14 days)
    const startTime = since ? new Date(since as string) : new Date();
    const endTime = until ? new Date(until as string) : new Date(startTime.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Generate rendered schedule entries
    const entries: Array<{
      start: Date;
      end: Date;
      userId: string;
      user: { id: string; fullName: string | null; email: string } | null;
      source: 'layer' | 'override' | 'legacy';
      layerId?: string;
      overrideId?: string;
    }> = [];

    // Get all unique user IDs we'll need
    const userIdSet = new Set<string>();

    // Calculate entries by sampling at intervals (every hour)
    const intervalMs = 60 * 60 * 1000; // 1 hour
    let currentTime = new Date(startTime);
    let currentEntry: typeof entries[0] | null = null;

    while (currentTime <= endTime) {
      const oncallUserId = schedule.getEffectiveOncallUserId(currentTime);

      if (oncallUserId) {
        userIdSet.add(oncallUserId);

        if (!currentEntry || currentEntry.userId !== oncallUserId) {
          // Start a new entry
          if (currentEntry) {
            currentEntry.end = new Date(currentTime);
            entries.push(currentEntry);
          }

          // Determine source
          let source: 'layer' | 'override' | 'legacy' = 'legacy';
          let layerId: string | undefined;
          let overrideId: string | undefined;

          // Check for active override
          const activeOverride = schedule.overrides?.find(
            o => o.startTime <= currentTime && o.endTime > currentTime
          );
          if (activeOverride) {
            source = 'override';
            overrideId = activeOverride.id;
          } else if (schedule.layers && schedule.layers.length > 0) {
            // Check layers
            const sortedLayers = [...schedule.layers].sort((a, b) => a.layerOrder - b.layerOrder);
            for (const layer of sortedLayers) {
              if (layer.calculateOncallUserId(currentTime) === oncallUserId) {
                source = 'layer';
                layerId = layer.id;
                break;
              }
            }
          }

          currentEntry = {
            start: new Date(currentTime),
            end: new Date(currentTime),
            userId: oncallUserId,
            user: null, // Will be populated later
            source,
            layerId,
            overrideId,
          };
        }
      } else if (currentEntry) {
        // No one on-call, close current entry
        currentEntry.end = new Date(currentTime);
        entries.push(currentEntry);
        currentEntry = null;
      }

      currentTime = new Date(currentTime.getTime() + intervalMs);
    }

    // Close final entry
    if (currentEntry) {
      currentEntry.end = new Date(endTime);
      entries.push(currentEntry);
    }

    // Fetch user details
    const userIds = Array.from(userIdSet);
    const users = userIds.length > 0
      ? await userRepo.find({ where: userIds.map(uid => ({ id: uid })) })
      : [];
    const userMap = new Map(users.map(u => [u.id, { id: u.id, fullName: u.fullName, email: u.email }]));

    // Populate user details in entries
    for (const entry of entries) {
      entry.user = userMap.get(entry.userId) || null;
    }

    return res.json({
      schedule: {
        id: schedule.id,
        name: schedule.name,
        timezone: schedule.timezone,
      },
      since: startTime.toISOString(),
      until: endTime.toISOString(),
      entries: entries.map(e => ({
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        userId: e.userId,
        user: e.user,
        source: e.source,
        layerId: e.layerId,
        overrideId: e.overrideId,
      })),
      currentOncallUserId: schedule.getEffectiveOncallUserId(new Date()),
    });
  } catch (error) {
    logger.error('Error rendering schedule:', error);
    return res.status(500).json({ error: 'Failed to render schedule' });
  }
});

// ============================================================================
// SHIFT HANDOFF NOTES
// ============================================================================

/**
 * @swagger
 * /api/v1/schedules/{id}/handoff-notes:
 *   get:
 *     summary: Get handoff notes
 *     description: Returns handoff notes for a schedule, including recent notes (last 7 days) and unread notes for the current user.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     responses:
 *       200:
 *         description: List of handoff notes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 schedule:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                 notes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       content:
 *                         type: string
 *                       shiftEndTime:
 *                         type: string
 *                         format: date-time
 *                       isRead:
 *                         type: boolean
 *                       readAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       fromUser:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           fullName:
 *                             type: string
 *                           email:
 *                             type: string
 *                       toUser:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           fullName:
 *                             type: string
 *                           email:
 *                             type: string
 *                       isForMe:
 *                         type: boolean
 *                         description: Whether this note is addressed to the current user
 *                 unreadCount:
 *                   type: integer
 *                   description: Number of unread notes for the current user
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/handoff-notes', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const userId = req.user!.id;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const noteRepo = dataSource.getRepository(ShiftHandoffNote);

    const schedule = await scheduleRepo.findOne({ where: { id, orgId } });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Get notes from the last 7 days or unread notes for the current user
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const notes = await noteRepo.find({
      where: [
        // Recent notes (last 7 days)
        { scheduleId: id, createdAt: MoreThan(sevenDaysAgo) },
        // Unread notes addressed to current user
        { scheduleId: id, toUserId: userId, isRead: false },
        // Unread notes addressed to anyone
        { scheduleId: id, toUserId: null as unknown as string, isRead: false },
      ],
      relations: ['fromUser', 'toUser'],
      order: { createdAt: 'DESC' },
    });

    const formattedNotes = notes.map(note => ({
      id: note.id,
      content: note.content,
      shiftEndTime: note.shiftEndTime,
      isRead: note.isRead,
      readAt: note.readAt,
      createdAt: note.createdAt,
      fromUser: note.fromUser ? {
        id: note.fromUser.id,
        fullName: note.fromUser.fullName,
        email: note.fromUser.email,
      } : null,
      toUser: note.toUser ? {
        id: note.toUser.id,
        fullName: note.toUser.fullName,
        email: note.toUser.email,
      } : null,
      isForMe: note.toUserId === userId || note.toUserId === null,
    }));

    // Count unread notes for the current user
    const unreadCount = formattedNotes.filter(
      n => !n.isRead && n.isForMe
    ).length;

    return res.json({
      schedule: { id: schedule.id, name: schedule.name },
      notes: formattedNotes,
      unreadCount,
    });
  } catch (error) {
    logger.error('Error fetching handoff notes:', error);
    return res.status(500).json({ error: 'Failed to fetch handoff notes' });
  }
});

/**
 * @swagger
 * /api/v1/schedules/{id}/handoff-notes:
 *   post:
 *     summary: Create a handoff note
 *     description: Creates a handoff note to pass information to the next on-call person.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 2000
 *                 description: The handoff note content
 *               toUserId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: Specific user to address the note to (null = anyone)
 *               shiftEndTime:
 *                 type: string
 *                 format: date-time
 *                 description: When the shift ended (defaults to now)
 *     responses:
 *       201:
 *         description: Handoff note created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Handoff note created successfully
 *                 note:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     content:
 *                       type: string
 *                     shiftEndTime:
 *                       type: string
 *                       format: date-time
 *                     isRead:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     fromUser:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         fullName:
 *                           type: string
 *                         email:
 *                           type: string
 *                     toUser:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         fullName:
 *                           type: string
 *                         email:
 *                           type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or recipient user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:id/handoff-notes',
  [
    body('content').isString().notEmpty().isLength({ max: 2000 }).withMessage('Content is required and must be under 2000 characters'),
    body('toUserId').optional({ nullable: true }).isUUID().withMessage('To user ID must be a valid UUID'),
    body('shiftEndTime').optional().isISO8601().withMessage('Shift end time must be a valid date'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const fromUserId = req.user!.id;
      const { content, toUserId, shiftEndTime } = req.body;

      const dataSource = await getDataSource();
      const scheduleRepo = dataSource.getRepository(Schedule);
      const userRepo = dataSource.getRepository(User);
      const noteRepo = dataSource.getRepository(ShiftHandoffNote);

      const schedule = await scheduleRepo.findOne({ where: { id, orgId } });
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      // Verify recipient exists if specified
      if (toUserId) {
        const recipient = await userRepo.findOne({ where: { id: toUserId, orgId } });
        if (!recipient) {
          return res.status(404).json({ error: 'Recipient user not found' });
        }
      }

      // Create the handoff note
      const note = noteRepo.create({
        orgId,
        scheduleId: id,
        fromUserId,
        toUserId: toUserId || null,
        content,
        shiftEndTime: shiftEndTime ? new Date(shiftEndTime) : new Date(),
        isRead: false,
      });

      await noteRepo.save(note);

      // Reload with relations
      const savedNote = await noteRepo.findOne({
        where: { id: note.id },
        relations: ['fromUser', 'toUser'],
      });

      logger.info('Handoff note created', {
        noteId: note.id,
        scheduleId: id,
        fromUserId,
        toUserId: toUserId || 'anyone',
      });

      setLocationHeader(res, req, `/api/v1/schedules/${id}/handoff-notes`, note.id);
      return res.status(201).json({
        message: 'Handoff note created successfully',
        note: {
          id: savedNote!.id,
          content: savedNote!.content,
          shiftEndTime: savedNote!.shiftEndTime,
          isRead: savedNote!.isRead,
          createdAt: savedNote!.createdAt,
          fromUser: savedNote!.fromUser ? {
            id: savedNote!.fromUser.id,
            fullName: savedNote!.fromUser.fullName,
            email: savedNote!.fromUser.email,
          } : null,
          toUser: savedNote!.toUser ? {
            id: savedNote!.toUser.id,
            fullName: savedNote!.toUser.fullName,
            email: savedNote!.toUser.email,
          } : null,
        },
      });
    } catch (error) {
      logger.error('Error creating handoff note:', error);
      return res.status(500).json({ error: 'Failed to create handoff note' });
    }
  }
);

/**
 * @swagger
 * /api/v1/schedules/{scheduleId}/handoff-notes/{noteId}/read:
 *   put:
 *     summary: Mark handoff note as read
 *     description: Marks a handoff note as read by the current user.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Handoff note ID
 *     responses:
 *       200:
 *         description: Note marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Note marked as read
 *                 note:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     isRead:
 *                       type: boolean
 *                     readAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Schedule or note not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:scheduleId/handoff-notes/:noteId/read', async (req: Request, res: Response) => {
  try {
    const { scheduleId, noteId } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const noteRepo = dataSource.getRepository(ShiftHandoffNote);

    const schedule = await scheduleRepo.findOne({ where: { id: scheduleId, orgId } });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const note = await noteRepo.findOne({
      where: { id: noteId, scheduleId },
    });

    if (!note) {
      return res.status(404).json({ error: 'Handoff note not found' });
    }

    note.isRead = true;
    note.readAt = new Date();
    await noteRepo.save(note);

    logger.info('Handoff note marked as read', { noteId, scheduleId });

    return res.json({
      message: 'Note marked as read',
      note: {
        id: note.id,
        isRead: note.isRead,
        readAt: note.readAt,
      },
    });
  } catch (error) {
    logger.error('Error marking handoff note as read:', error);
    return res.status(500).json({ error: 'Failed to mark note as read' });
  }
});

/**
 * @swagger
 * /api/v1/schedules/{scheduleId}/handoff-notes/{noteId}:
 *   delete:
 *     summary: Delete a handoff note
 *     description: Deletes a handoff note. Only the author of the note can delete it.
 *     tags: [Schedules]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Handoff note ID
 *     responses:
 *       200:
 *         description: Note deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Note deleted successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Not authorized to delete this note
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: You can only delete your own notes
 *       404:
 *         description: Schedule or note not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:scheduleId/handoff-notes/:noteId', async (req: Request, res: Response) => {
  try {
    const { scheduleId, noteId } = req.params;
    const orgId = req.orgId!;
    const userId = req.user!.id;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const noteRepo = dataSource.getRepository(ShiftHandoffNote);

    const schedule = await scheduleRepo.findOne({ where: { id: scheduleId, orgId } });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const note = await noteRepo.findOne({
      where: { id: noteId, scheduleId },
    });

    if (!note) {
      return res.status(404).json({ error: 'Handoff note not found' });
    }

    // Only author can delete their own notes
    if (note.fromUserId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own notes' });
    }

    await noteRepo.remove(note);

    logger.info('Handoff note deleted', { noteId, scheduleId });

    return res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    logger.error('Error deleting handoff note:', error);
    return res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
