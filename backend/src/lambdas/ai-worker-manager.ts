/**
 * AI Worker Manager Lambda
 *
 * Thin trigger layer that spawns Manager ECS tasks.
 * The actual Manager work (PR review, learning analysis, environment updates)
 * runs in ECS containers just like workers.
 *
 * This enables Manager to:
 * - Build Docker images
 * - Modify IAM permissions
 * - Create PRs with infrastructure changes
 * - Use the same log piping as workers
 *
 * Invocation modes:
 * 1. Direct invoke with { action: 'review_pr', taskId } - Spawns ECS for PR review
 * 2. Direct invoke with { action: 'analyze_learnings', taskId } - Spawns ECS for learning analysis
 * 3. Direct invoke with { action: 'update_environment', taskId, changes } - Spawns ECS for env updates
 */

import { ECS, RunTaskCommand } from "@aws-sdk/client-ecs";
import { Client } from "pg";
import { v4 as uuidv4 } from "uuid";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const secretsManager = new SecretsManagerClient({
  region: process.env.REGION || "us-east-1",
});

const ecs = new ECS({
  region: process.env.REGION || "us-east-1",
});

interface DatabaseCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

async function getSecretValue(secretArn: string): Promise<string> {
  const response = await secretsManager.send(
    new GetSecretValueCommand({
      SecretId: secretArn,
    }),
  );
  if (!response.SecretString) {
    throw new Error(`Secret ${secretArn} is empty`);
  }
  return response.SecretString;
}

async function getDatabaseCredentials(): Promise<DatabaseCredentials> {
  const secretArn = process.env.DATABASE_SECRET_ARN;

  if (process.env.DATABASE_HOST) {
    return {
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || "5432"),
      database: process.env.DATABASE_NAME || "pagerduty_lite",
      username: process.env.DATABASE_USER || "postgres",
      password: process.env.DATABASE_PASSWORD || "",
    };
  }

  if (!secretArn) {
    throw new Error("DATABASE_SECRET_ARN or DATABASE_HOST must be set");
  }

  const secretValue = await getSecretValue(secretArn);

  if (secretValue.startsWith("postgres://")) {
    const url = new URL(secretValue);
    return {
      host: url.hostname,
      port: parseInt(url.port || "5432"),
      database: url.pathname.slice(1),
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    };
  }

  const secret = JSON.parse(secretValue);
  return {
    host: secret.host,
    port: secret.port || 5432,
    database: secret.dbname || secret.database,
    username: secret.username,
    password: secret.password,
  };
}

async function getOrgApiKey(): Promise<string> {
  if (process.env.ORG_API_KEY) {
    return process.env.ORG_API_KEY;
  }
  const secretArn = process.env.ORG_API_KEY_SECRET_ARN;
  if (!secretArn) {
    throw new Error("ORG_API_KEY or ORG_API_KEY_SECRET_ARN must be set");
  }
  return getSecretValue(secretArn);
}

// Event payload
type ManagerAction = "review_pr" | "analyze_learnings" | "update_environment";

interface EnvironmentChange {
  type: "dockerfile" | "execution_script" | "tool_install";
  filePath: string;
  change: string;
  reason: string;
}

interface ManagerEvent {
  action?: ManagerAction;
  taskId?: string;
  changes?: EnvironmentChange[];
}

interface SpawnResult {
  success: boolean;
  ecsTaskArn?: string;
  ecsTaskId?: string;
  error?: string;
}

// ECS Configuration from environment
const ECS_CONFIG = {
  cluster: process.env.ECS_CLUSTER_NAME || "pagerduty-lite-dev",
  taskDefinition: process.env.MANAGER_TASK_DEFINITION || "pagerduty-lite-dev-ai-worker-manager-executor",
  subnets: (process.env.MANAGER_SUBNET_IDS || "").split(",").filter(Boolean),
  securityGroups: (process.env.MANAGER_SECURITY_GROUP_IDS || "").split(",").filter(Boolean),
  containerName: process.env.MANAGER_CONTAINER_NAME || "ai-worker-manager-executor",
};

/**
 * Spawn an ECS task for Manager work
 */
