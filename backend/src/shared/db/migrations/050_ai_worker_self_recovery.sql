-- AI Worker Self-Recovery System
-- Adds heartbeat tracking, context passing, and run history for auto-retry

-- Add new columns to ai_worker_tasks for self-recovery
ALTER TABLE ai_worker_tasks
    ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS previous_run_context TEXT,
    ADD COLUMN IF NOT EXISTS global_timeout_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS retry_backoff_seconds INTEGER DEFAULT 60,
    ADD COLUMN IF NOT EXISTS failure_category VARCHAR(50),
    ADD COLUMN IF NOT EXISTS watcher_notes TEXT;

-- Create ai_worker_task_runs table to track each execution attempt
CREATE TABLE ai_worker_task_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES ai_worker_tasks(id) ON DELETE CASCADE,
    run_number INTEGER NOT NULL,
    outcome VARCHAR(30) NOT NULL, -- 'success', 'failed', 'timeout', 'killed', 'cancelled'
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    error_message TEXT,
    error_category VARCHAR(50),
    captured_context TEXT, -- State captured at end of run for next retry
    -- ECS task tracking for this run
    ecs_task_arn VARCHAR(500),
    ecs_task_id VARCHAR(100),
    -- Cost tracking for this run
    claude_input_tokens INTEGER NOT NULL DEFAULT 0,
    claude_output_tokens INTEGER NOT NULL DEFAULT 0,
    ecs_task_seconds INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,
    -- Files modified during this run
    files_modified JSONB DEFAULT '[]',
    -- Git state at end of run
    git_branch VARCHAR(255),
    git_commit_sha VARCHAR(40),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ai_worker_task_runs
CREATE INDEX idx_ai_worker_task_runs_task ON ai_worker_task_runs(task_id);
CREATE INDEX idx_ai_worker_task_runs_outcome ON ai_worker_task_runs(outcome);
CREATE INDEX idx_ai_worker_task_runs_started ON ai_worker_task_runs(started_at);
CREATE UNIQUE INDEX idx_ai_worker_task_runs_task_run_number ON ai_worker_task_runs(task_id, run_number);

-- Index for watcher queries - find stuck tasks
CREATE INDEX idx_ai_worker_tasks_heartbeat ON ai_worker_tasks(last_heartbeat_at)
    WHERE status IN ('executing', 'environment_setup');

-- Index for retry queue processing
CREATE INDEX idx_ai_worker_tasks_next_retry ON ai_worker_tasks(next_retry_at)
    WHERE next_retry_at IS NOT NULL AND status IN ('failed', 'blocked');

-- Index for global timeout detection
CREATE INDEX idx_ai_worker_tasks_global_timeout ON ai_worker_tasks(global_timeout_at)
    WHERE global_timeout_at IS NOT NULL AND status NOT IN ('completed', 'failed', 'cancelled');

-- Add comment describing the self-recovery system
COMMENT ON COLUMN ai_worker_tasks.last_heartbeat_at IS 'Last heartbeat from running task. Used for stuck detection (>15 min = stuck)';
COMMENT ON COLUMN ai_worker_tasks.previous_run_context IS 'Context from previous failed run to pass to next retry';
COMMENT ON COLUMN ai_worker_tasks.global_timeout_at IS '4-hour absolute deadline across all retry attempts';
COMMENT ON COLUMN ai_worker_tasks.next_retry_at IS 'Scheduled time for next retry attempt';
COMMENT ON COLUMN ai_worker_tasks.retry_backoff_seconds IS 'Current backoff delay in seconds (doubles each retry, max 1hr)';
COMMENT ON COLUMN ai_worker_tasks.failure_category IS 'Categorized failure: timeout, git_error, test_failure, build_error, etc.';
COMMENT ON COLUMN ai_worker_tasks.watcher_notes IS 'Notes from watcher Lambda interventions';
COMMENT ON TABLE ai_worker_task_runs IS 'Tracks individual execution attempts for each task';
