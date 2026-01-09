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

---

## Definition of Done (Required)

**Every task is complete when ALL applicable items are met:**

- [ ] Code follows existing patterns in the codebase
- [ ] No security vulnerabilities introduced (OWASP Top 10 compliance)
- [ ] For Terraform: State remains synchronized (ran `terraform plan` to verify)
- [ ] For database changes: Migrations are reversible
- [ ] For API changes: Changes are backwards compatible
- [ ] PR created with Summary and Test Plan sections
- [ ] Completion comment added to Jira (see below)
- [ ] Jira ticket transitioned to Done

---

## MANDATORY: Document Your Work in Jira

**You MUST add Jira comments to document your analysis and work.** This is critical for team visibility and learning.

### Before Starting Work

Add a brief comment explaining your approach:
```
[AI Worker Analysis]

I will:
1. [First step you plan to take]
2. [Second step]
...

Files I expect to modify:
- path/to/file1.ts
- path/to/file2.ts
```

Use the execution script:
```bash
JIRA_KEY=$JIRA_ISSUE_KEY COMMENT="Your analysis message" node /app/execution-compiled/jira/add_comment.js
```

### After Completing Work

**CRITICAL: Always add a completion comment before transitioning to Done.**

Your completion comment MUST include:

1. **What was done** - Brief summary of changes made
2. **Files modified** - List key files changed (not every file, just important ones)
3. **New artifacts** - Any new files, migrations, or resources created
4. **Verification performed** - How you verified the changes work
5. **Blockers encountered** - Issues faced and how they were resolved
6. **Follow-up needed** - Any related work discovered that needs separate tickets

Example completion comment:
```
[AI Worker Completion Report]

## Summary
Added test=terraform tag to ECS cluster resource.

## Files Modified
- infrastructure/terraform/environments/dev/main.tf (added tag to aws_ecs_cluster.main)

## Verification
- Ran terraform plan - shows 1 resource to be updated
- Tag will be applied on next terraform apply

## Blockers
- None encountered

## Follow-up
- None required - this is a simple tag addition
```

**Never leave a ticket Done without a proper completion comment. Status updates alone are not sufficient.**

---

## MANDATORY: Transition Jira Ticket to Done

**CRITICAL: After creating a PR (or completing work with no code changes), you MUST transition the Jira ticket to Done.**

Use the execution script:
```bash
JIRA_ISSUE_KEY=$JIRA_ISSUE_KEY TRANSITION_NAME="Done" node /app/execution-compiled/jira/transition_issue.js
```

Or use curl:
```bash
# 1. Get available transitions
curl -s "https://oncallshift.atlassian.net/rest/api/3/issue/${JIRA_ISSUE_KEY}/transitions" | jq '.transitions[] | {id, name}'

# 2. Transition to Done (ID is usually 31)
curl -X POST "https://oncallshift.atlassian.net/rest/api/3/issue/${JIRA_ISSUE_KEY}/transitions" \
  -H "Content-Type: application/json" \
  -d '{"transition": {"id": "31"}}'
```

**Never leave a completed task in "In Progress" status. This is a hard requirement.**

---

## DO NOT Deploy

**IMPORTANT: You must NOT run deploy.sh or deploy to production.** Deployment is handled by humans after PR review and approval.

Your workflow is:
1. Make code changes
2. Commit and push
3. Create a PR
4. Add completion comment to Jira
5. Transition Jira ticket to Done
6. **STOP** - Let humans review, approve, and deploy

---

## Security Requirements

**Security is NOT optional. Never compromise on security best practices.**

### Forbidden Actions
- `NODE_TLS_REJECT_UNAUTHORIZED=0` - Never disable TLS validation
- Hardcoded credentials in code or scripts
- Overly permissive security groups (0.0.0.0/0 for non-public services)
- `Resource: "*"` in IAM policies with destructive actions
- Committing secrets to git

### Required Practices
- Use AWS Secrets Manager for all credentials
- Scope IAM policies to specific ARN patterns
- Validate all API inputs
- Use HMAC signatures for webhook verification

### When Making IAM Changes
```hcl
# WRONG - Too permissive
Action   = ["s3:*"]
Resource = "*"

# CORRECT - Scoped to project resources
Action   = ["s3:GetObject", "s3:PutObject"]
Resource = ["arn:aws:s3:::oncallshift-*/*"]
```

---

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

---

## Self-Annealing Protocol

When an execution script fails:

1. **Read the error** - Understand what went wrong
2. **Fix the script** - Modify the code in `execution/`
3. **Test it works** - Run the script again with same inputs
4. **Update the directive** - Add what you learned to the "Self-Annealing Notes" section
5. **Continue** - The system is now stronger

**Important:** Self-annealing improvements should be committed to a separate branch (`self-anneal/*`) and create a PR for human review.

---

## Key Principle

> "90% accuracy per step = 59% success over 5 steps. Push complexity into deterministic code."

When you find yourself writing the same command multiple times, that's a sign it should be an execution script.

---

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

---

## Current Task

Your task details are provided in the environment:
- JIRA_ISSUE_KEY: The Jira issue you're working on
- JIRA_SUMMARY: Issue summary
- JIRA_DESCRIPTION: Full issue description
- TASK_NOTES: Additional notes from the task watcher that may clarify or modify the deliverable
- WORKER_PERSONA: Your role (backend_developer, frontend_developer, etc.)

**IMPORTANT:** Always read both JIRA_DESCRIPTION and TASK_NOTES. The task notes may contain critical information that changes the requirements or provides additional context not in the original Jira ticket.

## Workflow Summary

1. Read `directives/common/git_workflow.md` to understand the PR process
2. Find and read the directive that matches your task type
3. **Add analysis comment to Jira** explaining your approach
4. Follow the directive step by step
5. Create a PR for human review (do NOT deploy)
6. **Add completion comment to Jira** with detailed summary
7. **Transition the Jira ticket to Done**
