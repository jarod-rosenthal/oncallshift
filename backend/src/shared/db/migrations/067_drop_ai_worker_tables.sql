-- Drop AI Worker tables and related objects
-- These tables were part of the AI Workers Control Center feature which has been removed.

-- Drop tables in dependency order (children first)
DROP TABLE IF EXISTS ai_worker_pattern_applications CASCADE;
DROP TABLE IF EXISTS ai_worker_learning_sessions CASCADE;
DROP TABLE IF EXISTS ai_worker_tool_patterns CASCADE;
DROP TABLE IF EXISTS ai_worker_tool_events CASCADE;
DROP TABLE IF EXISTS ai_worker_reviews CASCADE;
DROP TABLE IF EXISTS ai_worker_task_runs CASCADE;
DROP TABLE IF EXISTS ai_worker_approvals CASCADE;
DROP TABLE IF EXISTS ai_worker_conversations CASCADE;
DROP TABLE IF EXISTS ai_worker_task_logs CASCADE;
DROP TABLE IF EXISTS ai_worker_tasks CASCADE;
DROP TABLE IF EXISTS ai_worker_instances CASCADE;

-- Remove the super_admin role value from users (revert to admin)
UPDATE users SET role = 'admin' WHERE role = 'super_admin';
