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
node /app/execution-compiled/deploy/run_deploy.js
```

## Deploying Your Changes

**You have the ability to deploy to production.** Use this to verify your changes work.

### When to Deploy
- After making code changes that need verification
- After fixing a TypeScript error or bug
- When you want to confirm a feature works

### How to Deploy
```bash
# From the repository root
./deploy.sh
```

This takes 3-5 minutes and will:
1. Build frontend → S3
2. Build backend → ECR → ECS
3. Run migrations
4. Invalidate CloudFront

### Iteration Loop
1. Make changes
2. Commit & push
3. Run `./deploy.sh`
4. Verify it works
5. If broken, fix and repeat

**See `directives/common/deploy_and_verify.md` for detailed deployment SOP.**

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

**Instead, rely on the deploy script to validate types.** When you run `./deploy.sh`:
1. The backend build step compiles TypeScript
2. If there are type errors, the build will fail with clear error messages
3. Fix the errors and re-run deploy
4. This is faster than waiting for CI

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
- WORKER_PERSONA: Your role (backend_developer, frontend_developer, etc.)

Start by:
1. Reading `directives/common/git_workflow.md` to understand the PR process
2. Finding the directive that matches your task type
3. Following the directive step by step
4. **Deploy and verify your changes work before creating a PR**
