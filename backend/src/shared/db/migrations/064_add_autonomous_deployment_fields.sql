-- Migration: Add autonomous deployment tracking fields
-- This supports AI workers autonomously deploying their changes and validating until successful

-- Add deployment configuration and tracking columns
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS deployment_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deploy_retry_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_deploy_retries INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS validation_attempt_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_validation_error TEXT,
ADD COLUMN IF NOT EXISTS last_deployment_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approval_reason TEXT;

-- Add comments for documentation
COMMENT ON COLUMN ai_worker_tasks.deployment_enabled IS 'Whether this task is allowed to autonomously deploy changes';
COMMENT ON COLUMN ai_worker_tasks.deploy_retry_count IS 'Number of deployment attempts made';
COMMENT ON COLUMN ai_worker_tasks.max_deploy_retries IS 'Maximum number of deployment retries allowed';
COMMENT ON COLUMN ai_worker_tasks.validation_attempt_count IS 'Number of validation attempts after deployment';
COMMENT ON COLUMN ai_worker_tasks.last_validation_error IS 'Most recent validation error message';
COMMENT ON COLUMN ai_worker_tasks.last_deployment_at IS 'Timestamp of last deployment attempt';
COMMENT ON COLUMN ai_worker_tasks.requires_approval IS 'Whether task requires human approval before deployment';
COMMENT ON COLUMN ai_worker_tasks.approval_reason IS 'Reason why human approval is required (e.g., destructive action detected)';

-- Add index for finding tasks ready for deployment
CREATE INDEX IF NOT EXISTS idx_ai_worker_tasks_deployment_pending
  ON ai_worker_tasks(org_id, status, deployment_enabled)
  WHERE status = 'deployment_pending' AND deployment_enabled = TRUE;

-- Add index for finding tasks in deployment/validation states
CREATE INDEX IF NOT EXISTS idx_ai_worker_tasks_deployment_states
  ON ai_worker_tasks(org_id, status)
  WHERE status IN ('deploying', 'deployed_validating', 'validation_failed', 'deployment_failed');
