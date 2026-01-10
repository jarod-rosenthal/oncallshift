import { Repository } from 'typeorm';
import { AIWorkerTask } from '../models/AIWorkerTask';
import { logger } from '../utils/logger';

/**
 * Circuit breaker for deployment operations.
 * Prevents runaway deploy loops by limiting retry attempts.
 */
export class DeployCircuitBreaker {
  constructor(private taskRepo: Repository<AIWorkerTask>) {}

  /**
   * Check if a task can attempt deployment
   * @param taskId Task ID to check
   * @returns True if deployment can be attempted
   */
  async canAttemptDeploy(taskId: string): Promise<boolean> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Check if retry count is within limits
    const canRetry = task.deployRetryCount < task.maxDeployRetries;

    if (!canRetry) {
      logger.warn('DeployCircuitBreaker: Max deploy retries reached', {
        taskId,
        jiraIssueKey: task.jiraIssueKey,
        deployRetryCount: task.deployRetryCount,
        maxDeployRetries: task.maxDeployRetries,
      });
    }

    return canRetry;
  }

  /**
   * Record a deployment attempt
   * Increments retry count and updates last deployment timestamp
   * @param taskId Task ID
   */
  async recordAttempt(taskId: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Increment retry count and update timestamp
    task.deployRetryCount++;
    task.lastDeploymentAt = new Date();

    await this.taskRepo.save(task);

    logger.info('DeployCircuitBreaker: Recorded deployment attempt', {
      taskId,
      jiraIssueKey: task.jiraIssueKey,
      deployRetryCount: task.deployRetryCount,
      maxDeployRetries: task.maxDeployRetries,
    });
  }

  /**
   * Reset deployment retry counters
   * Use this after successful deployment or manual intervention
   * @param taskId Task ID
   */
  async reset(taskId: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Reset counters
    task.deployRetryCount = 0;
    task.lastDeploymentAt = null;

    await this.taskRepo.save(task);

    logger.info('DeployCircuitBreaker: Reset deployment counters', {
      taskId,
      jiraIssueKey: task.jiraIssueKey,
    });
  }

  /**
   * Check if task has hit rate limit for deployments
   * Optional rate limiting based on time between attempts
   * @param taskId Task ID
   * @param minIntervalMinutes Minimum minutes between attempts (default: 5)
   * @returns True if task is within rate limit
   */
  async isWithinRateLimit(taskId: string, minIntervalMinutes: number = 5): Promise<boolean> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // If no previous deployment, allow
    if (!task.lastDeploymentAt) {
      return true;
    }

    // Calculate time since last deployment
    const timeSinceLastMs = Date.now() - task.lastDeploymentAt.getTime();
    const timeSinceLastMinutes = timeSinceLastMs / (60 * 1000);

    const withinLimit = timeSinceLastMinutes >= minIntervalMinutes;

    if (!withinLimit) {
      logger.warn('DeployCircuitBreaker: Rate limit exceeded', {
        taskId,
        jiraIssueKey: task.jiraIssueKey,
        timeSinceLastMinutes: Math.round(timeSinceLastMinutes * 10) / 10,
        minIntervalMinutes,
      });
    }

    return withinLimit;
  }

  /**
   * Get deployment status for a task
   * @param taskId Task ID
   * @returns Status object with retry information
   */
  async getStatus(taskId: string): Promise<{
    canAttempt: boolean;
    deployRetryCount: number;
    maxDeployRetries: number;
    remainingRetries: number;
    lastDeploymentAt: Date | null;
    isCircuitOpen: boolean;
  }> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const remainingRetries = Math.max(0, task.maxDeployRetries - task.deployRetryCount);
    const isCircuitOpen = task.deployRetryCount >= task.maxDeployRetries;

    return {
      canAttempt: !isCircuitOpen,
      deployRetryCount: task.deployRetryCount,
      maxDeployRetries: task.maxDeployRetries,
      remainingRetries,
      lastDeploymentAt: task.lastDeploymentAt,
      isCircuitOpen,
    };
  }

  /**
   * Force open the circuit (disable deployments)
   * @param taskId Task ID
   * @param reason Reason for forcing circuit open
   */
  async forceOpen(taskId: string, reason: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Set retry count to max to prevent further attempts
    task.deployRetryCount = task.maxDeployRetries;

    await this.taskRepo.save(task);

    logger.warn('DeployCircuitBreaker: Circuit forced open', {
      taskId,
      jiraIssueKey: task.jiraIssueKey,
      reason,
    });
  }
}
