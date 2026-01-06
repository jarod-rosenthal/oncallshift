import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { BusinessService, ServiceDependency, Service, Team, User } from '../../shared/models';
import { notFound, internalError, badRequest, validationError, conflict, fromExpressValidator } from '../../shared/utils/problem-details';
import { parsePaginationParams, paginatedResponse, validateSortField } from '../../shared/utils/pagination';
import { paginationValidators, searchFilterValidator, uuidFilterValidator } from '../../shared/validators/pagination';

const router = Router();

// Apply authentication to all routes
router.use(authenticateUser);

/**
 * Get all business services for the organization
 */
router.get('/',
  [
    ...paginationValidators,
    searchFilterValidator,
    query('status').optional().isIn(['operational', 'degraded', 'major_outage', 'maintenance', 'unknown']).withMessage('Invalid status'),
    query('impactTier').optional().isIn(['tier_1', 'tier_2', 'tier_3', 'tier_4']).withMessage('Invalid impact tier'),
    uuidFilterValidator('teamId'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const pagination = parsePaginationParams(req.query);
      const sortField = validateSortField('businessServices', pagination.sort, 'name');
      const sortOrder = pagination.order?.toUpperCase() as 'ASC' | 'DESC' || 'ASC';
      const { search, status, impactTier, teamId } = req.query;

      const dataSource = await getDataSource();
      const repo = dataSource.getRepository(BusinessService);

      const queryBuilder = repo.createQueryBuilder('bs')
        .leftJoinAndSelect('bs.ownerTeam', 'team')
        .leftJoinAndSelect('bs.pointOfContact', 'poc')
        .leftJoinAndSelect('bs.services', 'services')
        .where('bs.orgId = :orgId', { orgId });

      // Apply filters
      if (search) {
        queryBuilder.andWhere(
          '(bs.name ILIKE :search OR bs.description ILIKE :search)',
          { search: `%${search}%` }
        );
      }
      if (status) {
        queryBuilder.andWhere('bs.status = :status', { status });
      }
      if (impactTier) {
        queryBuilder.andWhere('bs.impactTier = :impactTier', { impactTier });
      }
      if (teamId) {
        queryBuilder.andWhere('bs.ownerTeamId = :teamId', { teamId });
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply sorting and pagination
      queryBuilder
        .orderBy(`bs.${sortField}`, sortOrder)
        .skip(pagination.offset)
        .take(pagination.limit);

      const businessServices = await queryBuilder.getMany();

      const lastItem = businessServices[businessServices.length - 1];
      return res.json(paginatedResponse(
        businessServices,
        total,
        pagination,
        lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
        'businessServices'
      ));
    } catch (error) {
      console.error('Error fetching business services:', error);
      return internalError(res);
    }
  }
);

/**
 * Get a single business service by ID
 */
router.get('/:id',
  param('id').isUUID().withMessage('Invalid business service ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { id } = req.params;
      const dataSource = await getDataSource();
      const repo = dataSource.getRepository(BusinessService);

      const businessService = await repo.findOne({
        where: { id, orgId },
        relations: ['ownerTeam', 'pointOfContact', 'services'],
      });

      if (!businessService) {
        return notFound(res, 'Business service', id);
      }

      return res.json(businessService);
    } catch (error) {
      console.error('Error fetching business service:', error);
      return internalError(res);
    }
  }
);

/**
 * Create a new business service
 */
