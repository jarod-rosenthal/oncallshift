/**
 * AI Worker Orchestrator
 *
 * Consumes tasks from SQS queue and:
 * 1. Assigns tasks to available worker instances
 * 2. Spawns ephemeral Fargate tasks
 * 3. Monitors execution progress
 * 4. Updates Jira and creates PRs
 * 5. Handles approvals and retries
 */

import 'dotenv/config';
import { initSentry } from '../shared/config/sentry';

// Initialize Sentry for this worker
initSentry({ workerName: 'ai-worker-orchestrator' });

import { SQS } from '@aws-sdk/client-sqs'; // Push-based mode - no longer polling
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { ECS } from '@aws-sdk/client-ecs';
import { DataSource, In, Not } from 'typeorm';
import { AIWorkerTask, AIWorkerTaskStatus } from '../shared/models/AIWorkerTask';
import { AIWorkerInstance } from '../shared/models/AIWorkerInstance';
import { AIWorkerTaskLog } from '../shared/models/AIWorkerTaskLog';
import { AIWorkerApproval } from '../shared/models/AIWorkerApproval';
import { getECSTaskRunner, getDefaultECSConfig } from '../shared/services/ecs-task-runner';
import { initJiraAIWorkerService, JiraAIWorkerService } from '../shared/services/jira-ai-worker';
import { initGitHubService } from '../shared/services/github-service';
import { getDataSource } from '../shared/db/data-source';
import { logger } from '../shared/utils/logger';
import { getCostTracker, initCostTracker } from '../shared/services/cost-tracker';
import { DeployCircuitBreaker } from '../shared/services/deploy-circuit-breaker';

// TODO: Validation result types will be needed when implementing validation workflow
// interface ValidationResult {
//   success: boolean;
//   checks: {
//     typescript: { passed: boolean; errors?: string[] };
//     healthCheck: { passed: boolean; status?: number; error?: string };
//   };
//   timestamp: Date;
// }

// Unused in push-based mode - tasks triggered via HTTP endpoint
// @ts-ignore
interface _QueueMessage_UNUSED {
  taskId: string;
  action: 'execute' | 'retry' | 'cancel' | 'check_status' | 'deploy' | 'validate';
}

// Manager Lambda actions
type ManagerAction = 'review_pr' | 'analyze_learnings' | 'update_environment';

interface ManagerInvokePayload {
  action: ManagerAction;
  taskId: string;
  model?: string; // Claude model to use (from manager settings)
  changes?: Record<string, any>; // For update_environment action
}

// Deployment result from run_deploy.ts
interface DeploymentResult {
  success: boolean;
  requiresApproval?: boolean;
  approvalReason?: string;
  safetyCheckResult?: any;
  frontendDeployed: boolean;
  backendDeployed: boolean;
  cloudFrontInvalidated: boolean;
  duration: number;
  error?: string;
  logs?: string;
}

// Manager Lambda name for event-driven invocation
const MANAGER_LAMBDA_NAME = process.env.AI_WORKER_MANAGER_LAMBDA || 'pagerduty-lite-dev-ai-worker-manager';

class AIWorkerOrchestrator {
  private sqs: SQS;
  private ecs: ECS;
  private lambda: LambdaClient;
  private dataSource: DataSource;
  private queueUrl: string;
  private running = false;
  private jiraService: JiraAIWorkerService | null = null;
  private ecsCluster: string;
  private circuitBreaker: DeployCircuitBreaker;

  constructor(dataSource: DataSource, queueUrl: string) {
    this.dataSource = dataSource;
    this.queueUrl = queueUrl;
    const region = process.env.AWS_REGION || 'us-east-1';
    this.sqs = new SQS({ region });
    this.ecs = new ECS({ region });
    this.lambda = new LambdaClient({ region });
    this.ecsCluster = process.env.ECS_CLUSTER_NAME || 'pagerduty-lite-dev';
    this.circuitBreaker = new DeployCircuitBreaker(this.dataSource.getRepository(AIWorkerTask));
  }

  async initialize(): Promise<void> {
    // Initialize CostTracker service
    initCostTracker(this.dataSource);
    logger.info('CostTracker service initialized');

    // Initialize Jira service
    if (process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
      this.jiraService = initJiraAIWorkerService(this.dataSource, {
        baseUrl: process.env.JIRA_BASE_URL,
        email: process.env.JIRA_EMAIL,
        apiToken: process.env.JIRA_API_TOKEN,
        projectKey: process.env.JIRA_PROJECT_KEY || 'OCS',
        defaultGithubRepo: process.env.DEFAULT_GITHUB_REPO || 'jarod-rosenthal/pagerduty-lite',
      });
      logger.info('Jira service initialized');
    }

    // Initialize GitHub service
    if (process.env.GITHUB_TOKEN) {
      initGitHubService({
        token: process.env.GITHUB_TOKEN,
        owner: process.env.GITHUB_OWNER,
      });
      logger.info('GitHub service initialized');
    }

    // Initialize ECS task runner
    getECSTaskRunner(getDefaultECSConfig());
    logger.info('ECS task runner initialized');
  }

