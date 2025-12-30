-- Migration: Add escalation policies and escalation steps
-- This enables multi-level escalation with timeout-based step progression

-- Escalation policies table
CREATE TABLE escalation_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_escalation_policies_org_id ON escalation_policies(org_id);

-- Escalation steps table
CREATE TABLE escalation_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escalation_policy_id UUID NOT NULL REFERENCES escalation_policies(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('schedule', 'users')),
    schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
    user_ids JSONB, -- Array of user UUIDs when target_type = 'users'
    timeout_seconds INTEGER NOT NULL DEFAULT 300, -- 5 minutes default
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_target_consistency CHECK (
        (target_type = 'schedule' AND schedule_id IS NOT NULL AND user_ids IS NULL) OR
        (target_type = 'users' AND user_ids IS NOT NULL AND schedule_id IS NULL)
    ),
    CONSTRAINT unique_policy_step_order UNIQUE (escalation_policy_id, step_order)
);

CREATE INDEX idx_escalation_steps_policy_id ON escalation_steps(escalation_policy_id);
CREATE INDEX idx_escalation_steps_schedule_id ON escalation_steps(schedule_id);
CREATE INDEX idx_escalation_steps_order ON escalation_steps(escalation_policy_id, step_order);

-- Add escalation_policy_id to services table
ALTER TABLE services
    ADD COLUMN escalation_policy_id UUID REFERENCES escalation_policies(id) ON DELETE SET NULL;

CREATE INDEX idx_services_escalation_policy_id ON services(escalation_policy_id);

-- Add escalation tracking to incidents table
ALTER TABLE incidents
    ADD COLUMN current_escalation_step INTEGER DEFAULT 0,
    ADD COLUMN escalation_started_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_incidents_current_escalation_step ON incidents(current_escalation_step) WHERE state IN ('triggered', 'acknowledged');

-- Comments for documentation
COMMENT ON TABLE escalation_policies IS 'Defines multi-level escalation policies for services';
COMMENT ON TABLE escalation_steps IS 'Individual steps in an escalation policy with timeout and target configuration';
COMMENT ON COLUMN escalation_steps.step_order IS 'Order of execution (1, 2, 3, etc.)';
COMMENT ON COLUMN escalation_steps.target_type IS 'Type of escalation target: schedule (uses current on-call) or users (specific user list)';
COMMENT ON COLUMN escalation_steps.timeout_seconds IS 'Seconds to wait before escalating to next step if not acknowledged';
COMMENT ON COLUMN incidents.current_escalation_step IS 'Current step number in escalation (0 = not started, 1+ = step number)';
COMMENT ON COLUMN incidents.escalation_started_at IS 'Timestamp when escalation began for this incident';
