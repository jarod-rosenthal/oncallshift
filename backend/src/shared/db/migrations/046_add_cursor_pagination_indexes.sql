-- Migration: 046_add_cursor_pagination_indexes.sql
-- Adds composite indexes for stable cursor-based pagination across major tables
-- Part of API Scalability Initiative - Phase 0 (Database Foundations)
--
-- Cursor pagination pattern: ORDER BY (sort_field DESC, id DESC)
-- Index pattern: (org_id, sort_field DESC, id DESC)
-- This enables efficient cursor seeking without offset-based scanning

-- ============================================
-- INCIDENTS - Primary high-volume table
-- ============================================

-- Cursor pagination for incidents (triggered_at is primary sort)
CREATE INDEX IF NOT EXISTS idx_incidents_org_triggered_id
    ON incidents(org_id, triggered_at DESC, id DESC);

-- Cursor pagination for incidents by created_at
CREATE INDEX IF NOT EXISTS idx_incidents_org_created_id
    ON incidents(org_id, created_at DESC, id DESC);

-- Filtering + pagination: state and severity are most common filters
CREATE INDEX IF NOT EXISTS idx_incidents_org_state_triggered
    ON incidents(org_id, state, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_org_severity_triggered
    ON incidents(org_id, severity, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_org_state_severity_triggered
    ON incidents(org_id, state, severity, triggered_at DESC);

-- Service-scoped incidents (common for service detail pages)
CREATE INDEX IF NOT EXISTS idx_incidents_service_triggered
    ON incidents(service_id, triggered_at DESC);

-- ============================================
-- USERS - Often paginated for team management
-- ============================================

-- Cursor pagination for users
CREATE INDEX IF NOT EXISTS idx_users_org_created_id
    ON users(org_id, created_at DESC, id DESC);

-- Filtering by status and role
CREATE INDEX IF NOT EXISTS idx_users_org_status_role
    ON users(org_id, status, role);

-- Name-based sorting (common for UI)
CREATE INDEX IF NOT EXISTS idx_users_org_name
    ON users(org_id, full_name);

-- ============================================
-- SERVICES - Core entity with frequent listing
-- ============================================

-- Cursor pagination for services
CREATE INDEX IF NOT EXISTS idx_services_org_created_id
    ON services(org_id, created_at DESC, id DESC);

-- Filtering by status
CREATE INDEX IF NOT EXISTS idx_services_org_status_name
    ON services(org_id, status, name);

-- Name-based sorting (common for UI)
CREATE INDEX IF NOT EXISTS idx_services_org_name
    ON services(org_id, name);

-- ============================================
-- TEAMS - Team management listing
-- ============================================

-- Cursor pagination for teams
CREATE INDEX IF NOT EXISTS idx_teams_org_created_id
    ON teams(org_id, created_at DESC, id DESC);

-- Name-based sorting
CREATE INDEX IF NOT EXISTS idx_teams_org_name
    ON teams(org_id, name);

-- ============================================
-- SCHEDULES - Schedule management
-- ============================================

-- Cursor pagination for schedules
CREATE INDEX IF NOT EXISTS idx_schedules_org_created_id
    ON schedules(org_id, created_at DESC, id DESC);

-- Name-based sorting
CREATE INDEX IF NOT EXISTS idx_schedules_org_name
    ON schedules(org_id, name);

-- ============================================
-- NOTIFICATIONS - High-volume table
-- ============================================

-- Cursor pagination for notifications (created in migration 044)
CREATE INDEX IF NOT EXISTS idx_notifications_org_created_id
    ON notifications(org_id, created_at DESC, id DESC);

-- ============================================
-- ESCALATION POLICIES
-- ============================================

-- Cursor pagination for escalation policies
CREATE INDEX IF NOT EXISTS idx_escalation_policies_org_created_id
    ON escalation_policies(org_id, created_at DESC, id DESC);

-- Name-based sorting
CREATE INDEX IF NOT EXISTS idx_escalation_policies_org_name
    ON escalation_policies(org_id, name);

-- ============================================
-- RUNBOOKS
-- ============================================

-- Cursor pagination for runbooks
CREATE INDEX IF NOT EXISTS idx_runbooks_org_created_id
    ON runbooks(org_id, created_at DESC, id DESC);

-- Title-based sorting
CREATE INDEX IF NOT EXISTS idx_runbooks_org_title
    ON runbooks(org_id, title);

-- Service-scoped runbooks
CREATE INDEX IF NOT EXISTS idx_runbooks_service_id
    ON runbooks(service_id) WHERE service_id IS NOT NULL;

-- ============================================
-- INTEGRATIONS
-- ============================================

-- Cursor pagination for integrations
CREATE INDEX IF NOT EXISTS idx_integrations_org_created_id
    ON integrations(org_id, created_at DESC, id DESC);

-- Service-scoped integrations
CREATE INDEX IF NOT EXISTS idx_integrations_service_type
    ON integrations(service_id, type);

-- ============================================
-- API KEYS
-- ============================================

-- Cursor pagination for API keys
CREATE INDEX IF NOT EXISTS idx_organization_api_keys_org_created_id
    ON organization_api_keys(org_id, created_at DESC, id DESC);

-- Comments for documentation
COMMENT ON INDEX idx_incidents_org_triggered_id IS 'Cursor pagination for incidents ordered by triggered_at';
COMMENT ON INDEX idx_users_org_created_id IS 'Cursor pagination for users ordered by created_at';
COMMENT ON INDEX idx_services_org_created_id IS 'Cursor pagination for services ordered by created_at';
