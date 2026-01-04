import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateRequest } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { ConferenceBridge, Incident, Organization, IncidentEvent } from '../../shared/models';
import { conferenceBridgeService, ConferenceBridgeConfig } from '../../shared/services/conference-bridge';
import { logger } from '../../shared/utils/logger';

const router = Router();

router.use(authenticateRequest);

/**
 * GET /api/v1/incidents/:incidentId/conference-bridge
 * Get the active conference bridge for an incident
 */
router.get('/incidents/:incidentId/conference-bridge', async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const bridgeRepo = dataSource.getRepository(ConferenceBridge);

    const bridge = await bridgeRepo.findOne({
      where: { incidentId, orgId, status: 'active' },
      relations: ['createdByUser'],
      order: { createdAt: 'DESC' },
    });

    if (!bridge) {
      return res.json({ bridge: null });
    }

    return res.json({
      bridge: {
        id: bridge.id,
        provider: bridge.provider,
        providerLabel: bridge.getProviderLabel(),
        status: bridge.status,
        meetingUrl: bridge.meetingUrl,
        meetingId: bridge.meetingId,
        passcode: bridge.passcode,
        dialInNumber: bridge.dialInNumber,
        dialInPin: bridge.dialInPin,
        participantCount: bridge.participantCount,
        createdBy: bridge.createdByUser ? {
          id: bridge.createdByUser.id,
          fullName: bridge.createdByUser.fullName,
        } : null,
        startedAt: bridge.startedAt,
        createdAt: bridge.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching conference bridge:', error);
    return res.status(500).json({ error: 'Failed to fetch conference bridge' });
  }
});

/**
 * POST /api/v1/incidents/:incidentId/conference-bridge
 * Create a conference bridge for an incident (auto-provision or manual)
 */
router.post(
  '/incidents/:incidentId/conference-bridge',
  [
    body('provider').isIn(['zoom', 'google_meet', 'microsoft_teams', 'manual']),
    body('meetingUrl').optional().isURL(),
    body('passcode').optional().isString(),
    body('dialInNumber').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { incidentId } = req.params;
      const orgId = req.orgId!;
      const user = req.user!;
      const { provider, meetingUrl, passcode, dialInNumber } = req.body;

      const dataSource = await getDataSource();
      const bridgeRepo = dataSource.getRepository(ConferenceBridge);
      const incidentRepo = dataSource.getRepository(Incident);
      const orgRepo = dataSource.getRepository(Organization);
      const eventRepo = dataSource.getRepository(IncidentEvent);

      // Verify incident exists
      const incident = await incidentRepo.findOne({
        where: { id: incidentId, orgId },
        relations: ['service'],
      });

      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Check for existing active bridge
      const existingBridge = await bridgeRepo.findOne({
        where: { incidentId, orgId, status: 'active' },
      });

      if (existingBridge) {
        return res.status(400).json({
          error: 'An active conference bridge already exists for this incident',
          bridge: { id: existingBridge.id, meetingUrl: existingBridge.meetingUrl },
        });
      }

      let bridge: ConferenceBridge;

      if (provider === 'manual') {
        // Manual entry - just save the provided details
        if (!meetingUrl) {
          return res.status(400).json({ error: 'Meeting URL is required for manual bridges' });
        }

        bridge = bridgeRepo.create({
          orgId,
          incidentId,
          provider: 'manual',
          status: 'active',
          meetingUrl,
          passcode: passcode || null,
          dialInNumber: dialInNumber || null,
          createdBy: user.id,
          startedAt: new Date(),
        });
      } else {
        // Auto-provision using configured provider
        const org = await orgRepo.findOne({ where: { id: orgId } });
        const settings = (org?.settings as any)?.conferenceBridge || {};

        if (!settings[provider]) {
          return res.status(400).json({
            error: `${provider} is not configured. Please add credentials in organization settings.`,
          });
        }

        const config: ConferenceBridgeConfig = {
          provider,
          [provider]: settings[provider],
        };

        try {
          const meetingDetails = await conferenceBridgeService.createMeeting(config, {
            topic: incident.summary,
            incidentNumber: incident.incidentNumber,
            serviceName: incident.service?.name || 'Unknown Service',
          });

          bridge = bridgeRepo.create({
            orgId,
            incidentId,
            provider: meetingDetails.provider,
            status: 'active',
            meetingUrl: meetingDetails.meetingUrl,
            meetingId: meetingDetails.meetingId,
            passcode: meetingDetails.passcode || null,
            dialInNumber: meetingDetails.dialInNumber || null,
            dialInPin: meetingDetails.dialInPin || null,
            providerData: meetingDetails.providerData || null,
            createdBy: user.id,
            startedAt: new Date(),
          });
        } catch (err: any) {
          logger.error('Failed to create meeting', { provider, error: err });
          return res.status(500).json({
            error: `Failed to create ${provider} meeting: ${err.message}`,
          });
        }
      }

      await bridgeRepo.save(bridge);

      // Add event to incident timeline
      await eventRepo.save(eventRepo.create({
        incidentId,
        type: 'note',
        actorId: user.id,
        message: `${user.fullName || user.email} started a ${bridge.getProviderLabel()} conference bridge`,
        payload: { bridgeId: bridge.id, provider: bridge.provider },
      }));

      logger.info('Conference bridge created', {
        incidentId,
        bridgeId: bridge.id,
        provider: bridge.provider,
        createdBy: user.id,
      });

      return res.status(201).json({
        bridge: {
          id: bridge.id,
          provider: bridge.provider,
          providerLabel: bridge.getProviderLabel(),
          status: bridge.status,
          meetingUrl: bridge.meetingUrl,
          meetingId: bridge.meetingId,
          passcode: bridge.passcode,
          dialInNumber: bridge.dialInNumber,
          dialInPin: bridge.dialInPin,
          createdAt: bridge.createdAt,
        },
        message: 'Conference bridge created successfully',
      });
    } catch (error) {
      logger.error('Error creating conference bridge:', error);
      return res.status(500).json({ error: 'Failed to create conference bridge' });
    }
  }
);

