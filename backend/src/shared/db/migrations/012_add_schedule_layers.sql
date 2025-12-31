-- Migration: Add Schedule Layers
-- Description: Adds support for PagerDuty-style schedule layers with rotations

-- Schedule Layers table
-- Multiple layers per schedule, each with its own rotation
CREATE TABLE IF NOT EXISTS schedule_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    rotation_type VARCHAR(50) NOT NULL CHECK (rotation_type IN ('daily', 'weekly', 'custom')),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE, -- NULL = indefinite
    handoff_time TIME NOT NULL DEFAULT '09:00:00',
    handoff_day INTEGER CHECK (handoff_day >= 0 AND handoff_day <= 6), -- 0=Sunday, for weekly rotation
    rotation_length INTEGER DEFAULT 1, -- For custom: number of days per rotation
    layer_order INTEGER NOT NULL DEFAULT 0, -- Lower number = higher priority (checked first)
    restrictions JSONB, -- Time-of-week restrictions: { "type": "weekly", "intervals": [...] }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Schedule Layer Members table
-- Ordered rotation participants for each layer
CREATE TABLE IF NOT EXISTS schedule_layer_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id UUID NOT NULL REFERENCES schedule_layers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL, -- Rotation order (0, 1, 2, ...)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Each position in a layer is unique
    CONSTRAINT unique_layer_position UNIQUE (layer_id, position),
    -- Each user can only appear once per layer
    CONSTRAINT unique_user_per_layer UNIQUE (layer_id, user_id)
);

-- Indexes for schedule layers
CREATE INDEX IF NOT EXISTS idx_schedule_layers_schedule_id ON schedule_layers(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_layers_order ON schedule_layers(schedule_id, layer_order);

-- Indexes for layer members
CREATE INDEX IF NOT EXISTS idx_schedule_layer_members_layer_id ON schedule_layer_members(layer_id);
CREATE INDEX IF NOT EXISTS idx_schedule_layer_members_user_id ON schedule_layer_members(user_id);

-- Apply trigger to schedule_layers for updated_at
DROP TRIGGER IF EXISTS update_schedule_layers_updated_at ON schedule_layers;
CREATE TRIGGER update_schedule_layers_updated_at
    BEFORE UPDATE ON schedule_layers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
