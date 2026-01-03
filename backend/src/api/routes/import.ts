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
  AlertRoutingRule,
  Heartbeat,
  MaintenanceWindow,
  ServiceDependency,
  Tag,
  EntityTag,
} from '../../shared/models';
import { EntityType } from '../../shared/models/EntityTag';
import { RoutingCondition, ConditionOperator, MatchType } from '../../shared/models/AlertRoutingRule';
import { authenticateRequest } from '../../shared/auth/middleware';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All import routes require authentication (supports JWT, service API key, and org API key)
router.use(authenticateRequest);

// ============================================================================
// PagerDuty Import API
// ============================================================================

interface PagerDutyImportData {
  users?: PagerDutyUser[];
  teams?: PagerDutyTeam[];
  schedules?: PagerDutySchedule[];
  escalation_policies?: PagerDutyEscalationPolicy[];
  services?: PagerDutyService[];
  routing_rules?: PagerDutyEventRule[];
  maintenance_windows?: PagerDutyMaintenanceWindow[];
  service_dependencies?: PagerDutyServiceDependency[];
}

interface PagerDutyServiceDependency {
  id: string;
  type?: string;
  supporting_service: {
    id: string;
    type?: string;
    summary?: string;
  };
  dependent_service: {
    id: string;
    type?: string;
    summary?: string;
  };
}

interface PagerDutyMaintenanceWindow {
  id: string;
  type?: string;
  summary?: string;
  description?: string;
  start_time: string;
  end_time: string;
  services?: Array<{ id: string; type?: string; summary?: string }>;
  teams?: Array<{ id: string; type?: string; summary?: string }>;
  created_by?: { id: string; type?: string; summary?: string };
}

interface PagerDutyEventRule {
  id: string;
  label?: string;
  disabled?: boolean;
  catch_all?: boolean;
  conditions?: {
    operator: 'and' | 'or';
    subconditions?: Array<{
      operator: string;
      path: string;
      value?: string | string[];
    }>;
  };
  actions?: {
    route?: { type: string; value: string }; // Route to service
    severity?: { type: string; value: string };
    event_action?: { value: string };
    extractions?: Array<{
      target: string;
      source: string;
      regex?: string;
    }>;
  };
  // Alternative structure for service-level event rules
  service?: { id: string };
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
  tags?: PagerDutyTag[];
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
  // Tags for categorization
  tags?: Array<{ id: string; type?: string; label?: string; summary?: string }>;
}

interface PagerDutyTag {
  id: string;
  type?: string;
  label?: string;
  summary?: string;
}

interface ImportOptions {
  /**
   * When true, preserves original PagerDuty/Opsgenie integration keys
   * so existing monitoring tools can send webhooks without reconfiguration.
   */
  preserveKeys?: boolean;
  /**
   * When true, validates the import without making changes (dry-run mode).
   */
  dryRun?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  summary: {
    users: { willCreate: number; willSkip: number; errors: string[] };
    teams: { willCreate: number; willSkip: number; errors: string[] };
    schedules: { willCreate: number; willSkip: number; errors: string[] };
    escalationPolicies: { willCreate: number; willSkip: number; errors: string[] };
    services: { willCreate: number; willSkip: number; errors: string[] };
    routingRules: { willCreate: number; willSkip: number; errors: string[] };
  };
  warnings: string[];
  errors: string[];
}

/**
 * Validate PagerDuty import (dry-run)
 * POST /api/v1/import/pagerduty/validate
 *
 * Validates import data without making changes.
 */
router.post('/pagerduty/validate', async (req: Request, res: Response) => {
  const user = req.user!;
  const orgId = user.orgId;

  const { data: importData }: { data: PagerDutyImportData } =
    req.body.data ? req.body : { data: req.body };

  const result: ValidationResult = {
    isValid: true,
    summary: {
      users: { willCreate: 0, willSkip: 0, errors: [] },
      teams: { willCreate: 0, willSkip: 0, errors: [] },
      schedules: { willCreate: 0, willSkip: 0, errors: [] },
      escalationPolicies: { willCreate: 0, willSkip: 0, errors: [] },
      services: { willCreate: 0, willSkip: 0, errors: [] },
      routingRules: { willCreate: 0, willSkip: 0, errors: [] },
    },
    warnings: [],
    errors: [],
  };

  try {
    const dataSource = await getDataSource();

    // Validate Users
    if (importData.users && importData.users.length > 0) {
      const userRepo = dataSource.getRepository(User);
      for (const pdUser of importData.users) {
        if (!pdUser.email) {
          result.summary.users.errors.push(`User ${pdUser.id || pdUser.name} missing email`);
          result.isValid = false;
          continue;
        }
        const existing = await userRepo.findOne({ where: { email: pdUser.email, orgId } });
        if (existing) {
          result.summary.users.willSkip++;
        } else {
          result.summary.users.willCreate++;
          result.warnings.push(`User ${pdUser.email} will need to set up authentication`);
        }
      }
    }

    // Validate Teams
    if (importData.teams && importData.teams.length > 0) {
      const teamRepo = dataSource.getRepository(Team);
      for (const pdTeam of importData.teams) {
        if (!pdTeam.name) {
          result.summary.teams.errors.push(`Team ${pdTeam.id} missing name`);
          result.isValid = false;
          continue;
        }
        const existing = await teamRepo.findOne({ where: { name: pdTeam.name, orgId } });
        if (existing) {
          result.summary.teams.willSkip++;
        } else {
          result.summary.teams.willCreate++;
        }
      }
    }

    // Validate Schedules
    if (importData.schedules && importData.schedules.length > 0) {
      const scheduleRepo = dataSource.getRepository(Schedule);
      for (const pdSchedule of importData.schedules) {
        if (!pdSchedule.name) {
          result.summary.schedules.errors.push(`Schedule ${pdSchedule.id} missing name`);
          result.isValid = false;
          continue;
        }
        const existing = await scheduleRepo.findOne({ where: { name: pdSchedule.name, orgId } });
        if (existing) {
          result.summary.schedules.willSkip++;
        } else {
          result.summary.schedules.willCreate++;
        }
        // Validate schedule layers have users
        if (pdSchedule.schedule_layers) {
          for (const layer of pdSchedule.schedule_layers) {
            if (!layer.users || layer.users.length === 0) {
              result.warnings.push(`Schedule "${pdSchedule.name}" layer "${layer.name}" has no users`);
            }
          }
        }
      }
    }

    // Validate Escalation Policies
    if (importData.escalation_policies && importData.escalation_policies.length > 0) {
      const policyRepo = dataSource.getRepository(EscalationPolicy);
      for (const pdPolicy of importData.escalation_policies) {
        if (!pdPolicy.name) {
          result.summary.escalationPolicies.errors.push(`Policy ${pdPolicy.id} missing name`);
          result.isValid = false;
          continue;
        }
        const existing = await policyRepo.findOne({ where: { name: pdPolicy.name, orgId } });
        if (existing) {
          result.summary.escalationPolicies.willSkip++;
        } else {
          result.summary.escalationPolicies.willCreate++;
        }
        // Validate escalation rules have targets
        if (!pdPolicy.escalation_rules || pdPolicy.escalation_rules.length === 0) {
          result.warnings.push(`Policy "${pdPolicy.name}" has no escalation rules`);
        }
      }
    }

    // Validate Services
    if (importData.services && importData.services.length > 0) {
      const serviceRepo = dataSource.getRepository(Service);
      for (const pdService of importData.services) {
        if (!pdService.name) {
          result.summary.services.errors.push(`Service ${pdService.id} missing name`);
          result.isValid = false;
          continue;
        }
        const existing = await serviceRepo.findOne({ where: { name: pdService.name, orgId } });
        if (existing) {
          result.summary.services.willSkip++;
        } else {
          result.summary.services.willCreate++;
        }
        // Check if escalation policy reference exists
        if (pdService.escalation_policy?.id) {
          const matchingPolicy = importData.escalation_policies?.find(p => p.id === pdService.escalation_policy?.id);
          if (!matchingPolicy) {
            result.warnings.push(`Service "${pdService.name}" references unknown escalation policy`);
          }
        }
      }
    }

    // Validate Routing Rules
    if (importData.routing_rules && importData.routing_rules.length > 0) {
      result.summary.routingRules.willCreate = importData.routing_rules.length;
    }

    // Set overall validity
    const allErrors = [
      ...result.summary.users.errors,
      ...result.summary.teams.errors,
      ...result.summary.schedules.errors,
      ...result.summary.escalationPolicies.errors,
      ...result.summary.services.errors,
      ...result.summary.routingRules.errors,
    ];
    result.errors = allErrors;
    result.isValid = allErrors.length === 0;

    logger.info('Import validation completed', {
      orgId,
      isValid: result.isValid,
      warnings: result.warnings.length,
      errors: result.errors.length,
    });

    res.json(result);
  } catch (error) {
    logger.error('Import validation failed', { error });
    res.status(500).json({ error: 'Validation failed', details: (error as Error).message });
  }
});