  async start(): Promise<void> {
    this.running = true;
    logger.info('AI Worker Orchestrator starting (PUSH-BASED MODE)...');

    await this.initialize();

    // PUSH-BASED MODE: Tasks are now triggered immediately via HTTP endpoint
    // /api/v1/ai-worker-tasks/:id/trigger instead of SQS polling
    // This orchestrator process stays alive for monitoring and background tasks
    logger.info('✓ Push-based mode enabled - tasks execute immediately when created/retried');
    logger.info('✓ HTTP trigger endpoint: POST /api/v1/ai-worker-tasks/:id/trigger');
    logger.info('✓ SQS polling disabled');

    // Keep process alive for monitoring tasks
    while (this.running) {
      await this.sleep(60000); // Sleep 1 minute at a time
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    logger.info('AI Worker Orchestrator stopping...');
  }

  // REMOVED in push-based mode - kept for reference


  private async executeTask(taskId: string): Promise<void> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);
    const workerRepo = this.dataSource.getRepository(AIWorkerInstance);

    // CRITICAL: Use atomic update to prevent duplicate execution
    // Only claim the task if it's still in 'queued' status
    const claimResult = await taskRepo
      .createQueryBuilder()
      .update(AIWorkerTask)
      .set({ status: 'claimed' as AIWorkerTaskStatus })
      .where('id = :id AND status = :status', { id: taskId, status: 'queued' })
      .execute();

    // If no rows updated, task was already claimed by another process
    if (claimResult.affected === 0) {
      logger.info('Task already claimed or not in queued state, skipping duplicate', { taskId });
      return;
    }

