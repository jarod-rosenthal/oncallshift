import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDataSource } from '../../shared/db/data-source';
import {
  User,
  Team,
  TeamMembership,
  Schedule,
  ScheduleLayer,
  ScheduleLayerMember,
  EscalationPolicy,
  EscalationStep,
  EscalationTarget,
  Service,
  UserContactMethod,
  UserNotificationRule,
} from '../../shared/models';
import { authenticateUser } from '../../shared/auth/middleware';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All import routes require authentication
router.use(authenticateUser);

// ============================================================================
// PagerDuty Import API
// ============================================================================

interface PagerDutyImportData {
  users?: PagerDutyUser[];
  teams?: PagerDutyTeam[];
  schedules?: PagerDutySchedule[];
  escalation_policies?: PagerDutyEscalationPolicy[];
  services?: PagerDutyService[];
}

interface PagerDutyUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  time_zone?: string;
  contact_methods?: Array<{
    id?: string;
    type: string;
    address: string;
    label?: string;
  }>;
  notification_rules?: Array<{
    id?: string;
    start_delay_in_minutes: number;
    urgency: string;
    contact_method: { id?: string; type: string };
  }>;
}

interface PagerDutyTeam {
  id: string;
  name: string;
  description?: string;
  members?: Array<{
    user: { id: string; email?: string };
    role: string;
  }>;
}

interface PagerDutySchedule {
  id: string;
  name: string;
  description?: string;
  time_zone: string;
  schedule_layers?: Array<{
    id: string;
    name: string;
    start: string;
    rotation_virtual_start: string;
    rotation_turn_length_seconds: number;
    users: Array<{ user: { id: string; email?: string } }>;
    restrictions?: Array<{
      type: string;
      start_time_of_day: string;
      duration_seconds: number;
      start_day_of_week?: number;
    }>;
  }>;
}

interface PagerDutyEscalationPolicy {
  id: string;
  name: string;
  description?: string;
  num_loops?: number;
  escalation_rules: Array<{
    escalation_delay_in_minutes: number;
    targets: Array<{
      id: string;
      type: string;
      summary?: string;
    }>;
  }>;
}

interface PagerDutyService {
  id: string;
  name: string;
  description?: string;
  status?: string;
  escalation_policy?: { id: string };
  teams?: Array<{ id: string }>;
  // Integration key for zero-config migration (from service integrations)
  integration_key?: string;
}

interface ImportOptions {
  /**
   * When true, preserves original PagerDuty/Opsgenie integration keys
   * so existing monitoring tools can send webhooks without reconfiguration.
   */
  preserveKeys?: boolean;
}

/**
 * Import from PagerDuty
 * POST /api/v1/import/pagerduty
 *
 * Accepts PagerDuty REST API export data and creates corresponding entities.
 */
