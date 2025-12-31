import 'dotenv/config';
import { getDataSource } from '../shared/db/data-source';
import { sendNotificationMessage } from '../shared/queues/sqs-client';
import { Incident, IncidentEvent, Service, EscalationStep, Schedule, User } from '../shared/models';
import { logger } from '../shared/utils/logger';
import { In } from 'typeorm';

const CHECK_INTERVAL_MS = parseInt(process.env.ESCALATION_CHECK_INTERVAL_MS || '30000', 10); // Default 30 seconds
const ROTATION_CHECK_INTERVAL_MS = parseInt(process.env.ROTATION_CHECK_INTERVAL_MS || '60000', 10); // Default 60 seconds

/**
 * Escalation Timer Worker
 *
 * Checks for incidents that have exceeded their escalation timeout
 * and escalates them to the next step in the escalation policy.
 */
async function checkAndEscalateIncidents(): Promise<void> {
  try {
    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);
    const serviceRepo = dataSource.getRepository(Service);
    const scheduleRepo = dataSource.getRepository(Schedule);

    // Find all triggered incidents (not acknowledged or resolved)
    const triggeredIncidents = await incidentRepo.find({
      where: { state: 'triggered' },
      relations: ['service'],
    });

    if (triggeredIncidents.length === 0) {
      return;
    }

    logger.debug(`Checking ${triggeredIncidents.length} triggered incidents for escalation`);

    for (const incident of triggeredIncidents) {
      try {
        await processIncidentEscalation(
          incident,
          serviceRepo,
          scheduleRepo,
          incidentRepo,
          eventRepo
        );
      } catch (error) {
        logger.error('Error processing escalation for incident:', {
          incidentId: incident.id,
          error,
        });
      }
    }
  } catch (error) {
    logger.error('Error in escalation timer check:', error);
  }
}

