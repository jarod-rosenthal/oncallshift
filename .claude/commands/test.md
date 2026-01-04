---
allowed-tools: Bash(npm test:*), Bash(npx playwright:*)
description: Run tests for backend or e2e
---

# Run Tests

Test pattern (optional): $ARGUMENTS

## Changed files since main:
!`git diff --name-only main 2>/dev/null | head -20`

## Instructions

If `$ARGUMENTS` is provided, run tests matching that pattern:
```bash
cd backend && npm test -- --testPathPattern=$ARGUMENTS
```

Otherwise, based on changed files:
- **Backend changes** (`backend/`): `cd backend && npm test`
- **E2E changes** (`e2e/`): `cd e2e && npx playwright test`

Report test results and help fix any failures.
