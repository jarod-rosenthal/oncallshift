import Anthropic from '@anthropic-ai/sdk';
import { DataSource, Repository, QueryRunner } from 'typeorm';
import { getDataSource } from '../db/data-source';
import { getAnthropicApiKey } from './ai-assistant-service';
import { logger } from '../utils/logger';

// Import models
import { Team } from '../models/Team';
import { User } from '../models/User';
import { Service } from '../models/Service';
import { Schedule } from '../models/Schedule';
import { ScheduleLayer } from '../models/ScheduleLayer';
import { ScheduleLayerMember } from '../models/ScheduleLayerMember';
import { EscalationPolicy } from '../models/EscalationPolicy';
import { EscalationStep } from '../models/EscalationStep';
import { TeamMembership } from '../models/TeamMembership';

// Operation types that Claude can generate
export type ConfigOperationType =
  | 'create_team'
  | 'invite_user'
  | 'add_team_member'
  | 'create_schedule'
  | 'create_escalation_policy'
  | 'create_service'
  | 'update_service'
  | 'set_oncall';

// Operation parameter interfaces
export interface CreateTeamParams {
  name: string;
  description?: string;
  privacy?: 'public' | 'private';
}

export interface InviteUserParams {
  email: string;
  fullName?: string;
  baseRole?: 'admin' | 'manager' | 'responder' | 'observer';
}

export interface AddTeamMemberParams {
  teamName: string; // Reference by name since we may have just created it
  userEmail: string; // Reference by email
  role?: 'manager' | 'member';
}

export interface CreateScheduleParams {
  name: string;
  teamName?: string; // Optional: associate with team
  timezone?: string;
  rotationType?: 'daily' | 'weekly' | 'custom';
  handoffTime?: string; // HH:mm format
  handoffDay?: number; // 0-6 for weekly
  members?: string[]; // User emails for the rotation
}

export interface CreateEscalationPolicyParams {
  name: string;
  description?: string;
  teamName?: string;
  steps: Array<{
    timeoutMinutes?: number;
    scheduleName?: string; // Reference schedule by name
    userEmails?: string[]; // Or direct user emails
  }>;
  repeatEnabled?: boolean;
  repeatCount?: number;
}

export interface CreateServiceParams {
  name: string;
  description?: string;
  teamName?: string;
  escalationPolicyName?: string;
  scheduleName?: string;
  urgency?: 'high' | 'low' | 'dynamic';
}

export interface UpdateServiceParams {
  serviceName: string; // Find by name
  escalationPolicyName?: string;
  scheduleName?: string;
  teamName?: string;
}

export interface SetOncallParams {
  scheduleName: string;
  userEmail: string;
}

// Union of all operation params
export type OperationParams =
  | CreateTeamParams
  | InviteUserParams
  | AddTeamMemberParams
  | CreateScheduleParams
  | CreateEscalationPolicyParams
  | CreateServiceParams
  | UpdateServiceParams
  | SetOncallParams;

// A single operation in the configuration plan
export interface ConfigOperation {
  operation: ConfigOperationType;
  params: OperationParams;
  description: string; // Human-readable description
}

// The full configuration plan from Claude
export interface ConfigurationPlan {
  summary: string;
  operations: ConfigOperation[];
  clarificationNeeded?: string; // If Claude needs more info
  warnings?: string[];
}

// Result of executing an operation
export interface OperationResult {
  operation: ConfigOperationType;
  success: boolean;
  message: string;
  entityId?: string;
  entityType?: string;
  error?: string;
}

// Result of executing the full plan
export interface ConfigurationResult {
  success: boolean;
  summary: string;
  results: OperationResult[];
  warnings?: string[];
  rollbackPerformed?: boolean;
  error?: string;
}

