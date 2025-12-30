import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Incident, IncidentEvent } from '../../shared/models';
import { getIncidentRelatedLogs, getECSServiceLogs, LogEntry } from '../../shared/services/cloudwatch-service';
import { analyzeIncident, streamAnalyzeIncident, DiagnosisResult } from '../../shared/services/claude-service';
import { getUserAnthropicCredential } from './users';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * @swagger
 * /api/v1/incidents/{id}/diagnose:
 *   post:
 *     summary: AI-powered incident diagnosis
 *     description: Uses Claude AI to analyze the incident and related logs, providing root cause analysis and suggested remediation actions
 *     tags: [AI Diagnosis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Incident ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lookbackMinutes:
 *                 type: integer
 *                 default: 60
 *                 description: How far back to fetch logs (in minutes)
 *               includeAllServices:
 *                 type: boolean
 *                 default: false
 *                 description: Include logs from all services, not just the affected one
 *     responses:
 *       200:
 *         description: Diagnosis result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 diagnosis:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: string
 *                     rootCause:
 *                       type: string
 *                     affectedComponents:
 *                       type: array
 *                       items:
 *                         type: string
 *                     suggestedActions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           command:
 *                             type: string
 *                           risk:
 *                             type: string
 *                             enum: [low, medium, high]
 *                           automated:
 *                             type: boolean
 *                     confidence:
 *                       type: string
 *                       enum: [high, medium, low]
 *                 logsAnalyzed:
 *                   type: integer
 *                 analysisTime:
 *                   type: number
 *       404:
 *         description: Incident not found
 *       500:
 *         description: Server error or AI service unavailable
 */
router.post(
  '/:id/diagnose',
  [
    body('lookbackMinutes').optional().isInt({ min: 5, max: 1440 }).toInt(),
    body('includeAllServices').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { lookbackMinutes = 60, includeAllServices = false } = req.body;
      const orgId = req.orgId!;
      const user = req.user!;

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);
      const eventRepo = dataSource.getRepository(IncidentEvent);

      // Fetch incident with service
      const incident = await incidentRepo.findOne({
        where: { id, orgId },
        relations: ['service'],
      });

      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Fetch user's Anthropic credential (if configured)
      const userCredential = await getUserAnthropicCredential(user.id);

      logger.info('Starting AI diagnosis', {
        incidentId: id,
        incidentNumber: incident.incidentNumber,
        userId: user.id,
        lookbackMinutes,
        hasUserCredential: !!userCredential,
      });

      // Fetch logs from CloudWatch
      let logs: LogEntry[] = [];
      try {
        if (includeAllServices) {
          logs = await getIncidentRelatedLogs(
            incident.incidentNumber,
            undefined,
            lookbackMinutes
          );
        } else {
          // Map service name to log group
          const serviceName = mapServiceToLogGroup(incident.service.name);
          logs = await getECSServiceLogs(serviceName, lookbackMinutes);
        }
      } catch (logError) {
        logger.warn('Failed to fetch logs, proceeding without them', { error: logError });
        logs = [];
      }

      // Build incident context
      const incidentContext = {
        incidentNumber: incident.incidentNumber,
        summary: incident.summary,
        details: incident.details || undefined,
        severity: incident.severity,
        serviceName: incident.service.name,
        triggeredAt: incident.triggeredAt,
        state: incident.state,
        eventCount: incident.eventCount,
      };

      // Call Claude for analysis
      let diagnosis: DiagnosisResult;
      try {
        diagnosis = await analyzeIncident(incidentContext, logs, {
          userCredential: userCredential || undefined,
        });
      } catch (aiError: any) {
        logger.error('AI analysis failed:', aiError);

        if (aiError.message?.includes('No Anthropic credentials available')) {
          return res.status(503).json({
            error: 'AI service not configured',
            message: 'No API key configured. Set up your Anthropic credentials in Settings > AI Diagnosis.',
            requiresCredentials: true,
          });
        }

        if (aiError.message?.includes('ANTHROPIC_API_KEY')) {
          return res.status(503).json({
            error: 'AI service not configured',
            message: 'No API key configured. Set up your Anthropic credentials in Settings > AI Diagnosis.',
            requiresCredentials: true,
          });
        }

        return res.status(500).json({
          error: 'AI analysis failed',
          message: aiError.message || 'Unknown error during analysis',
        });
      }

      // Record the diagnosis as an incident event
      const event = eventRepo.create({
        incidentId: incident.id,
        type: 'ai_diagnosis',
        actorId: user.id,
        message: `AI diagnosis completed: ${diagnosis.summary}`,
        payload: {
          diagnosis,
          logsAnalyzed: logs.length,
          lookbackMinutes,
        },
      });
      await eventRepo.save(event);

      const analysisTime = (Date.now() - startTime) / 1000;

      logger.info('AI diagnosis completed', {
        incidentId: id,
        incidentNumber: incident.incidentNumber,
        confidence: diagnosis.confidence,
        actionCount: diagnosis.suggestedActions.length,
        logsAnalyzed: logs.length,
        analysisTime,
      });

      return res.json({
        diagnosis,
        logsAnalyzed: logs.length,
        analysisTime,
      });
    } catch (error) {
      logger.error('Error in AI diagnosis:', error);
      return res.status(500).json({ error: 'Failed to perform AI diagnosis' });
    }
  }
);

