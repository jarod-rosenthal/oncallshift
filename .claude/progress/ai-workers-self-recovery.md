# Feature: AI Workers Self-Recovery System

**Plan:** docs/AI_WORKERS_SELF_RECOVERY_PLAN.md
**Started:** 2026-01-04
**Completed:** 2026-01-04
**Status:** ✅ COMPLETE (All 7 Phases)

## Overview

Implementing self-healing capabilities for AI Workers with auto-retry, context passing, and a Watcher Lambda.

## Phases

### Phase 1: Database Schema ✅ COMPLETED
- [x] Create migration `050_ai_worker_self_recovery.sql`
- [x] Update `AIWorkerTask.ts` model with new fields
- [x] Create `AIWorkerTaskRun.ts` model
- [x] Export new model in `index.ts`

### Phase 2: Heartbeat System ✅ COMPLETED
- [x] Add heartbeat endpoint to `ai-worker-tasks.ts`
- [x] Add heartbeat to `ai-worker-entrypoint.sh`

### Phase 3: Context Capture & Passing ✅ COMPLETED
- [x] Update `ecs-task-runner.ts` to pass context env vars
- [x] Update `ai-worker-entrypoint.sh` to use previous context

### Phase 4: API Endpoints ✅ COMPLETED
- [x] Add tasks list with filtering (`GET /control-center/tasks`)
- [x] Add task runs endpoint (`GET /control-center/tasks/:id/runs`)
- [x] Add enhanced retry endpoint (`POST /control-center/tasks/:id/retry`)
- [x] Add cancel endpoint (`POST /control-center/tasks/:id/cancel`)
- [x] Add watcher status endpoint (`GET /control-center/watcher/status`)

### Phase 5: Watcher Lambda ✅ COMPLETED
- [x] Create `ai-worker-watcher.ts` Lambda function
- [x] Add Watcher Lambda to `main.tf` (inline config)
- [x] Add variables and outputs for watcher

### Phase 6: Control Center UI ✅ COMPLETED
- [x] Add Watcher status panel to `SuperAdminControlCenter.tsx`
- [x] Add task filtering (status dropdown, Jira key search)
- [x] Add task list table with retry/cancel action buttons
- [x] Add TaskDetailModal (inline in component)
- [x] Add TaskRunTimeline (inline in detail modal)
- [x] Add retry modal with custom context option
- [x] Add cancel modal with reason input

### Phase 7: CLI Enhancements ✅ COMPLETED
- [x] Add timeout option (`--timeout=SECONDS`)
- [x] Add watch mode option (`--watch` or `-w`)
- [x] Add log-level filtering (`--log-level=debug|info|warning|error`)
- [x] Add no-colors option (`--no-colors`)
- [x] Add taskId argument for watching specific task
- [x] Auto-exit on task completion (unless --watch)

## Completed

### Phase 1: Database Schema (2026-01-04)
- `backend/src/shared/db/migrations/050_ai_worker_self_recovery.sql`
  - Added columns: last_heartbeat_at, previous_run_context, global_timeout_at, next_retry_at, retry_backoff_seconds, failure_category, watcher_notes
  - Created `ai_worker_task_runs` table
  - Added indexes for watcher queries

- `backend/src/shared/models/AIWorkerTask.ts`
  - Added 7 new fields for self-recovery
  - Added helper methods: isStuck(), isGloballyTimedOut(), isReadyForRetry(), getNextBackoffSeconds(), scheduleRetry()

- `backend/src/shared/models/AIWorkerTaskRun.ts` (new)
  - Full model for tracking run attempts

### Phase 2: Heartbeat System (2026-01-04)
- `backend/src/api/routes/ai-worker-tasks.ts`
  - Added `POST /:id/heartbeat` endpoint
  - Updated formatTask() with self-recovery fields

- `backend/scripts/ai-worker-entrypoint.sh`
  - Added heartbeat background process (every 60s)
  - Added cleanup trap

### Phase 3: Context Capture & Passing (2026-01-04)
- `backend/src/shared/services/ecs-task-runner.ts`
  - Extended TaskEnvironment with: RETRY_NUMBER, PREVIOUS_RUN_CONTEXT, GLOBAL_TIMEOUT_AT, API_BASE_URL, ORG_API_KEY