// System prompt for Claude to parse natural language into configuration
const CONFIGURATION_PLANNER_PROMPT = `You are an OnCallShift configuration assistant. Your job is to parse natural language requests and output a JSON configuration plan.

OnCallShift is an incident management platform with these core concepts:
- **Teams**: Groups of users who work together (e.g., "Platform Team", "API Team")
- **Users**: People in the organization, identified by email
- **Schedules**: Define who is on-call and when. Can have rotation (daily/weekly) with multiple members.
- **Escalation Policies**: Define notification chains. Multiple steps, each with a timeout. Steps can target a schedule (notify whoever is on-call) or specific users.
- **Services**: Technical services that can have incidents. Each service should have an escalation policy.

When given a request, output a JSON plan with this structure:
{
  "summary": "Brief description of what will be configured",
  "operations": [
    {
      "operation": "<operation_type>",
      "params": { <operation_parameters> },
      "description": "Human-readable description of this step"
    }
  ],
  "clarificationNeeded": "Optional: question if critical info is missing",
  "warnings": ["Optional array of warnings about the configuration"]
}

Available operations:
1. **create_team**: Create a new team
   - params: { name: string, description?: string, privacy?: "public"|"private" }

2. **invite_user**: Add a new user to the organization
   - params: { email: string, fullName?: string, baseRole?: "admin"|"manager"|"responder"|"observer" }

3. **add_team_member**: Add a user to a team
   - params: { teamName: string, userEmail: string, role?: "manager"|"member" }

4. **create_schedule**: Create an on-call schedule
   - params: { name: string, teamName?: string, timezone?: string, rotationType?: "daily"|"weekly"|"custom", handoffTime?: string (HH:mm), handoffDay?: number (0-6 for weekly), members?: string[] (user emails) }

5. **create_escalation_policy**: Create an escalation policy
   - params: { name: string, description?: string, teamName?: string, steps: [{ timeoutMinutes?: number, scheduleName?: string, userEmails?: string[] }], repeatEnabled?: boolean, repeatCount?: number }

6. **create_service**: Create a technical service
   - params: { name: string, description?: string, teamName?: string, escalationPolicyName?: string, scheduleName?: string, urgency?: "high"|"low"|"dynamic" }

7. **update_service**: Update an existing service
   - params: { serviceName: string, escalationPolicyName?: string, scheduleName?: string, teamName?: string }

8. **set_oncall**: Set the current on-call person for a schedule
   - params: { scheduleName: string, userEmail: string }

Guidelines:
- Infer reasonable defaults when not specified (e.g., UTC timezone, weekly rotation, 5-minute escalation timeouts)
- Order operations correctly: create teams before adding members, create schedules before referencing them in escalation policies
- Use descriptive names that follow conventions (e.g., "Platform Team On-Call" for schedules)
- When creating an escalation policy, default to 5-minute timeout per step if not specified
- If a request mentions people by name but no email, ask for clarification
- Only ask for clarification if CRITICAL information is missing (like user emails)
- If the request is ambiguous but can be reasonably interpreted, proceed with the most likely interpretation and note it in warnings

Example request: "Set up incident management for our platform team. The team has alice@acme.com and bob@acme.com. Alice should be on-call this week."

Example response:
{
  "summary": "Creating Platform Team with 2 members, on-call schedule, escalation policy, and service",
  "operations": [
    {
      "operation": "create_team",
      "params": { "name": "Platform Team", "description": "Platform engineering team" },
      "description": "Create the Platform Team"
    },
    {
      "operation": "add_team_member",
      "params": { "teamName": "Platform Team", "userEmail": "alice@acme.com", "role": "member" },
      "description": "Add Alice to Platform Team"
    },
    {
      "operation": "add_team_member",
      "params": { "teamName": "Platform Team", "userEmail": "bob@acme.com", "role": "member" },
      "description": "Add Bob to Platform Team"
    },
    {
      "operation": "create_schedule",
      "params": { "name": "Platform Team On-Call", "teamName": "Platform Team", "rotationType": "weekly", "handoffTime": "09:00", "handoffDay": 1, "members": ["alice@acme.com", "bob@acme.com"] },
      "description": "Create weekly on-call rotation for Platform Team"
    },
    {
      "operation": "create_escalation_policy",
      "params": { "name": "Platform Team Escalation", "teamName": "Platform Team", "steps": [{ "timeoutMinutes": 5, "scheduleName": "Platform Team On-Call" }, { "timeoutMinutes": 10, "userEmails": ["alice@acme.com", "bob@acme.com"] }] },
      "description": "Create escalation policy: first notify on-call, then all team members"
    },
    {
      "operation": "create_service",
      "params": { "name": "Platform Service", "teamName": "Platform Team", "escalationPolicyName": "Platform Team Escalation" },
      "description": "Create Platform Service with escalation policy"
    },
    {
      "operation": "set_oncall",
      "params": { "scheduleName": "Platform Team On-Call", "userEmail": "alice@acme.com" },
      "description": "Set Alice as currently on-call"
    }
  ],
  "warnings": ["Alice will need to confirm team membership if not already in the organization"]
}

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON structure.`;

