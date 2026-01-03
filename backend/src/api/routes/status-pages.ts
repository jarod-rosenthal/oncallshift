import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { StatusPage, StatusPageService, StatusPageSubscriber, StatusPageUpdate, Service, Incident } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { In, Not } from 'typeorm';
import { notFound, internalError, validationError, conflict, fromExpressValidator } from '../../shared/utils/problem-details';
import { parsePaginationParams, paginatedResponse, validateSortField } from '../../shared/utils/pagination';
import { paginationValidators, searchFilterValidator } from '../../shared/validators/pagination';

const router = Router();

// ============================================
// AUTHENTICATED ROUTES (Admin/Management)
// ============================================

/**
 * GET /api/v1/status-pages
 * Get all status pages for the authenticated user's organization
 */
router.get('/',
  authenticateUser,
  [
    ...paginationValidators,
    searchFilterValidator,
    query('visibility').optional().isIn(['internal', 'public']).withMessage('Invalid visibility'),
    query('enabled').optional().isIn(['true', 'false']).withMessage('Enabled must be true or false'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const pagination = parsePaginationParams(req.query);
      const sortField = validateSortField('statusPages', pagination.sort, 'name');
      const sortOrder = pagination.order?.toUpperCase() as 'ASC' | 'DESC' || 'ASC';
      const { search, visibility, enabled } = req.query;

      const dataSource = await getDataSource();
      const statusPageRepo = dataSource.getRepository(StatusPage);

      const queryBuilder = statusPageRepo.createQueryBuilder('sp')
        .leftJoinAndSelect('sp.services', 'services')
        .leftJoinAndSelect('services.service', 'service')
        .where('sp.orgId = :orgId', { orgId });

      // Apply filters
      if (search) {
        queryBuilder.andWhere(
          '(sp.name ILIKE :search OR sp.description ILIKE :search OR sp.slug ILIKE :search)',
          { search: `%${search}%` }
        );
      }
      if (visibility) {
        queryBuilder.andWhere('sp.visibility = :visibility', { visibility });
      }
      if (enabled !== undefined) {
        queryBuilder.andWhere('sp.enabled = :enabled', { enabled: enabled === 'true' });
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply sorting and pagination
      queryBuilder
        .orderBy(`sp.${sortField}`, sortOrder)
        .skip(pagination.offset)
        .take(pagination.limit);

      const statusPages = await queryBuilder.getMany();

      const mappedPages = statusPages.map(formatStatusPage);
      const lastItem = statusPages[statusPages.length - 1];
      return res.json(paginatedResponse(
        mappedPages,
        total,
        pagination,
        lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
        'statusPages'
      ));
    } catch (error) {
      logger.error('Error fetching status pages:', error);
      return internalError(res);
    }
  }
);

/**
 * POST /api/v1/status-pages
 * Create a new status page
 */
router.post(
  '/',
  authenticateUser,
  [
    body('name').isString().trim().notEmpty().withMessage('Name is required'),
    body('slug').isString().trim().notEmpty().matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
    body('description').optional().isString(),
    body('visibility').optional().isIn(['internal', 'public']),
    body('primaryColor').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Primary color must be a valid hex color'),
    body('showUptimeHistory').optional().isBoolean(),
    body('uptimeHistoryDays').optional().isInt({ min: 1, max: 365 }),
    body('allowSubscriptions').optional().isBoolean(),
    body('serviceIds').optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const dataSource = await getDataSource();
      const statusPageRepo = dataSource.getRepository(StatusPage);
      const statusPageServiceRepo = dataSource.getRepository(StatusPageService);
      const serviceRepo = dataSource.getRepository(Service);

      // Check if slug is already taken
      const existingSlug = await statusPageRepo.findOne({ where: { slug: req.body.slug } });
      if (existingSlug) {
        return conflict(res, 'Slug is already in use');
      }

      const statusPage = statusPageRepo.create({
        orgId,
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description || null,
        visibility: req.body.visibility || 'internal',
        primaryColor: req.body.primaryColor || '#007bff',
        showUptimeHistory: req.body.showUptimeHistory ?? true,
        uptimeHistoryDays: req.body.uptimeHistoryDays || 90,
        allowSubscriptions: req.body.allowSubscriptions ?? true,
        enabled: true,
      });

      await statusPageRepo.save(statusPage);

      // Add services if provided
      if (req.body.serviceIds && req.body.serviceIds.length > 0) {
        const services = await serviceRepo.find({
          where: { id: In(req.body.serviceIds), orgId },
        });

        for (let i = 0; i < services.length; i++) {
          const sps = statusPageServiceRepo.create({
            statusPageId: statusPage.id,
            serviceId: services[i].id,
            displayOrder: i,
          });
          await statusPageServiceRepo.save(sps);
        }
      }

      // Reload with relations
      const savedStatusPage = await statusPageRepo.findOne({
        where: { id: statusPage.id },
        relations: ['services', 'services.service'],
      });

      return res.status(201).json({ statusPage: formatStatusPage(savedStatusPage!) });
    } catch (error) {
      logger.error('Error creating status page:', error);
      return internalError(res);
    }
  }
);

