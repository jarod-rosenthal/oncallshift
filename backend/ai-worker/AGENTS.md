# Agent Instructions

> This file provides context to Claude Code when executing AI Worker tasks.

You operate within a 3-layer architecture that separates concerns:

## Layer 1: Directive (What to do)
- SOPs in `directives/` defining goals, steps, edge cases
- Read the relevant directive FIRST before doing anything
- Directives are organized by persona: `backend_developer/`, `frontend_developer/`, etc.

## Layer 2: Orchestration (You)
- Your job: read directives, call execution scripts, handle errors
- You're the decision-maker, not the implementer
- DO NOT write shell commands directly - use scripts from `execution/`

## Layer 3: Execution (Tools)
- Pre-compiled JavaScript scripts in `/app/execution-compiled/`
- Call these with `node` instead of running commands yourself
- Scripts output JSON so you can parse results

**Running execution scripts:**
```bash
# Use the compiled JavaScript versions (NOT the .ts files)
node /app/execution-compiled/jira/add_comment.js
node /app/execution-compiled/git/commit_changes.js
node /app/execution-compiled/git/create_pr.js
```

## DO NOT Deploy

**IMPORTANT: You must NOT run deploy.sh or deploy to production.** Deployment is handled by humans after PR review and approval. Your job is to:
1. Make code changes
2. Commit and push
3. Create a PR
4. Let humans review, approve, and deploy

## Self-Annealing Protocol

When an execution script fails:

1. **Read the error** - Understand what went wrong
2. **Fix the script** - Modify the code in `execution/`
3. **Test it works** - Run the script again with same inputs
4. **Update the directive** - Add what you learned to the "Self-Annealing Notes" section
5. **Continue** - The system is now stronger

**Important:** Self-annealing improvements should be committed to a separate branch (`self-anneal/*`) and create a PR for human review.

## Key Principle

> "90% accuracy per step = 59% success over 5 steps. Push complexity into deterministic code."

When you find yourself writing the same command multiple times, that's a sign it should be an execution script.

## No Code Changes Needed

Sometimes after investigation, you'll find that **no code changes are required**. This is a valid outcome. When this happens:

1. **DO NOT create empty commits** - Never run `git commit --allow-empty` just to have something to push
2. **DO NOT create a PR** - A PR with no meaningful changes wastes reviewer time
3. **DO add a Jira comment** explaining your findings:
   - What you investigated
   - Why no changes are needed (code already correct, issue is elsewhere, etc.)
   - Any recommended next steps (e.g., "run terraform apply", "check production config")
4. **Exit cleanly** - The orchestrator will mark the task as "completed with no changes"

**Example scenarios where no code changes are needed:**
- The fix is already in the codebase but not deployed
- The issue is a configuration problem, not a code problem
- The reported bug cannot be reproduced
- The requested feature already exists

## TypeScript and Type Checking

**Important:** This container does NOT have project dev dependencies installed. Do NOT attempt to run:
- `npx tsc --noEmit` - Will fail (no TypeScript in project)
- `npm run build` - Will fail (no tsc)
- `npm run typecheck` - Will fail

**Instead, use quick syntax validation or rely on CI to catch type errors.**

**Quick syntax validation** (if needed):
```bash
# Use the container's global TypeScript to check a single file
cd /app && npx tsc --noEmit --skipLibCheck --target ES2022 --module commonjs /path/to/file.ts
```

This won't catch all type errors (missing project types) but will catch syntax issues.

## Current Task

Your task details are provided in the environment:
- JIRA_ISSUE_KEY: The Jira issue you're working on
- JIRA_SUMMARY: Issue summary
- JIRA_DESCRIPTION: Full issue description
- TASK_NOTES: Additional notes from the task watcher that may clarify or modify the deliverable
- WORKER_PERSONA: Your role (backend_developer, frontend_developer, etc.)

**IMPORTANT:** Always read both JIRA_DESCRIPTION and TASK_NOTES. The task notes may contain critical information that changes the requirements or provides additional context not in the original Jira ticket.

Start by:
1. Reading `directives/common/git_workflow.md` to understand the PR process
2. Finding the directive that matches your task type
3. Following the directive step by step
4. Create a PR for human review (do NOT deploy)
