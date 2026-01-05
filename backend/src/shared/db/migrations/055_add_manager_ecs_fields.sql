-- Migration: 055_add_manager_ecs_fields
-- Description: Add ECS task tracking fields for Manager (runs in ECS like workers)
-- The Manager Lambda now triggers an ECS container instead of doing work inline.

-- Add Manager ECS task tracking columns
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS manager_ecs_task_arn VARCHAR(500),
ADD COLUMN IF NOT EXISTS manager_ecs_task_id VARCHAR(100);

-- Add index for querying tasks by Manager ECS task
CREATE INDEX IF NOT EXISTS idx_ai_worker_tasks_manager_ecs
ON ai_worker_tasks(manager_ecs_task_id)
WHERE manager_ecs_task_id IS NOT NULL;

-- Add comment explaining the fields
COMMENT ON COLUMN ai_worker_tasks.manager_ecs_task_arn IS 'ARN of the ECS task running the Virtual Manager for this task';
COMMENT ON COLUMN ai_worker_tasks.manager_ecs_task_id IS 'Short ID of the Manager ECS task (for log queries)';
