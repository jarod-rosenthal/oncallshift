-- Migration: 052_add_doe_fields.sql
-- Add fields for DOE (Directive-Orchestration-Execution) framework

-- Add skip_manager_review to tasks (default true = skip manager review)
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS skip_manager_review BOOLEAN DEFAULT TRUE;

-- Add self_anneal_count to track self-healing improvements per task
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS self_anneal_count INTEGER DEFAULT 0;

-- Track self-annealing improvements made by AI workers
CREATE TABLE IF NOT EXISTS ai_worker_improvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES ai_worker_tasks(id) ON DELETE SET NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  improvement_type VARCHAR(50) NOT NULL, -- 'script_fix', 'directive_update', 'error_handling'
  file_path TEXT NOT NULL,
  description TEXT NOT NULL,
  original_error TEXT,
  fix_applied TEXT,
  branch_name VARCHAR(255),
  pr_url VARCHAR(500),
  pr_merged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for finding improvements by task
CREATE INDEX IF NOT EXISTS idx_ai_worker_improvements_task_id ON ai_worker_improvements(task_id);

-- Index for finding improvements by org
CREATE INDEX IF NOT EXISTS idx_ai_worker_improvements_org_id ON ai_worker_improvements(org_id);

-- Index for finding unmerged improvement PRs
CREATE INDEX IF NOT EXISTS idx_ai_worker_improvements_unmerged ON ai_worker_improvements(pr_merged) WHERE pr_merged = FALSE;

COMMENT ON TABLE ai_worker_improvements IS 'Tracks self-annealing improvements made by AI workers to scripts and directives';
COMMENT ON COLUMN ai_worker_tasks.skip_manager_review IS 'When true (default), skip Virtual Manager review and go directly to review_approved';
COMMENT ON COLUMN ai_worker_tasks.self_anneal_count IS 'Number of self-annealing improvements made during this task';
