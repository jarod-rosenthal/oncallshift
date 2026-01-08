# Fix Bug

> Diagnose and fix a bug in the backend codebase with a test-first approach.

## Goal

Fix the reported bug by: reproducing it, understanding the root cause, writing a failing test, implementing the fix, and verifying the test passes.

## Inputs

- **JIRA_ISSUE_KEY**: The bug ticket
- **JIRA_DESCRIPTION**: Should include:
  - Steps to reproduce
  - Expected behavior
  - Actual behavior
  - Error messages/stack traces (if available)
  - Affected endpoint/functionality
- **TASK_NOTES**: Additional context from the task watcher that may clarify requirements, provide new information, or change the scope

## Pre-flight Checks

1. **Understand the bug report:**
   - **Read both JIRA_DESCRIPTION and TASK_NOTES** - the task notes may contain critical updates
   - Can you reproduce the issue from the description?
   - Is there a stack trace or error message?
   - Which component is affected (API, worker, database)?

2. **Find related code:**
   ```
   execution/codebase/search_patterns.ts
     --directory backend/src
     --pattern "<error-message-or-function-name>"
   ```

3. **Check recent changes:**
   ```
   execution/git/recent_commits.ts
     --path backend/src
     --days 7
   ```
   Recent changes are often the cause.

## Steps

### Step 1: Reproduce the Bug

Before fixing, confirm you understand the issue:

1. **Read the error carefully:**
   - What file/line is mentioned?
   - What's the error type (TypeError, null reference, etc.)?

2. **Trace the code path:**
   - Start from the entry point (API route, worker handler)
   - Follow the logic to where the error occurs
   - Note any assumptions that might be violated

3. **Check logs if available:**
   ```
   execution/logs/search_logs.ts
     --pattern "<error-message>"
     --service api
   ```

### Step 2: Identify Root Cause

Common bug patterns in the OnCallShift codebase:

**Null/Undefined Access:**
```typescript
// Bug: user might be null
const name = user.fullName;

// Fix: null check
const name = user?.fullName ?? 'Unknown';
```

**Missing Await:**
```typescript
// Bug: forgetting await
const data = someAsyncFunction();
console.log(data); // Promise, not data

// Fix: await the promise
const data = await someAsyncFunction();
```

**Wrong Query Scope:**
```typescript
// Bug: missing orgId filter (data leak!)
const teams = await teamRepo.find();

// Fix: always scope by org
const teams = await teamRepo.find({ where: { orgId } });
```

**Type Coercion Issues:**
```typescript
// Bug: query params are strings
if (req.query.limit > 100) // always false!

// Fix: parse to number
const limit = parseInt(req.query.limit as string, 10);
if (limit > 100) ...
```

**Race Conditions:**
```typescript
// Bug: check-then-act race
const exists = await repo.findOne({ where: { name } });
if (!exists) {
  await repo.save({ name }); // Another request might insert first
}

// Fix: use upsert or database constraints
await repo.upsert({ name }, ['name']);
```

### Step 3: Write a Failing Test

**Critical:** Write the test BEFORE fixing the code.

```typescript
// backend/src/api/routes/__tests__/<domain>.test.ts

describe('Bug: OCS-XXX - <brief description>', () => {
  it('should <expected behavior>', async () => {
    // Arrange: Set up the conditions that trigger the bug
    const input = { /* data that causes the bug */ };

    // Act: Perform the action
    const response = await request(app)
      .post('/api/v1/endpoint')
      .send(input)
      .set('Authorization', `Bearer ${testToken}`);

    // Assert: Verify expected behavior (this should FAIL before fix)
    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
  });
});
```

Run the test to confirm it fails:
```
execution/test/run_tests.ts
  --pattern "OCS-XXX"
  --project backend
```

The test MUST fail before you proceed.

### Step 4: Implement the Fix

Now fix the code:

1. Make the smallest change that fixes the issue
2. Don't refactor unrelated code
3. Add comments if the fix isn't obvious

Example fix patterns:

```typescript
// Add null check
if (!user) {
  return notFound(res, 'User', userId);
}

// Add validation
if (!isValidDate(startDate)) {
  return badRequest(res, 'Invalid start date format');
}

// Fix query
const items = await repo.find({
  where: { orgId, status: Not(In(['deleted', 'archived'])) },
});

// Add error handling
try {
  await externalService.call();
} catch (error) {
  logger.error('External service failed:', error);
  return internalError(res, 'Service temporarily unavailable');
}
```

### Step 5: Verify Test Passes

Run the test again:
```
execution/test/run_tests.ts
  --pattern "OCS-XXX"
  --project backend
```

The test should now pass.

### Step 6: Run Full Test Suite

Ensure your fix didn't break anything else:
```
execution/test/run_tests.ts
  --pattern .
  --project backend
```

All tests should pass.

### Step 7: Run TypeCheck

```
execution/test/run_typecheck.ts
  --project backend
```

No type errors allowed.

### Step 8: Document the Fix

Add a comment if the bug was subtle:

```typescript
// Fix for OCS-XXX: The query param 'limit' comes as string,
// must parse to int before comparison
const limit = parseInt(req.query.limit as string, 10) || 25;
```

## Outputs

- [ ] Root cause identified and documented
- [ ] Failing test written that demonstrates the bug
- [ ] Fix implemented (minimal change)
- [ ] Test now passes
- [ ] Full test suite passes
- [ ] TypeScript compiles
- [ ] Ready to commit

## Edge Cases

### Cannot Reproduce

If you cannot reproduce the bug:

1. Ask for more details in Jira comment
2. Check if it's environment-specific (dev vs prod)
3. Look for race conditions (hard to reproduce)
4. Check for data-dependent issues
5. Mark ticket as "Needs Information" if truly blocked

### Multiple Bugs

If you find multiple issues while investigating:

1. Fix the reported bug first
2. Create separate Jira tickets for other bugs found
3. Reference the new tickets in your PR description

### Fix Requires Refactoring

If the fix requires significant refactoring:

1. Make the minimal fix first (to unblock)
2. Create a follow-up ticket for proper refactoring
3. Add `// TODO: Refactor this - see OCS-XXX` comment
4. Link tickets together

### Test is Hard to Write

If the bug is difficult to test:

1. Consider testing at a different level (unit vs integration)
2. Mock external dependencies
3. At minimum, add a regression test
4. Document why testing is challenging

### Database-Related Bug

If the bug involves database state:

1. Check the migration history
2. Look for data inconsistencies
3. Consider if migration is needed
4. Be careful with production data

## Self-Annealing Notes

<!-- Updated by AI workers when they learn something -->
