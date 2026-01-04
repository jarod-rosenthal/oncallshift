---
allowed-tools: Bash(git:*), Bash(gh:*)
description: Quick overview of project and git state
---

# Project Status

## Git Status
Branch: !`git branch --show-current`
Ahead/behind main: !`git rev-list --left-right --count main...HEAD 2>/dev/null | awk '{print "behind: "$1", ahead: "$2}'`

### Uncommitted changes:
!`git status --short`

### Recent commits:
!`git log -5 --oneline`

## Open PRs:
!`gh pr list --limit 5 2>/dev/null || echo "Install gh CLI to view PRs"`

## Instructions

Display this status information clearly. If there are uncommitted changes, ask if I want to commit them.
