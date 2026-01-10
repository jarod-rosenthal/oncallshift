import { ECS, RunTaskCommand, DescribeTasksCommand, StopTaskCommand } from '@aws-sdk/client-ecs';
import { CloudWatchLogs, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { AIWorkerTask } from '../models/AIWorkerTask';
import { AIWorkerInstance } from '../models/AIWorkerInstance';
import { logger } from '../utils/logger';

interface ECSTaskRunnerConfig {
  cluster: string;
  taskDefinition: string;
  subnets: string[];
  securityGroups: string[];
  containerName: string;
  logGroup: string;
  region?: string;
}

interface TaskEnvironment {
  TASK_ID: string;
  ORG_ID: string;
  JIRA_ISSUE_KEY: string;
  JIRA_SUMMARY: string;
  JIRA_DESCRIPTION: string;
  JIRA_LABELS?: string;
  TASK_NOTES: string;
  GITHUB_REPO: string;
  WORKER_PERSONA: string;
  ANTHROPIC_API_KEY: string;
  GITHUB_TOKEN: string;
  MAX_TURNS?: string;
  CLAUDE_MODEL?: string;
  // Self-recovery env vars
  RETRY_NUMBER?: string;
  PREVIOUS_RUN_CONTEXT?: string;
  GLOBAL_TIMEOUT_AT?: string;
  API_BASE_URL?: string;
  ORG_API_KEY?: string;
  INTERNAL_SERVICE_KEY?: string;
}

interface RunTaskResult {
  taskArn: string;
  taskId: string;
}

interface TaskStatus {
  taskArn: string;
  taskId: string;
  status: 'PROVISIONING' | 'PENDING' | 'RUNNING' | 'DEPROVISIONING' | 'STOPPED' | 'UNKNOWN';
  exitCode?: number;
  reason?: string;
  startedAt?: Date;
  stoppedAt?: Date;
}

export class ECSTaskRunner {
  private ecs: ECS;
  private logs: CloudWatchLogs;
  private config: ECSTaskRunnerConfig;

  constructor(config: ECSTaskRunnerConfig) {
    this.config = config;
    const region = config.region || process.env.AWS_REGION || 'us-east-1';

    this.ecs = new ECS({ region });
    this.logs = new CloudWatchLogs({ region });
  }

  // ==================== Task Lifecycle ====================

  async runWorkerTask(
    task: AIWorkerTask,
    worker: AIWorkerInstance,
    credentials: { anthropicApiKey: string; githubToken: string; orgApiKey?: string }
  ): Promise<RunTaskResult> {
    // Map full model ID to Claude CLI short name
    const modelToCliName = (model: string): string => {
      if (model.includes('opus')) return 'opus';
      if (model.includes('haiku')) return 'haiku';
      return 'sonnet'; // default
    };

    // Build environment variables for the container
    // Model is determined by Jira labels (defaults to sonnet if no label)
    const environment: TaskEnvironment = {
      TASK_ID: task.id,
      ORG_ID: task.orgId,
      JIRA_ISSUE_KEY: task.jiraIssueKey,
      JIRA_SUMMARY: task.summary,
      JIRA_DESCRIPTION: task.description || '',
      JIRA_LABELS: (task.jiraFields?.labels || []).join(','),
      TASK_NOTES: task.watcherNotes || '',
      GITHUB_REPO: task.githubRepo,
      WORKER_PERSONA: task.workerPersona,
      ANTHROPIC_API_KEY: credentials.anthropicApiKey,
      GITHUB_TOKEN: credentials.githubToken,
      MAX_TURNS: String(worker.config.maxTurns || 50),
      CLAUDE_MODEL: modelToCliName(task.workerModel || 'claude-sonnet-4-20250514'),
      // Self-recovery env vars
      RETRY_NUMBER: String(task.retryCount),
      PREVIOUS_RUN_CONTEXT: task.previousRunContext || '',
      GLOBAL_TIMEOUT_AT: task.globalTimeoutAt?.toISOString() || '',
      API_BASE_URL: process.env.API_BASE_URL || 'https://oncallshift.com',
      ORG_API_KEY: credentials.orgApiKey || '',
      INTERNAL_SERVICE_KEY: process.env.INTERNAL_SERVICE_KEY || '',
    };

    // Filter out empty values to let task definition secrets take effect
    // Empty strings in overrides would override secrets with empty values
    const filteredEnv = Object.entries(environment)
      .filter(([, value]) => value !== '' && value !== undefined)
      .map(([name, value]) => ({ name, value }));

    const command = new RunTaskCommand({
      cluster: this.config.cluster,
      taskDefinition: this.config.taskDefinition,
      // Use capacity provider strategy with Fargate Spot preferred, regular Fargate as fallback
      capacityProviderStrategy: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 2,  // Prefer Spot (higher weight)
          base: 0,
        },
        {
          capacityProvider: 'FARGATE',
          weight: 1,  // Fallback to regular Fargate if Spot unavailable
          base: 0,
        },
      ],
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: this.config.subnets,
          securityGroups: this.config.securityGroups,
          assignPublicIp: 'ENABLED',
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: this.config.containerName,
            environment: filteredEnv,
          },
        ],
      },
      tags: [
        { key: 'TaskId', value: task.id },
        { key: 'JiraIssueKey', value: task.jiraIssueKey },
        { key: 'WorkerPersona', value: task.workerPersona },
      ],
    });

    const response = await this.ecs.send(command);

    if (!response.tasks || response.tasks.length === 0) {
      const failures = response.failures?.map(f => `${f.arn}: ${f.reason}`).join(', ');
      throw new Error(`Failed to start ECS task: ${failures || 'Unknown error'}`);
    }

    const ecsTask = response.tasks[0];
    const taskArn = ecsTask.taskArn!;
    const taskId = taskArn.split('/').pop()!;

    logger.info('Started ECS task for AI worker', {
      taskId,
      taskArn,
      aiWorkerTaskId: task.id,
      jiraIssueKey: task.jiraIssueKey,
    });

    return { taskArn, taskId };
  }

  async getTaskStatus(taskArn: string): Promise<TaskStatus> {
    const command = new DescribeTasksCommand({
      cluster: this.config.cluster,
      tasks: [taskArn],
    });

    const response = await this.ecs.send(command);

    if (!response.tasks || response.tasks.length === 0) {
      return {
        taskArn,
        taskId: taskArn.split('/').pop()!,
        status: 'UNKNOWN',
        reason: 'Task not found',
      };
    }

    const task = response.tasks[0];
    const container = task.containers?.[0];

    return {
      taskArn,
      taskId: taskArn.split('/').pop()!,
      status: (task.lastStatus || 'UNKNOWN') as TaskStatus['status'],
      exitCode: container?.exitCode,
      reason: task.stoppedReason || container?.reason,
      startedAt: task.startedAt,
      stoppedAt: task.stoppedAt,
    };
  }

  async waitForTaskCompletion(
    taskArn: string,
    options?: { timeoutMs?: number; pollIntervalMs?: number }
  ): Promise<TaskStatus> {
    const timeoutMs = options?.timeoutMs || 3600000; // 1 hour default
    const pollIntervalMs = options?.pollIntervalMs || 10000; // 10 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getTaskStatus(taskArn);

      if (status.status === 'STOPPED') {
        return status;
      }

      if (status.status === 'UNKNOWN') {
        throw new Error(`Task ${taskArn} not found`);
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Task ${taskArn} timed out after ${timeoutMs}ms`);
  }

  async stopTask(taskArn: string, reason?: string): Promise<void> {
    const command = new StopTaskCommand({
      cluster: this.config.cluster,
      task: taskArn,
      reason: reason || 'Stopped by AI Worker Orchestrator',
    });

    await this.ecs.send(command);
    logger.info('Stopped ECS task', { taskArn, reason });
  }

  // ==================== Logging ====================

  async getTaskLogs(
    taskId: string,
    options?: { startTime?: number; limit?: number; nextToken?: string }
  ): Promise<{ events: Array<{ timestamp: number; message: string }>; nextToken?: string }> {
    // CloudWatch log stream format: prefix/container-name/task-id
    // prefix is "ecs" from awslogs-stream-prefix in the task definition
    const logStreamName = `ecs/${this.config.containerName}/${taskId}`;

    try {
      const command = new GetLogEventsCommand({
        logGroupName: this.config.logGroup,
        logStreamName,
        startTime: options?.startTime,
        limit: options?.limit || 100,
        nextToken: options?.nextToken,
        startFromHead: !options?.nextToken,
      });

      const response = await this.logs.send(command);

      return {
        events: (response.events || []).map(event => ({
          timestamp: event.timestamp || 0,
          message: event.message || '',
        })),
        nextToken: response.nextForwardToken,
      };
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        // Log stream doesn't exist yet
        return { events: [] };
      }
      throw error;
    }
  }

  async streamTaskLogs(
    taskId: string,
    callback: (event: { timestamp: number; message: string }) => void,
    options?: { pollIntervalMs?: number }
  ): Promise<() => void> {
    const pollIntervalMs = options?.pollIntervalMs || 2000;
    let nextToken: string | undefined;
    let stopped = false;

    const poll = async () => {
      while (!stopped) {
        try {
          const { events, nextToken: newToken } = await this.getTaskLogs(taskId, {
            nextToken,
            limit: 50,
          });

          for (const event of events) {
            callback(event);
          }

          if (newToken) {
            nextToken = newToken;
          }
        } catch (error) {
          logger.error('Error polling task logs', { taskId, error });
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }
    };

    // Start polling in background
    poll();

    // Return stop function
    return () => {
      stopped = true;
    };
  }

  // ==================== Deployment & Validation Tasks ====================

  /**
   * Run deployment task
   * Spawns an ECS task that runs the deployment script
   */
  async runDeploymentTask(task: AIWorkerTask): Promise<RunTaskResult> {
    const environment = {
      TASK_ID: task.id,
      REPO_PATH: '/workspace',
      GITHUB_REPO: task.githubRepo,
      GITHUB_BRANCH: task.githubBranch || 'main',
      API_BASE_URL: process.env.API_BASE_URL || 'https://oncallshift.com',
      AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    };

    const command = new RunTaskCommand({
      cluster: this.config.cluster,
      taskDefinition: process.env.DEPLOYMENT_TASK_DEFINITION || 'pagerduty-lite-dev-ai-worker-deployment',
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: this.config.subnets,
          securityGroups: this.config.securityGroups,
          assignPublicIp: 'ENABLED',
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'deployment',
            environment: Object.entries(environment).map(([name, value]) => ({ name, value: String(value) })),
          },
        ],
      },
    });

    const response = await this.ecs.send(command);

    if (!response.tasks || response.tasks.length === 0 || !response.tasks[0].taskArn) {
      throw new Error('Failed to run deployment task');
    }

    const task_arn = response.tasks[0].taskArn;
    const taskId = task_arn.split('/').pop()!;

    logger.info('Deployment task started', { taskArn: task_arn, taskId });

    return { taskArn: task_arn, taskId };
  }

  /**
   * Run validation task
   * Spawns an ECS task that runs post-deployment validation
   */
  async runValidationTask(task: AIWorkerTask): Promise<RunTaskResult> {
    const environment = {
      TASK_ID: task.id,
      REPO_PATH: '/workspace',
      GITHUB_REPO: task.githubRepo,
      GITHUB_BRANCH: task.githubBranch || 'main',
      API_BASE_URL: process.env.API_BASE_URL || 'https://oncallshift.com',
      AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    };

    const command = new RunTaskCommand({
      cluster: this.config.cluster,
      taskDefinition: process.env.VALIDATION_TASK_DEFINITION || 'pagerduty-lite-dev-ai-worker-validation',
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: this.config.subnets,
          securityGroups: this.config.securityGroups,
          assignPublicIp: 'ENABLED',
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'validation',
            environment: Object.entries(environment).map(([name, value]) => ({ name, value: String(value) })),
          },
        ],
      },
    });

    const response = await this.ecs.send(command);

    if (!response.tasks || response.tasks.length === 0 || !response.tasks[0].taskArn) {
      throw new Error('Failed to run validation task');
    }

    const task_arn = response.tasks[0].taskArn;
    const taskId = task_arn.split('/').pop()!;

    logger.info('Validation task started', { taskArn: task_arn, taskId });

    return { taskArn: task_arn, taskId };
  }

  // ==================== Cost Estimation ====================

  calculateTaskCost(durationSeconds: number): number {
    // Fargate Spot pricing (us-east-1, as of 2024):
    // 2 vCPU: ~$0.03497/hour
    // 4GB memory: ~$0.00385/hour per GB = $0.0154/hour
    // Total: ~$0.05/hour for 2 vCPU, 4GB
    // With Spot discount (~70% off): ~$0.015/hour

    const hourlyRate = 0.015; // Fargate Spot
    return (durationSeconds / 3600) * hourlyRate;
  }
}

// Factory function
let ecsTaskRunner: ECSTaskRunner | null = null;

export function getECSTaskRunner(config?: ECSTaskRunnerConfig): ECSTaskRunner {
  if (!ecsTaskRunner && config) {
    ecsTaskRunner = new ECSTaskRunner(config);
  }
  if (!ecsTaskRunner) {
    throw new Error('ECSTaskRunner not initialized - provide config on first call');
  }
  return ecsTaskRunner;
}

export function initECSTaskRunner(config: ECSTaskRunnerConfig): ECSTaskRunner {
  ecsTaskRunner = new ECSTaskRunner(config);
  return ecsTaskRunner;
}

// Default configuration from environment
export function getDefaultECSConfig(): ECSTaskRunnerConfig {
  return {
    cluster: process.env.ECS_CLUSTER_NAME || process.env.ECS_CLUSTER || 'pagerduty-lite-dev',
    taskDefinition: process.env.EXECUTOR_TASK_DEFINITION || process.env.AI_WORKER_TASK_DEFINITION || 'pagerduty-lite-dev-ai-worker-executor',
    subnets: (process.env.EXECUTOR_SUBNET_IDS || process.env.PRIVATE_SUBNETS || '').split(',').filter(Boolean),
    securityGroups: (process.env.EXECUTOR_SECURITY_GROUP_IDS || process.env.SECURITY_GROUPS || '').split(',').filter(Boolean),
    containerName: 'ai-worker-executor',
    logGroup: process.env.AI_WORKER_LOG_GROUP || '/ecs/pagerduty-lite-dev/ai-worker-executor',
    region: process.env.AWS_REGION || 'us-east-1',
  };
}
