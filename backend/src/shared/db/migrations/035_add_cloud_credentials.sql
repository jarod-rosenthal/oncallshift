-- Migration: 035_add_cloud_credentials.sql
-- Cloud Credentials Integration for Claude Code Analysis

-- Cloud credentials table for storing encrypted cloud provider credentials
CREATE TABLE IF NOT EXISTS cloud_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Cloud provider
    provider VARCHAR(20) NOT NULL, -- 'aws', 'azure', 'gcp'
    name VARCHAR(255) NOT NULL, -- User-friendly name (e.g., "Production AWS Account")
    description TEXT,

    -- Credential data (encrypted with AES-256-GCM)
    credentials_encrypted TEXT NOT NULL, -- JSON encrypted with org-specific derived key

    -- Access control
    permission_level VARCHAR(20) DEFAULT 'read_only', -- 'read_only', 'read_write'
    allowed_services JSONB DEFAULT '[]'::jsonb, -- ['ec2', 'rds', 'logs'] or empty = all

    -- Time-based restrictions
    max_session_duration_minutes INT DEFAULT 60,
    require_approval_for_write BOOLEAN DEFAULT true,

    -- Audit trail
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_used_at TIMESTAMP,
    last_used_by UUID REFERENCES users(id) ON DELETE SET NULL,
    usage_count INT DEFAULT 0,

    -- Status
    enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique credential names per org and provider
    CONSTRAINT uq_cloud_credentials_org_provider_name UNIQUE(org_id, provider, name),

    -- Validate provider values
    CONSTRAINT chk_cloud_credentials_provider CHECK (provider IN ('aws', 'azure', 'gcp')),

    -- Validate permission level
    CONSTRAINT chk_cloud_credentials_permission CHECK (permission_level IN ('read_only', 'read_write'))
);

-- Audit log for Claude Code cloud access sessions
CREATE TABLE IF NOT EXISTS cloud_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    credential_id UUID NOT NULL REFERENCES cloud_credentials(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,

    -- Who triggered the access
    triggered_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

    -- What was accessed
    provider VARCHAR(20) NOT NULL,
    commands_executed JSONB DEFAULT '[]'::jsonb NOT NULL, -- Array of command objects

    -- Analysis results
    analysis_summary TEXT,
    root_cause TEXT,
    evidence JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,

    -- Results
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'analyzing', 'completed', 'failed'

    -- Timing
    session_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_ended_at TIMESTAMP,
    duration_seconds INT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cloud_credentials_org ON cloud_credentials(org_id, enabled);
CREATE INDEX IF NOT EXISTS idx_cloud_credentials_provider ON cloud_credentials(org_id, provider);
CREATE INDEX IF NOT EXISTS idx_cloud_credentials_created_by ON cloud_credentials(created_by);

CREATE INDEX IF NOT EXISTS idx_cloud_access_logs_org ON cloud_access_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_cloud_access_logs_incident ON cloud_access_logs(incident_id);
CREATE INDEX IF NOT EXISTS idx_cloud_access_logs_triggered_by ON cloud_access_logs(triggered_by);
CREATE INDEX IF NOT EXISTS idx_cloud_access_logs_credential ON cloud_access_logs(credential_id);
CREATE INDEX IF NOT EXISTS idx_cloud_access_logs_created ON cloud_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_access_logs_status ON cloud_access_logs(status);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cloud_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cloud_credentials_updated_at ON cloud_credentials;
CREATE TRIGGER trigger_cloud_credentials_updated_at
    BEFORE UPDATE ON cloud_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_cloud_credentials_updated_at();

-- Comments for documentation
COMMENT ON TABLE cloud_credentials IS 'Stores encrypted cloud provider credentials for Claude Code analysis';
COMMENT ON COLUMN cloud_credentials.credentials_encrypted IS 'AES-256-GCM encrypted JSON containing provider-specific credentials';
COMMENT ON COLUMN cloud_credentials.permission_level IS 'read_only for investigation, read_write for remediation';
COMMENT ON COLUMN cloud_credentials.allowed_services IS 'Array of allowed service names (e.g., ["ec2", "rds"]), empty means all';

COMMENT ON TABLE cloud_access_logs IS 'Audit log of all Claude Code cloud access sessions';
COMMENT ON COLUMN cloud_access_logs.commands_executed IS 'Array of {command, timestamp, success, duration_ms, output_summary}';
COMMENT ON COLUMN cloud_access_logs.recommendations IS 'Array of remediation recommendations from Claude analysis';
