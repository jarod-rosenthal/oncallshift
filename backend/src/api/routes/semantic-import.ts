import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { createRateLimiter } from '../../shared/middleware/rate-limiter';
import { getDataSource } from '../../shared/db/data-source';
import {
  ImportHistory,
  ImportExtraction as ModelImportExtraction,
  ImportSourceType,
  ImportContentType,
  ImportExecutionResult as ModelImportExecutionResult,
} from '../../shared/models/ImportHistory';
import { visionImportService } from '../../shared/services/vision-import-service';
import {
  importExecutorService,
  ImportExtraction as ServiceImportExtraction,
  ImportExecutionResult as ServiceImportExecutionResult,
} from '../../shared/services/import-executor-service';
import { logger } from '../../shared/utils/logger';

/**
 * Convert model extraction to service extraction format
 */
function toServiceExtraction(extraction: ModelImportExtraction): ServiceImportExtraction {
  return {
    teams: extraction.teams?.map(t => ({
      name: t.name,
      members: t.members?.map(m => ({
        name: m.name,
        email: m.email,
        role: (m.role === 'manager' || m.role === 'member') ? m.role : 'member',
      })),
    })),
    schedules: extraction.schedules?.map(s => ({
      name: s.name,
      teamName: s.teamName,
      timezone: s.timezone,
      layers: s.layers?.map((l) => ({
        name: l.name,
        rotationType: (l.rotationType === 'daily' || l.rotationType === 'weekly' || l.rotationType === 'custom')
          ? l.rotationType : 'weekly',
        members: l.participants?.map((p, i) => ({
          name: p,
          position: i,
        })) || [],
      })),
    })),
    escalationPolicies: extraction.escalationPolicies?.map(p => ({
      name: p.name,
      steps: p.steps?.map((s, idx) => ({
        stepOrder: idx,
        timeoutMinutes: s.delayMinutes,
        targets: s.targets?.map(t => ({
          type: t.type,
          email: t.type === 'user' ? t.name : undefined,
          userName: t.type === 'user' ? t.name : undefined,
          scheduleName: t.type === 'schedule' ? t.name : undefined,
        })),
      })),
    })),
    services: extraction.services?.map(s => ({
      name: s.name,
      description: s.description,
      escalationPolicyName: s.escalationPolicyName,
      teamName: s.teamName,
    })),
    metadata: {
      warnings: extraction.warnings,
    },
  };
}

/**
 * Convert service execution result to model format
 */
function toModelExecutionResult(result: ServiceImportExecutionResult): ModelImportExecutionResult {
  return {
    success: result.success,
    createdResources: {
      teams: result.teams.created,
      users: result.users.created,
      schedules: result.schedules.created,
      escalationPolicies: result.escalationPolicies.created,
      services: result.services.created,
    },
    skippedResources: [
      ...result.teams.skipped.map(s => ({ type: 'team', name: s.name, reason: s.reason })),
      ...result.users.skipped.map(s => ({ type: 'user', name: s.email, reason: s.reason })),
      ...result.schedules.skipped.map(s => ({ type: 'schedule', name: s.name, reason: s.reason })),
      ...result.escalationPolicies.skipped.map(s => ({ type: 'escalation_policy', name: s.name, reason: s.reason })),
      ...result.services.skipped.map(s => ({ type: 'service', name: s.name, reason: s.reason })),
    ],
    failedResources: [
      ...result.teams.errors.map(e => ({ type: 'team', name: e.name, error: e.error })),
      ...result.users.errors.map(e => ({ type: 'user', name: e.email, error: e.error })),
      ...result.schedules.errors.map(e => ({ type: 'schedule', name: e.name, error: e.error })),
      ...result.escalationPolicies.errors.map(e => ({ type: 'escalation_policy', name: e.name, error: e.error })),
      ...result.services.errors.map(e => ({ type: 'service', name: e.name, error: e.error })),
    ],
    rollbackPerformed: result.rollbackPerformed || false,
  };
}

const router = Router();

// Valid content types for imports (matching ImportContentType from model)
const VALID_CONTENT_TYPES: ImportContentType[] = ['schedule', 'escalation', 'team', 'service', 'auto', 'mixed'];

// Valid image MIME types
const VALID_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Maximum image size in bytes (10MB)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * Rate limiter for analyze endpoint (expensive AI operation)
 * 10 requests per minute per user
 */
const analyzeRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyExtractor: (req: Request) => {
    // Use user ID if authenticated, fallback to IP
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `ip:${ip}`;
  },
});

/**
 * Validate base64 image data
 * Returns { valid: true, mimeType, size } or { valid: false, error }
 */
