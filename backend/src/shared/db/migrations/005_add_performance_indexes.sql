-- Migration: Add webhook secret and performance indexes
-- Production hardening for API security and query performance

-- Add webhook_secret column to services table for HMAC-SHA256 signature verification
ALTER TABLE services ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255);

-- Performance indexes for common queries

-- Index on incidents for dashboard/list queries (org + state + time ordering)
-- Covers: GET /incidents?state=triggered, incident dashboards, on-call views
CREATE INDEX IF NOT EXISTS idx_incidents_org_state_triggered
  ON incidents(org_id, state, triggered_at DESC);

-- Index on notifications for incident detail queries and delivery tracking
-- Covers: GET /incidents/:id (with notifications), notification retry logic
CREATE INDEX IF NOT EXISTS idx_notifications_incident_status
  ON notifications(incident_id, status);

-- Additional useful indexes for common access patterns

-- Index for dedup key lookups (used on every incoming alert)
CREATE INDEX IF NOT EXISTS idx_incidents_dedup_key
  ON incidents(service_id, dedup_key)
  WHERE dedup_key IS NOT NULL AND state != 'resolved';

-- Index for escalation processing (finding incidents needing escalation)
CREATE INDEX IF NOT EXISTS idx_incidents_escalation
  ON incidents(state, escalation_started_at)
  WHERE state = 'triggered' AND escalation_started_at IS NOT NULL;
