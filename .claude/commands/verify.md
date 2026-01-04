---
allowed-tools: Bash(npx tsc:*), Bash(npm test:*), Bash(git:*), Grep, Read
description: Verify work is complete - run as background agent after changes
---

# Verify Work

Target: $ARGUMENTS (optional - specific area to verify)

## Quick Status
Branch: !`git branch --show-current`
Changed files: !`git diff --name-only HEAD~1 2>/dev/null | head -20`

## Instructions

Run verification checks:

1. **Type check** all affected projects:
   - If backend files changed: `cd backend && npx tsc --noEmit`
   - If frontend files changed: `cd frontend && npx tsc -b`
   - If mobile files changed: `cd mobile && npx tsc --noEmit`

2. **Run tests** for changed areas:
   - If test files exist near changes: run relevant tests

3. **Check for common issues**:
   - Unused imports
   - Console.log statements left in
   - TODO comments that should be addressed
   - Missing error handling

4. **Report summary**:
   - ✅ What passed
   - ⚠️ What needs attention
   - ❌ What failed

This command is designed to run as a background agent for verification.
