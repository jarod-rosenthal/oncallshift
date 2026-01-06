import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Organization, Service, Runbook, User, Schedule, ScheduleMember } from '../../shared/models';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/setup/status
 * Check if the organization has completed setup
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const orgRepo = dataSource.getRepository(Organization);

    const org = await orgRepo.findOne({ where: { id: orgId } });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const setupCompleted = org.settings?.setupCompleted === true;
    const completedAt = org.settings?.setupCompletedAt;

    return res.json({
      setupCompleted,
      completedAt,
    });
  } catch (error) {
    logger.error('Error checking setup status:', error);
    return res.status(500).json({ error: 'Failed to check setup status' });
  }
});

/**
 * POST /api/v1/setup/complete
 * Complete the setup wizard - creates services, runbooks, and optionally invites team members
 */
router.post(
  '/complete',
  [
    body('aiApiKey').optional().isString(),
    body('services').isArray().withMessage('Services must be an array'),
    body('services.*.templateId').isString().notEmpty(),
    body('services.*.name').isString().trim().notEmpty(),
    body('services.*.description').optional().isString(),
    body('services.*.runbook').isObject(),
    body('services.*.runbook.title').isString().notEmpty(),
    body('services.*.runbook.description').optional().isString(),
    body('services.*.runbook.steps').isArray(),
    body('teamEmails').isArray(),
    body('createRotation').isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      // Only admins or super_admins can complete setup
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required to complete setup' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const { aiApiKey, services, teamEmails, createRotation } = req.body;

      const dataSource = await getDataSource();
      const queryRunner = dataSource.createQueryRunner();

      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const orgRepo = queryRunner.manager.getRepository(Organization);
        const serviceRepo = queryRunner.manager.getRepository(Service);
        const runbookRepo = queryRunner.manager.getRepository(Runbook);
        const userRepo = queryRunner.manager.getRepository(User);
        const scheduleRepo = queryRunner.manager.getRepository(Schedule);
        const memberRepo = queryRunner.manager.getRepository(ScheduleMember);

        // Get organization
        const org = await orgRepo.findOne({ where: { id: orgId } });
        if (!org) {
          throw new Error('Organization not found');
        }

        let createdServicesCount = 0;
        let createdRunbooksCount = 0;
        let invitationsCount = 0;
        let createdScheduleName: string | undefined;

        // Store AI API key in org settings if provided
        if (aiApiKey) {
          org.settings = {
            ...org.settings,
            aiApiKey: aiApiKey, // In production, this should be encrypted
            aiEnabled: true,
          };
        }

        // Create services and runbooks
        const createdServices: Service[] = [];
        for (const serviceData of services) {
          // Create service
          const service = serviceRepo.create({
            orgId,
            name: serviceData.name,
            description: serviceData.description || null,
            status: 'active',
          });
          await serviceRepo.save(service);
          createdServices.push(service);
          createdServicesCount++;

          // Create runbook for the service
          const runbook = runbookRepo.create({
            orgId,
            serviceId: service.id,
            title: serviceData.runbook.title,
            description: serviceData.runbook.description || null,
            steps: serviceData.runbook.steps || [],
            severity: ['critical', 'error', 'warning'],
            tags: [serviceData.templateId],
            createdById: userId,
            isActive: true,
          });
          await runbookRepo.save(runbook);
          createdRunbooksCount++;

          logger.info('Setup wizard: Created service and runbook', {
            serviceId: service.id,
            runbookId: runbook.id,
            serviceName: service.name,
            orgId,
          });
        }

        // Process team invitations (simplified - just log for now)
        // In a real implementation, this would send invitation emails
        const validEmails = teamEmails.filter(
          (email: string) => email && email.includes('@') && email.trim().length > 0
        );

        for (const email of validEmails) {
          // Check if user already exists
          const existingUser = await userRepo.findOne({
            where: { email: email.trim().toLowerCase(), orgId },
          });

          if (!existingUser) {
            // In production, send invitation email
            logger.info('Setup wizard: Would send invitation to', { email, orgId });
            invitationsCount++;
          }
        }

        // Create on-call rotation if requested and we have services
        if (createRotation && createdServices.length > 0) {
          // Create a schedule
          const schedule = scheduleRepo.create({
            orgId,
            name: 'Default On-Call Rotation',
            description: 'Created by setup wizard - weekly rotation',
            type: 'weekly',
            timezone: 'America/New_York',
            currentOncallUserId: userId, // Start with the admin
          });
          await scheduleRepo.save(schedule);
          createdScheduleName = schedule.name;

          // Add current user as first member
          const member = memberRepo.create({
            scheduleId: schedule.id,
            userId: userId,
            position: 1,
          });
          await memberRepo.save(member);

          // Assign schedule to first service
          createdServices[0].scheduleId = schedule.id;
          await serviceRepo.save(createdServices[0]);

          logger.info('Setup wizard: Created on-call rotation', {
            scheduleId: schedule.id,
            orgId,
          });
        }

        // Mark setup as completed
        org.settings = {
          ...org.settings,
          setupCompleted: true,
          setupCompletedAt: new Date().toISOString(),
          setupCompletedBy: userId,
        };
        await orgRepo.save(org);

        await queryRunner.commitTransaction();

        logger.info('Setup wizard completed', {
          orgId,
          userId,
          servicesCreated: createdServicesCount,
          runbooksCreated: createdRunbooksCount,
          invitations: invitationsCount,
        });

        return res.json({
          message: 'Setup completed successfully',
          created: {
            services: createdServicesCount,
            runbooks: createdRunbooksCount,
            invitations: invitationsCount,
            schedule: createdScheduleName,
          },
        });
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      logger.error('Error completing setup:', error);
      return res.status(500).json({ error: 'Failed to complete setup' });
    }
  }
);

/**
 * POST /api/v1/setup/reset
 * Reset setup status (for testing/demo purposes - admin only)
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    // Only admins or super_admins can reset setup
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const orgRepo = dataSource.getRepository(Organization);

    const org = await orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Remove setup completion flag
    if (org.settings) {
      delete org.settings.setupCompleted;
      delete org.settings.setupCompletedAt;
      delete org.settings.setupCompletedBy;
      await orgRepo.save(org);
    }

    logger.info('Setup wizard: Reset setup status', { orgId, resetBy: req.user!.id });

    return res.json({ message: 'Setup status reset successfully' });
  } catch (error) {
    logger.error('Error resetting setup:', error);
    return res.status(500).json({ error: 'Failed to reset setup status' });
  }
});

export default router;
