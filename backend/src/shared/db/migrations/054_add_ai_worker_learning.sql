-- Migration: 054_add_ai_worker_learning.sql
-- Add tables for AI Worker learning system (Phase 4)
-- Tracks tool events, patterns, and cross-task learning

-- Add fields to tasks for learning tracking
ALTER TABLE ai_worker_tasks
ADD COLUMN IF NOT EXISTS tool_error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tool_retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS learning_analyzed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS patterns_applied JSONB DEFAULT '[]';

-- Table: ai_worker_tool_events
-- Captures every tool call during task execution
CREATE TABLE IF NOT EXISTS ai_worker_tool_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ai_worker_tasks(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Tool identification
  tool_name VARCHAR(100) NOT NULL, -- 'Bash', 'Edit', 'Read', 'Write', 'Grep', etc.
  tool_category VARCHAR(50), -- 'file', 'shell', 'search', 'git', 'api'

  -- Execution details
  input_summary TEXT, -- Truncated input for storage (first 2000 chars)
  input_hash VARCHAR(64), -- SHA256 of full input for deduplication
  output_summary TEXT, -- Truncated output (first 2000 chars)

  -- Result tracking
  success BOOLEAN NOT NULL,
  error_type VARCHAR(50), -- 'permission', 'timeout', 'not_found', 'syntax', 'git', 'network', 'auth', null
  error_message TEXT,

  -- Sequencing
  sequence_number INTEGER NOT NULL, -- Order in execution (1, 2, 3...)
  attempt_number INTEGER DEFAULT 1, -- Which attempt at this operation (for retries)

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_ms INTEGER NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for tool events
CREATE INDEX IF NOT EXISTS idx_tool_events_task_id ON ai_worker_tool_events(task_id);
CREATE INDEX IF NOT EXISTS idx_tool_events_org_id ON ai_worker_tool_events(org_id);
CREATE INDEX IF NOT EXISTS idx_tool_events_tool_name ON ai_worker_tool_events(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_events_error_type ON ai_worker_tool_events(error_type) WHERE error_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tool_events_sequence ON ai_worker_tool_events(task_id, sequence_number);


-- Table: ai_worker_tool_patterns
-- Aggregated learnings from tool events
CREATE TABLE IF NOT EXISTS ai_worker_tool_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- null = global pattern

  -- Pattern identification
  pattern_type VARCHAR(30) NOT NULL CHECK (pattern_type IN ('error_recovery', 'best_practice', 'anti_pattern')),
  tool_name VARCHAR(100) NOT NULL,
  error_type VARCHAR(50), -- null for best_practice patterns

  -- Pattern content
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  trigger_conditions JSONB DEFAULT '{}', -- JSON matching rules
  recommended_approach TEXT NOT NULL, -- Markdown description of what to do

  -- Effectiveness tracking
  effectiveness_score DECIMAL(3, 2) DEFAULT 0.00, -- 0.00 to 1.00
  times_applied INTEGER DEFAULT 0,
  times_succeeded INTEGER DEFAULT 0,

  -- Lifecycle
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'pending_review')),
  source_task_id UUID REFERENCES ai_worker_tasks(id) ON DELETE SET NULL, -- Task that created this pattern

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for patterns
CREATE INDEX IF NOT EXISTS idx_tool_patterns_org_id ON ai_worker_tool_patterns(org_id);
CREATE INDEX IF NOT EXISTS idx_tool_patterns_tool_name ON ai_worker_tool_patterns(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_patterns_error_type ON ai_worker_tool_patterns(error_type) WHERE error_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tool_patterns_status ON ai_worker_tool_patterns(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_tool_patterns_effectiveness ON ai_worker_tool_patterns(effectiveness_score DESC) WHERE status = 'active';

-- Unique constraint to prevent duplicate patterns
CREATE UNIQUE INDEX IF NOT EXISTS idx_tool_patterns_unique
ON ai_worker_tool_patterns(COALESCE(org_id, '00000000-0000-0000-0000-000000000000'), tool_name, error_type, title)
WHERE status = 'active';


-- Table: ai_worker_learning_sessions
-- Records Manager's post-task analysis sessions
CREATE TABLE IF NOT EXISTS ai_worker_learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ai_worker_tasks(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Analysis metadata
  triggered_by VARCHAR(30) NOT NULL CHECK (triggered_by IN ('task_completion', 'error_threshold', 'manual', 'scheduled')),
  analysis_model VARCHAR(50) NOT NULL, -- 'claude-3-5-haiku-20241022', etc.

  -- Analysis results
  tool_events_analyzed INTEGER NOT NULL,
  retry_sequences_found INTEGER DEFAULT 0,
  patterns_extracted INTEGER DEFAULT 0,
  directive_updates_suggested INTEGER DEFAULT 0,
  environment_updates_suggested INTEGER DEFAULT 0,

  -- Raw analysis output
  analysis_prompt TEXT,
  analysis_response JSONB,

  -- Actions taken
  patterns_created UUID[], -- Array of pattern IDs created
  directive_prs_created TEXT[], -- Array of PR URLs for directive updates
  environment_prs_created TEXT[], -- Array of PR URLs for environment updates

  -- Cost tracking
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'analyzing', 'completed', 'failed')),
  error_message TEXT,

  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for learning sessions
CREATE INDEX IF NOT EXISTS idx_learning_sessions_task_id ON ai_worker_learning_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_org_id ON ai_worker_learning_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_status ON ai_worker_learning_sessions(status);


-- Table: ai_worker_pattern_applications
-- Tracks when patterns are injected and their effectiveness
CREATE TABLE IF NOT EXISTS ai_worker_pattern_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL REFERENCES ai_worker_tool_patterns(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES ai_worker_tasks(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Application context
  injected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Effectiveness tracking (updated after task completes)
  task_completed BOOLEAN DEFAULT FALSE,
  pattern_tool_used BOOLEAN, -- Did the task use the tool this pattern addresses?
  pattern_helped BOOLEAN, -- If tool was used, did the pattern help (no errors)?

  -- Verification
  verified_at TIMESTAMP WITH TIME ZONE,
  verification_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for pattern applications
CREATE INDEX IF NOT EXISTS idx_pattern_applications_pattern_id ON ai_worker_pattern_applications(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_applications_task_id ON ai_worker_pattern_applications(task_id);
CREATE INDEX IF NOT EXISTS idx_pattern_applications_unverified ON ai_worker_pattern_applications(task_completed) WHERE task_completed = FALSE;


-- Seed some initial global patterns based on common issues
INSERT INTO ai_worker_tool_patterns (
  org_id, pattern_type, tool_name, error_type, title, description,
  trigger_conditions, recommended_approach, effectiveness_score, status
) VALUES
(
  NULL, 'error_recovery', 'Bash', 'permission',
  'Use sudo for permission errors',
  'When bash commands fail with "permission denied" or "EACCES" errors, the command likely needs elevated privileges.',
  '{"error_contains": ["permission denied", "EACCES", "Operation not permitted"]}',
  'Try prefixing the command with `sudo`. If that fails, check if the file/directory permissions need to be changed with `chmod`.',
  0.75, 'active'
),
(
  NULL, 'best_practice', 'Bash', NULL,
  'Always fetch before push',
  'Git push often fails if the remote has new commits that you dont have locally.',
  '{"command_contains": ["git push"]}',
  'Before running `git push`, always run `git fetch && git rebase origin/main` (or the appropriate branch) to ensure you have the latest changes.',
  0.85, 'active'
),
(
  NULL, 'error_recovery', 'Bash', 'not_found',
  'Check PATH for command not found',
  'When a command is not found, it may be installed but not in PATH, or not installed at all.',
  '{"error_contains": ["command not found", "not found in PATH"]}',
  'First check if the tool is installed: `which <tool>` or `<tool> --version`. If not found, install it. If installed but not in PATH, use the full path or add to PATH.',
  0.70, 'active'
),
(
  NULL, 'error_recovery', 'Edit', 'not_found',
  'Read file before editing',
  'Edit tool requires the exact content to replace. If old_string is not found, the file may have different content than expected.',
  '{"error_contains": ["old_string not found", "not unique"]}',
  'Always use the Read tool first to see the current file contents. Copy the exact text you want to replace, preserving whitespace and indentation.',
  0.90, 'active'
),
(
  NULL, 'anti_pattern', 'Bash', NULL,
  'Avoid Git Bash shell parsing issues',
  'Git Bash on Windows has severe limitations with command substitution and variable expansion.',
  '{"command_contains": ["$(", "${"], "platform": "win32"}',
  'When commands fail with syntax errors involving $() or ${}, delegate to a Task agent which runs in WSL where these issues dont exist.',
  0.80, 'active'
)
ON CONFLICT DO NOTHING;


-- Comments
COMMENT ON TABLE ai_worker_tool_events IS 'Records every tool call during AI Worker task execution for learning analysis';
COMMENT ON TABLE ai_worker_tool_patterns IS 'Aggregated learnings extracted from tool events - what works and what doesnt';
COMMENT ON TABLE ai_worker_learning_sessions IS 'Records of Manager analyzing completed tasks for learnings';
COMMENT ON TABLE ai_worker_pattern_applications IS 'Tracks when patterns are injected into tasks and their effectiveness';

COMMENT ON COLUMN ai_worker_tasks.tool_error_count IS 'Number of tool calls that failed during this task';
COMMENT ON COLUMN ai_worker_tasks.tool_retry_count IS 'Number of tool retry attempts during this task';
COMMENT ON COLUMN ai_worker_tasks.learning_analyzed IS 'Whether this task has been analyzed for learnings by the Manager';
COMMENT ON COLUMN ai_worker_tasks.patterns_applied IS 'Array of pattern IDs that were injected for this task';
