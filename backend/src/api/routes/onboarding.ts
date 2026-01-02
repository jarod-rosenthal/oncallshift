import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { OnboardingSession } from '../../shared/models/OnboardingSession';
import { onboardingAgent } from '../../shared/services/onboarding-agent-service';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * @swagger
 * /api/v1/onboarding/start:
 *   post:
 *     summary: Start a new onboarding session
 *     description: Initiates a conversational onboarding flow for new customers. If an active session exists, it will be resumed.
 *     tags: [Onboarding]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding session started or resumed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session_id:
 *                   type: string
 *                   format: uuid
 *                 message:
 *                   type: string
 *                 stage:
 *                   type: string
 *                   enum: [discovery, team_setup, schedule_setup, integration, verification, complete]
 *                 progress:
 *                   type: number
 *                 is_complete:
 *                   type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const userId = req.user!.id;
    const email = req.user!.email;

    const response = await onboardingAgent.startOnboarding(orgId, userId, email);

    // Get the session ID
    const dataSource = await getDataSource();
    const sessionRepo = dataSource.getRepository(OnboardingSession);
    const session = await sessionRepo.findOne({
      where: { orgId, status: 'active' },
    });

    logger.info('Onboarding session started/resumed', {
      sessionId: session?.id,
      orgId,
      userId,
      stage: response.stage,
    });

    return res.json({
      session_id: session?.id,
      message: response.message,
      stage: response.stage,
      progress: response.progress,
      collected_info: response.collectedInfo,
      suggested_actions: response.suggestedActions,
      is_complete: response.isComplete,
    });
  } catch (error) {
    logger.error('Error starting onboarding session:', error);
    return res.status(500).json({ error: 'Failed to start onboarding session' });
  }
});

