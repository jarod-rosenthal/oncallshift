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
  JIRA_ISSUE_KEY: string;
  JIRA_SUMMARY: string;
  JIRA_DESCRIPTION: string;
  GITHUB_REPO: string;
  WORKER_PERSONA: string;
  ANTHROPIC_API_KEY: string;
  GITHUB_TOKEN: string;
  MAX_TURNS?: string;
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
    credentials: { anthropicApiKey: string; githubToken: string }
  ): Promise<RunTaskResult> {
    // Build environment variables for the container
    const environment: TaskEnvironment = {
      TASK_ID: task.id,
      JIRA_ISSUE_KEY: task.jiraIssueKey,
      JIRA_SUMMARY: task.summary,
      JIRA_DESCRIPTION: task.description || '',
      GITHUB_REPO: task.githubRepo,
      WORKER_PERSONA: task.workerPersona,
      ANTHROPIC_API_KEY: credentials.anthropicApiKey,
      GITHUB_TOKEN: credentials.githubToken,
      MAX_TURNS: String(worker.config.maxTurns || 50),
    };

    const command = new RunTaskCommand({
      cluster: this.config.cluster,
      taskDefinition: this.config.taskDefinition,
      launchType: 'FARGATE',
      capacityProviderStrategy: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 1,
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
            environment: Object.entries(environment).map(([name, value]) => ({
              name,
              value,
            })),
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
    const logStreamName = `${this.config.containerName}/${this.config.containerName}/${taskId}`;

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
    cluster: process.env.ECS_CLUSTER || 'pagerduty-lite-dev',
    taskDefinition: process.env.AI_WORKER_TASK_DEFINITION || 'pagerduty-lite-dev-ai-worker',
    subnets: (process.env.PRIVATE_SUBNETS || '').split(',').filter(Boolean),
    securityGroups: (process.env.SECURITY_GROUPS || '').split(',').filter(Boolean),
    containerName: 'ai-worker',
    logGroup: process.env.AI_WORKER_LOG_GROUP || '/ecs/pagerduty-lite-dev/ai-worker',
    region: process.env.AWS_REGION || 'us-east-1',
  };
}
