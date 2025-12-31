-- Migration: Add Teams Support
-- Description: Adds teams and team memberships for multi-team organization structure

-- Teams table
-- Allows grouping users and resources by team
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(100),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique slug per organization
    CONSTRAINT unique_team_slug_per_org UNIQUE (org_id, slug),
    -- Unique name per organization
    CONSTRAINT unique_team_name_per_org UNIQUE (org_id, name)
);

-- Team Memberships table
-- Junction table for users belonging to teams
CREATE TABLE IF NOT EXISTS team_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('manager', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- One membership per user per team
    CONSTRAINT unique_team_member UNIQUE (team_id, user_id)
);

-- Add team_id to existing tables (nullable for backward compatibility)
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE escalation_policies ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Indexes for teams
CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(org_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(org_id, slug);

-- Indexes for team memberships
CREATE INDEX IF NOT EXISTS idx_team_memberships_team_id ON team_memberships(team_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_user_id ON team_memberships(user_id);

-- Indexes for team_id on existing tables
CREATE INDEX IF NOT EXISTS idx_schedules_team_id ON schedules(team_id);
CREATE INDEX IF NOT EXISTS idx_escalation_policies_team_id ON escalation_policies(team_id);
CREATE INDEX IF NOT EXISTS idx_services_team_id ON services(team_id);

-- Apply trigger to teams for updated_at
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
