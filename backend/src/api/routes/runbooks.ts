import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateRequest } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Runbook, Service, StepType, AutomationMode, ScriptLanguage } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { In } from 'typeorm';
import { setLocationHeader } from '../../shared/utils/location-header';
import { parsePaginationParams, paginatedResponse, validateSortField } from '../../shared/utils/pagination';
import { paginationValidators } from '../../shared/validators/pagination';

const router = Router();

// All routes require authentication (supports JWT, service API key, and org API key)
router.use(authenticateRequest);

/**
 * GET /api/v1/runbooks
 * Get all runbooks for the organization
 */
router.get('/', [...paginationValidators], async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const pagination = parsePaginationParams(req.query);
    const sortField = validateSortField('runbooks', pagination.sort, 'createdAt');
    const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';

    const dataSource = await getDataSource();
    const runbookRepo = dataSource.getRepository(Runbook);

    const [runbooks, total] = await runbookRepo.findAndCount({
      where: { orgId, isActive: true },
      relations: ['service', 'createdBy'],
      order: { [sortField]: sortOrder },
      skip: pagination.offset,
      take: pagination.limit,
    });

    const lastItem = runbooks[runbooks.length - 1];
    return res.json(paginatedResponse(
      runbooks.map(formatRunbook),
      total,
      pagination,
      lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
      'runbooks'
    ));
  } catch (error) {
    logger.error('Error fetching runbooks:', error);
    return res.status(500).json({ error: 'Failed to fetch runbooks' });
  }
});

/**
 * GET /api/v1/services/:serviceId/runbooks
 * Get runbooks for a specific service
 */
router.get('/service/:serviceId', [...paginationValidators], async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const orgId = req.orgId!;
    const pagination = parsePaginationParams(req.query);
    const sortField = validateSortField('runbooks', pagination.sort, 'createdAt');
    const sortOrder = pagination.order === 'asc' ? 'ASC' : 'DESC';

    const dataSource = await getDataSource();
    const runbookRepo = dataSource.getRepository(Runbook);
    const serviceRepo = dataSource.getRepository(Service);

    // Verify service exists and belongs to org
    const service = await serviceRepo.findOne({
      where: { id: serviceId, orgId },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const [runbooks, total] = await runbookRepo.findAndCount({
      where: { serviceId, orgId, isActive: true },
      relations: ['service', 'createdBy'],
      order: { [sortField]: sortOrder },
      skip: pagination.offset,
      take: pagination.limit,
    });

    const lastItem = runbooks[runbooks.length - 1];
    return res.json(paginatedResponse(
      runbooks.map(formatRunbook),
      total,
      pagination,
      lastItem ? { id: lastItem.id, createdAt: lastItem.createdAt } : undefined,
      'runbooks'
    ));
  } catch (error) {
    logger.error('Error fetching runbooks for service:', error);
    return res.status(500).json({ error: 'Failed to fetch runbooks' });
  }
});

/**
 * GET /api/v1/runbooks/:id
 * Get a single runbook by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const runbookRepo = dataSource.getRepository(Runbook);

    const runbook = await runbookRepo.findOne({
      where: { id, orgId },
      relations: ['service', 'createdBy'],
    });

    if (!runbook) {
      return res.status(404).json({ error: 'Runbook not found' });
    }

    return res.json({ runbook: formatRunbook(runbook) });
  } catch (error) {
    logger.error('Error fetching runbook:', error);
    return res.status(500).json({ error: 'Failed to fetch runbook' });
  }
});

/**
 * POST /api/v1/runbooks
 * Create a new runbook (admin only)
 */
