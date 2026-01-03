import { Router, Request, Response } from 'express';
import { body, query as queryValidator, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { AlertRoutingRule, Service } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { parsePaginationParams, paginatedResponse, validateSortField } from '../../shared/utils/pagination';
import { paginationValidators, searchFilterValidator, uuidFilterValidator } from '../../shared/validators/pagination';
import { notFound, internalError, validationError, fromExpressValidator } from '../../shared/utils/problem-details';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/routing-rules
 * List all routing rules for the organization
 */
router.get(
  '/',
  [
    ...paginationValidators,
    searchFilterValidator,
    queryValidator('enabled').optional().isIn(['true', 'false']).withMessage('enabled must be true or false'),
    uuidFilterValidator('target_service_id'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const pagination = parsePaginationParams(req.query);
      const sortField = validateSortField('routingRules', pagination.sort, 'ruleOrder');
      const sortOrder = pagination.order?.toUpperCase() as 'ASC' | 'DESC' || 'ASC';

      // Parse filters
      const { search, enabled, target_service_id } = req.query;

      const dataSource = await getDataSource();
      const ruleRepo = dataSource.getRepository(AlertRoutingRule);

      // Build query
      const queryBuilder = ruleRepo
        .createQueryBuilder('rule')
        .leftJoinAndSelect('rule.targetService', 'targetService')
        .leftJoinAndSelect('rule.createdByUser', 'createdByUser')
        .where('rule.orgId = :orgId', { orgId });

      // Apply filters
      if (search) {
        queryBuilder.andWhere(
          '(rule.name ILIKE :search OR rule.description ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      if (enabled !== undefined) {
        queryBuilder.andWhere('rule.enabled = :enabled', { enabled: enabled === 'true' });
      }

      if (target_service_id) {
        queryBuilder.andWhere('rule.targetServiceId = :targetServiceId', { targetServiceId: target_service_id });
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply sorting and pagination
      // Use ruleOrder as default sort to preserve rule ordering
      const dbSortField = sortField === 'priority' ? 'ruleOrder' : sortField;
      queryBuilder
        .orderBy(`rule.${dbSortField}`, sortOrder)
        .skip(pagination.offset)
        .take(pagination.limit);

      const rules = await queryBuilder.getMany();

      const mappedRules = rules.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        ruleOrder: r.ruleOrder,
        enabled: r.enabled,
        matchType: r.matchType,
        conditions: r.conditions,
        targetServiceId: r.targetServiceId,
        targetService: r.targetService ? {
          id: r.targetService.id,
          name: r.targetService.name,
        } : null,
        setSeverity: r.setSeverity,
        createdBy: r.createdByUser ? {
          id: r.createdByUser.id,
          fullName: r.createdByUser.fullName,
        } : null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      const lastItem = rules[rules.length - 1];
      return res.json(paginatedResponse(
        mappedRules,
        total,
        pagination,
        lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
        'rules'
      ));
    } catch (error) {
      logger.error('Error fetching routing rules:', error);
      return internalError(res);
    }
  }
);

/**
 * POST /api/v1/routing-rules
 * Create a new routing rule
 */
router.post(
  '/',
  [
    body('name').isString().notEmpty().withMessage('Rule name is required'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('matchType').optional().isIn(['all', 'any']).withMessage('Match type must be all or any'),
    body('conditions').optional().isArray().withMessage('Conditions must be an array'),
    body('conditions.*.field').optional().isString().notEmpty().withMessage('Condition field is required'),
    body('conditions.*.operator').optional().isIn([
      'equals', 'not_equals', 'contains', 'not_contains',
      'starts_with', 'ends_with', 'regex', 'in', 'not_in', 'exists', 'not_exists'
    ]).withMessage('Invalid condition operator'),
    body('targetServiceId').optional({ nullable: true }).isUUID().withMessage('Target service ID must be a valid UUID'),
    body('setSeverity').optional({ nullable: true }).isIn(['info', 'warning', 'error', 'critical']).withMessage('Invalid severity'),
    body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const {
        name,
        description,
        matchType = 'all',
        conditions = [],
        targetServiceId,
        setSeverity,
        enabled = true,
      } = req.body;

      const dataSource = await getDataSource();
      const ruleRepo = dataSource.getRepository(AlertRoutingRule);
      const serviceRepo = dataSource.getRepository(Service);

      // Verify target service exists if provided
      if (targetServiceId) {
        const service = await serviceRepo.findOne({ where: { id: targetServiceId, orgId } });
        if (!service) {
          return notFound(res, 'Target service', targetServiceId);
        }
      }

      // Get max rule order
      const maxOrderResult = await ruleRepo
        .createQueryBuilder('rule')
        .select('MAX(rule.ruleOrder)', 'max')
        .where('rule.orgId = :orgId', { orgId })
        .getRawOne();
      const ruleOrder = (maxOrderResult?.max ?? -1) + 1;

      const rule = ruleRepo.create({
        orgId,
        name,
        description: description || null,
        ruleOrder,
        enabled,
        matchType,
        conditions,
        targetServiceId: targetServiceId || null,
        setSeverity: setSeverity || null,
        createdBy: userId,
      });

      await ruleRepo.save(rule);

      // Reload with relations
      const savedRule = await ruleRepo.findOne({
        where: { id: rule.id },
        relations: ['targetService', 'createdByUser'],
      });

      logger.info('Routing rule created', { ruleId: rule.id, name, orgId });

      return res.status(201).json({
        message: 'Routing rule created successfully',
        rule: {
          id: savedRule!.id,
          name: savedRule!.name,
          description: savedRule!.description,
          ruleOrder: savedRule!.ruleOrder,
          enabled: savedRule!.enabled,
          matchType: savedRule!.matchType,
          conditions: savedRule!.conditions,
          targetServiceId: savedRule!.targetServiceId,
          targetService: savedRule!.targetService ? {
            id: savedRule!.targetService.id,
            name: savedRule!.targetService.name,
          } : null,
          setSeverity: savedRule!.setSeverity,
          createdAt: savedRule!.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error creating routing rule:', error);
      return internalError(res);
    }
  }
);

/**
 * GET /api/v1/routing-rules/:id
 * Get a specific routing rule
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const ruleRepo = dataSource.getRepository(AlertRoutingRule);

    const rule = await ruleRepo.findOne({
      where: { id, orgId },
      relations: ['targetService', 'createdByUser'],
    });

    if (!rule) {
      return notFound(res, 'Routing rule', id);
    }

    return res.json({
      rule: {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        ruleOrder: rule.ruleOrder,
        enabled: rule.enabled,
        matchType: rule.matchType,
        conditions: rule.conditions,
        targetServiceId: rule.targetServiceId,
        targetService: rule.targetService ? {
          id: rule.targetService.id,
          name: rule.targetService.name,
        } : null,
        setSeverity: rule.setSeverity,
        createdBy: rule.createdByUser ? {
          id: rule.createdByUser.id,
          fullName: rule.createdByUser.fullName,
        } : null,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching routing rule:', error);
    return internalError(res);
  }
});

/**
 * PUT /api/v1/routing-rules/:id
 * Update a routing rule
 */
router.put(
  '/:id',
  [
    body('name').optional().isString().notEmpty().withMessage('Rule name cannot be empty'),
    body('description').optional({ nullable: true }).isString().withMessage('Description must be a string'),
    body('matchType').optional().isIn(['all', 'any']).withMessage('Match type must be all or any'),
    body('conditions').optional().isArray().withMessage('Conditions must be an array'),
    body('targetServiceId').optional({ nullable: true }).isUUID().withMessage('Target service ID must be a valid UUID'),
    body('setSeverity').optional({ nullable: true }).isIn(['info', 'warning', 'error', 'critical']).withMessage('Invalid severity'),
    body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
    body('ruleOrder').optional().isInt({ min: 0 }).withMessage('Rule order must be a non-negative integer'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const {
        name,
        description,
        matchType,
        conditions,
        targetServiceId,
        setSeverity,
        enabled,
        ruleOrder,
      } = req.body;

      const dataSource = await getDataSource();
      const ruleRepo = dataSource.getRepository(AlertRoutingRule);
      const serviceRepo = dataSource.getRepository(Service);

      const rule = await ruleRepo.findOne({
        where: { id, orgId },
        relations: ['targetService'],
      });

      if (!rule) {
        return notFound(res, 'Routing rule', id);
      }

      // Verify target service if changing
      if (targetServiceId !== undefined && targetServiceId !== null) {
        const service = await serviceRepo.findOne({ where: { id: targetServiceId, orgId } });
        if (!service) {
          return notFound(res, 'Target service', targetServiceId);
        }
      }

      // Update fields
      if (name !== undefined) rule.name = name;
      if (description !== undefined) rule.description = description;
      if (matchType !== undefined) rule.matchType = matchType;
      if (conditions !== undefined) rule.conditions = conditions;
      if (targetServiceId !== undefined) rule.targetServiceId = targetServiceId;
      if (setSeverity !== undefined) rule.setSeverity = setSeverity;
      if (enabled !== undefined) rule.enabled = enabled;
      if (ruleOrder !== undefined) rule.ruleOrder = ruleOrder;

      await ruleRepo.save(rule);

      // Reload with relations
      const updatedRule = await ruleRepo.findOne({
        where: { id },
        relations: ['targetService', 'createdByUser'],
      });

      logger.info('Routing rule updated', { ruleId: id, orgId });

      return res.json({
        message: 'Routing rule updated successfully',
        rule: {
          id: updatedRule!.id,
          name: updatedRule!.name,
          description: updatedRule!.description,
          ruleOrder: updatedRule!.ruleOrder,
          enabled: updatedRule!.enabled,
          matchType: updatedRule!.matchType,
          conditions: updatedRule!.conditions,
          targetServiceId: updatedRule!.targetServiceId,
          targetService: updatedRule!.targetService ? {
            id: updatedRule!.targetService.id,
            name: updatedRule!.targetService.name,
          } : null,
          setSeverity: updatedRule!.setSeverity,
          updatedAt: updatedRule!.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Error updating routing rule:', error);
      return internalError(res);
    }
  }
);

/**
 * DELETE /api/v1/routing-rules/:id
 * Delete a routing rule
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const ruleRepo = dataSource.getRepository(AlertRoutingRule);

    const rule = await ruleRepo.findOne({ where: { id, orgId } });
    if (!rule) {
      return notFound(res, 'Routing rule', id);
    }

    await ruleRepo.remove(rule);

    logger.info('Routing rule deleted', { ruleId: id, orgId });

    return res.status(204).send();
  } catch (error) {
    logger.error('Error deleting routing rule:', error);
    return internalError(res);
  }
});

/**
 * PUT /api/v1/routing-rules/reorder
 * Reorder routing rules
 */
router.put(
  '/reorder',
  [
    body('ruleIds').isArray({ min: 1 }).withMessage('Rule IDs array is required'),
    body('ruleIds.*').isUUID().withMessage('All rule IDs must be valid UUIDs'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const { ruleIds } = req.body;

      const dataSource = await getDataSource();
      const ruleRepo = dataSource.getRepository(AlertRoutingRule);

      // Update order for each rule
      for (let i = 0; i < ruleIds.length; i++) {
        await ruleRepo.update(
          { id: ruleIds[i], orgId },
          { ruleOrder: i }
        );
      }

      logger.info('Routing rules reordered', { orgId, count: ruleIds.length });

      return res.json({ message: 'Rules reordered successfully' });
    } catch (error) {
      logger.error('Error reordering routing rules:', error);
      return internalError(res);
    }
  }
);

/**
 * POST /api/v1/routing-rules/:id/test
 * Test a routing rule against a sample payload
 */
router.post(
  '/:id/test',
  [
    body('payload').isObject().withMessage('Payload is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { payload } = req.body;

      const dataSource = await getDataSource();
      const ruleRepo = dataSource.getRepository(AlertRoutingRule);

      const rule = await ruleRepo.findOne({
        where: { id, orgId },
        relations: ['targetService'],
      });

      if (!rule) {
        return notFound(res, 'Routing rule', id);
      }

      const matches = rule.evaluate(payload);

      return res.json({
        matches,
        rule: {
          id: rule.id,
          name: rule.name,
          description: rule.getDescription(),
        },
        result: matches ? {
          targetService: rule.targetService ? {
            id: rule.targetService.id,
            name: rule.targetService.name,
          } : null,
          setSeverity: rule.setSeverity,
        } : null,
      });
    } catch (error) {
      logger.error('Error testing routing rule:', error);
      return internalError(res);
    }
  }
);

export default router;
