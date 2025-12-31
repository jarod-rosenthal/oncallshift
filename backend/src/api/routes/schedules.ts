import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Schedule, ScheduleMember, Service, User } from '../../shared/models';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/schedules
 * List all schedules for the organization
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
 * GET /api/v1/schedules/oncall
 * Get current on-call users across all services
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
 * GET /api/v1/schedules/weekly-forecast
 * Get who's on-call for each day of the current week (and next week)
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
 * GET /api/v1/schedules/:id
 * Get schedule details
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
      } : null,
    });
  } catch (error) {
    logger.error('Error fetching schedule:', error);
    return res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

/**
 * POST /api/v1/schedules
 * Create a new schedule
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
 * PUT /api/v1/schedules/:id
 * Update schedule details
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
 * DELETE /api/v1/schedules/:id
 * Delete a schedule (admin only)
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
 * PUT /api/v1/schedules/:id/oncall
 * Set the current on-call user (manual assignment)
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
        },
      });
    } catch (error) {
      logger.error('Error setting on-call user:', error);
      return res.status(500).json({ error: 'Failed to set on-call user' });
    }
  }
);

/**
 * POST /api/v1/schedules/:id/override
 * Create a temporary on-call override
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
 * DELETE /api/v1/schedules/:id/override
 * Remove on-call override
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
 * PUT /api/v1/schedules/:id/rotation
 * Configure rotation settings (for daily/weekly rotations)
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
 * GET /api/v1/schedules/:id/members
 * Get schedule members (rotation list)
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
 * POST /api/v1/schedules/:id/members
 * Add a user to the schedule (admin only)
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
 * DELETE /api/v1/schedules/:id/members/:memberId
 * Remove a user from the schedule (admin only)
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
 * PUT /api/v1/schedules/:id/members/:memberId/position
 * Reorder member in the rotation (admin only)
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

export default router;