router.post('/pagerduty', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const user = (req as any).user;
  const orgId = user.orgId;

  const { data: importData, options = {} }: { data: PagerDutyImportData; options?: ImportOptions } =
    req.body.data ? req.body : { data: req.body, options: req.body.options || {} };
  const { preserveKeys = false } = options;

  const results = {
    users: { imported: 0, skipped: 0, errors: [] as string[] },
    contact_methods: { imported: 0, skipped: 0, errors: [] as string[] },
    notification_rules: { imported: 0, skipped: 0, errors: [] as string[] },
    teams: { imported: 0, skipped: 0, errors: [] as string[] },
    schedules: { imported: 0, skipped: 0, errors: [] as string[] },
    escalation_policies: { imported: 0, skipped: 0, errors: [] as string[] },
    services: { imported: 0, skipped: 0, errors: [] as string[] },
  };

  // Maps to track PagerDuty ID -> OnCallShift ID mappings
  const userIdMap = new Map<string, string>();
  const contactMethodIdMap = new Map<string, string>(); // PD contact method ID -> OnCallShift ID
  const teamIdMap = new Map<string, string>();
  const scheduleIdMap = new Map<string, string>();
  const policyIdMap = new Map<string, string>();

  try {
    const dataSource = await getDataSource();

    // 1. Import Users (match by email, then import contact methods and notification rules)
    if (importData.users && importData.users.length > 0) {
      const userRepo = dataSource.getRepository(User);
      const contactMethodRepo = dataSource.getRepository(UserContactMethod);
      const notificationRuleRepo = dataSource.getRepository(UserNotificationRule);

      for (const pdUser of importData.users) {
        try {
          // Check if user already exists by email
          let existingUser = await userRepo.findOne({
            where: { email: pdUser.email, orgId },
          });

          if (existingUser) {
            userIdMap.set(pdUser.id, existingUser.id);
            results.users.skipped++;
            logger.info('User already exists, mapped', { pdId: pdUser.id, email: pdUser.email });

            // Import contact methods for existing user
            if (pdUser.contact_methods && pdUser.contact_methods.length > 0) {
              for (const pdContact of pdUser.contact_methods) {
                try {
                  // Map PagerDuty contact method type to OnCallShift type
                  const typeMapping: Record<string, 'email' | 'sms' | 'phone' | 'push'> = {
                    'email_contact_method': 'email',
                    'phone_contact_method': 'phone',
                    'sms_contact_method': 'sms',
                    'push_notification_contact_method': 'push',
                  };

                  const contactType = typeMapping[pdContact.type] || 'email';

                  // Check if contact method already exists
                  const existingContact = await contactMethodRepo.findOne({
                    where: {
                      userId: existingUser.id,
                      type: contactType,
                      address: pdContact.address,
                    },
                  });

                  if (!existingContact) {
                    const contactMethod = contactMethodRepo.create({
                      userId: existingUser.id,
                      type: contactType,
                      address: pdContact.address,
                      label: pdContact.label || null,
                      verified: true, // Assume verified since it was in PagerDuty
                      isDefault: false,
                    });
                    await contactMethodRepo.save(contactMethod);
                    contactMethodIdMap.set(pdContact.id || pdContact.address, contactMethod.id);
                    results.contact_methods.imported++;

                    logger.info('Contact method imported', {
                      userId: existingUser.id,
                      type: contactType,
                      address: pdContact.address,
                    });
                  } else {
                    contactMethodIdMap.set(pdContact.id || pdContact.address, existingContact.id);
                    results.contact_methods.skipped++;
                  }
                } catch (error: any) {
                  results.contact_methods.errors.push(
                    `Contact for ${pdUser.email}: ${error.message}`
                  );
                }
              }
            }

            // Import notification rules for existing user
            if (pdUser.notification_rules && pdUser.notification_rules.length > 0) {
              for (let i = 0; i < pdUser.notification_rules.length; i++) {
                const pdRule = pdUser.notification_rules[i];
                try {
                  // Find the contact method this rule references
                  const contactMethodId = contactMethodIdMap.get(
                    pdRule.contact_method?.id || pdRule.contact_method?.type || ''
                  );

                  if (!contactMethodId) {
                    // Try to find by type matching
                    const typeMapping: Record<string, 'email' | 'sms' | 'phone' | 'push'> = {
                      'email_contact_method': 'email',
                      'phone_contact_method': 'phone',
                      'sms_contact_method': 'sms',
                      'push_notification_contact_method': 'push',
                    };
                    const contactType = typeMapping[pdRule.contact_method?.type || ''] || 'email';

                    // Find user's contact method of this type
                    const userContact = await contactMethodRepo.findOne({
                      where: { userId: existingUser.id, type: contactType },
                    });

                    if (userContact) {
                      // Check if rule already exists
                      const existingRule = await notificationRuleRepo.findOne({
                        where: {
                          userId: existingUser.id,
                          contactMethodId: userContact.id,
                          startDelayMinutes: pdRule.start_delay_in_minutes,
                        },
                      });

                      if (!existingRule) {
                        const urgency = pdRule.urgency === 'high' ? 'high'
                          : pdRule.urgency === 'low' ? 'low' : 'any';

                        const notificationRule = notificationRuleRepo.create({
                          userId: existingUser.id,
                          contactMethodId: userContact.id,
                          urgency,
                          startDelayMinutes: pdRule.start_delay_in_minutes,
                          ruleOrder: i,
                          enabled: true,
                        });
                        await notificationRuleRepo.save(notificationRule);
                        results.notification_rules.imported++;

                        logger.info('Notification rule imported', {
                          userId: existingUser.id,
                          urgency,
                          delayMinutes: pdRule.start_delay_in_minutes,
                        });
                      } else {
                        results.notification_rules.skipped++;
                      }
                    } else {
                      results.notification_rules.errors.push(
                        `Rule for ${pdUser.email}: No matching contact method found`
                      );
                    }
                  }
                } catch (error: any) {
                  results.notification_rules.errors.push(
                    `Rule for ${pdUser.email}: ${error.message}`
                  );
                }
              }
            }
          } else {
            // User doesn't exist - needs to be invited separately
            results.users.skipped++;
            logger.info('User not found, will need to be invited', { pdId: pdUser.id, email: pdUser.email });
          }
        } catch (error: any) {
          results.users.errors.push(`User ${pdUser.email}: ${error.message}`);
        }
      }
    }

    // 2. Import Teams
    if (importData.teams && importData.teams.length > 0) {
      const teamRepo = dataSource.getRepository(Team);
      const membershipRepo = dataSource.getRepository(TeamMembership);

      for (const pdTeam of importData.teams) {
        try {
          // Check if team already exists
          let team = await teamRepo.findOne({
            where: { name: pdTeam.name, orgId },
          });

          if (!team) {
            team = teamRepo.create({
              orgId,
              name: pdTeam.name,
              description: pdTeam.description,
              slug: pdTeam.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            });
            await teamRepo.save(team);
            results.teams.imported++;
          } else {
            results.teams.skipped++;
          }

          teamIdMap.set(pdTeam.id, team.id);

          // Import team members
          if (pdTeam.members) {
            for (const member of pdTeam.members) {
              const userId = userIdMap.get(member.user.id);
              if (userId) {
                const existingMembership = await membershipRepo.findOne({
                  where: { teamId: team.id, userId },
                });

                if (!existingMembership) {
                  const membership = membershipRepo.create({
                    teamId: team.id,
                    userId,
                    role: member.role === 'manager' ? 'manager' : 'member',
                  });
                  await membershipRepo.save(membership);
                }
              }
            }
          }
        } catch (error: any) {
          results.teams.errors.push(`Team ${pdTeam.name}: ${error.message}`);
        }
      }
    }

    // 3. Import Schedules
    if (importData.schedules && importData.schedules.length > 0) {
      const scheduleRepo = dataSource.getRepository(Schedule);
      const layerRepo = dataSource.getRepository(ScheduleLayer);
      const layerMemberRepo = dataSource.getRepository(ScheduleLayerMember);

      for (const pdSchedule of importData.schedules) {
        try {
          // Check if schedule already exists
          let schedule = await scheduleRepo.findOne({
            where: { name: pdSchedule.name, orgId },
          });

          if (!schedule) {
            schedule = scheduleRepo.create({
              orgId,
              name: pdSchedule.name,
              description: pdSchedule.description,
              timezone: pdSchedule.time_zone || 'UTC',
              type: 'weekly',
            });
            await scheduleRepo.save(schedule);
            results.schedules.imported++;

            // Import schedule layers
            if (pdSchedule.schedule_layers) {
              for (let i = 0; i < pdSchedule.schedule_layers.length; i++) {
                const pdLayer = pdSchedule.schedule_layers[i];

                // Convert rotation length to type
                const rotationType = getRotationType(pdLayer.rotation_turn_length_seconds);

                const layer = layerRepo.create({
                  scheduleId: schedule.id,
                  name: pdLayer.name || `Layer ${i + 1}`,
                  rotationType,
                  startDate: new Date(pdLayer.rotation_virtual_start || pdLayer.start),
                  handoffTime: extractTimeFromISO(pdLayer.rotation_virtual_start),
                  rotationLength: Math.ceil(pdLayer.rotation_turn_length_seconds / 86400),
                  layerOrder: i,
                  restrictions: pdLayer.restrictions ? convertRestrictions(pdLayer.restrictions) : null,
                });
                await layerRepo.save(layer);

                // Add layer members
                if (pdLayer.users) {
                  for (let j = 0; j < pdLayer.users.length; j++) {
                    const pdLayerUser = pdLayer.users[j];
                    const userId = userIdMap.get(pdLayerUser.user.id);

                    if (userId) {
                      const layerMember = layerMemberRepo.create({
                        layerId: layer.id,
                        userId,
                        position: j,
                      });
                      await layerMemberRepo.save(layerMember);
                    }
                  }
                }
              }
            }
          } else {
            results.schedules.skipped++;
          }

          scheduleIdMap.set(pdSchedule.id, schedule.id);
        } catch (error: any) {
          results.schedules.errors.push(`Schedule ${pdSchedule.name}: ${error.message}`);
        }
      }
    }

    // 4. Import Escalation Policies
    if (importData.escalation_policies && importData.escalation_policies.length > 0) {
      const policyRepo = dataSource.getRepository(EscalationPolicy);
      const stepRepo = dataSource.getRepository(EscalationStep);
      const targetRepo = dataSource.getRepository(EscalationTarget);

      for (const pdPolicy of importData.escalation_policies) {
        try {
          // Check if policy already exists
          let policy = await policyRepo.findOne({
            where: { name: pdPolicy.name, orgId },
          });

          if (!policy) {
            policy = policyRepo.create({
              orgId,
              name: pdPolicy.name,
              description: pdPolicy.description,
              repeatEnabled: (pdPolicy.num_loops || 0) > 0,
              repeatCount: pdPolicy.num_loops || 0,
            });
            await policyRepo.save(policy);
            results.escalation_policies.imported++;

            // Import escalation rules as steps with ALL targets
            if (pdPolicy.escalation_rules) {
              for (let i = 0; i < pdPolicy.escalation_rules.length; i++) {
                const pdRule = pdPolicy.escalation_rules[i];

                if (!pdRule.targets || pdRule.targets.length === 0) continue;

                // Determine primary target type for backward compatibility
                const firstTarget = pdRule.targets[0];
                let targetType: 'schedule' | 'users' = 'users';
                let scheduleId: string | null = null;
                let userIds: string[] | null = null;

                if (firstTarget.type === 'schedule_reference' || firstTarget.type === 'schedule') {
                  targetType = 'schedule';
                  scheduleId = scheduleIdMap.get(firstTarget.id) || null;
                } else if (firstTarget.type === 'user_reference' || firstTarget.type === 'user') {
                  targetType = 'users';
                  const userId = userIdMap.get(firstTarget.id);
                  userIds = userId ? [userId] : [];
                }

                // Create the step with notifyStrategy 'all' (PagerDuty default)
                const step = stepRepo.create({
                  escalationPolicyId: policy.id,
                  stepOrder: i + 1,
                  targetType,
                  scheduleId,
                  userIds,
                  timeoutSeconds: pdRule.escalation_delay_in_minutes * 60,
                  notifyStrategy: 'all', // PagerDuty notifies all targets simultaneously
                });
                await stepRepo.save(step);

                // Create EscalationTarget entries for ALL targets (multi-target support)
                for (const target of pdRule.targets) {
                  if (target.type === 'schedule_reference' || target.type === 'schedule') {
                    const mappedScheduleId = scheduleIdMap.get(target.id);
                    if (mappedScheduleId) {
                      const escalationTarget = targetRepo.create({
                        escalationStepId: step.id,
                        targetType: 'schedule',
                        scheduleId: mappedScheduleId,
                      });
                      await targetRepo.save(escalationTarget);
                    }
                  } else if (target.type === 'user_reference' || target.type === 'user') {
                    const mappedUserId = userIdMap.get(target.id);
                    if (mappedUserId) {
                      const escalationTarget = targetRepo.create({
                        escalationStepId: step.id,
                        targetType: 'user',
                        userId: mappedUserId,
                      });
                      await targetRepo.save(escalationTarget);
                    }
                  }
                }

                logger.info('Escalation step imported with targets', {
                  policyName: pdPolicy.name,
                  stepOrder: i + 1,
                  targetCount: pdRule.targets.length,
                });
              }
            }
          } else {
            results.escalation_policies.skipped++;
          }

          policyIdMap.set(pdPolicy.id, policy.id);
        } catch (error: any) {
          results.escalation_policies.errors.push(`Policy ${pdPolicy.name}: ${error.message}`);
        }
      }
    }

    // 5. Import Services
    if (importData.services && importData.services.length > 0) {
      const serviceRepo = dataSource.getRepository(Service);

      for (const pdService of importData.services) {
        try {
          // Check if service already exists
          let service = await serviceRepo.findOne({
            where: { name: pdService.name, orgId },
          });

          if (!service) {
            const escalationPolicyId = pdService.escalation_policy?.id
              ? policyIdMap.get(pdService.escalation_policy.id)
              : null;

            const teamId = pdService.teams?.[0]?.id
              ? teamIdMap.get(pdService.teams[0].id)
              : null;

            // Build external keys for zero-config migration
            const externalKeys = preserveKeys && pdService.integration_key
              ? { pagerduty: pdService.integration_key }
              : null;

            service = serviceRepo.create({
              orgId,
              name: pdService.name,
              description: pdService.description,
              status: pdService.status === 'active' ? 'active' : 'inactive',
              escalationPolicyId,
              teamId,
              apiKey: crypto.randomUUID(),
              externalKeys,
            });
            await serviceRepo.save(service);
            results.services.imported++;

            if (externalKeys) {
              logger.info('Service imported with preserved PagerDuty key', {
                serviceName: pdService.name,
                hasExternalKey: true,
              });
            }
          } else {
            // Update external keys on existing service if preserveKeys is enabled
            if (preserveKeys && pdService.integration_key && !service.externalKeys?.pagerduty) {
              service.externalKeys = {
                ...service.externalKeys,
                pagerduty: pdService.integration_key,
              };
              await serviceRepo.save(service);
              logger.info('Updated existing service with PagerDuty key', {
                serviceName: pdService.name,
              });
            }
            results.services.skipped++;
          }
        } catch (error: any) {
          results.services.errors.push(`Service ${pdService.name}: ${error.message}`);
        }
      }
    }

    const duration = Date.now() - startTime;

    logger.info('PagerDuty import completed', {
      orgId,
      userId: user.id,
      duration,
      results,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Import completed',
      duration_ms: duration,
      results,
      id_mappings: {
        users: Object.fromEntries(userIdMap),
        teams: Object.fromEntries(teamIdMap),
        schedules: Object.fromEntries(scheduleIdMap),
        escalation_policies: Object.fromEntries(policyIdMap),
      },
    });
  } catch (error: any) {
    logger.error('PagerDuty import failed:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      results,
    });
  }
});

