-- Migration: Add Business Services & Dependencies
-- Description: Enables business service hierarchy and service dependency mapping

-- Business Services table
-- High-level services that represent business capabilities
CREATE TABLE IF NOT EXISTS business_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Ownership
    owner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    point_of_contact_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'degraded', 'major_outage', 'maintenance', 'unknown')),

    -- Impact tier for prioritization
    impact_tier VARCHAR(20) DEFAULT 'tier_3' CHECK (impact_tier IN ('tier_1', 'tier_2', 'tier_3', 'tier_4')),
    -- tier_1: Critical business impact
    -- tier_2: Significant business impact
    -- tier_3: Moderate business impact
    -- tier_4: Minimal business impact

    -- External references
    external_id VARCHAR(255),
    documentation_url TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique name per org
    CONSTRAINT unique_business_service_name_per_org UNIQUE (org_id, name)
);

-- Service Dependencies table
-- Maps relationships between technical services
CREATE TABLE IF NOT EXISTS service_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- The service that depends on another
    dependent_service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

    -- The service being depended upon (upstream)
    supporting_service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,

    -- Dependency type
    dependency_type VARCHAR(50) NOT NULL DEFAULT 'required' CHECK (dependency_type IN ('required', 'optional', 'runtime', 'development')),

    -- Impact level when the supporting service is down
    impact_level VARCHAR(20) NOT NULL DEFAULT 'high' CHECK (impact_level IN ('critical', 'high', 'medium', 'low')),

    -- Description of the dependency
    description TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate dependencies
    CONSTRAINT unique_service_dependency UNIQUE (dependent_service_id, supporting_service_id),
    -- Prevent self-dependencies
    CONSTRAINT no_self_dependency CHECK (dependent_service_id != supporting_service_id)
);

-- Add business_service_id to services table
ALTER TABLE services
ADD COLUMN IF NOT EXISTS business_service_id UUID REFERENCES business_services(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_services_org_id ON business_services(org_id);
CREATE INDEX IF NOT EXISTS idx_business_services_owner_team ON business_services(owner_team_id);
CREATE INDEX IF NOT EXISTS idx_business_services_status ON business_services(status);
CREATE INDEX IF NOT EXISTS idx_service_dependencies_org_id ON service_dependencies(org_id);
CREATE INDEX IF NOT EXISTS idx_service_dependencies_dependent ON service_dependencies(dependent_service_id);
CREATE INDEX IF NOT EXISTS idx_service_dependencies_supporting ON service_dependencies(supporting_service_id);
CREATE INDEX IF NOT EXISTS idx_services_business_service ON services(business_service_id);

-- Apply triggers for updated_at
DROP TRIGGER IF EXISTS update_business_services_updated_at ON business_services;
CREATE TRIGGER update_business_services_updated_at
    BEFORE UPDATE ON business_services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_dependencies_updated_at ON service_dependencies;
CREATE TRIGGER update_service_dependencies_updated_at
    BEFORE UPDATE ON service_dependencies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Example structure:
--
-- Business Service: "E-Commerce Platform"
--   - Technical Service: "Payment Processing API"
--     - Depends on: "Database Cluster" (critical)
--     - Depends on: "Redis Cache" (high)
--   - Technical Service: "Order Management"
--     - Depends on: "Payment Processing API" (required)
--     - Depends on: "Inventory Service" (required)
--   - Technical Service: "User Authentication"
--     - Depends on: "Database Cluster" (critical)