/**
 * GET /api/v1/status-pages/:id
 * Get a status page by ID (authenticated)
 */
router.get('/:id',
  authenticateUser,
  param('id').isUUID().withMessage('Invalid status page ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const dataSource = await getDataSource();
      const statusPageRepo = dataSource.getRepository(StatusPage);

      const statusPage = await statusPageRepo.findOne({
        where: { id, orgId },
        relations: ['services', 'services.service', 'subscribers'],
      });

      if (!statusPage) {
        return notFound(res, 'Status page', id);
      }

      return res.json({ statusPage: formatStatusPage(statusPage) });
    } catch (error) {
      logger.error('Error fetching status page:', error);
      return internalError(res);
    }
  }
);

/**
 * PUT /api/v1/status-pages/:id
 * Update a status page
 */
router.put(
  '/:id',
  authenticateUser,
  [
    param('id').isUUID().withMessage('Invalid status page ID'),
    body('name').optional().isString().trim().notEmpty().withMessage('Name cannot be empty'),
    body('slug').optional().isString().trim().matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('visibility').optional().isIn(['internal', 'public']).withMessage('Invalid visibility'),
    body('primaryColor').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Primary color must be a valid hex color'),
    body('showUptimeHistory').optional().isBoolean().withMessage('Show uptime history must be a boolean'),
    body('uptimeHistoryDays').optional().isInt({ min: 1, max: 365 }).withMessage('Uptime history days must be 1-365'),
    body('allowSubscriptions').optional().isBoolean().withMessage('Allow subscriptions must be a boolean'),
    body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
    body('serviceIds').optional().isArray().withMessage('Service IDs must be an array'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const dataSource = await getDataSource();
      const statusPageRepo = dataSource.getRepository(StatusPage);
      const statusPageServiceRepo = dataSource.getRepository(StatusPageService);
      const serviceRepo = dataSource.getRepository(Service);

      const statusPage = await statusPageRepo.findOne({ where: { id, orgId } });
      if (!statusPage) {
        return notFound(res, 'Status page', id);
      }

      // Check if slug is taken by another page
      if (req.body.slug && req.body.slug !== statusPage.slug) {
        const existingSlug = await statusPageRepo.findOne({ where: { slug: req.body.slug } });
        if (existingSlug) {
          return conflict(res, 'Slug is already in use');
        }
      }

      // Update fields
      if (req.body.name !== undefined) statusPage.name = req.body.name;
      if (req.body.slug !== undefined) statusPage.slug = req.body.slug;
      if (req.body.description !== undefined) statusPage.description = req.body.description;
      if (req.body.visibility !== undefined) statusPage.visibility = req.body.visibility;
      if (req.body.primaryColor !== undefined) statusPage.primaryColor = req.body.primaryColor;
      if (req.body.showUptimeHistory !== undefined) statusPage.showUptimeHistory = req.body.showUptimeHistory;
      if (req.body.uptimeHistoryDays !== undefined) statusPage.uptimeHistoryDays = req.body.uptimeHistoryDays;
      if (req.body.allowSubscriptions !== undefined) statusPage.allowSubscriptions = req.body.allowSubscriptions;
      if (req.body.enabled !== undefined) statusPage.enabled = req.body.enabled;
      if (req.body.logoUrl !== undefined) statusPage.logoUrl = req.body.logoUrl;
      if (req.body.customDomain !== undefined) statusPage.customDomain = req.body.customDomain;

      await statusPageRepo.save(statusPage);

      // Update services if provided
      if (req.body.serviceIds !== undefined) {
        // Remove existing
        await statusPageServiceRepo.delete({ statusPageId: id });

        // Add new ones
        if (req.body.serviceIds.length > 0) {
          const services = await serviceRepo.find({
            where: { id: In(req.body.serviceIds), orgId },
          });

          for (let i = 0; i < services.length; i++) {
            const sps = statusPageServiceRepo.create({
              statusPageId: statusPage.id,
              serviceId: services[i].id,
              displayOrder: i,
            });
            await statusPageServiceRepo.save(sps);
          }
        }
      }

      // Reload with relations
      const updatedStatusPage = await statusPageRepo.findOne({
        where: { id },
        relations: ['services', 'services.service'],
      });

      return res.json({ statusPage: formatStatusPage(updatedStatusPage!) });
    } catch (error) {
      logger.error('Error updating status page:', error);
      return internalError(res);
    }
  }
);