router.post('/',
  body('name').isString().trim().notEmpty().isLength({ max: 255 }),
  body('description').optional({ nullable: true }).isString(),
  body('ownerTeamId').optional({ nullable: true }).isUUID(),
  body('pointOfContactId').optional({ nullable: true }).isUUID(),
  body('status').optional().isIn(['operational', 'degraded', 'major_outage', 'maintenance', 'unknown']),
  body('impactTier').optional().isIn(['tier_1', 'tier_2', 'tier_3', 'tier_4']),
  body('externalId').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('documentationUrl').optional({ nullable: true }).isURL(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const dataSource = await getDataSource();
      const repo = dataSource.getRepository(BusinessService);

      // Check for duplicate name
      const existing = await repo.findOne({
        where: { orgId, name: req.body.name },
      });
      if (existing) {
        return conflict(res, 'A business service with this name already exists');
      }

      // Validate ownerTeamId if provided
      if (req.body.ownerTeamId) {
        const teamRepo = dataSource.getRepository(Team);
        const team = await teamRepo.findOne({ where: { id: req.body.ownerTeamId, orgId } });
        if (!team) {
          return badRequest(res, 'Owner team not found');
        }
      }

      // Validate pointOfContactId if provided
      if (req.body.pointOfContactId) {
        const userRepo = dataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: req.body.pointOfContactId, orgId } });
        if (!user) {
          return badRequest(res, 'Point of contact user not found');
        }
      }

      const businessService = repo.create({
        orgId,
        name: req.body.name,
        description: req.body.description || null,
        ownerTeamId: req.body.ownerTeamId || null,
        pointOfContactId: req.body.pointOfContactId || null,
        status: req.body.status || 'operational',
        impactTier: req.body.impactTier || 'tier_3',
        externalId: req.body.externalId || null,
        documentationUrl: req.body.documentationUrl || null,
      });

      await repo.save(businessService);

      // Reload with relations
      const created = await repo.findOne({
        where: { id: businessService.id },
        relations: ['ownerTeam', 'pointOfContact', 'services'],
      });

      return res.status(201).json(created);
    } catch (error) {
      console.error('Error creating business service:', error);
      return internalError(res);
    }
  }
);

/**
 * Update a business service
 */
router.put('/:id',
  param('id').isUUID(),
  body('name').optional().isString().trim().notEmpty().isLength({ max: 255 }),
  body('description').optional({ nullable: true }).isString(),
  body('ownerTeamId').optional({ nullable: true }).isUUID(),
  body('pointOfContactId').optional({ nullable: true }).isUUID(),
  body('status').optional().isIn(['operational', 'degraded', 'major_outage', 'maintenance', 'unknown']),
  body('impactTier').optional().isIn(['tier_1', 'tier_2', 'tier_3', 'tier_4']),
  body('externalId').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('documentationUrl').optional({ nullable: true }).isURL(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { id } = req.params;
      const dataSource = await getDataSource();
      const repo = dataSource.getRepository(BusinessService);

      const businessService = await repo.findOne({ where: { id, orgId } });
      if (!businessService) {
        return notFound(res, 'Business service', id);
      }

      // Check for duplicate name if changing
      if (req.body.name && req.body.name !== businessService.name) {
        const existing = await repo.findOne({
          where: { orgId, name: req.body.name },
        });
        if (existing) {
          return conflict(res, 'A business service with this name already exists');
        }
      }

      // Validate ownerTeamId if provided
      if (req.body.ownerTeamId !== undefined && req.body.ownerTeamId !== null) {
        const teamRepo = dataSource.getRepository(Team);
        const team = await teamRepo.findOne({ where: { id: req.body.ownerTeamId, orgId } });
        if (!team) {
          return badRequest(res, 'Owner team not found');
        }
      }

      // Validate pointOfContactId if provided
      if (req.body.pointOfContactId !== undefined && req.body.pointOfContactId !== null) {
        const userRepo = dataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: req.body.pointOfContactId, orgId } });
        if (!user) {
          return badRequest(res, 'Point of contact user not found');
        }
      }

      // Update fields
      if (req.body.name !== undefined) businessService.name = req.body.name;
      if (req.body.description !== undefined) businessService.description = req.body.description;
      if (req.body.ownerTeamId !== undefined) businessService.ownerTeamId = req.body.ownerTeamId;
      if (req.body.pointOfContactId !== undefined) businessService.pointOfContactId = req.body.pointOfContactId;
      if (req.body.status !== undefined) businessService.status = req.body.status;
      if (req.body.impactTier !== undefined) businessService.impactTier = req.body.impactTier;
      if (req.body.externalId !== undefined) businessService.externalId = req.body.externalId;
      if (req.body.documentationUrl !== undefined) businessService.documentationUrl = req.body.documentationUrl;

      await repo.save(businessService);

      // Reload with relations
      const updated = await repo.findOne({
        where: { id },
        relations: ['ownerTeam', 'pointOfContact', 'services'],
      });

      return res.json(updated);
    } catch (error) {
      console.error('Error updating business service:', error);
      return internalError(res);
    }
  }
);

/**
 * Delete a business service
 */
router.delete('/:id',
  param('id').isUUID().withMessage('Invalid business service ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { id } = req.params;
      const dataSource = await getDataSource();
      const repo = dataSource.getRepository(BusinessService);

      const businessService = await repo.findOne({ where: { id, orgId } });
      if (!businessService) {
        return notFound(res, 'Business service', id);
      }

      await repo.remove(businessService);

      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting business service:', error);
      return internalError(res);
    }
  }
);

