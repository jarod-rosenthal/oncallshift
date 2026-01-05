# AI Workers: DOE Framework Implementation Plan

**Created:** January 4, 2026
**Status:** APPROVED
**Manager Review:** Disabled by default (optional for complex tasks)
**Goal:** Align AI Workers system with the Directive-Orchestration-Execution (DOE) framework for more productive autonomous agents

---

## DOE Framework Reference

From the canonical DOE specification:

> You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

### The 3 Layers

| Layer | Purpose | Implementation |
|-------|---------|----------------|
| **Directive** | SOPs written in Markdown defining goals, inputs, tools, outputs, edge cases | `directives/` folder with `.md` files |
| **Orchestration** | AI reads directives, calls tools in order, handles errors, updates directives | The AI agent itself (Claude) |
| **Execution** | Deterministic scripts that handle API calls, data processing, file operations | `execution/` folder with Python/TS scripts |

### Core Principles

1. **Check for tools first** - Before writing a script, check if one exists
2. **Self-anneal when things break** - Fix script → test → update directive with learnings
3. **Update directives as you learn** - Living documents that improve over time

### Why This Works

> "90% accuracy per step = 59% success over 5 steps. Push complexity into deterministic code."

The AI focuses on **decision-making** while deterministic scripts handle **execution**.

---

## Executive Summary

Our current AI Workers system is production-quality with comprehensive safety guardrails, cost tracking, and error recovery. However, it lacks the **separation of concerns** that the DOE framework provides:

| Layer | DOE Purpose | Current State | Gap |
|-------|-------------|---------------|-----|
| **Directive** | SOPs in Markdown (`directives/`) | Ad-hoc Jira → bash instructions | No reusable directives |
| **Orchestration** | AI reads directives, routes to tools | Claude Code does everything itself | No tool-first approach |
| **Execution** | Deterministic scripts (`execution/`) | Claude's tools only | No pre-built scripts |

**Key Insight:** We need to stop having Claude Code do everything. Instead:
1. Create **directive templates** for common task types
2. Build **execution scripts** for deterministic operations
3. Let Claude **orchestrate** by reading directives and calling scripts

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT FLOW                              │
└─────────────────────────────────────────────────────────────────┘

Jira Issue (labeled ai-worker)
        │
        ▼
┌───────────────────┐
│ Jira Webhook      │ Creates AIWorkerTask (status: queued)
│ ai-worker-webhooks│ Sends to SQS
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Watcher Lambda    │ Every 5 min: finds queued tasks
│ (5-min schedule)  │ Spawns ECS Executor
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ ECS Executor      │ Claude Code runs with Jira description
│ (Fargate Spot)    │ Makes changes, creates PR
│                   │ NO PLANNING - just executes
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Manager Lambda    │ Reviews PR with Opus 4.5
│ (event-driven)    │ Approves/Rejects/Requests Revision
└───────────────────┘
```

**Problems:**
1. No analysis of Jira issue completeness before execution
2. No implementation plan for human review
3. Claude Code makes decisions AND executes simultaneously
4. Wasted ECS time when requirements are unclear
5. No learning from successful patterns

---

## Proposed Architecture (DOE-Aligned)

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOE FLOW                                  │
└─────────────────────────────────────────────────────────────────┘

Jira Issue (labeled ai-worker)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ DIRECTIVE LAYER                                                │
│                                                                │
│ ┌─────────────────┐    ┌──────────────────┐                   │
│ │ Jira Webhook    │───▶│ Planner Lambda   │                   │
│ │                 │    │ (Claude Haiku)   │                   │
│ └─────────────────┘    │                  │                   │
│                        │ 1. Analyze issue │                   │
│                        │ 2. Check completeness │               │
│                        │ 3. Search codebase │                  │
│                        │ 4. Create impl plan │                 │
│                        │ 5. Estimate effort │                  │
│                        └────────┬─────────┘                   │
│                                 │                              │
│                                 ▼                              │
│                        ┌──────────────────┐                   │
│                        │ Plan Stored      │                   │
│                        │ status: plan_ready│                  │
│                        └────────┬─────────┘                   │
│                                 │                              │
│                        [Optional: Human Approval]              │
└─────────────────────────────────┼──────────────────────────────┘
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────┐
│ ORCHESTRATION LAYER                                            │
│                                                                │
│ ┌─────────────────┐                                           │
│ │ Watcher Lambda  │ Finds plan_ready tasks                    │
│ │ (5-min schedule)│ Validates plan is approved                │
│ │                 │ Dispatches to execution                   │
│ └─────────┬───────┘                                           │
│           │                                                    │
│           ▼                                                    │
│ ┌─────────────────┐                                           │
│ │ Decision Gate   │ Check: Is plan complete?                  │
│ │                 │ Check: Budget available?                  │
│ │                 │ Check: Worker available?                  │
│ └─────────┬───────┘                                           │
└───────────┼────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────┐
│ EXECUTION LAYER                                                │
│                                                                │
│ ┌─────────────────┐                                           │
│ │ ECS Executor    │ Receives structured plan                  │
│ │ (Fargate Spot)  │ Follows plan step-by-step                 │
│ │                 │ Reports progress per step                 │
│ │                 │ Creates PR when complete                  │
│ └─────────┬───────┘                                           │
│           │                                                    │
│           ▼                                                    │
│ ┌─────────────────┐                                           │
│ │ Manager Lambda  │ Reviews against plan + requirements       │
│ │ (Opus 4.5)      │ Approves/Rejects/Revises                  │
│ └─────────────────┘                                           │
└───────────────────────────────────────────────────────────────┘
```

