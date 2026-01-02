import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
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
  IncidentWorkflow,
  WorkflowAction,
  StatusPage,
  StatusPageService,
  WebhookSubscription,
} from '../../shared/models';
import { authenticateUser } from '../../shared/auth/middleware';
import { logger } from '../../shared/utils/logger';
import { LayerRestrictions } from '../../shared/models/ScheduleLayer';
import { SupportHours } from '../../shared/models/Service';
import { RoutingCondition } from '../../shared/models/AlertRoutingRule';
import { WorkflowCondition } from '../../shared/models/IncidentWorkflow';
import { ActionConfig } from '../../shared/models/WorkflowAction';

const router = Router();

router.use(authenticateUser);

// ============================================================================
// Configuration Export API
// ============================================================================

interface ExportedConfig {
  exportedAt: string;
  version: string;
  organization: {
    id: string;
    name: string;
  };
  users?: ExportedUser[];
  teams?: ExportedTeam[];
  schedules?: ExportedSchedule[];
  escalationPolicies?: ExportedEscalationPolicy[];
  services?: ExportedService[];
  routingRules?: ExportedRoutingRule[];
  maintenanceWindows?: ExportedMaintenanceWindow[];
  serviceDependencies?: ExportedServiceDependency[];
  heartbeats?: ExportedHeartbeat[];
  tags?: ExportedTag[];
  workflows?: ExportedWorkflow[];
  statusPages?: ExportedStatusPage[];
  webhookSubscriptions?: ExportedWebhookSubscription[];
}

interface ExportedUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  contactMethods: Array<{
    type: string;
    address: string;
    label: string | null;
    verified: boolean;
  }>;
  notificationRules: Array<{
    urgency: string;
    contactMethodType: string;
    startDelayMinutes: number;
  }>;
}

interface ExportedTeam {
  id: string;
  name: string;
  description: string | null;
  privacy: string;
  members: Array<{
    userEmail: string;
    role: string;
  }>;
  tags: string[];
}

interface ExportedSchedule {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  type: string;
  layers: Array<{
    name: string;
    rotationType: string;
    startDate: string;
    handoffTime: string;
    handoffDay: number | null;
    rotationLength: number;
    members: Array<{
      userEmail: string;
      position: number;
    }>;
    restrictions: LayerRestrictions | null;
  }>;
}

interface ExportedEscalationPolicy {
  id: string;
  name: string;
  description: string | null;
  repeatEnabled: boolean;
  repeatCount: number;
  steps: Array<{
    stepOrder: number;
    timeoutSeconds: number;
    targets: Array<{
      type: string;
      targetId: string;
      targetName: string;
    }>;
  }>;
}

interface ExportedService {
  id: string;
  name: string;
  description: string | null;
  status: string;
  urgency: string;
  supportHours: SupportHours | null;
  ackTimeoutSeconds: number | null;
  autoResolveTimeout: number | null;
  escalationPolicyName: string | null;
  teamName: string | null;
  apiKey: string | null;
  emailAddress: string | null;
  tags: string[];
}

interface ExportedRoutingRule {
  id: string;
  name: string;
  description: string | null;
  targetServiceName: string | null;
  ruleOrder: number;
  enabled: boolean;
  matchType: string;
  conditions: RoutingCondition[];
  setSeverity: string | null;
  suppress: boolean;
  suspend: boolean;
}

interface ExportedMaintenanceWindow {
  id: string;
  description: string | null;
  startTime: string;
  endTime: string;
  serviceNames: string[];
}

interface ExportedServiceDependency {
  supportingServiceName: string;
  dependentServiceName: string;
}

interface ExportedHeartbeat {
  id: string;
  name: string;
  description: string | null;
  serviceName: string | null;
  intervalSeconds: number;
  alertAfterMissedCount: number;
  status: string;
}

interface ExportedTag {
  id: string;
  name: string;
  color: string | null;
}

interface ExportedWorkflow {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerEvents: string[];
  conditions: WorkflowCondition[];
  enabled: boolean;
  actions: Array<{
    actionType: string;
    actionOrder: number;
    config: ActionConfig;
  }>;
}

interface ExportedStatusPage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: string;
  serviceNames: string[];
}

interface ExportedWebhookSubscription {
  id: string;
  scope: string;
  url: string;
  eventTypes: string[];
  enabled: boolean;
  secret: string | null;
}

