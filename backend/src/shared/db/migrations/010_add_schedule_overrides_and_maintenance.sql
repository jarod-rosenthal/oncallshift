-- Migration: Add Schedule Overrides and Maintenance Windows
-- Description: Adds support for temporary on-call overrides and service maintenance windows

-- Schedule Overrides table
-- Allows temporary substitution of on-call users
CREATE TABLE IF NOT EXISTS schedule_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure end_time is after start_time
    CONSTRAINT valid_override_time_range CHECK (end_time > start_time)
);

-- Indexes for schedule overrides
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_schedule_id ON schedule_overrides(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_user_id ON schedule_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_time_range ON schedule_overrides(schedule_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_active ON schedule_overrides(schedule_id, start_time, end_time)
    WHERE end_time > CURRENT_TIMESTAMP;

-- Maintenance Windows table
-- Allows suppressing alerts during planned maintenance
CREATE TABLE IF NOT EXISTS maintenance_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT,
    suppress_alerts BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure end_time is after start_time
    CONSTRAINT valid_maintenance_time_range CHECK (end_time > start_time)
);

-- Indexes for maintenance windows
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_service_id ON maintenance_windows(service_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_org_id ON maintenance_windows(org_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_time_range ON maintenance_windows(service_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_active ON maintenance_windows(service_id, start_time, end_time)
    WHERE end_time > CURRENT_TIMESTAMP;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to schedule_overrides
DROP TRIGGER IF EXISTS update_schedule_overrides_updated_at ON schedule_overrides;
CREATE TRIGGER update_schedule_overrides_updated_at
    BEFORE UPDATE ON schedule_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to maintenance_windows
DROP TRIGGER IF EXISTS update_maintenance_windows_updated_at ON maintenance_windows;
CREATE TRIGGER update_maintenance_windows_updated_at
    BEFORE UPDATE ON maintenance_windows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