/**
 * @swagger
 * /api/v1/incidents/{id}/diagnose/stream:
 *   get:
 *     summary: Stream AI diagnosis (Server-Sent Events)
 *     description: Streams the AI analysis in real-time using Server-Sent Events
 *     tags: [AI Diagnosis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: lookbackMinutes
 *         schema:
 *           type: integer
 *           default: 60
 *     responses:
 *       200:
 *         description: Server-Sent Events stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
router.get(
  '/:id/diagnose/stream',
  [query('lookbackMinutes').optional().isInt({ min: 5, max: 1440 }).toInt()],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const lookbackMinutes = parseInt(req.query.lookbackMinutes as string) || 60;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const incidentRepo = dataSource.getRepository(Incident);

      const incident = await incidentRepo.findOne({
        where: { id, orgId },
        relations: ['service'],
      });

      if (!incident) {
        res.status(404).json({ error: 'Incident not found' });
        return;
      }

      // Fetch user's Anthropic credential (if configured)
      const user = req.user!;
      const userCredential = await getUserAnthropicCredential(user.id);

      // Check if we have any credentials before setting up SSE
      if (!userCredential && !process.env.ANTHROPIC_API_KEY) {
        res.status(503).json({
          error: 'AI service not configured',
          message: 'No API key configured. Set up your Anthropic credentials in Settings > AI Diagnosis.',
          requiresCredentials: true,
        });
        return;
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Fetch logs
      let logs: LogEntry[] = [];
      try {
        const serviceName = mapServiceToLogGroup(incident.service.name);
        logs = await getECSServiceLogs(serviceName, lookbackMinutes);
      } catch {
        logs = [];
      }

      // Send initial event
      res.write(`event: start\ndata: ${JSON.stringify({ status: 'analyzing', logsFound: logs.length })}\n\n`);

      const incidentContext = {
        incidentNumber: incident.incidentNumber,
        summary: incident.summary,
        details: incident.details || undefined,
        severity: incident.severity,
        serviceName: incident.service.name,
        triggeredAt: incident.triggeredAt,
        state: incident.state,
        eventCount: incident.eventCount,
      };

      try {
        const stream = streamAnalyzeIncident(incidentContext, logs, {
          userCredential: userCredential || undefined,
        });
        let result: DiagnosisResult | undefined;

        for await (const chunk of stream) {
          if (typeof chunk === 'string') {
            res.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
          } else {
            result = chunk;
          }
        }

        if (result) {
          res.write(`event: complete\ndata: ${JSON.stringify({ diagnosis: result })}\n\n`);
        }
      } catch (error: any) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      }

      res.write('event: done\ndata: {}\n\n');
      res.end();
    } catch (error) {
      logger.error('Error in streaming diagnosis:', error);
      res.status(500).json({ error: 'Failed to stream diagnosis' });
    }
  }
);

/**
 * @swagger
 * /api/v1/incidents/{id}/actions/{actionIndex}/execute:
 *   post:
 *     summary: Execute a suggested action (placeholder)
 *     description: Execute an automated action suggested by AI diagnosis
 *     tags: [AI Diagnosis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: actionIndex
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       501:
 *         description: Not implemented - requires user approval workflow
 */
router.post('/:id/actions/:actionIndex/execute', async (_req: Request, res: Response) => {
  // This is a placeholder for future automated action execution
  // In production, this would require:
  // 1. User approval workflow
  // 2. AWS permissions to execute commands
  // 3. Audit logging
  // 4. Rollback capability

  return res.status(501).json({
    error: 'Not implemented',
    message: 'Automated action execution requires approval workflow. This will be implemented in a future release.',
    suggestion: 'For now, please manually execute the suggested commands after reviewing them.',
  });
});

/**
 * Map service name to CloudWatch log group name
 */
function mapServiceToLogGroup(serviceName: string): string {
  // Common mappings - adjust based on actual service names in the database
  const mappings: Record<string, string> = {
    'API': 'api',
    'Alert Processor': 'alert-processor',
    'Notification Worker': 'notification-worker',
    'Web API': 'api',
    'Backend': 'api',
  };

  // Try exact match first
  if (mappings[serviceName]) {
    return mappings[serviceName];
  }

  // Try case-insensitive match
  const lowerName = serviceName.toLowerCase();
  for (const [key, value] of Object.entries(mappings)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  // Default: convert to lowercase and replace spaces with hyphens
  return serviceName.toLowerCase().replace(/\s+/g, '-');
}

export default router;
