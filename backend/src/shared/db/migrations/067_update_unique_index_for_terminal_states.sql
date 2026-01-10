-- Update unique active task index to exclude new terminal states
-- review_requested and pr_merged are terminal states that should allow new tasks
-- pr_approved is included since it will be requeued for deployment

-- Drop the old index
DROP INDEX CONCURRENTLY IF EXISTS idx_unique_active_task_per_jira_issue;

-- Create new index excluding terminal states
CREATE UNIQUE INDEX CONCURRENTLY idx_unique_active_task_per_jira_issue
ON ai_worker_tasks (org_id, jira_issue_key)
WHERE status IN (
  'queued',
  'dispatching',
  'claimed',
  'environment_setup',
  'executing',
  'revision_needed',
  'deployment_pending',
  'deploying',
  'deployed_validating',
  'pr_approved',             -- Included: About to be requeued for deployment
  'awaiting_destructive_approval'
);

-- review_requested and pr_merged are excluded (terminal states)
-- This allows new tasks even if previous task has risky PR waiting or was successfully merged

COMMENT ON INDEX idx_unique_active_task_per_jira_issue IS
'Ensures only one active AI worker task exists per Jira issue. Excludes terminal states (completed, review_requested, pr_merged, failed, etc.) to allow new tasks. Includes pr_approved since it will be requeued for deployment.';