/**
 * Add/update services linked to a business service
 */
router.put('/:id/services',
  param('id').isUUID().withMessage('Invalid business service ID'),
  body('serviceIds').isArray().withMessage('Service IDs must be an array'),
  body('serviceIds.*').isUUID().withMessage('All service IDs must be valid UUIDs'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { id } = req.params;
      const { serviceIds } = req.body;
      const dataSource = await getDataSource();
      const bsRepo = dataSource.getRepository(BusinessService);
      const serviceRepo = dataSource.getRepository(Service);

      const businessService = await bsRepo.findOne({ where: { id, orgId } });
      if (!businessService) {
        return notFound(res, 'Business service', id);
      }

      // Validate that all provided service IDs exist and belong to this org
      if (serviceIds.length > 0) {
        const existingServices = await serviceRepo.find({
          where: { id: In(serviceIds), orgId },
          select: ['id'],
        });

        if (existingServices.length !== serviceIds.length) {
          const existingIds = existingServices.map(s => s.id);
          const missingIds = serviceIds.filter((id: string) => !existingIds.includes(id));

          return validationError(res, [
            {
              field: 'serviceIds',
              message: `Services not found or do not belong to this organization: ${missingIds.join(', ')}`,
              value: missingIds,
            },
          ]);
        }
      }

      // Clear existing associations and set new ones
      await serviceRepo.update(
        { businessServiceId: id, orgId },
        { businessServiceId: null }
      );

      if (serviceIds.length > 0) {
        await serviceRepo
          .createQueryBuilder()
          .update()
          .set({ businessServiceId: id })
          .where('id IN (:...serviceIds)', { serviceIds })
          .andWhere('orgId = :orgId', { orgId })
          .execute();
      }

      // Reload with relations
      const updated = await bsRepo.findOne({
        where: { id },
        relations: ['ownerTeam', 'pointOfContact', 'services'],
      });

      return res.json(updated);
    } catch (error) {
      console.error('Error updating business service services:', error);
      return internalError(res);
    }
  }
);

// ==================== Service Dependencies ====================

/**
 * Get all dependencies for a service
 */
router.get('/services/:serviceId/dependencies',
  param('serviceId').isUUID().withMessage('Invalid service ID'),
  query('direction').optional().isIn(['upstream', 'downstream', 'both']).withMessage('Direction must be upstream, downstream, or both'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { serviceId } = req.params;
      const direction = (req.query.direction as string) || 'both';
      const dataSource = await getDataSource();
      const depRepo = dataSource.getRepository(ServiceDependency);
      const serviceRepo = dataSource.getRepository(Service);

      // Verify service exists
      const service = await serviceRepo.findOne({ where: { id: serviceId, orgId } });
      if (!service) {
        return notFound(res, 'Service', serviceId);
      }

      const result: { upstream: ServiceDependency[]; downstream: ServiceDependency[] } = {
        upstream: [],
        downstream: [],
      };

      if (direction === 'upstream' || direction === 'both') {
        // Services this service depends on
        result.upstream = await depRepo.find({
          where: { dependentServiceId: serviceId, orgId },
          relations: ['supportingService'],
        });
      }

      if (direction === 'downstream' || direction === 'both') {
        // Services that depend on this service
        result.downstream = await depRepo.find({
          where: { supportingServiceId: serviceId, orgId },
          relations: ['dependentService'],
        });
      }

      return res.json(result);
    } catch (error) {
      console.error('Error fetching service dependencies:', error);
      return internalError(res);
    }
  }
);

/**
 * Add a service dependency
 */
