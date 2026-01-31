-- Migration: 041_add_idempotency_keys.sql
-- Idempotency key support for safe request retries (follows Stripe pattern)

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Request identification
    key VARCHAR(255) NOT NULL,  -- Client-provided idempotency key (unique per org)
    request_path VARCHAR(500) NOT NULL,  -- Request path (e.g., /api/v1/incidents)
    request_method VARCHAR(10) NOT NULL,  -- HTTP method (POST, PUT, PATCH)

    -- Cached response
    response_status INTEGER NOT NULL,  -- HTTP status code of the original response
    response_body JSONB NOT NULL,  -- Full response body as JSON

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,  -- Auto-cleanup after expiration (24 hours)

    -- Ensure unique key per organization
    CONSTRAINT uq_idempotency_keys_org_key UNIQUE (org_id, key)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_org_key ON idempotency_keys(org_id, key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON idempotency_keys(expires_at);

-- Comments for documentation
COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys and cached responses for safe request retries';
COMMENT ON COLUMN idempotency_keys.key IS 'Client-provided idempotency key (typically UUID), unique per organization';
COMMENT ON COLUMN idempotency_keys.response_body IS 'Cached response body returned for duplicate requests';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'Keys automatically expire after 24 hours';

-- Function to clean up expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Comment on cleanup function
COMMENT ON FUNCTION cleanup_expired_idempotency_keys() IS 'Removes expired idempotency keys. Call periodically via scheduled job or application code.';
