-- Migration: Add Postmortems (Incident Retrospectives)
-- Enables teams to document lessons learned, root causes, and action items from resolved incidents

-- Create postmortem_templates table
CREATE TABLE IF NOT EXISTS postmortem_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sections JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(org_id, name)
);

-- Create postmortems table
CREATE TABLE IF NOT EXISTS postmortems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' NOT NULL,
    summary TEXT,
    timeline JSONB DEFAULT '[]'::jsonb,
    root_cause TEXT,
    contributing_factors JSONB DEFAULT '[]'::jsonb,
    impact TEXT,
    what_went_well TEXT,
    what_could_be_improved TEXT,
    action_items JSONB DEFAULT '[]'::jsonb,
    custom_sections JSONB,
    template_id UUID REFERENCES postmortem_templates(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMP,
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_status CHECK (status IN ('draft', 'in_review', 'published')),
    UNIQUE(incident_id) -- One postmortem per incident
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_postmortem_templates_org_id ON postmortem_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_postmortem_templates_default ON postmortem_templates(org_id, is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_postmortems_org_id ON postmortems(org_id);
CREATE INDEX IF NOT EXISTS idx_postmortems_incident_id ON postmortems(incident_id);
CREATE INDEX IF NOT EXISTS idx_postmortems_status ON postmortems(org_id, status);
CREATE INDEX IF NOT EXISTS idx_postmortems_created_at ON postmortems(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_postmortems_published_at ON postmortems(org_id, published_at DESC) WHERE published_at IS NOT NULL;

-- Add GIN indexes for JSONB columns to enable efficient searching
CREATE INDEX IF NOT EXISTS idx_postmortems_action_items ON postmortems USING GIN (action_items);
CREATE INDEX IF NOT EXISTS idx_postmortems_timeline ON postmortems USING GIN (timeline);

-- Add comments for documentation
COMMENT ON TABLE postmortem_templates IS 'Reusable templates for postmortem structure - defines sections and prompts';
COMMENT ON TABLE postmortems IS 'Incident postmortems (retrospectives) - documents root cause, timeline, and action items';
COMMENT ON COLUMN postmortems.status IS 'Draft postmortems are editable, published postmortems are read-only';
COMMENT ON COLUMN postmortems.timeline IS 'Chronological timeline of events during the incident';
COMMENT ON COLUMN postmortems.action_items IS 'Array of action items to prevent recurrence';
COMMENT ON COLUMN postmortems.custom_sections IS 'Template-defined custom sections with user-provided content';
