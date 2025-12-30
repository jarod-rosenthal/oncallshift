-- Add schedule_members table for managing on-call rotation membership

CREATE TABLE schedule_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_schedule_user UNIQUE (schedule_id, user_id),
    CONSTRAINT unique_schedule_position UNIQUE (schedule_id, position)
);

CREATE INDEX idx_schedule_members_schedule_id ON schedule_members(schedule_id);
CREATE INDEX idx_schedule_members_user_id ON schedule_members(user_id);
CREATE INDEX idx_schedule_members_position ON schedule_members(schedule_id, position);

-- Update trigger
CREATE TRIGGER update_schedule_members_updated_at BEFORE UPDATE ON schedule_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE schedule_members IS 'Users assigned to on-call schedules with rotation order';
