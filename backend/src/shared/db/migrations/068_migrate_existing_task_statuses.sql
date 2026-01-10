-- Migrate existing tasks to new status values
-- This preserves the intent of each status while transitioning to the new terminal state model

-- 1. All pr_created tasks become review_requested (safest assumption - treat as risky)
--    Set completedAt if not already set to trigger 10-minute drop-off
UPDATE ai_worker_tasks
SET status = 'review_requested',
    completed_at = COALESCE(completed_at, updated_at)
WHERE status = 'pr_created'
  AND completed_at IS NULL;

-- 2. review_approved tasks that aren't merged yet → pr_approved (ready to requeue)
--    These were approved but deployment hasn't happened yet
UPDATE ai_worker_tasks
SET status = 'pr_approved'
WHERE status = 'review_approved'
  AND github_pr_number IS NOT NULL
  AND completed_at IS NULL;

-- 3. Completed tasks with merged PRs → pr_merged
--    These successfully deployed and merged
UPDATE ai_worker_tasks
SET status = 'pr_merged'
WHERE status = 'completed'
  AND github_pr_number IS NOT NULL
  AND completed_at IS NOT NULL;

-- 4. Tasks that were marked as completed without a PR remain 'completed'
--    These are "no code changes needed" tasks
-- (No UPDATE needed - already in correct state)

-- Log the migration counts for verification
DO $$
DECLARE
  review_requested_count INTEGER;
  pr_approved_count INTEGER;
  pr_merged_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO review_requested_count FROM ai_worker_tasks WHERE status = 'review_requested';
  SELECT COUNT(*) INTO pr_approved_count FROM ai_worker_tasks WHERE status = 'pr_approved';
  SELECT COUNT(*) INTO pr_merged_count FROM ai_worker_tasks WHERE status = 'pr_merged';

  RAISE NOTICE 'Migration 068 completed:';
  RAISE NOTICE '  review_requested tasks: %', review_requested_count;
  RAISE NOTICE '  pr_approved tasks: %', pr_approved_count;
  RAISE NOTICE '  pr_merged tasks: %', pr_merged_count;
END $$;