// ============================================================================
// Opsgenie Import API
// ============================================================================

interface OpsgenieImportData {
  users?: OpsgenieUser[];
  teams?: OpsgenieTeam[];
  schedules?: OpsgenieSchedule[];
  escalations?: OpsgenieEscalation[];
  services?: OpsgenieService[];
}

interface OpsgenieUser {
  id: string;
  username: string;
  fullName: string;
  role?: { name: string };
  timezone?: string;
  userContacts?: Array<{
    id?: string;
    method: string; // email, sms, voice, mobile
    to: string;
    enabled?: boolean;
  }>;
  notificationRules?: Array<{
    id?: string;
    name?: string;
    actionType?: string;
    notificationTime?: number; // minutes
    order?: number;
    steps?: Array<{
      contact?: { method: string; to: string };
      sendAfter?: { timeAmount: number };
      enabled?: boolean;
    }>;
  }>;
}

interface OpsgenieTeam {
  id: string;
  name: string;
  description?: string;
  members?: Array<{
    user: { id: string; username?: string };
    role: string;
  }>;
}

interface OpsgenieSchedule {
  id: string;
  name: string;
  description?: string;
  timezone: string;
  ownerTeam?: { id: string };
  rotations?: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate?: string;
    type: 'daily' | 'weekly' | 'hourly';
    length: number;
    participants: Array<{
      type: string;
      id?: string;
      username?: string;
    }>;
    timeRestriction?: {
      type: string;
      restriction?: any;
      restrictions?: any[];
    };
  }>;
}

