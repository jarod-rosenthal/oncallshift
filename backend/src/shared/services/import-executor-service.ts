/**
 * Import Executor Service for Semantic Import
 *
 * Handles previewing and executing imports based on extracted configuration data.
 * Supports importing teams, users, schedules, escalation policies, and services
 * with proper dependency ordering and transaction support.
 */

import { DataSource, Repository, QueryRunner, ILike } from 'typeorm';
import { getDataSource } from '../db/data-source';
import { logger } from '../utils/logger';

// Import models
import { Team } from '../models/Team';
import { User, BaseRole } from '../models/User';
import { TeamMembership, TeamRole } from '../models/TeamMembership';
import { Schedule } from '../models/Schedule';
import { ScheduleLayer, RotationType, LayerRestrictions } from '../models/ScheduleLayer';
import { ScheduleLayerMember } from '../models/ScheduleLayerMember';
import { EscalationPolicy } from '../models/EscalationPolicy';
import { EscalationStep, EscalationTargetType, NotifyStrategy } from '../models/EscalationStep';
import { EscalationTarget } from '../models/EscalationTarget';
import { Service } from '../models/Service';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Extracted team configuration from source platform
 */
export interface ExtractedTeam {
  name: string;
  description?: string;
  members?: Array<{
    email?: string;
    name?: string;
    role?: 'manager' | 'member';
  }>;
  sourceId?: string; // Original ID from source platform
}

/**
 * Extracted user configuration from source platform
 */
export interface ExtractedUser {
  email: string;
  name?: string;
  role?: BaseRole;
  timezone?: string;
  phoneNumber?: string;
  sourceId?: string;
}

/**
 * Extracted schedule layer configuration
 */
export interface ExtractedScheduleLayer {
  name: string;
  rotationType: 'daily' | 'weekly' | 'custom';
  startDate?: string; // ISO date string
  endDate?: string;
  handoffTime?: string; // HH:mm format
  handoffDay?: number; // 0-6 for weekly
  rotationLength?: number; // days for custom rotation
  members: Array<{
    email?: string;
    name?: string;
    position: number;
  }>;
  restrictions?: LayerRestrictions;
}

/**
 * Extracted schedule configuration from source platform
 */
export interface ExtractedSchedule {
  name: string;
  description?: string;
  timezone?: string;
  teamName?: string; // Reference to team by name
  layers?: ExtractedScheduleLayer[];
  currentOncallEmail?: string; // For manual schedules
  sourceId?: string;
}

/**
 * Extracted escalation step configuration
 */
export interface ExtractedEscalationStep {
  stepOrder: number;
  timeoutMinutes: number;
  notifyStrategy?: 'all' | 'round_robin';
  targets: Array<{
    type: 'user' | 'schedule';
    email?: string; // For user targets
    scheduleName?: string; // For schedule targets
    userName?: string; // Fallback if email not available
  }>;
}

/**
 * Extracted escalation policy configuration from source platform
 */
export interface ExtractedEscalationPolicy {
  name: string;
  description?: string;
  teamName?: string;
  steps: ExtractedEscalationStep[];
  repeatEnabled?: boolean;
  repeatCount?: number;
  sourceId?: string;
}

/**
 * Extracted service configuration from source platform
 */
export interface ExtractedService {
  name: string;
  description?: string;
  teamName?: string;
  escalationPolicyName?: string;
  scheduleName?: string;
  urgency?: 'high' | 'low' | 'dynamic';
  status?: 'active' | 'inactive' | 'maintenance';
  externalKeys?: {
    pagerduty?: string;
    opsgenie?: string;
  };
  sourceId?: string;
}

/**
 * Complete extraction result from AI or parsing
 */
export interface ImportExtraction {
  teams?: ExtractedTeam[];
  users?: ExtractedUser[];
  schedules?: ExtractedSchedule[];
  escalationPolicies?: ExtractedEscalationPolicy[];
  services?: ExtractedService[];
  metadata?: {
    source?: string; // 'pagerduty', 'opsgenie', 'document', 'natural_language'
    extractedAt?: string;
    confidence?: number;
    warnings?: string[];
  };
}

/**
 * Conflict types for import preview
 */
export type ConflictType = 'team' | 'user' | 'schedule' | 'escalation_policy' | 'service';

/**
 * Single conflict item
 */
export interface ImportConflict {
  type: ConflictType;
  name: string;
  email?: string; // For user conflicts
  existingId: string;
  resolution: 'skip' | 'merge' | 'rename';
  suggestion?: string; // Suggested new name for rename resolution
}

/**
 * Preview result for a single entity type
 */
export interface EntityPreview {
  willCreate: number;
  willSkip: number;
  willUpdate: number;
  items: Array<{
    name: string;
    action: 'create' | 'skip' | 'update';
    reason?: string;
    existingId?: string;
  }>;
  errors: string[];
}

/**
 * Complete preview result
 */
export interface ImportPreview {
  isValid: boolean;
  teams: EntityPreview;
  users: EntityPreview;
  schedules: EntityPreview;
  escalationPolicies: EntityPreview;
  services: EntityPreview;
  conflicts: ImportConflict[];
  warnings: string[];
  errors: string[];
  summary: {
    totalToCreate: number;
    totalToSkip: number;
    totalToUpdate: number;
    totalConflicts: number;
  };
}