/**
 * Import from PagerDuty
 * POST /api/v1/import/pagerduty
 *
 * Accepts PagerDuty REST API export data and creates corresponding entities.
 */
router.post('/pagerduty', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const user = req.user!;
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
    routing_rules: { imported: 0, skipped: 0, errors: [] as string[] },
    maintenance_windows: { imported: 0, skipped: 0, errors: [] as string[] },
    service_dependencies: { imported: 0, skipped: 0, errors: [] as string[] },
    tags: { imported: 0, skipped: 0, errors: [] as string[] },
  };

  // Maps to track PagerDuty ID -> OnCallShift ID mappings
  const userIdMap = new Map<string, string>();
  const contactMethodIdMap = new Map<string, string>(); // PD contact method ID -> OnCallShift ID
  const teamIdMap = new Map<string, string>();
  const scheduleIdMap = new Map<string, string>();
  const policyIdMap = new Map<string, string>();
  const serviceIdMap = new Map<string, string>();
  const tagIdMap = new Map<string, string>(); // Tag name -> OnCallShift Tag ID

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
                } catch (error) {
                  results.contact_methods.errors.push(
                    `Contact for ${pdUser.email}: ${error instanceof Error ? error.message : String(error)}`
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
                } catch (error) {
                  results.notification_rules.errors.push(
                    `Rule for ${pdUser.email}: ${error instanceof Error ? error.message : String(error)}`
                  );
                }
              }
            }
          } else {
            // User doesn't exist - needs to be invited separately
            results.users.skipped++;
            logger.info('User not found, will need to be invited', { pdId: pdUser.id, email: pdUser.email });
          }
        } catch (error) {
          results.users.errors.push(`User ${pdUser.email}: ${error instanceof Error ? error.message : String(error)}`);
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
        } catch (error) {
          results.teams.errors.push(`Team ${pdTeam.name}: ${error instanceof Error ? error.message : String(error)}`);
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
        } catch (error) {
          results.schedules.errors.push(`Schedule ${pdSchedule.name}: ${error instanceof Error ? error.message : String(error)}`);
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
        } catch (error) {
          results.escalation_policies.errors.push(`Policy ${pdPolicy.name}: ${error instanceof Error ? error.message : String(error)}`);
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
            serviceIdMap.set(pdService.id, service.id);
            results.services.imported++;

            if (externalKeys) {
              logger.info('Service imported with preserved PagerDuty key', {
                serviceName: pdService.name,
                hasExternalKey: true,
              });
            }
          } else {
            serviceIdMap.set(pdService.id, service.id);
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
        } catch (error) {
          results.services.errors.push(`Service ${pdService.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // 6. Import Routing Rules (Event Rules)
    if (importData.routing_rules && importData.routing_rules.length > 0) {
      const routingRuleRepo = dataSource.getRepository(AlertRoutingRule);

      for (let i = 0; i < importData.routing_rules.length; i++) {
        const pdRule = importData.routing_rules[i];
        try {
          // Check if rule already exists by name
          const ruleName = pdRule.label || `Imported Rule ${i + 1}`;
          let rule = await routingRuleRepo.findOne({
            where: { name: ruleName, orgId },
          });

          if (!rule) {
            // Map PagerDuty conditions to OnCallShift format
            const conditions: RoutingCondition[] = [];
            if (pdRule.conditions?.subconditions) {
              for (const subcond of pdRule.conditions.subconditions) {
                const operator = mapPagerDutyOperator(subcond.operator);
                if (operator) {
                  conditions.push({
                    field: mapPagerDutyPath(subcond.path),
                    operator,
                    value: subcond.value || null,
                  });
                }
              }
            }

            // Map match type
            const matchType: MatchType = pdRule.conditions?.operator === 'or' ? 'any' : 'all';

            // Get target service
            const targetServiceId = pdRule.actions?.route?.value
              ? serviceIdMap.get(pdRule.actions.route.value) || null
              : pdRule.service?.id
                ? serviceIdMap.get(pdRule.service.id) || null
                : null;

            // Map severity
            const setSeverity = pdRule.actions?.severity?.value
              ? mapPagerDutySeverity(pdRule.actions.severity.value)
              : null;

            rule = routingRuleRepo.create({
              orgId,
              name: ruleName,
              description: pdRule.catch_all ? 'Catch-all rule (imported from PagerDuty)' : null,
              ruleOrder: i,
              enabled: !pdRule.disabled,
              matchType,
              conditions,
              targetServiceId,
              setSeverity,
            });
            await routingRuleRepo.save(rule);
            results.routing_rules.imported++;

            logger.info('Routing rule imported', {
              ruleName,
              conditionCount: conditions.length,
              hasTargetService: !!targetServiceId,
            });
          } else {
            results.routing_rules.skipped++;
          }
        } catch (error) {
          results.routing_rules.errors.push(`Rule ${pdRule.label || pdRule.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // 7. Import Maintenance Windows
    if (importData.maintenance_windows && importData.maintenance_windows.length > 0) {
      const maintenanceWindowRepo = dataSource.getRepository(MaintenanceWindow);

      for (const pdWindow of importData.maintenance_windows) {
        try {
          // Parse dates
          const startTime = new Date(pdWindow.start_time);
          const endTime = new Date(pdWindow.end_time);

          // Skip past maintenance windows
          if (endTime < new Date()) {
            results.maintenance_windows.skipped++;
            continue;
          }

          // Get the first service from the maintenance window
          // PagerDuty maintenance windows can cover multiple services
          const pdServiceId = pdWindow.services?.[0]?.id;
          let serviceId: string | undefined;

          if (pdServiceId) {
            serviceId = serviceIdMap.get(pdServiceId);
          }

          // If no mapped service, try to find any service in the org
          if (!serviceId) {
            const serviceRepo = dataSource.getRepository(Service);
            const anyService = await serviceRepo.findOne({
              where: { orgId },
              order: { createdAt: 'ASC' },
            });
            if (anyService) {
              serviceId = anyService.id;
            }
          }

          if (!serviceId) {
            results.maintenance_windows.errors.push(
              `Window ${pdWindow.summary || pdWindow.id}: No service found to associate`
            );
            continue;
          }

          // Check for duplicate by time range and service
          const existing = await maintenanceWindowRepo.findOne({
            where: {
              serviceId,
              startTime,
              endTime,
              orgId,
            },
          });

          if (!existing) {
            const maintenanceWindow = maintenanceWindowRepo.create({
              orgId,
              serviceId,
              startTime,
              endTime,
              description: pdWindow.description || pdWindow.summary || null,
              suppressAlerts: true,
            });
            await maintenanceWindowRepo.save(maintenanceWindow);
            results.maintenance_windows.imported++;

            logger.info('Maintenance window imported', {
              windowId: maintenanceWindow.id,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            });
          } else {
            results.maintenance_windows.skipped++;
          }
        } catch (error) {
          results.maintenance_windows.errors.push(
            `Window ${pdWindow.summary || pdWindow.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    // 8. Import Service Dependencies
    if (importData.service_dependencies && importData.service_dependencies.length > 0) {
      const dependencyRepo = dataSource.getRepository(ServiceDependency);

      for (const pdDep of importData.service_dependencies) {
        try {
          // Map PagerDuty service IDs to OnCallShift service IDs
          const supportingServiceId = serviceIdMap.get(pdDep.supporting_service.id);
          const dependentServiceId = serviceIdMap.get(pdDep.dependent_service.id);

          if (!supportingServiceId) {
            results.service_dependencies.errors.push(
              `Dependency ${pdDep.id}: Supporting service not found (${pdDep.supporting_service.summary || pdDep.supporting_service.id})`
            );
            continue;
          }

          if (!dependentServiceId) {
            results.service_dependencies.errors.push(
              `Dependency ${pdDep.id}: Dependent service not found (${pdDep.dependent_service.summary || pdDep.dependent_service.id})`
            );
            continue;
          }

          // Check if dependency already exists
          const existing = await dependencyRepo.findOne({
            where: {
              orgId,
              supportingServiceId,
              dependentServiceId,
            },
          });

          if (!existing) {
            const dependency = dependencyRepo.create({
              orgId,
              supportingServiceId,
              dependentServiceId,
              dependencyType: 'required', // PagerDuty doesn't have types, default to required
              impactLevel: 'high', // Default to high impact
              description: null,
            });
            await dependencyRepo.save(dependency);
            results.service_dependencies.imported++;

            logger.info('Service dependency imported', {
              dependencyId: dependency.id,
              supporting: pdDep.supporting_service.summary || pdDep.supporting_service.id,
              dependent: pdDep.dependent_service.summary || pdDep.dependent_service.id,
            });
          } else {
            results.service_dependencies.skipped++;
          }
        } catch (error) {
          results.service_dependencies.errors.push(
            `Dependency ${pdDep.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    // 9. Import Tags from all entities
    const tagRepo = dataSource.getRepository(Tag);
    const entityTagRepo = dataSource.getRepository(EntityTag);

    // Helper to get or create a tag by name
    async function getOrCreateTag(tagName: string): Promise<string> {
      const normalizedName = tagName.trim().toLowerCase();

      // Check cache first
      if (tagIdMap.has(normalizedName)) {
        return tagIdMap.get(normalizedName)!;
      }

      // Check if tag exists in database
      let tag = await tagRepo.findOne({
        where: { name: normalizedName, orgId },
      });

      if (!tag) {
        // Create new tag with a default color
        tag = tagRepo.create({
          orgId,
          name: normalizedName,
          color: getTagColor(normalizedName),
        });
        await tagRepo.save(tag);
        results.tags.imported++;
        logger.info('Tag created', { tagId: tag.id, name: normalizedName });
      } else {
        results.tags.skipped++;
      }

      tagIdMap.set(normalizedName, tag.id);
      return tag.id;
    }

    // Helper to associate a tag with an entity
    async function associateTag(
      tagId: string,
      entityType: EntityType,
      entityId: string
    ): Promise<void> {
      // Check if association already exists
      const existing = await entityTagRepo.findOne({
        where: { tagId, entityType, entityId, orgId },
      });

      if (!existing) {
        const entityTag = entityTagRepo.create({
          orgId,
          tagId,
          entityType,
          entityId,
        });
        await entityTagRepo.save(entityTag);
      }
    }

    // Process tags from services
    if (importData.services) {
      for (const pdService of importData.services) {
        if (pdService.tags && pdService.tags.length > 0) {
          const serviceId = serviceIdMap.get(pdService.id);
          if (serviceId) {
            for (const pdTag of pdService.tags) {
              try {
                const tagName = pdTag.label || pdTag.summary || pdTag.id;
                const tagId = await getOrCreateTag(tagName);
                await associateTag(tagId, 'service', serviceId);
              } catch (error) {
                results.tags.errors.push(`Service tag ${pdTag.label || pdTag.id}: ${error instanceof Error ? error.message : String(error)}`);
              }
            }
          }
        }
      }
    }

    // Process tags from teams
    if (importData.teams) {
      for (const pdTeam of importData.teams) {
        if (pdTeam.tags && pdTeam.tags.length > 0) {
          const teamId = teamIdMap.get(pdTeam.id);
          if (teamId) {
            for (const pdTag of pdTeam.tags) {
              try {
                const tagName = pdTag.label || pdTag.summary || pdTag.id;
                const tagId = await getOrCreateTag(tagName);
                await associateTag(tagId, 'team', teamId);
              } catch (error) {
                results.tags.errors.push(`Team tag ${pdTag.label || pdTag.id}: ${error instanceof Error ? error.message : String(error)}`);
              }
            }
          }
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
  } catch (error) {
    logger.error('PagerDuty import failed:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
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
  alert_policies?: OpsgenieAlertPolicy[];
  heartbeats?: OpsgenieHeartbeat[];
  maintenance_windows?: OpsgenieMaintenanceWindow[];
}

interface OpsgenieMaintenanceWindow {
  id: string;
  description?: string;
  time: {
    type: 'schedule' | 'for-5-minutes' | 'for-30-minutes' | 'for-1-hour' | 'indefinitely';
    startDate?: string;
    endDate?: string;
  };
  rules?: Array<{
    state: string;
    entity?: { id: string; type: string };
  }>;
}

interface OpsgenieHeartbeat {
  name: string;
  description?: string;
  interval: number; // minutes
  intervalUnit: 'minutes' | 'hours' | 'days';
  enabled?: boolean;
  ownerTeam?: { id: string; name: string };
  alertMessage?: string;
  alertTags?: string[];
  alertPriority?: string;
}

interface OpsgenieAlertPolicy {
  id: string;
  name: string;
  enabled?: boolean;
  policyDescription?: string;
  filter?: {
    type: string;
    conditions?: Array<{
      field: string;
      operation: string;
      expectedValue?: string;
      not?: boolean;
    }>;
    conditionMatchType?: 'match-all' | 'match-any-condition' | 'match-all-conditions';
  };
  message?: string;
  responders?: Array<{
    type: string;
    id?: string;
    name?: string;
    username?: string;
  }>;
  priority?: string;
  order?: number;
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
  tags?: string[];
}

// Time restriction types for Opsgenie schedules
interface OpsgenieTimeOfDayRestriction {
  startHour?: number;
  startMin?: number;
  endHour?: number;
  endMin?: number;
}

interface OpsgenieWeekdayRestriction {
  startDay?: string;
  endDay?: string;
  startHour?: number;
  startMin?: number;
  endHour?: number;
  endMin?: number;
}

interface OpsgenieTimeRestriction {
  type: 'time-of-day' | 'weekday-and-time-of-day';
  restriction?: OpsgenieTimeOfDayRestriction;
  restrictions?: OpsgenieWeekdayRestriction[];
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
    timeRestriction?: OpsgenieTimeRestriction;
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
  tags?: string[];
}

/**
 * Import from Opsgenie
 * POST /api/v1/import/opsgenie
 *
 * Accepts Opsgenie REST API export data and creates corresponding entities.
 */
router.post('/opsgenie', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const user = req.user!;
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
    routing_rules: { imported: 0, skipped: 0, errors: [] as string[] },
    heartbeats: { imported: 0, skipped: 0, errors: [] as string[] },
    maintenance_windows: { imported: 0, skipped: 0, errors: [] as string[] },
    tags: { imported: 0, skipped: 0, errors: [] as string[] },
  };

  const userIdMap = new Map<string, string>();
  const contactMethodIdMap = new Map<string, string>();
  const teamIdMap = new Map<string, string>();
  const tagIdMap = new Map<string, string>(); // Tag name -> OnCallShift Tag ID
  const scheduleIdMap = new Map<string, string>();
  const escalationIdMap = new Map<string, string>();
  const serviceIdMap = new Map<string, string>();

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
                } catch (error) {
                  results.contact_methods.errors.push(
                    `Contact for ${ogUser.username}: ${error instanceof Error ? error.message : String(error)}`
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
                } catch (error) {
                  results.notification_rules.errors.push(
                    `Rule for ${ogUser.username}: ${error instanceof Error ? error.message : String(error)}`
                  );
                }
              }
            }
          } else {
            results.users.skipped++;
            logger.info('User not found, will need to be invited', { ogId: ogUser.id, email: ogUser.username });
          }
        } catch (error) {
          results.users.errors.push(`User ${ogUser.username}: ${error instanceof Error ? error.message : String(error)}`);
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
        } catch (error) {
          results.teams.errors.push(`Team ${ogTeam.name}: ${error instanceof Error ? error.message : String(error)}`);
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
        } catch (error) {
          results.schedules.errors.push(`Schedule ${ogSchedule.name}: ${error instanceof Error ? error.message : String(error)}`);
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
        } catch (error) {
          results.escalations.errors.push(`Escalation ${ogEscalation.name}: ${error instanceof Error ? error.message : String(error)}`);
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
            serviceIdMap.set(ogService.id, service.id);
            results.services.imported++;

            if (externalKeys) {
              logger.info('Service imported with preserved Opsgenie key', {
                serviceName: ogService.name,
                hasExternalKey: true,
              });
            }
          } else {
            serviceIdMap.set(ogService.id, service.id);
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
        } catch (error) {
          results.services.errors.push(`Service ${ogService.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // 6. Import Alert Policies (Routing Rules)
    if (importData.alert_policies && importData.alert_policies.length > 0) {
      const routingRuleRepo = dataSource.getRepository(AlertRoutingRule);

      for (let i = 0; i < importData.alert_policies.length; i++) {
        const ogPolicy = importData.alert_policies[i];
        try {
          // Check if rule already exists by name
          let rule = await routingRuleRepo.findOne({
            where: { name: ogPolicy.name, orgId },
          });

          if (!rule) {
            // Map Opsgenie conditions to OnCallShift format
            const conditions: RoutingCondition[] = [];
            if (ogPolicy.filter?.conditions) {
              for (const cond of ogPolicy.filter.conditions) {
                const operator = mapOpsgenieOperator(cond.operation);
                if (operator) {
                  conditions.push({
                    field: mapOpsgenieField(cond.field),
                    operator,
                    value: cond.expectedValue || null,
                  });
                }
              }
            }

            // Map match type
            let matchType: MatchType = 'all';
            if (ogPolicy.filter?.conditionMatchType === 'match-any-condition') {
              matchType = 'any';
            }

            // Map severity from priority
            const setSeverity = ogPolicy.priority
              ? mapOpsgeniePriority(ogPolicy.priority)
              : null;

            rule = routingRuleRepo.create({
              orgId,
              name: ogPolicy.name,
              description: ogPolicy.policyDescription || null,
              ruleOrder: ogPolicy.order ?? i,
              enabled: ogPolicy.enabled !== false,
              matchType,
              conditions,
              targetServiceId: null, // Opsgenie policies don't typically route to services
              setSeverity,
            });
            await routingRuleRepo.save(rule);
            results.routing_rules.imported++;

            logger.info('Alert policy imported', {
              policyName: ogPolicy.name,
              conditionCount: conditions.length,
            });
          } else {
            results.routing_rules.skipped++;
          }
        } catch (error) {
          results.routing_rules.errors.push(`Policy ${ogPolicy.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // 7. Import Heartbeats
    if (importData.heartbeats && importData.heartbeats.length > 0) {
      const heartbeatRepo = dataSource.getRepository(Heartbeat);

      for (const ogHeartbeat of importData.heartbeats) {
        try {
          // Check if heartbeat with same name exists
          const existing = await heartbeatRepo.findOne({
            where: { name: ogHeartbeat.name, orgId },
          });

          if (!existing) {
            // Convert interval to seconds
            let intervalSeconds = ogHeartbeat.interval;
            switch (ogHeartbeat.intervalUnit) {
              case 'hours':
                intervalSeconds = ogHeartbeat.interval * 60 * 60;
                break;
              case 'days':
                intervalSeconds = ogHeartbeat.interval * 24 * 60 * 60;
                break;
              case 'minutes':
              default:
                intervalSeconds = ogHeartbeat.interval * 60;
                break;
            }

            const heartbeat = heartbeatRepo.create({
              orgId,
              name: ogHeartbeat.name,
              description: ogHeartbeat.description || null,
              intervalSeconds,
              alertAfterMissedCount: 1, // Default to alert after 1 missed ping
              enabled: ogHeartbeat.enabled !== false,
              status: 'unknown',
              externalId: ogHeartbeat.name, // Use name as external ID for Opsgenie
            });
            await heartbeatRepo.save(heartbeat);
            results.heartbeats.imported++;

            logger.info('Heartbeat imported', {
              heartbeatName: ogHeartbeat.name,
              intervalSeconds,
            });
          } else {
            results.heartbeats.skipped++;
          }
        } catch (error) {
          results.heartbeats.errors.push(`Heartbeat ${ogHeartbeat.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // 8. Import Maintenance Windows
    if (importData.maintenance_windows && importData.maintenance_windows.length > 0) {
      const maintenanceWindowRepo = dataSource.getRepository(MaintenanceWindow);

      for (const ogWindow of importData.maintenance_windows) {
        try {
          // Parse dates based on time type
          let startTime: Date;
          let endTime: Date;

          if (ogWindow.time.type === 'schedule' && ogWindow.time.startDate && ogWindow.time.endDate) {
            startTime = new Date(ogWindow.time.startDate);
            endTime = new Date(ogWindow.time.endDate);
          } else {
            // For quick maintenance windows (for-5-minutes, for-30-minutes, etc.)
            // These are typically already started, so we skip past ones
            startTime = new Date();
            switch (ogWindow.time.type) {
              case 'for-5-minutes':
                endTime = new Date(startTime.getTime() + 5 * 60 * 1000);
                break;
              case 'for-30-minutes':
                endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
                break;
              case 'for-1-hour':
                endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
                break;
              case 'indefinitely':
                // Set to 1 year from now for indefinite windows
                endTime = new Date(startTime.getTime() + 365 * 24 * 60 * 60 * 1000);
                break;
              default:
                endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour
            }
          }

          // Skip past maintenance windows
          if (endTime < new Date()) {
            results.maintenance_windows.skipped++;
            continue;
          }

          // Get service ID from rules if available
          let serviceId: string | undefined;
          if (ogWindow.rules && ogWindow.rules.length > 0) {
            for (const rule of ogWindow.rules) {
              if (rule.entity?.type === 'integration' && rule.entity.id) {
                // Try to find service by mapped ID
                serviceId = serviceIdMap.get(rule.entity.id);
                if (serviceId) break;
              }
            }
          }

          // If no mapped service, try to find any service in the org
          if (!serviceId) {
            const serviceRepo = dataSource.getRepository(Service);
            const anyService = await serviceRepo.findOne({
              where: { orgId },
              order: { createdAt: 'ASC' },
            });
            if (anyService) {
              serviceId = anyService.id;
            }
          }

          if (!serviceId) {
            results.maintenance_windows.errors.push(
              `Window ${ogWindow.id}: No service found to associate`
            );
            continue;
          }

          // Check for duplicate by time range and service
          const existing = await maintenanceWindowRepo.findOne({
            where: {
              serviceId,
              startTime,
              endTime,
              orgId,
            },
          });

          if (!existing) {
            const maintenanceWindow = maintenanceWindowRepo.create({
              orgId,
              serviceId,
              startTime,
              endTime,
              description: ogWindow.description || null,
              suppressAlerts: true,
            });
            await maintenanceWindowRepo.save(maintenanceWindow);
            results.maintenance_windows.imported++;

            logger.info('Maintenance window imported', {
              windowId: maintenanceWindow.id,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            });
          } else {
            results.maintenance_windows.skipped++;
          }
        } catch (error) {
          results.maintenance_windows.errors.push(
            `Window ${ogWindow.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    // 9. Import Tags from all entities
    const tagRepo = dataSource.getRepository(Tag);
    const entityTagRepo = dataSource.getRepository(EntityTag);

    // Helper to get or create a tag by name
    async function getOrCreateTag(tagName: string): Promise<string> {
      const normalizedName = tagName.trim().toLowerCase();

      // Check cache first
      if (tagIdMap.has(normalizedName)) {
        return tagIdMap.get(normalizedName)!;
      }

      // Check if tag exists in database
      let tag = await tagRepo.findOne({
        where: { name: normalizedName, orgId },
      });

      if (!tag) {
        // Create new tag with a default color
        tag = tagRepo.create({
          orgId,
          name: normalizedName,
          color: getTagColor(normalizedName),
        });
        await tagRepo.save(tag);
        results.tags.imported++;
        logger.info('Tag created', { tagId: tag.id, name: normalizedName });
      } else {
        results.tags.skipped++;
      }

      tagIdMap.set(normalizedName, tag.id);
      return tag.id;
    }

    // Helper to associate a tag with an entity
    async function associateTag(
      tagId: string,
      entityType: EntityType,
      entityId: string
    ): Promise<void> {
      // Check if association already exists
      const existing = await entityTagRepo.findOne({
        where: { tagId, entityType, entityId, orgId },
      });

      if (!existing) {
        const entityTag = entityTagRepo.create({
          orgId,
          tagId,
          entityType,
          entityId,
        });
        await entityTagRepo.save(entityTag);
      }
    }

    // Process tags from services (Opsgenie uses string arrays)
    if (importData.services) {
      for (const ogService of importData.services) {
        if (ogService.tags && ogService.tags.length > 0) {
          const serviceId = serviceIdMap.get(ogService.id);
          if (serviceId) {
            for (const tagName of ogService.tags) {
              try {
                const tagId = await getOrCreateTag(tagName);
                await associateTag(tagId, 'service', serviceId);
              } catch (error) {
                results.tags.errors.push(`Service tag ${tagName}: ${error instanceof Error ? error.message : String(error)}`);
              }
            }
          }
        }
      }
    }

    // Process tags from teams (Opsgenie uses string arrays)
    if (importData.teams) {
      for (const ogTeam of importData.teams) {
        if (ogTeam.tags && ogTeam.tags.length > 0) {
          const teamId = teamIdMap.get(ogTeam.id);
          if (teamId) {
            for (const tagName of ogTeam.tags) {
              try {
                const tagId = await getOrCreateTag(tagName);
                await associateTag(tagId, 'team', teamId);
              } catch (error) {
                results.tags.errors.push(`Team tag ${tagName}: ${error instanceof Error ? error.message : String(error)}`);
              }
            }
          }
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
  } catch (error) {
    logger.error('Opsgenie import failed:', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
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
// Preview detail types for type-safe preview responses
interface PreviewUserDetail {
  email: string;
  status: 'existing' | 'unmapped';
  id?: string;
  note?: string;
}

interface PreviewContactMethodDetail {
  userEmail: string;
  type: string;
  address: string;
  status: 'existing' | 'new';
}

interface PreviewNotificationRuleDetail {
  userEmail: string;
  ruleCount: number;
  status: 'new';
  note?: string;
}

interface PreviewTeamDetail {
  name: string;
  status: 'existing' | 'new';
  id?: string;
}

interface PreviewScheduleDetail {
  name: string;
  status: 'existing' | 'new';
  id?: string;
  layers?: number;
}

interface PreviewEscalationPolicyDetail {
  name: string;
  status: 'existing' | 'new';
  id?: string;
  steps: number;
  totalTargets: number;
  multiTargetSteps: number;
}

interface PreviewServiceDetail {
  name: string;
  status: 'existing' | 'new';
  id?: string;
  externalKeyPreserved?: boolean;
}

interface PreviewRoutingRuleDetail {
  name: string;
  status: 'existing' | 'new';
  id?: string;
  conditions: number;
  enabled: boolean;
  targetServiceName?: string;
}

interface PreviewHeartbeatDetail {
  name: string;
  status: 'existing' | 'new';
  id?: string;
  intervalSeconds: number;
  enabled: boolean;
}

interface PreviewMaintenanceWindowDetail {
  description: string;
  status: 'existing' | 'new' | 'skipped';
  id?: string;
  reason?: string;
  startTime: string;
  endTime: string;
  note?: string;
}

interface PreviewServiceDependencyDetail {
  supporting: string;
  dependent: string;
  status: 'existing' | 'new' | 'unmapped';
  id?: string;
  reason?: string;
}

interface PreviewTagDetail {
  name: string;
  status: 'existing' | 'new';
  id?: string;
  color?: string;
}

router.post('/preview', async (req: Request, res: Response) => {
  const user = req.user!;
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
        routing_rules: { total: 0, existing: 0, new: 0, totalConditions: 0 },
        heartbeats: { total: 0, existing: 0, new: 0 },
        maintenance_windows: { total: 0, existing: 0, new: 0, skippedPast: 0 },
        service_dependencies: { total: 0, existing: 0, new: 0, unmappedServices: 0 },
        tags: { total: 0, existing: 0, new: 0, associations: 0 },
      },
      details: {
        users: [] as PreviewUserDetail[],
        contact_methods: [] as PreviewContactMethodDetail[],
        notification_rules: [] as PreviewNotificationRuleDetail[],
        teams: [] as PreviewTeamDetail[],
        schedules: [] as PreviewScheduleDetail[],
        escalation_policies: [] as PreviewEscalationPolicyDetail[],
        services: [] as PreviewServiceDetail[],
        routing_rules: [] as PreviewRoutingRuleDetail[],
        heartbeats: [] as PreviewHeartbeatDetail[],
        maintenance_windows: [] as PreviewMaintenanceWindowDetail[],
        service_dependencies: [] as PreviewServiceDependencyDetail[],
        tags: [] as PreviewTagDetail[],
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
              type ContactType = 'email' | 'sms' | 'phone' | 'push';
              const typeMapping: Record<string, ContactType> = source === 'pagerduty'
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

              const contactType: ContactType = typeMapping[source === 'pagerduty' ? cm.type : cm.method] || 'email';
              const address = source === 'pagerduty' ? cm.address : cm.to;

              const existingContact = await contactMethodRepo.findOne({
                where: { userId: existing.id, type: contactType, address },
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
              : notificationRules.reduce((acc: number, r: { steps?: unknown[] }) => acc + (r.steps?.length || 0), 0);

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

    // Analyze routing rules
    const routingRuleRepo = dataSource.getRepository(AlertRoutingRule);
    const routingRules = source === 'pagerduty' ? data.routing_rules : data.alert_policies;
    if (routingRules) {
      for (const rule of routingRules) {
        const ruleName = source === 'pagerduty'
          ? (rule.label || `Event Rule ${rule.id}`)
          : rule.name;

        // Count conditions
        let conditionCount = 0;
        if (source === 'pagerduty') {
          conditionCount = rule.conditions?.subconditions?.length || 0;
        } else {
          conditionCount = rule.filter?.conditions?.length || 0;
        }

        // Check if rule exists by name
        const existing = await routingRuleRepo.findOne({ where: { name: ruleName, orgId } });
        preview.summary.routing_rules.total++;
        preview.summary.routing_rules.totalConditions += conditionCount;

        // Get target service name if available
        let targetServiceName: string | undefined;
        if (source === 'pagerduty' && rule.actions?.route?.value) {
          const targetService = services?.find((s: { id: string; name?: string }) => s.id === rule.actions.route.value);
          targetServiceName = targetService?.name;
        }

        if (existing) {
          preview.summary.routing_rules.existing++;
          preview.details.routing_rules.push({
            name: ruleName,
            status: 'existing',
            id: existing.id,
            conditions: conditionCount,
            enabled: source === 'pagerduty' ? !rule.disabled : (rule.enabled !== false),
            targetServiceName,
          });
        } else {
          preview.summary.routing_rules.new++;
          preview.details.routing_rules.push({
            name: ruleName,
            status: 'new',
            conditions: conditionCount,
            enabled: source === 'pagerduty' ? !rule.disabled : (rule.enabled !== false),
            targetServiceName,
          });
        }
      }
    }

    // Analyze heartbeats (Opsgenie only)
    if (source === 'opsgenie' && data.heartbeats) {
      const heartbeatRepo = dataSource.getRepository(Heartbeat);

      for (const hb of data.heartbeats) {
        const existing = await heartbeatRepo.findOne({ where: { name: hb.name, orgId } });
        preview.summary.heartbeats.total++;

        // Convert interval to seconds for display
        let intervalSeconds = hb.interval;
        switch (hb.intervalUnit) {
          case 'hours':
            intervalSeconds = hb.interval * 60 * 60;
            break;
          case 'days':
            intervalSeconds = hb.interval * 24 * 60 * 60;
            break;
          case 'minutes':
          default:
            intervalSeconds = hb.interval * 60;
            break;
        }

        if (existing) {
          preview.summary.heartbeats.existing++;
          preview.details.heartbeats.push({
            name: hb.name,
            status: 'existing',
            id: existing.id,
            intervalSeconds,
            enabled: hb.enabled !== false,
          });
        } else {
          preview.summary.heartbeats.new++;
          preview.details.heartbeats.push({
            name: hb.name,
            status: 'new',
            intervalSeconds,
            enabled: hb.enabled !== false,
          });
        }
      }
    }

    // Analyze maintenance windows
    const maintenanceWindows = data.maintenance_windows;
    if (maintenanceWindows) {
      const maintenanceWindowRepo = dataSource.getRepository(MaintenanceWindow);
      const now = new Date();

      for (const mw of maintenanceWindows) {
        preview.summary.maintenance_windows.total++;

        // Parse dates based on source
        let startTime: Date;
        let endTime: Date;
        let description: string | undefined;

        if (source === 'pagerduty') {
          startTime = new Date(mw.start_time);
          endTime = new Date(mw.end_time);
          description = mw.description || mw.summary;
        } else {
          // Opsgenie
          if (mw.time?.type === 'schedule' && mw.time.startDate && mw.time.endDate) {
            startTime = new Date(mw.time.startDate);
            endTime = new Date(mw.time.endDate);
          } else {
            // Quick maintenance windows - approximate
            startTime = now;
            switch (mw.time?.type) {
              case 'for-5-minutes':
                endTime = new Date(now.getTime() + 5 * 60 * 1000);
                break;
              case 'for-30-minutes':
                endTime = new Date(now.getTime() + 30 * 60 * 1000);
                break;
              case 'for-1-hour':
                endTime = new Date(now.getTime() + 60 * 60 * 1000);
                break;
              case 'indefinitely':
                endTime = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
                break;
              default:
                endTime = new Date(now.getTime() + 60 * 60 * 1000);
            }
          }
          description = mw.description;
        }

        // Skip past maintenance windows
        if (endTime < now) {
          preview.summary.maintenance_windows.skippedPast++;
          preview.details.maintenance_windows.push({
            description: description || `Window ${mw.id}`,
            status: 'skipped',
            reason: 'past',
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          });
          continue;
        }

        // Check for existing maintenance window
        const anyService = await serviceRepo.findOne({
          where: { orgId },
          order: { createdAt: 'ASC' },
        });

        if (anyService) {
          const existing = await maintenanceWindowRepo.findOne({
            where: {
              serviceId: anyService.id,
              startTime,
              endTime,
              orgId,
            },
          });

          if (existing) {
            preview.summary.maintenance_windows.existing++;
            preview.details.maintenance_windows.push({
              description: description || `Window ${mw.id}`,
              status: 'existing',
              id: existing.id,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            });
          } else {
            preview.summary.maintenance_windows.new++;
            preview.details.maintenance_windows.push({
              description: description || `Window ${mw.id}`,
              status: 'new',
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            });
          }
        } else {
          preview.summary.maintenance_windows.new++;
          preview.details.maintenance_windows.push({
            description: description || `Window ${mw.id}`,
            status: 'new',
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            note: 'Will be associated with first imported service',
          });
        }
      }
    }

    // Analyze service dependencies (PagerDuty only)
    if (source === 'pagerduty' && data.service_dependencies) {
      const dependencyRepo = dataSource.getRepository(ServiceDependency);

      // Build a map of service names to IDs for lookup
      const serviceNameMap = new Map<string, string>();
      const services = data.services || [];
      for (const s of services) {
        const existingService = await serviceRepo.findOne({ where: { name: s.name, orgId } });
        if (existingService) {
          serviceNameMap.set(s.id, existingService.id);
        }
      }

      for (const dep of data.service_dependencies) {
        preview.summary.service_dependencies.total++;

        const supportingServiceId = serviceNameMap.get(dep.supporting_service.id);
        const dependentServiceId = serviceNameMap.get(dep.dependent_service.id);

        // Check if either service is unmapped
        if (!supportingServiceId || !dependentServiceId) {
          preview.summary.service_dependencies.unmappedServices++;
          preview.details.service_dependencies.push({
            supporting: dep.supporting_service.summary || dep.supporting_service.id,
            dependent: dep.dependent_service.summary || dep.dependent_service.id,
            status: 'unmapped',
            reason: !supportingServiceId && !dependentServiceId
              ? 'Both services not found'
              : !supportingServiceId
                ? 'Supporting service not found'
                : 'Dependent service not found',
          });
          continue;
        }

        // Check if dependency already exists
        const existing = await dependencyRepo.findOne({
          where: {
            orgId,
            supportingServiceId,
            dependentServiceId,
          },
        });

        if (existing) {
          preview.summary.service_dependencies.existing++;
          preview.details.service_dependencies.push({
            supporting: dep.supporting_service.summary || dep.supporting_service.id,
            dependent: dep.dependent_service.summary || dep.dependent_service.id,
            status: 'existing',
            id: existing.id,
          });
        } else {
          preview.summary.service_dependencies.new++;
          preview.details.service_dependencies.push({
            supporting: dep.supporting_service.summary || dep.supporting_service.id,
            dependent: dep.dependent_service.summary || dep.dependent_service.id,
            status: 'new',
          });
        }
      }
    }

    // Analyze tags from all entities
    const tagRepo = dataSource.getRepository(Tag);
    const tagNamesSet = new Set<string>();
    const tagAssociations: Array<{ tag: string; entityType: string; entityName: string }> = [];

    // Collect tags from services
    const dataServices = data.services || [];
    for (const svc of dataServices) {
      const serviceTags = source === 'pagerduty'
        ? (svc.tags || []).map((t: { label?: string; summary?: string; id: string }) => t.label || t.summary || t.id)
        : (svc.tags || []);

      for (const tagName of serviceTags) {
        tagNamesSet.add(tagName.toLowerCase().trim());
        tagAssociations.push({ tag: tagName, entityType: 'service', entityName: svc.name });
      }
    }

    // Collect tags from teams
    const dataTeams = data.teams || [];
    for (const tm of dataTeams) {
      const teamTags = source === 'pagerduty'
        ? (tm.tags || []).map((tag: { label?: string; summary?: string; id: string }) => tag.label || tag.summary || tag.id)
        : (tm.tags || []);

      for (const tagName of teamTags) {
        tagNamesSet.add(tagName.toLowerCase().trim());
        tagAssociations.push({ tag: tagName, entityType: 'team', entityName: tm.name });
      }
    }

    // Analyze each unique tag
    for (const tagName of tagNamesSet) {
      preview.summary.tags.total++;

      const existing = await tagRepo.findOne({
        where: { name: tagName, orgId },
      });

      if (existing) {
        preview.summary.tags.existing++;
        preview.details.tags.push({
          name: tagName,
          status: 'existing',
          id: existing.id,
          color: existing.color,
        });
      } else {
        preview.summary.tags.new++;
        preview.details.tags.push({
          name: tagName,
          status: 'new',
          color: getTagColor(tagName),
        });
      }
    }

    // Count associations
    preview.summary.tags.associations = tagAssociations.length;

    return res.status(200).json(preview);
  } catch (error) {
    logger.error('Import preview failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a consistent color for a tag based on its name
 */
function getTagColor(tagName: string): string {
  // Predefined colors for common tag names
  const colorMap: Record<string, string> = {
    'production': '#dc2626',    // Red
    'staging': '#f97316',       // Orange
    'development': '#22c55e',   // Green
    'critical': '#b91c1c',      // Dark red
    'high-priority': '#ea580c', // Dark orange
    'low-priority': '#16a34a',  // Dark green
    'urgent': '#dc2626',        // Red
    'backend': '#3b82f6',       // Blue
    'frontend': '#8b5cf6',      // Purple
    'database': '#06b6d4',      // Cyan
    'api': '#0ea5e9',           // Light blue
    'infrastructure': '#6366f1',// Indigo
    'security': '#ef4444',      // Red
    'monitoring': '#10b981',    // Emerald
  };

  const normalizedName = tagName.toLowerCase();
  if (colorMap[normalizedName]) {
    return colorMap[normalizedName];
  }

  // Generate a hash-based color for unknown tags
  let hash = 0;
  for (let i = 0; i < normalizedName.length; i++) {
    hash = normalizedName.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Convert hash to HSL color (saturation 60%, lightness 50%)
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 60%, 50%)`;
}

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

// Schedule restriction types for converted data
// Note: The LayerRestrictions type in the ScheduleLayer model requires 'weekly' type
// with specific interval format. These conversion functions produce compatible output.
interface PagerDutyRestriction {
  type: string;
  start_time_of_day: string;
  duration_seconds: number;
  start_day_of_week?: number;
}

/**
 * Convert PagerDuty schedule restrictions to LayerRestrictions format.
 * Returns the data structure expected by ScheduleLayer.restrictions.
 */
function convertRestrictions(pdRestrictions: PagerDutyRestriction[]): Record<string, unknown> {
  // Convert PagerDuty restrictions to our format
  // PagerDuty uses start_day_of_week (1=Monday) and duration_seconds
  // We convert to startDay/endDay with startTime/endTime
  const intervals = pdRestrictions.map(r => {
    const startDay = r.start_day_of_week !== undefined ? r.start_day_of_week : 0;
    const startTime = r.start_time_of_day;

    // Calculate end time based on duration
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const endTotalMinutes = startHour * 60 + startMinute + Math.floor(r.duration_seconds / 60);
    const endHour = Math.floor(endTotalMinutes / 60) % 24;
    const endMinute = endTotalMinutes % 60;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

    // Calculate end day (may be same or next day)
    const daySpan = Math.floor(endTotalMinutes / (24 * 60));
    const endDay = (startDay + daySpan) % 7;

    return {
      startDay,
      startTime,
      endDay,
      endTime,
    };
  });

  return {
    type: 'weekly',
    intervals,
  };
}

/**
 * Convert Opsgenie time restrictions to LayerRestrictions format.
 * Returns the data structure expected by ScheduleLayer.restrictions.
 */
function convertOpsgenieRestrictions(timeRestriction: OpsgenieTimeRestriction): Record<string, unknown> | null {
  if (timeRestriction.type === 'time-of-day') {
    // Daily restriction - convert to weekly format that applies every day
    const startHour = timeRestriction.restriction?.startHour ?? 0;
    const startMin = timeRestriction.restriction?.startMin ?? 0;
    const endHour = timeRestriction.restriction?.endHour ?? 23;
    const endMin = timeRestriction.restriction?.endMin ?? 59;

    const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

    // Create intervals for each day of the week
    const intervals = [];
    for (let day = 0; day < 7; day++) {
      intervals.push({
        startDay: day,
        startTime,
        endDay: day,
        endTime,
      });
    }

    return {
      type: 'weekly',
      intervals,
    };
  } else if (timeRestriction.type === 'weekday-and-time-of-day') {
    // Weekly restrictions - convert Opsgenie format to our format
    const intervals = (timeRestriction.restrictions || []).map(r => {
      // Opsgenie uses day names, convert to numbers (0=Sunday)
      const dayMap: Record<string, number> = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6,
      };

      const startDay = r.startDay ? dayMap[r.startDay.toLowerCase()] ?? 0 : 0;
      const endDay = r.endDay ? dayMap[r.endDay.toLowerCase()] ?? 0 : startDay;

      const startTime = `${String(r.startHour ?? 0).padStart(2, '0')}:${String(r.startMin ?? 0).padStart(2, '0')}`;
      const endTime = `${String(r.endHour ?? 23).padStart(2, '0')}:${String(r.endMin ?? 59).padStart(2, '0')}`;

      return {
        startDay,
        startTime,
        endDay,
        endTime,
      };
    });

    return {
      type: 'weekly',
      intervals,
    };
  }
  return null;
}

// Routing rule mapping helpers

/**
 * Map PagerDuty event rule operator to OnCallShift condition operator
 */
function mapPagerDutyOperator(pdOperator: string): ConditionOperator | null {
  const mapping: Record<string, ConditionOperator> = {
    'equals': 'equals',
    'contains': 'contains',
    'matches': 'regex',
    'exists': 'exists',
    'startsWith': 'starts_with',
    'endsWith': 'ends_with',
    // Negated operators
    'nequals': 'not_equals',
    'ncontains': 'not_contains',
    'nexists': 'not_exists',
  };
  return mapping[pdOperator] || null;
}

/**
 * Map PagerDuty event path to OnCallShift field name
 */
function mapPagerDutyPath(pdPath: string): string {
  const mapping: Record<string, string> = {
    'event.source': 'source',
    'event.summary': 'summary',
    'event.severity': 'severity',
    'event.component': 'component',
    'event.group': 'group',
    'event.class': 'class',
    'event.custom_details': 'details',
  };

  // Check for exact match
  if (mapping[pdPath]) {
    return mapping[pdPath];
  }

  // Handle custom_details paths like event.custom_details.environment
  if (pdPath.startsWith('event.custom_details.')) {
    return pdPath.replace('event.custom_details.', 'details.');
  }

  // Default: strip 'event.' prefix if present
  return pdPath.replace(/^event\./, '');
}

/**
 * Map PagerDuty severity to OnCallShift severity
 */
function mapPagerDutySeverity(pdSeverity: string): 'info' | 'warning' | 'error' | 'critical' | null {
  const mapping: Record<string, 'info' | 'warning' | 'error' | 'critical'> = {
    'info': 'info',
    'warning': 'warning',
    'error': 'error',
    'critical': 'critical',
  };
  return mapping[pdSeverity?.toLowerCase()] || null;
}

/**
 * Map Opsgenie alert policy operator to OnCallShift condition operator
 */
function mapOpsgenieOperator(ogOperator: string): ConditionOperator | null {
  const mapping: Record<string, ConditionOperator> = {
    'equals': 'equals',
    'equals-ignore-whitespace': 'equals',
    'contains': 'contains',
    'contains-key': 'exists',
    'starts-with': 'starts_with',
    'ends-with': 'ends_with',
    'matches': 'regex',
    'is-empty': 'not_exists',
    'greater-than': 'not_equals', // Approximation
    'less-than': 'not_equals', // Approximation
  };
  return mapping[ogOperator] || null;
}

/**
 * Map Opsgenie field name to OnCallShift field name
 */
function mapOpsgenieField(ogField: string): string {
  const mapping: Record<string, string> = {
    'message': 'summary',
    'alias': 'dedupe_key',
    'description': 'description',
    'source': 'source',
    'entity': 'component',
    'tags': 'tags',
    'actions': 'actions',
    'details': 'details',
    'extra-properties': 'details',
    'responders': 'responders',
    'teams': 'teams',
    'priority': 'priority',
  };
  return mapping[ogField] || ogField;
}

/**
 * Map Opsgenie priority to OnCallShift severity
 */
function mapOpsgeniePriority(ogPriority: string): 'info' | 'warning' | 'error' | 'critical' | null {
  const mapping: Record<string, 'info' | 'warning' | 'error' | 'critical'> = {
    'P1': 'critical',
    'P2': 'error',
    'P3': 'warning',
    'P4': 'info',
    'P5': 'info',
  };
  return mapping[ogPriority?.toUpperCase()] || null;
}

// ============================================================================
// Direct Fetch API - Fetch data directly from PagerDuty/Opsgenie APIs
// ============================================================================

import { PagerDutyExportService, PagerDutyExportOptions } from '../../shared/services/PagerDutyExportService';
import { OpsgenieExportService, OpsgenieExportOptions } from '../../shared/services/OpsgenieExportService';

/**
 * Test PagerDuty API connection
 * POST /api/v1/import/fetch/pagerduty/test
 */
router.post('/fetch/pagerduty/test', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required',
      });
    }

    const service = new PagerDutyExportService({ apiKey });
    const result = await service.testConnection();

    return res.json(result);
  } catch (error) {
    logger.error('PagerDuty connection test failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Test Opsgenie API connection
 * POST /api/v1/import/fetch/opsgenie/test
 */
router.post('/fetch/opsgenie/test', async (req: Request, res: Response) => {
  try {
    const { apiKey, region } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required',
      });
    }

    const service = new OpsgenieExportService({ apiKey, region });
    const result = await service.testConnection();

    return res.json(result);
  } catch (error) {
    logger.error('Opsgenie connection test failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Fetch data from PagerDuty API
 * POST /api/v1/import/fetch/pagerduty
 */
router.post('/fetch/pagerduty', async (req: Request, res: Response) => {
  try {
    const {
      apiKey,
      subdomain,
      includeUsers = true,
      includeTeams = true,
      includeSchedules = true,
      includeEscalationPolicies = true,
      includeServices = true,
      includeMaintenanceWindows = true,
      includeRoutingRules = false,
      includeServiceDependencies = false,
      includeIncidents = false,
      incidentDateRange,
    } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required',
      });
    }

    const service = new PagerDutyExportService({ apiKey, subdomain });

    const options: PagerDutyExportOptions = {
      apiKey,
      subdomain,
      includeUsers,
      includeTeams,
      includeSchedules,
      includeEscalationPolicies,
      includeServices,
      includeMaintenanceWindows,
      includeRoutingRules,
      includeServiceDependencies,
      includeIncidents,
      incidentDateRange,
    };

    const result = await service.exportAll(options);

    logger.info('PagerDuty data fetch completed', {
      users: result.users?.length || 0,
      teams: result.teams?.length || 0,
      schedules: result.schedules?.length || 0,
      escalation_policies: result.escalation_policies?.length || 0,
      services: result.services?.length || 0,
      maintenance_windows: result.maintenance_windows?.length || 0,
      routing_rules: result.routing_rules?.length || 0,
      service_dependencies: result.service_dependencies?.length || 0,
      incidents: result.incidents?.length || 0,
      errors: result.errors.length,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('PagerDuty data fetch failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Fetch data from Opsgenie API
 * POST /api/v1/import/fetch/opsgenie
 */
router.post('/fetch/opsgenie', async (req: Request, res: Response) => {
  try {
    const {
      apiKey,
      region = 'us',
      includeUsers = true,
      includeTeams = true,
      includeSchedules = true,
      includeEscalations = true,
      includeServices = true,
      includeHeartbeats = true,
      includeMaintenanceWindows = true,
      includeAlertPolicies = false,
      includeAlerts = false,
      alertDateRange,
    } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required',
      });
    }

    const service = new OpsgenieExportService({ apiKey, region });

    const options: OpsgenieExportOptions = {
      apiKey,
      region,
      includeUsers,
      includeTeams,
      includeSchedules,
      includeEscalations,
      includeServices,
      includeHeartbeats,
      includeMaintenanceWindows,
      includeAlertPolicies,
      includeAlerts,
      alertDateRange,
    };

    const result = await service.exportAll(options);

    logger.info('Opsgenie data fetch completed', {
      users: result.users?.length || 0,
      teams: result.teams?.length || 0,
      schedules: result.schedules?.length || 0,
      escalations: result.escalations?.length || 0,
      services: result.services?.length || 0,
      heartbeats: result.heartbeats?.length || 0,
      maintenance_windows: result.maintenance_windows?.length || 0,
      alert_policies: result.alert_policies?.length || 0,
      alerts: result.alerts?.length || 0,
      errors: result.errors.length,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Opsgenie data fetch failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================================
// Migration Validation & Diff Report
// ============================================================================

interface ValidationDiff {
  field: string;
  source: string | number | boolean | null;
  current: string | number | boolean | null;
  severity: 'info' | 'warning' | 'error';
}

interface EntityValidation {
  sourceId: string;
  sourceName: string;
  mappedId?: string;
  status: 'matched' | 'missing' | 'different' | 'extra';
  diffs: ValidationDiff[];
}

interface ValidationReport {
  source: 'pagerduty' | 'opsgenie';
  validatedAt: string;
  summary: {
    users: { matched: number; missing: number; different: number; extra: number };
    teams: { matched: number; missing: number; different: number; extra: number };
    schedules: { matched: number; missing: number; different: number; extra: number };
    escalationPolicies: { matched: number; missing: number; different: number; extra: number };
    services: { matched: number; missing: number; different: number; extra: number };
  };
  details: {
    users: EntityValidation[];
    teams: EntityValidation[];
    schedules: EntityValidation[];
    escalationPolicies: EntityValidation[];
    services: EntityValidation[];
  };
  suggestions: string[];
  configurationGaps: string[];
}

/**
 * Validate migration - compare source data with current database state
 * POST /api/v1/import/validate
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const orgId = user.orgId;
    const { source, data } = req.body;

    if (!source || !['pagerduty', 'opsgenie'].includes(source)) {
      return res.status(400).json({
        success: false,
        error: 'Source must be "pagerduty" or "opsgenie"',
      });
    }

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Source data is required',
      });
    }

    const dataSource = await getDataSource();

    // Fetch current database state
    const [
      existingUsers,
      existingTeams,
      existingSchedules,
      existingPolicies,
      existingServices,
    ] = await Promise.all([
      dataSource.getRepository(User).find({ where: { orgId } }),
      dataSource.getRepository(Team).find({ where: { orgId } }),
      dataSource.getRepository(Schedule).find({
        where: { orgId },
        relations: ['layers', 'layers.members'],
      }),
      dataSource.getRepository(EscalationPolicy).find({
        where: { orgId },
        relations: ['steps', 'steps.targets'],
      }),
      dataSource.getRepository(Service).find({ where: { orgId } }),
    ]);

    // Build lookup maps for current state
    const usersByEmail = new Map(existingUsers.map(u => [u.email.toLowerCase(), u]));
    const teamsByName = new Map(existingTeams.map(t => [t.name.toLowerCase(), t]));
    const schedulesByName = new Map(existingSchedules.map(s => [s.name.toLowerCase(), s]));
    const policiesByName = new Map(existingPolicies.map(p => [p.name.toLowerCase(), p]));
    const servicesByName = new Map(existingServices.map(s => [s.name.toLowerCase(), s]));

    const report: ValidationReport = {
      source,
      validatedAt: new Date().toISOString(),
      summary: {
        users: { matched: 0, missing: 0, different: 0, extra: 0 },
        teams: { matched: 0, missing: 0, different: 0, extra: 0 },
        schedules: { matched: 0, missing: 0, different: 0, extra: 0 },
        escalationPolicies: { matched: 0, missing: 0, different: 0, extra: 0 },
        services: { matched: 0, missing: 0, different: 0, extra: 0 },
      },
      details: {
        users: [],
        teams: [],
        schedules: [],
        escalationPolicies: [],
        services: [],
      },
      suggestions: [],
      configurationGaps: [],
    };

    // Track matched IDs to find extras
    const matchedUserEmails = new Set<string>();
    const matchedTeamNames = new Set<string>();
    const matchedScheduleNames = new Set<string>();
    const matchedPolicyNames = new Set<string>();
    const matchedServiceNames = new Set<string>();

    // Validate users
    const sourceUsers = source === 'pagerduty' ? data.users : data.users;
    if (sourceUsers) {
      for (const srcUser of sourceUsers) {
        const email = (srcUser.email || '').toLowerCase();
        const name = srcUser.name || srcUser.summary || email;
        const existingUser = usersByEmail.get(email);

        const validation: EntityValidation = {
          sourceId: srcUser.id,
          sourceName: name,
          mappedId: existingUser?.id,
          status: 'matched',
          diffs: [],
        };

        if (!existingUser) {
          validation.status = 'missing';
          report.summary.users.missing++;
          report.suggestions.push(`User "${name}" (${email}) needs to be invited`);
        } else {
          matchedUserEmails.add(email);

          // Compare user fields
          if (existingUser.fullName !== name) {
            validation.diffs.push({
              field: 'name',
              source: name,
              current: existingUser.fullName,
              severity: 'info',
            });
          }

          if (validation.diffs.length > 0) {
            validation.status = 'different';
            report.summary.users.different++;
          } else {
            report.summary.users.matched++;
          }
        }

        report.details.users.push(validation);
      }
    }

    // Find extra users (in DB but not in source)
    for (const [email, user] of usersByEmail) {
      if (!matchedUserEmails.has(email)) {
        report.details.users.push({
          sourceId: '',
          sourceName: user.fullName || user.email,
          mappedId: user.id,
          status: 'extra',
          diffs: [],
        });
        report.summary.users.extra++;
      }
    }

    // Validate teams
    const sourceTeams = source === 'pagerduty' ? data.teams : data.teams;
    if (sourceTeams) {
      for (const srcTeam of sourceTeams) {
        const name = (srcTeam.name || srcTeam.summary || '').toLowerCase();
        const displayName = srcTeam.name || srcTeam.summary;
        const existingTeam = teamsByName.get(name);

        const validation: EntityValidation = {
          sourceId: srcTeam.id,
          sourceName: displayName,
          mappedId: existingTeam?.id,
          status: 'matched',
          diffs: [],
        };

        if (!existingTeam) {
          validation.status = 'missing';
          report.summary.teams.missing++;
        } else {
          matchedTeamNames.add(name);

          // Compare team fields
          if (existingTeam.description !== (srcTeam.description || null)) {
            validation.diffs.push({
              field: 'description',
              source: srcTeam.description,
              current: existingTeam.description,
              severity: 'info',
            });
          }

          if (validation.diffs.length > 0) {
            validation.status = 'different';
            report.summary.teams.different++;
          } else {
            report.summary.teams.matched++;
          }
        }

        report.details.teams.push(validation);
      }
    }

    // Validate schedules
    const sourceSchedules = source === 'pagerduty' ? data.schedules : data.schedules;
    if (sourceSchedules) {
      for (const srcSchedule of sourceSchedules) {
        const name = (srcSchedule.name || srcSchedule.summary || '').toLowerCase();
        const displayName = srcSchedule.name || srcSchedule.summary;
        const existingSchedule = schedulesByName.get(name);

        const validation: EntityValidation = {
          sourceId: srcSchedule.id,
          sourceName: displayName,
          mappedId: existingSchedule?.id,
          status: 'matched',
          diffs: [],
        };

        if (!existingSchedule) {
          validation.status = 'missing';
          report.summary.schedules.missing++;
        } else {
          matchedScheduleNames.add(name);

          // Compare layer count
          const sourceLayers = source === 'pagerduty'
            ? srcSchedule.schedule_layers?.length || 0
            : srcSchedule.rotations?.length || 0;
          const currentLayers = existingSchedule.layers?.length || 0;

          if (sourceLayers !== currentLayers) {
            validation.diffs.push({
              field: 'layerCount',
              source: sourceLayers,
              current: currentLayers,
              severity: 'warning',
            });
            report.configurationGaps.push(
              `Schedule "${displayName}" has ${sourceLayers} rotations in source but ${currentLayers} in system`
            );
          }

          if (validation.diffs.length > 0) {
            validation.status = 'different';
            report.summary.schedules.different++;
          } else {
            report.summary.schedules.matched++;
          }
        }

        report.details.schedules.push(validation);
      }
    }

    // Validate escalation policies
    const sourcePolicies = source === 'pagerduty'
      ? data.escalation_policies
      : data.escalations;
    if (sourcePolicies) {
      for (const srcPolicy of sourcePolicies) {
        const name = (srcPolicy.name || srcPolicy.summary || '').toLowerCase();
        const displayName = srcPolicy.name || srcPolicy.summary;
        const existingPolicy = policiesByName.get(name);

        const validation: EntityValidation = {
          sourceId: srcPolicy.id,
          sourceName: displayName,
          mappedId: existingPolicy?.id,
          status: 'matched',
          diffs: [],
        };

        if (!existingPolicy) {
          validation.status = 'missing';
          report.summary.escalationPolicies.missing++;
        } else {
          matchedPolicyNames.add(name);

          // Compare step count
          const sourceSteps = source === 'pagerduty'
            ? srcPolicy.escalation_rules?.length || 0
            : srcPolicy.rules?.length || 0;
          const currentSteps = existingPolicy.steps?.length || 0;

          if (sourceSteps !== currentSteps) {
            validation.diffs.push({
              field: 'stepCount',
              source: sourceSteps,
              current: currentSteps,
              severity: 'warning',
            });
            report.configurationGaps.push(
              `Escalation policy "${displayName}" has ${sourceSteps} steps in source but ${currentSteps} in system`
            );
          }

          if (validation.diffs.length > 0) {
            validation.status = 'different';
            report.summary.escalationPolicies.different++;
          } else {
            report.summary.escalationPolicies.matched++;
          }
        }

        report.details.escalationPolicies.push(validation);
      }
    }

    // Validate services
    const sourceServices = source === 'pagerduty' ? data.services : data.services;
    if (sourceServices) {
      for (const srcService of sourceServices) {
        const name = (srcService.name || srcService.summary || '').toLowerCase();
        const displayName = srcService.name || srcService.summary;
        const existingService = servicesByName.get(name);

        const validation: EntityValidation = {
          sourceId: srcService.id,
          sourceName: displayName,
          mappedId: existingService?.id,
          status: 'matched',
          diffs: [],
        };

        if (!existingService) {
          validation.status = 'missing';
          report.summary.services.missing++;
        } else {
          matchedServiceNames.add(name);

          // Check if integration key was preserved
          const sourceKey = source === 'pagerduty'
            ? srcService.integration_key
            : srcService.apiKey;
          if (sourceKey) {
            const hasExternalKey = existingService.externalKeys &&
              (existingService.externalKeys.pagerduty === sourceKey ||
               existingService.externalKeys.opsgenie === sourceKey);

            if (!hasExternalKey) {
              validation.diffs.push({
                field: 'integrationKey',
                source: sourceKey,
                current: null,
                severity: 'warning',
              });
              report.suggestions.push(
                `Service "${displayName}" integration key not preserved - webhooks may need reconfiguration`
              );
            }
          }

          if (validation.diffs.length > 0) {
            validation.status = 'different';
            report.summary.services.different++;
          } else {
            report.summary.services.matched++;
          }
        }

        report.details.services.push(validation);
      }
    }

    // Generate overall suggestions
    if (report.summary.users.missing > 0) {
      report.suggestions.unshift(
        `${report.summary.users.missing} users need to be invited to the organization`
      );
    }
    if (report.summary.schedules.missing > 0) {
      report.suggestions.push(
        `${report.summary.schedules.missing} schedules need to be imported`
      );
    }
    if (report.summary.services.missing > 0) {
      report.suggestions.push(
        `${report.summary.services.missing} services need to be imported`
      );
    }

    logger.info('Migration validation completed', {
      source,
      orgId,
      summary: report.summary,
    });

    return res.json({
      success: true,
      report,
    });
  } catch (error) {
    logger.error('Migration validation failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
