-- Add cache token tracking and worker model to AI worker task runs
-- This enables accurate cost calculation using the shared pricing config

ALTER TABLE ai_worker_task_runs
ADD COLUMN IF NOT EXISTS claude_cache_creation_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS claude_cache_read_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS worker_model VARCHAR(50) DEFAULT 'sonnet';

-- Create index for cost analysis queries by model
CREATE INDEX IF NOT EXISTS idx_ai_worker_task_runs_worker_model ON ai_worker_task_runs(worker_model);

COMMENT ON COLUMN ai_worker_task_runs.claude_cache_creation_tokens IS 'Tokens used for cache creation during this run';
COMMENT ON COLUMN ai_worker_task_runs.claude_cache_read_tokens IS 'Tokens read from cache during this run';
COMMENT ON COLUMN ai_worker_task_runs.worker_model IS 'Claude model used for this run (sonnet, opus, haiku)';
