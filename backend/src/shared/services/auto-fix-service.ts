import { DataSource, QueryRunner } from 'typeorm';
import { getDataSource } from '../db/data-source';
import { logger } from '../utils/logger';

// Models
import { Schedule } from '../models/Schedule';
import { AlertGroupingRule } from '../models/AlertGroupingRule';
import { EscalationPolicy } from '../models/EscalationPolicy';
import { Service } from '../models/Service';
import { Runbook } from '../models/Runbook';

// Import runbook generator for generating runbooks from incident history
import { RunbookGeneratorService } from './runbook-generator-service';

/**
 * Types for auto-fix operations
 */
export type AutoFixType =
  | 'oncall_balance'
  | 'alert_noise'
  | 'runbook_coverage'
  | 'escalation_timeout';

export interface AutoFixPayload {
  type: AutoFixType;
  scheduleId?: string;
  serviceId?: string;
  escalationPolicyId?: string;
  // On-call balance payload
  targetDistribution?: 'equal' | 'weighted';
  weights?: Record<string, number>; // userId -> weight
  // Alert noise payload
  adjustThresholds?: boolean;
  suppressionRules?: Array<{
    pattern: string;
    action: 'suppress' | 'merge';
    timeWindowMinutes?: number;
  }>;
  newTimeWindowMinutes?: number;
  newGroupingType?: 'intelligent' | 'time' | 'content' | 'disabled';
  // Escalation timeout payload
  newTimeoutSeconds?: number;
  stepTimeouts?: Record<number, number>; // stepOrder -> timeoutSeconds
}

export interface AutoFixRecommendation {
  id: string;
  type: AutoFixType;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  payload: AutoFixPayload;
  createdAt: Date;
}

export interface AutoFixResult {
  success: boolean;
  message: string;
  changesApplied: Array<{
    entity: string;
    entityId: string;
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  error?: string;
}

/**
 * Service that handles one-click auto-fixes for AI recommendations
 */
export class AutoFixService {
  private dataSource: DataSource | null = null;
  private runbookGenerator: RunbookGeneratorService;

  constructor() {
    this.runbookGenerator = new RunbookGeneratorService();
  }

  private async init(): Promise<void> {
    if (this.dataSource) return;
    this.dataSource = await getDataSource();
  }