---

---

## DOE-Aligned Directory Structure

Following the canonical DOE pattern, we add these directories to the AI Worker executor:

```
backend/ai-worker/
├── directives/                     # Layer 1: SOPs in Markdown
│   ├── common/
│   │   ├── git_workflow.md         # How to branch, commit, push, PR
│   │   ├── test_before_commit.md   # Run tests, fix failures, then commit
│   │   ├── code_review_response.md # How to handle revision requests
│   │   └── error_handling.md       # Standard error recovery patterns
│   │
│   ├── backend_developer/
│   │   ├── add_api_endpoint.md     # Steps to add Express route
│   │   ├── add_database_model.md   # Steps to add TypeORM entity
│   │   ├── fix_bug.md              # Bug investigation and fix
│   │   └── refactor_code.md        # Safe refactoring steps
│   │
│   ├── frontend_developer/
│   │   ├── add_page.md             # Add React page component
│   │   ├── add_component.md        # Add reusable component
│   │   └── fix_ui_bug.md           # UI debugging steps
│   │
│   ├── devops_engineer/
│   │   ├── add_terraform.md        # Infrastructure changes
│   │   ├── update_dockerfile.md    # Container changes
│   │   └── fix_deployment.md       # Deployment debugging
│   │
│   └── qa_engineer/
│       ├── write_unit_tests.md     # Jest test patterns
│       ├── write_e2e_tests.md      # Playwright test patterns
│       └── increase_coverage.md    # Coverage improvement
│
├── execution/                      # Layer 3: Deterministic scripts
│   ├── git/
│   │   ├── create_branch.ts        # git checkout -b ai/{issue-key}
│   │   ├── commit_changes.ts       # Stage, commit with message
│   │   ├── push_branch.ts          # git push -u origin
│   │   └── create_pr.ts            # gh pr create with template
│   │
│   ├── test/
│   │   ├── run_tests.ts            # npm test with retry
│   │   ├── run_typecheck.ts        # npx tsc --noEmit
│   │   ├── run_lint.ts             # npm run lint
│   │   └── check_coverage.ts       # Coverage threshold check
│   │
│   ├── jira/
│   │   ├── add_comment.ts          # Post comment to issue
│   │   ├── transition_status.ts    # Move to In Progress/Done
│   │   └── link_pr.ts              # Add PR as remote link
│   │
│   ├── github/
│   │   ├── get_pr_status.ts        # Check CI status
│   │   ├── request_review.ts       # Add reviewers
│   │   └── merge_pr.ts             # Merge when approved
│   │
│   └── codebase/
│       ├── find_similar_code.ts    # Semantic search for patterns
│       ├── check_conventions.ts    # Verify code style
│       └── validate_changes.ts     # Safety checks before commit
│
├── .tmp/                           # Intermediate files (gitignored)
│   ├── analysis/                   # Codebase analysis results
│   ├── diffs/                      # Generated diffs for review
│   └── logs/                       # Execution logs
│
└── AGENTS.md                       # Instructions for Claude
```

---

## Directive Template Example

```markdown
# directives/backend_developer/add_api_endpoint.md

# Add API Endpoint

> SOP for adding a new REST API endpoint to the backend.

## Goal
Add a new API endpoint that follows existing patterns in the codebase.

## Inputs
- **Jira Issue**: Summary and description of the endpoint
- **Endpoint Path**: e.g., `/api/v1/widgets`
- **HTTP Methods**: GET, POST, PUT, DELETE as needed

## Pre-flight Checks
1. Run `execution/codebase/find_similar_code.ts` to find existing similar endpoints
2. Check `backend/src/api/routes/` for naming patterns
3. Verify the related model exists in `backend/src/shared/models/`

## Steps

### Step 1: Create Route File
- Location: `backend/src/api/routes/{resource}.ts`
- Use existing route as template (find with `find_similar_code.ts`)
- Include: router, authentication middleware, validation

### Step 2: Add Validation Schema
- Use Zod for request validation
- Follow patterns in `backend/src/shared/validators/`

### Step 3: Register Route
- Add import to `backend/src/api/app.ts`
- Register with `app.use('/api/v1/{resource}', router)`

### Step 4: Add Tests
- Create `backend/src/api/routes/__tests__/{resource}.test.ts`
- Test: happy path, validation errors, auth errors, not found

### Step 5: Verify
- Run `execution/test/run_tests.ts`
- Run `execution/test/run_typecheck.ts`
- Run `execution/test/run_lint.ts`

## Outputs
- New route file with CRUD operations
- Validation schemas
- Unit tests with >80% coverage

## Edge Cases
- If model doesn't exist → Create model first (see `add_database_model.md`)
- If similar endpoint exists → Extend it instead of creating new
- If tests fail → Fix before committing (see `error_handling.md`)

## Self-Annealing Notes
<!-- Updated by AI workers when they learn something -->
- 2026-01-04: Added Swagger annotations after Manager requested them
- 2026-01-04: Must include Location header on POST responses (RFC 7231)
```