/**
 * PUT /api/v1/incidents/:incidentId/conference-bridge/:bridgeId/end
 * End a conference bridge
 */
router.put(
  '/incidents/:incidentId/conference-bridge/:bridgeId/end',
  async (req: Request, res: Response) => {
    try {
      const { incidentId, bridgeId } = req.params;
      const orgId = req.orgId!;
      const user = req.user!;

      const dataSource = await getDataSource();
      const bridgeRepo = dataSource.getRepository(ConferenceBridge);
      const eventRepo = dataSource.getRepository(IncidentEvent);

      const bridge = await bridgeRepo.findOne({
        where: { id: bridgeId, incidentId, orgId },
      });

      if (!bridge) {
        return res.status(404).json({ error: 'Conference bridge not found' });
      }

      if (bridge.status === 'ended') {
        return res.status(400).json({ error: 'Conference bridge already ended' });
      }

      // Update status
      bridge.status = 'ended';
      bridge.endedAt = new Date();
      await bridgeRepo.save(bridge);

      // Add event to incident timeline
      await eventRepo.save(eventRepo.create({
        incidentId,
        type: 'note',
        actorId: user.id,
        message: `${user.fullName || user.email} ended the conference bridge`,
        payload: { bridgeId: bridge.id },
      }));

      logger.info('Conference bridge ended', {
        incidentId,
        bridgeId: bridge.id,
        endedBy: user.id,
      });

      return res.json({ message: 'Conference bridge ended' });
    } catch (error) {
      logger.error('Error ending conference bridge:', error);
      return res.status(500).json({ error: 'Failed to end conference bridge' });
    }
  }
);

/**
 * GET /api/v1/conference-bridge/providers
 * Get available conference bridge providers and their configuration status
 */
router.get('/conference-bridge/providers', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const orgRepo = dataSource.getRepository(Organization);

    const org = await orgRepo.findOne({ where: { id: orgId } });
    const settings = (org?.settings as any)?.conferenceBridge || {};

    const providers = [
      {
        id: 'zoom',
        name: 'Zoom',
        configured: !!settings.zoom?.clientId,
        description: 'Auto-create Zoom meetings',
      },
      {
        id: 'google_meet',
        name: 'Google Meet',
        configured: !!settings.googleMeet?.serviceAccountKey,
        description: 'Auto-create Google Meet meetings',
      },
      {
        id: 'microsoft_teams',
        name: 'Microsoft Teams',
        configured: !!settings.microsoftTeams?.clientId,
        description: 'Auto-create Teams meetings',
      },
      {
        id: 'manual',
        name: 'Manual',
        configured: true,
        description: 'Enter meeting details manually',
      },
    ];

    return res.json({ providers });
  } catch (error) {
    logger.error('Error fetching providers:', error);
    return res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

export default router;