/**
 * Result of executing an import
 */
export interface ImportExecutionResult {
  success: boolean;
  teams: {
    created: Array<{ name: string; id: string }>;
    skipped: Array<{ name: string; reason: string }>;
    errors: Array<{ name: string; error: string }>;
  };
  users: {
    created: Array<{ email: string; id: string }>;
    skipped: Array<{ email: string; reason: string }>;
    errors: Array<{ email: string; error: string }>;
  };
  schedules: {
    created: Array<{ name: string; id: string }>;
    skipped: Array<{ name: string; reason: string }>;
    errors: Array<{ name: string; error: string }>;
  };
  escalationPolicies: {
    created: Array<{ name: string; id: string }>;
    skipped: Array<{ name: string; reason: string }>;
    errors: Array<{ name: string; error: string }>;
  };
  services: {
    created: Array<{ name: string; id: string }>;
    skipped: Array<{ name: string; reason: string }>;
    errors: Array<{ name: string; error: string }>;
  };
  summary: {
    totalCreated: number;
    totalSkipped: number;
    totalErrors: number;
    duration: number; // milliseconds
  };
  rollbackPerformed?: boolean;
  error?: string;
}

// ============================================================================
// Import Executor Service
// ============================================================================

export class ImportExecutorService {
  private dataSource: DataSource | null = null;

  // Repositories - used for preview lookups (execute uses queryRunner.manager)
  private teamRepo: Repository<Team> | null = null;
  private userRepo: Repository<User> | null = null;
  private scheduleRepo: Repository<Schedule> | null = null;
  private escalationPolicyRepo: Repository<EscalationPolicy> | null = null;
  private serviceRepo: Repository<Service> | null = null;

  // Entity ID maps for reference resolution during import
  private teamMap: Map<string, string> = new Map(); // name -> id
  private userMap: Map<string, string> = new Map(); // email -> id
  private scheduleMap: Map<string, string> = new Map(); // name -> id
  private escalationPolicyMap: Map<string, string> = new Map(); // name -> id

  /**
   * Initialize data source and repositories
   */
  private async init(): Promise<void> {
    if (this.dataSource) return;

    this.dataSource = await getDataSource();
    this.teamRepo = this.dataSource.getRepository(Team);
    this.userRepo = this.dataSource.getRepository(User);
    this.scheduleRepo = this.dataSource.getRepository(Schedule);
    this.escalationPolicyRepo = this.dataSource.getRepository(EscalationPolicy);
    this.serviceRepo = this.dataSource.getRepository(Service);
  }

  /**
   * Clear entity maps for a new import operation
   */
  private clearMaps(): void {
    this.teamMap.clear();
    this.userMap.clear();
    this.scheduleMap.clear();
    this.escalationPolicyMap.clear();
  }

  // ============================================================================
  // Preview Import (Dry Run)
  // ============================================================================

