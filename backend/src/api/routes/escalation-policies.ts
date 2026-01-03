import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateRequest } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { EscalationPolicy, EscalationStep, EscalationTarget, Schedule, User } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { setLocationHeader } from '../../shared/utils/location-header';

const router = Router();

// UUID regex that accepts any valid UUID format (not just v4)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (value: any) => {
  if (value === null || value === undefined || value === '') return true;
  return UUID_REGEX.test(value);
};

// All routes require authentication (supports JWT, service API key, and org API key)
router.use(authenticateRequest);

/**
 * @swagger
 * /api/v1/escalation-policies:
 *   get:
 *     summary: List all escalation policies
 *     description: Returns all escalation policies for the organization with their steps, targets, and resolved on-call users.
 *     tags: [Escalation Policies]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of policies to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of policies to skip for pagination
 *     responses:
 *       200:
 *         description: List of escalation policies with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 policies:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EscalationPolicy'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
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
router.get(
  '/',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const orgId = req.orgId!;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const dataSource = await getDataSource();
      const policyRepo = dataSource.getRepository(EscalationPolicy);

      const [policies, total] = await policyRepo.findAndCount({
        where: { orgId },
        relations: ['steps', 'steps.schedule', 'steps.targets', 'steps.targets.user', 'steps.targets.schedule'],
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });

      // Sort steps by order
      policies.forEach(policy => {
        if (policy.steps) {
          policy.steps.sort((a, b) => a.stepOrder - b.stepOrder);
        }
      });

      // Resolve on-call users for schedule targets
      const scheduleRepo = dataSource.getRepository(Schedule);
      const userRepo = dataSource.getRepository(User);
      const formattedPolicies = await Promise.all(
        policies.map(policy => formatPolicyWithResolvedUsers(policy, scheduleRepo, userRepo))
      );

      return res.json({
        policies: formattedPolicies,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + policies.length < total,
        },
      });
    } catch (error) {
      logger.error('Error fetching escalation policies:', error);
      return res.status(500).json({ error: 'Failed to fetch escalation policies' });
    }
  }
);

/**
 * @swagger
 * /api/v1/escalation-policies/{id}:
 *   get:
 *     summary: Get an escalation policy by ID
 *     description: Returns detailed information about a specific escalation policy, including all steps, targets, and resolved on-call users.
 *     tags: [Escalation Policies]
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
 *         description: Escalation policy ID
 *     responses:
 *       200:
 *         description: Escalation policy details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 policy:
 *                   $ref: '#/components/schemas/EscalationPolicy'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Escalation policy not found
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
router.get('/:id', [param('id').isUUID()], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const policyRepo = dataSource.getRepository(EscalationPolicy);

    const policy = await policyRepo.findOne({
      where: { id, orgId },
      relations: ['steps', 'steps.schedule', 'steps.targets', 'steps.targets.user', 'steps.targets.schedule'],
    });

    if (!policy) {
      return res.status(404).json({ error: 'Escalation policy not found' });
    }

    // Sort steps by order
    if (policy.steps) {
      policy.steps.sort((a, b) => a.stepOrder - b.stepOrder);
    }

    // Resolve on-call users for schedule targets
    const scheduleRepo = dataSource.getRepository(Schedule);
    const userRepo = dataSource.getRepository(User);
    const formattedPolicy = await formatPolicyWithResolvedUsers(policy, scheduleRepo, userRepo);

    return res.json({ policy: formattedPolicy });
  } catch (error) {
    logger.error('Error fetching escalation policy:', error);
    return res.status(500).json({ error: 'Failed to fetch escalation policy' });
  }
});

/**
 * @swagger
 * /api/v1/escalation-policies:
 *   post:
 *     summary: Create an escalation policy
 *     description: Creates a new escalation policy with one or more steps. Each step defines who to notify and for how long before escalating.
 *     tags: [Escalation Policies]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EscalationPolicyCreate'
 *     responses:
 *       201:
 *         description: Escalation policy created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 policy:
 *                   $ref: '#/components/schemas/EscalationPolicy'
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
    body('name').isString().trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().isString().trim(),
    body('repeatEnabled').optional().isBoolean(),
    body('repeatCount').optional().isInt({ min: 0 }),
    body('steps').isArray({ min: 1 }).withMessage('At least one escalation step is required'),
    body('steps.*.targetType').isIn(['schedule', 'users']),
    body('steps.*.scheduleId').optional({ nullable: true }).custom(isValidUUID),
    body('steps.*.userIds').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      if (!Array.isArray(value)) throw new Error('Must be an array');
      return true;
    }),
    body('steps.*.userIds.*').optional().custom(isValidUUID),
    body('steps.*.timeoutSeconds').isInt({ min: 0 }),
    // New: Support for multiple targets per step
    body('steps.*.targets').optional().isArray(),
    body('steps.*.targets.*.targetType').optional().isIn(['user', 'schedule']),
    body('steps.*.targets.*.userId').optional({ nullable: true }).custom(isValidUUID),
    body('steps.*.targets.*.scheduleId').optional({ nullable: true }).custom(isValidUUID),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const orgId = req.orgId!;
      const { name, description, steps } = req.body;

      const dataSource = await getDataSource();
      const policyRepo = dataSource.getRepository(EscalationPolicy);
      const stepRepo = dataSource.getRepository(EscalationStep);

      // Validate steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step.targetType === 'schedule' && !step.scheduleId) {
          return res.status(400).json({ error: `Step ${i + 1}: Schedule ID required when target type is "schedule"` });
        }
        if (step.targetType === 'users' && (!step.userIds || step.userIds.length === 0)) {
          return res.status(400).json({ error: `Step ${i + 1}: At least one user ID required when target type is "users"` });
        }
      }

      // Create policy
      const { repeatEnabled, repeatCount } = req.body;
      const policy = policyRepo.create({
        orgId,
        name,
        description,
        repeatEnabled: repeatEnabled ?? false,
        repeatCount: repeatCount ?? 0,
      });
      await policyRepo.save(policy);

      // Create steps
      const targetRepo = dataSource.getRepository(EscalationTarget);
      const createdSteps = [];
      for (let i = 0; i < steps.length; i++) {
        const stepData = steps[i];
        const step = stepRepo.create({
          escalationPolicyId: policy.id,
          stepOrder: i + 1,
          targetType: stepData.targetType,
          scheduleId: stepData.scheduleId || null,
          userIds: stepData.userIds || null,
          timeoutSeconds: stepData.timeoutSeconds,
        });

        const validation = step.validate();
        if (!validation.valid) {
          return res.status(400).json({ error: `Step ${i + 1}: ${validation.errors.join(', ')}` });
        }

        await stepRepo.save(step);

        // Create EscalationTarget records if targets array is provided
        if (stepData.targets && Array.isArray(stepData.targets)) {
          const createdTargets = [];
          for (const targetData of stepData.targets) {
            const target = targetRepo.create({
              escalationStepId: step.id,
              targetType: targetData.targetType,
              userId: targetData.userId || null,
              scheduleId: targetData.scheduleId || null,
            });
            await targetRepo.save(target);
            createdTargets.push(target);
          }
          step.targets = createdTargets;
        }

        createdSteps.push(step);
      }

      policy.steps = createdSteps;

      logger.info('Escalation policy created', {
        policyId: policy.id,
        orgId,
        steps: createdSteps.length,
      });

      setLocationHeader(res, req, '/api/v1/escalation-policies', policy.id);
      return res.status(201).json({ policy: formatPolicy(policy) });
    } catch (error) {
      logger.error('Error creating escalation policy:', error);
      return res.status(500).json({ error: 'Failed to create escalation policy' });
    }
  }
);

/**
 * @swagger
 * /api/v1/escalation-policies/{id}:
 *   put:
 *     summary: Update an escalation policy
 *     description: Updates an escalation policy. If steps are provided, they replace all existing steps.
 *     tags: [Escalation Policies]
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
 *         description: Escalation policy ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EscalationPolicyUpdate'
 *     responses:
 *       200:
 *         description: Escalation policy updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 policy:
 *                   $ref: '#/components/schemas/EscalationPolicy'
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
 *         description: Escalation policy not found
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
    param('id').isUUID(),
    body('name').optional().isString().trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().isString().trim(),
    body('repeatEnabled').optional().isBoolean(),
    body('repeatCount').optional().isInt({ min: 0 }),
    body('steps').optional().isArray({ min: 1 }),
    body('steps.*.targetType').optional().isIn(['schedule', 'users']),
    body('steps.*.scheduleId').optional({ nullable: true }).custom(isValidUUID),
    body('steps.*.userIds').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      if (!Array.isArray(value)) throw new Error('Must be an array');
      return true;
    }),
    body('steps.*.userIds.*').optional().custom(isValidUUID),
    body('steps.*.timeoutSeconds').optional().isInt({ min: 0 }),
    // Support for multiple targets per step
    body('steps.*.targets').optional().isArray(),
    body('steps.*.targets.*.targetType').optional().isIn(['user', 'schedule']),
    body('steps.*.targets.*.userId').optional({ nullable: true }).custom(isValidUUID),
    body('steps.*.targets.*.scheduleId').optional({ nullable: true }).custom(isValidUUID),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error('PUT validation errors', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const orgId = req.orgId!;
      const { name, description, repeatEnabled, repeatCount, steps } = req.body;
      logger.info('PUT escalation policy', { id, name, description, repeatEnabled, repeatCount, stepsCount: steps?.length, steps: JSON.stringify(steps) });

      const dataSource = await getDataSource();
      const policyRepo = dataSource.getRepository(EscalationPolicy);
      const stepRepo = dataSource.getRepository(EscalationStep);
      const targetRepo = dataSource.getRepository(EscalationTarget);

      const policy = await policyRepo.findOne({
        where: { id, orgId },
        relations: ['steps', 'steps.targets'],
      });

      if (!policy) {
        return res.status(404).json({ error: 'Escalation policy not found' });
      }

      // Update metadata
      if (name !== undefined) policy.name = name;
      if (description !== undefined) policy.description = description;
      if (repeatEnabled !== undefined) policy.repeatEnabled = repeatEnabled;
      if (repeatCount !== undefined) policy.repeatCount = repeatCount;

      // If steps are provided, replace all existing steps
      if (steps !== undefined) {
        // Delete existing steps
        if (policy.steps && policy.steps.length > 0) {
          await stepRepo.remove(policy.steps);
        }

        // Validate new steps
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          if (step.targetType === 'schedule' && !step.scheduleId) {
            return res.status(400).json({ error: `Step ${i + 1}: Schedule ID required when target type is "schedule"` });
          }
          if (step.targetType === 'users' && (!step.userIds || step.userIds.length === 0)) {
            return res.status(400).json({ error: `Step ${i + 1}: At least one user ID required when target type is "users"` });
          }
        }

        // Create new steps
        const createdSteps = [];
        for (let i = 0; i < steps.length; i++) {
          const stepData = steps[i];
          logger.info('Creating step', { stepOrder: i + 1, targetType: stepData.targetType, scheduleId: stepData.scheduleId, userIds: stepData.userIds });

          const step = stepRepo.create({
            escalationPolicyId: policy.id,
            stepOrder: i + 1,
            targetType: stepData.targetType,
            scheduleId: stepData.scheduleId || null,
            userIds: stepData.userIds || null,
            timeoutSeconds: stepData.timeoutSeconds,
          });

          const validation = step.validate();
          if (!validation.valid) {
            return res.status(400).json({ error: `Step ${i + 1}: ${validation.errors.join(', ')}` });
          }

          await stepRepo.save(step);
          logger.info('Step saved', { stepId: step.id, userIds: step.userIds });

          // Create EscalationTarget records if targets array is provided
          if (stepData.targets && Array.isArray(stepData.targets)) {
            const createdTargets = [];
            for (const targetData of stepData.targets) {
              const target = targetRepo.create({
                escalationStepId: step.id,
                targetType: targetData.targetType,
                userId: targetData.userId || null,
                scheduleId: targetData.scheduleId || null,
              });
              await targetRepo.save(target);
              createdTargets.push(target);
            }
            step.targets = createdTargets;
          }

          createdSteps.push(step);
        }

        policy.steps = createdSteps;
      }

      await policyRepo.save(policy);

      // Reload with relations
      const updatedPolicy = await policyRepo.findOne({
        where: { id },
        relations: ['steps', 'steps.schedule', 'steps.targets', 'steps.targets.user', 'steps.targets.schedule'],
      });

      logger.info('Escalation policy updated', { policyId: policy.id, orgId, stepsUpdated: steps !== undefined });

      return res.json({ policy: formatPolicy(updatedPolicy!) });
    } catch (error) {
      logger.error('Error updating escalation policy:', error);
      return res.status(500).json({ error: 'Failed to update escalation policy' });
    }
  }
);

/**
 * @swagger
 * /api/v1/escalation-policies/{id}:
 *   delete:
 *     summary: Delete an escalation policy
 *     description: Deletes an escalation policy. Cannot delete policies that are currently in use by services.
 *     tags: [Escalation Policies]
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
 *         description: Escalation policy ID
 *     responses:
 *       200:
 *         description: Escalation policy deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Escalation policy deleted successfully
 *       400:
 *         description: Cannot delete policy that is in use by services
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Cannot delete escalation policy that is in use by services
 *                 servicesCount:
 *                   type: integer
 *                   description: Number of services using this policy
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Escalation policy not found
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
router.delete('/:id', [param('id').isUUID()], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const policyRepo = dataSource.getRepository(EscalationPolicy);

    const policy = await policyRepo.findOne({
      where: { id, orgId },
      relations: ['services'],
    });

    if (!policy) {
      return res.status(404).json({ error: 'Escalation policy not found' });
    }

    // Check if policy is in use
    if (policy.services && policy.services.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete escalation policy that is in use by services',
        servicesCount: policy.services.length,
      });
    }

    await policyRepo.remove(policy);

    logger.info('Escalation policy deleted', { policyId: id, orgId });

    return res.json({ message: 'Escalation policy deleted successfully' });
  } catch (error) {
    logger.error('Error deleting escalation policy:', error);
    return res.status(500).json({ error: 'Failed to delete escalation policy' });
  }
});

/**
 * @swagger
 * /api/v1/escalation-policies/{id}/steps:
 *   post:
 *     summary: Add a step to an escalation policy
 *     description: Adds a new escalation step to the policy. Steps are ordered and can be inserted at specific positions.
 *     tags: [Escalation Policies]
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
 *         description: Escalation policy ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EscalationStepCreate'
 *     responses:
 *       201:
 *         description: Escalation step added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 step:
 *                   $ref: '#/components/schemas/EscalationStep'
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
 *         description: Escalation policy not found
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
  '/:id/steps',
  [
    param('id').isUUID(),
    body('targetType').isIn(['schedule', 'users']),
    body('scheduleId').optional().custom(isValidUUID),
    body('userIds').optional().isArray(),
    body('userIds.*').optional().custom(isValidUUID),
    body('timeoutSeconds').isInt({ min: 0 }),
    body('position').optional().isInt({ min: 1 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const orgId = req.orgId!;
      const { targetType, scheduleId, userIds, timeoutSeconds, position } = req.body;

      const dataSource = await getDataSource();
      const policyRepo = dataSource.getRepository(EscalationPolicy);
      const stepRepo = dataSource.getRepository(EscalationStep);

      const policy = await policyRepo.findOne({
        where: { id, orgId },
        relations: ['steps'],
      });

      if (!policy) {
        return res.status(404).json({ error: 'Escalation policy not found' });
      }

      // Determine step order
      const existingSteps = policy.steps || [];
      const maxOrder = existingSteps.length > 0 ? Math.max(...existingSteps.map(s => s.stepOrder)) : 0;
      const stepOrder = position || maxOrder + 1;

      // If inserting at specific position, reorder existing steps
      if (position && position <= maxOrder) {
        for (const step of existingSteps) {
          if (step.stepOrder >= position) {
            step.stepOrder += 1;
            await stepRepo.save(step);
          }
        }
      }

      const step = stepRepo.create({
        escalationPolicyId: policy.id,
        stepOrder,
        targetType,
        scheduleId: scheduleId || null,
        userIds: userIds || null,
        timeoutSeconds,
      });

      const validation = step.validate();
      if (!validation.valid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
      }

      await stepRepo.save(step);

      logger.info('Escalation step added', {
        policyId: policy.id,
        stepId: step.id,
        stepOrder,
      });

      setLocationHeader(res, req, `/api/v1/escalation-policies/${policy.id}/steps`, step.id);
      return res.status(201).json({ step: formatStep(step) });
    } catch (error) {
      logger.error('Error adding escalation step:', error);
      return res.status(500).json({ error: 'Failed to add escalation step' });
    }
  }
);

/**
 * @swagger
 * /api/v1/escalation-policies/{policyId}/steps/{stepId}:
 *   put:
 *     summary: Update an escalation step
 *     description: Updates an existing escalation step's configuration.
 *     tags: [Escalation Policies]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: policyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Escalation policy ID
 *       - in: path
 *         name: stepId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Escalation step ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetType:
 *                 type: string
 *                 enum: [schedule, users]
 *                 description: Type of escalation target
 *               scheduleId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: Schedule ID (required if targetType is "schedule")
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 nullable: true
 *                 description: User IDs (required if targetType is "users")
 *               timeoutSeconds:
 *                 type: integer
 *                 minimum: 0
 *                 description: Seconds to wait before escalating to the next step
 *     responses:
 *       200:
 *         description: Escalation step updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 step:
 *                   $ref: '#/components/schemas/EscalationStep'
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
 *         description: Escalation policy or step not found
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
  '/:policyId/steps/:stepId',
  [
    param('policyId').isUUID(),
    param('stepId').isUUID(),
    body('targetType').optional().isIn(['schedule', 'users']),
    body('scheduleId').optional().custom(isValidUUID),
    body('userIds').optional().isArray(),
    body('userIds.*').optional().custom(isValidUUID),
    body('timeoutSeconds').optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { policyId, stepId } = req.params;
      const orgId = req.orgId!;
      const { targetType, scheduleId, userIds, timeoutSeconds } = req.body;

      const dataSource = await getDataSource();
      const policyRepo = dataSource.getRepository(EscalationPolicy);
      const stepRepo = dataSource.getRepository(EscalationStep);

      const policy = await policyRepo.findOne({ where: { id: policyId, orgId } });
      if (!policy) {
        return res.status(404).json({ error: 'Escalation policy not found' });
      }

      const step = await stepRepo.findOne({
        where: { id: stepId, escalationPolicyId: policyId },
      });

      if (!step) {
        return res.status(404).json({ error: 'Escalation step not found' });
      }

      if (targetType !== undefined) step.targetType = targetType;
      if (scheduleId !== undefined) step.scheduleId = scheduleId;
      if (userIds !== undefined) step.userIds = userIds;
      if (timeoutSeconds !== undefined) step.timeoutSeconds = timeoutSeconds;

      const validation = step.validate();
      if (!validation.valid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
      }

      await stepRepo.save(step);

      logger.info('Escalation step updated', { stepId, policyId });

      return res.json({ step: formatStep(step) });
    } catch (error) {
      logger.error('Error updating escalation step:', error);
      return res.status(500).json({ error: 'Failed to update escalation step' });
    }
  }
);

/**
 * @swagger
 * /api/v1/escalation-policies/{policyId}/steps/{stepId}:
 *   delete:
 *     summary: Delete an escalation step
 *     description: Deletes an escalation step from the policy. Cannot delete the last remaining step - policies must have at least one step.
 *     tags: [Escalation Policies]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: policyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Escalation policy ID
 *       - in: path
 *         name: stepId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Escalation step ID
 *     responses:
 *       200:
 *         description: Escalation step deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Escalation step deleted successfully
 *       400:
 *         description: Cannot delete the last escalation step
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Cannot delete the last escalation step. Policy must have at least one step.
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Escalation policy or step not found
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
router.delete(
  '/:policyId/steps/:stepId',
  [param('policyId').isUUID(), param('stepId').isUUID()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { policyId, stepId } = req.params;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const policyRepo = dataSource.getRepository(EscalationPolicy);
      const stepRepo = dataSource.getRepository(EscalationStep);

      const policy = await policyRepo.findOne({
        where: { id: policyId, orgId },
        relations: ['steps'],
      });

      if (!policy) {
        return res.status(404).json({ error: 'Escalation policy not found' });
      }

      const step = await stepRepo.findOne({
        where: { id: stepId, escalationPolicyId: policyId },
      });

      if (!step) {
        return res.status(404).json({ error: 'Escalation step not found' });
      }

      // Check if this is the last step
      if (policy.steps.length === 1) {
        return res.status(400).json({ error: 'Cannot delete the last escalation step. Policy must have at least one step.' });
      }

      const deletedStepOrder = step.stepOrder;
      await stepRepo.remove(step);

      // Reorder remaining steps
      const remainingSteps = await stepRepo.find({
        where: { escalationPolicyId: policyId },
        order: { stepOrder: 'ASC' },
      });

      for (const remainingStep of remainingSteps) {
        if (remainingStep.stepOrder > deletedStepOrder) {
          remainingStep.stepOrder -= 1;
          await stepRepo.save(remainingStep);
        }
      }

      logger.info('Escalation step deleted', { stepId, policyId });

      return res.json({ message: 'Escalation step deleted successfully' });
    } catch (error) {
      logger.error('Error deleting escalation step:', error);
      return res.status(500).json({ error: 'Failed to delete escalation step' });
    }
  }
);

/**
 * @swagger
 * /api/v1/escalation-policies/{id}/steps/reorder:
 *   put:
 *     summary: Reorder escalation steps
 *     description: Reorders the escalation steps by providing a new ordered list of step IDs. All step IDs must belong to the policy.
 *     tags: [Escalation Policies]
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
 *         description: Escalation policy ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stepIds
 *             properties:
 *               stepIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *                 description: Ordered list of step IDs
 *     responses:
 *       200:
 *         description: Steps reordered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Steps reordered successfully
 *       400:
 *         description: Validation error or step count mismatch
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
 *         description: Escalation policy not found
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
  '/:id/steps/reorder',
  [
    param('id').isUUID(),
    body('stepIds').isArray({ min: 1 }),
    body('stepIds.*').custom(isValidUUID),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const orgId = req.orgId!;
      const { stepIds } = req.body;

      const dataSource = await getDataSource();
      const policyRepo = dataSource.getRepository(EscalationPolicy);
      const stepRepo = dataSource.getRepository(EscalationStep);

      const policy = await policyRepo.findOne({
        where: { id, orgId },
        relations: ['steps'],
      });

      if (!policy) {
        return res.status(404).json({ error: 'Escalation policy not found' });
      }

      // Verify all step IDs belong to this policy
      const existingStepIds = policy.steps.map(s => s.id);
      if (stepIds.length !== existingStepIds.length) {
        return res.status(400).json({ error: 'Step count mismatch' });
      }

      for (const stepId of stepIds) {
        if (!existingStepIds.includes(stepId)) {
          return res.status(400).json({ error: `Step ${stepId} does not belong to this policy` });
        }
      }

      // Reorder steps
      for (let i = 0; i < stepIds.length; i++) {
        const step = await stepRepo.findOne({ where: { id: stepIds[i] } });
        if (step) {
          step.stepOrder = i + 1;
          await stepRepo.save(step);
        }
      }

      logger.info('Escalation steps reordered', { policyId: id, stepCount: stepIds.length });

      return res.json({ message: 'Steps reordered successfully' });
    } catch (error) {
      logger.error('Error reordering escalation steps:', error);
      return res.status(500).json({ error: 'Failed to reorder escalation steps' });
    }
  }
);

// Helper functions
function formatPolicy(policy: EscalationPolicy) {
  return {
    id: policy.id,
    orgId: policy.orgId,
    name: policy.name,
    description: policy.description,
    repeatEnabled: policy.repeatEnabled,
    repeatCount: policy.repeatCount,
    steps: policy.steps?.map(formatStep) || [],
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

async function formatPolicyWithResolvedUsers(
  policy: EscalationPolicy,
  scheduleRepo: any,
  userRepo: any
) {
  const formattedSteps = await Promise.all(
    (policy.steps || []).map(step => formatStepWithResolvedUser(step, scheduleRepo, userRepo))
  );

  return {
    id: policy.id,
    orgId: policy.orgId,
    name: policy.name,
    description: policy.description,
    repeatEnabled: policy.repeatEnabled,
    repeatCount: policy.repeatCount,
    steps: formattedSteps,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

async function formatStepWithResolvedUser(
  step: EscalationStep,
  scheduleRepo: any,
  userRepo: any
) {
  const baseStep = formatStep(step);

  // If this step targets a schedule, resolve the current on-call user
  if (step.targetType === 'schedule' && step.scheduleId) {
    const schedule = await scheduleRepo.findOne({ where: { id: step.scheduleId } });
    if (schedule) {
      const oncallUserId = schedule.getCurrentOncallUserId();
      if (oncallUserId) {
        const oncallUser = await userRepo.findOne({ where: { id: oncallUserId } });
        if (oncallUser) {
          return {
            ...baseStep,
            resolvedOncallUser: {
              id: oncallUser.id,
              fullName: oncallUser.fullName || oncallUser.email,
              email: oncallUser.email,
            },
          };
        }
      }
    }
  }

  // If this step targets specific users, resolve their info
  if (step.targetType === 'users' && step.userIds && step.userIds.length > 0) {
    const users = await userRepo.find({
      where: step.userIds.map((id: string) => ({ id })),
    });
    return {
      ...baseStep,
      resolvedUsers: users.map((user: User) => ({
        id: user.id,
        fullName: user.fullName || user.email,
        email: user.email,
      })),
    };
  }

  return baseStep;
}

function formatStep(step: EscalationStep) {
  return {
    id: step.id,
    escalationPolicyId: step.escalationPolicyId,
    stepOrder: step.stepOrder,
    targetType: step.targetType,
    scheduleId: step.scheduleId,
    schedule: step.schedule ? {
      id: step.schedule.id,
      name: step.schedule.name,
    } : null,
    userIds: step.userIds,
    timeoutSeconds: step.timeoutSeconds,
    // Multi-target support
    targets: step.targets?.map(formatTarget) || [],
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
  };
}

function formatTarget(target: EscalationTarget) {
  return {
    id: target.id,
    targetType: target.targetType,
    userId: target.userId,
    user: target.user ? {
      id: target.user.id,
      fullName: target.user.fullName,
      email: target.user.email,
    } : null,
    scheduleId: target.scheduleId,
    schedule: target.schedule ? {
      id: target.schedule.id,
      name: target.schedule.name,
    } : null,
  };
}

export default router;
