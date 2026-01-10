-- Fix the unique active task index to exclude waiting states (pr_created, manager_review, review_pending)
-- These states represent tasks that are waiting for human action, not actively executing
-- A new task should be allowed even if another task for the same Jira issue is waiting

-- Drop the old index
DROP INDEX CONCURRENTLY IF EXISTS idx_unique_active_task_per_jira_issue;

-- Create new index excluding waiting states
CREATE UNIQUE INDEX CONCURRENTLY idx_unique_active_task_per_jira_issue
ON ai_worker_tasks (org_id, jira_issue_key)
WHERE status IN ('queued', 'claimed', 'environment_setup', 'executing', 'revision_needed', 'deployment_pending', 'deploying', 'deployed_validating');

-- Update comment explaining the constraint
COMMENT ON INDEX idx_unique_active_task_per_jira_issue IS
'Ensures only one active AI worker task exists per Jira issue. Excludes waiting states (pr_created, manager_review, review_pending) to allow new tasks when previous task is waiting for human action. Does not prevent multiple completed/failed tasks for the same issue.';