interface OpsgenieEscalation {
  id: string;
  name: string;
  description?: string;
  ownerTeam?: { id: string };
  rules: Array<{
    condition: string;
    notifyType: string;
    delay: { timeAmount: number };
    // Single recipient (legacy)
    recipient: {
      type: string;
      id?: string;
      name?: string;
      username?: string;
    };
    // Multiple recipients (multi-target support)
    recipients?: Array<{
      type: string;
      id?: string;
      name?: string;
      username?: string;
    }>;
  }>;
  repeat?: {
    count: number;
    waitInterval: number;
  };
}

interface OpsgenieService {
  id: string;
  name: string;
  description?: string;
  teamId?: string;
  // API key for zero-config migration (from integrations)
  apiKey?: string;
}

/**
 * Import from Opsgenie
 * POST /api/v1/import/opsgenie
 *
 * Accepts Opsgenie REST API export data and creates corresponding entities.
 */
router.post('/opsgenie', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const user = (req as any).user;
  const orgId = user.orgId;

  const { data: importData, options = {} }: { data: OpsgenieImportData; options?: ImportOptions } =
    req.body.data ? req.body : { data: req.body, options: req.body.options || {} };
  const { preserveKeys = false } = options;

  const results = {
    users: { imported: 0, skipped: 0, errors: [] as string[] },
    contact_methods: { imported: 0, skipped: 0, errors: [] as string[] },
    notification_rules: { imported: 0, skipped: 0, errors: [] as string[] },
    teams: { imported: 0, skipped: 0, errors: [] as string[] },
    schedules: { imported: 0, skipped: 0, errors: [] as string[] },
    escalations: { imported: 0, skipped: 0, errors: [] as string[] },
    services: { imported: 0, skipped: 0, errors: [] as string[] },
  };

  const userIdMap = new Map<string, string>();
  const contactMethodIdMap = new Map<string, string>();
  const teamIdMap = new Map<string, string>();
  const scheduleIdMap = new Map<string, string>();
  const escalationIdMap = new Map<string, string>();

  try {
    const dataSource = await getDataSource();

    // 1. Import Users (match by email/username, then import contact methods and notification rules)
    if (importData.users && importData.users.length > 0) {
      const userRepo = dataSource.getRepository(User);
      const contactMethodRepo = dataSource.getRepository(UserContactMethod);
      const notificationRuleRepo = dataSource.getRepository(UserNotificationRule);

      for (const ogUser of importData.users) {
        try {
          let existingUser = await userRepo.findOne({
            where: { email: ogUser.username, orgId },
          });

          if (existingUser) {
            userIdMap.set(ogUser.id, existingUser.id);
            results.users.skipped++;

            // Import contact methods for existing user
            if (ogUser.userContacts && ogUser.userContacts.length > 0) {
              for (const ogContact of ogUser.userContacts) {
                try {
                  // Map Opsgenie contact method type to OnCallShift type
                  const typeMapping: Record<string, 'email' | 'sms' | 'phone' | 'push'> = {
                    'email': 'email',
                    'sms': 'sms',
                    'voice': 'phone',
                    'mobile': 'push',
                  };

                  const contactType = typeMapping[ogContact.method] || 'email';

                  // Check if contact method already exists
                  const existingContact = await contactMethodRepo.findOne({
                    where: {
                      userId: existingUser.id,
                      type: contactType,
                      address: ogContact.to,
                    },
                  });

                  if (!existingContact) {
                    const contactMethod = contactMethodRepo.create({
                      userId: existingUser.id,
                      type: contactType,
                      address: ogContact.to,
                      label: null,
                      verified: true,
                      isDefault: false,
                    });
                    await contactMethodRepo.save(contactMethod);
                    contactMethodIdMap.set(ogContact.id || ogContact.to, contactMethod.id);
                    results.contact_methods.imported++;

                    logger.info('Contact method imported', {
                      userId: existingUser.id,
                      type: contactType,
                      address: ogContact.to,
                    });
                  } else {
                    contactMethodIdMap.set(ogContact.id || ogContact.to, existingContact.id);
                    results.contact_methods.skipped++;
                  }
                } catch (error: any) {
                  results.contact_methods.errors.push(
                    `Contact for ${ogUser.username}: ${error.message}`
                  );
                }
              }
            }

            // Import notification rules for existing user
            if (ogUser.notificationRules && ogUser.notificationRules.length > 0) {
              for (let i = 0; i < ogUser.notificationRules.length; i++) {
                const ogRule = ogUser.notificationRules[i];
                try {
                  // Opsgenie notification rules have steps with contacts
                  if (ogRule.steps && ogRule.steps.length > 0) {
                    for (const step of ogRule.steps) {
                      if (step.contact) {
                        const typeMapping: Record<string, 'email' | 'sms' | 'phone' | 'push'> = {
                          'email': 'email',
                          'sms': 'sms',
                          'voice': 'phone',
                          'mobile': 'push',
                        };
                        const contactType = typeMapping[step.contact.method] || 'email';

                        // Find user's contact method
                        const userContact = await contactMethodRepo.findOne({
                          where: { userId: existingUser.id, type: contactType },
                        });

                        if (userContact) {
                          const delayMinutes = step.sendAfter?.timeAmount || 0;

                          const existingRule = await notificationRuleRepo.findOne({
                            where: {
                              userId: existingUser.id,
                              contactMethodId: userContact.id,
                              startDelayMinutes: delayMinutes,
                            },
                          });

                          if (!existingRule) {
                            const notificationRule = notificationRuleRepo.create({
                              userId: existingUser.id,
                              contactMethodId: userContact.id,
                              urgency: 'any', // Opsgenie doesn't have urgency per rule
                              startDelayMinutes: delayMinutes,
                              ruleOrder: i,
                              enabled: step.enabled !== false,
                            });
                            await notificationRuleRepo.save(notificationRule);
                            results.notification_rules.imported++;
                          } else {
                            results.notification_rules.skipped++;
                          }
                        }
                      }
                    }
                  }
                } catch (error: any) {
                  results.notification_rules.errors.push(
                    `Rule for ${ogUser.username}: ${error.message}`
                  );
                }
              }
            }
          } else {
            results.users.skipped++;
            logger.info('User not found, will need to be invited', { ogId: ogUser.id, email: ogUser.username });
          }
        } catch (error: any) {
          results.users.errors.push(`User ${ogUser.username}: ${error.message}`);
        }
      }
    }

    // 2. Import Teams
    if (importData.teams && importData.teams.length > 0) {
      const teamRepo = dataSource.getRepository(Team);
      const membershipRepo = dataSource.getRepository(TeamMembership);

      for (const ogTeam of importData.teams) {
        try {
          let team = await teamRepo.findOne({
            where: { name: ogTeam.name, orgId },
          });

          if (!team) {
            team = teamRepo.create({
              orgId,
              name: ogTeam.name,
              description: ogTeam.description,
              slug: ogTeam.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            });
            await teamRepo.save(team);
            results.teams.imported++;
          } else {
            results.teams.skipped++;
          }

          teamIdMap.set(ogTeam.id, team.id);

          if (ogTeam.members) {
            for (const member of ogTeam.members) {
              const userId = userIdMap.get(member.user.id);
              if (userId) {
                const existingMembership = await membershipRepo.findOne({
                  where: { teamId: team.id, userId },
                });

                if (!existingMembership) {
                  const membership = membershipRepo.create({
                    teamId: team.id,
                    userId,
                    role: member.role === 'admin' ? 'manager' : 'member',
                  });
                  await membershipRepo.save(membership);
                }
              }
            }
          }
        } catch (error: any) {
          results.teams.errors.push(`Team ${ogTeam.name}: ${error.message}`);
        }
      }
    }

    // 3. Import Schedules
    if (importData.schedules && importData.schedules.length > 0) {
      const scheduleRepo = dataSource.getRepository(Schedule);
      const layerRepo = dataSource.getRepository(ScheduleLayer);
      const layerMemberRepo = dataSource.getRepository(ScheduleLayerMember);

      for (const ogSchedule of importData.schedules) {
        try {
          let schedule = await scheduleRepo.findOne({
            where: { name: ogSchedule.name, orgId },
          });

          if (!schedule) {
            const teamId = ogSchedule.ownerTeam?.id ? teamIdMap.get(ogSchedule.ownerTeam.id) : null;

            schedule = scheduleRepo.create({
              orgId,
              name: ogSchedule.name,
              description: ogSchedule.description,
              timezone: ogSchedule.timezone || 'UTC',
              type: 'weekly',
              teamId,
            });
            await scheduleRepo.save(schedule);
            results.schedules.imported++;

            // Import rotations as layers
            if (ogSchedule.rotations) {
              for (let i = 0; i < ogSchedule.rotations.length; i++) {
                const ogRotation = ogSchedule.rotations[i];

                // Map Opsgenie rotation type to our system
                const rotationType = mapOpsgenieRotationType(ogRotation.type);

                const layer = layerRepo.create({
                  scheduleId: schedule.id,
                  name: ogRotation.name || `Rotation ${i + 1}`,
                  rotationType,
                  startDate: new Date(ogRotation.startDate),
                  endDate: ogRotation.endDate ? new Date(ogRotation.endDate) : undefined,
                  rotationLength: ogRotation.length || 1,
                  layerOrder: i,
                  restrictions: ogRotation.timeRestriction ? convertOpsgenieRestrictions(ogRotation.timeRestriction) : null,
                });
                await layerRepo.save(layer);

                // Add participants
                if (ogRotation.participants) {
                  let position = 0;
                  for (const participant of ogRotation.participants) {
                    if (participant.type === 'user' && participant.id) {
                      const userId = userIdMap.get(participant.id);
                      if (userId) {
                        const layerMember = layerMemberRepo.create({
                          layerId: layer.id,
                          userId,
                          position: position++,
                        });
                        await layerMemberRepo.save(layerMember);
                      }
                    }
                  }
                }
              }
            }
          } else {
            results.schedules.skipped++;
          }

          scheduleIdMap.set(ogSchedule.id, schedule.id);
        } catch (error: any) {
          results.schedules.errors.push(`Schedule ${ogSchedule.name}: ${error.message}`);
        }
      }
    }

    // 4. Import Escalations
    if (importData.escalations && importData.escalations.length > 0) {
      const policyRepo = dataSource.getRepository(EscalationPolicy);
      const stepRepo = dataSource.getRepository(EscalationStep);
      const targetRepo = dataSource.getRepository(EscalationTarget);

      for (const ogEscalation of importData.escalations) {
        try {
          let policy = await policyRepo.findOne({
            where: { name: ogEscalation.name, orgId },
          });

          if (!policy) {
            const teamId = ogEscalation.ownerTeam?.id ? teamIdMap.get(ogEscalation.ownerTeam.id) : null;

            policy = policyRepo.create({
              orgId,
              name: ogEscalation.name,
              description: ogEscalation.description,
              teamId,
              repeatEnabled: (ogEscalation.repeat?.count || 0) > 0,
              repeatCount: ogEscalation.repeat?.count || 0,
            });
            await policyRepo.save(policy);
            results.escalations.imported++;

            // Import rules as steps with ALL targets
            if (ogEscalation.rules) {
              for (let i = 0; i < ogEscalation.rules.length; i++) {
                const ogRule = ogEscalation.rules[i];

                // Get all recipients (prefer recipients array, fall back to single recipient)
                const allRecipients = ogRule.recipients?.length
                  ? ogRule.recipients
                  : [ogRule.recipient];

                if (!allRecipients || allRecipients.length === 0) continue;

                // Determine primary target type for backward compatibility
                const firstRecipient = allRecipients[0];
                let targetType: 'schedule' | 'users' = 'users';
                let scheduleId: string | null = null;
                let userIds: string[] | null = null;

                if (firstRecipient.type === 'schedule') {
                  targetType = 'schedule';
                  if (firstRecipient.id) {
                    scheduleId = scheduleIdMap.get(firstRecipient.id) || null;
                  }
                } else if (firstRecipient.type === 'user') {
                  targetType = 'users';
                  if (firstRecipient.id) {
                    const userId = userIdMap.get(firstRecipient.id);
                    userIds = userId ? [userId] : [];
                  }
                }

                // Create the step with notifyStrategy 'all' (Opsgenie default)
                const step = stepRepo.create({
                  escalationPolicyId: policy.id,
                  stepOrder: i + 1,
                  targetType,
                  scheduleId,
                  userIds,
                  timeoutSeconds: (ogRule.delay?.timeAmount || 5) * 60,
                  notifyStrategy: 'all', // Opsgenie notifies all targets simultaneously
                });
                await stepRepo.save(step);

                // Create EscalationTarget entries for ALL recipients (multi-target support)
                for (const recipient of allRecipients) {
                  if (recipient.type === 'schedule') {
                    if (recipient.id) {
                      const mappedScheduleId = scheduleIdMap.get(recipient.id);
                      if (mappedScheduleId) {
                        const escalationTarget = targetRepo.create({
                          escalationStepId: step.id,
                          targetType: 'schedule',
                          scheduleId: mappedScheduleId,
                        });
                        await targetRepo.save(escalationTarget);
                      }
                    }
                  } else if (recipient.type === 'user') {
                    if (recipient.id) {
                      const mappedUserId = userIdMap.get(recipient.id);
                      if (mappedUserId) {
                        const escalationTarget = targetRepo.create({
                          escalationStepId: step.id,
                          targetType: 'user',
                          userId: mappedUserId,
                        });
                        await targetRepo.save(escalationTarget);
                      }
                    }
                  }
                }

                logger.info('Escalation step imported with targets', {
                  escalationName: ogEscalation.name,
                  stepOrder: i + 1,
                  targetCount: allRecipients.length,
                });
              }
            }
          } else {
            results.escalations.skipped++;
          }

          escalationIdMap.set(ogEscalation.id, policy.id);
        } catch (error: any) {
          results.escalations.errors.push(`Escalation ${ogEscalation.name}: ${error.message}`);
        }
      }
    }

    // 5. Import Services
    if (importData.services && importData.services.length > 0) {
      const serviceRepo = dataSource.getRepository(Service);

      for (const ogService of importData.services) {
        try {
          let service = await serviceRepo.findOne({
            where: { name: ogService.name, orgId },
          });

          if (!service) {
            const teamId = ogService.teamId ? teamIdMap.get(ogService.teamId) : null;

            // Build external keys for zero-config migration
            const externalKeys = preserveKeys && ogService.apiKey
              ? { opsgenie: ogService.apiKey }
              : null;

            service = serviceRepo.create({
              orgId,
              name: ogService.name,
              description: ogService.description,
              teamId,
              apiKey: crypto.randomUUID(),
              externalKeys,
            });
            await serviceRepo.save(service);
            results.services.imported++;

            if (externalKeys) {
              logger.info('Service imported with preserved Opsgenie key', {
                serviceName: ogService.name,
                hasExternalKey: true,
              });
            }
          } else {
            // Update external keys on existing service if preserveKeys is enabled
            if (preserveKeys && ogService.apiKey && !service.externalKeys?.opsgenie) {
              service.externalKeys = {
                ...service.externalKeys,
                opsgenie: ogService.apiKey,
              };
              await serviceRepo.save(service);
              logger.info('Updated existing service with Opsgenie key', {
                serviceName: ogService.name,
              });
            }
            results.services.skipped++;
          }
        } catch (error: any) {
          results.services.errors.push(`Service ${ogService.name}: ${error.message}`);
        }
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Opsgenie import completed', {
      orgId,
      userId: user.id,
      duration,
      results,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Import completed',
      duration_ms: duration,
      results,
      id_mappings: {
        users: Object.fromEntries(userIdMap),
        teams: Object.fromEntries(teamIdMap),
        schedules: Object.fromEntries(scheduleIdMap),
        escalations: Object.fromEntries(escalationIdMap),
      },
    });
  } catch (error: any) {
    logger.error('Opsgenie import failed:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      results,
    });
  }
});