  /**
   * Preview an import without creating any database records
   * @param extraction The extracted configuration data
   * @param orgId Organization ID
   * @returns Detailed preview of what would be created/skipped
   */
  async previewImport(extraction: ImportExtraction, orgId: string): Promise<ImportPreview> {
    await this.init();

    const preview: ImportPreview = {
      isValid: true,
      teams: { willCreate: 0, willSkip: 0, willUpdate: 0, items: [], errors: [] },
      users: { willCreate: 0, willSkip: 0, willUpdate: 0, items: [], errors: [] },
      schedules: { willCreate: 0, willSkip: 0, willUpdate: 0, items: [], errors: [] },
      escalationPolicies: { willCreate: 0, willSkip: 0, willUpdate: 0, items: [], errors: [] },
      services: { willCreate: 0, willSkip: 0, willUpdate: 0, items: [], errors: [] },
      conflicts: [],
      warnings: [],
      errors: [],
      summary: { totalToCreate: 0, totalToSkip: 0, totalToUpdate: 0, totalConflicts: 0 },
    };

    try {
      // Check teams
      if (extraction.teams && extraction.teams.length > 0) {
        for (const team of extraction.teams) {
          if (!team.name) {
            preview.teams.errors.push('Team missing required name');
            preview.isValid = false;
            continue;
          }

          const existing = await this.teamRepo!.findOne({
            where: { orgId, name: team.name },
          });

          if (existing) {
            preview.teams.willSkip++;
            preview.teams.items.push({
              name: team.name,
              action: 'skip',
              reason: 'Team with this name already exists',
              existingId: existing.id,
            });
            preview.conflicts.push({
              type: 'team',
              name: team.name,
              existingId: existing.id,
              resolution: 'skip',
            });
          } else {
            preview.teams.willCreate++;
            preview.teams.items.push({
              name: team.name,
              action: 'create',
            });
          }
        }
      }

      // Check users
      if (extraction.users && extraction.users.length > 0) {
        for (const user of extraction.users) {
          if (!user.email) {
            preview.users.errors.push(`User ${user.name || 'unknown'} missing required email`);
            preview.isValid = false;
            continue;
          }

          const existing = await this.userRepo!.findOne({
            where: { orgId, email: user.email },
          });

          if (existing) {
            preview.users.willSkip++;
            preview.users.items.push({
              name: user.email,
              action: 'skip',
              reason: 'User with this email already exists',
              existingId: existing.id,
            });
            preview.conflicts.push({
              type: 'user',
              name: user.name || user.email,
              email: user.email,
              existingId: existing.id,
              resolution: 'skip',
            });
          } else {
            preview.users.willCreate++;
            preview.users.items.push({
              name: user.email,
              action: 'create',
            });
            preview.warnings.push(`User ${user.email} will need to set up authentication`);
          }
        }
      }

      // Check schedules
      if (extraction.schedules && extraction.schedules.length > 0) {
        for (const schedule of extraction.schedules) {
          if (!schedule.name) {
            preview.schedules.errors.push('Schedule missing required name');
            preview.isValid = false;
            continue;
          }

          const existing = await this.scheduleRepo!.findOne({
            where: { orgId, name: schedule.name },
          });

          if (existing) {
            preview.schedules.willSkip++;
            preview.schedules.items.push({
              name: schedule.name,
              action: 'skip',
              reason: 'Schedule with this name already exists',
              existingId: existing.id,
            });
            preview.conflicts.push({
              type: 'schedule',
              name: schedule.name,
              existingId: existing.id,
              resolution: 'skip',
            });
          } else {
            preview.schedules.willCreate++;
            preview.schedules.items.push({
              name: schedule.name,
              action: 'create',
            });

            // Warn about layers without resolvable members
            if (schedule.layers) {
              for (const layer of schedule.layers) {
                const unresolvableMembers = layer.members.filter(
                  m => !m.email && !m.name
                );
                if (unresolvableMembers.length > 0) {
                  preview.warnings.push(
                    `Schedule "${schedule.name}" layer "${layer.name}" has ${unresolvableMembers.length} members without email or name`
                  );
                }
              }
            }
          }
        }
      }

      // Check escalation policies
      if (extraction.escalationPolicies && extraction.escalationPolicies.length > 0) {
        for (const policy of extraction.escalationPolicies) {
          if (!policy.name) {
            preview.escalationPolicies.errors.push('Escalation policy missing required name');
            preview.isValid = false;
            continue;
          }

          if (!policy.steps || policy.steps.length === 0) {
            preview.escalationPolicies.errors.push(
              `Escalation policy "${policy.name}" has no steps`
            );
            preview.isValid = false;
            continue;
          }

          const existing = await this.escalationPolicyRepo!.findOne({
            where: { orgId, name: policy.name },
          });

          if (existing) {
            preview.escalationPolicies.willSkip++;
            preview.escalationPolicies.items.push({
              name: policy.name,
              action: 'skip',
              reason: 'Escalation policy with this name already exists',
              existingId: existing.id,
            });
            preview.conflicts.push({
              type: 'escalation_policy',
              name: policy.name,
              existingId: existing.id,
              resolution: 'skip',
            });
          } else {
            preview.escalationPolicies.willCreate++;
            preview.escalationPolicies.items.push({
              name: policy.name,
              action: 'create',
            });
          }
        }
      }

      // Check services
      if (extraction.services && extraction.services.length > 0) {
        for (const service of extraction.services) {
          if (!service.name) {
            preview.services.errors.push('Service missing required name');
            preview.isValid = false;
            continue;
          }

          const existing = await this.serviceRepo!.findOne({
            where: { orgId, name: service.name },
          });

          if (existing) {
            preview.services.willSkip++;
            preview.services.items.push({
              name: service.name,
              action: 'skip',
              reason: 'Service with this name already exists',
              existingId: existing.id,
            });
            preview.conflicts.push({
              type: 'service',
              name: service.name,
              existingId: existing.id,
              resolution: 'skip',
            });
          } else {
            preview.services.willCreate++;
            preview.services.items.push({
              name: service.name,
              action: 'create',
            });

            // Warn about missing dependencies
            if (service.escalationPolicyName && extraction.escalationPolicies) {
              const policyExists = extraction.escalationPolicies.some(
                p => p.name === service.escalationPolicyName
              );
              if (!policyExists) {
                const existingPolicy = await this.escalationPolicyRepo!.findOne({
                  where: { orgId, name: service.escalationPolicyName },
                });
                if (!existingPolicy) {
                  preview.warnings.push(
                    `Service "${service.name}" references escalation policy "${service.escalationPolicyName}" which doesn't exist`
                  );
                }
              }
            }
          }
        }
      }

      // Calculate summary
      preview.summary.totalToCreate =
        preview.teams.willCreate +
        preview.users.willCreate +
        preview.schedules.willCreate +
        preview.escalationPolicies.willCreate +
        preview.services.willCreate;

      preview.summary.totalToSkip =
        preview.teams.willSkip +
        preview.users.willSkip +
        preview.schedules.willSkip +
        preview.escalationPolicies.willSkip +
        preview.services.willSkip;

      preview.summary.totalToUpdate =
        preview.teams.willUpdate +
        preview.users.willUpdate +
        preview.schedules.willUpdate +
        preview.escalationPolicies.willUpdate +
        preview.services.willUpdate;

      preview.summary.totalConflicts = preview.conflicts.length;

      // Collect all errors
      preview.errors = [
        ...preview.teams.errors,
        ...preview.users.errors,
        ...preview.schedules.errors,
        ...preview.escalationPolicies.errors,
        ...preview.services.errors,
      ];

      if (preview.errors.length > 0) {
        preview.isValid = false;
      }

      // Add metadata warnings
      if (extraction.metadata?.warnings) {
        preview.warnings.push(...extraction.metadata.warnings);
      }

    } catch (error: any) {
      logger.error('Failed to preview import', { error: error.message, orgId });
      preview.isValid = false;
      preview.errors.push(`Preview failed: ${error.message}`);
    }

    return preview;
  }

