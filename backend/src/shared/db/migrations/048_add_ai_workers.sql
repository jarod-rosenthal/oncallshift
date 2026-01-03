-- AI Workers System Tables
-- Enables autonomous AI employees to pick up Jira tasks and execute them

-- AI Worker Instances (the "employees")
CREATE TABLE ai_worker_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    persona VARCHAR(50) NOT NULL, -- 'developer', 'qa_engineer', 'devops', 'tech_writer', 'support', 'pm'
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'idle', -- 'idle', 'working', 'paused', 'disabled'
    current_task_id UUID, -- References ai_worker_tasks (added after table creation)
    config JSONB NOT NULL DEFAULT '{}',
    -- Performance metrics
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    tasks_failed INTEGER NOT NULL DEFAULT 0,
    tasks_cancelled INTEGER NOT NULL DEFAULT 0,
    avg_completion_time_seconds INTEGER,
    total_tokens_used BIGINT NOT NULL DEFAULT 0,
    total_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,
    last_task_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Worker Tasks (work items from Jira)
CREATE TABLE ai_worker_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Jira reference
    jira_issue_key VARCHAR(50) NOT NULL, -- e.g., 'OCS-123'
    jira_issue_id VARCHAR(50) NOT NULL,
    jira_project_key VARCHAR(20) NOT NULL,
    jira_project_type VARCHAR(50) NOT NULL, -- 'software', 'service_desk', 'business'
    jira_issue_type VARCHAR(50) NOT NULL, -- 'Story', 'Bug', 'Task', etc.
    -- Task content
    summary VARCHAR(500) NOT NULL,
    description TEXT,
    jira_fields JSONB NOT NULL DEFAULT '{}',
    -- Worker assignment
    worker_persona VARCHAR(50) NOT NULL,
    assigned_worker_id UUID REFERENCES ai_worker_instances(id) ON DELETE SET NULL,
    -- Execution state
    status VARCHAR(30) NOT NULL DEFAULT 'queued',
    priority INTEGER NOT NULL DEFAULT 3, -- 1=highest, 5=lowest
    -- GitHub integration
    github_repo VARCHAR(255) NOT NULL,
    github_branch VARCHAR(255),
    github_pr_number INTEGER,
    github_pr_url VARCHAR(500),
    -- ECS task tracking
    ecs_task_arn VARCHAR(500),
    ecs_task_id VARCHAR(100),
    -- Cost tracking
    claude_input_tokens INTEGER NOT NULL DEFAULT 0,
    claude_output_tokens INTEGER NOT NULL DEFAULT 0,
    ecs_task_seconds INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,
    -- Execution metadata
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for current_task_id now that tasks table exists
ALTER TABLE ai_worker_instances
    ADD CONSTRAINT fk_ai_worker_instances_current_task
    FOREIGN KEY (current_task_id) REFERENCES ai_worker_tasks(id) ON DELETE SET NULL;

-- AI Worker Task Logs (execution history)
CREATE TABLE ai_worker_task_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES ai_worker_tasks(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'status_change', 'command_executed', 'file_changed', etc.
    message TEXT NOT NULL,
    metadata JSONB,
    severity VARCHAR(20) NOT NULL DEFAULT 'info', -- 'debug', 'info', 'warning', 'error'
    -- Command execution details
    command TEXT,
    exit_code INTEGER,
    stdout TEXT,
    stderr TEXT,
    -- File operation details
    file_path VARCHAR(500),
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Worker Conversations (Claude agent chat history)
CREATE TABLE ai_worker_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES ai_worker_tasks(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES ai_worker_instances(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'active', -- 'active', 'completed', 'failed', 'paused'
    system_prompt TEXT,
    messages JSONB NOT NULL DEFAULT '[]',
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    turn_count INTEGER NOT NULL DEFAULT 0,
    model VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Worker Approvals (human-in-the-loop)
CREATE TABLE ai_worker_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES ai_worker_tasks(id) ON DELETE CASCADE,
    approval_type VARCHAR(50) NOT NULL, -- 'pr_review', 'dangerous_operation', 'infrastructure', etc.
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'auto_approved', 'expired'
    description TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    responded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    response_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ai_worker_instances_org ON ai_worker_instances(org_id);
CREATE INDEX idx_ai_worker_instances_status ON ai_worker_instances(status);
CREATE INDEX idx_ai_worker_instances_persona ON ai_worker_instances(persona);

CREATE INDEX idx_ai_worker_tasks_org ON ai_worker_tasks(org_id);
CREATE INDEX idx_ai_worker_tasks_status ON ai_worker_tasks(status);
CREATE INDEX idx_ai_worker_tasks_jira_key ON ai_worker_tasks(jira_issue_key);
CREATE INDEX idx_ai_worker_tasks_worker ON ai_worker_tasks(assigned_worker_id);
CREATE INDEX idx_ai_worker_tasks_created ON ai_worker_tasks(created_at);
CREATE INDEX idx_ai_worker_tasks_priority ON ai_worker_tasks(priority, created_at);

CREATE INDEX idx_ai_worker_task_logs_task ON ai_worker_task_logs(task_id);
CREATE INDEX idx_ai_worker_task_logs_created ON ai_worker_task_logs(created_at);
CREATE INDEX idx_ai_worker_task_logs_type ON ai_worker_task_logs(type);

CREATE INDEX idx_ai_worker_conversations_task ON ai_worker_conversations(task_id);
CREATE INDEX idx_ai_worker_conversations_worker ON ai_worker_conversations(worker_id);

CREATE INDEX idx_ai_worker_approvals_task ON ai_worker_approvals(task_id);
CREATE INDEX idx_ai_worker_approvals_status ON ai_worker_approvals(status);
CREATE INDEX idx_ai_worker_approvals_pending ON ai_worker_approvals(status, requested_at) WHERE status = 'pending';

-- Unique constraint: one pending task per Jira issue
CREATE UNIQUE INDEX idx_ai_worker_tasks_jira_unique_active
    ON ai_worker_tasks(org_id, jira_issue_key)
    WHERE status NOT IN ('completed', 'failed', 'cancelled');