router.post('/dependencies',
  body('dependentServiceId').isUUID().withMessage('Dependent service ID must be a valid UUID'),
  body('supportingServiceId').isUUID().withMessage('Supporting service ID must be a valid UUID'),
  body('dependencyType').optional().isIn(['required', 'optional', 'runtime', 'development']).withMessage('Invalid dependency type'),
  body('impactLevel').optional().isIn(['critical', 'high', 'medium', 'low']).withMessage('Invalid impact level'),
  body('description').optional({ nullable: true }).isString().withMessage('Description must be a string'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { dependentServiceId, supportingServiceId, dependencyType, impactLevel, description } = req.body;
      const dataSource = await getDataSource();
      const depRepo = dataSource.getRepository(ServiceDependency);
      const serviceRepo = dataSource.getRepository(Service);

      // Validate both services exist and belong to org
      const [dependentService, supportingService] = await Promise.all([
        serviceRepo.findOne({ where: { id: dependentServiceId, orgId } }),
        serviceRepo.findOne({ where: { id: supportingServiceId, orgId } }),
      ]);

      if (!dependentService) {
        return notFound(res, 'Dependent service', dependentServiceId);
      }
      if (!supportingService) {
        return notFound(res, 'Supporting service', supportingServiceId);
      }

      // Check for self-dependency
      if (dependentServiceId === supportingServiceId) {
        return badRequest(res, 'A service cannot depend on itself');
      }

      // Check for existing dependency
      const existing = await depRepo.findOne({
        where: { dependentServiceId, supportingServiceId },
      });
      if (existing) {
        return conflict(res, 'This dependency already exists');
      }

      const dependency = depRepo.create({
        orgId,
        dependentServiceId,
        supportingServiceId,
        dependencyType: dependencyType || 'required',
        impactLevel: impactLevel || 'high',
        description: description || null,
      });

      await depRepo.save(dependency);

      // Reload with relations
      const created = await depRepo.findOne({
        where: { id: dependency.id },
        relations: ['dependentService', 'supportingService'],
      });

      return res.status(201).json(created);
    } catch (error) {
      console.error('Error creating service dependency:', error);
      return internalError(res);
    }
  }
);

/**
 * Update a service dependency
 */
router.put('/dependencies/:id',
  param('id').isUUID().withMessage('Invalid dependency ID'),
  body('dependencyType').optional().isIn(['required', 'optional', 'runtime', 'development']).withMessage('Invalid dependency type'),
  body('impactLevel').optional().isIn(['critical', 'high', 'medium', 'low']).withMessage('Invalid impact level'),
  body('description').optional({ nullable: true }).isString().withMessage('Description must be a string'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { id } = req.params;
      const dataSource = await getDataSource();
      const depRepo = dataSource.getRepository(ServiceDependency);

      const dependency = await depRepo.findOne({ where: { id, orgId } });
      if (!dependency) {
        return notFound(res, 'Service dependency', id);
      }

      if (req.body.dependencyType !== undefined) dependency.dependencyType = req.body.dependencyType;
      if (req.body.impactLevel !== undefined) dependency.impactLevel = req.body.impactLevel;
      if (req.body.description !== undefined) dependency.description = req.body.description;

      await depRepo.save(dependency);

      // Reload with relations
      const updated = await depRepo.findOne({
        where: { id },
        relations: ['dependentService', 'supportingService'],
      });

      return res.json(updated);
    } catch (error) {
      console.error('Error updating service dependency:', error);
      return internalError(res);
    }
  }
);

/**
 * Delete a service dependency
 */
router.delete('/dependencies/:id',
  param('id').isUUID().withMessage('Invalid dependency ID'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.user!.orgId;
      const { id } = req.params;
      const dataSource = await getDataSource();
      const depRepo = dataSource.getRepository(ServiceDependency);

      const dependency = await depRepo.findOne({ where: { id, orgId } });
      if (!dependency) {
        return notFound(res, 'Service dependency', id);
      }

      await depRepo.remove(dependency);

      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting service dependency:', error);
      return internalError(res);
    }
  }
);

/**
 * Get full dependency graph for the organization
 */
router.get('/dependency-graph',
  async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.orgId;
      const dataSource = await getDataSource();
      const serviceRepo = dataSource.getRepository(Service);
      const depRepo = dataSource.getRepository(ServiceDependency);

      const [services, dependencies] = await Promise.all([
        serviceRepo.find({
          where: { orgId },
          select: ['id', 'name', 'status', 'businessServiceId'],
          relations: ['businessService'],
        }),
        depRepo.find({
          where: { orgId },
        }),
      ]);

      // Build graph structure
      const nodes = services.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        businessServiceId: s.businessServiceId,
        businessServiceName: s.businessService?.name || null,
      }));

      const edges = dependencies.map(d => ({
        id: d.id,
        source: d.dependentServiceId,
        target: d.supportingServiceId,
        dependencyType: d.dependencyType,
        impactLevel: d.impactLevel,
      }));

      return res.json({ nodes, edges });
    } catch (error) {
      console.error('Error fetching dependency graph:', error);
      return internalError(res);
    }
  }
);

export default router;