/**
 * Export full configuration
 * GET /api/v1/export/config
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const dataSource = await getDataSource();

    // Get organization info
    const orgRepo = dataSource.getRepository('Organization');
    const org = await orgRepo.findOne({ where: { id: orgId } });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const config: ExportedConfig = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      organization: {
        id: org.id,
        name: org.name,
      },
    };

    // Export all resource types
    config.users = await exportUsers(dataSource, orgId);
    config.teams = await exportTeams(dataSource, orgId);
    config.schedules = await exportSchedules(dataSource, orgId);
    config.escalationPolicies = await exportEscalationPolicies(dataSource, orgId);
    config.services = await exportServices(dataSource, orgId);
    config.routingRules = await exportRoutingRules(dataSource, orgId);
    config.maintenanceWindows = await exportMaintenanceWindows(dataSource, orgId);
    config.serviceDependencies = await exportServiceDependencies(dataSource, orgId);
    config.heartbeats = await exportHeartbeats(dataSource, orgId);
    config.tags = await exportTags(dataSource, orgId);
    config.workflows = await exportWorkflows(dataSource, orgId);
    config.statusPages = await exportStatusPages(dataSource, orgId);
    config.webhookSubscriptions = await exportWebhookSubscriptions(dataSource, orgId);

    logger.info('Configuration exported', {
      orgId,
      users: config.users?.length,
      teams: config.teams?.length,
      services: config.services?.length,
    });

    return res.json(config);
  } catch (error) {
    logger.error('Failed to export configuration', { error });
    return res.status(500).json({ error: 'Failed to export configuration' });
  }
});

/**
 * Export specific resource type
 * GET /api/v1/export/config/:type
 */
router.get('/config/:type', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const { type } = req.params;
    const dataSource = await getDataSource();

    let data: unknown[];

    switch (type) {
      case 'users':
        data = await exportUsers(dataSource, orgId);
        break;
      case 'teams':
        data = await exportTeams(dataSource, orgId);
        break;
      case 'schedules':
        data = await exportSchedules(dataSource, orgId);
        break;
      case 'escalation-policies':
        data = await exportEscalationPolicies(dataSource, orgId);
        break;
      case 'services':
        data = await exportServices(dataSource, orgId);
        break;
      case 'routing-rules':
        data = await exportRoutingRules(dataSource, orgId);
        break;
      case 'maintenance-windows':
        data = await exportMaintenanceWindows(dataSource, orgId);
        break;
      case 'heartbeats':
        data = await exportHeartbeats(dataSource, orgId);
        break;
      case 'tags':
        data = await exportTags(dataSource, orgId);
        break;
      case 'workflows':
        data = await exportWorkflows(dataSource, orgId);
        break;
      case 'status-pages':
        data = await exportStatusPages(dataSource, orgId);
        break;
      case 'webhook-subscriptions':
        data = await exportWebhookSubscriptions(dataSource, orgId);
        break;
      default:
        return res.status(400).json({
          error: `Unknown export type: ${type}`,
          validTypes: [
            'users', 'teams', 'schedules', 'escalation-policies', 'services',
            'routing-rules', 'maintenance-windows', 'heartbeats', 'tags',
            'workflows', 'status-pages', 'webhook-subscriptions',
          ],
        });
    }

    return res.json({
      exportedAt: new Date().toISOString(),
      type,
      count: data.length,
      data,
    });
  } catch (error) {
    logger.error('Failed to export resource', { error, type: req.params.type });
    return res.status(500).json({ error: 'Failed to export resource' });
  }
});

// ============================================================================
// Export Functions
// ============================================================================

