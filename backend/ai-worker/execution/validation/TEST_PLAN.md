# Validation Engine Test Plan

This document outlines how to test the deployment validation engine.

## Pre-Test Setup

```bash
cd /mnt/c/Users/jarod/github/pagerduty-lite
```

Ensure all projects have dependencies installed:
```bash
cd backend && npm install
cd ../frontend && npm install
cd ../mobile && npm install
```

## Test 1: Basic Functionality (Happy Path)

**Objective:** Verify validation passes when all checks succeed.

**Prerequisites:**
- No TypeScript errors in any project
- Production API is healthy

**Steps:**
```bash
cd backend
npx ts-node ai-worker/execution/validation/validate_deployment.ts
```

**Expected Output:**
```
Starting deployment validation...

=== TypeScript Compilation Check ===
✓ TypeScript check passed: backend
✓ TypeScript check passed: frontend
✓ TypeScript check passed: mobile

=== Health Endpoint Check ===
Health check attempt 1/6...
✓ Health check passed (status: 200)

=== Validation Summary ===
TypeScript: ✓ PASS
Health Check: ✓ PASS
Overall: ✓ PASS
```

**Expected Exit Code:** `0`

**Expected Result Structure:**
```json
{
  "success": true,
  "checks": {
    "typescript": { "passed": true },
    "healthCheck": { "passed": true, "status": 200 }
  },
  "timestamp": "..."
}
```

**Pass Criteria:** ✓ success is true, ✓ exit code is 0

---

## Test 2: TypeScript Errors Detection

**Objective:** Verify validation detects and reports TypeScript errors.

**Prerequisites:**
- Introduce a TypeScript error in one project

**Setup:**
```bash
cd backend/src/api/routes
# Add this line to incidents.ts (intentional error)
echo "const x: number = 'string';" >> incidents.ts
```

**Steps:**
```bash
cd backend
npx ts-node ai-worker/execution/validation/validate_deployment.ts
```

**Expected Output:**
```
=== TypeScript Compilation Check ===
✗ TypeScript check failed: backend
...
TypeScript: ✗ FAIL
Overall: ✗ FAIL
```

**Expected Exit Code:** `1`

**Pass Criteria:**
- ✓ success is false
- ✓ typescript.passed is false
- ✓ typescript.errors contains error message
- ✓ Exit code is 1

**Cleanup:**
```bash
cd backend/src/api/routes
git checkout incidents.ts
```

---

## Test 3: Health Endpoint Failure

**Objective:** Verify validation handles unreachable health endpoint.

**Prerequisites:**
- Modify health URL to non-existent endpoint

**Setup:** Temporarily edit `validate_deployment.ts`:
```typescript
// Change line 117 from:
const healthUrl = 'https://oncallshift.com/api/v1/health';
// To:
const healthUrl = 'https://oncallshift.com/api/v1/nonexistent';
```

**Steps:**
```bash
cd backend
npx ts-node ai-worker/execution/validation/validate_deployment.ts
```

**Expected Output:**
```
=== Health Endpoint Check ===
Health check attempt 1/6...
Health check returned status 404
Health check attempt 2/6...
...
Health Check: ✗ FAIL
Overall: ✗ FAIL
```

**Expected Exit Code:** `1`

**Pass Criteria:**
- ✓ success is false
- ✓ healthCheck.passed is false
- ✓ healthCheck.error or healthCheck.status is set
- ✓ Exit code is 1

**Cleanup:**
```bash
git checkout backend/ai-worker/execution/validation/validate_deployment.ts
```

---

## Test 4: Retry Logic

**Objective:** Verify health check retries work correctly.

**Method:** Add logging to observe retry behavior.

**Steps:**
```bash
cd backend
# Run validation and watch console output
npx ts-node ai-worker/execution/validation/validate_deployment.ts 2>&1 | grep "Health check attempt"
```

**Expected Output:**
```
Health check attempt 1/6...
```

If health endpoint responds immediately, only 1 attempt should be shown.

**Pass Criteria:**
- ✓ First successful attempt stops retrying
- ✓ Failed attempts continue up to 6 times
- ✓ 5-second delay between attempts (observe timing)

---

## Test 5: Timeout Handling

**Objective:** Verify TypeScript compilation timeout works.

