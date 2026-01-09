/**
 * AI Worker Watcher Lambda
 *
 * Runs every 5 minutes via CloudWatch Events to:
 * 1. Detect stuck tasks (no heartbeat for 3+ minutes - fast cleanup)
 * 2. Kill and queue stuck tasks for retry
 * 3. Detect infinite loops (same error 3+ times)
 * 4. Check for global timeout (4 hours total)
 * 5. Process retry queue (tasks with next_retry_at <= now)
 */

import { ECS, StopTaskCommand } from "@aws-sdk/client-ecs";
import { SQS, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { Client } from "pg";
import { v4 as uuidv4 } from "uuid";

// Secrets Manager client
const secretsManager = new SecretsManagerClient({
  region: process.env.REGION || process.env.AWS_REGION || "us-east-1",
});

interface DatabaseCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

async function getDatabaseCredentials(): Promise<DatabaseCredentials> {
  const secretArn = process.env.DATABASE_SECRET_ARN;

  // If individual env vars are set, use those
  if (process.env.DATABASE_HOST) {
    return {
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || "5432"),
      database: process.env.DATABASE_NAME || "pagerduty_lite",
      username: process.env.DATABASE_USER || "postgres",
      password: process.env.DATABASE_PASSWORD || "",
    };
  }

  // Otherwise fetch from Secrets Manager
  if (!secretArn) {
    throw new Error("DATABASE_SECRET_ARN or DATABASE_HOST must be set");
  }

  const response = await secretsManager.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );
  if (!response.SecretString) {
    throw new Error(`Secret ${secretArn} is empty`);
  }

  const secretValue = response.SecretString;

  // Handle postgres:// URL format
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

  // Handle JSON format
  const secret = JSON.parse(secretValue);
  return {
    host: secret.host,
    port: secret.port || 5432,
    database: secret.dbname || secret.database,
    username: secret.username,
    password: secret.password,
  };
}

// Configuration
const CONFIG = {
  stuckThresholdMinutes: 3, // Fast 3-minute cleanup
  maxBackoffSeconds: 3600, // 1 hour
  globalTimeoutHours: 4,
  maxRetries: 3,
};

// Initialize AWS clients
const ecs = new ECS({
  region: process.env.REGION || process.env.AWS_REGION || "us-east-1",
});
const sqs = new SQS({
  region: process.env.REGION || process.env.AWS_REGION || "us-east-1",
});
const ecsCluster = process.env.ECS_CLUSTER_NAME || "pagerduty-lite-dev";
const queueUrl = process.env.AI_WORKER_QUEUE_URL;

interface WatcherResult {
  tasksDispatched: number;
  stuckTasksKilled: number;
  retriesQueued: number;
  globalTimeoutsMarked: number;
  loopsDetected: number;
  idleWorkersCleanedUp: number;
  errors: string[];
}

interface WatcherEvent {
  cleanup?: boolean; // If true, cancel all active tasks
}

export async function handler(event?: WatcherEvent): Promise<WatcherResult> {
  const result: WatcherResult = {
    tasksDispatched: 0,
    stuckTasksKilled: 0,
    retriesQueued: 0,
    globalTimeoutsMarked: 0,
    loopsDetected: 0,
    idleWorkersCleanedUp: 0,
    errors: [],
  };

  // Get database credentials from Secrets Manager or env vars
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
    console.log("[Watcher] Connected to database");

    // Cleanup mode - cancel all active tasks
    if (event?.cleanup) {
      console.log("[Watcher] Cleanup mode - cancelling all active tasks");
      const cancelResult = await client.query(
        `UPDATE ai_worker_tasks
         SET status = 'cancelled',
             error_message = 'Bulk cleanup via watcher',
             completed_at = NOW()
         WHERE status IN ('queued', 'environment_setup', 'executing', 'failed', 'blocked')
           AND status != 'completed'
         RETURNING id, jira_issue_key, status`
      );
      console.log(`[Watcher] Cancelled ${cancelResult.rowCount} tasks`);
      for (const row of cancelResult.rows) {
        console.log(`[Watcher] Cancelled ${row.jira_issue_key} (${row.id})`);
      }
      return { ...result, stuckTasksKilled: cancelResult.rowCount || 0 };
    }

    // 0. Dispatch orphaned queued tasks (queued but not in SQS)
    await dispatchOrphanedQueuedTasks(client, result);

    // 0a. Reset orphaned failed tasks (failed without next_retry_at)
    await resetOrphanedFailedTasks(client, result);

    // 0b. Reset orphaned revision tasks (revision_needed without next_retry_at)
    await resetOrphanedRevisionTasks(client, result);

    // NOTE: Task execution is handled by the orchestrator service
    // The watcher re-queues orphaned tasks to SQS and handles cleanup/retries

    // 1. Detect and handle stuck tasks
    await handleStuckTasks(client, result);

    // 2. Check for global timeouts
    await handleGlobalTimeouts(client, result);

    // 3. Process retry queue
    await processRetryQueue(client, result);

    // 4. Detect infinite loops
    await detectInfiniteLoops(client, result);

    // 5. Clean up idle workers (workers showing 'working' but idle > 5 mins)
    await cleanupIdleWorkers(client, result);

    console.log("[Watcher] Completed", result);
    return result;
  } catch (error: any) {
    console.error("[Watcher] Error:", error);
    result.errors.push(error.message);
    return result;
  } finally {
    await client.end();
  }
}

