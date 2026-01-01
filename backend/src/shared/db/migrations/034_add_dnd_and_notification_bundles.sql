-- Migration: Add DND (Do Not Disturb) and Notification Bundling
-- Enables users to configure quiet hours and bundles low-urgency notifications

-- Add DND fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_enabled BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_start_time TIME;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_end_time TIME;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_timezone VARCHAR(100);

-- Create notification_bundles table for grouping low-urgency notifications
CREATE TABLE IF NOT EXISTS notification_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    notification_count INTEGER DEFAULT 0 NOT NULL,
    incident_ids JSONB DEFAULT '[]'::jsonb NOT NULL,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_bundle_status CHECK (status IN ('pending', 'sent', 'cancelled'))
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_users_dnd_enabled ON users(dnd_enabled) WHERE dnd_enabled = true;
CREATE INDEX IF NOT EXISTS idx_notification_bundles_user_id ON notification_bundles(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_bundles_status ON notification_bundles(user_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_bundles_created_at ON notification_bundles(created_at) WHERE status = 'pending';

-- Add GIN index for JSONB incident_ids column to enable efficient searching
CREATE INDEX IF NOT EXISTS idx_notification_bundles_incident_ids ON notification_bundles USING GIN (incident_ids);

-- Add comments for documentation
COMMENT ON COLUMN users.dnd_enabled IS 'Whether Do Not Disturb is enabled for this user';
COMMENT ON COLUMN users.dnd_start_time IS 'Start time for DND period in HH:mm format';
COMMENT ON COLUMN users.dnd_end_time IS 'End time for DND period in HH:mm format';
COMMENT ON COLUMN users.dnd_timezone IS 'IANA timezone for DND schedule (e.g., America/New_York)';

COMMENT ON TABLE notification_bundles IS 'Groups low-urgency notifications to send as digest every 30 minutes';
COMMENT ON COLUMN notification_bundles.status IS 'pending: waiting to send, sent: digest sent, cancelled: bundle cancelled';
COMMENT ON COLUMN notification_bundles.incident_ids IS 'Array of incident IDs included in this bundle';
