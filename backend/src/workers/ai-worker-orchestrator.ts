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

import { SQS, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { ECS } from '@aws-sdk/client-ecs';
import { DataSource } from 'typeorm';
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

interface QueueMessage {
  taskId: string;
  action: 'execute' | 'retry' | 'cancel' | 'check_status';
}

// Manager Lambda actions
type ManagerAction = 'review_pr' | 'analyze_learnings' | 'update_environment';

interface ManagerInvokePayload {
  action: ManagerAction;
  taskId: string;
  changes?: Record<string, any>; // For update_environment action
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

  constructor(dataSource: DataSource, queueUrl: string) {
    this.dataSource = dataSource;
    this.queueUrl = queueUrl;
    const region = process.env.AWS_REGION || 'us-east-1';
    this.sqs = new SQS({ region });
    this.ecs = new ECS({ region });
    this.lambda = new LambdaClient({ region });
    this.ecsCluster = process.env.ECS_CLUSTER_NAME || 'pagerduty-lite-dev';
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
    logger.info('AI Worker Orchestrator starting...');

    await this.initialize();

    // Start polling loop
    while (this.running) {
      try {
        await this.pollQueue();
      } catch (error) {
        logger.error('Error in polling loop', { error });
        await this.sleep(5000);
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    logger.info('AI Worker Orchestrator stopping...');
  }

  private async pollQueue(): Promise<void> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20, // Long polling
      VisibilityTimeout: 3600, // 1 hour
    });

    const response = await this.sqs.send(command);

    if (!response.Messages || response.Messages.length === 0) {
      return;
    }

    for (const message of response.Messages) {
      try {
        const body = JSON.parse(message.Body || '{}') as QueueMessage;
        await this.processMessage(body);

        // Delete message on success
        await this.sqs.send(new DeleteMessageCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: message.ReceiptHandle!,
        }));
      } catch (error) {
        logger.error('Error processing message', { error, messageId: message.MessageId });
        // Message will be returned to queue after visibility timeout
      }
    }
  }

  private async processMessage(message: QueueMessage): Promise<void> {
    logger.info('Processing message', { action: message.action, taskId: message.taskId });

    switch (message.action) {
      case 'execute':
        await this.executeTask(message.taskId);
        break;
      case 'retry':
        await this.retryTask(message.taskId);
        break;
      case 'cancel':
        await this.cancelTask(message.taskId);
        break;
      case 'check_status':
        await this.checkTaskStatus(message.taskId);
        break;
      default:
        logger.warn('Unknown action', { action: message.action });
    }
  }

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
        const logs = await ecsRunner.getTaskLogs(task.ecsTaskId!, { limit: 200 });
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
            // Skip manager review - go directly to review_approved
            await this.updateTaskStatus(task, 'review_approved');
            const skipReason = !hasReviewLabel ? 'no review label' : 'task configuration';
            await this.logTaskEvent(task, 'pr_created', `PR created (manager review skipped: ${skipReason}): ${prInfo.prUrl}`);
            logger.info('Manager review skipped', {
              taskId: task.id,
              prUrl: prInfo.prUrl,
              reason: skipReason,
              hasReviewLabel,
              skipManagerReview: task.skipManagerReview,
            });
            // Update Jira (adds comment and transitions to Done)
            if (this.jiraService) {
              await this.jiraService.updateJiraFromTask(task);
            }
            // Trigger post-completion actions (e.g., manager label for environment updates)
            await this.triggerPostCompletionActions(task);
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
        const logs = await ecsRunner.getTaskLogs(task.ecsTaskId!, { limit: 200 });
        const prInfo = this.parseTaskOutput(logs.events.map(e => e.message).join('\n'));

        if (prInfo.inputTokens !== undefined) {
          task.claudeInputTokens = prInfo.inputTokens;
        }
        if (prInfo.outputTokens !== undefined) {
          task.claudeOutputTokens = prInfo.outputTokens;
        }

        task.errorMessage = status.reason || `Exit code: ${status.exitCode}`;
        await this.updateTaskStatus(task, 'failed');
        await this.logTaskEvent(task, 'error', `Task failed: ${task.errorMessage}`, { severity: 'error' as const });
      }

      // Update cost and org cumulative cost via CostTracker
      await taskRepo.save(task); // Save token data first
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
  } {
    const result: any = {};

    const resultMatch = output.match(/::result::(\w+)/);
    if (resultMatch) result.result = resultMatch[1];

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

  private async retryTask(taskId: string): Promise<void> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);

    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      logger.error('Task not found for retry', { taskId });
      return;
    }

    if (!task.canRetry()) {
      logger.info('Task cannot be retried', { taskId, retryCount: task.retryCount, maxRetries: task.maxRetries });
      return;
    }

    task.retryCount++;
    task.status = 'queued';
    task.errorMessage = null;
    task.ecsTaskArn = null;
    task.ecsTaskId = null;
    await taskRepo.save(task);

    await this.logTaskEvent(task, 'retry', `Retry attempt ${task.retryCount}/${task.maxRetries}`);

    // Re-execute
    await this.executeTask(taskId);
  }

  private async cancelTask(taskId: string): Promise<void> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);
    const workerRepo = this.dataSource.getRepository(AIWorkerInstance);

    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      logger.error('Task not found for cancel', { taskId });
      return;
    }

    // Stop ECS task if running
    if (task.ecsTaskArn && task.status === 'executing') {
      const ecsRunner = getECSTaskRunner();
      await ecsRunner.stopTask(task.ecsTaskArn, 'Cancelled by user');
    }

    // Release worker
    if (task.assignedWorkerId) {
      const worker = await workerRepo.findOne({ where: { id: task.assignedWorkerId } });
      if (worker) {
        worker.status = 'idle';
        worker.currentTaskId = null;
        worker.tasksCancelled++;
        await workerRepo.save(worker);
      }
    }

    await this.updateTaskStatus(task, 'cancelled');
    await this.logTaskEvent(task, 'status_change', 'Task cancelled');

    // Update Jira
    if (this.jiraService) {
      await this.jiraService.updateJiraFromTask(task);
    }
  }

  private async checkTaskStatus(taskId: string): Promise<void> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);

    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task || !task.ecsTaskArn) {
      return;
    }

    const ecsRunner = getECSTaskRunner();
    const status = await ecsRunner.getTaskStatus(task.ecsTaskArn);

    logger.info('Task status check', {
      taskId,
      ecsStatus: status.status,
      exitCode: status.exitCode,
    });
  }

  private async updateTaskStatus(task: AIWorkerTask, status: AIWorkerTaskStatus): Promise<void> {
    const taskRepo = this.dataSource.getRepository(AIWorkerTask);
    task.status = status;

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      task.completedAt = new Date();
    }

    await taskRepo.save(task);
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

      // For PR review, update task status so it shows in Active Workflows
      if (action === 'review_pr') {
        await taskRepo.update(taskId, {
          status: 'manager_review' as AIWorkerTaskStatus,
        });
        await this.logTaskEvent(
          { id: taskId } as AIWorkerTask,
          'manager',
          'Virtual Manager starting PR review (Opus 4.5)...'
        );
      } else if (action === 'analyze_learnings') {
        await this.logTaskEvent(
          { id: taskId } as AIWorkerTask,
          'manager',
          'Virtual Manager starting learning analysis (Haiku)...'
        );
      }

      const payload: ManagerInvokePayload = { action, taskId };
      if (changes) {
        payload.changes = changes;
      }

      logger.info('Invoking Manager Lambda', {
        action,
        taskId,
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
          const logs = await ecsRunner.getTaskLogs(task.ecsTaskId, { limit: 200 });
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