router.post(
  '/',
  [
    body('serviceId').isUUID().withMessage('Valid service ID is required'),
    body('title').isString().trim().notEmpty().withMessage('Title is required'),
    body('description').optional().isString(),
    body('steps').isArray().withMessage('Steps must be an array'),
    body('steps.*.id').isString().notEmpty(),
    body('steps.*.order').isInt({ min: 0 }),
    body('steps.*.title').isString().notEmpty(),
    body('steps.*.description').isString(),
    body('steps.*.isOptional').isBoolean(),
    body('steps.*.estimatedMinutes').optional().isInt({ min: 0 }),
    body('severity').optional().isArray(),
    body('tags').optional().isArray(),
    body('externalUrl').optional().isURL().withMessage('External URL must be a valid URL'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Only admins can create runbooks
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const { serviceId, title, description, steps, severity, tags, externalUrl } = req.body;

      const dataSource = await getDataSource();
      const runbookRepo = dataSource.getRepository(Runbook);
      const serviceRepo = dataSource.getRepository(Service);

      // Verify service exists and belongs to org
      const service = await serviceRepo.findOne({
        where: { id: serviceId, orgId },
      });

      if (!service) {
        return res.status(400).json({ error: 'Service not found or does not belong to your organization' });
      }

      const runbook = runbookRepo.create({
        orgId,
        serviceId,
        title,
        description: description || null,
        steps: steps || [],
        severity: severity || [],
        tags: tags || [],
        externalUrl: externalUrl || null,
        createdById: userId,
        isActive: true,
      });

      await runbookRepo.save(runbook);

      // Fetch with relations
      const createdRunbook = await runbookRepo.findOne({
        where: { id: runbook.id },
        relations: ['service', 'createdBy'],
      });

      logger.info('Runbook created', { runbookId: runbook.id, serviceId, orgId, createdBy: userId });

      setLocationHeader(res, req, '/api/v1/runbooks', runbook.id);
      return res.status(201).json({
        runbook: formatRunbook(createdRunbook!),
        message: 'Runbook created successfully',
      });
    } catch (error) {
      logger.error('Error creating runbook:', error);
      return res.status(500).json({ error: 'Failed to create runbook' });
    }
  }
);

/**
 * PUT /api/v1/runbooks/:id
 * Update a runbook (admin only)
 */
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('title').optional().isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('steps').optional().isArray(),
    body('severity').optional().isArray(),
    body('tags').optional().isArray(),
    body('externalUrl').optional({ nullable: true }).custom((value) => {
      if (value === null || value === '') return true;
      // Basic URL validation
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('External URL must be a valid URL');
      }
    }),
  ],
  async (req: Request, res: Response) => {
    try {
      // Only admins can update runbooks
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { title, description, steps, severity, tags, externalUrl } = req.body;

      const dataSource = await getDataSource();
      const runbookRepo = dataSource.getRepository(Runbook);

      const runbook = await runbookRepo.findOne({
        where: { id, orgId },
      });

      if (!runbook) {
        return res.status(404).json({ error: 'Runbook not found' });
      }

      // Update fields
      if (title !== undefined) runbook.title = title;
      if (description !== undefined) runbook.description = description || null;
      if (steps !== undefined) runbook.steps = steps;
      if (severity !== undefined) runbook.severity = severity;
      if (tags !== undefined) runbook.tags = tags;
      if (externalUrl !== undefined) runbook.externalUrl = externalUrl || null;

      await runbookRepo.save(runbook);

      // Fetch with relations
      const updatedRunbook = await runbookRepo.findOne({
        where: { id },
        relations: ['service', 'createdBy'],
      });

      logger.info('Runbook updated', { runbookId: id, orgId, updatedBy: req.user!.id });

      return res.json({
        runbook: formatRunbook(updatedRunbook!),
        message: 'Runbook updated successfully',
      });
    } catch (error) {
      logger.error('Error updating runbook:', error);
      return res.status(500).json({ error: 'Failed to update runbook' });
    }
  }
);

