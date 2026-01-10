-- Prevent duplicate active tasks for the same Jira issue
-- This fixes the race condition where /trigger gets called twice in quick succession

-- Create a partial unique index that only enforces uniqueness for active tasks
-- This allows multiple completed/failed tasks for the same Jira issue
CREATE UNIQUE INDEX CONCURRENTLY idx_unique_active_task_per_jira_issue
ON ai_worker_tasks (org_id, jira_issue_key)
WHERE status IN ('queued', 'claimed', 'environment_setup', 'executing', 'pr_created', 'manager_review', 'revision_needed');

-- Comment explaining the constraint
COMMENT ON INDEX idx_unique_active_task_per_jira_issue IS
'Ensures only one active AI worker task exists per Jira issue. Prevents race conditions when /trigger is called multiple times. Does not prevent multiple completed/failed tasks for the same issue.';
