import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { EscalationPolicy, EscalationStep } from '../../shared/models';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/escalation-policies
 * List all escalation policies for the organization
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
        relations: ['steps', 'steps.schedule'],
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

      return res.json({
        policies: policies.map(formatPolicy),
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
 * GET /api/v1/escalation-policies/:id
 * Get a single escalation policy
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
      relations: ['steps', 'steps.schedule'],
    });

    if (!policy) {
      return res.status(404).json({ error: 'Escalation policy not found' });
    }

    // Sort steps by order
    if (policy.steps) {
      policy.steps.sort((a, b) => a.stepOrder - b.stepOrder);
    }

    return res.json({ policy: formatPolicy(policy) });
  } catch (error) {
    logger.error('Error fetching escalation policy:', error);
    return res.status(500).json({ error: 'Failed to fetch escalation policy' });
  }
});

/**
 * POST /api/v1/escalation-policies
 * Create a new escalation policy
 */
router.post(
  '/',
  [
    body('name').isString().trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().isString().trim(),
    body('steps').isArray({ min: 1 }).withMessage('At least one escalation step is required'),
    body('steps.*.targetType').isIn(['schedule', 'users']),
    body('steps.*.scheduleId').optional({ nullable: true }).isUUID(),
    body('steps.*.userIds').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      if (!Array.isArray(value)) throw new Error('Must be an array');
      return true;
    }),
    body('steps.*.userIds.*').optional().isUUID(),
    body('steps.*.timeoutSeconds').isInt({ min: 0 }),
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
      const policy = policyRepo.create({
        orgId,
        name,
        description,
      });
      await policyRepo.save(policy);

      // Create steps
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
        createdSteps.push(step);
      }

      policy.steps = createdSteps;

      logger.info('Escalation policy created', {
        policyId: policy.id,
        orgId,
        steps: createdSteps.length,
      });

      return res.status(201).json({ policy: formatPolicy(policy) });
    } catch (error) {
      logger.error('Error creating escalation policy:', error);
      return res.status(500).json({ error: 'Failed to create escalation policy' });
    }
  }
);

/**
 * PUT /api/v1/escalation-policies/:id
 * Update an escalation policy (including steps)
 */
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().isString().trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().isString().trim(),
    body('steps').optional().isArray({ min: 1 }),
    body('steps.*.targetType').optional().isIn(['schedule', 'users']),
    body('steps.*.scheduleId').optional({ nullable: true }).isUUID(),
    body('steps.*.userIds').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      if (!Array.isArray(value)) throw new Error('Must be an array');
      return true;
    }),
    body('steps.*.userIds.*').optional().isUUID(),
    body('steps.*.timeoutSeconds').optional().isInt({ min: 0 }),
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
      const { name, description, steps } = req.body;
      logger.info('PUT escalation policy', { id, name, description, stepsCount: steps?.length, steps: JSON.stringify(steps) });

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

      // Update metadata
      if (name !== undefined) policy.name = name;
      if (description !== undefined) policy.description = description;

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
          createdSteps.push(step);
        }

        policy.steps = createdSteps;
      }

      await policyRepo.save(policy);

      // Reload with relations
      const updatedPolicy = await policyRepo.findOne({
        where: { id },
        relations: ['steps', 'steps.schedule'],
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
 * DELETE /api/v1/escalation-policies/:id
 * Delete an escalation policy
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
 * POST /api/v1/escalation-policies/:id/steps
 * Add a new step to an escalation policy
 */
router.post(
  '/:id/steps',
  [
    param('id').isUUID(),
    body('targetType').isIn(['schedule', 'users']),
    body('scheduleId').optional().isUUID(),
    body('userIds').optional().isArray(),
    body('userIds.*').optional().isUUID(),
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

      return res.status(201).json({ step: formatStep(step) });
    } catch (error) {
      logger.error('Error adding escalation step:', error);
      return res.status(500).json({ error: 'Failed to add escalation step' });
    }
  }
);

/**
 * PUT /api/v1/escalation-policies/:policyId/steps/:stepId
 * Update an escalation step
 */
router.put(
  '/:policyId/steps/:stepId',
  [
    param('policyId').isUUID(),
    param('stepId').isUUID(),
    body('targetType').optional().isIn(['schedule', 'users']),
    body('scheduleId').optional().isUUID(),
    body('userIds').optional().isArray(),
    body('userIds.*').optional().isUUID(),
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
 * DELETE /api/v1/escalation-policies/:policyId/steps/:stepId
 * Delete an escalation step
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
 * PUT /api/v1/escalation-policies/:id/steps/reorder
 * Reorder escalation steps
 */
router.put(
  '/:id/steps/reorder',
  [
    param('id').isUUID(),
    body('stepIds').isArray({ min: 1 }),
    body('stepIds.*').isUUID(),
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
    steps: policy.steps?.map(formatStep) || [],
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
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
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
  };
}

export default router;
