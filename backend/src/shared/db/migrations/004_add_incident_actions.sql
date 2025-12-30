-- Migration: Add incident action fields for reassign, snooze, and assignment tracking
-- This enables Phase 1 escalation workflow features

-- Add assignment tracking
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES users(id);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;

-- Add snooze functionality
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMP;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS snoozed_by UUID REFERENCES users(id);

-- Add merged incident tracking (for future use)
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS merged_into_incident_id UUID REFERENCES incidents(id);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to ON incidents(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_snoozed ON incidents(snoozed_until) WHERE snoozed_until IS NOT NULL;

-- Create incident_responders table for add responders feature (Phase 2)
CREATE TABLE IF NOT EXISTS incident_responders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  UNIQUE(incident_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_incident_responders_incident ON incident_responders(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_responders_user ON incident_responders(user_id);