    // Now fetch the task (we know it exists since we just updated it)
    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      logger.error('Task not found after claim', { taskId });
      return;
    }

    logger.info('Task claimed successfully', { taskId, jiraIssueKey: task.jiraIssueKey });

    try {
      // CRITICAL: Per-persona concurrency limiting
      // Only allow 1 active task per persona to prevent deploy conflicts
      // Note: pr_created, manager_review, review_pending are "waiting" states, not "active"
      const activeTaskForPersona = await taskRepo.findOne({
        where: {
          orgId: task.orgId,
          workerPersona: task.workerPersona,
          status: In(['claimed', 'environment_setup', 'executing', 'revision_needed', 'deployment_pending', 'deploying', 'deployed_validating']),
          id: Not(task.id), // Exclude current task
        },
      });

      if (activeTaskForPersona) {
        // Persona slot is occupied - requeue with backoff
        logger.info('Persona slot occupied, requeueing task', {
          taskId: task.id,
          persona: task.workerPersona,
          blockingTaskId: activeTaskForPersona.id,
          blockingJiraKey: activeTaskForPersona.jiraIssueKey,
        });

        await this.requeueTaskWithBackoff(task, 'persona_slot_occupied', {
          blockingTaskId: activeTaskForPersona.id,
          blockingJiraKey: activeTaskForPersona.jiraIssueKey,
        });
        return;
      }

      await this.logTaskEvent(task, 'status_change', 'Task claimed by orchestrator');

      // Find available worker
      const worker = await workerRepo.findOne({
        where: {
          orgId: task.orgId,
          persona: task.workerPersona,
          status: 'idle',
        },
      });

      if (!worker) {
        // Create a worker on the fly if none exists
        const newWorker = workerRepo.create({
          orgId: task.orgId,
          persona: task.workerPersona,
          displayName: `${task.workerPersona.replace(/_/g, ' ')} (Auto-created)`,
          status: 'working',
          currentTaskId: task.id,
        });
        await workerRepo.save(newWorker);
        task.assignedWorkerId = newWorker.id;
      } else {
        // Assign existing worker
        worker.status = 'working';
        worker.currentTaskId = task.id;
        await workerRepo.save(worker);
        task.assignedWorkerId = worker.id;
      }

      await taskRepo.save(task);
      await this.logTaskEvent(task, 'status_change', `Assigned to worker ${task.assignedWorkerId}`);

      // Update status to environment_setup
      await this.updateTaskStatus(task, 'environment_setup');
      await this.logTaskEvent(task, 'status_change', 'Setting up execution environment');

      // Get credentials
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      const githubToken = process.env.GITHUB_TOKEN;

      if (!anthropicApiKey || !githubToken) {
        throw new Error('Missing required credentials (ANTHROPIC_API_KEY or GITHUB_TOKEN)');
      }

      // CRITICAL: Check if this task already has an executor running
      if (task.ecsTaskArn) {
        try {
          const describeResult = await this.ecs.describeTasks({
            cluster: this.ecsCluster,
            tasks: [task.ecsTaskArn],
          });
          const existingTask = describeResult.tasks?.[0];
          if (existingTask && ['RUNNING', 'PENDING', 'PROVISIONING'].includes(existingTask.lastStatus || '')) {
            logger.info('Task already has an active executor, skipping spawn', {
              taskId: task.id,
              ecsTaskArn: task.ecsTaskArn,
              ecsStatus: existingTask.lastStatus,
            });
            return;
          }
        } catch (error) {
          logger.warn('Could not check existing ECS task, proceeding with spawn', { error });
        }
      }

      // Spawn ECS task
      const ecsRunner = getECSTaskRunner();
      const assignedWorker = await workerRepo.findOne({ where: { id: task.assignedWorkerId! } });

      const { taskArn, taskId: ecsTaskId } = await ecsRunner.runWorkerTask(
        task,
        assignedWorker!,
        { anthropicApiKey, githubToken }
      );

      // Update task with ECS info
      task.ecsTaskArn = taskArn;
      task.ecsTaskId = ecsTaskId;
      task.startedAt = new Date();
      await this.updateTaskStatus(task, 'executing');
      await taskRepo.save(task);

      await this.logTaskEvent(task, 'status_change', `ECS task started: ${ecsTaskId}`);

      // Update Jira
      if (this.jiraService) {
        await this.jiraService.updateJiraFromTask(task);
      }

      // Monitor task completion in background
      this.monitorTaskCompletion(task).catch(error => {
        logger.error('Error monitoring task completion', { taskId: task.id, error });
      });

    } catch (error: any) {
      await this.handleTaskError(task, error);
    }
  }

  private async monitorTaskCompletion(task: AIWorkerTask): Promise<void> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);
    const workerRepo = this.dataSource.getRepository(AIWorkerInstance);

    if (!task.ecsTaskArn) {
      logger.error('No ECS task ARN to monitor', { taskId: task.id });
      return;
    }

    try {
      const ecsRunner = getECSTaskRunner();
      const status = await ecsRunner.waitForTaskCompletion(task.ecsTaskArn, {
        timeoutMs: 3600000, // 1 hour
        pollIntervalMs: 30000, // 30 seconds
      });

      // Calculate duration
      if (status.startedAt && status.stoppedAt) {
        task.ecsTaskSeconds = Math.floor(
          (status.stoppedAt.getTime() - status.startedAt.getTime()) / 1000
        );
      }

      // Check exit code
      if (status.exitCode === 0) {
        // Success - check for PR and token usage
        const logs = await ecsRunner.getTaskLogs(task.ecsTaskId!, { limit: 2000 });
        const prInfo = this.parseTaskOutput(logs.events.map(e => e.message).join('\n'));

        // Update token counts and model from parsed output
        if (prInfo.inputTokens !== undefined) {
          task.claudeInputTokens = prInfo.inputTokens;
        }
        if (prInfo.outputTokens !== undefined) {
          task.claudeOutputTokens = prInfo.outputTokens;
        }
        if (prInfo.model) {
          task.workerModel = prInfo.model;
        }

        logger.info('Parsed task output', {
          taskId: task.id,
          inputTokens: prInfo.inputTokens,
          outputTokens: prInfo.outputTokens,
          claudeCost: prInfo.claudeCost,
          model: prInfo.model,
          prUrl: prInfo.prUrl,
        });

        if (prInfo.prUrl) {
          task.githubPrUrl = prInfo.prUrl;
          task.githubPrNumber = prInfo.prNumber ?? null;
          task.githubBranch = prInfo.branch ?? null;

          // Check if manager review should be triggered based on Jira 'review' label
          const hasReviewLabel = task.hasJiraReviewLabel();

          if (task.skipManagerReview || !hasReviewLabel) {
            // Skip manager review - wait for human PR approval on GitHub
            await this.updateTaskStatus(task, 'pr_created');
            const skipReason = !hasReviewLabel ? 'no review label' : 'task configuration';
            await this.logTaskEvent(task, 'pr_created', `PR created, awaiting human review: ${prInfo.prUrl}`);
            logger.info('PR created, awaiting human review', {
              taskId: task.id,
              prUrl: prInfo.prUrl,
              reason: skipReason,
              hasReviewLabel,
              skipManagerReview: task.skipManagerReview,
            });
            // Don't update Jira to Done yet - wait for PR approval
          } else {
            // Normal flow - send to manager for review (Jira has 'review' label)
            await this.updateTaskStatus(task, 'pr_created');
            await this.logTaskEvent(task, 'pr_created', `PR created: ${prInfo.prUrl}`);

            // Create approval request
            await this.createApprovalRequest(task);

            // Invoke Manager Lambda immediately for event-driven PR review (Opus 4.5)
            await this.invokeManagerLambda('review_pr', task.id);
            // Trigger post-completion actions (e.g., manager label for environment updates)
            await this.triggerPostCompletionActions(task);
          }
        } else if (prInfo.result === 'success_no_pr') {
          // Worker pushed commits but explicitly requested no PR
          task.githubBranch = prInfo.branch ?? null;
          await this.updateTaskStatus(task, 'completed');
          await this.logTaskEvent(task, 'status_change', `Task completed - changes pushed to branch ${prInfo.branch} without PR (worker request)`);
          logger.info('Worker completed without PR', {
            taskId: task.id,
            branch: prInfo.branch,
            reason: 'Worker explicitly requested no PR',
          });
          // Trigger Manager analyses after completion
          await this.triggerPostCompletionActions(task);
        } else if (prInfo.result === 'no_changes') {
          await this.updateTaskStatus(task, 'completed');
          await this.logTaskEvent(task, 'status_change', 'Task completed with no changes needed');
          // Trigger Manager analyses after completion
          await this.triggerPostCompletionActions(task);
        } else {
          await this.updateTaskStatus(task, 'completed');
          await this.logTaskEvent(task, 'status_change', 'Task completed');
          // Trigger Manager analyses after completion
          await this.triggerPostCompletionActions(task);
        }
      } else {
        // Failure - still try to get token usage
        const logs = await ecsRunner.getTaskLogs(task.ecsTaskId!, { limit: 2000 });
        const logOutput = logs.events.map(e => e.message).join('\n');
        const prInfo = this.parseTaskOutput(logOutput);

        if (prInfo.inputTokens !== undefined) {
          task.claudeInputTokens = prInfo.inputTokens;
        }
        if (prInfo.outputTokens !== undefined) {
          task.claudeOutputTokens = prInfo.outputTokens;
        }

        // Check for rebase conflict - special handling to retry from scratch
        if (prInfo.result === 'rebase_conflict') {
          logger.warn('Rebase conflict detected, will retry task from scratch', {
            taskId: task.id,
            jiraIssueKey: task.jiraIssueKey,
            conflictFiles: prInfo.conflictFiles,
          });

          await this.logTaskEvent(task, 'rebase_conflict',
            `Rebase conflict with files: ${prInfo.conflictFiles?.join(', ') || 'unknown'}. Retrying from scratch.`,
            { severity: 'warning', metadata: { conflictFiles: prInfo.conflictFiles } }
          );

          // Reset task for retry from scratch (clean slate with fresh main)
          await this.retryTaskFromScratch(task, 'rebase_conflict');
          return;
        }

        task.errorMessage = status.reason || `Exit code: ${status.exitCode}`;
        await this.updateTaskStatus(task, 'failed');
        await this.logTaskEvent(task, 'error', `Task failed: ${task.errorMessage}`, { severity: 'error' as const });
      }

      // Update cost and org cumulative cost via CostTracker
      // IMPORTANT: Refetch task from DB to get token values reported by log-parser via API
      // The log-parser sends token usage to /usage endpoint which updates the task directly.
      // If we don't refetch, we'll overwrite those values with 0s from our in-memory object.
      const latestTask = await taskRepo.findOne({ where: { id: task.id } });
      logger.info('Refetched task for token preservation', {
        taskId: task.id,
        foundLatestTask: !!latestTask,
        latestInputTokens: latestTask?.claudeInputTokens,
        latestOutputTokens: latestTask?.claudeOutputTokens,
        latestUsageReportedAt: latestTask?.usageReportedAt,
        currentInputTokens: task.claudeInputTokens,
      });
      if (latestTask) {
        // Preserve token values from DB (set by log-parser via API)
        task.claudeInputTokens = latestTask.claudeInputTokens;
        task.claudeOutputTokens = latestTask.claudeOutputTokens;
        task.claudeCacheCreationTokens = latestTask.claudeCacheCreationTokens;
        task.claudeCacheReadTokens = latestTask.claudeCacheReadTokens;
        task.workerModel = latestTask.workerModel;
        task.estimatedCostUsd = latestTask.estimatedCostUsd;
        task.usageReportedAt = latestTask.usageReportedAt;
      }
      await taskRepo.save(task); // Save with preserved token data
      try {
        const costResult = await getCostTracker().recordTaskCost(task.id);
        logger.info('Task cost recorded via CostTracker', {
          taskId: task.id,
          inputTokens: task.claudeInputTokens,
          outputTokens: task.claudeOutputTokens,
          ecsTaskSeconds: task.ecsTaskSeconds,
          taskCost: costResult.taskCost,
          orgCumulativeCost: costResult.newCumulativeCost,
          warningFlags: costResult.warningFlags,
        });
        if (costResult.warningFlags.length > 0) {
          await this.logTaskEvent(task, 'warning', `Cost tracking warnings: ${costResult.warningFlags.join(', ')}`);
        }
      } catch (costError: any) {
        logger.warn('CostTracker failed, falling back to local calculation', {
          taskId: task.id,
          error: costError.message,
        });
        task.estimatedCostUsd = task.calculateCost();
        await taskRepo.save(task);
      }

      // Set worker back to idle (workers are now persistent)
      if (task.assignedWorkerId) {
        const worker = await workerRepo.findOne({ where: { id: task.assignedWorkerId } });
        if (worker) {
          worker.status = 'idle';
          worker.currentTaskId = null;
          worker.lastTaskAt = new Date();
          await workerRepo.save(worker);
          logger.info('Worker returned to idle after task completion', {
            taskId: task.id,
            workerId: worker.id,
            workerName: worker.displayName,
          });
        }

        // Clear the FK reference on the task
        task.assignedWorkerId = null;
        await taskRepo.save(task);
      }

      // Update Jira
      if (this.jiraService) {
        await this.jiraService.updateJiraFromTask(task);
      }

    } catch (error: any) {
      await this.handleTaskError(task, error);
    }
  }

  private parseTaskOutput(output: string): {
    result?: string;
    prUrl?: string;
    prNumber?: number;
    branch?: string;
    inputTokens?: number;
    outputTokens?: number;
    claudeCost?: number;
    model?: string;
    conflictFiles?: string[];
  } {
    const result: any = {};

    const resultMatch = output.match(/::result::(\w+)/);
    if (resultMatch) result.result = resultMatch[1];

    // Parse rebase conflict files
    const conflictFilesMatch = output.match(/::conflict_files::([^\n]+)/);
    if (conflictFilesMatch) {
      result.conflictFiles = conflictFilesMatch[1].split(',').map((f: string) => f.trim()).filter(Boolean);
    }

    // Use \S+ to capture only non-whitespace (stops at tabs that separate markers on same line)
    const prUrlMatch = output.match(/::pr_url::(\S+)/);
    if (prUrlMatch) result.prUrl = prUrlMatch[1].trim();

    const prNumberMatch = output.match(/::pr_number::(\d+)/);
    if (prNumberMatch) result.prNumber = parseInt(prNumberMatch[1], 10);

    const branchMatch = output.match(/::branch::(\S+)/);
    if (branchMatch) result.branch = branchMatch[1].trim();

    // Parse token usage
    const inputTokensMatch = output.match(/::input_tokens::(\d+)/);
    if (inputTokensMatch) result.inputTokens = parseInt(inputTokensMatch[1], 10);

    const outputTokensMatch = output.match(/::output_tokens::(\d+)/);
    if (outputTokensMatch) result.outputTokens = parseInt(outputTokensMatch[1], 10);

    const claudeCostMatch = output.match(/::claude_cost::([0-9.]+)/);
    if (claudeCostMatch) result.claudeCost = parseFloat(claudeCostMatch[1]);

    const modelMatch = output.match(/::model::(\w+)/);
    if (modelMatch) result.model = modelMatch[1];

    return result;
  }

  private async createApprovalRequest(task: AIWorkerTask): Promise<void> {
    const approvalRepo = this.dataSource.getRepository(AIWorkerApproval);

    // Use the static create helper
    const approvalData = AIWorkerApproval.create(
      task.id,
      'pr_review',
      `Review PR for ${task.jiraIssueKey}: ${task.summary}`,
      {
        prUrl: task.githubPrUrl ?? undefined,
        prNumber: task.githubPrNumber ?? undefined,
        riskLevel: 'medium',
      },
      7 * 24 * 60 // 7 days in minutes
    );

    const approval = approvalRepo.create(approvalData);
    await approvalRepo.save(approval);
    await this.logTaskEvent(task, 'approval_requested', 'PR review requested');
  }




  private async updateTaskStatus(task: AIWorkerTask, status: AIWorkerTaskStatus): Promise<void> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);

    // Use targeted update to avoid overwriting token values set by log-parser via API
    // The log-parser calls /usage endpoint which saves tokens directly to DB.
    // If we use taskRepo.save(task), we overwrite those values with 0s from our stale in-memory object.
    // NOTE: 'review_approved' is NOT terminal - deployment workflow continues after approval
    const isTerminal = ['completed', 'failed', 'cancelled'].includes(status);
    const completedAt = isTerminal ? new Date() : undefined;

    await taskRepo.update(
      { id: task.id },
      {
        status,
        ...(completedAt && { completedAt }),
      }
    );

    // Update in-memory object to match (for subsequent operations)
    task.status = status;
    if (completedAt) {
      task.completedAt = completedAt;
    }
  }

  private async logTaskEvent(
    task: AIWorkerTask,
    type: string,
    message: string,
    options?: { severity?: 'debug' | 'info' | 'warning' | 'error'; metadata?: Record<string, any> }
  ): Promise<void> {
    const logRepo = this.dataSource.getRepository(AIWorkerTaskLog);

    const log = logRepo.create({
      taskId: task.id,
      type: type as any,
      message,
      severity: options?.severity || 'info',
      metadata: options?.metadata,
    });

    await logRepo.save(log);
  }

  /**
   * Invoke the Manager Lambda for a specific action (event-driven)
   * Actions:
   * - review_pr: Review a PR with Opus 4.5 (only if Jira has 'review' label)
   * - analyze_learnings: Analyze task for learnings with Haiku (after completion with errors/retries)
   * - update_environment: Update container/environment with Sonnet (after learning identifies gaps)
   */
  private async invokeManagerLambda(
    action: ManagerAction,
    taskId: string,
    changes?: Record<string, any>
  ): Promise<void> {
    try {
      const taskRepo = this.dataSource.getRepository(AIWorkerTask);
      const instanceRepo = this.dataSource.getRepository(AIWorkerInstance);

      // Look up the manager's configured model
      const manager = await instanceRepo.findOne({ where: { role: 'manager' } });
      const managerModel = manager?.modelId || 'claude-sonnet-4-20250514';

      // Get friendly model name for logs
      const modelName = managerModel.includes('opus') ? 'Opus'
        : managerModel.includes('haiku') ? 'Haiku'
        : 'Sonnet';

      // For PR review, update task status so it shows in Active Workflows
      if (action === 'review_pr') {
        await taskRepo.update(taskId, {
          status: 'manager_review' as AIWorkerTaskStatus,
        });
        await this.logTaskEvent(
          { id: taskId } as AIWorkerTask,
          'manager',
          `Virtual Manager starting PR review (${modelName})...`
        );
      } else if (action === 'analyze_learnings') {
        await this.logTaskEvent(
          { id: taskId } as AIWorkerTask,
          'manager',
          `Virtual Manager starting learning analysis (${modelName})...`
        );
      }

      const payload: ManagerInvokePayload = { action, taskId, model: managerModel };
      if (changes) {
        payload.changes = changes;
      }

      logger.info('Invoking Manager Lambda', {
        action,
        taskId,
        model: managerModel,
        lambdaName: MANAGER_LAMBDA_NAME,
      });

      await this.lambda.send(
        new InvokeCommand({
          FunctionName: MANAGER_LAMBDA_NAME,
          InvocationType: 'Event', // Async invocation - don't wait for result
          Payload: Buffer.from(JSON.stringify(payload)),
        })
      );

      logger.info('Manager Lambda invoked successfully', { action, taskId });
    } catch (error) {
      // Log but don't fail - learning analysis is best-effort
      logger.warn('Failed to invoke Manager Lambda', {
        action,
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Trigger all post-completion Manager actions
   * Called after a task completes (success or failure)
   */
  private async triggerPostCompletionActions(task: AIWorkerTask): Promise<void> {
    // 1. Learning analysis - automatic for tasks with errors/retries (Haiku)
    if (task.needsLearningAnalysis()) {
      logger.info('Triggering learning analysis (errors/retries detected)', {
        taskId: task.id,
        toolErrorCount: task.toolErrorCount,
        toolRetryCount: task.toolRetryCount,
      });
      await this.invokeManagerLambda('analyze_learnings', task.id);
    }

    // 2. Environment update - triggered by 'manager' label (Sonnet)
    // Manager analyzes logs, identifies issues, creates Jira ticket, implements fixes, deploys, opens PR
    if (task.hasJiraManagerLabel()) {
      logger.info('Triggering Manager environment update (manager label detected)', {
        taskId: task.id,
        jiraIssueKey: task.jiraIssueKey,
      });
      await this.invokeManagerLambda('update_environment', task.id);
    }
  }

  private async handleTaskError(task: AIWorkerTask, error: any): Promise<void> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);
    const workerRepo = this.dataSource.getRepository(AIWorkerInstance);

    logger.error('Task execution error', { taskId: task.id, error: error.message });

    task.errorMessage = error.message;

    // ALWAYS try to calculate cost, even for failed tasks
    try {
      // Try to get ECS task info for cost calculation
      if (task.ecsTaskArn) {
        const ecsRunner = getECSTaskRunner();
        const status = await ecsRunner.getTaskStatus(task.ecsTaskArn);
        if (status.startedAt && status.stoppedAt) {
          task.ecsTaskSeconds = Math.floor(
            (status.stoppedAt.getTime() - status.startedAt.getTime()) / 1000
          );
        }

        // Try to parse tokens from logs
        if (task.ecsTaskId) {
          const logs = await ecsRunner.getTaskLogs(task.ecsTaskId, { limit: 2000 });
          const logOutput = logs.events.map(e => e.message).join('\n');
          const prInfo = this.parseTaskOutput(logOutput);
          if (prInfo.inputTokens !== undefined) {
            task.claudeInputTokens = prInfo.inputTokens;
          }
          if (prInfo.outputTokens !== undefined) {
            task.claudeOutputTokens = prInfo.outputTokens;
          }
        }
      }

      // Save task with token data first
      await taskRepo.save(task);

      // Record cost via CostTracker (updates org cumulative cost too)
      const costResult = await getCostTracker().recordTaskCost(task.id);
      logger.info('Failed task cost recorded via CostTracker', {
        taskId: task.id,
        inputTokens: task.claudeInputTokens,
        outputTokens: task.claudeOutputTokens,
        ecsTaskSeconds: task.ecsTaskSeconds,
        taskCost: costResult.taskCost,
        orgCumulativeCost: costResult.newCumulativeCost,
        warningFlags: costResult.warningFlags,
      });
    } catch (costError: any) {
      logger.warn('Could not record cost for failed task', {
        taskId: task.id,
        error: costError.message,
      });
      // Fallback: at least save the local cost calculation
      task.estimatedCostUsd = task.calculateCost();
      await taskRepo.save(task);
    }

    await this.updateTaskStatus(task, 'failed');
    await this.logTaskEvent(task, 'error', error.message, { severity: 'error' });

    // Release worker
    if (task.assignedWorkerId) {
      const worker = await workerRepo.findOne({ where: { id: task.assignedWorkerId } });
      if (worker) {
        worker.status = 'idle';
        worker.currentTaskId = null;
        worker.tasksFailed++;
        await workerRepo.save(worker);
      }
    }

    // Update Jira
    if (this.jiraService) {
      await this.jiraService.updateJiraFromTask(task);
    }

    // Trigger Manager analyses after task failure
    await this.triggerPostCompletionActions(task);
  }

  /**
   * Retry a task from scratch (clean slate)
   * Used when rebase conflicts occur - the task needs to re-clone from fresh main
   */
  private async retryTaskFromScratch(task: AIWorkerTask, reason: string): Promise<void> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);
    const workerRepo = this.dataSource.getRepository(AIWorkerInstance);

    logger.info('Retrying task from scratch', {
      taskId: task.id,
      jiraIssueKey: task.jiraIssueKey,
      reason,
      retryCount: task.retryCount,
    });

    // Release the worker
    if (task.assignedWorkerId) {
      const worker = await workerRepo.findOne({ where: { id: task.assignedWorkerId } });
      if (worker) {
        worker.status = 'idle';
        worker.currentTaskId = null;
        await workerRepo.save(worker);
      }
    }

    // Reset task for fresh retry
    task.status = 'queued';
    task.retryCount = (task.retryCount || 0) + 1;
    task.ecsTaskArn = null;
    task.ecsTaskId = null;
    task.assignedWorkerId = null;
    task.githubBranch = null; // Clear branch so a fresh one is created
    task.errorMessage = `Retrying from scratch due to: ${reason}`;
    await taskRepo.save(task);

    // Check retry limit
    if (task.retryCount > task.maxRetries) {
      await this.updateTaskStatus(task, 'failed');
      await this.logTaskEvent(task, 'error',
        `Task exceeded max retries (${task.maxRetries}) due to ${reason}`,
        { severity: 'error' }
      );
      return;
    }

    // Requeue immediately via SQS
    await this.sqs.send(
      new (await import('@aws-sdk/client-sqs')).SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ taskId: task.id, action: 'execute' }),
      })
    );

    logger.info('Task requeued for fresh retry', {
      taskId: task.id,
      retryCount: task.retryCount,
      reason,
    });
  }

  /**
   * Requeue a task with exponential backoff
   * Used when persona slot is occupied or other temporary conditions prevent execution
   */
  private async requeueTaskWithBackoff(
    task: AIWorkerTask,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);

    // Calculate backoff delay: 30s, 60s, 120s, 240s, max 5min
    const baseDelay = 30;
    const maxDelay = 300;
    const retryCount = task.personaWaitCount || 0;
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

    // Update task back to queued with incremented wait count
    task.status = 'queued';
    task.personaWaitCount = retryCount + 1;
    await taskRepo.save(task);

    await this.logTaskEvent(task, 'requeued', `Task requeued (${reason}), will retry in ${delay}s`, {
      metadata: {
        reason,
        personaWaitCount: task.personaWaitCount,
        delaySeconds: delay,
        ...metadata,
      },
    });

    // Schedule requeue after delay
    setTimeout(async () => {
      try {
        await this.sqs.send(
          new (await import('@aws-sdk/client-sqs')).SendMessageCommand({
            QueueUrl: this.queueUrl,
            MessageBody: JSON.stringify({ taskId: task.id, action: 'execute' }),
          })
        );
        logger.info('Task requeued after backoff', {
          taskId: task.id,
          delay,
          personaWaitCount: task.personaWaitCount,
        });
      } catch (error) {
        logger.error('Failed to requeue task after backoff', { taskId: task.id, error });
      }
    }, delay * 1000);
  }

  /**
   * Handle review approval - check if deployment should be triggered
   * Called after PR is approved (human or manager)
   */
  async handleReviewApproved(task: AIWorkerTask): Promise<void> {
    logger.info('Handling review approval', {
      taskId: task.id,
      jiraKey: task.jiraIssueKey,
      deploymentEnabled: task.deploymentEnabled,
    });

    // Check if deployment is enabled for this task
    if (!task.deploymentEnabled) {
      // No deployment - mark as completed
      await this.updateTaskStatus(task, 'completed');
      await this.logTaskEvent(task, 'status_change', 'PR approved, no deployment configured - task complete');

      // Update Jira to Done
      if (this.jiraService) {
        await this.jiraService.updateJiraFromTask(task);
      }

      logger.info('Task completed without deployment', { taskId: task.id });
      return;
    }

    // Deployment enabled - start deployment workflow
    logger.info('Deployment enabled, starting workflow', { taskId: task.id });
    await this.startDeploymentWorkflow(task.id);
  }

  /**
   * Start deployment workflow for a reviewed task
   * Checks circuit breaker, updates status, spawns deployment ECS task
   */
  async startDeploymentWorkflow(taskId: string): Promise<void> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);

    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      logger.error('Task not found for deployment', { taskId });
      return;
    }

    logger.info('Starting deployment workflow', {
      taskId: task.id,
      jiraKey: task.jiraIssueKey,
      deployRetryCount: task.deployRetryCount,
    });

    // Check circuit breaker - can we retry?
    const canDeploy = await this.circuitBreaker.canAttemptDeploy(taskId);
    if (!canDeploy) {
      logger.error('Circuit breaker open - cannot deploy', {
        taskId: task.id,
        deployRetryCount: task.deployRetryCount,
        lastDeploymentAt: task.lastDeploymentAt,
      });

      // TODO: Add deployment_failed status once schema updated
      await this.updateTaskStatus(task, 'failed');
      await this.logTaskEvent(
        task,
        'error',
        'Deployment blocked by circuit breaker (too many recent failures)',
        { severity: 'error' }
      );

      // Update Jira
      if (this.jiraService) {
        await this.jiraService.updateJiraFromTask(task);
      }

      return;
    }

    // TODO: Add deployment_pending status once schema updated
    await this.logTaskEvent(task, 'status_change', 'Starting deployment to production');

    // Spawn deployment ECS task
    try {
      const ecsRunner = getECSTaskRunner();

      // Record deployment attempt
      await this.circuitBreaker.recordAttempt(taskId);

      const { taskArn, taskId: ecsTaskId } = await ecsRunner.runDeploymentTask(task);

      // TODO: Store deployment ECS task info once schema updated
      // For now, log it
      await this.logTaskEvent(task, 'status_change', `Deployment task started: ${ecsTaskId}`, {
        metadata: { deploymentEcsTaskArn: taskArn, deploymentEcsTaskId: ecsTaskId }
      });

      logger.info('Deployment task spawned', {
        taskId: task.id,
        ecsTaskArn: taskArn,
        ecsTaskId,
      });

      // Monitor deployment completion in background
      // Pass the ECS task info since we can't store it yet
      this.monitorDeploymentCompletion(task, taskArn, ecsTaskId).catch(error => {
        logger.error('Error monitoring deployment completion', { taskId: task.id, error });
      });

    } catch (error: any) {
      logger.error('Failed to spawn deployment task', { taskId: task.id, error: error.message });

      await this.updateTaskStatus(task, 'failed');
      await this.logTaskEvent(
        task,
        'error',
        `Deployment spawn failed: ${error.message}`,
        { severity: 'error' }
      );

      // Update Jira
      if (this.jiraService) {
        await this.jiraService.updateJiraFromTask(task);
      }
    }
  }

  /**
   * Monitor deployment task completion
   */
  private async monitorDeploymentCompletion(task: AIWorkerTask, taskArn: string, ecsTaskId: string): Promise<void> {
    try {
      const ecsRunner = getECSTaskRunner();
      const status = await ecsRunner.waitForTaskCompletion(taskArn, {
        timeoutMs: 900000, // 15 minutes for deployment
        pollIntervalMs: 30000,
      });

      // Get deployment logs
      const logs = await ecsRunner.getTaskLogs(ecsTaskId, { limit: 2000 });
      const logOutput = logs.events.map(e => e.message).join('\n');

      // Parse deployment result from logs
      const deploymentResult = this.parseDeploymentResult(logOutput);

      if (status.exitCode === 0 && deploymentResult.success) {
        // Deployment succeeded
        await this.handleDeploymentComplete(task.id, deploymentResult);
      } else {
        // Deployment failed
        const errorMsg = deploymentResult.error || status.reason || 'Unknown deployment failure';

        await this.updateTaskStatus(task, 'failed');
        await this.logTaskEvent(
          task,
          'error',
          `Deployment failed: ${errorMsg}`,
          { severity: 'error', metadata: { logs: logOutput.slice(-1000) } }
        );

        // Update Jira
        if (this.jiraService) {
          await this.jiraService.updateJiraFromTask(task);
        }
      }

    } catch (error: any) {
      logger.error('Error monitoring deployment', { taskId: task.id, error: error.message });

      await this.updateTaskStatus(task, 'failed');
      await this.logTaskEvent(
        task,
        'error',
        `Deployment monitoring failed: ${error.message}`,
        { severity: 'error' }
      );

      // Update Jira
      if (this.jiraService) {
        await this.jiraService.updateJiraFromTask(task);
      }
    }
  }

  /**
   * Parse deployment result from log output
   */
  private parseDeploymentResult(logOutput: string): DeploymentResult {
    try {
      // Look for JSON output from run_deploy.ts
      const jsonMatch = logOutput.match(/\{[\s\S]*"success"[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn('Failed to parse deployment result JSON', { error });
    }

    // Fallback - check for success markers
    const success = logOutput.includes('Deployment completed successfully');
    const frontendDeployed = logOutput.includes('Frontend deployed');
    const backendDeployed = logOutput.includes('Backend deployed');
    const cloudFrontInvalidated = logOutput.includes('CloudFront invalidation');

    return {
      success,
      frontendDeployed,
      backendDeployed,
      cloudFrontInvalidated,
      duration: 0,
      logs: logOutput,
    };
  }

  /**
   * Handle deployment completion
   * Checks if approval needed for destructive changes, or starts validation
   */
  async handleDeploymentComplete(taskId: string, deploymentResult: DeploymentResult): Promise<void> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);

    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      logger.error('Task not found for deployment completion', { taskId });
      return;
    }

    logger.info('Handling deployment completion', {
      taskId: task.id,
      success: deploymentResult.success,
      requiresApproval: deploymentResult.requiresApproval,
    });

    // TODO: Store deployment metadata once schema updated
    await this.logTaskEvent(task, 'status_change', 'Deployment completed successfully', {
      metadata: { deploymentResult }
    });

    // Check if destructive approval required
    if (deploymentResult.requiresApproval) {
      // TODO: Add awaiting_destructive_approval status once schema updated
      await this.logTaskEvent(
        task,
        'approval_requested',
        `Deployment requires approval: ${deploymentResult.approvalReason}`,
        { severity: 'warning', metadata: { safetyCheckResult: deploymentResult.safetyCheckResult } }
      );

      // TODO: Create approval request for destructive_deploy type once schema updated
      logger.info('Deployment requires manual approval', { taskId: task.id });
      return;
    }

    // No approval needed - record success and mark complete (skip validation for now)
    await this.circuitBreaker.reset(taskId);

    await this.updateTaskStatus(task, 'completed');
    await this.logTaskEvent(
      task,
      'status_change',
      `Deployment completed (${deploymentResult.duration}s) - task complete`,
      { metadata: { deploymentResult } }
    );

    // TODO: Start validation workflow once validation task runner is set up
    logger.info('Deployment successful, task marked complete', { taskId: task.id });

    // Update Jira
    if (this.jiraService) {
      await this.jiraService.updateJiraFromTask(task);
    }
  }

  // ==================== Validation Workflow (TODO: Implement later) ====================
  // Validation workflow methods will be implemented once:
  // 1. Schema is updated with validation tracking fields
  // 2. Validation ECS task definition is created
  // 3. Retry logic is fully tested

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main entry point
async function main(): Promise<void> {
  logger.info('Initializing AI Worker Orchestrator...');

  const queueUrl = process.env.AI_WORKER_QUEUE_URL;
  if (!queueUrl) {
    throw new Error('AI_WORKER_QUEUE_URL environment variable is required');
  }

  const dataSource = await getDataSource();
  const orchestrator = new AIWorkerOrchestrator(dataSource, queueUrl);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await orchestrator.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    await orchestrator.stop();
    process.exit(0);
  });

  await orchestrator.start();
}

main().catch(error => {
  logger.error('Fatal error in AI Worker Orchestrator', { error });
  process.exit(1);
});