---

## Execution Script Example

```typescript
// execution/git/create_pr.ts

/**
 * Deterministic script to create a GitHub PR
 *
 * Inputs (via environment or stdin):
 * - BRANCH_NAME: The feature branch
 * - JIRA_KEY: Issue key for title
 * - JIRA_SUMMARY: Issue summary for title
 * - DESCRIPTION: PR body markdown
 *
 * Outputs (JSON to stdout):
 * - success: boolean
 * - pr_url: string (if success)
 * - pr_number: number (if success)
 * - error: string (if failure)
 */

import { execSync } from 'child_process';

interface CreatePRInput {
  branchName: string;
  jiraKey: string;
  jiraSummary: string;
  description: string;
}

interface CreatePROutput {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

export async function createPR(input: CreatePRInput): Promise<CreatePROutput> {
  try {
    // Ensure branch is pushed
    execSync(`git push -u origin ${input.branchName}`, { stdio: 'pipe' });

    // Create PR using gh CLI
    const title = `${input.jiraKey}: ${input.jiraSummary}`;
    const body = `## Summary

${input.description}

---
🤖 Generated by AI Worker
Jira: [${input.jiraKey}](https://oncallshift.atlassian.net/browse/${input.jiraKey})
`;

    const result = execSync(
      `gh pr create --title "${title}" --body "${body}" --json url,number`,
      { stdio: 'pipe', encoding: 'utf-8' }
    );

    const pr = JSON.parse(result);
    return {
      success: true,
      prUrl: pr.url,
      prNumber: pr.number,
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// CLI entry point
if (require.main === module) {
  const input: CreatePRInput = {
    branchName: process.env.BRANCH_NAME!,
    jiraKey: process.env.JIRA_KEY!,
    jiraSummary: process.env.JIRA_SUMMARY!,
    description: process.env.DESCRIPTION || '',
  };

  createPR(input).then(output => {
    console.log(JSON.stringify(output));
    process.exit(output.success ? 0 : 1);
  });
}
```

---

## Modified Entrypoint with DOE Pattern

```bash
# backend/scripts/ai-worker-entrypoint.sh (DOE-aligned)

#!/bin/bash
set -e

echo "[AI Worker] DOE Framework Initialization"
echo "Task ID: ${TASK_ID}"
echo "Jira Issue: ${JIRA_ISSUE_KEY}"
echo "Persona: ${WORKER_PERSONA}"

# Setup workspace
WORKSPACE="/home/aiworker/workspace"
DIRECTIVES_DIR="${WORKSPACE}/backend/ai-worker/directives"
EXECUTION_DIR="${WORKSPACE}/backend/ai-worker/execution"

# Clone repo
git clone "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" "${WORKSPACE}"
cd "${WORKSPACE}"

# Create branch using execution script
source "${EXECUTION_DIR}/git/create_branch.sh" "${JIRA_ISSUE_KEY}"

# Build AGENTS.md instructions for Claude
cat > /tmp/agents.md << 'EOF'
# Agent Instructions

You operate within a 3-layer architecture. Your job is ORCHESTRATION.

## Your Role
- Read directives from `directives/` to understand HOW to do things
- Call execution scripts from `execution/` to DO things
- Handle errors by fixing scripts and updating directives
- DO NOT write code directly - use existing patterns and scripts

## Current Task
EOF

cat >> /tmp/agents.md << EOF
- **Jira Issue**: ${JIRA_ISSUE_KEY}
- **Summary**: ${JIRA_SUMMARY}
- **Description**: ${JIRA_DESCRIPTION}
- **Persona**: ${WORKER_PERSONA}

## Directives Available
$(ls -la ${DIRECTIVES_DIR}/${WORKER_PERSONA}/ 2>/dev/null || echo "No persona-specific directives")

## Common Directives
$(ls -la ${DIRECTIVES_DIR}/common/)

## Execution Scripts Available
$(find ${EXECUTION_DIR} -name "*.ts" -o -name "*.sh" | head -20)

## Instructions
1. Read the relevant directive for this task type
2. Follow the steps in order
3. Use execution scripts instead of writing commands yourself
4. If a script fails, read the error, fix the script, test, then update the directive
5. When done, run the PR creation script

Start by determining which directive applies to this task.
EOF

# Run Claude with AGENTS.md as context
claude \
    --print \
    --dangerously-skip-permissions \
    --max-turns "${MAX_TURNS:-50}" \
    --model "${CLAUDE_MODEL:-haiku}" \
    --system-prompt "$(cat /tmp/agents.md)" \
    "Execute the task described above following the DOE framework."
```

---

## Implementation Phases

### Phase 1: Directives & Execution Scripts (High Priority)

**Goal:** Create the directive and execution layers following the DOE framework.

#### 1.1 Create Directory Structure

```bash
# Create the DOE directories in the repo
mkdir -p backend/ai-worker/directives/{common,backend_developer,frontend_developer,devops_engineer,qa_engineer}
mkdir -p backend/ai-worker/execution/{git,test,jira,github,codebase}
mkdir -p backend/ai-worker/.tmp
echo ".tmp/" >> backend/ai-worker/.gitignore
```

#### 1.2 Core Directives to Create

| Directive | Persona | Purpose |
|-----------|---------|---------|
| `common/git_workflow.md` | All | Branch, commit, push, PR creation |
| `common/test_before_commit.md` | All | Run tests, typecheck, lint before commit |
| `common/error_handling.md` | All | Standard recovery patterns |
| `common/self_annealing.md` | All | How to update directives/scripts after failures |
| `backend_developer/add_api_endpoint.md` | Backend | Express route creation |
| `backend_developer/add_database_model.md` | Backend | TypeORM entity creation |
| `backend_developer/fix_bug.md` | Backend | Bug investigation and fix |
| `frontend_developer/add_page.md` | Frontend | React page component |
| `frontend_developer/add_component.md` | Frontend | Reusable component |
| `qa_engineer/write_unit_tests.md` | QA | Jest test patterns |

#### 1.3 Core Execution Scripts to Create

| Script | Purpose | Inputs | Outputs |
|--------|---------|--------|---------|
| `git/create_branch.ts` | Create feature branch | `jiraKey` | `branchName` |
| `git/commit_changes.ts` | Stage and commit | `message`, `files` | `commitSha` |
| `git/create_pr.ts` | Create PR | `title`, `body` | `prUrl`, `prNumber` |
| `test/run_tests.ts` | Run Jest tests | `testPath?` | `passed`, `failures` |
| `test/run_typecheck.ts` | TypeScript check | - | `passed`, `errors` |
| `jira/add_comment.ts` | Post Jira comment | `issueKey`, `comment` | `success` |
| `jira/transition_status.ts` | Move issue status | `issueKey`, `status` | `success` |
| `codebase/find_similar_code.ts` | Find patterns | `query` | `files[]` |

#### 1.4 AGENTS.md Template

Create `backend/ai-worker/AGENTS.md`:

```markdown
# Agent Instructions

> This file provides context to Claude Code when executing AI Worker tasks.

You operate within a 3-layer architecture that separates concerns:

## Layer 1: Directive (What to do)
- SOPs in `directives/` defining goals, steps, edge cases
- Read the relevant directive FIRST before doing anything

## Layer 2: Orchestration (You)
- Read directives, call execution scripts, handle errors
- You're the decision-maker, not the executor
- DO NOT write code directly - use scripts from `execution/`

## Layer 3: Execution (Tools)
- Deterministic TypeScript scripts in `execution/`
- Call these instead of running commands yourself

## Self-Annealing
When something breaks:
1. Fix the script
2. Test it works
3. Update the directive with what you learned
4. System is now stronger

## Key Principle
> "90% accuracy per step = 59% success over 5 steps. Push complexity into deterministic code."
```

#### 1.5 Update Dockerfile

Add the DOE directories to the AI Worker Docker image:

```dockerfile
# backend/Dockerfile.ai-worker

# Copy DOE framework files
COPY ai-worker/directives /app/directives
COPY ai-worker/execution /app/execution
COPY ai-worker/AGENTS.md /app/AGENTS.md

# Pre-compile execution scripts
RUN cd /app/execution && npm install && npm run build
```

#### 1.6 Update Entrypoint to Use DOE Pattern

Modify `ai-worker-entrypoint.sh` to:
1. Set `DIRECTIVES_DIR` and `EXECUTION_DIR` environment variables
2. Generate dynamic AGENTS.md with task context
3. Pass AGENTS.md content as system prompt to Claude

---

### Phase 2: Self-Annealing Implementation (Medium Priority)

**Goal:** Implement the DOE self-annealing loop so the system improves itself when errors occur.

From the DOE spec:
> Errors are learning opportunities. When something breaks:
> 1. Fix it
> 2. Update the tool
> 3. Test tool, make sure it works
> 4. Update directive to include new flow
> 5. System is now stronger

#### 2.1 Self-Annealing Directive

Create `backend/ai-worker/directives/common/self_annealing.md`:

```markdown
# Self-Annealing When Things Break

> This is the core error recovery pattern. Follow this whenever an execution script fails.

## The Pattern

When an execution script fails:

1. **Read the error** - Stack trace, error message, context
2. **Fix the script** - Modify the TypeScript/bash code in `execution/`
3. **Test it works** - Run the script with same inputs, verify success
4. **Update the directive** - Add what you learned to the relevant `.md` file
5. **Continue** - Now the system is stronger

## When to Self-Anneal

- Execution script returns non-zero exit code
- Script output doesn't match expected format
- API rate limits or transient errors that require retry logic
- Missing dependencies or permissions

## When NOT to Self-Anneal

- The task requirements are unclear (request clarification instead)
- The fix requires architectural changes (flag for human review)
- The error is in third-party code you can't modify

## Example: Rate Limit Hit

1. **Error**: `execution/jira/add_comment.ts` fails with 429 rate limit
2. **Fix**: Add exponential backoff retry logic to the script
3. **Test**: Run script again, verify it handles rate limits
4. **Update**: Add to `directives/common/jira_api_notes.md`:
   ```
   - 2026-01-04: Jira API has rate limits. Use retry with backoff (max 3 attempts).
   ```
5. **Continue**: Comment now posts successfully

## Updating Directives

When you learn something new, append it to the relevant directive's "Self-Annealing Notes" section:

```markdown
## Self-Annealing Notes
<!-- Updated by AI workers when they learn something -->
- YYYY-MM-DD: What was learned and how to handle it
```
```

#### 2.2 Git Workflow for Self-Annealing

The AI worker must be able to commit improvements to execution scripts and directives:

```typescript
// execution/git/commit_improvement.ts

/**
 * Commits a self-annealing improvement (script fix or directive update)
 * Uses a special branch naming convention for tracking
 */

import { execSync } from 'child_process';

interface ImprovementCommit {
  type: 'script_fix' | 'directive_update';
  filePath: string;
  description: string;
  originalError: string;
}

export async function commitImprovement(input: ImprovementCommit): Promise<void> {
  const branch = `self-anneal/${Date.now()}`;

  execSync(`git checkout -b ${branch}`);
  execSync(`git add ${input.filePath}`);
  execSync(`git commit -m "self-anneal(${input.type}): ${input.description}

Original error: ${input.originalError}

🔧 Auto-generated by AI Worker self-annealing"`);

  // Push to special branch for review
  execSync(`git push origin ${branch}`);

  // Create PR for human review of system improvements
  execSync(`gh pr create --title "Self-Annealing: ${input.description}" \
    --body "This PR contains an automated improvement to the AI Worker system.\n\n**Type:** ${input.type}\n**File:** ${input.filePath}\n**Original Error:** ${input.originalError}" \
    --label "self-annealing"`);
}
```

#### 2.3 Modified Entrypoint with Self-Annealing

Update the entrypoint to instruct Claude to self-anneal:

```bash
# Add to AGENTS.md generation in entrypoint

