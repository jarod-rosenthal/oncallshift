-- Migration: Add Webhook Subscriptions (PagerDuty v3 compatible)
-- Enables webhook delivery with HMAC signatures for incident and service events

-- Create webhook_subscriptions table
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    scope VARCHAR(50) NOT NULL,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    event_types TEXT NOT NULL, -- Comma-separated list (simple-array in TypeORM)
    url VARCHAR(1000) NOT NULL,
    description VARCHAR(500),
    enabled BOOLEAN DEFAULT true,
    secret VARCHAR(255) NOT NULL,
    delivery_timeout_seconds INT DEFAULT 10,
    max_retries INT DEFAULT 3,
    total_deliveries INT DEFAULT 0,
    successful_deliveries INT DEFAULT 0,
    failed_deliveries INT DEFAULT 0,
    last_delivery_at TIMESTAMP,
    last_delivery_status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_scope CHECK (scope IN ('organization', 'service', 'team')),
    CONSTRAINT check_service_scope CHECK (
        (scope = 'service' AND service_id IS NOT NULL) OR
        (scope != 'service' AND service_id IS NULL)
    ),
    CONSTRAINT check_team_scope CHECK (
        (scope = 'team' AND team_id IS NOT NULL) OR
        (scope != 'team' AND team_id IS NULL)
    )
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org_id ON webhook_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org_enabled ON webhook_subscriptions(org_id, enabled);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_service_id ON webhook_subscriptions(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_team_id ON webhook_subscriptions(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_scope ON webhook_subscriptions(org_id, scope);

-- Add comment for documentation
COMMENT ON TABLE webhook_subscriptions IS 'PagerDuty v3 compatible webhook subscriptions with HMAC signature support';
COMMENT ON COLUMN webhook_subscriptions.scope IS 'Subscription scope: organization (all events), service (service-specific), or team (team-specific)';
COMMENT ON COLUMN webhook_subscriptions.event_types IS 'Comma-separated list of event types to deliver (incident.triggered, incident.acknowledged, etc.)';
COMMENT ON COLUMN webhook_subscriptions.secret IS 'HMAC secret for x-pagerduty-signature header generation';
COMMENT ON COLUMN webhook_subscriptions.delivery_timeout_seconds IS 'HTTP timeout for webhook delivery in seconds';
COMMENT ON COLUMN webhook_subscriptions.max_retries IS 'Maximum number of delivery retry attempts with exponential backoff';
