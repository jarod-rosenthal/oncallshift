-- Migration: Add per-persona concurrency limiting fields
-- This supports limiting 1 active task per persona to prevent deploy conflicts

-- Add persona_wait_count column to track requeue attempts when slot is occupied
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS persona_wait_count INT DEFAULT 0;

-- Add composite index for efficient per-persona active task queries
-- This index speeds up the check: "is there already an active task for this persona?"
CREATE INDEX IF NOT EXISTS idx_ai_worker_tasks_persona_active
  ON ai_worker_tasks(org_id, worker_persona, status)
  WHERE status IN ('claimed', 'environment_setup', 'executing', 'pr_created', 'manager_review');

-- Also add a simple index on worker_persona for general queries
CREATE INDEX IF NOT EXISTS idx_ai_worker_tasks_persona
  ON ai_worker_tasks(worker_persona);