- `backend/scripts/ai-worker-entrypoint.sh`
  - Added previous run context handling for retries

### Phase 4: API Endpoints (2026-01-04)
- `backend/src/api/routes/super-admin.ts`
  - `GET /control-center/tasks` - List tasks with filtering (status, search, pagination)
  - `GET /control-center/tasks/:id/runs` - Get run history for a task
  - `POST /control-center/tasks/:id/retry` - Enhanced retry with resetRetryCount and customContext options
  - `POST /control-center/tasks/:id/cancel` - Cancel with reason, stops ECS task
  - `GET /control-center/watcher/status` - Watcher metrics (stuck tasks, pending retries, etc.)

### Phase 5: Watcher Lambda (2026-01-04)
- `backend/src/lambdas/ai-worker-watcher.ts` (new)
  - Runs every 5 minutes via CloudWatch Events
  - handleStuckTasks() - Detects tasks with no heartbeat for 15+ min, kills ECS task, schedules retry
  - handleGlobalTimeouts() - Marks tasks past 4-hour deadline as failed
  - processRetryQueue() - Re-queues tasks with next_retry_at <= now
  - detectInfiniteLoops() - Stops retrying if same error 3+ times

- `infrastructure/terraform/modules/ai-workers/main.tf`
  - Added watcher Lambda function with CloudWatch Events trigger
  - Added IAM role with ECS, SQS, Secrets Manager permissions
  - Added CloudWatch log group

- `infrastructure/terraform/modules/ai-workers/variables.tf`
  - Added enable_watcher, database_secret_arn, watcher_schedule variables

- `infrastructure/terraform/modules/ai-workers/outputs.tf`
  - Added watcher_lambda_arn, watcher_lambda_name, watcher_log_group_name outputs

### Phase 6: Control Center UI (2026-01-04)
- `frontend/src/pages/SuperAdminControlCenter.tsx`
  - Added WatcherStatus, TaskRun, TaskWithRuns interfaces
  - Added fetchWatcherStatus() - polls watcher metrics every 5s
  - Added fetchTaskList() - loads tasks with status/search filters
  - Added fetchTaskRuns() - loads run history for detail modal
  - Added handleRetryTask() - retries with custom context option
  - Added handleCancelTask() - cancels running ECS task
  - Added Watcher Status panel showing: monitored, stuck, pending retries, loops, timeouts
  - Added Task List table with columns: Jira key, summary, status, retries, cost, actions
  - Added status dropdown filter (all, executing, queued, failed, completed, blocked, cancelled)
  - Added Jira key search input
  - Added View Details / Retry / Cancel action buttons
  - Added TaskDetailModal with: task info grid, error display, watcher notes, run history timeline
  - Added RetryModal with: reset retry count checkbox, custom context textarea
  - Added CancelModal with: reason input field

### Phase 7: CLI Enhancements (2026-01-04)
- `backend/scripts/ai-worker-cli.ts`
  - Added CLIOptions interface with timeout, watch, logLevel, noColors, taskId
  - Added parseArgs() function for command-line argument parsing
  - Updated watchTasks() to accept CLIOptions
  - Added session timeout handling (exits after specified seconds)
  - Added task-specific watching (auto-exit on completion unless --watch)
  - Added log-level filtering (debug, info, warning, error)
  - Updated printFooter() to show active options
  - Updated help text with all new options

## Status: ✅ COMPLETE

All phases implemented. Ready for deployment and testing.

## Next Steps
1. Run database migration (`050_ai_worker_self_recovery.sql`)
2. Deploy backend (includes Watcher Lambda)
3. Deploy frontend (Control Center UI)
4. Test self-recovery by triggering a task failure

## Issues/Blockers
- None currently

## Notes
- Using Lambda-based watcher (~$1/month) instead of ECS service
- Auto-retry ALL failures with exponential backoff
- 4-hour global timeout across all retry attempts
- Backoff sequence: 60s -> 2m -> 4m -> 8m -> 16m -> 32m -> 1hr (max)
- TypeScript compilation verified after each phase
