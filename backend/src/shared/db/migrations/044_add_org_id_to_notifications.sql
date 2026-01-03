-- Migration: 044_add_org_id_to_notifications.sql
-- Adds org_id column to notifications table for multi-tenancy query performance
-- Part of API Scalability Initiative - Phase 0 (Database Foundations)

-- Add org_id column (initially nullable for data migration)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS org_id UUID;

-- Backfill org_id from incidents table
UPDATE notifications n
SET org_id = i.org_id
FROM incidents i
WHERE n.incident_id = i.id
  AND n.org_id IS NULL;

-- Make org_id NOT NULL after backfill
ALTER TABLE notifications ALTER COLUMN org_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE notifications
    ADD CONSTRAINT fk_notifications_org_id
    FOREIGN KEY (org_id)
    REFERENCES organizations(id)
    ON DELETE CASCADE;

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_notifications_org_id
    ON notifications(org_id);

-- Index for org + status + created_at (common filter pattern)
CREATE INDEX IF NOT EXISTS idx_notifications_org_status_created
    ON notifications(org_id, status, created_at DESC);

-- Index for org + user + status (user notification lookups)
CREATE INDEX IF NOT EXISTS idx_notifications_org_user_status
    ON notifications(org_id, user_id, status, created_at DESC);

-- Index for org + channel + status (channel-specific queries)
CREATE INDEX IF NOT EXISTS idx_notifications_org_channel_status
    ON notifications(org_id, channel, status);

-- Comments for documentation
COMMENT ON COLUMN notifications.org_id IS 'Denormalized org_id for efficient multi-tenant queries without joining incidents';