/**
 * DELETE /api/v1/runbooks/:id
 * Soft delete a runbook (admin only)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Only admins can delete runbooks
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const runbookRepo = dataSource.getRepository(Runbook);

    const runbook = await runbookRepo.findOne({
      where: { id, orgId },
    });

    if (!runbook) {
      return res.status(404).json({ error: 'Runbook not found' });
    }

    // Soft delete
    runbook.isActive = false;
    await runbookRepo.save(runbook);

    logger.info('Runbook deleted (soft)', { runbookId: id, orgId, deletedBy: req.user!.id });

    return res.json({ message: 'Runbook deleted successfully' });
  } catch (error) {
    logger.error('Error deleting runbook:', error);
    return res.status(500).json({ error: 'Failed to delete runbook' });
  }
});

/**
 * POST /api/v1/runbooks/seed-examples
 * Seed example automated runbooks for the current org (admin only)
 */
router.post('/seed-examples', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const userId = req.user!.id;
    const dataSource = await getDataSource();
    const runbookRepo = dataSource.getRepository(Runbook);
    const serviceRepo = dataSource.getRepository(Service);

    // Check admin role
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get existing services
    const services = await serviceRepo.find({ where: { orgId, status: 'active' } });
    if (services.length === 0) {
      return res.status(400).json({ error: 'No active services found. Create a service first.' });
    }

    // Delete existing example runbooks
    await runbookRepo.delete({
      orgId,
      title: In([
        'Restart API Service',
        'Scale API Service Up',
        'Rollback API Deployment',
        'Reset Database Connections',
        'Kill Slow Queries',
        'Clear SQS Queue Backlog',
        'Invalidate CloudFront Cache',
      ]),
    });

    const primaryService = services[0];

    // Create example runbooks with AUTOMATED steps
    const exampleRunbooks = [
      {
        title: 'Restart API Service',
        description: 'Force a new ECS deployment to restart all API tasks. Use for stuck connections, memory leaks, or configuration updates.',
        severity: ['high', 'critical'],
        tags: ['api', 'ecs', 'restart'],
        steps: [
          {
            id: 'step-1',
            order: 1,
            title: 'Check Current Service State',
            description: 'Verify the current health of the ECS service before restarting',
            isOptional: false,
            estimatedMinutes: 1,
            type: 'automated' as StepType,
            automation: {
              mode: 'server_sandbox' as AutomationMode,
              timeout: 30,
              requiresApproval: false,
              script: {
                language: 'bash' as ScriptLanguage,
                code: `#!/bin/bash
set -e
CLUSTER="your-cluster-name"
SERVICE="your-cluster-name-api"
echo "Checking ECS service status..."
aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --region us-east-1 --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}' --output table`,
                version: 1,
              },
            },
          },
          {
            id: 'step-2',
            order: 2,
            title: 'Force New Deployment',
            description: 'Restart all tasks by forcing a new deployment',
            isOptional: false,
            estimatedMinutes: 2,
            type: 'automated' as StepType,
            automation: {
              mode: 'server_sandbox' as AutomationMode,
              timeout: 60,
              requiresApproval: true,
              script: {
                language: 'bash' as ScriptLanguage,
                code: `#!/bin/bash
set -e
CLUSTER="your-cluster-name"
SERVICE="your-cluster-name-api"
echo "Forcing new deployment..."
aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment --region us-east-1 --output json | jq '.service | {status, runningCount, desiredCount}'
echo "New deployment initiated. Tasks will restart in ~2 minutes."`,
                version: 1,
              },
            },
          },
        ],
      },
      {
        title: 'Scale API Service Up',
        description: 'Increase the number of API tasks to handle higher load or traffic spikes.',
        severity: ['high', 'critical'],
        tags: ['api', 'ecs', 'scaling'],
        steps: [
          {
            id: 'step-1',
            order: 1,
            title: 'Check Current Capacity',
            description: 'View current task count',
            isOptional: false,
            estimatedMinutes: 1,
            type: 'automated' as StepType,
            automation: {
              mode: 'server_sandbox' as AutomationMode,
              timeout: 30,
              requiresApproval: false,
              script: {
                language: 'bash' as ScriptLanguage,
                code: `#!/bin/bash
aws ecs describe-services --cluster your-cluster-name --services your-cluster-name-api --region us-east-1 --query 'services[0].{Desired:desiredCount,Running:runningCount,Pending:pendingCount}' --output table`,
                version: 1,
              },
            },
          },
          {
            id: 'step-2',
            order: 2,
            title: 'Scale to +1 Tasks',
            description: 'Increase desired task count by 1',
            isOptional: false,
            estimatedMinutes: 2,
            type: 'automated' as StepType,
            automation: {
              mode: 'server_sandbox' as AutomationMode,
              timeout: 60,
              requiresApproval: true,
              script: {
                language: 'bash' as ScriptLanguage,
                code: `#!/bin/bash
set -e
CURRENT=$(aws ecs describe-services --cluster your-cluster-name --services your-cluster-name-api --query 'services[0].desiredCount' --output text)
NEW_COUNT=$((CURRENT + 1))
echo "Scaling from $CURRENT to $NEW_COUNT tasks..."
aws ecs update-service --cluster your-cluster-name --service your-cluster-name-api --desired-count "$NEW_COUNT" --region us-east-1 --output json | jq '.service.desiredCount'
echo "Service scaled successfully!"`,
                version: 1,
              },
            },
          },
        ],
      },
      {
        title: 'Invalidate CloudFront Cache',
        description: 'Clear the CloudFront CDN cache to force users to get the latest frontend assets.',
        severity: ['medium', 'high'],
        tags: ['cloudfront', 'cache', 'frontend'],
        steps: [
          {
            id: 'step-1',
            order: 1,
            title: 'Create Cache Invalidation',
            description: 'Invalidate all paths (/*) in the CloudFront distribution',
            isOptional: false,
            estimatedMinutes: 1,
            type: 'automated' as StepType,
            automation: {
              mode: 'server_sandbox' as AutomationMode,
              timeout: 30,
              requiresApproval: false,
              script: {
                language: 'bash' as ScriptLanguage,
                code: `#!/bin/bash
set -e
DISTRIBUTION_ID="REDACTED_CLOUDFRONT_DIST_ID"
echo "Creating CloudFront invalidation..."
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" --region us-east-1 --output json | jq '.Invalidation | {Id, Status, CreateTime}'
echo "Cache invalidation created! Users will get fresh content in 1-2 minutes."`,
                version: 1,
              },
            },
          },
        ],
      },
    ];

    // Save runbooks
    const savedRunbooks: Runbook[] = [];
    for (const rb of exampleRunbooks) {
      const runbook = runbookRepo.create({
        orgId,
        serviceId: primaryService.id,
        createdById: userId,
        title: rb.title,
        description: rb.description,
        severity: rb.severity,
        tags: rb.tags,
        isActive: true,
        steps: rb.steps,
      });
      savedRunbooks.push(await runbookRepo.save(runbook));
    }

    logger.info('Example runbooks seeded', { orgId, count: savedRunbooks.length, userId });

    return res.json({
      message: `Created ${savedRunbooks.length} example runbooks with automated steps`,
      runbooks: savedRunbooks.map(formatRunbook),
    });
  } catch (error) {
    logger.error('Error seeding example runbooks:', error);
    return res.status(500).json({ error: 'Failed to seed example runbooks' });
  }
});

/**
 * Format runbook for API response
 */
function formatRunbook(runbook: Runbook) {
  return {
    id: runbook.id,
    serviceId: runbook.serviceId,
    service: runbook.service ? {
      id: runbook.service.id,
      name: runbook.service.name,
    } : null,
    title: runbook.title,
    description: runbook.description,
    steps: runbook.steps,
    severity: runbook.severity,
    tags: runbook.tags,
    externalUrl: runbook.externalUrl,
    createdBy: runbook.createdBy ? {
      id: runbook.createdBy.id,
      fullName: runbook.createdBy.fullName,
      email: runbook.createdBy.email,
    } : null,
    isActive: runbook.isActive,
    createdAt: runbook.createdAt,
    updatedAt: runbook.updatedAt,
  };
}

export default router;
