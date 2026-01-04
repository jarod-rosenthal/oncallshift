---
allowed-tools: Bash(git:*), Bash(gh:*)
description: Commit changes, push, and create a pull request
---

# Commit, Push, and Create PR

## Current State
Branch: !`git branch --show-current`
Remote tracking: !`git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "No upstream set"`

### Uncommitted changes:
!`git status --short`

### Staged diff:
!`git diff --cached --stat`

### Recent commits on this branch (not in main):
!`git log main..HEAD --oneline 2>/dev/null || echo "On main or no commits ahead"`

## Instructions

1. **Stage & Commit**: Stage all changes and create a commit with a clear message
2. **Push**: Push to origin with `-u` flag if needed
3. **Create PR**: Use `gh pr create` with:
   - Clear title summarizing the changes
   - Body with "## Summary" section (2-3 bullets)
   - Body with "## Test plan" section
   - Include the Claude Code footer

If branch is `main`, ask what branch name to use first.
