---
allowed-tools: Bash(npx tsc:*)
description: Type check all projects (backend, frontend, mobile)
---

# Type Check All Projects

Current branch: !`git branch --show-current`

## Instructions

Run these type checks in parallel and report results:

1. **Backend**: `cd backend && npx tsc --noEmit`
2. **Frontend**: `cd frontend && npx tsc -b`
3. **Mobile**: `cd mobile && npx tsc --noEmit`

For any errors found:
- Group errors by file
- Suggest fixes for each error
- Ask if I want you to fix them automatically