/**
 * Dispatch orphaned queued tasks - tasks stuck in 'queued' status for 2+ minutes.
 * This catches tasks that were queued but never made it to SQS (e.g., after watcher restart).
 */
async function dispatchOrphanedQueuedTasks(
  client: Client,
  result: WatcherResult,
): Promise<void> {
  // Find tasks that have been queued for more than 2 minutes (likely missed by orchestrator)
  const orphanedQuery = `
    SELECT id, jira_issue_key
    FROM ai_worker_tasks
    WHERE status = 'queued'
      AND updated_at < NOW() - INTERVAL '2 minutes'
      AND created_at > NOW() - INTERVAL '24 hours'
  `;

  const { rows: orphanedTasks } = await client.query(orphanedQuery);

  if (orphanedTasks.length > 0) {
    console.log(`[Watcher] Found ${orphanedTasks.length} orphaned queued tasks to dispatch`);
  }

  for (const task of orphanedTasks) {
    try {
      // Send to SQS queue for orchestrator to pick up
      if (queueUrl) {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({ taskId: task.id, action: "execute" }),
          }),
        );

        // Update watcher_notes to track this
        await client.query(
          `UPDATE ai_worker_tasks
           SET watcher_notes = COALESCE(watcher_notes, '') || $1
           WHERE id = $2`,
          [
            `\n[${new Date().toISOString()}] Watcher re-queued orphaned task to SQS`,
            task.id,
          ],
        );

        console.log(`[Watcher] Re-queued orphaned task ${task.jira_issue_key} to SQS`);
        result.tasksDispatched++;
      }
    } catch (error: any) {
      console.error(`[Watcher] Error dispatching orphaned task ${task.id}:`, error);
      result.errors.push(`Dispatch ${task.id}: ${error.message}`);
    }
  }
}

/**
 * Reset orphaned failed tasks - those that failed without next_retry_at set.
 * This can happen if dispatch fails with a transient error.
 */
async function resetOrphanedFailedTasks(
  client: Client,
  result: WatcherResult,
): Promise<void> {
  // Find failed tasks without next_retry_at (orphaned by failed dispatch)
  const orphanedQuery = `
    SELECT id, jira_issue_key, retry_count, max_retries
    FROM ai_worker_tasks
    WHERE status = 'failed'
      AND next_retry_at IS NULL
      AND retry_count < max_retries
      AND created_at > NOW() - INTERVAL '24 hours'
  `;

  const { rows: orphanedTasks } = await client.query(orphanedQuery);

  if (orphanedTasks.length > 0) {
    console.log(`[Watcher] Found ${orphanedTasks.length} orphaned failed tasks to reset`);
  }

  for (const task of orphanedTasks) {
    console.log(`[Watcher] Resetting orphaned task ${task.jira_issue_key} (id: ${task.id}) to queued`);

    await client.query(
      `UPDATE ai_worker_tasks
       SET status = 'queued',
           error_message = NULL,
           watcher_notes = COALESCE(watcher_notes, '') || $1
       WHERE id = $2`,
      [
        `\n[${new Date().toISOString()}] Reset orphaned failed task to queued`,
        task.id,
      ],
    );
    result.retriesQueued++;
  }
}

/**
 * Reset orphaned revision_needed tasks - those that were set by old manager code
 * that didn't set next_retry_at. This ensures they get picked up for re-execution.
 */