  // ============================================================================
  // Execute Import
  // ============================================================================

  /**
   * Execute an import based on extracted configuration data
   * Creates resources in the correct dependency order with transaction support
   *
   * @param extraction The extracted configuration data
   * @param orgId Organization ID
   * @returns Detailed results of the import
   */
  async executeImport(
    extraction: ImportExtraction,
    orgId: string
  ): Promise<ImportExecutionResult> {
    await this.init();
    this.clearMaps();

    const startTime = Date.now();
    const result: ImportExecutionResult = {
      success: true,
      teams: { created: [], skipped: [], errors: [] },
      users: { created: [], skipped: [], errors: [] },
      schedules: { created: [], skipped: [], errors: [] },
      escalationPolicies: { created: [], skipped: [], errors: [] },
      services: { created: [], skipped: [], errors: [] },
      summary: { totalCreated: 0, totalSkipped: 0, totalErrors: 0, duration: 0 },
    };

    // Create a query runner for transaction management
    const queryRunner = this.dataSource!.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Pre-populate maps with existing entities for reference resolution
      await this.populateExistingMaps(orgId, queryRunner);

      // 1. Create teams first (no dependencies)
      if (extraction.teams && extraction.teams.length > 0) {
        logger.info('Importing teams', { count: extraction.teams.length, orgId });
        for (const team of extraction.teams) {
          try {
            const teamResult = await this.createTeamWithMembers(team, orgId, queryRunner);
            if (teamResult.created) {
              result.teams.created.push({ name: team.name, id: teamResult.id! });
            } else {
              result.teams.skipped.push({ name: team.name, reason: teamResult.reason! });
            }
          } catch (error: any) {
            result.teams.errors.push({ name: team.name, error: error.message });
          }
        }
      }

      // 2. Create users (may reference teams via membership)
      if (extraction.users && extraction.users.length > 0) {
        logger.info('Importing users', { count: extraction.users.length, orgId });
        for (const user of extraction.users) {
          try {
            const userResult = await this.findOrCreateUser(user.email, user.name || null, orgId, queryRunner, {
              role: user.role,
              phoneNumber: user.phoneNumber,
            });
            if (userResult.created) {
              result.users.created.push({ email: user.email, id: userResult.id! });
            } else {
              result.users.skipped.push({ email: user.email, reason: userResult.reason! });
            }
          } catch (error: any) {
            result.users.errors.push({ email: user.email, error: error.message });
          }
        }
      }

      // 3. Create schedules (reference teams, users)
      if (extraction.schedules && extraction.schedules.length > 0) {
        logger.info('Importing schedules', { count: extraction.schedules.length, orgId });
        for (const schedule of extraction.schedules) {
          try {
            const scheduleResult = await this.createSchedule(schedule, orgId, queryRunner);
            if (scheduleResult.created) {
              result.schedules.created.push({ name: schedule.name, id: scheduleResult.id! });
            } else {
              result.schedules.skipped.push({ name: schedule.name, reason: scheduleResult.reason! });
            }
          } catch (error: any) {
            result.schedules.errors.push({ name: schedule.name, error: error.message });
          }
        }
      }

      // 4. Create escalation policies (reference users, schedules)
      if (extraction.escalationPolicies && extraction.escalationPolicies.length > 0) {
        logger.info('Importing escalation policies', {
          count: extraction.escalationPolicies.length,
          orgId,
        });
        for (const policy of extraction.escalationPolicies) {
          try {
            const policyResult = await this.createEscalationPolicy(policy, orgId, queryRunner);
            if (policyResult.created) {
              result.escalationPolicies.created.push({ name: policy.name, id: policyResult.id! });
            } else {
              result.escalationPolicies.skipped.push({
                name: policy.name,
                reason: policyResult.reason!,
              });
            }
          } catch (error: any) {
            result.escalationPolicies.errors.push({ name: policy.name, error: error.message });
          }
        }
      }

      // 5. Create services (reference escalation policies, teams)
      if (extraction.services && extraction.services.length > 0) {
        logger.info('Importing services', { count: extraction.services.length, orgId });
        for (const service of extraction.services) {
          try {
            const serviceResult = await this.createService(service, orgId, queryRunner);
            if (serviceResult.created) {
              result.services.created.push({ name: service.name, id: serviceResult.id! });
            } else {
              result.services.skipped.push({ name: service.name, reason: serviceResult.reason! });
            }
          } catch (error: any) {
            result.services.errors.push({ name: service.name, error: error.message });
          }
        }
      }

      // Commit transaction
      await queryRunner.commitTransaction();

      // Calculate summary
      result.summary.totalCreated =
        result.teams.created.length +
        result.users.created.length +
        result.schedules.created.length +
        result.escalationPolicies.created.length +
        result.services.created.length;

      result.summary.totalSkipped =
        result.teams.skipped.length +
        result.users.skipped.length +
        result.schedules.skipped.length +
        result.escalationPolicies.skipped.length +
        result.services.skipped.length;

      result.summary.totalErrors =
        result.teams.errors.length +
        result.users.errors.length +
        result.schedules.errors.length +
        result.escalationPolicies.errors.length +
        result.services.errors.length;

      result.summary.duration = Date.now() - startTime;

      if (result.summary.totalErrors > 0) {
        result.success = false;
      }

      logger.info('Import completed', {
        orgId,
        created: result.summary.totalCreated,
        skipped: result.summary.totalSkipped,
        errors: result.summary.totalErrors,
        duration: result.summary.duration,
      });

    } catch (error: any) {
      // Rollback on failure
      await queryRunner.rollbackTransaction();
      result.success = false;
      result.rollbackPerformed = true;
      result.error = error.message;
      result.summary.duration = Date.now() - startTime;

      logger.error('Import failed, transaction rolled back', {
        orgId,
        error: error.message,
      });
    } finally {
      await queryRunner.release();
    }