**Note:** This test is difficult without intentionally hanging tsc. Can be validated by code review:
- ✓ `timeout: 120000` parameter present in execAsync call
- ✓ Timeout handler catches error

**Pass Criteria:** Code review confirms timeout implementation.

---

## Test 6: Programmatic Usage

**Objective:** Verify module can be imported and used programmatically.

**Steps:**
```bash
cd backend
npx ts-node ai-worker/execution/validation/example.ts
```

**Expected Output:**
```
=== Deployment Validation Example ===
...
Overall Success: ✓ PASS
...
--- Sample Result Structure ---
{
  "success": true,
  ...
}
```

**Pass Criteria:**
- ✓ Runs without import errors
- ✓ Returns structured ValidationResult
- ✓ Example code demonstrates API correctly

---

## Test 7: Multiple TypeScript Projects

**Objective:** Verify all three projects are checked independently.

**Setup:** Introduce errors in different projects:
```bash
# Backend error
cd backend/src/api/routes
echo "const x: number = 'string';" >> incidents.ts

# Frontend error
cd ../../../frontend/src/pages
echo "const y: string = 123;" >> Dashboard.tsx
```

**Steps:**
```bash
cd backend
npx ts-node ai-worker/execution/validation/validate_deployment.ts
```

**Expected Output:**
```
✗ TypeScript check failed: backend
✗ TypeScript check failed: frontend
✓ TypeScript check passed: mobile
```

**Pass Criteria:**
- ✓ Errors from both projects reported
- ✓ Errors grouped by project name
- ✓ Mobile still passes

**Cleanup:**
```bash
cd backend/src/api/routes && git checkout incidents.ts
cd ../../../frontend/src/pages && git checkout Dashboard.tsx
```

---

## Test 8: Error Parsing

**Objective:** Verify TypeScript errors are parsed correctly.

**Method:** Review error output from Test 2 or Test 7.

**Pass Criteria:**
- ✓ Error messages include file path
- ✓ Error messages include line/column numbers
- ✓ Error messages include TS error codes (e.g., TS2345)
- ✓ Errors are readable and actionable

---

## Test 9: Concurrent Safety

**Objective:** Verify validation can run multiple times concurrently.

**Steps:**
```bash
cd backend
npx ts-node ai-worker/execution/validation/validate_deployment.ts &
npx ts-node ai-worker/execution/validation/validate_deployment.ts &
wait
```

**Expected Behavior:**
- Both processes complete successfully
- No resource conflicts
- Both return same result

**Pass Criteria:**
- ✓ Both executions complete
- ✓ No "file locked" or similar errors
- ✓ Results are consistent

---

## Test 10: Integration with AI Worker

**Objective:** Verify validation integrates with AI worker flow.

**Setup:** Create test integration file:
```typescript
// test-integration.ts
import { validateDeployment } from './ai-worker/execution/validation';

async function testAIWorkerIntegration() {
  console.log('Simulating AI worker deployment flow...');

  // Phase 4: Validate deployment
  console.log('\nPhase 4: Validating deployment...');
  const validation = await validateDeployment();

  if (validation.success) {
    console.log('✓ Deployment validated - would update Jira to Done');
  } else {
    console.error('✗ Deployment validation failed - would update Jira with errors');
    console.error('TypeScript errors:', validation.checks.typescript.errors);
    console.error('Health check error:', validation.checks.healthCheck.error);
  }

  return validation.success;
}

testAIWorkerIntegration()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Integration test failed:', error);
    process.exit(1);
  });
```

**Steps:**
```bash
cd backend
npx ts-node test-integration.ts
```

**Pass Criteria:**
- ✓ Import works without errors
- ✓ Validation runs successfully
- ✓ Result is usable in conditional logic
- ✓ Exit code matches result

---

## Test 11: Production Health Endpoint

**Objective:** Verify health endpoint is actually reachable.

**Steps:**
```bash
curl -I https://oncallshift.com/api/v1/health
```

**Expected Output:**
```
HTTP/2 200
content-type: application/json
...
```

**Pass Criteria:**
- ✓ Returns 200 status
- ✓ Response is JSON
- ✓ Response time < 1 second

---

## Test 12: Large Error Output

**Objective:** Verify validation handles many TypeScript errors gracefully.

**Setup:** Introduce 20+ errors across projects.

