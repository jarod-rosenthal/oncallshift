-- Migration: Add runbooks table
-- This table stores runbooks that can be associated with services

CREATE TABLE IF NOT EXISTS runbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL DEFAULT '[]',
    severity VARCHAR[] NOT NULL DEFAULT '{}',
    tags VARCHAR[] NOT NULL DEFAULT '{}',
    external_url VARCHAR(2048),
    created_by UUID NOT NULL REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_runbooks_org_id ON runbooks(org_id);
CREATE INDEX IF NOT EXISTS idx_runbooks_service_id ON runbooks(service_id);
CREATE INDEX IF NOT EXISTS idx_runbooks_is_active ON runbooks(is_active);
CREATE INDEX IF NOT EXISTS idx_runbooks_service_active ON runbooks(service_id, is_active);

-- Comment on table
COMMENT ON TABLE runbooks IS 'Runbooks containing step-by-step instructions for incident response';
