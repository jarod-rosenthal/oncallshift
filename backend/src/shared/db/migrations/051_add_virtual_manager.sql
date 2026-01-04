-- Migration: Add Virtual Manager for automated PR review
-- The Virtual Manager uses Opus 4.5 to review PRs created by workers (Sonnet)

-- Add new task statuses for manager review workflow
-- Note: Status is varchar so no enum change needed, just document new values:
-- 'manager_review' - Awaiting automated manager review
-- 'revision_needed' - Manager requested changes, worker will pick back up

-- Add manager-related fields to ai_worker_tasks
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS reviewer_manager_id UUID,
ADD COLUMN IF NOT EXISTS review_feedback TEXT,
ADD COLUMN IF NOT EXISTS revision_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS worker_model VARCHAR(50) DEFAULT 'claude-sonnet-4-20250514',
ADD COLUMN IF NOT EXISTS manager_review_model VARCHAR(50);

-- Add role to ai_worker_instances to distinguish workers from managers
ALTER TABLE ai_worker_instances
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'worker',
ADD COLUMN IF NOT EXISTS model_id VARCHAR(100) DEFAULT 'claude-sonnet-4-20250514',
ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS approvals_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS rejections_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS revisions_requested_count INT DEFAULT 0;

-- Create ai_worker_reviews table to track review history
CREATE TABLE IF NOT EXISTS ai_worker_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ai_worker_tasks(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES ai_worker_instances(id) ON DELETE SET NULL,

  -- Review details
  review_number INT NOT NULL DEFAULT 1,
  decision VARCHAR(30) NOT NULL, -- 'approved', 'rejected', 'revision_needed'
  feedback TEXT,

  -- What was reviewed
  pr_url VARCHAR(500),
  pr_diff_summary TEXT,
  files_reviewed JSONB DEFAULT '[]',

  -- AI analysis
  code_quality_score INT, -- 1-10
  test_coverage_assessment TEXT,
  security_concerns TEXT,
  style_issues TEXT,

  -- Tokens and cost
  claude_input_tokens INT DEFAULT 0,
  claude_output_tokens INT DEFAULT 0,
  estimated_cost_usd DECIMAL(10, 4) DEFAULT 0,

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key for reviewer
ALTER TABLE ai_worker_tasks
ADD CONSTRAINT fk_reviewer_manager
FOREIGN KEY (reviewer_manager_id) REFERENCES ai_worker_instances(id) ON DELETE SET NULL;

-- Indexes for manager review queries
CREATE INDEX IF NOT EXISTS idx_ai_worker_tasks_manager_review
ON ai_worker_tasks(status) WHERE status = 'manager_review';

CREATE INDEX IF NOT EXISTS idx_ai_worker_tasks_reviewer
ON ai_worker_tasks(reviewer_manager_id) WHERE reviewer_manager_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_worker_reviews_task
ON ai_worker_reviews(task_id);

CREATE INDEX IF NOT EXISTS idx_ai_worker_reviews_manager
ON ai_worker_reviews(manager_id);

CREATE INDEX IF NOT EXISTS idx_ai_worker_instances_role
ON ai_worker_instances(role);

-- Add comment explaining the workflow
COMMENT ON TABLE ai_worker_reviews IS 'Tracks automated PR reviews by Virtual Manager (Opus 4.5). Each review results in approve/reject/revision_needed decision.';

COMMENT ON COLUMN ai_worker_tasks.worker_model IS 'Claude model used by worker (default: sonnet). Workers use cheaper models for task execution.';
COMMENT ON COLUMN ai_worker_tasks.manager_review_model IS 'Claude model used for PR review (Opus 4.5). Set when review begins.';
COMMENT ON COLUMN ai_worker_tasks.revision_count IS 'Number of times this task was sent back for revisions by the manager.';
COMMENT ON COLUMN ai_worker_instances.role IS 'Instance role: worker (executes tasks) or manager (reviews PRs)';