async function resetOrphanedRevisionTasks(
  client: Client,
  result: WatcherResult,
): Promise<void> {
  // Find revision_needed tasks without next_retry_at (orphaned by old manager code)
  const orphanedQuery = `
    SELECT id, jira_issue_key, revision_count
    FROM ai_worker_tasks
    WHERE status = 'revision_needed'
      AND next_retry_at IS NULL
      AND revision_count < 3
      AND created_at > NOW() - INTERVAL '24 hours'
  `;

  const { rows: orphanedTasks } = await client.query(orphanedQuery);

  if (orphanedTasks.length > 0) {
    console.log(
      `[Watcher] Found ${orphanedTasks.length} orphaned revision_needed tasks to reset`,
    );
  }

  for (const task of orphanedTasks) {
    console.log(
      `[Watcher] Setting next_retry_at for orphaned revision task ${task.jira_issue_key} (id: ${task.id})`,
    );

    // Set next_retry_at so the normal retry queue will pick it up
    await client.query(
      `UPDATE ai_worker_tasks
       SET next_retry_at = NOW() + INTERVAL '30 seconds',
           watcher_notes = COALESCE(watcher_notes, '') || $1
       WHERE id = $2`,
      [
        `\n[${new Date().toISOString()}] Set next_retry_at for orphaned revision task`,
        task.id,
      ],
    );
    result.retriesQueued++;
  }
}

// NOTE: dispatchQueuedTasks was REMOVED - the watcher should NOT spawn ECS tasks
// Task execution is handled by the orchestrator service which processes the SQS queue
// The watcher only handles: stuck task cleanup, retries (via SQS), timeouts, and monitoring

async function handleStuckTasks(
  client: Client,
  result: WatcherResult,
): Promise<void> {
  const stuckThreshold = new Date(
    Date.now() - CONFIG.stuckThresholdMinutes * 60 * 1000,
  );

  // Find stuck tasks (including 'dispatching' which shouldn't persist)
  const stuckTasksQuery = `
    SELECT id, ecs_task_arn, ecs_task_id, retry_count, max_retries,
           retry_backoff_seconds, global_timeout_at, jira_issue_key, status
    FROM ai_worker_tasks
    WHERE (
      -- Tasks with no heartbeat for too long
      (status IN ('executing', 'environment_setup')
        AND last_heartbeat_at IS NOT NULL
        AND last_heartbeat_at < $1)
      OR
      -- 'dispatching' status should never persist - it means spawn failed mid-flight
      (status = 'dispatching' AND updated_at < $1)
    )
  `;

  const { rows: stuckTasks } = await client.query(stuckTasksQuery, [
    stuckThreshold,
  ]);
  console.log(`[Watcher] Found ${stuckTasks.length} stuck tasks`);

  for (const task of stuckTasks) {
    try {
      // Stop the ECS task
      if (task.ecs_task_arn) {
        try {
          await ecs.send(
            new StopTaskCommand({
              cluster: ecsCluster,
              task: task.ecs_task_arn,
              reason: "Killed by Watcher: No heartbeat for 3+ minutes",
            }),
          );
          console.log(`[Watcher] Killed ECS task for ${task.jira_issue_key}`);
        } catch (err: any) {
          console.warn(`[Watcher] Failed to stop ECS task: ${err.message}`);
        }
      }

      // Create a run record for this failed attempt
      const runNumber = task.retry_count + 1;
      await client.query(
        `
        INSERT INTO ai_worker_task_runs
        (id, task_id, run_number, outcome, started_at, ended_at, error_message, error_category, ecs_task_arn, ecs_task_id)
        VALUES ($1, $2, $3, 'killed', NOW() - INTERVAL '3 minutes', NOW(), 'No heartbeat for 3+ minutes', 'stuck', $4, $5)
      `,
        [uuidv4(), task.id, runNumber, task.ecs_task_arn, task.ecs_task_id],
      );

      // Calculate next retry
      const canRetry = task.retry_count < task.max_retries;
      const isTimedOut =
        task.global_timeout_at && new Date(task.global_timeout_at) < new Date();

      if (canRetry && !isTimedOut) {
        // Schedule retry with exponential backoff
        const nextBackoff = Math.min(
          task.retry_backoff_seconds * 2,
          CONFIG.maxBackoffSeconds,
        );
        const nextRetryAt = new Date(Date.now() + nextBackoff * 1000);

        await client.query(
          `
          UPDATE ai_worker_tasks
          SET status = 'failed',
              error_message = 'Stuck: No heartbeat for 3+ minutes',
              failure_category = 'stuck',
              retry_count = retry_count + 1,
              retry_backoff_seconds = $1,
              next_retry_at = $2,
              watcher_notes = COALESCE(watcher_notes, '') || $3,
              ecs_task_arn = NULL,
              ecs_task_id = NULL
          WHERE id = $4
        `,
          [
            nextBackoff,
            nextRetryAt,
            `\n[${new Date().toISOString()}] Killed by Watcher: stuck, scheduled retry at ${nextRetryAt.toISOString()}`,
            task.id,
          ],
        );

        console.log(
          `[Watcher] Scheduled retry for ${task.jira_issue_key} at ${nextRetryAt.toISOString()}`,
        );
      } else {
        // Max retries exceeded or timed out
        await client.query(
          `
          UPDATE ai_worker_tasks
          SET status = 'failed',
              completed_at = NOW(),
              error_message = $1,
              failure_category = 'stuck',
              watcher_notes = COALESCE(watcher_notes, '') || $2,
              ecs_task_arn = NULL,
              ecs_task_id = NULL
          WHERE id = $3
        `,
          [
            isTimedOut ? "Global timeout exceeded" : "Max retries exceeded",
            `\n[${new Date().toISOString()}] Killed by Watcher: ${isTimedOut ? "global timeout" : "max retries exceeded"}`,
            task.id,
          ],
        );

        console.log(
          `[Watcher] Marked ${task.jira_issue_key} as failed (${isTimedOut ? "timeout" : "max retries"})`,
        );
      }

      result.stuckTasksKilled++;
    } catch (error: any) {
      console.error(`[Watcher] Error handling stuck task ${task.id}:`, error);
      result.errors.push(`Stuck task ${task.id}: ${error.message}`);
    }
  }
}

