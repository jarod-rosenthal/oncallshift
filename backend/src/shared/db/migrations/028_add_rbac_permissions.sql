-- Migration: Add RBAC (Role-Based Access Control)
-- Implements PagerDuty-compatible permission system with base roles, team roles, and object-level permissions

-- ============================================
-- 1. EXPAND USER BASE ROLES
-- ============================================
-- Current: admin, member
-- New: owner, admin, manager, responder, observer, restricted_access, limited_stakeholder

-- Add new base_role column (keeping old 'role' for backward compatibility during transition)
ALTER TABLE users ADD COLUMN IF NOT EXISTS base_role VARCHAR(30) DEFAULT 'responder'
    CHECK (base_role IN ('owner', 'admin', 'manager', 'responder', 'observer', 'restricted_access', 'limited_stakeholder'));

-- Migrate existing roles
UPDATE users SET base_role = 'admin' WHERE role = 'admin';
UPDATE users SET base_role = 'responder' WHERE role = 'member';

-- ============================================
-- 2. TEAM PRIVACY SETTINGS
-- ============================================
ALTER TABLE teams ADD COLUMN IF NOT EXISTS privacy VARCHAR(20) DEFAULT 'public'
    CHECK (privacy IN ('public', 'private'));

-- ============================================
-- 3. TEAM MEMBER ROLES
-- ============================================
-- Allows per-team role overrides (e.g., manager in Team A, responder in Team B)
CREATE TABLE IF NOT EXISTS team_member_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL CHECK (role IN ('manager', 'responder', 'observer')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- User can only have one role per team
    UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_member_roles_team ON team_member_roles(team_id);
CREATE INDEX IF NOT EXISTS idx_team_member_roles_user ON team_member_roles(user_id);

-- ============================================
-- 4. OBJECT-LEVEL PERMISSIONS
-- ============================================
-- Grants specific users/teams access to services, schedules, escalation policies
CREATE TABLE IF NOT EXISTS object_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    object_type VARCHAR(50) NOT NULL CHECK (object_type IN ('service', 'schedule', 'escalation_policy', 'status_page')),
    object_id UUID NOT NULL,

    -- Subject can be user or team
    subject_type VARCHAR(20) NOT NULL CHECK (subject_type IN ('user', 'team')),
    subject_id UUID NOT NULL,

    -- Permission level
    permission_level VARCHAR(30) NOT NULL CHECK (permission_level IN ('view', 'edit', 'manage')),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Unique constraint: one permission per subject per object
    UNIQUE(object_type, object_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_object_permissions_object ON object_permissions(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_object_permissions_subject ON object_permissions(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_object_permissions_org ON object_permissions(org_id);

-- ============================================
-- 5. ROLE CAPABILITIES REFERENCE
-- ============================================
-- This is documentation - actual enforcement happens in application code
/*
Base Role Capabilities:

owner:
  - Full system access
  - Can manage billing and organization settings
  - Can assign/revoke owner role
  - Cannot be restricted by object permissions

admin:
  - Can manage all resources except org settings
  - Can create/delete users
  - Can assign roles up to admin
  - Cannot be restricted by object permissions

manager:
  - Can manage assigned resources
  - Can create services, schedules, escalation policies
  - Can assign responder/observer roles
  - Subject to object permissions

responder:
  - Can be on-call
  - Can acknowledge/resolve incidents
  - Can edit incidents they're assigned to
  - Subject to object permissions

observer:
  - Read-only access to assigned resources
  - Can view incidents and analytics
  - Cannot modify anything
  - Subject to object permissions

restricted_access:
  - Limited to specific services/teams
  - Can only view/edit explicitly granted objects
  - Always subject to object permissions

limited_stakeholder:
  - Can only view high-level status
  - No incident details
  - Intended for executives/stakeholders
  - Very restricted access
*/

-- ============================================
-- 6. DEFAULT PERMISSIONS FOR EXISTING RESOURCES
-- ============================================
-- Grant existing team managers 'manager' team role
INSERT INTO team_member_roles (team_id, user_id, role)
SELECT tm.team_id, tm.user_id, 'manager'
FROM team_memberships tm
WHERE tm.role = 'manager'
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Grant existing team members 'responder' team role
INSERT INTO team_member_roles (team_id, user_id, role)
SELECT tm.team_id, tm.user_id, 'responder'
FROM team_memberships tm
WHERE tm.role = 'member'
ON CONFLICT (team_id, user_id) DO NOTHING;

COMMENT ON TABLE team_member_roles IS 'Per-team role assignments for users';
COMMENT ON TABLE object_permissions IS 'Object-level access control for resources';
COMMENT ON COLUMN users.base_role IS 'Organization-wide base role (PagerDuty RBAC compatible)';
COMMENT ON COLUMN teams.privacy IS 'Team visibility: public (all users can see) or private (restricted access)';
