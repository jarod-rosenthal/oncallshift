-- Migration: Fix FK constraint on ai_worker_tasks.assigned_worker_id
-- When deleting an AIWorkerInstance, set the assigned_worker_id to NULL instead of blocking

-- Drop the existing FK constraint
ALTER TABLE ai_worker_tasks
DROP CONSTRAINT IF EXISTS "FK_c51577af6018a26752a5b4db476";

-- Re-create with ON DELETE SET NULL
ALTER TABLE ai_worker_tasks
ADD CONSTRAINT "FK_c51577af6018a26752a5b4db476"
FOREIGN KEY (assigned_worker_id)
REFERENCES ai_worker_instances(id)
ON DELETE SET NULL;