async function handleGlobalTimeouts(
  client: Client,
  result: WatcherResult,
): Promise<void> {
  // Find tasks that have exceeded global timeout
  const timeoutQuery = `
    UPDATE ai_worker_tasks
    SET status = 'failed',
        completed_at = NOW(),
        error_message = 'Global timeout exceeded (4 hours)',
        failure_category = 'timeout',
        watcher_notes = COALESCE(watcher_notes, '') || $1
    WHERE global_timeout_at IS NOT NULL
      AND global_timeout_at < NOW()
      AND status NOT IN ('completed', 'failed', 'cancelled')
    RETURNING id, jira_issue_key
  `;

  const { rows } = await client.query(timeoutQuery, [
    `\n[${new Date().toISOString()}] Marked as failed by Watcher: global timeout exceeded`,
  ]);

  for (const task of rows) {
    console.log(`[Watcher] Global timeout for ${task.jira_issue_key}`);
    result.globalTimeoutsMarked++;
  }
}

async function processRetryQueue(
  client: Client,
  result: WatcherResult,
): Promise<void> {
  // Find tasks ready for retry (includes revision_needed from manager feedback)
  // For revisions, we check revision_count < 3 (max revisions)
  // For failures, we check retry_count < max_retries
  const retryQuery = `
    SELECT id, jira_issue_key, retry_count, global_timeout_at, status, revision_count
    FROM ai_worker_tasks
    WHERE next_retry_at IS NOT NULL
      AND next_retry_at <= NOW()
      AND (
        (status IN ('failed', 'blocked') AND retry_count < max_retries)
        OR (status = 'revision_needed' AND revision_count < 3)
      )
  `;

  const { rows: retryTasks } = await client.query(retryQuery);
  console.log(`[Watcher] Found ${retryTasks.length} tasks ready for retry`);

  for (const task of retryTasks) {
    try {
      // Check global timeout
      if (
        task.global_timeout_at &&
        new Date(task.global_timeout_at) < new Date()
      ) {
        await client.query(
          `
          UPDATE ai_worker_tasks
          SET status = 'failed',
              completed_at = NOW(),
              error_message = 'Global timeout exceeded during retry wait',
              next_retry_at = NULL,
              watcher_notes = COALESCE(watcher_notes, '') || $1
          WHERE id = $2
        `,
          [
            `\n[${new Date().toISOString()}] Global timeout during retry wait`,
            task.id,
          ],
        );
        result.globalTimeoutsMarked++;
        continue;
      }

      // Set global timeout if not set
      const globalTimeoutAt =
        task.global_timeout_at ||
        new Date(Date.now() + CONFIG.globalTimeoutHours * 60 * 60 * 1000);

      // Determine if this is a revision or failure retry
      const isRevision = task.status === "revision_needed";
      const retryLabel = isRevision
        ? `revision #${task.revision_count}`
        : `retry #${task.retry_count + 1}`;

      // Update task to queued and clear retry scheduling
      await client.query(
        `
        UPDATE ai_worker_tasks
        SET status = 'queued',
            error_message = NULL,
            next_retry_at = NULL,
            global_timeout_at = $1,
            last_heartbeat_at = NULL,
            watcher_notes = COALESCE(watcher_notes, '') || $2
        WHERE id = $3
      `,
        [
          globalTimeoutAt,
          `\n[${new Date().toISOString()}] Watcher queued ${retryLabel}`,
          task.id,
        ],
      );

      // Send to SQS queue
      if (queueUrl) {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({ taskId: task.id, action: "execute" }),
          }),
        );
      }

      console.log(
        `[Watcher] Queued ${retryLabel} for ${task.jira_issue_key}`,
      );
      result.retriesQueued++;
    } catch (error: any) {
      console.error(`[Watcher] Error processing retry for ${task.id}:`, error);
      result.errors.push(`Retry ${task.id}: ${error.message}`);
    }
  }
}