/**
 * Service for translating natural language into OnCallShift configuration
 */
export class NaturalLanguageConfigurationService {
  private dataSource: DataSource | null = null;

  // Repositories - initialized lazily
  private teamRepo: Repository<Team> | null = null;
  private userRepo: Repository<User> | null = null;
  private serviceRepo: Repository<Service> | null = null;
  private scheduleRepo: Repository<Schedule> | null = null;
  private escalationPolicyRepo: Repository<EscalationPolicy> | null = null;

  // Cache for entity lookups during plan execution (name -> id mapping)
  private entityCache: Map<string, string> = new Map();

  /**
   * Initialize data source and repositories
   */
  private async init(): Promise<void> {
    if (this.dataSource) return;

    this.dataSource = await getDataSource();
    this.teamRepo = this.dataSource.getRepository(Team);
    this.userRepo = this.dataSource.getRepository(User);
    this.serviceRepo = this.dataSource.getRepository(Service);
    this.scheduleRepo = this.dataSource.getRepository(Schedule);
    this.escalationPolicyRepo = this.dataSource.getRepository(EscalationPolicy);
  }

  /**
   * Process a natural language configuration intent
   * @param orgId Organization ID
   * @param intent Natural language description of what to configure
   * @param dryRun If true, only validate and return plan without executing
   * @returns Configuration result with summary and details
   */
  async processIntent(
    orgId: string,
    intent: string,
    dryRun: boolean = false
  ): Promise<ConfigurationResult> {
    await this.init();

    logger.info('Processing NL configuration intent', { orgId, intent, dryRun });

    try {
      // Step 1: Get configuration plan from Claude
      const plan = await this.generatePlan(orgId, intent);

      if (plan.clarificationNeeded) {
        return {
          success: false,
          summary: 'Clarification needed',
          results: [],
          warnings: [plan.clarificationNeeded],
          error: plan.clarificationNeeded,
        };
      }

      // Step 2: Validate the plan
      const validationErrors = await this.validatePlan(orgId, plan);
      if (validationErrors.length > 0) {
        return {
          success: false,
          summary: 'Plan validation failed',
          results: validationErrors.map(err => ({
            operation: 'validate' as ConfigOperationType,
            success: false,
            message: err,
            error: err,
          })),
          warnings: plan.warnings,
          error: validationErrors.join('; '),
        };
      }

      // Step 3: If dry run, return the plan without executing
      if (dryRun) {
        return {
          success: true,
          summary: plan.summary,
          results: plan.operations.map(op => ({
            operation: op.operation,
            success: true,
            message: op.description,
          })),
          warnings: plan.warnings,
        };
      }

      // Step 4: Execute the plan with transaction support
      return await this.executePlan(orgId, plan);
    } catch (error: any) {
      logger.error('Failed to process configuration intent', { orgId, error: error.message });
      return {
        success: false,
        summary: 'Configuration failed',
        results: [],
        error: error.message,
      };
    }
  }

