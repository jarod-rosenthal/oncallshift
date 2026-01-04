# AI Workers Self-Recovery System - Implementation Plan

> **Status**: Planned (not yet implemented)
> **Created**: 2026-01-04
> **Author**: Claude Code

## Overview

This document outlines the planned enhancements to the AI Workers system to add self-healing capabilities, improved Control Center UI, and a Watcher service to monitor and recover stuck/failed tasks.

## Problem Statement

The current AI Workers system has several limitations:

1. **No auto-recovery** - Failed tasks require manual intervention to retry
2. **Limited visibility** - Control Center is monitoring-only, no action buttons
3. **Stuck detection** - No mechanism to detect tasks that are stuck (no progress)
4. **No context passing** - Retried tasks don't know what failed in previous attempts
5. **CLI timeout** - The npm CLI tool times out after a few minutes

## Requirements

### 1. Extended TTL
- CLI tool should support configurable timeouts
- Option to watch indefinitely without auto-exit

### 2. Control Center UI (Command & Control)
- Show all tasks with: current state, start time, end time, duration
- Show failure details with full error messages
- Action buttons: Retry failed task, Cancel running task
- Task history with filtering by status, date range
- Pass failed run output as input context for next retry

### 3. Self-Recovery System
- Auto-retry ALL failed tasks (up to maxRetries, default 3)
- Capture failed run output and pass as context to next iteration
- Exponential backoff between retries (60s, 2m, 4m, 8m, 16m, 32m, 1hr max)
- 4-hour global timeout across all retry attempts

### 4. Watcher/Manager (Lambda-based)
- Runs every 5 minutes via CloudWatch Events
- Detect stuck tasks (no heartbeat for 15+ minutes)
- Kill and restart stuck workers
- Detect infinite loops (same error 3+ times)
- Cost-effective (~$1/month)

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auto-retry behavior | Retry ALL failures | Maximum automation, minimal manual intervention |
| Watcher deployment | Cron-based Lambda | Cost-effective (~$1/month vs $15/month for ECS service) |
| Global timeout | 4 hours total | Prevents runaway costs while allowing multiple retries |

---

## Implementation Plan

### Phase 1: Database Schema (Migration 050)

**File:** `backend/src/shared/db/migrations/050_ai_worker_self_recovery.sql`

Add fields to `ai_worker_tasks`:
```sql
ALTER TABLE ai_worker_tasks ADD COLUMN IF NOT EXISTS
  last_heartbeat_at TIMESTAMP,           -- For stuck detection
  previous_run_context TEXT,             -- Failed run context for retry
  global_timeout_at TIMESTAMP,           -- 4hr absolute deadline
  next_retry_at TIMESTAMP,               -- Scheduled retry time
  retry_backoff_seconds INT DEFAULT 60,  -- Exponential backoff
  failure_category VARCHAR(50),          -- timeout, git_error, test_failure, etc.
  watcher_notes TEXT;                    -- Watcher intervention notes
```

Create `ai_worker_task_runs` table to track each execution attempt:
```sql
CREATE TABLE ai_worker_task_runs (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES ai_worker_tasks(id),
  run_number INT,
  outcome VARCHAR(30),  -- success, failed, timeout, killed
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INT,
  error_message TEXT,
  error_category VARCHAR(50),
  captured_context TEXT,  -- State captured at end of run
  claude_input_tokens INT,
  claude_output_tokens INT,
  files_modified JSONB
);
```

**Files to create/modify:**
- `backend/src/shared/models/AIWorkerTask.ts` - Add new columns
- `backend/src/shared/models/AIWorkerTaskRun.ts` - New model

---

### Phase 2: Watcher Lambda Function

**File:** `backend/src/lambdas/ai-worker-watcher.ts` (new)

Lambda runs every 5 minutes via CloudWatch Events. Responsibilities:

