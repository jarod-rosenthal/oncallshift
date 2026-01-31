-- Migration: 040_add_onboarding_sessions.sql
-- Onboarding sessions for AI-guided organization setup

CREATE TABLE IF NOT EXISTS onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_email VARCHAR(255) NOT NULL,

    -- Current stage in the onboarding flow
    current_stage VARCHAR(50) NOT NULL DEFAULT 'discovery'
        CHECK (current_stage IN ('discovery', 'team_setup', 'schedule_setup', 'integration', 'verification', 'complete')),

    -- JSONB columns for flexible data storage
    collected_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    pending_questions JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Session status
    status VARCHAR(50) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'abandoned')),

    -- Completion tracking
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_org ON onboarding_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_status ON onboarding_sessions(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_created ON onboarding_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_admin_user ON onboarding_sessions(admin_user_id);

-- Comments for documentation
COMMENT ON TABLE onboarding_sessions IS 'AI-guided onboarding sessions for new organizations';
COMMENT ON COLUMN onboarding_sessions.current_stage IS 'Current stage: discovery, team_setup, schedule_setup, integration, verification, complete';
COMMENT ON COLUMN onboarding_sessions.collected_info IS 'JSON object containing information gathered during onboarding (team names, schedules, etc.)';
COMMENT ON COLUMN onboarding_sessions.messages IS 'JSON array of conversation messages between user and AI assistant';
COMMENT ON COLUMN onboarding_sessions.pending_questions IS 'JSON array of questions awaiting user response';
COMMENT ON COLUMN onboarding_sessions.status IS 'Session status: active, completed, or abandoned';
