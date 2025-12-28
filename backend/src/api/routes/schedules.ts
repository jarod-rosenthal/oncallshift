import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Schedule, Service, User } from '../../shared/models';
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

    const schedules = await scheduleRepo.find({
      where: { orgId },
      order: { name: 'ASC' },
    });

    res.json({
      schedules: schedules.map(schedule => formatSchedule(schedule)),
    });
  } catch (error) {
    logger.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
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
    const scheduleRepo = dataSource.getRepository(Schedule);
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

        if (oncallUserId) {
          const oncallUser = await userRepo.findOne({
            where: { id: oncallUserId },
          });

          if (oncallUser) {
            oncallData.push({
              service: {
                id: service.id,
                name: service.name,
              },
              schedule: {
                id: schedule.id,
                name: schedule.name,
              },
              oncallUser: {
                id: oncallUser.id,
                fullName: oncallUser.fullName,
                email: oncallUser.email,
              },
              isOverride: schedule.overrideUserId !== null,
              overrideUntil: schedule.overrideUntil,
            });
          }
        }
      }
    }

    res.json({
      oncall: oncallData,
    });
  } catch (error) {
    logger.error('Error fetching on-call data:', error);
    res.status(500).json({ error: 'Failed to fetch on-call data' });
  }
});

/**
 * GET /api/v1/schedules/:id
 * Get schedule details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);

    const schedule = await scheduleRepo.findOne({
      where: { id, orgId },
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Get current on-call user if set
    let oncallUser = null;
    const oncallUserId = schedule.getCurrentOncallUserId();
    if (oncallUserId) {
      const userRepo = dataSource.getRepository(User);
      oncallUser = await userRepo.findOne({ where: { id: oncallUserId } });
    }

    res.json({
      schedule: formatSchedule(schedule),
      oncallUser: oncallUser ? {
        id: oncallUser.id,
        fullName: oncallUser.fullName,
        email: oncallUser.email,
      } : null,
    });
  } catch (error) {
    logger.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

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
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

export default router;