function validateBase64Image(base64Data: string): { valid: true; mimeType: string; size: number } | { valid: false; error: string } {
  // Check for data URL format: data:image/png;base64,xxxx
  const dataUrlMatch = base64Data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);

  let mimeType: string;
  let base64Content: string;

  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1];
    base64Content = dataUrlMatch[2];
  } else {
    // Assume raw base64 - try to detect type from magic bytes
    base64Content = base64Data;
    try {
      const buffer = Buffer.from(base64Content.substring(0, 16), 'base64');
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        mimeType = 'image/png';
      } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        mimeType = 'image/jpeg';
      } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
        mimeType = 'image/webp';
      } else {
        return { valid: false, error: 'Unable to detect image type. Please provide a PNG, JPEG, or WebP image.' };
      }
    } catch {
      return { valid: false, error: 'Invalid base64 data' };
    }
  }

  // Validate MIME type
  if (!VALID_IMAGE_TYPES.includes(mimeType)) {
    return { valid: false, error: `Invalid image type: ${mimeType}. Supported types: PNG, JPEG, WebP` };
  }

  // Calculate approximate decoded size
  const size = Math.ceil(base64Content.length * 0.75);
  if (size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Image too large: ${(size / 1024 / 1024).toFixed(2)}MB. Maximum size: 10MB` };
  }

  return { valid: true, mimeType, size };
}

/**
 * POST /api/v1/semantic-import/analyze
 * Analyze a screenshot and extract configuration data using Claude Vision
 */
router.post(
  '/analyze',
  authenticateUser,
  analyzeRateLimiter,
  [
    body('image')
      .isString()
      .notEmpty()
      .withMessage('image is required and must be a base64 encoded string'),
    body('sourceType')
      .optional()
      .isIn(['pagerduty', 'opsgenie'])
      .withMessage('sourceType must be one of: pagerduty, opsgenie'),
    body('contentType')
      .optional()
      .isIn(VALID_CONTENT_TYPES)
      .withMessage(`contentType must be one of: ${VALID_CONTENT_TYPES.join(', ')}`),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    const { image, sourceType, contentType } = req.body;

    // Validate image
    const imageValidation = validateBase64Image(image);
    if (!imageValidation.valid) {
      res.status(400).json({ success: false, error: imageValidation.error });
      return;
    }

    logger.info('Semantic import analysis started', {
      orgId,
      userId,
      sourceType,
      contentType,
      imageSize: imageValidation.size,
      imageMimeType: imageValidation.mimeType,
    });

    try {
      // Analyze the image using vision service
      const extraction = await visionImportService.analyzeScreenshot({
        image,
        mimeType: imageValidation.mimeType,
        sourceType: sourceType as 'pagerduty' | 'opsgenie' | undefined,
        contentType: contentType as ImportContentType | undefined,
        orgId,
      });

      // Create ImportHistory record
      const dataSource = await getDataSource();
      const historyRepo = dataSource.getRepository(ImportHistory);

      const history = historyRepo.create({
        orgId,
        userId,
        sourceType: 'screenshot' as ImportSourceType,
        contentType: contentType || 'auto',
        status: 'analyzing',
        inputData: {
          sourceType: 'screenshot' as ImportSourceType,
          contentType: contentType as ImportContentType | undefined,
          imageMetadata: {
            size: imageValidation.size,
            mimeType: imageValidation.mimeType,
          },
        },
        extractionResult: extraction,
      });

      // Update status to preview (analyzed and ready for preview/execution)
      history.status = 'preview';
      await historyRepo.save(history);

      logger.info('Semantic import analysis completed', {
        orgId,
        userId,
        importId: history.id,
        entitiesFound: {
          teams: extraction.teams?.length || 0,
          schedules: extraction.schedules?.length || 0,
          escalationPolicies: extraction.escalationPolicies?.length || 0,
          services: extraction.services?.length || 0,
        },
      });

      res.json({
        success: true,
        extraction,
        importId: history.id,
      });
    } catch (error: any) {
      logger.error('Semantic import analysis failed', {
        orgId,
        userId,
        error: error.message,
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to analyze screenshot',
      });
    }
  }
);

/**
 * POST /api/v1/semantic-import/preview
 * Preview what will be created from an extraction (dry-run)
 */
router.post(
  '/preview',
  authenticateUser,
  [
    body('importId')
      .optional()
      .isUUID()
      .withMessage('importId must be a valid UUID'),
    body('extraction')
      .optional()
      .isObject()
      .withMessage('extraction must be an object'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    const { importId, extraction: providedExtraction } = req.body;

    // Must provide either importId or extraction
    if (!importId && !providedExtraction) {
      res.status(400).json({
        success: false,
        error: 'Either importId or extraction must be provided',
      });
      return;
    }

    try {
      let extraction: ModelImportExtraction;
      let historyRecord: ImportHistory | null = null;

      if (importId) {
        // Load from history
        const dataSource = await getDataSource();
        const historyRepo = dataSource.getRepository(ImportHistory);

        historyRecord = await historyRepo.findOne({
          where: { id: importId, orgId },
        });

        if (!historyRecord) {
          res.status(404).json({ success: false, error: 'Import not found' });
          return;
        }

        if (!historyRecord.extractionResult) {
          res.status(400).json({ success: false, error: 'Import has no extraction data' });
          return;
        }

        extraction = historyRecord.extractionResult;
      } else {
        extraction = providedExtraction;
      }

      // Generate preview - convert model extraction to service format
      const serviceExtraction = toServiceExtraction(extraction);
      const preview = await importExecutorService.previewImport(serviceExtraction, orgId);

      logger.info('Semantic import preview completed', {
        orgId,
        userId,
        importId: historyRecord?.id,
        willCreate: preview.summary.totalToCreate,
        willUpdate: preview.summary.totalToUpdate,
        warnings: preview.warnings?.length || 0,
      });

      res.json({
        success: true,
        preview,
      });
    } catch (error: any) {
      logger.error('Semantic import preview failed', {
        orgId,
        userId,
        importId,
        error: error.message,
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate preview',
      });
    }
  }
);

/**
 * POST /api/v1/semantic-import/execute
 * Execute the import and create entities
 */
router.post(
  '/execute',
  authenticateUser,
  [
    body('importId')
      .isUUID()
      .withMessage('importId is required and must be a valid UUID'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    const { importId } = req.body;

    try {
      const dataSource = await getDataSource();
      const historyRepo = dataSource.getRepository(ImportHistory);

      const history = await historyRepo.findOne({
        where: { id: importId, orgId },
      });

      if (!history) {
        res.status(404).json({ success: false, error: 'Import not found' });
        return;
      }

      // Check if already executed
      if (history.isComplete()) {
        res.status(400).json({
          success: false,
          error: `Import has already been ${history.status}. Create a new import to retry.`,
        });
        return;
      }

      // Check if can be executed
      if (!history.canExecute()) {
        res.status(400).json({
          success: false,
          error: 'Import is not ready for execution. Must be in preview state with extraction data.',
        });
        return;
      }

      // Update status to executing
      history.status = 'executing';
      await historyRepo.save(history);

      const extraction = history.extractionResult!;

      // Execute the import - convert model extraction to service format
      const serviceExtraction = toServiceExtraction(extraction);
      const serviceResult = await importExecutorService.executeImport(serviceExtraction, orgId);

      // Convert service result to model format and update history
      const result = toModelExecutionResult(serviceResult);
      history.status = serviceResult.success ? 'completed' : 'failed';
      history.executionResult = result;
      history.completedAt = new Date();
      if (!serviceResult.success && serviceResult.error) {
        history.errorMessage = serviceResult.error;
      }
      await historyRepo.save(history);

      logger.info('Semantic import execution completed', {
        orgId,
        userId,
        importId,
        success: result.success,
        summary: history.getExecutionSummary(),
      });

      if (result.success) {
        res.json({
          success: true,
          result,
        });
      } else {
        res.status(400).json({
          success: false,
          result,
        });
      }
    } catch (error: any) {
      logger.error('Semantic import execution failed', {
        orgId,
        userId,
        importId,
        error: error.message,
      });

      // Update history with failure
      try {
        const dataSource = await getDataSource();
        const historyRepo = dataSource.getRepository(ImportHistory);
        await historyRepo.update(importId, {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error.message,
        });
      } catch (updateError) {
        logger.error('Failed to update import history', { error: updateError });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to execute import',
      });
    }
  }
);

/**
 * POST /api/v1/semantic-import/natural-language
 * Import configuration from a natural language description
 */
router.post(
  '/natural-language',
  authenticateUser,
  analyzeRateLimiter,
  [
    body('description')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('description is required and must be a non-empty string')
      .isLength({ max: 10000 })
      .withMessage('description must be at most 10000 characters'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    const { description } = req.body;

    logger.info('Natural language import started', {
      orgId,
      userId,
      descriptionLength: description.length,
    });

    try {
      // Parse the natural language description
      const extraction = await visionImportService.parseNaturalLanguage({
        description,
        orgId,
      });

      // Create ImportHistory record
      const dataSource = await getDataSource();
      const historyRepo = dataSource.getRepository(ImportHistory);

      const history = historyRepo.create({
        orgId,
        userId,
        sourceType: 'natural_language' as ImportSourceType,
        contentType: 'auto',
        status: 'preview',
        inputData: {
          sourceType: 'natural_language' as ImportSourceType,
          naturalLanguageInput: description,
        },
        extractionResult: extraction,
      });

      await historyRepo.save(history);

      logger.info('Natural language import analysis completed', {
        orgId,
        userId,
        importId: history.id,
        entitiesFound: {
          teams: extraction.teams?.length || 0,
          schedules: extraction.schedules?.length || 0,
          escalationPolicies: extraction.escalationPolicies?.length || 0,
          services: extraction.services?.length || 0,
        },
      });

      res.json({
        success: true,
        extraction,
        importId: history.id,
      });
    } catch (error: any) {
      logger.error('Natural language import failed', {
        orgId,
        userId,
        error: error.message,
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to parse description',
      });
    }
  }
);

/**
 * GET /api/v1/semantic-import/templates
 * Get example descriptions and templates for natural language import
 */
router.get('/templates', authenticateUser, (_req: Request, res: Response) => {
  res.json({
    templates: [
      {
        name: 'Team with On-Call Schedule',
        description: 'Create a team with members and a basic on-call rotation',
        example: 'Create a Platform Team with Alice (alice@example.com) as the manager and Bob (bob@example.com) as a member. Set up a weekly on-call rotation where Alice is on-call Mon-Wed and Bob is on-call Thu-Sun.',
      },
      {
        name: 'Service with Escalation Policy',
        description: 'Create a service with a multi-level escalation policy',
        example: 'Create an API Gateway service owned by the Platform Team. Set up an escalation policy that first notifies the on-call person, waits 5 minutes, then notifies the entire team, waits 10 more minutes, then notifies the manager.',
      },
      {
        name: 'Complete Service Setup',
        description: 'Set up a full service configuration from scratch',
        example: 'Set up incident management for our payment processing system. Create a Payments Team with John (john@example.com, team lead), Sarah (sarah@example.com), and Mike (mike@example.com). Set up a 24/7 on-call rotation that cycles weekly. Create an escalation policy: first notify on-call (wait 5 min), then notify entire team (wait 10 min), then page the team lead. Assign this to a new Payments API service.',
      },
      {
        name: 'PagerDuty Migration',
        description: 'Describe your existing PagerDuty setup to recreate it',
        example: 'We have a PagerDuty setup with: 1) Platform team with 4 engineers on weekly rotation, 2) 3-level escalation (on-call -> team -> manager) with 5 minute delays, 3) Two services: API and Database, both using the same escalation policy.',
      },
      {
        name: 'Multi-Team Setup',
        description: 'Create multiple teams with services',
        example: 'Create two teams: Frontend Team (Alice, Bob) and Backend Team (Carol, Dave). Each team should have their own weekly on-call schedule and a 2-level escalation policy. Frontend owns the Web App service, Backend owns the API and Database services.',
      },
    ],
  });
});

/**
 * GET /api/v1/semantic-import/history
 * Get import history for the organization
 */
router.get('/history', authenticateUser, async (req: Request, res: Response) => {
  const orgId = req.user!.orgId;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const dataSource = await getDataSource();
    const historyRepo = dataSource.getRepository(ImportHistory);

    const [imports, total] = await historyRepo.findAndCount({
      where: { orgId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['user'],
    });

    res.json({
      imports: imports.map(h => ({
        id: h.id,
        sourceType: h.sourceType,
        contentType: h.contentType,
        inputType: h.inputData?.sourceType || h.sourceType,
        status: h.status,
        createdAt: h.createdAt,
        completedAt: h.completedAt,
        createdBy: h.user ? {
          id: h.user.id,
          name: h.user.fullName,
          email: h.user.email,
        } : null,
        summary: h.getExtractionSummary(),
      })),
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    logger.error('Failed to fetch import history', {
      orgId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch import history',
    });
  }
});

/**
 * GET /api/v1/semantic-import/:importId
 * Get details of a specific import
 */
router.get(
  '/:importId',
  authenticateUser,
  [param('importId').isUUID().withMessage('Invalid import ID')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const orgId = req.user!.orgId;
    const { importId } = req.params;

    try {
      const dataSource = await getDataSource();
      const historyRepo = dataSource.getRepository(ImportHistory);

      const history = await historyRepo.findOne({
        where: { id: importId, orgId },
        relations: ['user'],
      });

      if (!history) {
        res.status(404).json({ success: false, error: 'Import not found' });
        return;
      }

      res.json({
        import: {
          id: history.id,
          sourceType: history.sourceType,
          contentType: history.contentType,
          inputType: history.inputData?.sourceType || history.sourceType,
          status: history.status,
          extraction: history.extractionResult,
          executionResult: history.executionResult,
          inputData: history.inputData,
          errorMessage: history.errorMessage,
          createdAt: history.createdAt,
          completedAt: history.completedAt,
          createdBy: history.user ? {
            id: history.user.id,
            name: history.user.fullName,
            email: history.user.email,
          } : null,
          summary: history.getExtractionSummary(),
          executionSummary: history.executionResult ? history.getExecutionSummary() : null,
        },
      });
    } catch (error: any) {
      logger.error('Failed to fetch import details', {
        orgId,
        importId,
        error: error.message,
      });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch import details',
      });
    }
  }
);

export default router;
