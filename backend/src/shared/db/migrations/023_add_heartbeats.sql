-- Migration: Create heartbeats table for monitoring service health via periodic pings
-- Similar to Opsgenie Heartbeat functionality

CREATE TABLE IF NOT EXISTS heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    heartbeat_key VARCHAR(255) NOT NULL UNIQUE,
    interval_seconds INT NOT NULL DEFAULT 300,
    alert_after_missed_count INT NOT NULL DEFAULT 1,
    last_ping_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'unknown',
    missed_count INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    active_incident_id UUID,
    external_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_heartbeats_org_id ON heartbeats(org_id);
CREATE INDEX idx_heartbeats_service_id ON heartbeats(service_id);
CREATE INDEX idx_heartbeats_heartbeat_key ON heartbeats(heartbeat_key);
CREATE INDEX idx_heartbeats_status ON heartbeats(status);
CREATE INDEX idx_heartbeats_enabled ON heartbeats(enabled);
CREATE INDEX idx_heartbeats_external_id ON heartbeats(external_id);

-- Constraint for valid status values
ALTER TABLE heartbeats
    ADD CONSTRAINT check_heartbeat_status
    CHECK (status IN ('healthy', 'unhealthy', 'expired', 'unknown'));

-- Constraint for positive interval
ALTER TABLE heartbeats
    ADD CONSTRAINT check_heartbeat_interval_positive
    CHECK (interval_seconds > 0);

-- Constraint for positive alert threshold
ALTER TABLE heartbeats
    ADD CONSTRAINT check_heartbeat_alert_threshold_positive
    CHECK (alert_after_missed_count > 0);

COMMENT ON TABLE heartbeats IS 'Heartbeat monitors for service health via periodic pings';
COMMENT ON COLUMN heartbeats.heartbeat_key IS 'Unique key for pinging this heartbeat (format: hb_<uuid>)';
COMMENT ON COLUMN heartbeats.interval_seconds IS 'Expected interval between pings in seconds';
COMMENT ON COLUMN heartbeats.alert_after_missed_count IS 'Number of missed intervals before triggering an incident';
COMMENT ON COLUMN heartbeats.status IS 'Current status: healthy, unhealthy, expired, or unknown';
COMMENT ON COLUMN heartbeats.active_incident_id IS 'ID of incident created when heartbeat expired (cleared on recovery)';
COMMENT ON COLUMN heartbeats.external_id IS 'External ID from Opsgenie for import tracking';