/**
 * @swagger
 * /api/v1/onboarding/{sessionId}/respond:
 *   post:
 *     summary: Send a response in the onboarding conversation
 *     description: Process user input and continue the onboarding flow. The AI will extract relevant information and guide the user through setup.
 *     tags: [Onboarding]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Onboarding session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's response message
 *                 example: "We have 3 teams - Platform, Backend, and Frontend"
 *     responses:
 *       200:
 *         description: Response processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: AI assistant's response
 *                 stage:
 *                   type: string
 *                   enum: [discovery, team_setup, schedule_setup, integration, verification, complete]
 *                 progress:
 *                   type: number
 *                   description: Progress percentage (0-100)
 *                 collected_info:
 *                   type: object
 *                   description: Information collected so far
 *                 suggested_actions:
 *                   type: array
 *                   items:
 *                     type: string
 *                 is_complete:
 *                   type: boolean
 *       400:
 *         description: Validation error
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:sessionId/respond',
  [
    body('message')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Message is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const { message } = req.body;
      const orgId = req.orgId!;

      // Verify session belongs to this org
      const dataSource = await getDataSource();
      const sessionRepo = dataSource.getRepository(OnboardingSession);
      const session = await sessionRepo.findOne({
        where: { id: sessionId, orgId },
      });

      if (!session) {
        return res.status(404).json({ error: 'Onboarding session not found' });
      }

      const response = await onboardingAgent.processResponse(sessionId, message);

      logger.info('Processed onboarding response', {
        sessionId,
        orgId,
        stage: response.stage,
        progress: response.progress,
      });

      return res.json({
        message: response.message,
        stage: response.stage,
        progress: response.progress,
        collected_info: response.collectedInfo,
        suggested_actions: response.suggestedActions,
        pending_questions: response.pendingQuestions,
        is_complete: response.isComplete,
      });
    } catch (error) {
      logger.error('Error processing onboarding response:', error);
      return res.status(500).json({ error: 'Failed to process response' });
    }
  }
);

/**
 * @swagger
 * /api/v1/onboarding/{sessionId}/status:
 *   get:
 *     summary: Get current onboarding session status
 *     description: Retrieve the current state of an onboarding session including progress and collected information.
 *     tags: [Onboarding]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Onboarding session ID
 *     responses:
 *       200:
 *         description: Session status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session_id:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [active, completed, abandoned]
 *                 stage:
 *                   type: string
 *                 progress:
 *                   type: number
 *                 collected_info:
 *                   type: object
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       role:
 *                         type: string
 *                         enum: [user, assistant]
 *                       content:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                 is_complete:
 *                   type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.get('/:sessionId/status', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const sessionRepo = dataSource.getRepository(OnboardingSession);

    const session = await sessionRepo.findOne({
      where: { id: sessionId, orgId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Onboarding session not found' });
    }

    const status = await onboardingAgent.getSessionStatus(sessionId);

    return res.json({
      session_id: session.id,
      status: session.status,
      stage: session.currentStage,
      stage_display_name: OnboardingSession.getStageDisplayName(session.currentStage),
      progress: session.getProgressPercentage(),
      collected_info: session.collectedInfo,
      messages: session.messages.slice(-20), // Return last 20 messages
      suggested_actions: status?.suggestedActions,
      is_complete: session.isComplete(),
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      completed_at: session.completedAt,
    });
  } catch (error) {
    logger.error('Error getting onboarding status:', error);
    return res.status(500).json({ error: 'Failed to get session status' });
  }
});

/**
 * @swagger
 * /api/v1/onboarding/{sessionId}/skip:
 *   post:
 *     summary: Skip to the next onboarding stage
 *     description: Allows users to skip the current stage and proceed to the next one.
 *     tags: [Onboarding]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Onboarding session ID
 *     responses:
 *       200:
 *         description: Stage skipped successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.post('/:sessionId/skip', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const orgId = req.orgId!;

    // Verify session belongs to this org
    const dataSource = await getDataSource();
    const sessionRepo = dataSource.getRepository(OnboardingSession);
    const session = await sessionRepo.findOne({
      where: { id: sessionId, orgId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Onboarding session not found' });
    }

    const response = await onboardingAgent.skipToNextStage(sessionId);

    logger.info('Skipped onboarding stage', {
      sessionId,
      orgId,
      newStage: response.stage,
    });

    return res.json({
      message: response.message,
      stage: response.stage,
      progress: response.progress,
      collected_info: response.collectedInfo,
      suggested_actions: response.suggestedActions,
      is_complete: response.isComplete,
    });
  } catch (error) {
    logger.error('Error skipping onboarding stage:', error);
    return res.status(500).json({ error: 'Failed to skip stage' });
  }
});

/**
 * @swagger
 * /api/v1/onboarding/{sessionId}/test-alert:
 *   post:
 *     summary: Send a test alert during verification
 *     description: Triggers a test alert to verify the onboarding configuration is working correctly.
 *     tags: [Onboarding]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Onboarding session ID
 *     responses:
 *       200:
 *         description: Test alert sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.post('/:sessionId/test-alert', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const orgId = req.orgId!;

    // Verify session belongs to this org
    const dataSource = await getDataSource();
    const sessionRepo = dataSource.getRepository(OnboardingSession);
    const session = await sessionRepo.findOne({
      where: { id: sessionId, orgId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Onboarding session not found' });
    }

    const result = await onboardingAgent.sendTestAlert(sessionId);

    logger.info('Test alert requested during onboarding', {
      sessionId,
      orgId,
      success: result.success,
    });

    return res.json(result);
  } catch (error) {
    logger.error('Error sending test alert:', error);
    return res.status(500).json({ error: 'Failed to send test alert' });
  }
});

/**
 * @swagger
 * /api/v1/onboarding/active:
 *   get:
 *     summary: Get the active onboarding session for the current organization
 *     description: Returns the active onboarding session if one exists, or null if no active session.
 *     tags: [Onboarding]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Active session info or null
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     stage:
 *                       type: string
 *                     progress:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const sessionRepo = dataSource.getRepository(OnboardingSession);

    const session = await sessionRepo.findOne({
      where: { orgId, status: 'active' },
    });

    if (!session) {
      return res.json({ session: null });
    }

    return res.json({
      session: {
        id: session.id,
        stage: session.currentStage,
        stage_display_name: OnboardingSession.getStageDisplayName(session.currentStage),
        progress: session.getProgressPercentage(),
        created_at: session.createdAt,
        updated_at: session.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error getting active onboarding session:', error);
    return res.status(500).json({ error: 'Failed to get active session' });
  }
});

/**
 * @swagger
 * /api/v1/onboarding/{sessionId}/abandon:
 *   post:
 *     summary: Abandon an onboarding session
 *     description: Marks an onboarding session as abandoned. This allows starting a fresh session later.
 *     tags: [Onboarding]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Onboarding session ID
 *     responses:
 *       200:
 *         description: Session abandoned successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.post('/:sessionId/abandon', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const sessionRepo = dataSource.getRepository(OnboardingSession);

    const session = await sessionRepo.findOne({
      where: { id: sessionId, orgId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Onboarding session not found' });
    }

    session.status = 'abandoned';
    await sessionRepo.save(session);

    logger.info('Onboarding session abandoned', { sessionId, orgId });

    return res.json({
      message: 'Onboarding session abandoned',
      session_id: sessionId,
    });
  } catch (error) {
    logger.error('Error abandoning onboarding session:', error);
    return res.status(500).json({ error: 'Failed to abandon session' });
  }
});

export default router;
