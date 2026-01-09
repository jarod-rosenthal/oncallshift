import { DataSource } from 'typeorm';
import { Organization } from '../models/Organization';
import { AIWorkerTask } from '../models/AIWorkerTask';
import { AIWorkerTaskRun } from '../models/AIWorkerTaskRun';
import { logger } from '../utils/logger';

interface CostUpdateResult {
  taskCost: number;
  newCumulativeCost: number;
  warningFlags: string[];
}

/**
 * Centralized service for tracking AI Worker costs.
 * This is the SINGLE POINT for updating organization cumulative costs,
 * ensuring consistency across all code paths (orchestrator, API, cancellation, etc.)
 */
export class CostTracker {
  constructor(private dataSource: DataSource) {}

  /**
   * Record cost for a task and update organization cumulative cost.
   * Uses idempotency check (usageReportedAt) to prevent double-counting.
   *
   * This is the ONLY function that should update org.aiWorkerCumulativeCost.
   */
  async recordTaskCost(taskId: string): Promise<CostUpdateResult> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);
    const orgRepo = this.dataSource.getRepository(Organization);

    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const warningFlags: string[] = [];

    // Calculate cost using shared pricing (via task.calculateCost())
    const taskCost = task.calculateCost();

    // Warning: suspicious cost data (5+ min runtime but 0 tokens)
    if (task.ecsTaskSeconds > 300 && task.claudeInputTokens === 0 && task.claudeOutputTokens === 0) {
      warningFlags.push('ZERO_TOKENS_AFTER_5MIN');
      logger.warn('Suspicious cost data: 0 tokens after 5+ min runtime', {
        taskId,
        ecsTaskSeconds: task.ecsTaskSeconds,
        claudeInputTokens: task.claudeInputTokens,
        claudeOutputTokens: task.claudeOutputTokens,
        estimatedCostUsd: taskCost,
        status: task.status,
      });
    }

    // Idempotency: skip org update if already reported
    if (task.usageReportedAt) {
      logger.info('Cost already reported for task, skipping org update', {
        taskId,
        usageReportedAt: task.usageReportedAt,
        existingCost: task.estimatedCostUsd,
      });
      const org = await orgRepo.findOne({ where: { id: task.orgId } });
      return {
        taskCost: Number(task.estimatedCostUsd) || taskCost,
        newCumulativeCost: Number(org?.aiWorkerCumulativeCost || 0),
        warningFlags,
      };
    }

    // Update task with cost and mark as reported
    task.estimatedCostUsd = taskCost;
    task.usageReportedAt = new Date();
    await taskRepo.save(task);

    // Update org cumulative cost
    const org = await orgRepo.findOne({ where: { id: task.orgId } });
    if (org) {
      const previousCost = Number(org.aiWorkerCumulativeCost || 0);
      org.aiWorkerCumulativeCost = previousCost + taskCost;
      await orgRepo.save(org);

      logger.info('Org cumulative cost updated', {
        taskId,
        taskCost: taskCost.toFixed(4),
        previousCost: previousCost.toFixed(4),
        newCumulativeCost: org.aiWorkerCumulativeCost.toFixed(4),
        taskStatus: task.status,
      });
    } else {
      logger.warn('Organization not found for task cost update', {
        taskId,
        orgId: task.orgId,
      });
    }

    return {
      taskCost,
      newCumulativeCost: Number(org?.aiWorkerCumulativeCost || 0),
      warningFlags,
    };
  }

  /**
   * Record cost for a task run (per-run tracking).
   * This is for granular tracking of individual runs within a task.
   */
  async recordRunCost(runId: string): Promise<number> {
    const runRepo = this.dataSource.getRepository(AIWorkerTaskRun);
    const run = await runRepo.findOne({ where: { id: runId } });
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const cost = run.calculateCost();
    run.estimatedCostUsd = cost;
    await runRepo.save(run);

    logger.info('Run cost recorded', {
      runId,
      taskId: run.taskId,
      cost: cost.toFixed(4),
    });

    return cost;
  }

  /**
   * Force recalculate and update cost for a task.
   * Useful for fixing tasks with stale or incorrect cost data.
   * Does NOT check idempotency - always updates.
   */
  async recalculateTaskCost(taskId: string): Promise<number> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);
    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const newCost = task.calculateCost();
    const oldCost = Number(task.estimatedCostUsd) || 0;

    task.estimatedCostUsd = newCost;
    await taskRepo.save(task);

    logger.info('Task cost recalculated', {
      taskId,
      oldCost: oldCost.toFixed(4),
      newCost: newCost.toFixed(4),
    });

    return newCost;
  }
}

// Singleton instance
let costTrackerInstance: CostTracker | null = null;

/**
 * Get the CostTracker singleton instance.
 * If not initialized, pass a DataSource to create it.
 */
export function getCostTracker(dataSource?: DataSource): CostTracker {
  if (!costTrackerInstance && dataSource) {
    costTrackerInstance = new CostTracker(dataSource);
  }
  if (!costTrackerInstance) {
    throw new Error('CostTracker not initialized - provide dataSource on first call');
  }
  return costTrackerInstance;
}

/**
 * Initialize the CostTracker singleton.
 */
export function initCostTracker(dataSource: DataSource): CostTracker {
  costTrackerInstance = new CostTracker(dataSource);
  return costTrackerInstance;
}
