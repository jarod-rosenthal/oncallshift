-- Migration: Add PagerDuty Parity Phase 1 Features
-- Features: Add Responders, Snooze, Service Urgency, Event Suppression, Conference Bridge

-- ============================================
-- 1. INCIDENT RESPONDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS incident_responders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    message TEXT,
    responded_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Each user can only be requested once per incident
    UNIQUE(incident_id, user_id)
);

-- Indexes for incident responders
CREATE INDEX idx_incident_responders_incident ON incident_responders(incident_id);
CREATE INDEX idx_incident_responders_user ON incident_responders(user_id);
CREATE INDEX idx_incident_responders_status ON incident_responders(status) WHERE status = 'pending';

-- ============================================
-- 2. SNOOZE SUPPORT FOR INCIDENTS
-- ============================================
-- Re-add snooze columns (previously removed in migration 020)
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMP;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS snoozed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for finding snoozed incidents that need to be unsnoozed
CREATE INDEX IF NOT EXISTS idx_incidents_snoozed ON incidents(snoozed_until)
    WHERE snoozed_until IS NOT NULL;

-- ============================================
-- 3. CONFERENCE BRIDGE FOR INCIDENTS
-- ============================================
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS conference_bridge_url VARCHAR(500);

-- ============================================
-- 4. SERVICE URGENCY SETTINGS
-- ============================================
-- Urgency: high (always high), low (always low), dynamic (based on support hours)
ALTER TABLE services ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) NOT NULL DEFAULT 'high'
    CHECK (urgency IN ('high', 'low', 'dynamic'));

-- Support hours for dynamic urgency calculation
-- Format: { enabled: boolean, timezone: string, days: number[], startTime: string, endTime: string }
ALTER TABLE services ADD COLUMN IF NOT EXISTS support_hours JSONB;

-- Acknowledgement timeout in seconds (auto-unack if not resolved)
ALTER TABLE services ADD COLUMN IF NOT EXISTS ack_timeout_seconds INT;

-- ============================================
-- 5. EVENT SUPPRESSION IN ROUTING RULES
-- ============================================
-- Suppress: if true, matching alerts are silently dropped (no incident, no notifications)
ALTER TABLE alert_routing_rules ADD COLUMN IF NOT EXISTS suppress BOOLEAN NOT NULL DEFAULT FALSE;

-- Suspend: if true, matching alerts create a suspended incident for manual review
ALTER TABLE alert_routing_rules ADD COLUMN IF NOT EXISTS suspend BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- 6. ADD URGENCY TO INCIDENTS
-- ============================================
-- Store the effective urgency at incident creation time
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS urgency VARCHAR(10) DEFAULT 'high'
    CHECK (urgency IN ('high', 'low'));

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE incident_responders IS 'Additional responders requested to help with an incident';
COMMENT ON COLUMN incidents.snoozed_until IS 'If set, incident notifications are paused until this time';
COMMENT ON COLUMN incidents.conference_bridge_url IS 'URL for war room / video conference during incident';
COMMENT ON COLUMN services.urgency IS 'Notification urgency: high (always), low (always), or dynamic (based on support_hours)';
COMMENT ON COLUMN services.support_hours IS 'Business hours config for dynamic urgency calculation';
COMMENT ON COLUMN services.ack_timeout_seconds IS 'Auto-unacknowledge after this many seconds if not resolved';
COMMENT ON COLUMN alert_routing_rules.suppress IS 'If true, matching alerts are silently dropped';
COMMENT ON COLUMN alert_routing_rules.suspend IS 'If true, matching alerts create suspended incidents for review';

-- ============================================
-- 7. STATUS PAGES (Internal Status Dashboard)
-- ============================================
CREATE TABLE IF NOT EXISTS status_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    slug VARCHAR(100) UNIQUE NOT NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'public')),
    custom_domain VARCHAR(255),
    logo_url VARCHAR(500),
    favicon_url VARCHAR(500),
    primary_color VARCHAR(7) DEFAULT '#007bff',
    show_uptime_history BOOLEAN NOT NULL DEFAULT TRUE,
    uptime_history_days INT NOT NULL DEFAULT 90,
    allow_subscriptions BOOLEAN NOT NULL DEFAULT TRUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_status_pages_org ON status_pages(org_id);
CREATE INDEX idx_status_pages_slug ON status_pages(slug);

-- Status page services (which services appear on which status page)
CREATE TABLE IF NOT EXISTS status_page_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    display_name VARCHAR(200),
    display_order INT NOT NULL DEFAULT 0,
    show_incidents BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(status_page_id, service_id)
);

CREATE INDEX idx_status_page_services_page ON status_page_services(status_page_id);

-- Status page subscribers (stakeholders who get updates)
CREATE TABLE IF NOT EXISTS status_page_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'webhook', 'slack')),
    webhook_url VARCHAR(500),
    slack_channel VARCHAR(100),
    confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    confirmation_token VARCHAR(100),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(status_page_id, email)
);

CREATE INDEX idx_status_page_subscribers_page ON status_page_subscribers(status_page_id);
CREATE INDEX idx_status_page_subscribers_email ON status_page_subscribers(email);

-- Status page updates (incident announcements, maintenance notices)
CREATE TABLE IF NOT EXISTS status_page_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
    severity VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (severity IN ('none', 'minor', 'major', 'critical')),
    affected_service_ids JSONB DEFAULT '[]',
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    is_scheduled BOOLEAN NOT NULL DEFAULT FALSE,
    scheduled_start TIMESTAMP,
    scheduled_end TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_status_page_updates_page ON status_page_updates(status_page_id);
CREATE INDEX idx_status_page_updates_status ON status_page_updates(status) WHERE status != 'resolved';
CREATE INDEX idx_status_page_updates_incident ON status_page_updates(incident_id) WHERE incident_id IS NOT NULL;

COMMENT ON TABLE status_pages IS 'Internal/public status pages for stakeholder visibility';
COMMENT ON TABLE status_page_services IS 'Which services appear on which status page';
COMMENT ON TABLE status_page_subscribers IS 'Stakeholders subscribed to status page updates';
COMMENT ON TABLE status_page_updates IS 'Incident announcements and maintenance notices';
