import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { RunbookExecutionService } from '../../shared/services/runbook-execution-service';
import { generateScriptFromNaturalLanguage, revalidateScript } from '../../shared/services/script-generation-service';
import { logger } from '../../shared/utils/logger';

const router = Router();
const executionService = new RunbookExecutionService();

/**
 * POST /runbooks/:runbookId/executions
 * Start a new runbook execution for an incident
 */
router.post(
  '/:runbookId/executions',
  authenticateUser,
  [
    param('runbookId').isUUID().withMessage('Invalid runbook ID'),
    body('incident_id').isUUID().withMessage('incident_id is required and must be UUID'),
    body('credential_ids').optional().isArray().withMessage('credential_ids must be an array'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { runbookId } = req.params;
    const { incident_id, credential_ids } = req.body;
    const userId = req.user!.id;
    const orgId = req.user!.orgId;

    try {
      const execution = await executionService.startExecution({
        runbookId,
        incidentId: incident_id,
        userId,
        orgId,
        credentialIds: credential_ids,
      });

      res.status(201).json({
        execution: {
          id: execution.id,
          runbook_id: execution.runbookId,
          incident_id: execution.incidentId,
          status: execution.status,
          current_step_index: execution.currentStepIndex,
          started_at: execution.startedAt,
          started_by: {
            id: userId,
          },
        },
      });
    } catch (error: any) {
      logger.error('Failed to start runbook execution', {
        error: error.message,
        runbookId,
        incidentId: incident_id,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /runbooks/executions/:executionId/steps/:stepIndex/execute
 * Execute a specific step in a runbook execution
 */
router.post(
  '/executions/:executionId/steps/:stepIndex/execute',
  authenticateUser,
  [
    param('executionId').isUUID().withMessage('Invalid execution ID'),
    param('stepIndex').isInt({ min: 0 }).withMessage('Invalid step index'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { executionId, stepIndex } = req.params;
    const { approved } = req.body || {};
    const orgId = req.user!.orgId;

    try {
      const result = await executionService.executeStep({
        executionId,
        stepIndex: parseInt(stepIndex, 10),
        orgId,
        approved: approved === true,
      });

      res.json({
        step_result: {
          step_id: result.stepId,
          step_index: result.stepIndex,
          status: result.status,
          output: result.output,
          error: result.error,
          exit_code: result.exitCode,
          started_at: result.startedAt,
          completed_at: result.completedAt,
          duration_ms: result.durationMs,
        },
      });
    } catch (error: any) {
      logger.error('Failed to execute runbook step', {
        error: error.message,
        executionId,
        stepIndex,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /runbooks/executions/:executionId
 * Get execution status and details
 */
router.get(
  '/executions/:executionId',
  authenticateUser,
  [param('executionId').isUUID().withMessage('Invalid execution ID')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { executionId } = req.params;
    const orgId = req.user!.orgId;

    try {
      const execution = await executionService.getExecution(executionId, orgId);

      if (!execution) {
        res.status(404).json({ error: 'Execution not found' });
        return;
      }

      res.json({
        execution: {
          id: execution.id,
          runbook_id: execution.runbookId,
          incident_id: execution.incidentId,
          status: execution.status,
          current_step_index: execution.currentStepIndex,
          started_at: execution.startedAt,
          completed_at: execution.completedAt,
          duration_ms: execution.getDurationMs(),
          step_results: execution.stepResults,
          error_message: execution.errorMessage,
          started_by: execution.startedBy
            ? {
                id: execution.startedBy.id,
                name: execution.startedBy.fullName,
                email: execution.startedBy.email,
              }
            : null,
          runbook: execution.runbook
            ? {
                id: execution.runbook.id,
                title: execution.runbook.title,
              }
            : null,
          incident: execution.incident
            ? {
                id: execution.incident.id,
                number: execution.incident.incidentNumber,
                summary: execution.incident.summary,
              }
            : null,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get execution', {
        error: error.message,
        executionId,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /runbooks/executions/incident/:incidentId
 * List all executions for an incident
 */
router.get(
  '/executions/incident/:incidentId',
  authenticateUser,
  [param('incidentId').isUUID().withMessage('Invalid incident ID')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { incidentId } = req.params;
    const orgId = req.user!.orgId;

    try {
      const executions = await executionService.listExecutionsForIncident(incidentId, orgId);

      res.json({
        executions: executions.map(exec => ({
          id: exec.id,
          runbook_id: exec.runbookId,
          status: exec.status,
          current_step_index: exec.currentStepIndex,
          started_at: exec.startedAt,
          completed_at: exec.completedAt,
          duration_ms: exec.getDurationMs(),
          started_by: exec.startedBy
            ? {
                id: exec.startedBy.id,
                name: exec.startedBy.fullName,
              }
            : null,
          runbook: exec.runbook
            ? {
                id: exec.runbook.id,
                title: exec.runbook.title,
              }
            : null,
        })),
      });
    } catch (error: any) {
      logger.error('Failed to list executions', {
        error: error.message,
        incidentId,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /runbooks/executions/:executionId/cancel
 * Cancel a running execution
 */
router.post(
  '/executions/:executionId/cancel',
  authenticateUser,
  [param('executionId').isUUID().withMessage('Invalid execution ID')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { executionId } = req.params;
    const orgId = req.user!.orgId;

    try {
      await executionService.completeExecution(
        executionId,
        orgId,
        'cancelled',
        'Execution cancelled by user'
      );

      res.json({ message: 'Execution cancelled successfully' });
    } catch (error: any) {
      logger.error('Failed to cancel execution', {
        error: error.message,
        executionId,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /runbooks/executions/approvals/:approvalId/approve
 * Approve a pending step execution
 */
router.post(
  '/executions/approvals/:approvalId/approve',
  authenticateUser,
  [
    param('approvalId').isUUID().withMessage('Invalid approval ID'),
    body('notes').optional().isString().withMessage('notes must be a string'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { approvalId } = req.params;
    const { notes } = req.body;
    const userId = req.user!.id;

    try {
      await executionService.handleApprovalDecision({
        approvalId,
        userId,
        decision: 'approved',
        notes,
      });

      res.json({ message: 'Step approved successfully' });
    } catch (error: any) {
      logger.error('Failed to approve step', {
        error: error.message,
        approvalId,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /runbooks/executions/approvals/:approvalId/reject
 * Reject a pending step execution
 */
router.post(
  '/executions/approvals/:approvalId/reject',
  authenticateUser,
  [
    param('approvalId').isUUID().withMessage('Invalid approval ID'),
    body('notes').optional().isString().withMessage('notes must be a string'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { approvalId } = req.params;
    const { notes } = req.body;
    const userId = req.user!.id;

    try {
      await executionService.handleApprovalDecision({
        approvalId,
        userId,
        decision: 'rejected',
        notes,
      });

      res.json({ message: 'Step rejected successfully' });
    } catch (error: any) {
      logger.error('Failed to reject step', {
        error: error.message,
        approvalId,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /runbooks/generate-script
 * Generate a script from natural language description using Claude
 */
router.post(
  '/generate-script',
  authenticateUser,
  [
    body('description').isString().notEmpty().withMessage('description is required'),
    body('language').isIn(['bash', 'python', 'javascript']).withMessage('Invalid language'),
    body('context').optional().isObject().withMessage('context must be an object'),
    body('constraints').optional().isObject().withMessage('constraints must be an object'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { description, language, context, constraints } = req.body;
    const orgId = req.user!.orgId;

    try {
      const result = await generateScriptFromNaturalLanguage(
        {
          description,
          language,
          context,
          constraints,
        },
        orgId
      );

      if (result.success && result.script) {
        res.json({
          script: {
            code: result.script.code,
            language: result.script.language,
            explanation: result.script.explanation,
            warnings: result.script.warnings,
            estimated_duration: result.script.estimatedDuration,
          },
        });
      } else {
        res.status(400).json({
          error: result.error || 'Script generation failed',
          validation_errors: result.validationErrors,
        });
      }
    } catch (error: any) {
      logger.error('Failed to generate script', {
        error: error.message,
        description,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /runbooks/revalidate-script
 * Revalidate a script in the context of a specific incident
 */
router.post(
  '/revalidate-script',
  authenticateUser,
  [
    body('script').isObject().withMessage('script is required'),
    body('script.code').isString().notEmpty().withMessage('script.code is required'),
    body('script.language').isIn(['bash', 'python', 'javascript']).withMessage('Invalid script.language'),
    body('script.description').isString().notEmpty().withMessage('script.description is required'),
    body('incident').isObject().withMessage('incident is required'),
    body('incident.id').isUUID().withMessage('incident.id must be UUID'),
    body('incident.summary').isString().notEmpty().withMessage('incident.summary is required'),
    body('incident.severity').isString().notEmpty().withMessage('incident.severity is required'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { script, incident, previousVersion } = req.body;
    const orgId = req.user!.orgId;

    try {
      const result = await revalidateScript(
        {
          script,
          incident,
          previousVersion,
        },
        orgId
      );

      res.json({
        needs_update: result.needsUpdate,
        updated_script: result.updatedScript
          ? {
              code: result.updatedScript.code,
              changes: result.updatedScript.changes,
              reason: result.updatedScript.reason,
            }
          : undefined,
        safe_to_execute: result.safeToExecute,
        warnings: result.warnings,
      });
    } catch (error: any) {
      logger.error('Failed to revalidate script', {
        error: error.message,
        incidentId: incident.id,
      });
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