  /**
   * Main entry point - execute an auto-fix based on recommendation
   */
  async executeAutoFix(
    orgId: string,
    userId: string,
    recommendation: AutoFixRecommendation
  ): Promise<AutoFixResult> {
    await this.init();

    logger.info('Executing auto-fix', {
      orgId,
      userId,
      recommendationType: recommendation.type,
      recommendationId: recommendation.id,
    });

    const queryRunner = this.dataSource!.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let result: AutoFixResult;

      switch (recommendation.type) {
        case 'oncall_balance':
          result = await this.autoFixOncallBalance(orgId, recommendation.payload, queryRunner);
          break;

        case 'alert_noise':
          result = await this.autoFixAlertNoise(orgId, recommendation.payload, queryRunner);
          break;

        case 'runbook_coverage':
          result = await this.autoFixRunbookCoverage(orgId, userId, recommendation.payload, queryRunner);
          break;

        case 'escalation_timeout':
          result = await this.autoFixEscalationTimeouts(orgId, recommendation.payload, queryRunner);
          break;

        default:
          throw new Error(`Unknown auto-fix type: ${recommendation.type}`);
      }

      if (result.success) {
        await queryRunner.commitTransaction();
        logger.info('Auto-fix completed successfully', {
          orgId,
          recommendationType: recommendation.type,
          changesCount: result.changesApplied.length,
        });
      } else {
        await queryRunner.rollbackTransaction();
        logger.warn('Auto-fix failed, rolled back', {
          orgId,
          recommendationType: recommendation.type,
          error: result.error,
        });
      }

      return result;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      logger.error('Auto-fix failed with exception', {
        orgId,
        recommendationType: recommendation.type,
        error: error.message,
      });
      return {
        success: false,
        message: 'Auto-fix failed due to an error',
        changesApplied: [],
        error: error.message,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Rebalance schedule to distribute on-call load evenly
   */
  async autoFixOncallBalance(
    orgId: string,
    payload: AutoFixPayload,
    queryRunner: QueryRunner
  ): Promise<AutoFixResult> {
    const { scheduleId, targetDistribution = 'equal', weights } = payload;

    if (!scheduleId) {
      return {
        success: false,
        message: 'Schedule ID is required for on-call balance fix',
        changesApplied: [],
        error: 'Missing scheduleId',
      };
    }

    // Load schedule with layers and members
    const schedule = await queryRunner.manager.findOne(Schedule, {
      where: { id: scheduleId, orgId },
      relations: ['layers', 'layers.members'],
    });

    if (!schedule) {
      return {
        success: false,
        message: 'Schedule not found',
        changesApplied: [],
        error: 'Schedule not found',
      };
    }

    const changesApplied: AutoFixResult['changesApplied'] = [];

    // Process each layer to rebalance members
    for (const layer of schedule.layers || []) {
      if (!layer.members || layer.members.length < 2) {
        continue; // Need at least 2 members to rebalance
      }

      const members = [...layer.members].sort((a, b) => a.position - b.position);

      if (targetDistribution === 'equal') {
        // Equal distribution: just ensure positions are sequential starting from 0
        for (let i = 0; i < members.length; i++) {
          if (members[i].position !== i) {
            const oldPosition = members[i].position;
            members[i].position = i;
            await queryRunner.manager.save(members[i]);
            changesApplied.push({
              entity: 'ScheduleLayerMember',
              entityId: members[i].id,
              field: 'position',
              oldValue: oldPosition,
              newValue: i,
            });
          }
        }
      } else if (targetDistribution === 'weighted' && weights) {
        // Weighted distribution: reorder members based on weights
        // Higher weight = earlier position (more on-call time)
        const membersWithWeights = members.map(m => ({
          member: m,
          weight: weights[m.userId] || 1,
        }));

        // Sort by weight descending (higher weight = lower position number = more on-call)
        membersWithWeights.sort((a, b) => b.weight - a.weight);

        for (let i = 0; i < membersWithWeights.length; i++) {
          const { member } = membersWithWeights[i];
          if (member.position !== i) {
            const oldPosition = member.position;
            member.position = i;
            await queryRunner.manager.save(member);
            changesApplied.push({
              entity: 'ScheduleLayerMember',
              entityId: member.id,
              field: 'position',
              oldValue: oldPosition,
              newValue: i,
            });
          }
        }
      }
    }

    return {
      success: true,
      message: `Rebalanced on-call schedule "${schedule.name}" with ${targetDistribution} distribution`,
      changesApplied,
    };
  }

  /**
   * Adjust alert thresholds or add suppression rules to reduce noise
   */
  async autoFixAlertNoise(
    orgId: string,
    payload: AutoFixPayload,
    queryRunner: QueryRunner
  ): Promise<AutoFixResult> {
    const { serviceId, newTimeWindowMinutes, newGroupingType, suppressionRules } = payload;

    if (!serviceId) {
      return {
        success: false,
        message: 'Service ID is required for alert noise fix',
        changesApplied: [],
        error: 'Missing serviceId',
      };
    }

    // Verify service belongs to org
    const service = await queryRunner.manager.findOne(Service, {
      where: { id: serviceId, orgId },
    });

    if (!service) {
      return {
        success: false,
        message: 'Service not found',
        changesApplied: [],
        error: 'Service not found',
      };
    }

    // Load or create alert grouping rule
    let groupingRule = await queryRunner.manager.findOne(AlertGroupingRule, {
      where: { serviceId },
    });

    const changesApplied: AutoFixResult['changesApplied'] = [];
    const wasCreated = !groupingRule;

    if (!groupingRule) {
      groupingRule = queryRunner.manager.create(AlertGroupingRule, {
        serviceId,
        groupingType: 'intelligent',
        timeWindowMinutes: 5,
        contentFields: [],
        maxAlertsPerIncident: 1000,
      });
    }

    // Apply time window change
    if (newTimeWindowMinutes !== undefined && groupingRule.timeWindowMinutes !== newTimeWindowMinutes) {
      const oldValue = groupingRule.timeWindowMinutes;
      groupingRule.timeWindowMinutes = newTimeWindowMinutes;
      changesApplied.push({
        entity: 'AlertGroupingRule',
        entityId: groupingRule.id || 'new',
        field: 'timeWindowMinutes',
        oldValue,
        newValue: newTimeWindowMinutes,
      });
    }

    // Apply grouping type change
    if (newGroupingType && groupingRule.groupingType !== newGroupingType) {
      const oldValue = groupingRule.groupingType;
      groupingRule.groupingType = newGroupingType;
      changesApplied.push({
        entity: 'AlertGroupingRule',
        entityId: groupingRule.id || 'new',
        field: 'groupingType',
        oldValue,
        newValue: newGroupingType,
      });
    }

    // Apply suppression rules as content fields for content-based grouping
    if (suppressionRules && suppressionRules.length > 0) {
      const oldContentFields = [...groupingRule.contentFields];
      const patterns = suppressionRules
        .filter(r => r.action === 'merge')
        .map(r => r.pattern);

      // Add new patterns that aren't already in content fields
      const newFields = [...new Set([...groupingRule.contentFields, ...patterns])];
      if (JSON.stringify(oldContentFields) !== JSON.stringify(newFields)) {
        groupingRule.contentFields = newFields;
        changesApplied.push({
          entity: 'AlertGroupingRule',
          entityId: groupingRule.id || 'new',
          field: 'contentFields',
          oldValue: oldContentFields,
          newValue: newFields,
        });
      }
    }

    if (changesApplied.length > 0 || wasCreated) {
      await queryRunner.manager.save(groupingRule);
      if (wasCreated) {
        changesApplied.push({
          entity: 'AlertGroupingRule',
          entityId: groupingRule.id,
          field: 'created',
          oldValue: null,
          newValue: 'Created new alert grouping rule',
        });
      }
    }

    return {
      success: true,
      message: `Updated alert noise configuration for service "${service.name}"`,
      changesApplied,
    };
  }

  /**
   * Generate runbooks from incident history for services lacking coverage
   */
  async autoFixRunbookCoverage(
    orgId: string,
    userId: string,
    payload: AutoFixPayload,
    queryRunner: QueryRunner
  ): Promise<AutoFixResult> {
    const { serviceId } = payload;

    if (!serviceId) {
      return {
        success: false,
        message: 'Service ID is required for runbook coverage fix',
        changesApplied: [],
        error: 'Missing serviceId',
      };
    }

    // Verify service belongs to org
    const service = await queryRunner.manager.findOne(Service, {
      where: { id: serviceId, orgId },
    });

    if (!service) {
      return {
        success: false,
        message: 'Service not found',
        changesApplied: [],
        error: 'Service not found',
      };
    }

    // Check if runbook already exists for this service
    const existingRunbook = await queryRunner.manager.findOne(Runbook, {
      where: { serviceId, orgId, isActive: true },
    });

    if (existingRunbook) {
      return {
        success: true,
        message: `Service "${service.name}" already has an active runbook`,
        changesApplied: [],
      };
    }

    // Use runbook generator to create a runbook from incident history
    // Note: This operates outside the transaction as it calls external AI service
    const generatedRunbook = await this.runbookGenerator.generateRunbook(serviceId, orgId, userId);

    if (!generatedRunbook) {
      return {
        success: false,
        message: 'Failed to generate runbook from incident history',
        changesApplied: [],
        error: 'Runbook generation returned null',
      };
    }

    // Save the generated runbook
    const runbook = queryRunner.manager.create(Runbook, {
      orgId,
      serviceId,
      title: generatedRunbook.title,
      description: generatedRunbook.description,
      steps: generatedRunbook.steps,
      severity: [],
      tags: ['auto-generated'],
      createdById: userId,
      isActive: true,
    });

    await queryRunner.manager.save(runbook);

    return {
      success: true,
      message: `Generated runbook "${runbook.title}" for service "${service.name}"`,
      changesApplied: [{
        entity: 'Runbook',
        entityId: runbook.id,
        field: 'created',
        oldValue: null,
        newValue: runbook.title,
      }],
    };
  }

  /**
   * Adjust escalation policy timeouts
   */
  async autoFixEscalationTimeouts(
    orgId: string,
    payload: AutoFixPayload,
    queryRunner: QueryRunner
  ): Promise<AutoFixResult> {
    const { escalationPolicyId, newTimeoutSeconds, stepTimeouts } = payload;

    if (!escalationPolicyId) {
      return {
        success: false,
        message: 'Escalation policy ID is required for timeout fix',
        changesApplied: [],
        error: 'Missing escalationPolicyId',
      };
    }

    // Load escalation policy with steps
    const policy = await queryRunner.manager.findOne(EscalationPolicy, {
      where: { id: escalationPolicyId, orgId },
      relations: ['steps'],
    });

    if (!policy) {
      return {
        success: false,
        message: 'Escalation policy not found',
        changesApplied: [],
        error: 'Escalation policy not found',
      };
    }

    const changesApplied: AutoFixResult['changesApplied'] = [];

    for (const step of policy.steps || []) {
      let newTimeout: number | undefined;

      // Check if there's a specific timeout for this step
      if (stepTimeouts && stepTimeouts[step.stepOrder] !== undefined) {
        newTimeout = stepTimeouts[step.stepOrder];
      } else if (newTimeoutSeconds !== undefined) {
        // Use the global new timeout
        newTimeout = newTimeoutSeconds;
      }

      if (newTimeout !== undefined && step.timeoutSeconds !== newTimeout) {
        const oldValue = step.timeoutSeconds;
        step.timeoutSeconds = newTimeout;
        await queryRunner.manager.save(step);
        changesApplied.push({
          entity: 'EscalationStep',
          entityId: step.id,
          field: 'timeoutSeconds',
          oldValue,
          newValue: newTimeout,
        });
      }
    }

    return {
      success: true,
      message: `Updated escalation timeouts for policy "${policy.name}"`,
      changesApplied,
    };
  }

  /**
   * Validate that an auto-fix payload is valid for the given type
   */
  validatePayload(payload: AutoFixPayload): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (payload.type) {
      case 'oncall_balance':
        if (!payload.scheduleId) {
          errors.push('scheduleId is required for oncall_balance fix');
        }
        if (payload.targetDistribution && !['equal', 'weighted'].includes(payload.targetDistribution)) {
          errors.push('targetDistribution must be "equal" or "weighted"');
        }
        if (payload.targetDistribution === 'weighted' && !payload.weights) {
          errors.push('weights are required when targetDistribution is "weighted"');
        }
        break;

      case 'alert_noise':
        if (!payload.serviceId) {
          errors.push('serviceId is required for alert_noise fix');
        }
        if (payload.newGroupingType && !['intelligent', 'time', 'content', 'disabled'].includes(payload.newGroupingType)) {
          errors.push('newGroupingType must be one of: intelligent, time, content, disabled');
        }
        if (payload.newTimeWindowMinutes !== undefined && payload.newTimeWindowMinutes < 1) {
          errors.push('newTimeWindowMinutes must be at least 1');
        }
        break;

      case 'runbook_coverage':
        if (!payload.serviceId) {
          errors.push('serviceId is required for runbook_coverage fix');
        }
        break;

      case 'escalation_timeout':
        if (!payload.escalationPolicyId) {
          errors.push('escalationPolicyId is required for escalation_timeout fix');
        }
        if (payload.newTimeoutSeconds !== undefined && payload.newTimeoutSeconds < 60) {
          errors.push('newTimeoutSeconds must be at least 60');
        }
        break;

      default:
        errors.push(`Unknown auto-fix type: ${payload.type}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const autoFixService = new AutoFixService();
