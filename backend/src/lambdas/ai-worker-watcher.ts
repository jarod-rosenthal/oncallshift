/**
 * AI Worker Watcher Lambda
 *
 * Runs every 5 minutes via CloudWatch Events to:
 * 1. Detect stuck tasks (no heartbeat for 15+ minutes)
 * 2. Kill and queue stuck tasks for retry
 * 3. Detect infinite loops (same error 3+ times)
 * 4. Check for global timeout (4 hours total)
 * 5. Process retry queue (tasks with next_retry_at <= now)
 */

import { ECS, StopTaskCommand } from '@aws-sdk/client-ecs';
import { SQS, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const CONFIG = {
  stuckThresholdMinutes: 15,
  maxBackoffSeconds: 3600, // 1 hour
  globalTimeoutHours: 4,
  maxRetries: 3,
};

// Initialize AWS clients
const ecs = new ECS({ region: process.env.AWS_REGION || 'us-east-1' });
const sqs = new SQS({ region: process.env.AWS_REGION || 'us-east-1' });
const ecsCluster = process.env.ECS_CLUSTER_NAME || 'pagerduty-lite-dev';
const queueUrl = process.env.AI_WORKER_QUEUE_URL;

interface WatcherResult {
  stuckTasksKilled: number;
  retriesQueued: number;
  globalTimeoutsMarked: number;
  loopsDetected: number;
  errors: string[];
}

export async function handler(): Promise<WatcherResult> {
  const result: WatcherResult = {
    stuckTasksKilled: 0,
    retriesQueued: 0,
    globalTimeoutsMarked: 0,
    loopsDetected: 0,
    errors: [],
  };

  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('[Watcher] Connected to database');

    // 1. Detect and handle stuck tasks
    await handleStuckTasks(client, result);

    // 2. Check for global timeouts
    await handleGlobalTimeouts(client, result);

    // 3. Process retry queue
    await processRetryQueue(client, result);

    // 4. Detect infinite loops
    await detectInfiniteLoops(client, result);

    console.log('[Watcher] Completed', result);
    return result;

  } catch (error: any) {
    console.error('[Watcher] Error:', error);
    result.errors.push(error.message);
    return result;
  } finally {
    await client.end();
  }
}

async function handleStuckTasks(client: Client, result: WatcherResult): Promise<void> {
  const stuckThreshold = new Date(Date.now() - CONFIG.stuckThresholdMinutes * 60 * 1000);

  // Find stuck tasks
  const stuckTasksQuery = `
    SELECT id, ecs_task_arn, ecs_task_id, retry_count, max_retries,
           retry_backoff_seconds, global_timeout_at, jira_issue_key
    FROM ai_worker_tasks
    WHERE status IN ('executing', 'environment_setup')
      AND last_heartbeat_at IS NOT NULL
      AND last_heartbeat_at < $1
  `;

  const { rows: stuckTasks } = await client.query(stuckTasksQuery, [stuckThreshold]);
  console.log(`[Watcher] Found ${stuckTasks.length} stuck tasks`);

  for (const task of stuckTasks) {
    try {
      // Stop the ECS task
      if (task.ecs_task_arn) {
        try {
          await ecs.send(new StopTaskCommand({
            cluster: ecsCluster,
            task: task.ecs_task_arn,
            reason: 'Killed by Watcher: No heartbeat for 15+ minutes',
          }));
          console.log(`[Watcher] Killed ECS task for ${task.jira_issue_key}`);
        } catch (err: any) {
          console.warn(`[Watcher] Failed to stop ECS task: ${err.message}`);
        }
      }

      // Create a run record for this failed attempt
      const runNumber = task.retry_count + 1;
      await client.query(`
        INSERT INTO ai_worker_task_runs
        (id, task_id, run_number, outcome, started_at, ended_at, error_message, error_category, ecs_task_arn, ecs_task_id)
        VALUES ($1, $2, $3, 'killed', NOW() - INTERVAL '15 minutes', NOW(), 'No heartbeat for 15+ minutes', 'stuck', $4, $5)
      `, [uuidv4(), task.id, runNumber, task.ecs_task_arn, task.ecs_task_id]);

      // Calculate next retry
      const canRetry = task.retry_count < task.max_retries;
      const isTimedOut = task.global_timeout_at && new Date(task.global_timeout_at) < new Date();

      if (canRetry && !isTimedOut) {
        // Schedule retry with exponential backoff
        const nextBackoff = Math.min(task.retry_backoff_seconds * 2, CONFIG.maxBackoffSeconds);
        const nextRetryAt = new Date(Date.now() + nextBackoff * 1000);

        await client.query(`
          UPDATE ai_worker_tasks
          SET status = 'failed',
              error_message = 'Stuck: No heartbeat for 15+ minutes',
              failure_category = 'stuck',
              retry_count = retry_count + 1,
              retry_backoff_seconds = $1,
              next_retry_at = $2,
              watcher_notes = COALESCE(watcher_notes, '') || $3,
              ecs_task_arn = NULL,
              ecs_task_id = NULL
          WHERE id = $4
        `, [
          nextBackoff,
          nextRetryAt,
          `\n[${new Date().toISOString()}] Killed by Watcher: stuck, scheduled retry at ${nextRetryAt.toISOString()}`,
          task.id,
        ]);

        console.log(`[Watcher] Scheduled retry for ${task.jira_issue_key} at ${nextRetryAt.toISOString()}`);
      } else {
        // Max retries exceeded or timed out
        await client.query(`
          UPDATE ai_worker_tasks
          SET status = 'failed',
              completed_at = NOW(),
              error_message = $1,
              failure_category = 'stuck',
              watcher_notes = COALESCE(watcher_notes, '') || $2,
              ecs_task_arn = NULL,
              ecs_task_id = NULL
          WHERE id = $3
        `, [
          isTimedOut ? 'Global timeout exceeded' : 'Max retries exceeded',
          `\n[${new Date().toISOString()}] Killed by Watcher: ${isTimedOut ? 'global timeout' : 'max retries exceeded'}`,
          task.id,
        ]);

        console.log(`[Watcher] Marked ${task.jira_issue_key} as failed (${isTimedOut ? 'timeout' : 'max retries'})`);
      }

      result.stuckTasksKilled++;
    } catch (error: any) {
      console.error(`[Watcher] Error handling stuck task ${task.id}:`, error);
      result.errors.push(`Stuck task ${task.id}: ${error.message}`);
    }
  }
}

