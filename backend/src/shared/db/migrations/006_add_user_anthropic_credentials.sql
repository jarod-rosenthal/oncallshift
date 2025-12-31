-- Migration: Add Anthropic API credentials support for users
-- Allows users to store their own API keys or OAuth tokens from Claude Pro/Max subscriptions

-- Add credential storage columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS anthropic_credential_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS anthropic_credential_type VARCHAR(10); -- 'api_key' or 'oauth'
ALTER TABLE users ADD COLUMN IF NOT EXISTS anthropic_credential_hint VARCHAR(20); -- Display hint like "sk-ant-...xxxx"
ALTER TABLE users ADD COLUMN IF NOT EXISTS anthropic_refresh_token_encrypted TEXT; -- For OAuth token refresh
ALTER TABLE users ADD COLUMN IF NOT EXISTS anthropic_credential_updated_at TIMESTAMP;

-- Create index for users with credentials configured
CREATE INDEX IF NOT EXISTS idx_users_has_anthropic_credential
ON users(id) WHERE anthropic_credential_encrypted IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.anthropic_credential_encrypted IS 'Encrypted Anthropic API key or OAuth token';
COMMENT ON COLUMN users.anthropic_credential_type IS 'Type of credential: api_key or oauth';
COMMENT ON COLUMN users.anthropic_credential_hint IS 'Display hint showing credential prefix and last 4 chars';
COMMENT ON COLUMN users.anthropic_refresh_token_encrypted IS 'Encrypted OAuth refresh token for token renewal';
