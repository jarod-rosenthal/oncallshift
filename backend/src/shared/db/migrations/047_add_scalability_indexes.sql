-- Migration: 047_add_scalability_indexes.sql
-- Adds indexes for common query patterns to support 100k+ users
-- Part of API Scalability Initiative - Phase 0 (Database Foundations)

-- ============================================
-- ALERTS - High-volume ingestion table
-- ============================================

-- Org-scoped alert listing
CREATE INDEX IF NOT EXISTS idx_alerts_org_created
    ON alerts(org_id, created_at DESC);

-- Service + status + dedup_key for alert correlation
CREATE INDEX IF NOT EXISTS idx_alerts_service_status_dedup
    ON alerts(service_id, status, dedup_key)
    WHERE dedup_key IS NOT NULL;

-- Alert grouping key lookups
CREATE INDEX IF NOT EXISTS idx_alerts_grouping_key
    ON alerts(service_id, grouping_key)
    WHERE grouping_key IS NOT NULL;

-- ============================================
-- INTEGRATION EVENTS - Webhook delivery tracking
-- ============================================

-- Org-scoped event listing
CREATE INDEX IF NOT EXISTS idx_integration_events_org_created
    ON integration_events(org_id, created_at DESC);

-- Integration + status for retry queries
CREATE INDEX IF NOT EXISTS idx_integration_events_integration_status
    ON integration_events(integration_id, status, created_at DESC);

-- Pending events for retry processing
CREATE INDEX IF NOT EXISTS idx_integration_events_pending
    ON integration_events(status, next_retry_at)
    WHERE status IN ('pending', 'retrying');

-- ============================================
-- CLOUD ACCESS LOGS - Audit trail
-- ============================================

-- Org-scoped access log listing
CREATE INDEX IF NOT EXISTS idx_cloud_access_logs_org_created
    ON cloud_access_logs(org_id, created_at DESC);

-- User-scoped access logs
CREATE INDEX IF NOT EXISTS idx_cloud_access_logs_user_created
    ON cloud_access_logs(user_id, created_at DESC);

-- ============================================
-- AI CONVERSATIONS - Chat history
-- ============================================

-- Org-scoped conversation listing
CREATE INDEX IF NOT EXISTS idx_ai_conversations_org_created
    ON ai_conversations(org_id, created_at DESC);

-- Incident-scoped conversations
CREATE INDEX IF NOT EXISTS idx_ai_conversations_incident
    ON ai_conversations(incident_id, created_at DESC)
    WHERE incident_id IS NOT NULL;

-- ============================================
-- RUNBOOK EXECUTIONS - Automation tracking
-- ============================================

-- Org-scoped execution listing
CREATE INDEX IF NOT EXISTS idx_runbook_executions_org_status
    ON runbook_executions(org_id, status, started_at DESC);

-- Incident-scoped executions
CREATE INDEX IF NOT EXISTS idx_runbook_executions_incident
    ON runbook_executions(incident_id, started_at DESC)
    WHERE incident_id IS NOT NULL;

-- Runbook-scoped executions
CREATE INDEX IF NOT EXISTS idx_runbook_executions_runbook
    ON runbook_executions(runbook_id, started_at DESC);

-- ============================================
-- WORKFLOW EXECUTIONS - Automation tracking
-- ============================================

-- Org-scoped workflow execution listing
CREATE INDEX IF NOT EXISTS idx_workflow_executions_org_created
    ON workflow_executions(org_id, created_at DESC);

-- Incident-scoped workflow executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_incident
    ON workflow_executions(incident_id, created_at DESC)
    WHERE incident_id IS NOT NULL;

-- ============================================
-- TEAM MEMBERSHIPS - Permission checks
-- ============================================

-- User's team memberships (for permission checks)
CREATE INDEX IF NOT EXISTS idx_team_memberships_user_team
    ON team_memberships(user_id, team_id);

-- Team's members (for listing)
CREATE INDEX IF NOT EXISTS idx_team_memberships_team_user
    ON team_memberships(team_id, user_id);

-- ============================================
-- SCHEDULE LAYERS - Schedule management
-- ============================================

-- Schedule-scoped layers
CREATE INDEX IF NOT EXISTS idx_schedule_layers_schedule_priority
    ON schedule_layers(schedule_id, priority);

-- ============================================
-- SCHEDULE OVERRIDES - Override lookups
-- ============================================

-- Active overrides for a schedule (time-based query)
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_active
    ON schedule_overrides(schedule_id, start_time, end_time);

-- ============================================
-- MAINTENANCE WINDOWS - Time-based queries
-- ============================================

-- Active maintenance windows
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_active
    ON maintenance_windows(service_id, start_time, end_time);

-- ============================================
-- HEARTBEATS - Monitoring check
-- ============================================

-- Overdue heartbeats (for alerting)
CREATE INDEX IF NOT EXISTS idx_heartbeats_overdue
    ON heartbeats(status, next_check_at)
    WHERE status = 'healthy';

-- Service-scoped heartbeats
CREATE INDEX IF NOT EXISTS idx_heartbeats_service
    ON heartbeats(service_id);

-- ============================================
-- INCIDENT SUBSCRIBERS - Notification targeting
-- ============================================

-- Incident subscribers lookup
CREATE INDEX IF NOT EXISTS idx_incident_subscribers_incident
    ON incident_subscribers(incident_id);

-- ============================================
-- POSTMORTEMS - Incident learning
-- ============================================

-- Org-scoped postmortem listing
CREATE INDEX IF NOT EXISTS idx_postmortems_org_created
    ON postmortems(org_id, created_at DESC);

-- Incident-scoped postmortem
CREATE INDEX IF NOT EXISTS idx_postmortems_incident
    ON postmortems(incident_id);

-- ============================================
-- CHANGE EVENTS - Change tracking
-- ============================================

-- Service-scoped change events
CREATE INDEX IF NOT EXISTS idx_change_events_service_created
    ON change_events(service_id, created_at DESC);

-- Org-scoped change events
CREATE INDEX IF NOT EXISTS idx_change_events_org_created
    ON change_events(org_id, created_at DESC);

-- ============================================
-- ONBOARDING SESSIONS - Setup wizard tracking
-- ============================================

-- Org-scoped onboarding sessions
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_org
    ON onboarding_sessions(org_id, created_at DESC);

-- Comments for documentation
COMMENT ON INDEX idx_alerts_service_status_dedup IS 'Alert deduplication lookup index';
COMMENT ON INDEX idx_integration_events_pending IS 'Pending webhook events for retry processing';
COMMENT ON INDEX idx_heartbeats_overdue IS 'Overdue heartbeat detection for alerting';