/**
 * DELETE /api/v1/status-pages/:id
 * Delete a status page
 */
router.delete('/:id',
  authenticateUser,
  param('id').isUUID().withMessage('Invalid status page ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const dataSource = await getDataSource();
      const statusPageRepo = dataSource.getRepository(StatusPage);

      const statusPage = await statusPageRepo.findOne({ where: { id, orgId } });
      if (!statusPage) {
        return notFound(res, 'Status page', id);
      }

      await statusPageRepo.remove(statusPage);
      return res.status(204).send();
    } catch (error) {
      logger.error('Error deleting status page:', error);
      return internalError(res);
    }
  }
);

// ============================================
// STATUS PAGE UPDATES (Incident Announcements)
// ============================================

/**
 * GET /api/v1/status-pages/:id/updates
 * Get updates for a status page
 */
router.get('/:id/updates',
  authenticateUser,
  param('id').isUUID().withMessage('Invalid status page ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const dataSource = await getDataSource();
      const statusPageRepo = dataSource.getRepository(StatusPage);
      const updateRepo = dataSource.getRepository(StatusPageUpdate);

      const statusPage = await statusPageRepo.findOne({ where: { id, orgId } });
      if (!statusPage) {
        return notFound(res, 'Status page', id);
      }

      const updates = await updateRepo.find({
        where: { statusPageId: id },
        relations: ['author'],
        order: { createdAt: 'DESC' },
        take: 50,
      });

      return res.json({
        updates: updates.map(formatUpdate),
      });
    } catch (error) {
      logger.error('Error fetching status page updates:', error);
      return internalError(res);
    }
  }
);

/**
 * POST /api/v1/status-pages/:id/updates
 * Create a status update
 */
router.post(
  '/:id/updates',
  authenticateUser,
  [
    param('id').isUUID().withMessage('Invalid status page ID'),
    body('title').isString().trim().notEmpty().withMessage('Title is required'),
    body('message').isString().trim().notEmpty().withMessage('Message is required'),
    body('status').isIn(['investigating', 'identified', 'monitoring', 'resolved']).withMessage('Valid status required'),
    body('severity').optional().isIn(['none', 'minor', 'major', 'critical']).withMessage('Invalid severity'),
    body('affectedServiceIds').optional().isArray().withMessage('Affected service IDs must be an array'),
    body('incidentId').optional().isUUID().withMessage('Invalid incident ID'),
    body('isScheduled').optional().isBoolean().withMessage('Is scheduled must be a boolean'),
    body('scheduledStart').optional().isISO8601().withMessage('Invalid scheduled start date'),
    body('scheduledEnd').optional().isISO8601().withMessage('Invalid scheduled end date'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const user = req.user!;
      const dataSource = await getDataSource();
      const statusPageRepo = dataSource.getRepository(StatusPage);
      const updateRepo = dataSource.getRepository(StatusPageUpdate);

      const statusPage = await statusPageRepo.findOne({ where: { id, orgId } });
      if (!statusPage) {
        return notFound(res, 'Status page', id);
      }

      const update = updateRepo.create({
        statusPageId: id,
        title: req.body.title,
        message: req.body.message,
        status: req.body.status,
        severity: req.body.severity || 'none',
        affectedServiceIds: req.body.affectedServiceIds || [],
        authorId: user.id,
        incidentId: req.body.incidentId || null,
        isScheduled: req.body.isScheduled || false,
        scheduledStart: req.body.scheduledStart || null,
        scheduledEnd: req.body.scheduledEnd || null,
      });

      await updateRepo.save(update);

      const savedUpdate = await updateRepo.findOne({
        where: { id: update.id },
        relations: ['author'],
      });

      return res.status(201).json({ update: formatUpdate(savedUpdate!) });
    } catch (error) {
      logger.error('Error creating status page update:', error);
      return internalError(res);
    }
  }
);