/**
 * Preview import (dry-run)
 * POST /api/v1/import/preview
 *
 * Analyzes import data and returns what would be created without making changes.
 */
router.post('/preview', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const orgId = user.orgId;
  const { source, data, options = {} } = req.body;
  const { preserveKeys = false } = options as ImportOptions;

  if (!source || !['pagerduty', 'opsgenie'].includes(source)) {
    return res.status(400).json({
      error: 'source must be "pagerduty" or "opsgenie"',
    });
  }

  if (!data) {
    return res.status(400).json({
      error: 'data is required',
    });
  }

  try {
    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);
    const teamRepo = dataSource.getRepository(Team);
    const scheduleRepo = dataSource.getRepository(Schedule);
    const policyRepo = dataSource.getRepository(EscalationPolicy);
    const serviceRepo = dataSource.getRepository(Service);

    const preview = {
      source,
      options: { preserveKeys },
      summary: {
        users: { total: 0, existing: 0, new: 0, unmapped: 0 },
        contact_methods: { total: 0, existing: 0, new: 0 },
        notification_rules: { total: 0, existing: 0, new: 0 },
        teams: { total: 0, existing: 0, new: 0 },
        schedules: { total: 0, existing: 0, new: 0 },
        escalation_policies: { total: 0, existing: 0, new: 0 },
        services: { total: 0, existing: 0, new: 0, withExternalKeys: 0 },
      },
      details: {
        users: [] as any[],
        contact_methods: [] as any[],
        notification_rules: [] as any[],
        teams: [] as any[],
        schedules: [] as any[],
        escalation_policies: [] as any[],
        services: [] as any[],
      },
    };

    // Get repository for contact methods
    const contactMethodRepo = dataSource.getRepository(UserContactMethod);

    // Analyze users and their contact methods/notification rules
    const users = source === 'pagerduty' ? data.users : data.users;
    if (users) {
      for (const u of users) {
        const email = source === 'pagerduty' ? u.email : u.username;
        const existing = await userRepo.findOne({ where: { email, orgId } });
        preview.summary.users.total++;
        if (existing) {
          preview.summary.users.existing++;
          preview.details.users.push({ email, status: 'existing', id: existing.id });

          // Analyze contact methods for this user
          const contactMethods = source === 'pagerduty' ? u.contact_methods : u.userContacts;
          if (contactMethods && contactMethods.length > 0) {
            for (const cm of contactMethods) {
              // Map contact method type
              const typeMapping: Record<string, string> = source === 'pagerduty'
                ? {
                    'email_contact_method': 'email',
                    'phone_contact_method': 'phone',
                    'sms_contact_method': 'sms',
                    'push_notification_contact_method': 'push',
                  }
                : {
                    'email': 'email',
                    'sms': 'sms',
                    'voice': 'phone',
                    'mobile': 'push',
                  };

              const contactType = typeMapping[source === 'pagerduty' ? cm.type : cm.method] || 'email';
              const address = source === 'pagerduty' ? cm.address : cm.to;

              const existingContact = await contactMethodRepo.findOne({
                where: { userId: existing.id, type: contactType as any, address },
              });

              preview.summary.contact_methods.total++;
              if (existingContact) {
                preview.summary.contact_methods.existing++;
                preview.details.contact_methods.push({
                  userEmail: email,
                  type: contactType,
                  address,
                  status: 'existing',
                });
              } else {
                preview.summary.contact_methods.new++;
                preview.details.contact_methods.push({
                  userEmail: email,
                  type: contactType,
                  address,
                  status: 'new',
                });
              }
            }
          }

          // Analyze notification rules for this user
          const notificationRules = source === 'pagerduty' ? u.notification_rules : u.notificationRules;
          if (notificationRules && notificationRules.length > 0) {
            const ruleCount = source === 'pagerduty'
              ? notificationRules.length
              : notificationRules.reduce((acc: number, r: any) => acc + (r.steps?.length || 0), 0);

            preview.summary.notification_rules.total += ruleCount;
            preview.summary.notification_rules.new += ruleCount; // Simplified - actual import deduplicates
            preview.details.notification_rules.push({
              userEmail: email,
              ruleCount,
              status: 'new',
              note: 'Rules will be deduplicated during import',
            });
          }
        } else {
          preview.summary.users.unmapped++;
          preview.details.users.push({ email, status: 'unmapped', note: 'User needs to be invited' });
        }
      }
    }

    // Analyze teams
    const teams = data.teams;
    if (teams) {
      for (const t of teams) {
        const existing = await teamRepo.findOne({ where: { name: t.name, orgId } });
        preview.summary.teams.total++;
        if (existing) {
          preview.summary.teams.existing++;
          preview.details.teams.push({ name: t.name, status: 'existing', id: existing.id });
        } else {
          preview.summary.teams.new++;
          preview.details.teams.push({ name: t.name, status: 'new' });
        }
      }
    }

    // Analyze schedules
    const schedules = data.schedules;
    if (schedules) {
      for (const s of schedules) {
        const existing = await scheduleRepo.findOne({ where: { name: s.name, orgId } });
        preview.summary.schedules.total++;
        if (existing) {
          preview.summary.schedules.existing++;
          preview.details.schedules.push({ name: s.name, status: 'existing', id: existing.id });
        } else {
          preview.summary.schedules.new++;
          const layers = source === 'pagerduty' ? s.schedule_layers?.length : s.rotations?.length;
          preview.details.schedules.push({ name: s.name, status: 'new', layers: layers || 0 });
        }
      }
    }

    // Analyze escalation policies
    const policies = source === 'pagerduty' ? data.escalation_policies : data.escalations;
    if (policies) {
      for (const p of policies) {
        const existing = await policyRepo.findOne({ where: { name: p.name, orgId } });
        preview.summary.escalation_policies.total++;

        // Count steps and total targets
        const rules = source === 'pagerduty' ? p.escalation_rules : p.rules;
        const stepCount = rules?.length || 0;
        let totalTargets = 0;
        let multiTargetSteps = 0;

        if (rules) {
          for (const rule of rules) {
            const targets = source === 'pagerduty'
              ? rule.targets?.length || 0
              : (rule.recipients?.length || 1); // Opsgenie: use recipients or count 1 for single recipient

            totalTargets += targets;
            if (targets > 1) {
              multiTargetSteps++;
            }
          }
        }

        if (existing) {
          preview.summary.escalation_policies.existing++;
          preview.details.escalation_policies.push({
            name: p.name,
            status: 'existing',
            id: existing.id,
            steps: stepCount,
            totalTargets,
            multiTargetSteps,
          });
        } else {
          preview.summary.escalation_policies.new++;
          preview.details.escalation_policies.push({
            name: p.name,
            status: 'new',
            steps: stepCount,
            totalTargets,
            multiTargetSteps,
          });
        }
      }
    }

    // Analyze services
    const services = data.services;
    if (services) {
      for (const s of services) {
        const existing = await serviceRepo.findOne({ where: { name: s.name, orgId } });
        preview.summary.services.total++;

        // Check for external key based on source
        const externalKey = source === 'pagerduty' ? s.integration_key : s.apiKey;
        const hasExternalKey = preserveKeys && !!externalKey;

        if (hasExternalKey) {
          preview.summary.services.withExternalKeys++;
        }

        if (existing) {
          preview.summary.services.existing++;
          preview.details.services.push({
            name: s.name,
            status: 'existing',
            id: existing.id,
            externalKeyPreserved: hasExternalKey && !existing.externalKeys?.[source as 'pagerduty' | 'opsgenie'],
          });
        } else {
          preview.summary.services.new++;
          preview.details.services.push({
            name: s.name,
            status: 'new',
            externalKeyPreserved: hasExternalKey,
          });
        }
      }
    }

    return res.status(200).json(preview);
  } catch (error: any) {
    logger.error('Import preview failed:', error);
    return res.status(500).json({
      error: error.message,
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function getRotationType(turnLengthSeconds: number): 'daily' | 'weekly' | 'custom' {
  if (turnLengthSeconds === 86400) return 'daily';
  if (turnLengthSeconds === 604800) return 'weekly';
  return 'custom';
}

function mapOpsgenieRotationType(ogType: string): 'daily' | 'weekly' | 'custom' {
  switch (ogType?.toLowerCase()) {
    case 'daily':
      return 'daily';
    case 'weekly':
      return 'weekly';
    case 'hourly':
      return 'custom'; // Map hourly to custom with rotationLength
    default:
      return 'weekly';
  }
}

function extractTimeFromISO(isoString: string): string {
  try {
    const date = new Date(isoString);
    return `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}:00`;
  } catch {
    return '09:00:00';
  }
}

function convertRestrictions(pdRestrictions: any[]): any {
  return {
    type: 'weekly',
    intervals: pdRestrictions.map(r => ({
      type: r.type,
      startTime: r.start_time_of_day,
      durationSeconds: r.duration_seconds,
      startDayOfWeek: r.start_day_of_week,
    })),
  };
}

function convertOpsgenieRestrictions(timeRestriction: any): any {
  if (timeRestriction.type === 'time-of-day') {
    return {
      type: 'daily',
      intervals: [{
        startHour: timeRestriction.restriction?.startHour,
        startMin: timeRestriction.restriction?.startMin,
        endHour: timeRestriction.restriction?.endHour,
        endMin: timeRestriction.restriction?.endMin,
      }],
    };
  } else if (timeRestriction.type === 'weekday-and-time-of-day') {
    return {
      type: 'weekly',
      intervals: timeRestriction.restrictions || [],
    };
  }
  return null;
}

export default router;
