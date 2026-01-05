# Test Before Commit

> Always verify code quality before committing: typecheck, lint, and test.

## Goal

Ensure all committed code passes TypeScript type checking, linting, and relevant tests. Never commit broken code.

## Inputs

- **Changed files**: List of files you've modified
- **Project context**: Which project(s) are affected (backend, frontend, mobile)

## Pre-flight Checks

1. Identify which projects were modified:
   - `backend/src/**` -> backend project
   - `frontend/src/**` -> frontend project
   - `mobile/src/**` -> mobile project

2. Check if test files exist for modified code:
   - Look for `__tests__/*.test.ts` near modified files

## Steps

### Step 1: Run TypeScript Type Check

For each affected project, run the type checker:

```
execution/test/run_typecheck.ts
  --project backend  # or frontend, mobile
```

**Expected output:**
```json
{
  "success": true,
  "errors": [],
  "project": "backend"
}
```

If typecheck fails:
1. Read the error messages carefully
2. Fix the type errors in your code
3. Re-run typecheck
4. Do NOT proceed until typecheck passes

### Step 2: Run Linting

Run ESLint on changed files:

```
execution/test/run_lint.ts
  --files <file1> <file2> ...
```

**Expected output:**
```json
{
  "success": true,
  "warnings": [],
  "errors": [],
  "autoFixed": []
}
```

If lint fails:
1. Review errors (not warnings)
2. Fix issues manually or accept auto-fixes
3. Re-run lint
4. Warnings are acceptable; errors are not

### Step 3: Run Related Tests

Run tests related to your changes:

```
execution/test/run_tests.ts
  --pattern <test-pattern>
  --project backend
```

**Test pattern examples:**
- For `backend/src/api/routes/teams.ts` -> `--pattern teams`
- For `backend/src/workers/escalation-timer.ts` -> `--pattern escalation`
- For new features -> run the whole test suite: `--pattern .`

**Expected output:**
```json
{
  "success": true,
  "passed": 45,
  "failed": 0,
  "skipped": 2,
  "duration": "12.3s"
}
```

### Step 4: Handle Test Failures

If tests fail:

1. **Read the failure output carefully**
   - What test failed?
   - What was expected vs actual?
   - Is it a real bug or a test bug?

2. **Determine the cause:**
   - Your code has a bug -> fix the code
   - Test is outdated -> update the test
   - Test is flaky -> document and skip with reason

3. **Fix and re-run:**
   - Make the fix
   - Run the specific failing test first
   - Then run full suite again

4. **Never skip to proceed:**
   - Do NOT commit with failing tests
   - Do NOT comment out tests
   - Do NOT use `--no-verify`

### Step 5: Verify All Green

Run a final verification:

```
execution/test/verify_all.ts
  --project backend
```

This runs typecheck, lint, and tests in sequence.

**Required output:**
```json
{
  "typecheck": "pass",
  "lint": "pass",
  "tests": "pass",
  "readyToCommit": true
}
```

Only proceed to commit when `readyToCommit: true`.

## Outputs

- [ ] TypeScript compilation succeeds with no errors
- [ ] Linting passes (errors fixed, warnings acceptable)
- [ ] All related tests pass
- [ ] Ready to commit

## Edge Cases

### Pre-commit Hook Modifies Files

When Prettier or other formatters auto-fix files:

1. The commit will be rejected
2. Stage the newly formatted files: `git add <modified-files>`
3. Create a NEW commit (do not amend)
4. Pre-commit should pass now

**Important:** Never use `--no-verify` to skip hooks.

### Test Takes Too Long

If the test suite takes more than 5 minutes:

1. Run only the specific test file for your changes
2. Document which tests you ran in the PR description
3. The full suite will run in CI

### No Tests Exist

If there are no tests for the code you modified:

1. Consider writing a basic test (see `add_api_endpoint.md`)
2. At minimum, add a smoke test
3. Document in PR that test coverage should be added

### Flaky Tests

If a test passes sometimes and fails others:

1. Run it 3 times to confirm flakiness
2. Add `// TODO: Flaky test - see OCS-XXX` comment
3. Create a Jira ticket for fixing the flaky test
4. Skip with `.skip` and a reason
5. Document in PR

## Self-Annealing Notes

<!-- Updated by AI workers when they learn something -->
