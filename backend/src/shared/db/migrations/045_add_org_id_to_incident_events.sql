-- Migration: 045_add_org_id_to_incident_events.sql
-- Adds org_id column to incident_events table for multi-tenancy query performance
-- Part of API Scalability Initiative - Phase 0 (Database Foundations)

-- Add org_id column (initially nullable for data migration)
ALTER TABLE incident_events ADD COLUMN IF NOT EXISTS org_id UUID;

-- Backfill org_id from incidents table
UPDATE incident_events ie
SET org_id = i.org_id
FROM incidents i
WHERE ie.incident_id = i.id
  AND ie.org_id IS NULL;

-- Make org_id NOT NULL after backfill
ALTER TABLE incident_events ALTER COLUMN org_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE incident_events
    ADD CONSTRAINT fk_incident_events_org_id
    FOREIGN KEY (org_id)
    REFERENCES organizations(id)
    ON DELETE CASCADE;

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_incident_events_org_id
    ON incident_events(org_id);

-- Index for org + created_at (timeline queries)
CREATE INDEX IF NOT EXISTS idx_incident_events_org_created
    ON incident_events(org_id, created_at DESC);

-- Index for incident + created_at (incident timeline)
CREATE INDEX IF NOT EXISTS idx_incident_events_incident_created
    ON incident_events(incident_id, created_at DESC);

-- Index for org + type + created_at (event type filtering)
CREATE INDEX IF NOT EXISTS idx_incident_events_org_type_created
    ON incident_events(org_id, type, created_at DESC);

-- Composite index for cursor pagination
CREATE INDEX IF NOT EXISTS idx_incident_events_org_created_id
    ON incident_events(org_id, created_at DESC, id DESC);

-- Comments for documentation
COMMENT ON COLUMN incident_events.org_id IS 'Denormalized org_id for efficient multi-tenant queries without joining incidents';