// ============================================
// SUBSCRIBERS MANAGEMENT
// ============================================

/**
 * GET /api/v1/status-pages/:id/subscribers
 * Get subscribers for a status page
 */
router.get('/:id/subscribers',
  authenticateUser,
  param('id').isUUID().withMessage('Invalid status page ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const dataSource = await getDataSource();
      const statusPageRepo = dataSource.getRepository(StatusPage);
      const subscriberRepo = dataSource.getRepository(StatusPageSubscriber);

      const statusPage = await statusPageRepo.findOne({ where: { id, orgId } });
      if (!statusPage) {
        return notFound(res, 'Status page', id);
      }

      const subscribers = await subscriberRepo.find({
        where: { statusPageId: id },
        order: { createdAt: 'DESC' },
      });

      return res.json({
        subscribers: subscribers.map(s => ({
          id: s.id,
          email: s.email,
          channel: s.channel,
          confirmed: s.confirmed,
          active: s.active,
          createdAt: s.createdAt,
        })),
      });
    } catch (error) {
      logger.error('Error fetching subscribers:', error);
      return internalError(res);
    }
  }
);

/**
 * DELETE /api/v1/status-pages/:id/subscribers/:subscriberId
 * Remove a subscriber
 */
router.delete('/:id/subscribers/:subscriberId',
  authenticateUser,
  [
    param('id').isUUID().withMessage('Invalid status page ID'),
    param('subscriberId').isUUID().withMessage('Invalid subscriber ID'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id, subscriberId } = req.params;
      const orgId = req.orgId!;
      const dataSource = await getDataSource();
      const statusPageRepo = dataSource.getRepository(StatusPage);
      const subscriberRepo = dataSource.getRepository(StatusPageSubscriber);

      const statusPage = await statusPageRepo.findOne({ where: { id, orgId } });
      if (!statusPage) {
        return notFound(res, 'Status page', id);
      }

      const subscriber = await subscriberRepo.findOne({ where: { id: subscriberId, statusPageId: id } });
      if (!subscriber) {
        return notFound(res, 'Subscriber', subscriberId);
      }

      await subscriberRepo.remove(subscriber);
      return res.status(204).send();
    } catch (error) {
      logger.error('Error removing subscriber:', error);
      return internalError(res);
    }
  }
);

// ============================================
// PUBLIC STATUS PAGE VIEW
// ============================================

/**
 * GET /api/v1/status-pages/public/:slug
 * Get public view of status page (no auth required)
 */
