---
allowed-tools: Bash(npx tsc:*), Read, Edit, Glob, Grep
description: Iteratively fix TypeScript errors until clean
---

# Fix TypeScript Errors

Target project: $ARGUMENTS (backend, frontend, mobile, or all)

## Instructions

1. Run type check for the specified project (default: all)
2. Parse the errors and group by file
3. Fix errors one file at a time, starting with files that have the most errors
4. After each fix, re-run type check to verify and catch any new errors
5. Repeat until no errors remain
6. Report summary of all fixes made

Use efficient fixes:
- Don't add unnecessary type annotations
- Prefer fixing the root cause over adding type assertions
- If a type is missing from an interface, update the interface