async function handleGlobalTimeouts(client: Client, result: WatcherResult): Promise<void> {
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

async function processRetryQueue(client: Client, result: WatcherResult): Promise<void> {
  // Find tasks ready for retry
  const retryQuery = `
    SELECT id, jira_issue_key, retry_count, global_timeout_at
    FROM ai_worker_tasks
    WHERE status IN ('failed', 'blocked')
      AND next_retry_at IS NOT NULL
      AND next_retry_at <= NOW()
      AND retry_count < max_retries
  `;

  const { rows: retryTasks } = await client.query(retryQuery);
  console.log(`[Watcher] Found ${retryTasks.length} tasks ready for retry`);

  for (const task of retryTasks) {
    try {
      // Check global timeout
      if (task.global_timeout_at && new Date(task.global_timeout_at) < new Date()) {
        await client.query(`
          UPDATE ai_worker_tasks
          SET status = 'failed',
              completed_at = NOW(),
              error_message = 'Global timeout exceeded during retry wait',
              next_retry_at = NULL,
              watcher_notes = COALESCE(watcher_notes, '') || $1
          WHERE id = $2
        `, [
          `\n[${new Date().toISOString()}] Global timeout during retry wait`,
          task.id,
        ]);
        result.globalTimeoutsMarked++;
        continue;
      }

      // Set global timeout if not set
      const globalTimeoutAt = task.global_timeout_at || new Date(Date.now() + CONFIG.globalTimeoutHours * 60 * 60 * 1000);

      // Update task to queued and clear retry scheduling
      await client.query(`
        UPDATE ai_worker_tasks
        SET status = 'queued',
            error_message = NULL,
            next_retry_at = NULL,
            global_timeout_at = $1,
            last_heartbeat_at = NULL,
            watcher_notes = COALESCE(watcher_notes, '') || $2
        WHERE id = $3
      `, [
        globalTimeoutAt,
        `\n[${new Date().toISOString()}] Watcher queued retry #${task.retry_count + 1}`,
        task.id,
      ]);

      // Send to SQS queue
      if (queueUrl) {
        await sqs.send(new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({ taskId: task.id, action: 'execute' }),
        }));
      }

      console.log(`[Watcher] Queued retry for ${task.jira_issue_key}`);
      result.retriesQueued++;
    } catch (error: any) {
      console.error(`[Watcher] Error processing retry for ${task.id}:`, error);
      result.errors.push(`Retry ${task.id}: ${error.message}`);
    }
  }
}

async function detectInfiniteLoops(client: Client, result: WatcherResult): Promise<void> {
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
      await client.query(`
        UPDATE ai_worker_tasks
        SET status = 'failed',
            completed_at = NOW(),
            error_message = $1,
            failure_category = 'loop',
            next_retry_at = NULL,
            watcher_notes = COALESCE(watcher_notes, '') || $2
        WHERE id = $3
      `, [
        `Infinite loop detected: same error (${task.error_category}) in last 3 runs`,
        `\n[${new Date().toISOString()}] Loop detected by Watcher: ${task.error_category}`,
        task.id,
      ]);

      console.log(`[Watcher] Loop detected for ${task.jira_issue_key}: ${task.error_category}`);
      result.loopsDetected++;
    } catch (error: any) {
      console.error(`[Watcher] Error handling loop for ${task.id}:`, error);
      result.errors.push(`Loop ${task.id}: ${error.message}`);
    }
  }
}