1. **Stuck Detection** - Find tasks with `status IN ('executing', 'environment_setup')` where `last_heartbeat_at < NOW() - 15 minutes`
2. **Kill & Retry** - Stop ECS task, capture context, queue for retry with exponential backoff
3. **Loop Detection** - If last 3 runs failed with same `error_category`, mark as `failure_pattern = 'loop'` and stop retrying
4. **Global Timeout** - Cancel tasks where `global_timeout_at < NOW()`
5. **Process Retry Queue** - Find tasks where `next_retry_at <= NOW()` and requeue them

**Exponential Backoff Sequence:**
```
1min → 2min → 4min → 8min → 16min → 32min → 1hr → 1hr...
```

**Terraform:**
- `infrastructure/terraform/modules/ai-workers/watcher-lambda.tf` (new)
- Lambda with 5-minute CloudWatch Events trigger
- IAM role with ECS:StopTask, SQS:SendMessage, RDS access

---

### Phase 3: Context Capture & Passing

**Orchestrator Changes** (`backend/src/workers/ai-worker-orchestrator.ts`):

On task failure/timeout:
1. Capture context from logs (last 50 entries)
2. Capture git state (branch, last commit)
3. Capture files modified
4. Store as JSON in `previous_run_context`
5. Create `AIWorkerTaskRun` record

**ECS Task Runner** (`backend/src/shared/services/ecs-task-runner.ts`):

Add environment variables:
```typescript
PREVIOUS_RUN_CONTEXT: task.previousRunContext || '',
RETRY_NUMBER: String(task.retryCount),
GLOBAL_TIMEOUT_AT: task.globalTimeoutAt?.toISOString() || ''
```

**Entrypoint Script** (`backend/scripts/ai-worker-entrypoint.sh`):

When `PREVIOUS_RUN_CONTEXT` is set, append to instructions:
```markdown
## Previous Run Context (Retry #${RETRY_NUMBER})

The previous attempt failed. Here's what happened:
${PREVIOUS_RUN_CONTEXT}

Please:
1. Avoid repeating the same mistakes
2. Try a different approach if the previous one failed
3. Check if previous file changes caused issues
```

---

### Phase 4: API Endpoints

**File:** `backend/src/api/routes/super-admin.ts`

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/control-center/tasks/:id/retry` | Manual retry with optional reset & custom context |
| `POST` | `/control-center/tasks/:id/cancel` | Cancel running task with reason |
| `GET` | `/control-center/tasks/:id/runs` | Get all run attempts with details |
| `GET` | `/control-center/tasks` | List tasks with filtering (status, date range, search) |
| `GET` | `/control-center/watcher/status` | Watcher health & metrics |

**Retry endpoint body:**
```json
{
  "resetRetryCount": false,
  "customContext": "Try using the existing helper function instead of writing new code"
}
```

**Heartbeat endpoint** (`backend/src/api/routes/ai-worker-tasks.ts`):
```typescript
POST /api/v1/ai-worker-tasks/:id/heartbeat
// Updates last_heartbeat_at timestamp
```

---

### Phase 5: Control Center UI

**File:** `frontend/src/pages/SuperAdminControlCenter.tsx`

Enhancements:

1. **Task List Table** (replace/enhance recent completed)
   - Columns: Jira Key, Summary, Status, Started, Duration, Retries, Cost, Actions
   - Expandable rows showing run history
   - Status filters: All, Active, Failed, Completed
   - Date range picker
   - Search by Jira key

2. **Action Buttons** (per task row)
   - Retry (opens dialog with options)
   - Cancel (with reason input)
   - View Details (opens modal)

3. **Task Detail Modal** (`frontend/src/components/TaskDetailModal.tsx`)
   - Full error message display
   - Run history timeline (run 1, 2, 3 with outcomes)
   - Files modified per run
   - Context passed between retries
   - Watcher intervention notes

4. **Watcher Status Panel** (new card in header)
   - Lambda last run time
   - Tasks being monitored count
   - Pending retries count
   - Loops detected count

---

### Phase 6: CLI Tool Enhancements

**File:** `backend/scripts/ai-worker-cli.ts`

Add options:
```bash
npx ts-node scripts/ai-worker-cli.ts [taskId] [options]

