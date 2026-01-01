-- Migration: Add Incident Workflows (Response Plays)
-- Enables automated actions based on incident events and conditions

-- Create incident_workflows table
CREATE TABLE IF NOT EXISTS incident_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    trigger_type VARCHAR(20) DEFAULT 'manual' NOT NULL,
    trigger_events JSONB DEFAULT '[]'::jsonb,
    match_type VARCHAR(20) DEFAULT 'all',
    conditions JSONB DEFAULT '[]'::jsonb,
    service_ids JSONB,
    team_ids JSONB,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create workflow_actions table
CREATE TABLE IF NOT EXISTS workflow_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES incident_workflows(id) ON DELETE CASCADE,
    action_order INT DEFAULT 0,
    action_type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    condition_field VARCHAR(255),
    condition_operator VARCHAR(50),
    condition_value VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create workflow_executions table for tracking/auditing
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES incident_workflows(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    trigger_type VARCHAR(50) NOT NULL,
    trigger_event VARCHAR(100),
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    action_results JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_incident_workflows_org_id ON incident_workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_incident_workflows_enabled ON incident_workflows(org_id, enabled);
CREATE INDEX IF NOT EXISTS idx_incident_workflows_trigger_type ON incident_workflows(org_id, trigger_type);

CREATE INDEX IF NOT EXISTS idx_workflow_actions_workflow_id ON workflow_actions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_order ON workflow_actions(workflow_id, action_order);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_incident_id ON workflow_executions(incident_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_org_status ON workflow_executions(org_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at ON workflow_executions(created_at);

-- Add trigger_events index for efficient automatic workflow lookup using GIN
CREATE INDEX IF NOT EXISTS idx_incident_workflows_trigger_events ON incident_workflows USING GIN (trigger_events);

-- Add comment for documentation
COMMENT ON TABLE incident_workflows IS 'Incident workflows (similar to PagerDuty Response Plays) - automated actions triggered by incident events';
COMMENT ON TABLE workflow_actions IS 'Actions that are executed as part of a workflow';
COMMENT ON TABLE workflow_executions IS 'Execution history for workflow runs - used for auditing and debugging';
