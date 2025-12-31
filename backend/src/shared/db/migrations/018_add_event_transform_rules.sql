-- Migration: Add Event Transform Rules
-- Description: Service-level event transformation and enrichment rules

-- Event Transform Rules table
-- Allows services to transform, enrich, and filter incoming events before creating incidents
CREATE TABLE IF NOT EXISTS event_transform_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Rule ordering (processed in order)
    rule_order INT NOT NULL DEFAULT 0,

    -- Whether the rule is active
    enabled BOOLEAN NOT NULL DEFAULT true,

    -- Conditions to match (JSONB array of condition objects)
    -- Example: [{"field": "summary", "operator": "contains", "value": "error"}]
    conditions JSONB NOT NULL DEFAULT '[]',

    -- How conditions are matched: 'all' (AND) or 'any' (OR)
    match_type VARCHAR(10) NOT NULL DEFAULT 'all' CHECK (match_type IN ('all', 'any')),

    -- Transformations to apply (JSONB array of transformation objects)
    -- Types: set_field, copy_field, regex_replace, append, prepend, extract, delete_field, enrich
    -- Example: [
    --   {"type": "set_field", "field": "severity", "value": "critical"},
    --   {"type": "regex_replace", "field": "summary", "pattern": "ERROR:", "replacement": "[ERROR]"},
    --   {"type": "extract", "field": "details.host", "source": "summary", "pattern": "host=(\\w+)"}
    -- ]
    transformations JSONB NOT NULL DEFAULT '[]',

    -- Action after transformation
    -- 'continue' - process event normally
    -- 'suppress' - drop the event
    -- 'route' - route to a different service
    action VARCHAR(20) NOT NULL DEFAULT 'continue' CHECK (action IN ('continue', 'suppress', 'route')),

    -- If action is 'route', the target service
    route_to_service_id UUID REFERENCES services(id) ON DELETE SET NULL,

    -- Statistics
    events_matched INT NOT NULL DEFAULT 0,
    last_matched_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique rule order per service
    CONSTRAINT unique_rule_order_per_service UNIQUE (service_id, rule_order)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_transform_rules_org_id ON event_transform_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_event_transform_rules_service_id ON event_transform_rules(service_id);
CREATE INDEX IF NOT EXISTS idx_event_transform_rules_enabled ON event_transform_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_event_transform_rules_order ON event_transform_rules(service_id, rule_order);

-- Apply trigger for updated_at
DROP TRIGGER IF EXISTS update_event_transform_rules_updated_at ON event_transform_rules;
CREATE TRIGGER update_event_transform_rules_updated_at
    BEFORE UPDATE ON event_transform_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Example transformations:
--
-- 1. Set severity based on content:
-- {
--   "name": "Set critical for database errors",
--   "conditions": [{"field": "summary", "operator": "contains", "value": "database"}],
--   "transformations": [{"type": "set_field", "field": "severity", "value": "critical"}]
-- }
--
-- 2. Extract host from summary:
-- {
--   "name": "Extract hostname",
--   "conditions": [],
--   "transformations": [{"type": "extract", "field": "details.host", "source": "summary", "pattern": "host=([\\w-]+)"}]
-- }
--
-- 3. Suppress noisy alerts:
-- {
--   "name": "Suppress health checks",
--   "conditions": [{"field": "source", "operator": "equals", "value": "health-check"}],
--   "action": "suppress"
-- }
--
-- 4. Route to different service:
-- {
--   "name": "Route billing alerts",
--   "conditions": [{"field": "details.component", "operator": "equals", "value": "billing"}],
--   "action": "route",
--   "route_to_service_id": "uuid-of-billing-service"
-- }
