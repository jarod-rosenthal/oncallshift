-- Migration: 043_add_ai_recommendations.sql
-- Stores AI-generated proactive recommendations for organizations

CREATE TABLE IF NOT EXISTS ai_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Recommendation classification
    type VARCHAR(50) NOT NULL
        CHECK (type IN ('oncall_fairness', 'alert_noise', 'runbook_coverage', 'escalation_effectiveness', 'mttr_trend', 'schedule_gap', 'service_health')),
    severity VARCHAR(20) NOT NULL DEFAULT 'warning'
        CHECK (severity IN ('info', 'warning', 'critical')),

    -- Recommendation content
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    suggested_action TEXT,

    -- Auto-fix capability
    auto_fix_available BOOLEAN NOT NULL DEFAULT FALSE,
    auto_fix_payload JSONB,

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'applied', 'dismissed', 'expired')),

    -- Supporting data for the recommendation
    metadata JSONB,

    -- Applied tracking
    applied_at TIMESTAMP WITH TIME ZONE,
    applied_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Dismissed tracking
    dismissed_at TIMESTAMP WITH TIME ZONE,
    dismissed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    dismiss_reason TEXT,

    -- Expiration for time-sensitive recommendations
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_org_id ON ai_recommendations(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status ON ai_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_type ON ai_recommendations(type);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_severity ON ai_recommendations(severity);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_created_at ON ai_recommendations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_expires_at ON ai_recommendations(expires_at) WHERE expires_at IS NOT NULL;

-- Composite index for pending actionable recommendations
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_pending ON ai_recommendations(org_id, status, created_at DESC)
    WHERE status = 'pending';

-- Comments for documentation
COMMENT ON TABLE ai_recommendations IS 'AI-generated proactive recommendations for improving incident management';
COMMENT ON COLUMN ai_recommendations.type IS 'Category: oncall_fairness, alert_noise, runbook_coverage, escalation_effectiveness, mttr_trend, schedule_gap, service_health';
COMMENT ON COLUMN ai_recommendations.severity IS 'Importance level: info, warning, critical';
COMMENT ON COLUMN ai_recommendations.auto_fix_available IS 'Whether this recommendation can be automatically applied';
COMMENT ON COLUMN ai_recommendations.auto_fix_payload IS 'JSON payload for executing the auto-fix action';
COMMENT ON COLUMN ai_recommendations.metadata IS 'Supporting data for the recommendation (e.g., affected users, services, statistics)';
COMMENT ON COLUMN ai_recommendations.expires_at IS 'When this recommendation becomes stale and should be marked expired';