async function exportUsers(dataSource: DataSource, orgId: string): Promise<ExportedUser[]> {
  const userRepo = dataSource.getRepository(User);
  const contactRepo = dataSource.getRepository(UserContactMethod);
  const ruleRepo = dataSource.getRepository(UserNotificationRule);

  const users = await userRepo.find({ where: { orgId } });

  return Promise.all(users.map(async (user: User) => {
    const contacts = await contactRepo.find({ where: { userId: user.id } });
    const rules = await ruleRepo.find({
      where: { userId: user.id },
      relations: ['contactMethod'],
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      contactMethods: contacts.map((c: UserContactMethod) => ({
        type: c.type,
        address: c.address,
        label: c.label,
        verified: c.verified,
      })),
      notificationRules: rules.map((r: UserNotificationRule) => ({
        urgency: r.urgency,
        contactMethodType: r.contactMethod?.type || 'unknown',
        startDelayMinutes: r.startDelayMinutes,
      })),
    };
  }));
}

async function exportTeams(dataSource: DataSource, orgId: string): Promise<ExportedTeam[]> {
  const teamRepo = dataSource.getRepository(Team);
  const membershipRepo = dataSource.getRepository(TeamMembership);
  const entityTagRepo = dataSource.getRepository(EntityTag);
  const tagRepo = dataSource.getRepository(Tag);

  const teams = await teamRepo.find({ where: { orgId } });

  return Promise.all(teams.map(async (team: Team) => {
    const memberships = await membershipRepo.find({
      where: { teamId: team.id },
      relations: ['user'],
    });

    const entityTags = await entityTagRepo.find({
      where: { entityType: 'team', entityId: team.id },
    });
    const tagIds = entityTags.map((et: EntityTag) => et.tagId);
    const tags = tagIds.length > 0
      ? await tagRepo.findByIds(tagIds)
      : [];

    return {
      id: team.id,
      name: team.name,
      description: team.description,
      privacy: team.privacy || 'public',
      members: memberships.map((m: TeamMembership) => ({
        userEmail: m.user?.email || '',
        role: m.role,
      })),
      tags: tags.map((t: Tag) => t.name),
    };
  }));
}

async function exportSchedules(dataSource: DataSource, orgId: string): Promise<ExportedSchedule[]> {
  const scheduleRepo = dataSource.getRepository(Schedule);
  const layerRepo = dataSource.getRepository(ScheduleLayer);
  const layerMemberRepo = dataSource.getRepository(ScheduleLayerMember);

  const schedules = await scheduleRepo.find({ where: { orgId } });

  return Promise.all(schedules.map(async (schedule: Schedule) => {
    const layers = await layerRepo.find({
      where: { scheduleId: schedule.id },
      order: { layerOrder: 'ASC' },
    });

    const exportedLayers = await Promise.all(layers.map(async (layer: ScheduleLayer) => {
      const members = await layerMemberRepo.find({
        where: { layerId: layer.id },
        relations: ['user'],
        order: { position: 'ASC' },
      });

      return {
        name: layer.name,
        rotationType: layer.rotationType,
        startDate: layer.startDate instanceof Date ? layer.startDate.toISOString() : String(layer.startDate),
        handoffTime: layer.handoffTime,
        handoffDay: layer.handoffDay,
        rotationLength: layer.rotationLength,
        members: members.map((m: ScheduleLayerMember) => ({
          userEmail: m.user?.email || '',
          position: m.position,
        })),
        restrictions: layer.restrictions,
      };
    }));

    return {
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      timezone: schedule.timezone,
      type: schedule.type,
      layers: exportedLayers,
    };
  }));
}

async function exportEscalationPolicies(dataSource: DataSource, orgId: string): Promise<ExportedEscalationPolicy[]> {
  const policyRepo = dataSource.getRepository(EscalationPolicy);
  const stepRepo = dataSource.getRepository(EscalationStep);
  const targetRepo = dataSource.getRepository(EscalationTarget);

  const policies = await policyRepo.find({ where: { orgId } });

  return Promise.all(policies.map(async (policy: EscalationPolicy) => {
    const steps = await stepRepo.find({
      where: { escalationPolicyId: policy.id },
      order: { stepOrder: 'ASC' },
    });

    const exportedSteps = await Promise.all(steps.map(async (step: EscalationStep) => {
      const targets = await targetRepo.find({
        where: { escalationStepId: step.id },
        relations: ['user', 'schedule'],
      });

      return {
        stepOrder: step.stepOrder,
        timeoutSeconds: step.timeoutSeconds,
        targets: targets.map((t: EscalationTarget) => ({
          type: t.targetType,
          targetId: t.targetType === 'user' ? t.userId! : t.scheduleId!,
          targetName: t.targetType === 'user'
            ? t.user?.fullName || t.user?.email || ''
            : t.schedule?.name || '',
        })),
      };
    }));

    return {
      id: policy.id,
      name: policy.name,
      description: policy.description,
      repeatEnabled: policy.repeatEnabled,
      repeatCount: policy.repeatCount,
      steps: exportedSteps,
    };
  }));
}

async function exportServices(dataSource: DataSource, orgId: string): Promise<ExportedService[]> {
  const serviceRepo = dataSource.getRepository(Service);
  const entityTagRepo = dataSource.getRepository(EntityTag);
  const tagRepo = dataSource.getRepository(Tag);

  const services = await serviceRepo.find({
    where: { orgId },
    relations: ['escalationPolicy', 'team'],
  });

  return Promise.all(services.map(async (service: Service) => {
    const entityTags = await entityTagRepo.find({
      where: { entityType: 'service', entityId: service.id },
    });
    const tagIds = entityTags.map((et: EntityTag) => et.tagId);
    const tags = tagIds.length > 0
      ? await tagRepo.findByIds(tagIds)
      : [];

    return {
      id: service.id,
      name: service.name,
      description: service.description,
      status: service.status,
      urgency: service.urgency || 'high',
      supportHours: service.supportHours,
      ackTimeoutSeconds: service.ackTimeoutSeconds,
      autoResolveTimeout: service.autoResolveTimeout,
      escalationPolicyName: service.escalationPolicy?.name || null,
      teamName: service.team?.name || null,
      apiKey: service.apiKey,
      emailAddress: service.emailAddress,
      tags: tags.map((t: Tag) => t.name),
    };
  }));
}

async function exportRoutingRules(dataSource: DataSource, orgId: string): Promise<ExportedRoutingRule[]> {
  const ruleRepo = dataSource.getRepository(AlertRoutingRule);
  const serviceRepo = dataSource.getRepository(Service);

  const rules = await ruleRepo.find({
    where: { orgId },
    order: { ruleOrder: 'ASC' },
  });

  return Promise.all(rules.map(async (rule: AlertRoutingRule) => {
    let targetServiceName: string | null = null;
    if (rule.targetServiceId) {
      const service = await serviceRepo.findOne({ where: { id: rule.targetServiceId } });
      targetServiceName = service?.name || null;
    }

    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      targetServiceName,
      ruleOrder: rule.ruleOrder,
      enabled: rule.enabled,
      matchType: rule.matchType,
      conditions: rule.conditions,
      setSeverity: rule.setSeverity,
      suppress: rule.suppress || false,
      suspend: rule.suspend || false,
    };
  }));
}