async function spawnManagerTask(
  action: ManagerAction,
  taskId: string,
  extraEnv: Record<string, string> = {},
): Promise<SpawnResult> {
  console.log(`[Manager] Spawning ECS task for action: ${action}, taskId: ${taskId}`);

  // Get org API key for ECS task authentication
  let orgApiKey: string;
  try {
    orgApiKey = await getOrgApiKey();
  } catch (error) {
    console.error("[Manager] Failed to get ORG_API_KEY:", error);
    return { success: false, error: "Failed to get ORG_API_KEY" };
  }

  // Build environment variables for the container
  const environment = [
    { name: "TASK_ID", value: taskId },
    { name: "MANAGER_ACTION", value: action },
    { name: "API_BASE_URL", value: process.env.API_BASE_URL || "https://oncallshift.com" },
    { name: "ORG_API_KEY", value: orgApiKey },
    { name: "AWS_REGION", value: process.env.REGION || "us-east-1" },
    ...Object.entries(extraEnv).map(([name, value]) => ({ name, value })),
  ];

  try {
    const command = new RunTaskCommand({
      cluster: ECS_CONFIG.cluster,
      taskDefinition: ECS_CONFIG.taskDefinition,
      capacityProviderStrategy: [
        {
          capacityProvider: "FARGATE_SPOT",
          weight: 1,
          base: 0,
        },
      ],
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: ECS_CONFIG.subnets,
          securityGroups: ECS_CONFIG.securityGroups,
          assignPublicIp: "ENABLED",
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: ECS_CONFIG.containerName,
            environment,
          },
        ],
      },
      tags: [
        { key: "TaskId", value: taskId },
        { key: "ManagerAction", value: action },
        { key: "Component", value: "ai-worker-manager" },
      ],
    });

    const response = await ecs.send(command);

    if (!response.tasks || response.tasks.length === 0) {
      const failures = response.failures?.map((f) => `${f.arn}: ${f.reason}`).join(", ");
      console.error(`[Manager] Failed to start ECS task: ${failures || "Unknown error"}`);
      return { success: false, error: failures || "Failed to start ECS task" };
    }

    const ecsTask = response.tasks[0];
    const taskArn = ecsTask.taskArn!;
    const ecsTaskId = taskArn.split("/").pop()!;

    console.log(`[Manager] Started ECS task: ${ecsTaskId}`);
    return { success: true, ecsTaskArn: taskArn, ecsTaskId };
  } catch (error: any) {
    console.error("[Manager] Error spawning ECS task:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Main handler - thin trigger that spawns ECS tasks
 */
export async function handler(
  event: ManagerEvent = {},
): Promise<SpawnResult> {
  const action = event.action || "review_pr";
  const taskId = event.taskId;

  console.log(`[Manager] Received: action=${action}, taskId=${taskId || "none"}`);

  if (!taskId) {
    console.error("[Manager] No taskId provided");
    return { success: false, error: "taskId is required" };
  }

  // Validate ECS configuration
  if (ECS_CONFIG.subnets.length === 0 || ECS_CONFIG.securityGroups.length === 0) {
    console.error("[Manager] ECS configuration incomplete - missing subnets or security groups");
    return { success: false, error: "ECS configuration incomplete" };
  }

  // Get database connection to fetch task details
  const dbCreds = await getDatabaseCredentials();
  const client = new Client({
    host: dbCreds.host,
    port: dbCreds.port,
    database: dbCreds.database,
    user: dbCreds.username,
    password: dbCreds.password,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Fetch task details
    const taskResult = await client.query(
      `SELECT id, jira_issue_key, summary, description, github_repo,
              github_pr_number, github_pr_url, review_feedback
       FROM ai_worker_tasks WHERE id = $1`,
      [taskId],
    );

    if (taskResult.rows.length === 0) {
      console.error(`[Manager] Task ${taskId} not found`);
      return { success: false, error: "Task not found" };
    }

    const task = taskResult.rows[0];

    // Build extra environment variables based on action
    const extraEnv: Record<string, string> = {
      JIRA_ISSUE_KEY: task.jira_issue_key || "",
      JIRA_SUMMARY: task.summary || "",
      JIRA_DESCRIPTION: task.description || "",
    };

    if (action === "review_pr") {
      extraEnv.PR_URL = task.github_pr_url || "";
      extraEnv.PR_NUMBER = String(task.github_pr_number || "");
      extraEnv.REVIEW_FEEDBACK = task.review_feedback || "";
    }

    if (action === "analyze_learnings") {
      extraEnv.SOURCE_TASK_ID = taskId;
    }

    if (action === "update_environment" && event.changes) {
      extraEnv.ENVIRONMENT_CHANGES = JSON.stringify(event.changes);
    }

    // Update task status to manager_review
    await client.query(
      `UPDATE ai_worker_tasks
       SET status = 'manager_review',
           review_requested_at = NOW()
       WHERE id = $1`,
      [taskId],
    );

    // Log the manager task start
    const logId = uuidv4();
    await client.query(
      `INSERT INTO ai_worker_task_logs
       (id, task_id, type, message, severity, created_at)
       VALUES ($1, $2, 'manager', $3, 'info', NOW())`,
      [logId, taskId, `Virtual Manager starting ${action} (ECS-based)...`],
    );

    // Spawn the ECS task
    const result = await spawnManagerTask(action, taskId, extraEnv);

    if (result.success && result.ecsTaskArn) {
      // Store ECS task info in the database
      await client.query(
        `UPDATE ai_worker_tasks
         SET manager_ecs_task_arn = $1,
             manager_ecs_task_id = $2
         WHERE id = $3`,
        [result.ecsTaskArn, result.ecsTaskId, taskId],
      );

      console.log(`[Manager] ECS task spawned successfully: ${result.ecsTaskId}`);
    } else {
      // Revert status on failure
      await client.query(
        `UPDATE ai_worker_tasks
         SET status = 'pr_created'
         WHERE id = $1`,
        [taskId],
      );
    }

    return result;
  } catch (error: any) {
    console.error("[Manager] Error:", error);
    return { success: false, error: error.message };
  } finally {
    await client.end();
  }
}
