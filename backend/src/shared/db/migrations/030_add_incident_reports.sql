-- Migration: Add Incident Report System
-- Enables scheduled and on-demand incident summary reports with RCA tracking

-- ============================================
-- 1. INCIDENT REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    schedule VARCHAR(20) DEFAULT 'manual' NOT NULL
        CHECK (schedule IN ('manual', 'daily', 'weekly', 'monthly')),
    format VARCHAR(20) DEFAULT 'summary' NOT NULL
        CHECK (format IN ('summary', 'detailed', 'executive')),

    -- Scheduling configuration
    schedule_day INT, -- Day of week (0-6) for weekly, day of month (1-31) for monthly
    schedule_hour INT DEFAULT 9 CHECK (schedule_hour >= 0 AND schedule_hour <= 23),

    -- Report configuration (JSONB)
    -- { includeRCA, includeSeverityBreakdown, includeServiceBreakdown, etc. }
    config JSONB DEFAULT '{}'::jsonb,

    -- Delivery configuration (JSONB)
    -- { channels: ['email', 'slack'], emailRecipients: [...], slackChannelId: '...' }
    delivery_config JSONB DEFAULT '{}'::jsonb,

    enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incident_reports_org ON incident_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_enabled ON incident_reports(org_id, enabled);
CREATE INDEX IF NOT EXISTS idx_incident_reports_next_run ON incident_reports(next_run_at)
    WHERE enabled = true AND next_run_at IS NOT NULL;

-- ============================================
-- 2. REPORT EXECUTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS report_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    status VARCHAR(20) DEFAULT 'pending' NOT NULL
        CHECK (status IN ('pending', 'generating', 'completed', 'failed')),

    -- Period covered by this report
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,

    -- Report data (JSONB) - stores the full report output
    -- { period: {...}, summary: {...}, services: [...], teams: [...], rcas: [...] }
    data JSONB,

    -- Delivery status per channel (JSONB)
    -- { 'email': { sent: true, sentAt: '...' }, 'slack': { sent: false, error: '...' } }
    delivery_status JSONB DEFAULT '{}'::jsonb,

    error_message TEXT,
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_executions_report ON report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_org ON report_executions(org_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status);
CREATE INDEX IF NOT EXISTS idx_report_executions_created ON report_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_executions_period ON report_executions(period_start, period_end);

-- ============================================
-- 3. COMMENTS
-- ============================================
COMMENT ON TABLE incident_reports IS 'Configurable incident summary reports (scheduled or on-demand)';
COMMENT ON TABLE report_executions IS 'Tracks report generation runs and stores output data';
COMMENT ON COLUMN incident_reports.schedule IS 'Report schedule: manual (on-demand), daily, weekly, or monthly';
COMMENT ON COLUMN incident_reports.format IS 'Report detail level: summary, detailed, or executive';
COMMENT ON COLUMN incident_reports.config IS 'Report configuration options (RCA, breakdowns, filters)';
COMMENT ON COLUMN incident_reports.delivery_config IS 'Delivery channel configuration (email, Slack, Teams, webhook)';
COMMENT ON COLUMN report_executions.data IS 'Full report data including metrics, RCAs, and trends';
COMMENT ON COLUMN report_executions.delivery_status IS 'Delivery status per configured channel';