**Expected Behavior:**
- Only first 5 errors per project shown
- Output remains readable
- Validation completes without hanging

**Pass Criteria:**
- ✓ Output is truncated appropriately
- ✓ Error count is displayed
- ✓ Performance remains acceptable

---

## Performance Benchmarks

Run validation 5 times and record timing:

```bash
cd backend
for i in {1..5}; do
  echo "Run $i:"
  time npx ts-node ai-worker/execution/validation/validate_deployment.ts
done
```

**Expected Timing:**
- TypeScript checks: 15-25 seconds
- Health check: 1-2 seconds (immediate success)
- Total: 20-30 seconds

**Pass Criteria:**
- ✓ Consistent timing across runs
- ✓ No memory leaks (runs don't get progressively slower)
- ✓ Times match documented benchmarks

---

## Regression Tests

After any changes to `validate_deployment.ts`, re-run:

1. Test 1 (Happy Path)
2. Test 2 (TypeScript Errors)
3. Test 3 (Health Check Failure)
4. Test 6 (Programmatic Usage)

All four must pass to ensure no regressions.

---

## Edge Cases

### Edge Case 1: Empty Project Directory
**Setup:** Temporarily rename `node_modules`
**Expected:** Validation fails gracefully with clear error

### Edge Case 2: Malformed TypeScript
**Setup:** Add syntax error that prevents parsing
**Expected:** Error captured and reported

### Edge Case 3: Network Timeout
**Setup:** Use firewall to block HTTPS
**Expected:** Timeout after 10 seconds per attempt, clear error message

### Edge Case 4: Partial Success
**Setup:** TypeScript passes, health fails (or vice versa)
**Expected:** Overall success is false, both check results available

---

## Success Criteria Summary

Phase 4 validation engine passes all tests if:

- ✓ Test 1-12 all pass
- ✓ Performance is within expected benchmarks
- ✓ Edge cases handled gracefully
- ✓ Documentation matches actual behavior
- ✓ No TypeScript compilation errors in validation code itself
- ✓ Integration with AI worker flow is demonstrated

---

## Test Execution Checklist

```
[ ] Test 1: Basic Functionality (Happy Path)
[ ] Test 2: TypeScript Errors Detection
[ ] Test 3: Health Endpoint Failure
[ ] Test 4: Retry Logic
[ ] Test 5: Timeout Handling
[ ] Test 6: Programmatic Usage
[ ] Test 7: Multiple TypeScript Projects
[ ] Test 8: Error Parsing
[ ] Test 9: Concurrent Safety
[ ] Test 10: Integration with AI Worker
[ ] Test 11: Production Health Endpoint
[ ] Test 12: Large Error Output
[ ] Performance Benchmarks
[ ] Edge Case 1: Empty Project Directory
[ ] Edge Case 2: Malformed TypeScript
[ ] Edge Case 3: Network Timeout
[ ] Edge Case 4: Partial Success
```

---

## Automated Test Script

```bash
#!/bin/bash
# test-validation.sh - Automated test runner

set -e

echo "Running Validation Engine Tests"
echo "================================"

cd /mnt/c/Users/jarod/github/pagerduty-lite/backend

# Test 1: Happy Path
echo -e "\n[Test 1] Happy Path"
if npx ts-node ai-worker/execution/validation/validate_deployment.ts > /dev/null 2>&1; then
  echo "✓ PASS"
else
  echo "✗ FAIL"
  exit 1
fi

# Test 6: Programmatic Usage
echo -e "\n[Test 6] Programmatic Usage"
if npx ts-node ai-worker/execution/validation/example.ts > /dev/null 2>&1; then
  echo "✓ PASS"
else
  echo "✗ FAIL"
  exit 1
fi

# Test 11: Production Health Endpoint
echo -e "\n[Test 11] Production Health Endpoint"
if curl -sf https://oncallshift.com/api/v1/health > /dev/null; then
  echo "✓ PASS"
else
  echo "✗ FAIL"
  exit 1
fi

echo -e "\n================================"
echo "All automated tests passed!"
```

Save as `backend/ai-worker/execution/validation/test-validation.sh` and run:
```bash
chmod +x backend/ai-worker/execution/validation/test-validation.sh
./backend/ai-worker/execution/validation/test-validation.sh
```