    return result;
  }

  // ============================================================================
  // Conflict Detection
  // ============================================================================

  /**
   * Detect conflicts between extraction data and existing resources
   * @param extraction The extracted configuration data
   * @param orgId Organization ID
   * @returns List of conflicts with resolution suggestions
   */
  async detectConflicts(
    extraction: ImportExtraction,
    orgId: string
  ): Promise<ImportConflict[]> {
    await this.init();

    const conflicts: ImportConflict[] = [];

    // Check team conflicts
    if (extraction.teams) {
      for (const team of extraction.teams) {
        if (!team.name) continue;

        const existing = await this.teamRepo!.findOne({
          where: { orgId, name: team.name },
        });

        if (existing) {
          conflicts.push({
            type: 'team',
            name: team.name,
            existingId: existing.id,
            resolution: 'skip',
            suggestion: `${team.name} (imported)`,
          });
        }
      }
    }

    // Check user conflicts
    if (extraction.users) {
      for (const user of extraction.users) {
        if (!user.email) continue;

        const existing = await this.userRepo!.findOne({
          where: { orgId, email: user.email },
        });

        if (existing) {
          conflicts.push({
            type: 'user',
            name: user.name || user.email,
            email: user.email,
            existingId: existing.id,
            resolution: 'skip',
          });
        }
      }
    }

    // Check schedule conflicts
    if (extraction.schedules) {
      for (const schedule of extraction.schedules) {
        if (!schedule.name) continue;

        const existing = await this.scheduleRepo!.findOne({
          where: { orgId, name: schedule.name },
        });

        if (existing) {
          conflicts.push({
            type: 'schedule',
            name: schedule.name,
            existingId: existing.id,
            resolution: 'skip',
            suggestion: `${schedule.name} (imported)`,
          });
        }
      }
    }

    // Check escalation policy conflicts
    if (extraction.escalationPolicies) {
      for (const policy of extraction.escalationPolicies) {
        if (!policy.name) continue;

        const existing = await this.escalationPolicyRepo!.findOne({
          where: { orgId, name: policy.name },
        });

        if (existing) {
          conflicts.push({
            type: 'escalation_policy',
            name: policy.name,
            existingId: existing.id,
            resolution: 'skip',
            suggestion: `${policy.name} (imported)`,
          });
        }
      }
    }

    // Check service conflicts
    if (extraction.services) {
      for (const service of extraction.services) {
        if (!service.name) continue;

        const existing = await this.serviceRepo!.findOne({
          where: { orgId, name: service.name },
        });

        if (existing) {
          conflicts.push({
            type: 'service',
            name: service.name,
            existingId: existing.id,
            resolution: 'skip',
            suggestion: `${service.name} (imported)`,
          });
        }
      }
    }

    return conflicts;
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Pre-populate entity maps with existing resources for reference resolution
   */
  private async populateExistingMaps(
    orgId: string,
    queryRunner: QueryRunner
  ): Promise<void> {
    // Load existing teams
    const teams = await queryRunner.manager.find(Team, { where: { orgId } });
    for (const team of teams) {
      this.teamMap.set(team.name.toLowerCase(), team.id);
    }

    // Load existing users
    const users = await queryRunner.manager.find(User, { where: { orgId } });
    for (const user of users) {
      this.userMap.set(user.email.toLowerCase(), user.id);
      if (user.fullName) {
        this.userMap.set(user.fullName.toLowerCase(), user.id);
      }
    }

    // Load existing schedules
    const schedules = await queryRunner.manager.find(Schedule, { where: { orgId } });
    for (const schedule of schedules) {
      this.scheduleMap.set(schedule.name.toLowerCase(), schedule.id);
    }

    // Load existing escalation policies
    const policies = await queryRunner.manager.find(EscalationPolicy, { where: { orgId } });
    for (const policy of policies) {
      this.escalationPolicyMap.set(policy.name.toLowerCase(), policy.id);
    }
  }

  /**
   * Find an existing user or create a new one
   */
  async findOrCreateUser(
    email: string,
    name: string | null,
    orgId: string,
    queryRunner: QueryRunner,
    options?: {
      role?: BaseRole;
      phoneNumber?: string;
    }
  ): Promise<{ id: string; created: boolean; reason?: string }> {
    const normalizedEmail = email.toLowerCase();

    // Check cache first
    const cachedId = this.userMap.get(normalizedEmail);
    if (cachedId) {
      return { id: cachedId, created: false, reason: 'User already exists' };
    }

    // Check database
    const existing = await queryRunner.manager.findOne(User, {
      where: { orgId, email: normalizedEmail },
    });

    if (existing) {
      this.userMap.set(normalizedEmail, existing.id);
      if (name) {
        this.userMap.set(name.toLowerCase(), existing.id);
      }
      return { id: existing.id, created: false, reason: 'User already exists' };
    }

    // Create new user (placeholder - they'll need to complete signup)
    const user = queryRunner.manager.create(User, {
      orgId,
      email: normalizedEmail,
      fullName: name || null,
      baseRole: options?.role || 'responder',
      phoneNumber: options?.phoneNumber || null,
      cognitoSub: `pending_${normalizedEmail}_${Date.now()}`, // Placeholder until signup
      status: 'inactive', // Pending invitation
    });

    const saved = await queryRunner.manager.save(user);
    this.userMap.set(normalizedEmail, saved.id);
    if (name) {
      this.userMap.set(name.toLowerCase(), saved.id);
    }

    logger.info('Created user via import', { userId: saved.id, email: normalizedEmail });

    return { id: saved.id, created: true };
  }

  /**
   * Match a user by name when email is not available
   * Uses fuzzy matching to find the best match
   */
  async matchUserByName(
    name: string,
    orgId: string,
    queryRunner: QueryRunner
  ): Promise<string | null> {
    const normalizedName = name.toLowerCase();

    // Check cache first
    const cachedId = this.userMap.get(normalizedName);
    if (cachedId) {
      return cachedId;
    }

    // Try exact match
    const exactMatch = await queryRunner.manager.findOne(User, {
      where: { orgId, fullName: name },
    });

    if (exactMatch) {
      this.userMap.set(normalizedName, exactMatch.id);
      return exactMatch.id;
    }

    // Try case-insensitive match
    const caseInsensitiveMatch = await queryRunner.manager.findOne(User, {
      where: { orgId, fullName: ILike(name) },
    });

    if (caseInsensitiveMatch) {
      this.userMap.set(normalizedName, caseInsensitiveMatch.id);
      return caseInsensitiveMatch.id;
    }

    // Try partial match (first name or last name)
    const nameParts = name.split(/\s+/);
    if (nameParts.length > 0) {
      const firstName = nameParts[0];
      const partialMatch = await queryRunner.manager.findOne(User, {
        where: { orgId, fullName: ILike(`${firstName}%`) },
      });

      if (partialMatch) {
        this.userMap.set(normalizedName, partialMatch.id);
        return partialMatch.id;
      }
    }

    return null;
  }

  /**
   * Create a team and add members
   */
  private async createTeamWithMembers(
    teamData: ExtractedTeam,
    orgId: string,
    queryRunner: QueryRunner
  ): Promise<{ id?: string; created: boolean; reason?: string }> {
    const normalizedName = teamData.name.toLowerCase();

    // Check if team exists
    const existingId = this.teamMap.get(normalizedName);
    if (existingId) {
      return { id: existingId, created: false, reason: 'Team already exists' };
    }

    const existing = await queryRunner.manager.findOne(Team, {
      where: { orgId, name: teamData.name },
    });

    if (existing) {
      this.teamMap.set(normalizedName, existing.id);
      return { id: existing.id, created: false, reason: 'Team already exists' };
    }

    // Create team
    const team = queryRunner.manager.create(Team, {
      orgId,
      name: teamData.name,
      description: teamData.description || null,
      privacy: 'public',
      slug: Team.generateSlug(teamData.name),
    });

    const savedTeam = await queryRunner.manager.save(team);
    this.teamMap.set(normalizedName, savedTeam.id);

    // Add members
    if (teamData.members && teamData.members.length > 0) {
      for (const member of teamData.members) {
        let userId: string | null = null;

        // Try to find user by email first
        if (member.email) {
          const userResult = await this.findOrCreateUser(
            member.email,
            member.name || null,
            orgId,
            queryRunner
          );
          userId = userResult.id;
        } else if (member.name) {
          // Fall back to name matching
          userId = await this.matchUserByName(member.name, orgId, queryRunner);
        }

        if (userId) {
          // Check if membership exists
          const existingMembership = await queryRunner.manager.findOne(TeamMembership, {
            where: { teamId: savedTeam.id, userId },
          });

          if (!existingMembership) {
            const membership = queryRunner.manager.create(TeamMembership, {
              teamId: savedTeam.id,
              userId,
              role: (member.role || 'member') as TeamRole,
            });
            await queryRunner.manager.save(membership);
          }
        }
      }
    }

    logger.info('Created team via import', { teamId: savedTeam.id, name: teamData.name });

    return { id: savedTeam.id, created: true };
  }

  /**
   * Create a schedule with layers and members
   */
  private async createSchedule(
    scheduleData: ExtractedSchedule,
    orgId: string,
    queryRunner: QueryRunner
  ): Promise<{ id?: string; created: boolean; reason?: string }> {
    const normalizedName = scheduleData.name.toLowerCase();

    // Check if schedule exists
    const existingId = this.scheduleMap.get(normalizedName);
    if (existingId) {
      return { id: existingId, created: false, reason: 'Schedule already exists' };
    }

    const existing = await queryRunner.manager.findOne(Schedule, {
      where: { orgId, name: scheduleData.name },
    });

    if (existing) {
      this.scheduleMap.set(normalizedName, existing.id);
      return { id: existing.id, created: false, reason: 'Schedule already exists' };
    }

    // Resolve team reference
    let teamId: string | null = null;
    if (scheduleData.teamName) {
      teamId = this.teamMap.get(scheduleData.teamName.toLowerCase()) || null;
    }

    // Determine schedule type based on layers
    let scheduleType: 'manual' | 'daily' | 'weekly' = 'manual';
    if (scheduleData.layers && scheduleData.layers.length > 0) {
      const firstLayer = scheduleData.layers[0];
      if (firstLayer.rotationType === 'daily') {
        scheduleType = 'daily';
      } else if (firstLayer.rotationType === 'weekly') {
        scheduleType = 'weekly';
      }
    }

    // Create schedule
    const schedule = queryRunner.manager.create(Schedule, {
      orgId,
      teamId,
      name: scheduleData.name,
      description: scheduleData.description || null,
      timezone: scheduleData.timezone || 'UTC',
      type: scheduleType,
    });

    const savedSchedule = await queryRunner.manager.save(schedule);
    this.scheduleMap.set(normalizedName, savedSchedule.id);

    // Create layers
    if (scheduleData.layers && scheduleData.layers.length > 0) {
      let layerOrder = 0;
      for (const layerData of scheduleData.layers) {
        const layer = queryRunner.manager.create(ScheduleLayer, {
          scheduleId: savedSchedule.id,
          name: layerData.name,
          rotationType: layerData.rotationType as RotationType,
          startDate: layerData.startDate ? new Date(layerData.startDate) : new Date(),
          endDate: layerData.endDate ? new Date(layerData.endDate) : null,
          handoffTime: layerData.handoffTime || '09:00',
          handoffDay: layerData.handoffDay ?? (layerData.rotationType === 'weekly' ? 1 : null),
          rotationLength: layerData.rotationLength || 1,
          layerOrder,
          restrictions: layerData.restrictions || null,
        });

        const savedLayer = await queryRunner.manager.save(layer);

        // Add layer members
        for (const memberData of layerData.members) {
          let userId: string | null = null;

          if (memberData.email) {
            const userResult = await this.findOrCreateUser(
              memberData.email,
              memberData.name || null,
              orgId,
              queryRunner
            );
            userId = userResult.id;
          } else if (memberData.name) {
            userId = await this.matchUserByName(memberData.name, orgId, queryRunner);
          }

          if (userId) {
            const layerMember = queryRunner.manager.create(ScheduleLayerMember, {
              layerId: savedLayer.id,
              userId,
              position: memberData.position,
            });
            await queryRunner.manager.save(layerMember);
          }
        }

        layerOrder++;
      }
    }

    // Set current on-call if specified
    if (scheduleData.currentOncallEmail) {
      const userId = this.userMap.get(scheduleData.currentOncallEmail.toLowerCase());
      if (userId) {
        await queryRunner.manager.update(Schedule, savedSchedule.id, {
          currentOncallUserId: userId,
        });
      }
    }

    logger.info('Created schedule via import', {
      scheduleId: savedSchedule.id,
      name: scheduleData.name,
      layerCount: scheduleData.layers?.length || 0,
    });

    return { id: savedSchedule.id, created: true };
  }

  /**
   * Create an escalation policy with steps and targets
   */
  private async createEscalationPolicy(
    policyData: ExtractedEscalationPolicy,
    orgId: string,
    queryRunner: QueryRunner
  ): Promise<{ id?: string; created: boolean; reason?: string }> {
    const normalizedName = policyData.name.toLowerCase();

    // Check if policy exists
    const existingId = this.escalationPolicyMap.get(normalizedName);
    if (existingId) {
      return { id: existingId, created: false, reason: 'Escalation policy already exists' };
    }

    const existing = await queryRunner.manager.findOne(EscalationPolicy, {
      where: { orgId, name: policyData.name },
    });

    if (existing) {
      this.escalationPolicyMap.set(normalizedName, existing.id);
      return { id: existing.id, created: false, reason: 'Escalation policy already exists' };
    }

    // Resolve team reference
    let teamId: string | null = null;
    if (policyData.teamName) {
      teamId = this.teamMap.get(policyData.teamName.toLowerCase()) || null;
    }

    // Create policy
    const policy = queryRunner.manager.create(EscalationPolicy, {
      orgId,
      teamId,
      name: policyData.name,
      description: policyData.description || null,
      repeatEnabled: policyData.repeatEnabled ?? false,
      repeatCount: policyData.repeatCount ?? 0,
    });

    const savedPolicy = await queryRunner.manager.save(policy);
    this.escalationPolicyMap.set(normalizedName, savedPolicy.id);

    // Create steps
    for (const stepData of policyData.steps) {
      // Determine target type and collect targets
      const userIds: string[] = [];
      let scheduleId: string | null = null;
      let targetType: EscalationTargetType = 'users';

      for (const target of stepData.targets) {
        if (target.type === 'schedule' && target.scheduleName) {
          scheduleId = this.scheduleMap.get(target.scheduleName.toLowerCase()) || null;
          if (scheduleId) {
            targetType = 'schedule';
          }
        } else if (target.type === 'user') {
          let userId: string | null = null;
          if (target.email) {
            userId = this.userMap.get(target.email.toLowerCase()) || null;
          } else if (target.userName) {
            userId = await this.matchUserByName(target.userName, orgId, queryRunner);
          }
          if (userId) {
            userIds.push(userId);
          }
        }
      }

      // Create step
      const step = queryRunner.manager.create(EscalationStep, {
        escalationPolicyId: savedPolicy.id,
        stepOrder: stepData.stepOrder,
        targetType,
        scheduleId: targetType === 'schedule' ? scheduleId : null,
        userIds: targetType === 'users' && userIds.length > 0 ? userIds : null,
        timeoutSeconds: (stepData.timeoutMinutes || 5) * 60,
        notifyStrategy: (stepData.notifyStrategy || 'all') as NotifyStrategy,
      });

      const savedStep = await queryRunner.manager.save(step);

      // Create escalation targets (Phase 2 multi-target support)
      for (const target of stepData.targets) {
        if (target.type === 'schedule' && target.scheduleName) {
          const targetScheduleId = this.scheduleMap.get(target.scheduleName.toLowerCase());
          if (targetScheduleId) {
            const escalationTarget = queryRunner.manager.create(EscalationTarget, {
              escalationStepId: savedStep.id,
              targetType: 'schedule',
              scheduleId: targetScheduleId,
            });
            await queryRunner.manager.save(escalationTarget);
          }
        } else if (target.type === 'user') {
          let userId: string | null = null;
          if (target.email) {
            userId = this.userMap.get(target.email.toLowerCase()) || null;
          } else if (target.userName) {
            userId = await this.matchUserByName(target.userName, orgId, queryRunner);
          }
          if (userId) {
            const escalationTarget = queryRunner.manager.create(EscalationTarget, {
              escalationStepId: savedStep.id,
              targetType: 'user',
              userId,
            });
            await queryRunner.manager.save(escalationTarget);
          }
        }
      }
    }

    logger.info('Created escalation policy via import', {
      policyId: savedPolicy.id,
      name: policyData.name,
      stepCount: policyData.steps.length,
    });

    return { id: savedPolicy.id, created: true };
  }

  /**
   * Create a service with references to escalation policy and team
   */
  private async createService(
    serviceData: ExtractedService,
    orgId: string,
    queryRunner: QueryRunner
  ): Promise<{ id?: string; created: boolean; reason?: string }> {
    // Check if service exists
    const existing = await queryRunner.manager.findOne(Service, {
      where: { orgId, name: serviceData.name },
    });

    if (existing) {
      return { id: existing.id, created: false, reason: 'Service already exists' };
    }

    // Resolve references
    let teamId: string | null = null;
    let escalationPolicyId: string | null = null;
    let scheduleId: string | null = null;

    if (serviceData.teamName) {
      teamId = this.teamMap.get(serviceData.teamName.toLowerCase()) || null;
    }

    if (serviceData.escalationPolicyName) {
      escalationPolicyId =
        this.escalationPolicyMap.get(serviceData.escalationPolicyName.toLowerCase()) || null;
    }

    if (serviceData.scheduleName) {
      scheduleId = this.scheduleMap.get(serviceData.scheduleName.toLowerCase()) || null;
    }

    // Create service
    const service = queryRunner.manager.create(Service, {
      orgId,
      teamId,
      name: serviceData.name,
      description: serviceData.description || null,
      escalationPolicyId,
      scheduleId,
      urgency: serviceData.urgency || 'high',
      status: serviceData.status || 'active',
      externalKeys: serviceData.externalKeys || null,
    });

    const savedService = await queryRunner.manager.save(service);

    logger.info('Created service via import', {
      serviceId: savedService.id,
      name: serviceData.name,
    });

    return { id: savedService.id, created: true };
  }
}

// Export singleton instance
export const importExecutorService = new ImportExecutorService();

// Type aliases for backwards compatibility
export type PreviewResult = ImportPreview;