  /**
   * Generate a configuration plan from natural language using Claude
   */
  private async generatePlan(orgId: string, intent: string): Promise<ConfigurationPlan> {
    const apiKey = await getAnthropicApiKey(orgId);

    if (!apiKey) {
      throw new Error('Anthropic API key is not configured. Add one in Settings > Cloud Credentials.');
    }

    const anthropic = new Anthropic({ apiKey });

    // Get existing context for better understanding
    const context = await this.getOrganizationContext(orgId);

    const userPrompt = `Current organization context:
${context}

User request:
${intent}

Generate a configuration plan to fulfill this request.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: CONFIGURATION_PLANNER_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text content
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No response from Claude');
    }

    // Parse JSON from response
    try {
      const plan = JSON.parse(textContent.text) as ConfigurationPlan;
      logger.info('Generated configuration plan', {
        orgId,
        operationCount: plan.operations.length,
        summary: plan.summary,
      });
      return plan;
    } catch (parseError) {
      logger.error('Failed to parse Claude response as JSON', {
        response: textContent.text.substring(0, 500),
      });
      throw new Error('Failed to parse configuration plan');
    }
  }

  /**
   * Get organization context for Claude
   */
  private async getOrganizationContext(orgId: string): Promise<string> {
    await this.init();

    const teams = await this.teamRepo!.find({ where: { orgId }, take: 20 });
    const users = await this.userRepo!.find({
      where: { orgId, status: 'active' },
      take: 50,
      select: ['id', 'email', 'fullName', 'baseRole'],
    });
    const services = await this.serviceRepo!.find({ where: { orgId }, take: 20 });
    const schedules = await this.scheduleRepo!.find({ where: { orgId }, take: 20 });
    const escalationPolicies = await this.escalationPolicyRepo!.find({ where: { orgId }, take: 20 });

    const parts: string[] = [];

    if (teams.length > 0) {
      parts.push(`Existing teams: ${teams.map(t => t.name).join(', ')}`);
    }

    if (users.length > 0) {
      parts.push(`Existing users: ${users.map(u => `${u.email}${u.fullName ? ` (${u.fullName})` : ''}`).join(', ')}`);
    }

    if (services.length > 0) {
      parts.push(`Existing services: ${services.map(s => s.name).join(', ')}`);
    }

    if (schedules.length > 0) {
      parts.push(`Existing schedules: ${schedules.map(s => s.name).join(', ')}`);
    }

    if (escalationPolicies.length > 0) {
      parts.push(`Existing escalation policies: ${escalationPolicies.map(e => e.name).join(', ')}`);
    }

    return parts.length > 0 ? parts.join('\n') : 'No existing configuration.';
  }

  /**
   * Validate a configuration plan before execution
   */
  private async validatePlan(_orgId: string, plan: ConfigurationPlan): Promise<string[]> {
    const errors: string[] = [];

    for (const op of plan.operations) {
      switch (op.operation) {
        case 'create_team': {
          const params = op.params as CreateTeamParams;
          if (!params.name) {
            errors.push('create_team: name is required');
          }
          break;
        }

        case 'invite_user': {
          const params = op.params as InviteUserParams;
          if (!params.email || !params.email.includes('@')) {
            errors.push('invite_user: valid email is required');
          }
          break;
        }

        case 'add_team_member': {
          const params = op.params as AddTeamMemberParams;
          if (!params.teamName) {
            errors.push('add_team_member: teamName is required');
          }
          if (!params.userEmail) {
            errors.push('add_team_member: userEmail is required');
          }
          break;
        }

        case 'create_schedule': {
          const params = op.params as CreateScheduleParams;
          if (!params.name) {
            errors.push('create_schedule: name is required');
          }
          break;
        }

        case 'create_escalation_policy': {
          const params = op.params as CreateEscalationPolicyParams;
          if (!params.name) {
            errors.push('create_escalation_policy: name is required');
          }
          if (!params.steps || params.steps.length === 0) {
            errors.push('create_escalation_policy: at least one step is required');
          }
          break;
        }

        case 'create_service': {
          const params = op.params as CreateServiceParams;
          if (!params.name) {
            errors.push('create_service: name is required');
          }
          break;
        }

        case 'update_service': {
          const params = op.params as UpdateServiceParams;
          if (!params.serviceName) {
            errors.push('update_service: serviceName is required');
          }
          break;
        }

        case 'set_oncall': {
          const params = op.params as SetOncallParams;
          if (!params.scheduleName) {
            errors.push('set_oncall: scheduleName is required');
          }
          if (!params.userEmail) {
            errors.push('set_oncall: userEmail is required');
          }
          break;
        }

        default:
          errors.push(`Unknown operation: ${op.operation}`);
      }
    }

    return errors;
  }

  /**
   * Execute a validated configuration plan with transaction support
   */
  private async executePlan(orgId: string, plan: ConfigurationPlan): Promise<ConfigurationResult> {
    await this.init();

    const results: OperationResult[] = [];
    this.entityCache.clear();

    // Create a query runner for transaction management
    const queryRunner = this.dataSource!.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const op of plan.operations) {
        const result = await this.executeOperation(orgId, op, queryRunner);
        results.push(result);

        if (!result.success) {
          // Rollback on failure
          await queryRunner.rollbackTransaction();
          return {
            success: false,
            summary: `Failed at: ${op.description}`,
            results,
            warnings: plan.warnings,
            rollbackPerformed: true,
            error: result.error,
          };
        }
      }

      // Commit all changes
      await queryRunner.commitTransaction();

      return {
        success: true,
        summary: plan.summary,
        results,
        warnings: plan.warnings,
      };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      logger.error('Transaction rolled back due to error', { error: error.message });
      return {
        success: false,
        summary: 'Configuration failed with error',
        results,
        warnings: plan.warnings,
        rollbackPerformed: true,
        error: error.message,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute a single operation within a transaction
   */
  private async executeOperation(
    orgId: string,
    op: ConfigOperation,
    queryRunner: QueryRunner
  ): Promise<OperationResult> {
    try {
      switch (op.operation) {
        case 'create_team':
          return await this.executeCreateTeam(orgId, op.params as CreateTeamParams, queryRunner);

        case 'invite_user':
          return await this.executeInviteUser(orgId, op.params as InviteUserParams, queryRunner);

        case 'add_team_member':
          return await this.executeAddTeamMember(orgId, op.params as AddTeamMemberParams, queryRunner);

        case 'create_schedule':
          return await this.executeCreateSchedule(orgId, op.params as CreateScheduleParams, queryRunner);

        case 'create_escalation_policy':
          return await this.executeCreateEscalationPolicy(orgId, op.params as CreateEscalationPolicyParams, queryRunner);

        case 'create_service':
          return await this.executeCreateService(orgId, op.params as CreateServiceParams, queryRunner);

        case 'update_service':
          return await this.executeUpdateService(orgId, op.params as UpdateServiceParams, queryRunner);

        case 'set_oncall':
          return await this.executeSetOncall(orgId, op.params as SetOncallParams, queryRunner);

        default:
          return {
            operation: op.operation,
            success: false,
            message: `Unknown operation: ${op.operation}`,
            error: `Unknown operation: ${op.operation}`,
          };
      }
    } catch (error: any) {
      return {
        operation: op.operation,
        success: false,
        message: `Failed to execute ${op.operation}`,
        error: error.message,
      };
    }
  }

  /**
   * Create a team
   */
  private async executeCreateTeam(
    orgId: string,
    params: CreateTeamParams,
    queryRunner: QueryRunner
  ): Promise<OperationResult> {
    // Check if team already exists
    const existing = await queryRunner.manager.findOne(Team, {
      where: { orgId, name: params.name },
    });

    if (existing) {
      // Team exists, cache and return success
      this.entityCache.set(`team:${params.name}`, existing.id);
      return {
        operation: 'create_team',
        success: true,
        message: `Team "${params.name}" already exists`,
        entityId: existing.id,
        entityType: 'team',
      };
    }

    const team = queryRunner.manager.create(Team, {
      orgId,
      name: params.name,
      description: params.description || null,
      privacy: params.privacy || 'public',
      slug: Team.generateSlug(params.name),
    });

    const saved = await queryRunner.manager.save(team);
    this.entityCache.set(`team:${params.name}`, saved.id);

    logger.info('Created team via NL config', { teamId: saved.id, name: params.name });

    return {
      operation: 'create_team',
      success: true,
      message: `Created team "${params.name}"`,
      entityId: saved.id,
      entityType: 'team',
    };
  }

  /**
   * Invite/create a user
   */
  private async executeInviteUser(
    orgId: string,
    params: InviteUserParams,
    queryRunner: QueryRunner
  ): Promise<OperationResult> {
    // Check if user already exists
    const existing = await queryRunner.manager.findOne(User, {
      where: { orgId, email: params.email },
    });

    if (existing) {
      this.entityCache.set(`user:${params.email}`, existing.id);
      return {
        operation: 'invite_user',
        success: true,
        message: `User "${params.email}" already exists`,
        entityId: existing.id,
        entityType: 'user',
      };
    }

    // Create a placeholder user (they'll need to complete signup)
    // In a real system, this would send an invitation email
    const user = queryRunner.manager.create(User, {
      orgId,
      email: params.email,
      fullName: params.fullName || null,
      baseRole: params.baseRole || 'responder',
      cognitoSub: `pending_${params.email}_${Date.now()}`, // Placeholder until signup
      status: 'inactive', // Pending invitation
    });

    const saved = await queryRunner.manager.save(user);
    this.entityCache.set(`user:${params.email}`, saved.id);

    logger.info('Created user placeholder via NL config', { userId: saved.id, email: params.email });

    return {
      operation: 'invite_user',
      success: true,
      message: `Invited user "${params.email}" (pending acceptance)`,
      entityId: saved.id,
      entityType: 'user',
    };
  }

  /**
   * Add a user to a team
   */
  private async executeAddTeamMember(
    orgId: string,
    params: AddTeamMemberParams,
    queryRunner: QueryRunner
  ): Promise<OperationResult> {
    // Find team (from cache or database)
    const teamId = this.entityCache.get(`team:${params.teamName}`) ||
      (await queryRunner.manager.findOne(Team, { where: { orgId, name: params.teamName } }))?.id;

    if (!teamId) {
      return {
        operation: 'add_team_member',
        success: false,
        message: `Team "${params.teamName}" not found`,
        error: `Team "${params.teamName}" not found`,
      };
    }

    // Find user (from cache or database)
    const userId = this.entityCache.get(`user:${params.userEmail}`) ||
      (await queryRunner.manager.findOne(User, { where: { orgId, email: params.userEmail } }))?.id;

    if (!userId) {
      return {
        operation: 'add_team_member',
        success: false,
        message: `User "${params.userEmail}" not found`,
        error: `User "${params.userEmail}" not found`,
      };
    }

    // Check if membership already exists
    const existingMembership = await queryRunner.manager.findOne(TeamMembership, {
      where: { teamId, userId },
    });

    if (existingMembership) {
      return {
        operation: 'add_team_member',
        success: true,
        message: `User "${params.userEmail}" is already a member of "${params.teamName}"`,
        entityId: existingMembership.id,
        entityType: 'team_membership',
      };
    }

    const membership = queryRunner.manager.create(TeamMembership, {
      teamId,
      userId,
      role: params.role || 'member',
    });

    const saved = await queryRunner.manager.save(membership);

    logger.info('Added team member via NL config', {
      membershipId: saved.id,
      teamId,
      userId,
    });

    return {
      operation: 'add_team_member',
      success: true,
      message: `Added "${params.userEmail}" to team "${params.teamName}"`,
      entityId: saved.id,
      entityType: 'team_membership',
    };
  }

  /**
   * Create a schedule
   */
  private async executeCreateSchedule(
    orgId: string,
    params: CreateScheduleParams,
    queryRunner: QueryRunner
  ): Promise<OperationResult> {
    // Check if schedule already exists
    const existing = await queryRunner.manager.findOne(Schedule, {
      where: { orgId, name: params.name },
    });

    if (existing) {
      this.entityCache.set(`schedule:${params.name}`, existing.id);
      return {
        operation: 'create_schedule',
        success: true,
        message: `Schedule "${params.name}" already exists`,
        entityId: existing.id,
        entityType: 'schedule',
      };
    }

    // Find team if specified
    let teamId: string | null = null;
    if (params.teamName) {
      teamId = this.entityCache.get(`team:${params.teamName}`) ||
        (await queryRunner.manager.findOne(Team, { where: { orgId, name: params.teamName } }))?.id || null;
    }

    const schedule = queryRunner.manager.create(Schedule, {
      orgId,
      teamId,
      name: params.name,
      timezone: params.timezone || 'UTC',
      type: params.rotationType === 'daily' || params.rotationType === 'weekly' ? params.rotationType : 'manual',
    });

    const savedSchedule = await queryRunner.manager.save(schedule);
    this.entityCache.set(`schedule:${params.name}`, savedSchedule.id);

    // If members are specified, create a layer with rotation
    if (params.members && params.members.length > 0) {
      const layer = queryRunner.manager.create(ScheduleLayer, {
        scheduleId: savedSchedule.id,
        name: `${params.name} Rotation`,
        rotationType: params.rotationType || 'weekly',
        startDate: new Date(),
        handoffTime: params.handoffTime || '09:00',
        handoffDay: params.handoffDay ?? 1, // Default to Monday
        layerOrder: 0,
      });

      const savedLayer = await queryRunner.manager.save(layer);

      // Add members to the layer
      let position = 0;
      for (const email of params.members) {
        const userId = this.entityCache.get(`user:${email}`) ||
          (await queryRunner.manager.findOne(User, { where: { orgId, email } }))?.id;

        if (userId) {
          const member = queryRunner.manager.create(ScheduleLayerMember, {
            layerId: savedLayer.id,
            userId,
            position,
          });
          await queryRunner.manager.save(member);
          position++;
        }
      }
    }

    logger.info('Created schedule via NL config', { scheduleId: savedSchedule.id, name: params.name });

    return {
      operation: 'create_schedule',
      success: true,
      message: `Created schedule "${params.name}"${params.members ? ` with ${params.members.length} members` : ''}`,
      entityId: savedSchedule.id,
      entityType: 'schedule',
    };
  }

  /**
   * Create an escalation policy
   */
  private async executeCreateEscalationPolicy(
    orgId: string,
    params: CreateEscalationPolicyParams,
    queryRunner: QueryRunner
  ): Promise<OperationResult> {
    // Check if policy already exists
    const existing = await queryRunner.manager.findOne(EscalationPolicy, {
      where: { orgId, name: params.name },
    });

    if (existing) {
      this.entityCache.set(`escalation_policy:${params.name}`, existing.id);
      return {
        operation: 'create_escalation_policy',
        success: true,
        message: `Escalation policy "${params.name}" already exists`,
        entityId: existing.id,
        entityType: 'escalation_policy',
      };
    }

    // Find team if specified
    let teamId: string | null = null;
    if (params.teamName) {
      teamId = this.entityCache.get(`team:${params.teamName}`) ||
        (await queryRunner.manager.findOne(Team, { where: { orgId, name: params.teamName } }))?.id || null;
    }

    const policy = queryRunner.manager.create(EscalationPolicy, {
      orgId,
      teamId,
      name: params.name,
      description: params.description || null,
      repeatEnabled: params.repeatEnabled ?? false,
      repeatCount: params.repeatCount ?? 0,
    });

    const savedPolicy = await queryRunner.manager.save(policy);
    this.entityCache.set(`escalation_policy:${params.name}`, savedPolicy.id);

    // Create escalation steps
    let stepOrder = 1;
    for (const stepParams of params.steps) {
      let scheduleId: string | null = null;
      let userIds: string[] | null = null;
      let targetType: 'schedule' | 'users' = 'users';

      if (stepParams.scheduleName) {
        scheduleId = this.entityCache.get(`schedule:${stepParams.scheduleName}`) ||
          (await queryRunner.manager.findOne(Schedule, { where: { orgId, name: stepParams.scheduleName } }))?.id || null;
        if (scheduleId) {
          targetType = 'schedule';
        }
      }

      if (stepParams.userEmails && stepParams.userEmails.length > 0) {
        userIds = [];
        for (const email of stepParams.userEmails) {
          const userId = this.entityCache.get(`user:${email}`) ||
            (await queryRunner.manager.findOne(User, { where: { orgId, email } }))?.id;
          if (userId) {
            userIds.push(userId);
          }
        }
        if (userIds.length > 0 && !scheduleId) {
          targetType = 'users';
        }
      }

      const step = queryRunner.manager.create(EscalationStep, {
        escalationPolicyId: savedPolicy.id,
        stepOrder,
        targetType,
        scheduleId,
        userIds,
        timeoutSeconds: (stepParams.timeoutMinutes || 5) * 60,
      });

      await queryRunner.manager.save(step);
      stepOrder++;
    }

    logger.info('Created escalation policy via NL config', {
      policyId: savedPolicy.id,
      name: params.name,
      stepCount: params.steps.length,
    });

    return {
      operation: 'create_escalation_policy',
      success: true,
      message: `Created escalation policy "${params.name}" with ${params.steps.length} steps`,
      entityId: savedPolicy.id,
      entityType: 'escalation_policy',
    };
  }

  /**
   * Create a service
   */
  private async executeCreateService(
    orgId: string,
    params: CreateServiceParams,
    queryRunner: QueryRunner
  ): Promise<OperationResult> {
    // Check if service already exists
    const existing = await queryRunner.manager.findOne(Service, {
      where: { orgId, name: params.name },
    });

    if (existing) {
      this.entityCache.set(`service:${params.name}`, existing.id);
      return {
        operation: 'create_service',
        success: true,
        message: `Service "${params.name}" already exists`,
        entityId: existing.id,
        entityType: 'service',
      };
    }

    // Find related entities
    let teamId: string | null = null;
    let escalationPolicyId: string | null = null;
    let scheduleId: string | null = null;

    if (params.teamName) {
      teamId = this.entityCache.get(`team:${params.teamName}`) ||
        (await queryRunner.manager.findOne(Team, { where: { orgId, name: params.teamName } }))?.id || null;
    }

    if (params.escalationPolicyName) {
      escalationPolicyId = this.entityCache.get(`escalation_policy:${params.escalationPolicyName}`) ||
        (await queryRunner.manager.findOne(EscalationPolicy, { where: { orgId, name: params.escalationPolicyName } }))?.id || null;
    }

    if (params.scheduleName) {
      scheduleId = this.entityCache.get(`schedule:${params.scheduleName}`) ||
        (await queryRunner.manager.findOne(Schedule, { where: { orgId, name: params.scheduleName } }))?.id || null;
    }

    const service = queryRunner.manager.create(Service, {
      orgId,
      teamId,
      name: params.name,
      description: params.description || null,
      escalationPolicyId,
      scheduleId,
      urgency: params.urgency || 'high',
      status: 'active',
    });

    const saved = await queryRunner.manager.save(service);
    this.entityCache.set(`service:${params.name}`, saved.id);

    logger.info('Created service via NL config', { serviceId: saved.id, name: params.name });

    return {
      operation: 'create_service',
      success: true,
      message: `Created service "${params.name}"`,
      entityId: saved.id,
      entityType: 'service',
    };
  }

  /**
   * Update an existing service
   */
  private async executeUpdateService(
    orgId: string,
    params: UpdateServiceParams,
    queryRunner: QueryRunner
  ): Promise<OperationResult> {
    const service = await queryRunner.manager.findOne(Service, {
      where: { orgId, name: params.serviceName },
    });

    if (!service) {
      return {
        operation: 'update_service',
        success: false,
        message: `Service "${params.serviceName}" not found`,
        error: `Service "${params.serviceName}" not found`,
      };
    }

    const updates: Partial<Service> = {};

    if (params.teamName) {
      const teamId = this.entityCache.get(`team:${params.teamName}`) ||
        (await queryRunner.manager.findOne(Team, { where: { orgId, name: params.teamName } }))?.id;
      if (teamId) {
        updates.teamId = teamId;
      }
    }

    if (params.escalationPolicyName) {
      const policyId = this.entityCache.get(`escalation_policy:${params.escalationPolicyName}`) ||
        (await queryRunner.manager.findOne(EscalationPolicy, { where: { orgId, name: params.escalationPolicyName } }))?.id;
      if (policyId) {
        updates.escalationPolicyId = policyId;
      }
    }

    if (params.scheduleName) {
      const scheduleId = this.entityCache.get(`schedule:${params.scheduleName}`) ||
        (await queryRunner.manager.findOne(Schedule, { where: { orgId, name: params.scheduleName } }))?.id;
      if (scheduleId) {
        updates.scheduleId = scheduleId;
      }
    }

    if (Object.keys(updates).length > 0) {
      await queryRunner.manager.update(Service, service.id, updates);
    }

    logger.info('Updated service via NL config', { serviceId: service.id, updates });

    return {
      operation: 'update_service',
      success: true,
      message: `Updated service "${params.serviceName}"`,
      entityId: service.id,
      entityType: 'service',
    };
  }

  /**
   * Set the current on-call person for a schedule
   */
  private async executeSetOncall(
    orgId: string,
    params: SetOncallParams,
    queryRunner: QueryRunner
  ): Promise<OperationResult> {
    const schedule = await queryRunner.manager.findOne(Schedule, {
      where: { orgId, name: params.scheduleName },
    });

    if (!schedule) {
      return {
        operation: 'set_oncall',
        success: false,
        message: `Schedule "${params.scheduleName}" not found`,
        error: `Schedule "${params.scheduleName}" not found`,
      };
    }

    const userId = this.entityCache.get(`user:${params.userEmail}`) ||
      (await queryRunner.manager.findOne(User, { where: { orgId, email: params.userEmail } }))?.id;

    if (!userId) {
      return {
        operation: 'set_oncall',
        success: false,
        message: `User "${params.userEmail}" not found`,
        error: `User "${params.userEmail}" not found`,
      };
    }

    // Set the current on-call user
    await queryRunner.manager.update(Schedule, schedule.id, {
      currentOncallUserId: userId,
    });

    logger.info('Set on-call via NL config', {
      scheduleId: schedule.id,
      userId,
      email: params.userEmail,
    });

    return {
      operation: 'set_oncall',
      success: true,
      message: `Set "${params.userEmail}" as on-call for "${params.scheduleName}"`,
      entityId: schedule.id,
      entityType: 'schedule',
    };
  }
}

// Export singleton instance
export const nlConfigurationService = new NaturalLanguageConfigurationService();
