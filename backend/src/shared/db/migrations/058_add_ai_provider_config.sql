-- Migration: 058_add_ai_provider_config.sql
-- Add multi-provider AI support (Anthropic, OpenAI, Google Gemini)

-- Update cloud_credentials provider constraint to include all AI providers
-- Drop the old constraint first
ALTER TABLE cloud_credentials
DROP CONSTRAINT IF EXISTS chk_cloud_credentials_provider;

-- Add new constraint with all providers
ALTER TABLE cloud_credentials
ADD CONSTRAINT chk_cloud_credentials_provider
CHECK (provider IN ('aws', 'azure', 'gcp', 'anthropic', 'openai', 'google'));

-- Create AI provider configuration table
CREATE TABLE IF NOT EXISTS ai_provider_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Default provider for the organization
    default_provider VARCHAR(20) NOT NULL DEFAULT 'anthropic',

    -- Per-capability provider overrides (optional)
    -- Example: {"chat": "openai", "code": "anthropic", "vision": "google"}
    capability_overrides JSONB DEFAULT '{}'::jsonb,

    -- Model preferences per provider
    -- Example: {"anthropic": {"chat": "claude-sonnet-4-20250514"}, "openai": {"chat": "gpt-4o"}}
    model_preferences JSONB DEFAULT '{}'::jsonb,

    -- Fallback chain if primary provider fails
    -- Example: ["anthropic", "openai", "google"]
    fallback_chain JSONB DEFAULT '[]'::jsonb,

    -- Feature flags
    enable_fallback BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- One config per organization
    CONSTRAINT uq_ai_provider_config_org UNIQUE(org_id),

    -- Validate default provider
    CONSTRAINT chk_ai_provider_config_default CHECK (default_provider IN ('anthropic', 'openai', 'google'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_org ON ai_provider_configs(org_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_provider_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_provider_configs_updated_at ON ai_provider_configs;
CREATE TRIGGER trigger_ai_provider_configs_updated_at
    BEFORE UPDATE ON ai_provider_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_provider_configs_updated_at();

-- Comments for documentation
COMMENT ON TABLE ai_provider_configs IS 'Organization-level AI provider configuration for multi-provider support';
COMMENT ON COLUMN ai_provider_configs.default_provider IS 'Primary AI provider (anthropic, openai, google)';
COMMENT ON COLUMN ai_provider_configs.capability_overrides IS 'Override provider per capability: chat, code, vision, embeddings';
COMMENT ON COLUMN ai_provider_configs.model_preferences IS 'Preferred model ID per provider per capability';
COMMENT ON COLUMN ai_provider_configs.fallback_chain IS 'Ordered list of providers to try if primary fails';
