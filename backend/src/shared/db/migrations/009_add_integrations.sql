-- Migration: Add integrations framework
-- Tables for external integrations (Slack, Jira, Teams, etc.)

-- Integration types enum
DO $$ BEGIN
    CREATE TYPE integration_type AS ENUM (
        'slack',
        'teams',
        'jira',
        'servicenow',
        'webhook',
        'pagerduty_import'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Integration status enum
DO $$ BEGIN
    CREATE TYPE integration_status AS ENUM (
        'pending',
        'active',
        'error',
        'disabled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main integrations table
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type integration_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    status integration_status NOT NULL DEFAULT 'pending',

    -- Configuration (type-specific settings)
    config JSONB NOT NULL DEFAULT '{}',

    -- Slack-specific
    slack_workspace_id VARCHAR(50),
    slack_workspace_name VARCHAR(255),
    slack_bot_token_encrypted TEXT,
    slack_default_channel_id VARCHAR(50),

    -- Teams-specific
    teams_tenant_id VARCHAR(50),
    teams_team_id VARCHAR(50),
    teams_channel_id VARCHAR(50),

    -- Jira-specific
    jira_site_url VARCHAR(500),
    jira_project_key VARCHAR(20),
    jira_issue_type VARCHAR(50),

    -- ServiceNow-specific
    servicenow_instance_url VARCHAR(500),
    servicenow_table_name VARCHAR(100),

    -- Webhook-specific
    webhook_url VARCHAR(2000),
    webhook_secret VARCHAR(255),
    webhook_headers JSONB,

    -- Feature flags
    features JSONB NOT NULL DEFAULT '{}',
    -- Example: { "incident_sync": true, "bidirectional": false, "auto_create_channel": true }

    -- Error tracking
    last_error TEXT,
    last_error_at TIMESTAMP,
    error_count INTEGER DEFAULT 0,

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- OAuth tokens for integrations
CREATE TABLE IF NOT EXISTS integration_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,

    -- Token data (encrypted)
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',

    -- Token metadata
    scope TEXT,
    expires_at TIMESTAMP,

    -- Refresh tracking
    last_refreshed_at TIMESTAMP,
    refresh_error TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Integration events (audit log)
CREATE TABLE IF NOT EXISTS integration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Event details
    event_type VARCHAR(100) NOT NULL,
    -- Examples: 'incident.synced', 'channel.created', 'message.sent', 'error'

    direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
    -- 'inbound' = from external system, 'outbound' = to external system

    -- Related entities
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,

    -- Event data
    payload JSONB,
    response JSONB,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'success',
    -- 'success', 'failed', 'pending', 'retrying'

    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- External references
    external_id VARCHAR(255),
    external_url VARCHAR(2000),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Service-to-integration mappings (which services sync to which integrations)
CREATE TABLE IF NOT EXISTS service_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,

    -- Service-specific config overrides
    config_overrides JSONB DEFAULT '{}',
    -- Example: { "jira_project_key": "DIFFERENT_PROJECT", "slack_channel_id": "C123456" }

    enabled BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(service_id, integration_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);
CREATE INDEX IF NOT EXISTS idx_integrations_org_type ON integrations(org_id, type);

CREATE INDEX IF NOT EXISTS idx_integration_events_integration_id ON integration_events(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_org_id ON integration_events(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_incident_id ON integration_events(incident_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_created_at ON integration_events(created_at);
CREATE INDEX IF NOT EXISTS idx_integration_events_type_status ON integration_events(event_type, status);

CREATE INDEX IF NOT EXISTS idx_service_integrations_service_id ON service_integrations(service_id);
CREATE INDEX IF NOT EXISTS idx_service_integrations_integration_id ON service_integrations(integration_id);

CREATE INDEX IF NOT EXISTS idx_integration_oauth_tokens_integration_id ON integration_oauth_tokens(integration_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_integrations_updated_at ON integrations;
CREATE TRIGGER trigger_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_updated_at();

DROP TRIGGER IF EXISTS trigger_service_integrations_updated_at ON service_integrations;
CREATE TRIGGER trigger_service_integrations_updated_at
    BEFORE UPDATE ON service_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_updated_at();

DROP TRIGGER IF EXISTS trigger_integration_oauth_tokens_updated_at ON integration_oauth_tokens;
CREATE TRIGGER trigger_integration_oauth_tokens_updated_at
    BEFORE UPDATE ON integration_oauth_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_updated_at();
