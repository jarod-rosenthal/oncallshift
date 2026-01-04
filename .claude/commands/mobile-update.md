---
allowed-tools: Bash(npx tsc:*), Bash(eas:*), Bash(cd:*)
description: Push OTA update to mobile app
---

# Push Mobile OTA Update

Update message: $ARGUMENTS

## Current State
Branch: !`git branch --show-current`
Last commit: !`git log -1 --oneline`

### Recent mobile changes:
!`git diff --name-only HEAD~5 -- mobile/ 2>/dev/null | head -10`

## Instructions

1. Run type check: `cd mobile && npx tsc --noEmit`
2. If types pass, push OTA update:
   ```bash
   cd mobile && eas update --branch preview --message "$ARGUMENTS"
   ```
3. If no message provided, use the last commit message
4. Report success and remind user to tap "Check for Updates" in the app

Note: OTA updates only work for JavaScript changes. Native changes require a new build.