Options:
  --watch, -w         Keep watching even after task completes
  --timeout=3600      Session timeout in seconds (0 = no timeout)
  --log-level=info    Filter logs (debug, info, warning, error)
  --no-colors         Disable colored output
```

Fix: Remove auto-exit on completion, add manual Ctrl+C to exit.

---

### Phase 7: Heartbeat Integration

**File:** `backend/scripts/ai-worker-entrypoint.sh`

Add heartbeat reporting during execution:
```bash
# Background heartbeat process
(
  while true; do
    curl -X POST "https://oncallshift.com/api/v1/ai-worker-tasks/${TASK_ID}/heartbeat" \
      -H "Authorization: Bearer ${API_TOKEN}" || true
    sleep 60
  done
) &
HEARTBEAT_PID=$!

# ... run claude ...

kill $HEARTBEAT_PID 2>/dev/null
```

---

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `backend/src/shared/db/migrations/050_ai_worker_self_recovery.sql` | Database schema changes |
| `backend/src/shared/models/AIWorkerTaskRun.ts` | Run attempt tracking model |
| `backend/src/lambdas/ai-worker-watcher.ts` | Watcher Lambda function |
| `infrastructure/terraform/modules/ai-workers/watcher-lambda.tf` | Lambda infrastructure |
| `frontend/src/components/TaskDetailModal.tsx` | Task detail popup |
| `frontend/src/components/TaskRunTimeline.tsx` | Run history visualization |

### Modified Files
| File | Changes |
|------|---------|
| `backend/src/shared/models/AIWorkerTask.ts` | Add new columns |
| `backend/src/shared/models/index.ts` | Export new model |
| `backend/src/workers/ai-worker-orchestrator.ts` | Context capture, run recording |
| `backend/src/shared/services/ecs-task-runner.ts` | Pass context env vars |
| `backend/scripts/ai-worker-entrypoint.sh` | Use context, add heartbeat |
| `backend/src/api/routes/super-admin.ts` | Add action endpoints |
| `backend/src/api/routes/ai-worker-tasks.ts` | Add heartbeat endpoint |
| `frontend/src/pages/SuperAdminControlCenter.tsx` | Full UI enhancement |
| `backend/scripts/ai-worker-cli.ts` | Add timeout/watch options |
| `infrastructure/terraform/environments/dev/main.tf` | Add Lambda module |

---

## Implementation Order

1. **Database** - Migration + models (required first)
2. **Heartbeat** - API endpoint + entrypoint changes
3. **Orchestrator** - Context capture + run recording
4. **API Endpoints** - Retry, cancel, runs, watcher status
5. **Watcher Lambda** - Create + deploy
6. **Frontend UI** - Control Center enhancements
7. **CLI** - Timeout/watch options
8. **Testing** - E2E test retry flow

---

## Success Criteria

- [ ] Failed tasks auto-retry with exponential backoff (60s, 2m, 4m, 8m...)
- [ ] Previous run context visible in retry instructions
- [ ] Stuck tasks (no heartbeat 15+ min) automatically killed and retried
- [ ] Loop detection stops infinite failure cycles
- [ ] 4-hour global timeout prevents runaway costs
- [ ] Control Center shows task history with all run attempts
- [ ] Retry/Cancel buttons work from UI
- [ ] CLI can watch indefinitely without timeout

---

## Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| Watcher Lambda (5-min interval) | ~$1 |
| CloudWatch Logs | ~$2 |
| Additional ECS time (retries) | Variable |
| **Total overhead** | ~$3-5/month |

---

## References

- Current AI Workers system: `docs/AI_WORKERS.md`
- Super Admin Control Center: `frontend/src/pages/SuperAdminControlCenter.tsx`
- AI Worker Task model: `backend/src/shared/models/AIWorkerTask.ts`
- ECS Task Runner: `backend/src/shared/services/ecs-task-runner.ts`