async function processIncidentEscalation(
  incident: Incident,
  serviceRepo: any,
  scheduleRepo: any,
  incidentRepo: any,
  eventRepo: any
): Promise<void> {
  // Check if snooze has expired
  if (incident.snoozedUntil !== null) {
    if (incident.isSnoozed()) {
      // Still snoozed - skip escalation
      logger.debug('Skipping escalation for snoozed incident', {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
        snoozedUntil: incident.snoozedUntil,
      });
      return;
    } else {
      // Snooze expired - clear snooze and reset escalation timer
      logger.info('Snooze expired, resuming escalation', {
        incidentId: incident.id,
        incidentNumber: incident.incidentNumber,
      });

      // Create snooze expired event
      const snoozeExpiredEvent = eventRepo.create({
        incidentId: incident.id,
        type: 'unsnooze',
        message: 'Snooze expired, resuming escalation',
        payload: {
          expiredAt: incident.snoozedUntil,
          reason: 'expired',
        },
      });
      await eventRepo.save(snoozeExpiredEvent);

      // Clear snooze and reset escalation timer
      incident.snoozedUntil = null;
      incident.snoozedBy = null;
      incident.escalationStartedAt = new Date();
      await incidentRepo.save(incident);

      // Continue with escalation check but timeout resets
      return;
    }
  }

  // Get service with escalation policy
  const service = await serviceRepo.findOne({
    where: { id: incident.serviceId },
    relations: ['escalationPolicy', 'escalationPolicy.steps'],
  });

  if (!service?.escalationPolicy) {
    return; // No escalation policy, nothing to do
  }

  const escalationPolicy = service.escalationPolicy;
  const steps = escalationPolicy.steps.sort((a: EscalationStep, b: EscalationStep) => a.stepOrder - b.stepOrder);

  if (steps.length === 0) {
    return; // No steps configured
  }

  // Get current step
  const currentStepIndex = incident.currentEscalationStep - 1;
  if (currentStepIndex < 0 || currentStepIndex >= steps.length) {
    return; // Invalid step
  }

  const currentStep = steps[currentStepIndex];

  // Check if escalation started
  if (!incident.escalationStartedAt) {
    return; // Escalation not started yet
  }

  // Calculate timeout
  const timeoutMs = currentStep.timeoutSeconds * 1000;
  const escalationStartTime = new Date(incident.escalationStartedAt).getTime();
  const now = Date.now();
  const elapsed = now - escalationStartTime;

  if (elapsed < timeoutMs) {
    return; // Not timed out yet
  }

  // Check if there's a next step
  const nextStepIndex = currentStepIndex + 1;
  if (nextStepIndex >= steps.length) {
    // Final step reached, log and optionally create event
    logger.info('Final escalation step reached, no more escalations possible', {
      incidentId: incident.id,
      incidentNumber: incident.incidentNumber,
      currentStep: incident.currentEscalationStep,
      totalSteps: steps.length,
    });

    // Create final escalation event (optional)
    const finalEvent = eventRepo.create({
      incidentId: incident.id,
      type: 'escalate',
      message: `Final escalation step reached. No response after ${steps.length} escalation steps.`,
      payload: {
        finalStep: incident.currentEscalationStep,
        totalSteps: steps.length,
        reason: 'final_step_reached',
      },
    });
    await eventRepo.save(finalEvent);

    // Mark escalation as null to prevent repeated final events
    incident.escalationStartedAt = null;
    await incidentRepo.save(incident);
    return;
  }

  // Escalate to next step
  const nextStep = steps[nextStepIndex];
  const previousStep = incident.currentEscalationStep;

  logger.info('Escalating incident to next step', {
    incidentId: incident.id,
    incidentNumber: incident.incidentNumber,
    fromStep: previousStep,
    toStep: nextStepIndex + 1,
    timeoutSeconds: currentStep.timeoutSeconds,
  });

  // Update incident
  incident.currentEscalationStep = nextStepIndex + 1;
  incident.escalationStartedAt = new Date();
  await incidentRepo.save(incident);

  // Create escalation event
  const escalateEvent = eventRepo.create({
    incidentId: incident.id,
    type: 'escalate',
    message: `Incident escalated from step ${previousStep} to step ${nextStepIndex + 1} due to timeout`,
    payload: {
      fromStep: previousStep,
      toStep: nextStepIndex + 1,
      reason: 'timeout',
      timeoutSeconds: currentStep.timeoutSeconds,
    },
  });
  await eventRepo.save(escalateEvent);

  // Get target users for next step and send notifications
  const targetUserIds = await getStepTargetUsers(nextStep, scheduleRepo);

  if (targetUserIds.length === 0) {
    logger.warn('No target users found for escalation step', {
      incidentId: incident.id,
      step: nextStepIndex + 1,
      targetType: nextStep.targetType,
    });
    return;
  }

  // Determine priority based on incident severity
  const priority = incident.severity === 'critical' || incident.severity === 'error' ? 'high' : 'normal';

  // Send notifications to all target users
  for (const userId of targetUserIds) {
    // Send push notification
    await sendNotificationMessage({
      incidentId: incident.id,
      userId,
      channel: 'push',
      priority,
      incidentState: 'triggered',
    });

    // Send email notification
    await sendNotificationMessage({
      incidentId: incident.id,
      userId,
      channel: 'email',
      priority,
      incidentState: 'triggered',
    });

    // For critical/error incidents, also send SMS
    if (incident.severity === 'critical' || incident.severity === 'error') {
      await sendNotificationMessage({
        incidentId: incident.id,
        userId,
        channel: 'sms',
        priority: 'high',
        incidentState: 'triggered',
      });
    }
  }

  logger.info('Escalation notifications sent', {
    incidentId: incident.id,
    step: nextStepIndex + 1,
    targetUserCount: targetUserIds.length,
    channels: ['push', 'email', ...(incident.severity === 'critical' || incident.severity === 'error' ? ['sms'] : [])],
  });
}

async function getStepTargetUsers(
  step: EscalationStep,
  scheduleRepo: any
): Promise<string[]> {
  if (step.targetType === 'users' && step.userIds) {
    // Direct user targeting
    return step.userIds;
  }

  if (step.targetType === 'schedule' && step.scheduleId) {
    // Schedule-based targeting
    const schedule = await scheduleRepo.findOne({
      where: { id: step.scheduleId },
    });

    if (schedule) {
      const oncallUserId = schedule.getCurrentOncallUserId();
      if (oncallUserId) {
        return [oncallUserId];
      }
    }
  }

  return [];
}

/**
 * Check and advance schedule rotations
 *
 * Checks all daily/weekly schedules and updates currentOncallUserId
 * if a rotation handoff has occurred.
 */
