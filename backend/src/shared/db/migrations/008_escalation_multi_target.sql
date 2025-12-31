-- Migration: Add multi-target support and repeat functionality to escalation policies
-- Phase 2 of escalation workflow improvements

-- 1. Add repeat functionality to escalation_policies
ALTER TABLE escalation_policies
    ADD COLUMN repeat_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN repeat_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN escalation_policies.repeat_enabled IS 'Whether to repeat the policy after exhausting all levels';
COMMENT ON COLUMN escalation_policies.repeat_count IS 'Number of times to repeat (0 = infinite if repeat_enabled is true)';

-- 2. Create escalation_targets table for multi-target support per level
CREATE TABLE escalation_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escalation_step_id UUID NOT NULL REFERENCES escalation_steps(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('user', 'schedule')),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_target_has_value CHECK (
        (target_type = 'user' AND user_id IS NOT NULL AND schedule_id IS NULL) OR
        (target_type = 'schedule' AND schedule_id IS NOT NULL AND user_id IS NULL)
    )
);

CREATE INDEX idx_escalation_targets_step_id ON escalation_targets(escalation_step_id);
CREATE INDEX idx_escalation_targets_user_id ON escalation_targets(user_id);
CREATE INDEX idx_escalation_targets_schedule_id ON escalation_targets(schedule_id);

COMMENT ON TABLE escalation_targets IS 'Individual notification targets within an escalation level (supports multiple targets per level)';
COMMENT ON COLUMN escalation_targets.target_type IS 'Type of target: user (specific user) or schedule (current on-call from schedule)';

-- 3. Migrate existing data from escalation_steps to escalation_targets
-- For steps with target_type='schedule', create a single target
INSERT INTO escalation_targets (escalation_step_id, target_type, schedule_id)
SELECT id, 'schedule', schedule_id
FROM escalation_steps
WHERE target_type = 'schedule' AND schedule_id IS NOT NULL;

-- For steps with target_type='users', create a target for each user_id in the JSONB array
INSERT INTO escalation_targets (escalation_step_id, target_type, user_id)
SELECT es.id, 'user', (jsonb_array_elements_text(es.user_ids))::uuid
FROM escalation_steps es
WHERE es.target_type = 'users' AND es.user_ids IS NOT NULL AND jsonb_array_length(es.user_ids) > 0;

-- 4. Drop the constraint that enforces single target type (we're moving to multi-target)
ALTER TABLE escalation_steps DROP CONSTRAINT IF EXISTS check_target_consistency;

-- 5. Keep old columns for backward compatibility during transition
-- These will be deprecated and can be removed in a future migration (Phase 3)
-- For now, the API will read from escalation_targets but still write to both

-- 6. Add comment explaining the transition
COMMENT ON COLUMN escalation_steps.target_type IS 'DEPRECATED: Use escalation_targets table instead. Kept for backward compatibility.';
COMMENT ON COLUMN escalation_steps.schedule_id IS 'DEPRECATED: Use escalation_targets table instead. Kept for backward compatibility.';
COMMENT ON COLUMN escalation_steps.user_ids IS 'DEPRECATED: Use escalation_targets table instead. Kept for backward compatibility.';
