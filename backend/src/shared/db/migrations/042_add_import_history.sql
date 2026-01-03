-- Migration: 042_add_import_history.sql
-- Tracks screenshot and natural language import attempts and results

CREATE TABLE IF NOT EXISTS import_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Source and content type classification
    source_type VARCHAR(50) NOT NULL
        CHECK (source_type IN ('pagerduty', 'opsgenie', 'screenshot', 'natural_language')),
    content_type VARCHAR(50)
        CHECK (content_type IN ('schedule', 'escalation', 'team', 'service', 'auto', 'mixed')),

    -- JSONB columns for flexible data storage
    input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    extraction_result JSONB,
    execution_result JSONB,

    -- Import status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'analyzing', 'preview', 'executing', 'completed', 'failed', 'rolled_back')),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_import_history_org_id ON import_history(org_id);
CREATE INDEX IF NOT EXISTS idx_import_history_user_id ON import_history(user_id);
CREATE INDEX IF NOT EXISTS idx_import_history_status ON import_history(status);
CREATE INDEX IF NOT EXISTS idx_import_history_created_at ON import_history(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE import_history IS 'Tracks semantic import attempts from screenshots and natural language descriptions';
COMMENT ON COLUMN import_history.source_type IS 'Source of import: pagerduty, opsgenie, screenshot, or natural_language';
COMMENT ON COLUMN import_history.content_type IS 'Type of content being imported: schedule, escalation, team, service, auto, or mixed';
COMMENT ON COLUMN import_history.input_data IS 'JSON object containing input metadata (image info, natural language text, etc.)';
COMMENT ON COLUMN import_history.extraction_result IS 'JSON object containing AI extraction results (teams, schedules, policies, etc.)';
COMMENT ON COLUMN import_history.execution_result IS 'JSON object containing import execution results (created/skipped/failed resources)';
COMMENT ON COLUMN import_history.status IS 'Import status: pending, analyzing, preview, executing, completed, failed, or rolled_back';
