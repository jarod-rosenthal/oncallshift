-- Migration: Add notify_strategy column to escalation_steps
-- Supports 'all' (notify all targets simultaneously) or 'round_robin' (rotate through targets)

ALTER TABLE escalation_steps
    ADD COLUMN IF NOT EXISTS notify_strategy VARCHAR(20) NOT NULL DEFAULT 'all';

-- Add constraint for valid values
ALTER TABLE escalation_steps
    ADD CONSTRAINT check_notify_strategy
    CHECK (notify_strategy IN ('all', 'round_robin'));

COMMENT ON COLUMN escalation_steps.notify_strategy IS
    'Strategy for notifying multiple targets: all (simultaneous) or round_robin (rotating)';
