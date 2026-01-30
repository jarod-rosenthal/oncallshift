import 'dotenv/config';
import { initSentry } from '../shared/config/sentry';

// Initialize Sentry for this worker
initSentry({ workerName: 'escalation-timer' });

import { getDataSource } from '../shared/db/data-source';
import { sendNotificationMessage } from '../shared/queues/sqs-client';
import { Incident, IncidentEvent, Service, EscalationStep, EscalationTarget, Schedule, User, Heartbeat } from '../shared/models';
import { logger } from '../shared/utils/logger';
import { In } from 'typeorm';

const CHECK_INTERVAL_MS = parseInt(process.env.ESCALATION_CHECK_INTERVAL_MS || '30000', 10); // Default 30 seconds
const ROTATION_CHECK_INTERVAL_MS = parseInt(process.env.ROTATION_CHECK_INTERVAL_MS || '60000', 10); // Default 60 seconds
const HEARTBEAT_CHECK_INTERVAL_MS = parseInt(process.env.HEARTBEAT_CHECK_INTERVAL_MS || '60000', 10); // Default 60 seconds
const ACK_TIMEOUT_CHECK_INTERVAL_MS = parseInt(process.env.ACK_TIMEOUT_CHECK_INTERVAL_MS || '30000', 10); // Default 30 seconds

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
    const targetRepo = dataSource.getRepository(EscalationTarget);

    // Find all triggered incidents (not acknowledged or resolved)
    const triggeredIncidents = await incidentRepo.find({
      where: { state: 'triggered' },
      relations: ['service'],
    });

    if (triggeredIncidents.length === 0) {
      return;
    }

    logger.debug(`Checking ${triggeredIncidents.length} triggered incidents for escalation`);

    // Batch load all escalation targets to identify schedules we need to fetch
    // This avoids N+1 queries when processing multiple incidents
    const allEscalationTargets = await targetRepo.find();

    // Build lookup map for faster filtering: escalationStepId -> targets
    const targetsByStepId = new Map<string, EscalationTarget[]>();
    const scheduleIds = new Set<string>();

    for (const target of allEscalationTargets) {
      // Index targets by step ID for O(1) lookup
      if (!targetsByStepId.has(target.escalationStepId)) {
        targetsByStepId.set(target.escalationStepId, []);
      }
      targetsByStepId.get(target.escalationStepId)!.push(target);

      // Collect all unique schedule IDs
      if (target.scheduleId) {
        scheduleIds.add(target.scheduleId);
      }
    }

    // Pre-load all schedules with their relations
    const scheduleMap = new Map<string, Schedule>();
    if (scheduleIds.size > 0) {
      const schedules = await scheduleRepo.find({
        where: { id: In(Array.from(scheduleIds)) },
        relations: ['layers', 'layers.members', 'overrides'],
      });
      for (const schedule of schedules) {
        scheduleMap.set(schedule.id, schedule);
      }
    }

    for (const incident of triggeredIncidents) {
      try {
        await processIncidentEscalation(
          incident,
          serviceRepo,
          scheduleRepo,
          incidentRepo,
          eventRepo,
          targetRepo,
          scheduleMap,
          allEscalationTargets,
          targetsByStepId
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
  eventRepo: any,
  targetRepo: any,
  scheduleMap?: Map<string, Schedule>,
  allEscalationTargets?: EscalationTarget[],
  targetsByStepId?: Map<string, EscalationTarget[]>
): Promise<void> {
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
      orgId: incident.orgId,
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
    orgId: incident.orgId,
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
  const targetUserIds = await getStepTargetUsers(nextStep, scheduleRepo, targetRepo, scheduleMap, allEscalationTargets, targetsByStepId);

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
  scheduleRepo: any,
  targetRepo?: any,
  scheduleMap?: Map<string, Schedule>,
  allEscalationTargets?: EscalationTarget[],
  targetsByStepId?: Map<string, EscalationTarget[]>
): Promise<string[]> {
  const targetUsers: string[] = [];

  // First check new multi-target relation (EscalationTarget table)
  if (targetsByStepId && targetsByStepId.has(step.id)) {
    // Use pre-built lookup map for O(1) access (avoids linear filter)
    const targets = targetsByStepId.get(step.id);

    if (targets && targets.length > 0) {
      for (const target of targets) {
        if (target.targetType === 'user' && target.userId) {
          targetUsers.push(target.userId);
        } else if (target.targetType === 'schedule' && target.scheduleId) {
          // Use pre-loaded schedules from map if available, otherwise fetch
          let schedule = scheduleMap?.get(target.scheduleId);
          if (!schedule) {
            schedule = await scheduleRepo.findOne({
              where: { id: target.scheduleId },
              relations: ['layers', 'layers.members', 'overrides'],
            });
          }

          if (schedule) {
            const oncallUserId = schedule.getEffectiveOncallUserId(new Date());
            if (oncallUserId && !targetUsers.includes(oncallUserId)) {
              targetUsers.push(oncallUserId);
            }
          }
        }
      }

      if (targetUsers.length > 0) {
        return targetUsers;
      }
    }
  } else if (targetRepo) {
    // Fallback to query if targets not pre-loaded
    const targets = await targetRepo.find({
      where: { escalationStepId: step.id },
    });

    if (targets && targets.length > 0) {
      for (const target of targets) {
        if (target.targetType === 'user' && target.userId) {
          targetUsers.push(target.userId);
        } else if (target.targetType === 'schedule' && target.scheduleId) {
          // Use pre-loaded schedules from map if available, otherwise fetch
          let schedule = scheduleMap?.get(target.scheduleId);
          if (!schedule) {
            schedule = await scheduleRepo.findOne({
              where: { id: target.scheduleId },
              relations: ['layers', 'layers.members', 'overrides'],
            });
          }

          if (schedule) {
            const oncallUserId = schedule.getEffectiveOncallUserId(new Date());
            if (oncallUserId && !targetUsers.includes(oncallUserId)) {
              targetUsers.push(oncallUserId);
            }
          }
        }
      }

      if (targetUsers.length > 0) {
        return targetUsers;
      }
    }
  }

  // Fall back to legacy fields for backward compatibility
  if (step.targetType === 'users' && step.userIds) {
    // Direct user targeting
    return step.userIds;
  }

  if (step.targetType === 'schedule' && step.scheduleId) {
    // Schedule-based targeting - use pre-loaded schedule if available
    let schedule = scheduleMap?.get(step.scheduleId);
    if (!schedule) {
      schedule = await scheduleRepo.findOne({
        where: { id: step.scheduleId },
        relations: ['layers', 'layers.members', 'overrides'],
      });
    }

    if (schedule) {
      // Use getEffectiveOncallUserId which respects layers and overrides
      const oncallUserId = schedule.getEffectiveOncallUserId(new Date());
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
    // Include layers relation to check if schedule uses layer-based rotations
    const rotatingSchedules = await scheduleRepo.find({
      where: { type: In(['daily', 'weekly']) },
      relations: ['layers'],
    });

    if (rotatingSchedules.length === 0) {
      return;
    }

    logger.debug(`Checking ${rotatingSchedules.length} rotating schedules for handoffs`);

    // Collect all user IDs that will be needed for the rotation checks
    const userIdsToLoad = new Set<string>();
    for (const schedule of rotatingSchedules) {
      if (schedule.currentOncallUserId) {
        userIdsToLoad.add(schedule.currentOncallUserId);
      }
      if (schedule.rotation_config && typeof schedule.rotation_config === 'object') {
        const config = schedule.rotation_config as { userIds?: string[] };
        if (config.userIds) {
          config.userIds.forEach(id => userIdsToLoad.add(id));
        }
      }
    }

    // Batch load all users
    const userMap = new Map<string, User>();
    if (userIdsToLoad.size > 0) {
      const users = await userRepo.find({
        where: { id: In(Array.from(userIdsToLoad)) },
      });
      for (const user of users) {
        userMap.set(user.id, user);
      }
    }

    for (const schedule of rotatingSchedules) {
      try {
        await processRotationHandoff(schedule, scheduleRepo, userRepo, userMap);
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
  userRepo: any,
  userMap?: Map<string, User>
): Promise<void> {
  // Skip legacy rotation processing if schedule has layers configured
  // Layer-based rotations are calculated dynamically by getEffectiveOncallUserId()
  if (schedule.hasLayers && schedule.hasLayers()) {
    return;
  }

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
    // Get user names for logging (use pre-loaded map if available)
    const previousUser = currentOncallUserId
      ? (userMap?.get(currentOncallUserId) ?? await userRepo.findOne({ where: { id: currentOncallUserId } }))
      : null;
    const nextUser = userMap?.get(expectedOncallUserId) ?? await userRepo.findOne({ where: { id: expectedOncallUserId } });

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

/**
 * Check heartbeats for missed pings and create incidents
 */
async function checkHeartbeats(): Promise<void> {
  try {
    const dataSource = await getDataSource();
    const heartbeatRepo = dataSource.getRepository(Heartbeat);
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);
    const serviceRepo = dataSource.getRepository(Service);

    // Find all enabled heartbeats that have been pinged at least once
    const heartbeats = await heartbeatRepo.find({
      where: { enabled: true },
      relations: ['service'],
    });

    if (heartbeats.length === 0) {
      return;
    }

    logger.debug(`Checking ${heartbeats.length} heartbeats`);

    for (const heartbeat of heartbeats) {
      try {
        const previousStatus = heartbeat.status;
        heartbeat.updateStatus();

        // If status changed to expired and no active incident, create one
        if (heartbeat.status === 'expired' && previousStatus !== 'expired' && !heartbeat.activeIncidentId) {
          logger.warn('Heartbeat expired, creating incident', {
            heartbeatId: heartbeat.id,
            heartbeatName: heartbeat.name,
            missedCount: heartbeat.missedCount,
            lastPingAt: heartbeat.lastPingAt?.toISOString(),
          });

          // Find a service to associate with the incident
          // Use the heartbeat's service if configured, otherwise try to find a default service
          let service = heartbeat.service;
          if (!service) {
            // Try to find any service in the org to associate the incident
            service = await serviceRepo.findOne({
              where: { orgId: heartbeat.orgId },
              order: { createdAt: 'ASC' },
            });
          }

          if (!service) {
            logger.error('No service found for heartbeat incident', {
              heartbeatId: heartbeat.id,
              orgId: heartbeat.orgId,
            });
            continue;
          }

          // Create incident for expired heartbeat
          const incident = incidentRepo.create({
            orgId: heartbeat.orgId,
            serviceId: service.id,
            summary: `Heartbeat "${heartbeat.name}" has expired`,
            severity: 'error',
            state: 'triggered',
            dedupKey: `heartbeat:${heartbeat.id}`,
            details: {
              source: 'heartbeat',
              heartbeatId: heartbeat.id,
              heartbeatName: heartbeat.name,
              intervalSeconds: heartbeat.intervalSeconds,
              missedCount: heartbeat.missedCount,
              lastPingAt: heartbeat.lastPingAt?.toISOString(),
              expiredAt: new Date().toISOString(),
            },
          });

          await incidentRepo.save(incident);

          // Create alert event for the heartbeat expiry
          const event = eventRepo.create({
            orgId: incident.orgId,
            incidentId: incident.id,
            type: 'alert',
            message: `Heartbeat "${heartbeat.name}" has missed ${heartbeat.missedCount} ping(s)`,
            payload: {
              heartbeatId: heartbeat.id,
              missedCount: heartbeat.missedCount,
              intervalSeconds: heartbeat.intervalSeconds,
            },
          });
          await eventRepo.save(event);

          // Link incident to heartbeat
          heartbeat.activeIncidentId = incident.id;

          logger.info('Heartbeat incident created', {
            heartbeatId: heartbeat.id,
            heartbeatName: heartbeat.name,
            incidentId: incident.id,
            incidentNumber: incident.incidentNumber,
          });
        }

        // Save heartbeat status update
        await heartbeatRepo.save(heartbeat);
      } catch (error) {
        logger.error('Error processing heartbeat:', {
          heartbeatId: heartbeat.id,
          error,
        });
      }
    }
  } catch (error) {
    logger.error('Error in heartbeat check:', error);
  }
}

/**
 * Check for acknowledged incidents that have exceeded their ack timeout
 * and auto-unacknowledge them
 */
async function checkAcknowledgementTimeouts(): Promise<void> {
  try {
    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);
    const eventRepo = dataSource.getRepository(IncidentEvent);
    const serviceRepo = dataSource.getRepository(Service);
    const scheduleRepo = dataSource.getRepository(Schedule);
    const targetRepo = dataSource.getRepository(EscalationTarget);

    // Find all acknowledged incidents
    const acknowledgedIncidents = await incidentRepo.find({
      where: { state: 'acknowledged' },
      relations: ['service'],
    });

    if (acknowledgedIncidents.length === 0) {
      return;
    }

    logger.debug(`Checking ${acknowledgedIncidents.length} acknowledged incidents for ack timeout`);

    // Batch load schedules that might be referenced in escalation targets
    const allEscalationTargets = await targetRepo.find();
    const scheduleIds = new Set<string>();
    const targetsByStepId = new Map<string, EscalationTarget[]>();

    for (const target of allEscalationTargets) {
      if (target.scheduleId) {
        scheduleIds.add(target.scheduleId);
      }
      // Index targets by step ID for faster lookup
      if (!targetsByStepId.has(target.escalationStepId)) {
        targetsByStepId.set(target.escalationStepId, []);
      }
      targetsByStepId.get(target.escalationStepId)!.push(target);
    }

    const scheduleMap = new Map<string, Schedule>();
    if (scheduleIds.size > 0) {
      const schedules = await scheduleRepo.find({
        where: { id: In(Array.from(scheduleIds)) },
        relations: ['layers', 'layers.members', 'overrides'],
      });
      for (const schedule of schedules) {
        scheduleMap.set(schedule.id, schedule);
      }
    }

    for (const incident of acknowledgedIncidents) {
      try {
        // Check if service has ack timeout configured
        const service = incident.service;
        if (!service || !service.ackTimeoutSeconds || service.ackTimeoutSeconds <= 0) {
          continue; // No timeout configured
        }

        // Check if acknowledged_at exists
        if (!incident.acknowledgedAt) {
          continue; // No ack time, can't check timeout
        }

        // Calculate time since acknowledgement
        const ackTime = new Date(incident.acknowledgedAt).getTime();
        const now = Date.now();
        const elapsed = now - ackTime;
        const timeoutMs = service.ackTimeoutSeconds * 1000;

        if (elapsed < timeoutMs) {
          continue; // Not timed out yet
        }

        // Auto-unacknowledge the incident
        logger.warn('Auto-unacknowledging incident due to ack timeout', {
          incidentId: incident.id,
          incidentNumber: incident.incidentNumber,
          serviceId: service.id,
          serviceName: service.name,
          ackTimeoutSeconds: service.ackTimeoutSeconds,
          elapsedSeconds: Math.floor(elapsed / 1000),
          acknowledgedAt: incident.acknowledgedAt.toISOString(),
        });

        // Revert to triggered state
        incident.state = 'triggered';
        incident.acknowledgedAt = null;
        incident.acknowledgedBy = null;

        // Restart escalation from current step
        incident.escalationStartedAt = new Date();

        await incidentRepo.save(incident);

        // Create timeline event
        const event = eventRepo.create({
          orgId: incident.orgId,
          incidentId: incident.id,
          type: 'unacknowledge',
          message: `Incident auto-unacknowledged after ${service.ackTimeoutSeconds}s timeout (no response)`,
          payload: {
            reason: 'ack_timeout',
            timeoutSeconds: service.ackTimeoutSeconds,
            elapsedSeconds: Math.floor(elapsed / 1000),
            automaticAction: true,
          },
        });
        await eventRepo.save(event);

        logger.info('Incident auto-unacknowledged', {
          incidentId: incident.id,
          incidentNumber: incident.incidentNumber,
          timeoutSeconds: service.ackTimeoutSeconds,
        });

        // Send notifications to current escalation step
        // Get service with escalation policy
        const serviceWithPolicy = await serviceRepo.findOne({
          where: { id: service.id },
          relations: ['escalationPolicy', 'escalationPolicy.steps'],
        });

        if (serviceWithPolicy?.escalationPolicy) {
          const policy = serviceWithPolicy.escalationPolicy;
          const steps = policy.steps.sort((a: EscalationStep, b: EscalationStep) => a.stepOrder - b.stepOrder);

          if (steps.length > 0) {
            const currentStepIndex = incident.currentEscalationStep - 1;
            if (currentStepIndex >= 0 && currentStepIndex < steps.length) {
              const currentStep = steps[currentStepIndex];

              // Get target users (using pre-loaded schedules, targets, and optimized lookup)
              const targetUserIds = await getStepTargetUsers(currentStep, scheduleRepo, targetRepo, scheduleMap, allEscalationTargets, targetsByStepId);

              // Determine priority
              const priority = incident.severity === 'critical' || incident.severity === 'error' ? 'high' : 'normal';

              // Re-send notifications
              for (const userId of targetUserIds) {
                await sendNotificationMessage({
                  incidentId: incident.id,
                  userId,
                  channel: 'push',
                  priority,
                  incidentState: 'triggered',
                });

                await sendNotificationMessage({
                  incidentId: incident.id,
                  userId,
                  channel: 'email',
                  priority,
                  incidentState: 'triggered',
                });

                // For critical/error, also send SMS
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

              logger.info('Re-sent notifications after auto-unacknowledge', {
                incidentId: incident.id,
                targetUserCount: targetUserIds.length,
              });
            }
          }
        }
      } catch (error) {
        logger.error('Error processing ack timeout for incident:', {
          incidentId: incident.id,
          error,
        });
      }
    }
  } catch (error) {
    logger.error('Error in ack timeout check:', error);
  }
}

async function startWorker() {
  try {
    logger.info('Starting escalation timer worker...');

    // Initialize database connection
    logger.info('Connecting to database...');
    await getDataSource();
    logger.info('Database connected successfully');

    logger.info(`Escalation timer worker started, checking escalations every ${CHECK_INTERVAL_MS}ms, rotations every ${ROTATION_CHECK_INTERVAL_MS}ms, heartbeats every ${HEARTBEAT_CHECK_INTERVAL_MS}ms, ack timeouts every ${ACK_TIMEOUT_CHECK_INTERVAL_MS}ms`);

    // Track last check times
    let lastRotationCheck = 0;
    let lastHeartbeatCheck = 0;
    let lastAckTimeoutCheck = 0;

    // Run check loop
    while (true) {
      await checkAndEscalateIncidents();

      const now = Date.now();

      // Check rotations less frequently
      if (now - lastRotationCheck >= ROTATION_CHECK_INTERVAL_MS) {
        await checkAndAdvanceRotations();
        lastRotationCheck = now;
      }

      // Check heartbeats
      if (now - lastHeartbeatCheck >= HEARTBEAT_CHECK_INTERVAL_MS) {
        await checkHeartbeats();
        lastHeartbeatCheck = now;
      }

      // Check acknowledgement timeouts
      if (now - lastAckTimeoutCheck >= ACK_TIMEOUT_CHECK_INTERVAL_MS) {
        await checkAcknowledgementTimeouts();
        lastAckTimeoutCheck = now;
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
