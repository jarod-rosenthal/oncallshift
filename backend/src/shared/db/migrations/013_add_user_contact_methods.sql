-- Migration: Add User Contact Methods and Notification Rules
-- Description: Enables per-user contact methods (email, SMS, push) and customizable notification rules

-- User Contact Methods table
-- Multiple contact methods per user (email, phone, push device)
CREATE TABLE IF NOT EXISTS user_contact_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'sms', 'phone', 'push')),
    address VARCHAR(255) NOT NULL, -- Email address, phone number, or device token
    label VARCHAR(100), -- User-friendly label like "Work Phone", "Personal Email"
    verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(10), -- For email/SMS verification
    verification_sent_at TIMESTAMP WITH TIME ZONE,
    is_default BOOLEAN DEFAULT FALSE, -- Default method for this type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Each user can only have one of the same address
    CONSTRAINT unique_user_contact_address UNIQUE (user_id, type, address)
);

-- User Notification Rules table
-- Defines when and how to notify users based on urgency
CREATE TABLE IF NOT EXISTS user_notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_method_id UUID NOT NULL REFERENCES user_contact_methods(id) ON DELETE CASCADE,
    urgency VARCHAR(20) NOT NULL CHECK (urgency IN ('high', 'low', 'any')),
    start_delay_minutes INTEGER NOT NULL DEFAULT 0, -- Delay before this rule fires
    rule_order INTEGER NOT NULL DEFAULT 0, -- Order within same urgency
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure rule order is unique per user per urgency
    CONSTRAINT unique_rule_order UNIQUE (user_id, urgency, rule_order)
);

-- Indexes for contact methods
CREATE INDEX IF NOT EXISTS idx_user_contact_methods_user_id ON user_contact_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contact_methods_type ON user_contact_methods(user_id, type);
CREATE INDEX IF NOT EXISTS idx_user_contact_methods_verified ON user_contact_methods(user_id, verified);

-- Indexes for notification rules
CREATE INDEX IF NOT EXISTS idx_user_notification_rules_user_id ON user_notification_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_rules_urgency ON user_notification_rules(user_id, urgency);
CREATE INDEX IF NOT EXISTS idx_user_notification_rules_contact_method ON user_notification_rules(contact_method_id);

-- Apply trigger to user_contact_methods for updated_at
DROP TRIGGER IF EXISTS update_user_contact_methods_updated_at ON user_contact_methods;
CREATE TRIGGER update_user_contact_methods_updated_at
    BEFORE UPDATE ON user_contact_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to user_notification_rules for updated_at
DROP TRIGGER IF EXISTS update_user_notification_rules_updated_at ON user_notification_rules;
CREATE TRIGGER update_user_notification_rules_updated_at
    BEFORE UPDATE ON user_notification_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
