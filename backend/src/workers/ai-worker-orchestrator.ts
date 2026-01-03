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

interface QueueMessage {
  taskId: string;
  action: 'execute' | 'retry' | 'cancel' | 'check_status';
}

class AIWorkerOrchestrator {
  private sqs: SQS;
  private dataSource: DataSource;
  private queueUrl: string;
  private running = false;
  private jiraService: JiraAIWorkerService | null = null;

  constructor(dataSource: DataSource, queueUrl: string) {
    this.dataSource = dataSource;
    this.queueUrl = queueUrl;
    this.sqs = new SQS({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  async initialize(): Promise<void> {
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

    // Get task
    const task = await taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      logger.error('Task not found', { taskId });
      return;
    }

    if (task.status !== 'queued') {
      logger.info('Task not in queued state, skipping', { taskId, status: task.status });
      return;
    }

    try {
      // Update status to claimed
      await this.updateTaskStatus(task, 'claimed');
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
        // Success - check for PR
        const logs = await ecsRunner.getTaskLogs(task.ecsTaskId!, { limit: 100 });
        const prInfo = this.parseTaskOutput(logs.events.map(e => e.message).join('\n'));

        if (prInfo.prUrl) {
          task.githubPrUrl = prInfo.prUrl;
          task.githubPrNumber = prInfo.prNumber ?? null;
          task.githubBranch = prInfo.branch ?? null;
          await this.updateTaskStatus(task, 'pr_created');
          await this.logTaskEvent(task, 'pr_created', `PR created: ${prInfo.prUrl}`);

          // Create approval request
          await this.createApprovalRequest(task);
        } else if (prInfo.result === 'no_changes') {
          await this.updateTaskStatus(task, 'completed');
          await this.logTaskEvent(task, 'status_change', 'Task completed with no changes needed');
        } else {
          await this.updateTaskStatus(task, 'completed');
          await this.logTaskEvent(task, 'status_change', 'Task completed');
        }
      } else {
        // Failure
        task.errorMessage = status.reason || `Exit code: ${status.exitCode}`;
        await this.updateTaskStatus(task, 'failed');
        await this.logTaskEvent(task, 'error', `Task failed: ${task.errorMessage}`, { severity: 'error' as const });
      }

      // Update cost
      task.estimatedCostUsd = task.calculateCost();
      await taskRepo.save(task);

      // Release worker
      if (task.assignedWorkerId) {
        const worker = await workerRepo.findOne({ where: { id: task.assignedWorkerId } });
        if (worker) {
          worker.status = 'idle';
          worker.currentTaskId = null;
          worker.lastTaskAt = new Date();

          if (task.status === 'completed' || task.status === 'pr_created') {
            worker.tasksCompleted++;
          } else if (task.status === 'failed') {
            worker.tasksFailed++;
          }

          worker.totalTokensUsed += task.claudeInputTokens + task.claudeOutputTokens;
          worker.totalCostUsd = Number(worker.totalCostUsd) + task.estimatedCostUsd;

          await workerRepo.save(worker);
        }
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
  } {
    const result: any = {};

    const resultMatch = output.match(/::result::(\w+)/);
    if (resultMatch) result.result = resultMatch[1];

    const prUrlMatch = output.match(/::pr_url::(.+)/);
    if (prUrlMatch) result.prUrl = prUrlMatch[1].trim();

    const prNumberMatch = output.match(/::pr_number::(\d+)/);
    if (prNumberMatch) result.prNumber = parseInt(prNumberMatch[1], 10);

    const branchMatch = output.match(/::branch::(.+)/);
    if (branchMatch) result.branch = branchMatch[1].trim();

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

  private async handleTaskError(task: AIWorkerTask, error: any): Promise<void> {
    const workerRepo = this.dataSource.getRepository(AIWorkerInstance);

    logger.error('Task execution error', { taskId: task.id, error: error.message });

    task.errorMessage = error.message;
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
