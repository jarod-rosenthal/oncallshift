-- Migration: Add external_keys to services for zero-config migration
-- Allows preserving original PagerDuty/Opsgenie integration keys so existing
-- monitoring tools can send webhooks without reconfiguration.

-- Add external_keys JSONB column
ALTER TABLE services ADD COLUMN IF NOT EXISTS external_keys JSONB;

-- Create index for looking up services by external PagerDuty key
CREATE INDEX IF NOT EXISTS idx_services_external_pagerduty_key
ON services USING GIN ((external_keys->'pagerduty'));

-- Create index for looking up services by external Opsgenie key
CREATE INDEX IF NOT EXISTS idx_services_external_opsgenie_key
ON services USING GIN ((external_keys->'opsgenie'));

-- Add comment explaining the field
COMMENT ON COLUMN services.external_keys IS 'Original integration keys from PagerDuty/Opsgenie for zero-config migration. Format: {"pagerduty": "key", "opsgenie": "key"}';
