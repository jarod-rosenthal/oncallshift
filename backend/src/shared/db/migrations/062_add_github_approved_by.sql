-- Add github_approved_by column to track who approved PRs
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS github_approved_by VARCHAR(100);

COMMENT ON COLUMN ai_worker_tasks.github_approved_by IS 'GitHub username who approved the PR (bot-oncallshift for manager, human username otherwise)';
