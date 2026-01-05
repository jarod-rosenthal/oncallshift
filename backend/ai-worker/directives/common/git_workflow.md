# Git Workflow

> Standard git workflow for creating branches, making commits, and opening PRs.

## Goal

Ensure all code changes follow the OnCallShift branch naming conventions, commit standards, and PR requirements defined in CLAUDE.md.

## Inputs

- **JIRA_ISSUE_KEY**: The Jira ticket number (e.g., `OCS-123`)
- **JIRA_SUMMARY**: Brief description for branch/commit naming
- **Change type**: One of `feature`, `fix`, `refactor`, `infra`, `security`

## Pre-flight Checks

1. Verify you're on a clean working tree:
   - Run `execution/git/check_status.ts`
   - If uncommitted changes exist, stash or commit them first

2. Ensure main is up to date:
   - Run `execution/git/fetch_main.ts`

## Steps

### Step 1: Create Feature Branch

Use the execution script to create a properly named branch:

```
execution/git/create_branch.ts
  --type <feature|fix|refactor|infra|security>
  --issue OCS-XXX
  --description "short-kebab-case-description"
```

**Branch naming pattern:** `<type>/OCS-<number>-<short-description>`

Examples:
- `feature/OCS-53-rds-proxy`
- `fix/OCS-55-cors-wildcard`
- `security/OCS-56-webhook-signatures`

### Step 2: Make Atomic Commits

After completing each logical unit of work, commit:

```
execution/git/commit_changes.ts
  --message "type: description of what and why"
  --files <file1> <file2> ...
```

**Commit message guidelines:**
- Keep subject line under 72 characters
- Use imperative mood ("Add feature" not "Added feature")
- Focus on "why" not just "what"
- Reference the Jira ticket in extended description if needed

**Atomic commits:**
- Each commit should do ONE thing
- Migrations separate from code changes
- Test additions separate from implementation

### Step 3: Push Branch

Push your branch to origin:

```
execution/git/push_branch.ts
  --set-upstream
```

### Step 4: Create Pull Request

Create the PR with proper formatting:

```
execution/git/create_pr.ts
  --title "OCS-XXX: Brief description"
  --base main
```

The script will generate PR body with:
- Summary section (auto-generated from commits)
- Test plan checklist
- Link to Jira ticket
- AI Worker signature

**PR title format:** `OCS-XXX: Brief description`

## Outputs

When complete, you should have:
- [ ] Feature branch created and pushed
- [ ] All changes committed with atomic, well-described commits
- [ ] PR created and linked to Jira ticket
- [ ] PR URL returned for logging

## Edge Cases

### Merge Conflicts

If `execution/git/push_branch.ts` reports conflicts:
1. Run `execution/git/fetch_main.ts`
2. Run `execution/git/rebase_main.ts`
3. Resolve conflicts manually (read conflict markers carefully)
4. Run `execution/git/continue_rebase.ts`
5. Push with `--force-with-lease` flag

### Branch Already Exists

If the branch name already exists:
1. Check if it's your previous work on the same ticket
2. If yes, check it out and continue
3. If no, append a numeric suffix: `feature/OCS-123-description-2`

### Commit Fails Pre-commit Hook

If pre-commit hooks modify files:
1. Stage the modified files
2. Create a NEW commit (never amend unless explicitly told to)
3. See `test_before_commit.md` for details

## Self-Annealing Notes

<!-- Updated by AI workers when they learn something -->
