---
allowed-tools: Bash(npm run build:*), Bash(cd:*)
description: Build frontend and/or backend for production
---

# Build Projects

Target: $ARGUMENTS (frontend, backend, or both)

## Current State
Branch: !`git branch --show-current`
Last commit: !`git log -1 --oneline`

## Instructions

Build the specified project(s):

- **Frontend**: `cd frontend && npm run build`
- **Backend**: `cd backend && npm run build`
- **Both** (default): Run both in parallel

Report build output, bundle sizes for frontend, and any warnings/errors.

If build fails, analyze the error, fix the issue, and re-run.
