-- Add manager review decision and quality score fields
-- Migration: 057_add_manager_review_fields.sql

-- Add review decision field (approved, revision_needed, rejected)
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS review_decision VARCHAR(50);

-- Add code quality score field (1-10)
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS code_quality_score INTEGER;

-- Add comments
COMMENT ON COLUMN ai_worker_tasks.review_decision IS 'Manager review decision: approved, revision_needed, rejected';
COMMENT ON COLUMN ai_worker_tasks.code_quality_score IS 'Code quality score from manager (1-10)';
