-- Runbook Executions tracking
CREATE TABLE runbook_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    runbook_id UUID NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,

    -- Execution tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled', 'requires_approval'
    current_step_index INT DEFAULT 0,

    -- Executor information
    started_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Results
    step_results JSONB DEFAULT '[]', -- Array of {stepId, status, output, error, startedAt, completedAt, exitCode}
    error_message TEXT,

    -- Claude integration
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,

    -- Metadata
    execution_context JSONB, -- Incident context, credentials used, etc.

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Runbook Execution Approvals (for steps requiring human approval)
CREATE TABLE runbook_execution_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES runbook_executions(id) ON DELETE CASCADE,
    step_index INT NOT NULL,

    -- Approval details
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    responded_at TIMESTAMP WITH TIME ZONE,
    responded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    response_notes TEXT,

    -- Script details for approval
    script_language VARCHAR(50),
    script_code TEXT,
    script_description TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for runbook_executions
CREATE INDEX idx_runbook_executions_org ON runbook_executions(org_id);
CREATE INDEX idx_runbook_executions_runbook ON runbook_executions(runbook_id);
CREATE INDEX idx_runbook_executions_incident ON runbook_executions(incident_id);
CREATE INDEX idx_runbook_executions_started_by ON runbook_executions(started_by);
CREATE INDEX idx_runbook_executions_status ON runbook_executions(status);
CREATE INDEX idx_runbook_executions_created ON runbook_executions(created_at DESC);

-- Indexes for runbook_execution_approvals
CREATE INDEX idx_runbook_execution_approvals_execution ON runbook_execution_approvals(execution_id);
CREATE INDEX idx_runbook_execution_approvals_status ON runbook_execution_approvals(status);
CREATE INDEX idx_runbook_execution_approvals_requested_by ON runbook_execution_approvals(requested_by);
CREATE INDEX idx_runbook_execution_approvals_responded_by ON runbook_execution_approvals(responded_by);
