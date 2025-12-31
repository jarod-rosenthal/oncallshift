-- Migration: Add Tags & Custom Fields
-- Description: Enables tagging/labeling of entities for organization and filtering

-- Tags table
-- Stores tag definitions for an organization
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#6b7280',

    -- Optional description
    description TEXT,

    -- Usage tracking
    usage_count INT NOT NULL DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique tag names per org
    CONSTRAINT unique_tag_name_per_org UNIQUE (org_id, name)
);

-- Entity Tags table (junction table)
-- Links tags to various entities (services, incidents, business_services, etc.)
CREATE TABLE IF NOT EXISTS entity_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

    -- Entity reference (polymorphic)
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
        'service',
        'incident',
        'business_service',
        'schedule',
        'escalation_policy',
        'runbook',
        'user',
        'team'
    )),
    entity_id UUID NOT NULL,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate tags on same entity
    CONSTRAINT unique_tag_per_entity UNIQUE (tag_id, entity_type, entity_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tags_org_id ON tags(org_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(org_id, name);
CREATE INDEX IF NOT EXISTS idx_entity_tags_org_id ON entity_tags(org_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_tag_id ON entity_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity_type ON entity_tags(org_id, entity_type);

-- Apply trigger for updated_at
DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
CREATE TRIGGER update_tags_updated_at
    BEFORE UPDATE ON tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update tag usage count
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.tag_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tag_usage_count_trigger ON entity_tags;
CREATE TRIGGER update_tag_usage_count_trigger
    AFTER INSERT OR DELETE ON entity_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_tag_usage_count();

-- Example usage:
--
-- Create tags:
-- INSERT INTO tags (org_id, name, color) VALUES
--   ('org-uuid', 'production', '#ef4444'),
--   ('org-uuid', 'staging', '#f59e0b'),
--   ('org-uuid', 'critical', '#dc2626'),
--   ('org-uuid', 'database', '#3b82f6'),
--   ('org-uuid', 'api', '#8b5cf6');
--
-- Tag a service:
-- INSERT INTO entity_tags (org_id, tag_id, entity_type, entity_id)
-- VALUES ('org-uuid', 'tag-uuid', 'service', 'service-uuid');
--
-- Find all entities with a tag:
-- SELECT entity_type, entity_id FROM entity_tags WHERE tag_id = 'tag-uuid';
--
-- Find all tags for an entity:
-- SELECT t.* FROM tags t
-- JOIN entity_tags et ON et.tag_id = t.id
-- WHERE et.entity_type = 'service' AND et.entity_id = 'service-uuid';