cat >> /tmp/agents.md << 'EOF'

## Self-Annealing Protocol

When an execution script fails:

1. Read the error output carefully
2. Determine if the fix is within scope:
   - Script bug → Fix it
   - Missing retry logic → Add it
   - API changed → Update script
   - Unclear requirements → Request clarification (don't self-anneal)

3. Make the fix to the script in `execution/`
4. Test the script again with the same inputs
5. If successful:
   - Add a note to the relevant directive
   - Use `execution/git/commit_improvement.ts` to submit the fix
6. Continue with the original task

**Important:** Self-annealing improvements go to a separate PR for human review.
The system learns, but humans approve systemic changes.
EOF
```

#### 2.4 Database Fields for Tracking Improvements

```sql
-- Migration: 051_add_self_annealing_tracking.sql

-- Track self-annealing events
CREATE TABLE ai_worker_improvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES ai_worker_tasks(id),

  -- What was improved
  improvement_type VARCHAR(50) NOT NULL, -- script_fix, directive_update
  file_path TEXT NOT NULL,
  description TEXT NOT NULL,
  original_error TEXT,

  -- Git tracking
  branch_name TEXT,
  pr_url TEXT,
  pr_merged BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for finding improvements by task
CREATE INDEX idx_improvements_task ON ai_worker_improvements(task_id);

-- Add improvement count to tasks
ALTER TABLE ai_worker_tasks ADD COLUMN self_anneal_count INTEGER DEFAULT 0;
```

---

### Phase 3: Planning Layer (Optional Enhancement)

**Goal:** Add a lightweight planning step for complex tasks. This is an enhancement to the core DOE framework.

> Note: The DOE framework doesn't require a separate planning layer - Claude can read directives and plan on the fly. However, for complex tasks or when human approval is needed before execution, a planning step adds value.

#### 3.1 When to Use Planning

| Task Complexity | Planning Needed? |
|-----------------|------------------|
| Simple bug fix | No - follow `fix_bug.md` directive |
| Add API endpoint | No - follow `add_api_endpoint.md` directive |
| Multi-file refactor | Yes - create plan for human review |
| Architectural change | Yes - must have approved plan |
| Unclear requirements | Yes - planning helps surface questions |

#### 3.2 Planning Fields (Optional)

```typescript
// backend/src/shared/models/AIWorkerTask.ts

interface ImplementationPlan {
  version: '1.0';

  // Analysis
  requirementsAnalysis: {
    summary: string;
    acceptanceCriteria: string[];
    outOfScope: string[];
    assumptions: string[];
    risks: string[];
  };

  // Codebase context
  codebaseAnalysis: {
    relevantFiles: string[];
    existingPatterns: string[];
    dependencies: string[];
    testFiles: string[];
  };

  // Implementation steps
  steps: Array<{
    id: string;
    order: number;
    description: string;
    estimatedMinutes: number;
    files: string[];
    testStrategy: string;
  }>;

  // Estimates
  estimates: {
    totalMinutes: number;
    confidence: 'low' | 'medium' | 'high';
    estimatedTokens: number;
    estimatedCostUsd: number;
  };

  // Similar past tasks (for learning)
  similarTasks?: Array<{
    taskId: string;
    jiraKey: string;
    similarity: number;
    whatWorked: string;
  }>;
}
```

#### 1.3 Planner Lambda

```typescript
// backend/src/lambdas/ai-worker-planner.ts

/**
 * Planner Lambda - Creates implementation plans before execution
 *
 * Invocation:
 * - Scheduled: Every 5 minutes, finds 'queued' tasks
 * - Direct: { taskId: string } from webhook
 *
 * Output:
 * - Updates task with implementation_plan
 * - Sets status to 'plan_ready' or 'clarification_needed'
 */

async function handler(event: PlannerEvent): Promise<void> {
  const tasks = event.taskId
    ? [await getTask(event.taskId)]
    : await findQueuedTasks();

  for (const task of tasks) {
    await planTask(task);
  }
}

async function planTask(task: AIWorkerTask): Promise<void> {
  // 1. Claim task
  await updateStatus(task, 'planning');

  // 2. Fetch full Jira issue
  const jiraIssue = await jira.getIssue(task.jiraIssueKey);

  // 3. Search codebase for context (using MCP or direct)
  const codebaseContext = await searchCodebase({
    summary: task.summary,
    description: task.description,
    issueType: task.jiraIssueType,
  });

  // 4. Find similar past tasks
  const similarTasks = await findSimilarTasks(task);

  // 5. Generate implementation plan with Claude Haiku
  const plan = await generatePlan({
    task,
    jiraIssue,
    codebaseContext,
    similarTasks,
  });

  // 6. Check if clarification needed
  if (plan.requiresClarification) {
    task.requiresClarification = true;
    task.clarificationQuestions = plan.questions;
    await updateStatus(task, 'clarification_needed');
    await postClarificationToJira(task, plan.questions);
    return;
  }

  // 7. Save plan and update status
  task.implementationPlan = plan;
  task.planCreatedAt = new Date();
  task.planningTokensInput = plan.usage.inputTokens;
  task.planningTokensOutput = plan.usage.outputTokens;
  task.planningCostUsd = calculateCost('haiku', plan.usage);

  await updateStatus(task, 'plan_ready');
  await postPlanToJira(task, plan);
}
```

#### 3.4 Planner Prompt Template

```typescript
// backend/src/shared/prompts/planner-prompts.ts

export const PLANNER_SYSTEM_PROMPT = `You are a Technical Lead planning implementation work for an AI developer.

Your job is to:
1. Analyze the Jira issue requirements
2. Search the codebase for relevant context
3. Create a detailed implementation plan
4. Identify any blockers or questions

You must output a structured JSON plan following this schema:
{schema}

Guidelines:
- Break work into 30-60 minute steps
- Each step should be independently testable
- Identify ALL files that need changes
- Note any dependencies between steps
- If requirements are unclear, set requiresClarification: true
- Include acceptance criteria from the Jira issue
- Reference similar past implementations when available

You are NOT executing the work - you are creating a plan for another AI to follow.`;

export const PLANNER_USER_PROMPT = `
## Jira Issue: {jiraKey}

### Summary
{summary}

### Description
{description}

### Issue Type
{issueType}

### Acceptance Criteria
{acceptanceCriteria}

---

## Codebase Context

### Relevant Files Found
{relevantFiles}

### Existing Patterns
{existingPatterns}

### Test Files
{testFiles}

---

## Similar Past Tasks
{similarTasks}

---

Create an implementation plan for this task.`;
```

#### 3.5 Modified Watcher Lambda

```typescript
// Changes to ai-worker-watcher.ts

async function dispatchPhase() {
  // NEW: Only dispatch 'plan_ready' tasks (not 'queued')
  const task = await db.query(`
    SELECT * FROM ai_worker_tasks
    WHERE status = 'plan_ready'
      AND ecs_task_arn IS NULL
      AND (requires_clarification = FALSE OR requires_clarification IS NULL)
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `);

  if (!task) return;

  // Validate plan exists
  if (!task.implementation_plan) {
    await updateStatus(task, 'failed', 'Missing implementation plan');
    return;
  }

  // Continue with ECS spawn...
}
```

#### 3.6 Modified Entrypoint Script

```bash
# backend/scripts/ai-worker-entrypoint.sh

# NEW: Read implementation plan from environment
if [ -n "${IMPLEMENTATION_PLAN}" ]; then
    echo "[Setup] Implementation plan provided"
    PLAN_FILE="/tmp/implementation-plan.json"
    echo "${IMPLEMENTATION_PLAN}" > "${PLAN_FILE}"

    # Add plan to instructions
    cat >> "${INSTRUCTIONS_FILE}" << EOF

## Implementation Plan

You have been given a pre-approved implementation plan. Follow it step by step.

\`\`\`json
$(cat ${PLAN_FILE})
\`\`\`

### Execution Rules
1. Follow the steps in order
2. Report completion of each step before moving to next
3. If a step fails, stop and report the failure
4. Do NOT deviate from the plan without good reason
5. If the plan is incorrect, document why and proceed carefully
EOF
fi
```

---

### Phase 4: Learning & Pattern Storage (Low Priority)

**Goal:** System learns from successes and failures without human intervention.

#### 4.1 Pattern Storage

```sql
-- Migration: 053_add_pattern_storage.sql

CREATE TABLE ai_worker_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),

  -- Pattern identity
  pattern_type VARCHAR(50) NOT NULL,  -- implementation, error_fix, optimization
  task_type VARCHAR(50) NOT NULL,

  -- Pattern content
  problem_description TEXT NOT NULL,
  solution_approach TEXT NOT NULL,
  files_involved TEXT[],
  code_snippets JSONB,

  -- Learning source
  source_task_id UUID REFERENCES ai_worker_tasks(id),
  source_pr_url TEXT,

  -- Effectiveness
  times_used INTEGER DEFAULT 0,
  times_successful INTEGER DEFAULT 0,
  effectiveness_score NUMERIC(5,2),

  -- Embedding for similarity search
  embedding VECTOR(1536),  -- For pgvector similarity

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_patterns_embedding ON ai_worker_patterns
  USING ivfflat (embedding vector_cosine_ops);
```

#### 4.2 Learning Service

```typescript
// backend/src/shared/services/learning-service.ts

export class LearningService {

  async learnFromSuccess(task: AIWorkerTask): Promise<void> {
    if (task.status !== 'completed') return;

    // Extract what worked
    const pattern = await this.extractPattern(task);

    // Generate embedding
    pattern.embedding = await this.generateEmbedding(
      `${pattern.problemDescription} ${pattern.solutionApproach}`
    );

    // Store pattern
    await this.patternRepo.save(pattern);

    // Update directive template success rate
    await this.directiveService.recordSuccess(task);
  }

  async learnFromFailure(task: AIWorkerTask): Promise<void> {
    // Categorize failure
    const category = await this.categorizeFailure(task);

    // Check if we've seen this before
    const similar = await this.findSimilarFailures(task);

    if (similar.length >= 3) {
      // This is a recurring problem - create a blocker pattern
      await this.createBlockerPattern(task, category);
    }

    // Update directive to avoid this failure mode
    await this.updateDirectiveWithFailure(task, category);
  }

  async findSimilarPatterns(task: AIWorkerTask): Promise<Pattern[]> {
    const embedding = await this.generateEmbedding(task.summary);

    return await this.patternRepo.query(`
      SELECT *, 1 - (embedding <=> $1) as similarity
      FROM ai_worker_patterns
      WHERE org_id = $2
        AND task_type = $3
        AND effectiveness_score > 0.7
      ORDER BY embedding <=> $1
      LIMIT 5
    `, [embedding, task.orgId, this.inferTaskType(task)]);
  }
}
```

---

## Infrastructure Changes

### New Lambda Functions

```hcl
# infrastructure/terraform/modules/ai-workers/main.tf

# Planner Lambda
resource "aws_lambda_function" "planner" {
  function_name = "${var.project_name}-${var.environment}-ai-worker-planner"
  role          = aws_iam_role.lambda_role.arn
  handler       = "dist/lambdas/ai-worker-planner.handler"
  runtime       = "nodejs20.x"
  timeout       = 120  # 2 minutes for planning
  memory_size   = 512

  environment {
    variables = {
      DATABASE_SECRET_ARN = var.database_secret_arn
      ANTHROPIC_API_KEY_SECRET_ARN = var.anthropic_api_key_secret_arn
      GITHUB_TOKEN_SECRET_ARN = var.github_token_secret_arn
      CLAUDE_MODEL = "haiku"  # Use Haiku for planning (fast + cheap)
    }
  }
}

# Planner schedule (every 5 minutes, offset from watcher)
resource "aws_cloudwatch_event_rule" "planner_schedule" {
  name                = "${var.project_name}-${var.environment}-ai-worker-planner-schedule"
  schedule_expression = "cron(2/5 * * * ? *)"  # 2 minutes offset from watcher
}
```

### Updated Task Definition

```hcl
# Add IMPLEMENTATION_PLAN to executor environment
resource "aws_ecs_task_definition" "executor" {
  # ... existing config ...

  container_definitions = jsonencode([{
    name = "ai-worker-executor"
    environment = [
      # ... existing vars ...
      {
        name  = "IMPLEMENTATION_PLAN"
        value = ""  # Populated at runtime from task
      }
    ]
  }])
}
```

---

## Migration Path

### Sprint 1: Foundation (Phase 1 - Directives & Execution Scripts)

1. Create directory structure: `backend/ai-worker/directives/` and `execution/`
2. Write core directives:
   - `common/git_workflow.md`
   - `common/self_annealing.md`
   - `common/error_handling.md`
   - `backend_developer/add_api_endpoint.md`
   - `backend_developer/fix_bug.md`
3. Implement core execution scripts:
   - `git/create_branch.ts`
   - `git/commit_changes.ts`
   - `git/create_pr.ts`
   - `test/run_tests.ts`
   - `test/run_typecheck.ts`
4. Create `AGENTS.md` for the AI Worker container
5. Update Docker image to include DOE directories
6. Update entrypoint to use DOE pattern

### Sprint 2: Self-Annealing (Phase 2)

1. Create `execution/git/commit_improvement.ts` for system improvements
2. Add database table `ai_worker_improvements` to track fixes
3. Update entrypoint to include self-annealing instructions
4. Test with intentionally broken execution scripts
5. Verify AI workers can fix scripts and submit improvement PRs

### Sprint 3: Planning Layer (Phase 3 - Optional)

1. Implement Planner Lambda for complex tasks
2. Add planning fields to AIWorkerTask model
3. Create planner prompt templates
4. Update Watcher to check `plan_ready` status
5. Feature flag: `ENABLE_PLANNING` (start with false)
6. A/B test planning vs direct execution

### Future: Learning & Patterns (Phase 4)

1. Add pgvector extension to database
2. Create `ai_worker_patterns` table
3. Implement LearningService for pattern extraction
4. Start collecting patterns from successful tasks (read-only first)
5. Enable pattern retrieval to inform directives

---

## Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| First-attempt success rate | ~40% | 70% | PRs approved without revision |
| Time to PR creation | ~30 min | ~25 min | task.startedAt to pr_created |
| Wasted compute (failed tasks) | ~30% | <10% | Failed tasks / total tasks |
| Revision rounds needed | 1.5 avg | <1 avg | task.revisionCount |
| Human clarification rate | ~20% | 50% (before execution) | clarification_needed status |
| Cost per successful task | $2.50 | $1.50 | estimatedCostUsd for completed |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Planner adds latency | High | Medium | Use Haiku (fast), async planning |
| Plans too rigid | Medium | Medium | Allow executor to note deviations |
| Learning creates bad patterns | Low | High | Require 3+ successes before pattern is used |
| Increased complexity | High | Medium | Feature flags, gradual rollout |
| Cost increase from planning | Medium | Low | Haiku is cheap (~$0.02 per plan) |

---

## Appendix: File Locations

### Phase 1: DOE Framework Files (Core)

```
backend/ai-worker/                        # NEW DIRECTORY
├── AGENTS.md                             # Instructions for Claude
├── directives/                           # Layer 1: SOPs in Markdown
│   ├── common/
│   │   ├── git_workflow.md               # Branch, commit, push, PR
│   │   ├── self_annealing.md             # Error recovery pattern
│   │   ├── error_handling.md             # Standard recovery patterns
│   │   └── test_before_commit.md         # Run tests before commit
│   ├── backend_developer/
│   │   ├── add_api_endpoint.md           # Express route creation
│   │   ├── add_database_model.md         # TypeORM entity creation
│   │   └── fix_bug.md                    # Bug investigation and fix
│   ├── frontend_developer/
│   │   ├── add_page.md                   # React page component
│   │   └── add_component.md              # Reusable component
│   └── qa_engineer/
│       └── write_unit_tests.md           # Jest test patterns
├── execution/                            # Layer 3: Deterministic scripts
│   ├── git/
│   │   ├── create_branch.ts              # git checkout -b ai/{key}
│   │   ├── commit_changes.ts             # Stage, commit with message
│   │   ├── push_branch.ts                # git push -u origin
│   │   ├── create_pr.ts                  # gh pr create
│   │   └── commit_improvement.ts         # Self-annealing commits
│   ├── test/
│   │   ├── run_tests.ts                  # npm test with retry
│   │   ├── run_typecheck.ts              # npx tsc --noEmit
│   │   └── run_lint.ts                   # npm run lint
│   ├── jira/
│   │   ├── add_comment.ts                # Post comment to issue
│   │   └── transition_status.ts          # Move to In Progress/Done
│   └── codebase/
│       └── find_similar_code.ts          # Semantic search
└── .tmp/                                 # Intermediate files (gitignored)
```

### Phase 2: Self-Annealing Tracking

```
backend/src/shared/db/migrations/
└── 051_add_self_annealing_tracking.sql   # Track improvements
```

### Phase 3: Planning Layer (Optional)

```
backend/src/
├── lambdas/
│   └── ai-worker-planner.ts              # Planner Lambda
├── shared/
│   ├── prompts/
│   │   └── planner-prompts.ts            # Planner prompt templates
│   └── services/
│       └── learning-service.ts           # Pattern extraction
└── shared/db/migrations/
    ├── 052_add_planning_fields.sql       # Planning data
    └── 053_add_pattern_storage.sql       # Pattern storage (pgvector)

infrastructure/terraform/modules/ai-workers/
└── planner.tf                            # Planner Lambda resources
```

### Files to Modify

```
backend/
├── Dockerfile.ai-worker                  # Copy DOE directories
└── scripts/
    └── ai-worker-entrypoint.sh           # Use DOE pattern
```

---

## Key DOE Principles (Quick Reference)

| Principle | Implementation |
|-----------|----------------|
| Check for tools first | Read `execution/` before writing new scripts |
| Self-anneal when things break | Fix script → Test → Update directive → Continue |
| Update directives as you learn | Append to "Self-Annealing Notes" section |
| Push complexity to scripts | AI orchestrates, scripts execute |
| 90% × 90% × 90% × 90% × 90% = 59% | Deterministic > probabilistic for multi-step |

---

*Last Updated: January 4, 2026*
