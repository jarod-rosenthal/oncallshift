-- Migration: Add Alert Routing Rules
-- Description: Enables content-based routing of incoming alerts to services with optional severity override

-- Alert Routing Rules table
-- Evaluates incoming alerts and routes them to services based on conditions
CREATE TABLE IF NOT EXISTS alert_routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_order INTEGER NOT NULL DEFAULT 0, -- Lower = evaluated first
    enabled BOOLEAN DEFAULT TRUE,

    -- Matching configuration
    match_type VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (match_type IN ('all', 'any')), -- all=AND, any=OR
    conditions JSONB NOT NULL DEFAULT '[]', -- Array of condition objects

    -- Routing configuration
    target_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    set_severity VARCHAR(20) CHECK (set_severity IN ('info', 'warning', 'error', 'critical', NULL)),

    -- Metadata
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique order per org
    CONSTRAINT unique_rule_order_per_org UNIQUE (org_id, rule_order)
);

-- Indexes for routing rules
CREATE INDEX IF NOT EXISTS idx_alert_routing_rules_org_id ON alert_routing_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_alert_routing_rules_order ON alert_routing_rules(org_id, rule_order) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_alert_routing_rules_target ON alert_routing_rules(target_service_id);

-- Apply trigger for updated_at
DROP TRIGGER IF EXISTS update_alert_routing_rules_updated_at ON alert_routing_rules;
CREATE TRIGGER update_alert_routing_rules_updated_at
    BEFORE UPDATE ON alert_routing_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Example conditions structure:
-- [
--   { "field": "source", "operator": "equals", "value": "datadog" },
--   { "field": "summary", "operator": "contains", "value": "database" },
--   { "field": "severity", "operator": "in", "value": ["critical", "error"] },
--   { "field": "details.environment", "operator": "equals", "value": "production" }
-- ]
--
-- Supported operators:
-- - equals: exact match
-- - not_equals: not equal
-- - contains: substring match
-- - not_contains: does not contain substring
-- - starts_with: starts with string
-- - ends_with: ends with string
-- - regex: regular expression match
-- - in: value is in array
-- - not_in: value is not in array
-- - exists: field exists (value ignored)
-- - not_exists: field does not exist (value ignored)
