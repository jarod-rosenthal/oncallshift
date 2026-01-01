-- Migration: Add Conference Bridges for Incident Coordination
-- Enables auto-provisioning of Zoom/Meet/Teams meetings for incidents

CREATE TABLE IF NOT EXISTS conference_bridges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    meeting_url VARCHAR(500) NOT NULL,
    meeting_id VARCHAR(100),
    passcode VARCHAR(50),
    dial_in_number VARCHAR(50),
    dial_in_pin VARCHAR(20),
    provider_data JSONB,
    created_by UUID NOT NULL REFERENCES users(id),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    participant_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conference_bridges_incident ON conference_bridges(incident_id);
CREATE INDEX IF NOT EXISTS idx_conference_bridges_org ON conference_bridges(org_id);
CREATE INDEX IF NOT EXISTS idx_conference_bridges_status ON conference_bridges(status) WHERE status = 'active';

-- Constraints
ALTER TABLE conference_bridges DROP CONSTRAINT IF EXISTS check_bridge_provider;
ALTER TABLE conference_bridges ADD CONSTRAINT check_bridge_provider
    CHECK (provider IN ('zoom', 'google_meet', 'microsoft_teams', 'manual'));

ALTER TABLE conference_bridges DROP CONSTRAINT IF EXISTS check_bridge_status;
ALTER TABLE conference_bridges ADD CONSTRAINT check_bridge_status
    CHECK (status IN ('creating', 'active', 'ended', 'failed'));

-- Add conference bridge settings to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS conference_bridge_settings JSONB DEFAULT '{}'::jsonb;

-- Comments
COMMENT ON TABLE conference_bridges IS 'Conference bridges for incident coordination calls';
COMMENT ON COLUMN conference_bridges.provider IS 'Meeting provider: zoom, google_meet, microsoft_teams, or manual';
COMMENT ON COLUMN conference_bridges.provider_data IS 'Provider-specific data like host key, start URL, etc.';
COMMENT ON COLUMN organizations.conference_bridge_settings IS 'Default conference bridge provider and credentials';
