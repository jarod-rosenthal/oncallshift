---
allowed-tools: Bash(./deploy.sh:*), Bash(git:*)
description: Deploy frontend and backend to production
---

# Deploy to Production

## Pre-flight checks
Current branch: !`git branch --show-current`
Uncommitted changes: !`git status --short`

## Instructions

1. If there are uncommitted changes, ask if I want to commit first
2. Run `./deploy.sh` from the project root
3. Wait for completion and report success/failure
4. If deployment fails, analyze the error and suggest fixes
