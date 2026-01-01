-- Migration: Add Incident Subscribers and Status Updates
-- This enables stakeholder notifications for incidents (PagerDuty Subscriber feature)

-- Incident Subscribers table
-- Tracks stakeholders who want to receive updates about specific incidents
CREATE TABLE IF NOT EXISTS incident_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'stakeholder',
    channel VARCHAR(20) NOT NULL DEFAULT 'email',
    webhook_url VARCHAR(500),
    slack_channel VARCHAR(100),
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed BOOLEAN NOT NULL DEFAULT true,
    active BOOLEAN NOT NULL DEFAULT true,
    notify_on_status_update BOOLEAN NOT NULL DEFAULT true,
    notify_on_resolution BOOLEAN NOT NULL DEFAULT true,
    notify_on_escalation BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_incident_subscriber UNIQUE (incident_id, email)
);

-- Incident Status Updates table
-- Tracks status updates posted to incidents for stakeholders
CREATE TABLE IF NOT EXISTS incident_status_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    posted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    update_type VARCHAR(20) NOT NULL DEFAULT 'update',
    message TEXT NOT NULL,
    message_html TEXT,
    notifications_sent BOOLEAN NOT NULL DEFAULT false,
    notifications_sent_at TIMESTAMPTZ,
    subscriber_count INT NOT NULL DEFAULT 0,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_incident_subscribers_incident ON incident_subscribers(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_subscribers_org ON incident_subscribers(org_id);
CREATE INDEX IF NOT EXISTS idx_incident_subscribers_user ON incident_subscribers(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incident_subscribers_email ON incident_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_incident_subscribers_active ON incident_subscribers(incident_id, active) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_incident_status_updates_incident ON incident_status_updates(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_status_updates_org ON incident_status_updates(org_id);
CREATE INDEX IF NOT EXISTS idx_incident_status_updates_created ON incident_status_updates(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_status_updates_pending ON incident_status_updates(notifications_sent) WHERE notifications_sent = false;

-- Add check constraints for valid roles and channels
ALTER TABLE incident_subscribers DROP CONSTRAINT IF EXISTS check_subscriber_role;
ALTER TABLE incident_subscribers ADD CONSTRAINT check_subscriber_role
    CHECK (role IN ('stakeholder', 'observer', 'responder'));

ALTER TABLE incident_subscribers DROP CONSTRAINT IF EXISTS check_subscriber_channel;
ALTER TABLE incident_subscribers ADD CONSTRAINT check_subscriber_channel
    CHECK (channel IN ('email', 'sms', 'push', 'slack', 'webhook'));

ALTER TABLE incident_status_updates DROP CONSTRAINT IF EXISTS check_update_type;
ALTER TABLE incident_status_updates ADD CONSTRAINT check_update_type
    CHECK (update_type IN ('investigating', 'identified', 'monitoring', 'update', 'resolved'));

-- Comment on tables
COMMENT ON TABLE incident_subscribers IS 'Stakeholders subscribed to receive incident status updates';
COMMENT ON TABLE incident_status_updates IS 'Status updates posted to incidents for stakeholder notification';

COMMENT ON COLUMN incident_subscribers.role IS 'stakeholder: business stakeholder, observer: read-only watcher, responder: active participant';
COMMENT ON COLUMN incident_subscribers.channel IS 'Notification channel: email, sms, push, slack, or webhook';
COMMENT ON COLUMN incident_status_updates.update_type IS 'Type of update: investigating, identified, monitoring, update, resolved';
COMMENT ON COLUMN incident_status_updates.is_public IS 'Whether this update should be visible on public status pages';