async function checkAndAdvanceRotations(): Promise<void> {
  try {
    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const userRepo = dataSource.getRepository(User);

    // Find all schedules with rotation configs (daily or weekly)
    const rotatingSchedules = await scheduleRepo.find({
      where: { type: In(['daily', 'weekly']) },
    });

    if (rotatingSchedules.length === 0) {
      return;
    }

    logger.debug(`Checking ${rotatingSchedules.length} rotating schedules for handoffs`);

    for (const schedule of rotatingSchedules) {
      try {
        await processRotationHandoff(schedule, scheduleRepo, userRepo);
      } catch (error) {
        logger.error('Error processing rotation for schedule:', {
          scheduleId: schedule.id,
          error,
        });
      }
    }
  } catch (error) {
    logger.error('Error in rotation check:', error);
  }
}

async function processRotationHandoff(
  schedule: Schedule,
  scheduleRepo: any,
  userRepo: any
): Promise<void> {
  if (!schedule.rotation_config) {
    return;
  }

  const rotationConfig = schedule.rotation_config as {
    userIds: string[];
    startDate: string;
    rotationHour: number;
    weekday?: number;
  };

  const { userIds, startDate, rotationHour, weekday } = rotationConfig;

  if (!userIds || userIds.length === 0) {
    return;
  }

  // Calculate who should be on-call right now
  const now = new Date();
  const start = new Date(startDate);

  let expectedOncallUserId: string;

  if (schedule.type === 'daily') {
    // Calculate days elapsed since start date
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / msPerDay);

    // Account for rotation hour
    const currentHour = now.getHours();
    let rotationIndex: number;

    if (currentHour < rotationHour) {
      // Haven't rotated yet today
      rotationIndex = Math.max(0, daysSinceStart - 1) % userIds.length;
    } else {
      rotationIndex = Math.max(0, daysSinceStart) % userIds.length;
    }

    expectedOncallUserId = userIds[rotationIndex];
  } else if (schedule.type === 'weekly') {
    // Calculate weeks elapsed since start date
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSinceStart = Math.floor((now.getTime() - start.getTime()) / msPerWeek);

    // Check if we've passed the rotation day this week
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentHour = now.getHours();
    const rotationDay = weekday !== undefined ? weekday : 1; // Default Monday

    let rotationIndex: number;

    if (currentDay < rotationDay || (currentDay === rotationDay && currentHour < rotationHour)) {
      // Haven't rotated yet this week
      rotationIndex = Math.max(0, weeksSinceStart - 1) % userIds.length;
    } else {
      rotationIndex = Math.max(0, weeksSinceStart) % userIds.length;
    }

    expectedOncallUserId = userIds[rotationIndex];
  } else {
    return;
  }

  // Check if currentOncallUserId needs to be updated
  const currentOncallUserId = schedule.currentOncallUserId;

  if (currentOncallUserId !== expectedOncallUserId) {
    // Get user names for logging
    const previousUser = currentOncallUserId
      ? await userRepo.findOne({ where: { id: currentOncallUserId } })
      : null;
    const nextUser = await userRepo.findOne({ where: { id: expectedOncallUserId } });

    logger.info('Rotation handoff detected', {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      scheduleType: schedule.type,
      previousUserId: currentOncallUserId,
      previousUserName: previousUser?.fullName || previousUser?.email || 'N/A',
      nextUserId: expectedOncallUserId,
      nextUserName: nextUser?.fullName || nextUser?.email || 'Unknown',
    });

    // Update the schedule
    schedule.currentOncallUserId = expectedOncallUserId;
    await scheduleRepo.save(schedule);

    logger.info('Rotation handoff completed', {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      newOncallUserId: expectedOncallUserId,
      newOncallUserName: nextUser?.fullName || nextUser?.email,
    });
  }
}

async function startWorker() {
  try {
    logger.info('Starting escalation timer worker...');

    // Initialize database connection
    logger.info('Connecting to database...');
    await getDataSource();
    logger.info('Database connected successfully');

    logger.info(`Escalation timer worker started, checking escalations every ${CHECK_INTERVAL_MS}ms, rotations every ${ROTATION_CHECK_INTERVAL_MS}ms`);

    // Track last rotation check time
    let lastRotationCheck = 0;

    // Run check loop
    while (true) {
      await checkAndEscalateIncidents();

      // Check rotations less frequently
      const now = Date.now();
      if (now - lastRotationCheck >= ROTATION_CHECK_INTERVAL_MS) {
        await checkAndAdvanceRotations();
        lastRotationCheck = now;
      }

      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
    }
  } catch (error) {
    logger.error('Failed to start escalation timer worker:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the worker
startWorker();
