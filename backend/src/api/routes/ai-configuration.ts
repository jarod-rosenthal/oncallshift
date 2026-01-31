import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { nlConfigurationService } from '../../shared/services/nl-configuration-service';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * POST /api/v1/ai/configure
 * Process a natural language configuration request and execute the changes
 *
 * @body {string} intent - Natural language description of what to configure
 *
 * @example
 * POST /api/v1/ai/configure
 * {
 *   "intent": "Create a platform team with alice@acme.com and bob@acme.com. Set up weekly on-call rotation."
 * }
 *
 * @returns {
 *   success: boolean,
 *   summary: string,
 *   results: Array<{
 *     operation: string,
 *     success: boolean,
 *     message: string,
 *     entityId?: string,
 *     entityType?: string,
 *     error?: string
 *   }>,
 *   warnings?: string[],
 *   error?: string
 * }
 */
router.post(
  '/configure',
  authenticateUser,
  [
    body('intent')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('intent is required and must be a non-empty string')
      .isLength({ max: 5000 })
      .withMessage('intent must be at most 5000 characters'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    const { intent } = req.body;

    // Check if user has permission to configure (admin or higher)
    const user = req.user!;
    if (!user.canCreateResources || (typeof user.canCreateResources === 'function' && !user.canCreateResources())) {
      // Fallback check using baseRole
      const baseRole = user.baseRole;
      if (baseRole !== 'owner' && baseRole !== 'admin' && baseRole !== 'manager') {
        res.status(403).json({
          error: 'Insufficient permissions. Only owners, admins, and managers can use AI configuration.',
        });
        return;
      }
    }

    logger.info('AI configuration request', { orgId, userId, intentLength: intent.length });

    try {
      const result = await nlConfigurationService.processIntent(orgId, intent, false);

      // Log the outcome
      logger.info('AI configuration completed', {
        orgId,
        userId,
        success: result.success,
        operationCount: result.results.length,
      });

      if (result.success) {
        res.json({
          success: true,
          summary: result.summary,
          results: result.results,
          warnings: result.warnings,
        });
      } else {
        res.status(400).json({
          success: false,
          summary: result.summary,
          results: result.results,
          warnings: result.warnings,
          error: result.error,
          rollbackPerformed: result.rollbackPerformed,
        });
      }
    } catch (error: any) {
      logger.error('AI configuration failed', {
        orgId,
        userId,
        error: error.message,
      });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/v1/ai/configure/preview
 * Preview a natural language configuration request without executing changes (dry-run)
 *
 * @body {string} intent - Natural language description of what to configure
 *
 * @example
 * POST /api/v1/ai/configure/preview
 * {
 *   "intent": "Create a platform team with alice@acme.com and bob@acme.com."
 * }
 *
 * @returns {
 *   success: boolean,
 *   summary: string,
 *   results: Array<{
 *     operation: string,
 *     success: boolean,
 *     message: string
 *   }>,
 *   warnings?: string[],
 *   error?: string
 * }
 */
router.post(
  '/configure/preview',
  authenticateUser,
  [
    body('intent')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('intent is required and must be a non-empty string')
      .isLength({ max: 5000 })
      .withMessage('intent must be at most 5000 characters'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const orgId = req.user!.orgId;
    const userId = req.user!.id;
    const { intent } = req.body;

    // Check if user has permission to configure (admin or higher)
    const user = req.user!;
    const baseRole = user.baseRole;
    if (baseRole !== 'owner' && baseRole !== 'admin' && baseRole !== 'manager') {
      res.status(403).json({
        error: 'Insufficient permissions. Only owners, admins, and managers can use AI configuration.',
      });
      return;
    }

    logger.info('AI configuration preview request', { orgId, userId, intentLength: intent.length });

    try {
      // Dry-run mode: validate and return plan without executing
      const result = await nlConfigurationService.processIntent(orgId, intent, true);

      logger.info('AI configuration preview completed', {
        orgId,
        userId,
        success: result.success,
        operationCount: result.results.length,
      });

      res.json({
        success: result.success,
        summary: result.summary,
        plan: result.results.map(r => ({
          operation: r.operation,
          description: r.message,
          willCreate: !r.message.includes('already exists'),
        })),
        warnings: result.warnings,
        error: result.error,
      });
    } catch (error: any) {
      logger.error('AI configuration preview failed', {
        orgId,
        userId,
        error: error.message,
      });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/v1/ai/configure/examples
 * Get example configuration requests to help users understand the capability
 */
router.get('/configure/examples', authenticateUser, (_req: Request, res: Response) => {
  res.json({
    examples: [
      {
        category: 'Team Setup',
        intent: 'Create a Platform Team with alice@acme.com and bob@acme.com. Alice should be team manager.',
        description: 'Creates a team and adds members with roles',
      },
      {
        category: 'On-Call Rotation',
        intent: 'Set up a weekly on-call schedule for Platform Team. Rotate between alice@acme.com and bob@acme.com every Monday at 9am.',
        description: 'Creates an on-call schedule with weekly rotation',
      },
      {
        category: 'Full Service Setup',
        intent: 'Set up incident management for the API service. The platform team (alice@acme.com, bob@acme.com) should handle it with 5-minute escalation timeouts.',
        description: 'Creates team, schedule, escalation policy, and service',
      },
      {
        category: 'Escalation Policy',
        intent: 'Create an escalation policy for critical alerts. First notify whoever is on-call, wait 5 minutes, then notify the whole team.',
        description: 'Creates a multi-step escalation policy',
      },
      {
        category: 'Quick On-Call Change',
        intent: 'Make bob@acme.com the on-call person for Platform Team On-Call schedule.',
        description: 'Updates who is currently on-call',
      },
      {
        category: 'Service Update',
        intent: 'Connect the Payment Service to the Platform Team and use their escalation policy.',
        description: 'Links an existing service to a team and escalation policy',
      },
    ],
  });
});

export default router;
