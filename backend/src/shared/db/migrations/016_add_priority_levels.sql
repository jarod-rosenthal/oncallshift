-- Migration: Add Priority Levels
-- Description: Enables customizable priority levels for incidents with urgency mapping

-- Priority Levels table
-- Allows organizations to define custom priority levels
CREATE TABLE IF NOT EXISTS priority_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) NOT NULL DEFAULT '#6366f1', -- Hex color code
    order_value INTEGER NOT NULL DEFAULT 0, -- Lower = higher priority

    -- Urgency mapping for notification routing
    urgency VARCHAR(20) NOT NULL DEFAULT 'high' CHECK (urgency IN ('high', 'low')),

    -- Auto-escalation settings
    auto_escalate BOOLEAN DEFAULT FALSE,
    escalate_after_minutes INTEGER DEFAULT 30,

    -- Whether this is the default priority for new incidents
    is_default BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique name per org
    CONSTRAINT unique_priority_name_per_org UNIQUE (org_id, name),
    -- Ensure unique order per org
    CONSTRAINT unique_priority_order_per_org UNIQUE (org_id, order_value)
);

-- Add priority_id to incidents
ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS priority_id UUID REFERENCES priority_levels(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_priority_levels_org_id ON priority_levels(org_id);
CREATE INDEX IF NOT EXISTS idx_priority_levels_order ON priority_levels(org_id, order_value);
CREATE INDEX IF NOT EXISTS idx_incidents_priority_id ON incidents(priority_id);

-- Apply trigger for updated_at
DROP TRIGGER IF EXISTS update_priority_levels_updated_at ON priority_levels;
CREATE TRIGGER update_priority_levels_updated_at
    BEFORE UPDATE ON priority_levels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default priority levels for existing organizations
-- This is optional - organizations can customize these later
-- INSERT INTO priority_levels (org_id, name, description, color, order_value, urgency, is_default)
-- SELECT id, 'P1 - Critical', 'Critical priority requiring immediate response', '#dc2626', 1, 'high', FALSE
-- FROM organizations WHERE NOT EXISTS (SELECT 1 FROM priority_levels WHERE priority_levels.org_id = organizations.id);

-- Example priority levels:
-- P1: Critical (red, order 1, high urgency, auto-escalate after 5 min)
-- P2: High (orange, order 2, high urgency)
-- P3: Medium (yellow, order 3, low urgency)
-- P4: Low (blue, order 4, low urgency)
-- P5: Informational (gray, order 5, low urgency)
