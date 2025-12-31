-- Migration: Add Alert Grouping & Deduplication
-- Description: Enables intelligent alert grouping and deduplication per service

-- Alert Grouping Rules table
-- Configures how alerts are grouped into incidents per service
CREATE TABLE IF NOT EXISTS alert_grouping_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

    -- Grouping configuration
    grouping_type VARCHAR(50) NOT NULL DEFAULT 'intelligent' CHECK (grouping_type IN ('intelligent', 'time', 'content', 'disabled')),
    -- intelligent: Group by similarity (default PagerDuty-style)
    -- time: Group alerts within time window
    -- content: Group by specific content fields
    -- disabled: Each alert creates a new incident

    time_window_minutes INTEGER NOT NULL DEFAULT 5,  -- Time window for grouping
    content_fields TEXT[] DEFAULT '{}',  -- Fields to use for content-based grouping (e.g., ['source', 'details.component'])

    -- Advanced settings
    dedup_key_template VARCHAR(500),  -- Template for generating dedup keys (e.g., '${source}-${details.host}')
    max_alerts_per_incident INTEGER DEFAULT 1000,  -- Max alerts to group into single incident

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- One grouping rule per service
    CONSTRAINT unique_grouping_rule_per_service UNIQUE (service_id)
);

-- Alerts table
-- Stores individual alerts that get grouped into incidents
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,

    -- Alert identification
    dedup_key VARCHAR(500),  -- Deduplication key
    alert_key VARCHAR(500),  -- Unique key for this specific alert

    -- Alert content
    summary VARCHAR(1000) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    source VARCHAR(255),  -- Source system (e.g., 'datadog', 'cloudwatch', 'custom')
    payload JSONB DEFAULT '{}',  -- Full alert payload

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'triggered' CHECK (status IN ('triggered', 'suppressed', 'grouped')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_org_id ON alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_alerts_service_id ON alerts(service_id);
CREATE INDEX IF NOT EXISTS idx_alerts_incident_id ON alerts(incident_id);
CREATE INDEX IF NOT EXISTS idx_alerts_dedup_key ON alerts(service_id, dedup_key) WHERE dedup_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

-- Apply triggers for updated_at
DROP TRIGGER IF EXISTS update_alert_grouping_rules_updated_at ON alert_grouping_rules;
CREATE TRIGGER update_alert_grouping_rules_updated_at
    BEFORE UPDATE ON alert_grouping_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Example grouping configurations:
--
-- 1. Intelligent (default PagerDuty-style):
--    grouping_type: 'intelligent'
--    time_window_minutes: 5
--    - Groups alerts with similar content within time window
--
-- 2. Time-based:
--    grouping_type: 'time'
--    time_window_minutes: 15
--    - Groups all alerts for a service within 15 minute windows
--
-- 3. Content-based:
--    grouping_type: 'content'
--    content_fields: ['source', 'details.host']
--    - Groups alerts with matching source and host values
--
-- 4. Disabled:
--    grouping_type: 'disabled'
--    - Each alert creates a new incident (no grouping)