async function exportMaintenanceWindows(dataSource: DataSource, orgId: string): Promise<ExportedMaintenanceWindow[]> {
  const windowRepo = dataSource.getRepository(MaintenanceWindow);

  const windows = await windowRepo.find({
    where: { orgId },
    relations: ['service'],
  });

  return windows.map((w: MaintenanceWindow) => ({
    id: w.id,
    description: w.description,
    startTime: w.startTime.toISOString(),
    endTime: w.endTime.toISOString(),
    serviceNames: w.service ? [w.service.name] : [],
  }));
}

async function exportServiceDependencies(dataSource: DataSource, orgId: string): Promise<ExportedServiceDependency[]> {
  const depRepo = dataSource.getRepository(ServiceDependency);

  const deps = await depRepo.find({
    where: { orgId },
    relations: ['supportingService', 'dependentService'],
  });

  return deps.map((d: ServiceDependency) => ({
    supportingServiceName: d.supportingService?.name || '',
    dependentServiceName: d.dependentService?.name || '',
  }));
}

async function exportHeartbeats(dataSource: DataSource, orgId: string): Promise<ExportedHeartbeat[]> {
  const hbRepo = dataSource.getRepository(Heartbeat);

  const heartbeats = await hbRepo.find({
    where: { orgId },
    relations: ['service'],
  });

  return heartbeats.map((h: Heartbeat) => ({
    id: h.id,
    name: h.name,
    description: h.description,
    serviceName: h.service?.name || null,
    intervalSeconds: h.intervalSeconds,
    alertAfterMissedCount: h.alertAfterMissedCount,
    status: h.status,
  }));
}

async function exportTags(dataSource: DataSource, orgId: string): Promise<ExportedTag[]> {
  const tagRepo = dataSource.getRepository(Tag);

  const tags = await tagRepo.find({ where: { orgId } });

  return tags.map((t: Tag) => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }));
}

async function exportWorkflows(dataSource: DataSource, orgId: string): Promise<ExportedWorkflow[]> {
  const workflowRepo = dataSource.getRepository(IncidentWorkflow);
  const actionRepo = dataSource.getRepository(WorkflowAction);

  const workflows = await workflowRepo.find({ where: { orgId } });

  return Promise.all(workflows.map(async (w: IncidentWorkflow) => {
    const actions = await actionRepo.find({
      where: { workflowId: w.id },
      order: { actionOrder: 'ASC' },
    });

    return {
      id: w.id,
      name: w.name,
      description: w.description,
      triggerType: w.triggerType,
      triggerEvents: w.triggerEvents || [],
      conditions: w.conditions,
      enabled: w.enabled,
      actions: actions.map((a: WorkflowAction) => ({
        actionType: a.actionType,
        actionOrder: a.actionOrder,
        config: a.config,
      })),
    };
  }));
}

async function exportStatusPages(dataSource: DataSource, orgId: string): Promise<ExportedStatusPage[]> {
  const pageRepo = dataSource.getRepository(StatusPage);
  const serviceRepo = dataSource.getRepository(StatusPageService);

  const pages = await pageRepo.find({ where: { orgId } });

  return Promise.all(pages.map(async (p: StatusPage) => {
    const services = await serviceRepo.find({
      where: { statusPageId: p.id },
      relations: ['service'],
    });

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      visibility: p.visibility,
      serviceNames: services.map((s: StatusPageService) => s.service?.name || '').filter(Boolean),
    };
  }));
}

async function exportWebhookSubscriptions(dataSource: DataSource, orgId: string): Promise<ExportedWebhookSubscription[]> {
  const subRepo = dataSource.getRepository(WebhookSubscription);

  const subs = await subRepo.find({ where: { orgId } });

  return subs.map((s: WebhookSubscription) => ({
    id: s.id,
    scope: s.scope,
    url: s.url,
    eventTypes: s.eventTypes || [],
    enabled: s.enabled,
    secret: s.secret || null,
  }));
}

export default router;