router.get('/public/:slug',
  param('slug').isString().trim().notEmpty().withMessage('Slug is required'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { slug } = req.params;
      const dataSource = await getDataSource();
      const statusPageRepo = dataSource.getRepository(StatusPage);
      const updateRepo = dataSource.getRepository(StatusPageUpdate);
      const incidentRepo = dataSource.getRepository(Incident);

      const statusPage = await statusPageRepo.findOne({
        where: { slug, enabled: true },
        relations: ['services', 'services.service'],
      });

      if (!statusPage) {
        return notFound(res, 'Status page', slug);
      }

    // Get service statuses (based on active incidents)
    const serviceIds = statusPage.services.map(s => s.serviceId);
    const activeIncidents = serviceIds.length > 0
      ? await incidentRepo.find({
          where: { serviceId: In(serviceIds), state: Not('resolved') },
          relations: ['service'],
        })
      : [];

    // Group incidents by service
    const incidentsByService: Record<string, any[]> = {};
    for (const incident of activeIncidents) {
      if (!incidentsByService[incident.serviceId]) {
        incidentsByService[incident.serviceId] = [];
      }
      incidentsByService[incident.serviceId].push({
        id: incident.id,
        summary: incident.summary,
        state: incident.state,
        severity: incident.severity,
        triggeredAt: incident.triggeredAt,
      });
    }

    // Get recent updates
    const updates = await updateRepo.find({
      where: { statusPageId: statusPage.id },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    // Calculate overall status
    let overallStatus = 'operational';
    if (activeIncidents.some(i => i.severity === 'critical')) {
      overallStatus = 'major_outage';
    } else if (activeIncidents.some(i => i.severity === 'error')) {
      overallStatus = 'partial_outage';
    } else if (activeIncidents.length > 0) {
      overallStatus = 'degraded';
    }

      return res.json({
        statusPage: {
          name: statusPage.name,
          description: statusPage.description,
          slug: statusPage.slug,
          logoUrl: statusPage.logoUrl,
          primaryColor: statusPage.primaryColor,
          allowSubscriptions: statusPage.allowSubscriptions,
        },
        overallStatus,
        services: statusPage.services
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map(sps => {
            const incidents = incidentsByService[sps.serviceId] || [];
            let status = 'operational';
            if (incidents.some(i => i.severity === 'critical')) {
              status = 'major_outage';
            } else if (incidents.some(i => i.severity === 'error')) {
              status = 'partial_outage';
            } else if (incidents.length > 0) {
              status = 'degraded';
            }
            return {
              id: sps.serviceId,
              name: sps.displayName || sps.service.name,
              status,
              activeIncidents: sps.showIncidents ? incidents : [],
            };
          }),
        updates: updates.map(u => ({
          id: u.id,
          title: u.title,
          message: u.message,
          status: u.status,
          severity: u.severity,
          createdAt: u.createdAt,
          isScheduled: u.isScheduled,
          scheduledStart: u.scheduledStart,
          scheduledEnd: u.scheduledEnd,
        })),
      });
    } catch (error) {
      logger.error('Error fetching public status page:', error);
      return internalError(res);
    }
  }
);

/**
 * POST /api/v1/status-pages/public/:slug/subscribe
 * Subscribe to status page updates (no auth required)
 */
router.post(
  '/public/:slug/subscribe',
  [
    param('slug').isString().trim().notEmpty().withMessage('Slug is required'),
    body('email').isEmail().withMessage('Valid email required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { slug } = req.params;
      const { email } = req.body;
      const dataSource = await getDataSource();
      const statusPageRepo = dataSource.getRepository(StatusPage);
      const subscriberRepo = dataSource.getRepository(StatusPageSubscriber);

      const statusPage = await statusPageRepo.findOne({
        where: { slug, enabled: true, allowSubscriptions: true },
      });

      if (!statusPage) {
        return notFound(res, 'Status page', slug);
      }

      // Check if already subscribed
      const existing = await subscriberRepo.findOne({
        where: { statusPageId: statusPage.id, email },
      });

      if (existing) {
        if (existing.active) {
          return res.json({ message: 'Already subscribed' });
        }
        // Reactivate
        existing.active = true;
        await subscriberRepo.save(existing);
        return res.json({ message: 'Subscription reactivated' });
      }

      const subscriber = subscriberRepo.create({
        statusPageId: statusPage.id,
        email,
        channel: 'email',
        confirmed: true, // For now, auto-confirm. In production, send confirmation email
        active: true,
      });

      await subscriberRepo.save(subscriber);

      return res.status(201).json({ message: 'Successfully subscribed to status updates' });
    } catch (error) {
      logger.error('Error subscribing to status page:', error);
      return internalError(res);
    }
  }
);

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatStatusPage(statusPage: StatusPage) {
  return {
    id: statusPage.id,
    name: statusPage.name,
    slug: statusPage.slug,
    description: statusPage.description,
    visibility: statusPage.visibility,
    customDomain: statusPage.customDomain,
    logoUrl: statusPage.logoUrl,
    faviconUrl: statusPage.faviconUrl,
    primaryColor: statusPage.primaryColor,
    showUptimeHistory: statusPage.showUptimeHistory,
    uptimeHistoryDays: statusPage.uptimeHistoryDays,
    allowSubscriptions: statusPage.allowSubscriptions,
    enabled: statusPage.enabled,
    services: statusPage.services?.map(sps => ({
      id: sps.serviceId,
      name: sps.displayName || sps.service?.name,
      displayOrder: sps.displayOrder,
      showIncidents: sps.showIncidents,
    })) || [],
    subscriberCount: statusPage.subscribers?.length || 0,
    createdAt: statusPage.createdAt,
    updatedAt: statusPage.updatedAt,
  };
}

function formatUpdate(update: StatusPageUpdate) {
  return {
    id: update.id,
    title: update.title,
    message: update.message,
    status: update.status,
    severity: update.severity,
    affectedServiceIds: update.affectedServiceIds,
    author: update.author ? {
      id: update.author.id,
      fullName: update.author.fullName,
    } : null,
    incidentId: update.incidentId,
    isScheduled: update.isScheduled,
    scheduledStart: update.scheduledStart,
    scheduledEnd: update.scheduledEnd,
    createdAt: update.createdAt,
    updatedAt: update.updatedAt,
  };
}

export default router;