async function detectInfiniteLoops(
  client: Client,
  result: WatcherResult,
): Promise<void> {
  // Find tasks where last 3 runs have the same error category
  const loopQuery = `
    SELECT DISTINCT t.id, t.jira_issue_key, r.error_category
    FROM ai_worker_tasks t
    INNER JOIN (
      SELECT task_id, error_category, run_number,
             ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY run_number DESC) as rn
      FROM ai_worker_task_runs
      WHERE outcome IN ('failed', 'timeout', 'killed')
    ) r ON t.id = r.task_id AND r.rn <= 3
    WHERE t.status IN ('failed', 'blocked')
      AND t.retry_count >= 2
      AND t.next_retry_at IS NOT NULL
    GROUP BY t.id, t.jira_issue_key, r.error_category
    HAVING COUNT(DISTINCT r.error_category) = 1 AND COUNT(*) >= 3
  `;

  const { rows: loopingTasks } = await client.query(loopQuery);

  for (const task of loopingTasks) {
    try {
      await client.query(
        `
        UPDATE ai_worker_tasks
        SET status = 'failed',
            completed_at = NOW(),
            error_message = $1,
            failure_category = 'loop',
            next_retry_at = NULL,
            watcher_notes = COALESCE(watcher_notes, '') || $2
        WHERE id = $3
      `,
        [
          `Infinite loop detected: same error (${task.error_category}) in last 3 runs`,
          `\n[${new Date().toISOString()}] Loop detected by Watcher: ${task.error_category}`,
          task.id,
        ],
      );

      console.log(
        `[Watcher] Loop detected for ${task.jira_issue_key}: ${task.error_category}`,
      );
      result.loopsDetected++;
    } catch (error: any) {
      console.error(`[Watcher] Error handling loop for ${task.id}:`, error);
      result.errors.push(`Loop ${task.id}: ${error.message}`);
    }
  }
}

/**
 * Clean up idle workers - set workers to 'idle' status if they've been
 * 'working' but have no current task and haven't had activity in 5+ minutes.
 */
async function cleanupIdleWorkers(
  client: Client,
  result: WatcherResult,
): Promise<void> {
  const IDLE_THRESHOLD_MINUTES = 5;

  // Find workers that are marked 'working' but have been idle for 5+ minutes
  const idleWorkersQuery = `
    UPDATE ai_worker_instances
    SET status = 'idle',
        current_task_id = NULL
    WHERE status = 'working'
      AND (
        -- No current task assigned
        current_task_id IS NULL
        OR
        -- Current task is completed/failed/cancelled
        current_task_id IN (
          SELECT id FROM ai_worker_tasks
          WHERE status IN ('completed', 'failed', 'cancelled', 'blocked')
        )
      )
      AND (
        -- Last task was more than 5 minutes ago
        last_task_at IS NULL
        OR last_task_at < NOW() - INTERVAL '${IDLE_THRESHOLD_MINUTES} minutes'
      )
      AND (
        -- Or updated more than 5 minutes ago
        updated_at < NOW() - INTERVAL '${IDLE_THRESHOLD_MINUTES} minutes'
      )
    RETURNING id, persona, display_name
  `;

  try {
    const { rows: cleanedWorkers, rowCount } = await client.query(idleWorkersQuery);

    if (rowCount && rowCount > 0) {
      console.log(`[Watcher] Cleaned up ${rowCount} idle workers`);
      for (const worker of cleanedWorkers) {
        console.log(`[Watcher] Set worker ${worker.display_name} (${worker.persona}) to idle`);
      }
      result.idleWorkersCleanedUp = rowCount;
    }
  } catch (error: any) {
    console.error("[Watcher] Error cleaning up idle workers:", error);
    result.errors.push(`Idle cleanup: ${error.message}`);
  }
}
