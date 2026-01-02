-- Migration: 039_add_organization_api_keys.sql
-- Organization-level API keys for programmatic access (Terraform provider, CI/CD pipelines)

-- Organization API keys table
CREATE TABLE IF NOT EXISTS organization_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Key identification
    name VARCHAR(255) NOT NULL,  -- User-friendly name (e.g., "terraform-provider", "ci-cd-pipeline")
    key_hash VARCHAR(255) NOT NULL,  -- bcrypt hash of the full API key (never store plaintext)
    key_prefix VARCHAR(12) NOT NULL,  -- First 12 chars for lookup: "org_abc12345"

    -- Authorization
    scopes JSONB DEFAULT '["*"]'::jsonb,  -- Array of scopes: ["*"] for full access, or specific like ["services:read", "teams:write"]

    -- Usage tracking
    last_used_at TIMESTAMP,

    -- Expiration (optional)
    expires_at TIMESTAMP,

    -- Audit trail
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique key prefixes globally (for fast lookup)
    CONSTRAINT uq_organization_api_keys_prefix UNIQUE (key_prefix),

    -- Ensure unique names per organization
    CONSTRAINT uq_organization_api_keys_org_name UNIQUE (org_id, name)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_organization_api_keys_org ON organization_api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_api_keys_prefix ON organization_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_organization_api_keys_created_by ON organization_api_keys(created_by);
CREATE INDEX IF NOT EXISTS idx_organization_api_keys_expires ON organization_api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Comments for documentation
COMMENT ON TABLE organization_api_keys IS 'Organization-level API keys for programmatic access (Terraform, CI/CD)';
COMMENT ON COLUMN organization_api_keys.key_hash IS 'bcrypt hash of full API key - plaintext key only returned once on creation';
COMMENT ON COLUMN organization_api_keys.key_prefix IS 'First 12 characters of API key for identification without exposing full key';
COMMENT ON COLUMN organization_api_keys.scopes IS 'JSON array of permission scopes. ["*"] = full access, or specific like ["services:read"]';
COMMENT ON COLUMN organization_api_keys.expires_at IS 'Optional expiration timestamp. NULL means no expiration.';
