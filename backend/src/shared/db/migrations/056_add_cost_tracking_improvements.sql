-- Cost Tracking Improvements
--
-- This migration adds:
-- 1. Cache token tracking for AI worker tasks (cacheCreation, cacheRead)
-- 2. Idempotency column to prevent double-reporting of usage
-- 3. Cumulative cost tracking at the organization level
-- 4. Model tracking for accurate cost calculation

-- Add cache token columns to ai_worker_tasks
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS claude_cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS claude_cache_read_tokens INTEGER NOT NULL DEFAULT 0;

-- Add idempotency column to prevent double-counting
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS usage_reported_at TIMESTAMP WITH TIME ZONE;

-- Add model column for accurate cost calculation (if not exists from earlier migration)
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS worker_model VARCHAR(100);

-- Add cumulative cost tracking to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS ai_worker_cumulative_cost DECIMAL(12, 4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_worker_cost_reset_at TIMESTAMP WITH TIME ZONE;

-- Add index for querying tasks without reported usage
CREATE INDEX IF NOT EXISTS idx_ai_worker_tasks_usage_unreported
ON ai_worker_tasks(org_id, created_at)
WHERE usage_reported_at IS NULL AND status IN ('completed', 'failed');

-- Comment for documentation
COMMENT ON COLUMN ai_worker_tasks.claude_cache_creation_tokens IS 'Tokens written to prompt cache (25% premium over input rate)';
COMMENT ON COLUMN ai_worker_tasks.claude_cache_read_tokens IS 'Tokens read from prompt cache (10% of input rate)';
COMMENT ON COLUMN ai_worker_tasks.usage_reported_at IS 'Timestamp when usage was reported (prevents double-counting)';
COMMENT ON COLUMN ai_worker_tasks.worker_model IS 'Claude model used (haiku, sonnet, opus) for accurate cost calculation';
COMMENT ON COLUMN organizations.ai_worker_cumulative_cost IS 'Running total of AI worker costs (manually resettable)';
COMMENT ON COLUMN organizations.ai_worker_cost_reset_at IS 'When the cumulative cost was last reset to zero';
