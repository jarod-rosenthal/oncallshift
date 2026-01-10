# Sample Validation Output

This document shows what the validation engine outputs look like in different scenarios.

## Scenario 1: Complete Success

### Console Output
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

### JSON Result
```json
{
  "success": true,
  "checks": {
    "typescript": {
      "passed": true
    },
    "healthCheck": {
      "passed": true,
      "status": 200
    }
  },
  "timestamp": "2026-01-09T21:30:00.000Z"
}
```

### Exit Code
`0` (success)

---

## Scenario 2: TypeScript Errors

### Console Output
```
Starting deployment validation...

=== TypeScript Compilation Check ===
✓ TypeScript check passed: backend
✗ TypeScript check failed: frontend
✓ TypeScript check passed: mobile

=== Health Endpoint Check ===
Health check attempt 1/6...
✓ Health check passed (status: 200)

=== Validation Summary ===
TypeScript: ✗ FAIL
Health Check: ✓ PASS
Overall: ✗ FAIL
```

### JSON Result
```json
{
  "success": false,
  "checks": {
    "typescript": {
      "passed": false,
      "errors": [
        "[frontend] 3 error(s)",
        "  src/pages/Dashboard.tsx(42,10): error TS2339: Property 'userName' does not exist on type 'User'.",
        "  src/pages/IncidentList.tsx(78,5): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.",
        "  src/components/TeamSelector.tsx(23,15): error TS2532: Object is possibly 'undefined'."
      ]
    },
    "healthCheck": {
      "passed": true,
      "status": 200
    }
  },
  "timestamp": "2026-01-09T21:35:00.000Z"
}
```

### Exit Code
`1` (failure)

---

## Scenario 3: Health Check Failed (Service Down)

### Console Output
```
Starting deployment validation...

=== TypeScript Compilation Check ===
✓ TypeScript check passed: backend
✓ TypeScript check passed: frontend
✓ TypeScript check passed: mobile

=== Health Endpoint Check ===
Health check attempt 1/6...
Health check attempt 1 failed: connect ECONNREFUSED
Health check attempt 2/6...
Health check attempt 2 failed: connect ECONNREFUSED
Health check attempt 3/6...
Health check attempt 3 failed: connect ECONNREFUSED
Health check attempt 4/6...
Health check attempt 4 failed: connect ECONNREFUSED
Health check attempt 5/6...
Health check attempt 5 failed: connect ECONNREFUSED
Health check attempt 6/6...
Health check attempt 6 failed: connect ECONNREFUSED

=== Validation Summary ===
TypeScript: ✓ PASS
Health Check: ✗ FAIL
Overall: ✗ FAIL
```

### JSON Result
```json
{
  "success": false,
  "checks": {
    "typescript": {
      "passed": true
    },
    "healthCheck": {
      "passed": false,
      "error": "Health endpoint unreachable: connect ECONNREFUSED"
    }
  },
  "timestamp": "2026-01-09T21:40:00.000Z"
}
```

### Exit Code
`1` (failure)

---

## Scenario 4: Health Check Slow Start (Eventually Succeeds)

### Console Output
```
Starting deployment validation...

=== TypeScript Compilation Check ===
✓ TypeScript check passed: backend
✓ TypeScript check passed: frontend
✓ TypeScript check passed: mobile

=== Health Endpoint Check ===
Health check attempt 1/6...
Health check returned status 503
Health check attempt 2/6...
Health check returned status 503
Health check attempt 3/6...
Health check returned status 503
Health check attempt 4/6...
✓ Health check passed (status: 200)

=== Validation Summary ===
TypeScript: ✓ PASS
Health Check: ✓ PASS
Overall: ✓ PASS
```

### JSON Result
```json
{
  "success": true,
  "checks": {
    "typescript": {
      "passed": true
    },
    "healthCheck": {
      "passed": true,
      "status": 200
    }
  },
  "timestamp": "2026-01-09T21:45:00.000Z"
}
```

### Exit Code
`0` (success)

**Note:** This scenario demonstrates the retry logic working correctly. The ECS task took ~15 seconds to become healthy, but validation succeeded within the 30-second retry window.

---

## Scenario 5: Multiple Failures

### Console Output
```
Starting deployment validation...

=== TypeScript Compilation Check ===
✗ TypeScript check failed: backend
✗ TypeScript check failed: frontend
✓ TypeScript check passed: mobile

=== Health Endpoint Check ===
Health check attempt 1/6...
Health check attempt 1 failed: connect ETIMEDOUT
Health check attempt 2/6...
Health check attempt 2 failed: connect ETIMEDOUT
Health check attempt 3/6...
Health check attempt 3 failed: connect ETIMEDOUT
Health check attempt 4/6...
Health check attempt 4 failed: connect ETIMEDOUT
Health check attempt 5/6...
Health check attempt 5 failed: connect ETIMEDOUT
Health check attempt 6/6...
Health check attempt 6 failed: connect ETIMEDOUT

=== Validation Summary ===
TypeScript: ✗ FAIL
Health Check: ✗ FAIL
Overall: ✗ FAIL
```

### JSON Result
```json
{
  "success": false,
  "checks": {
    "typescript": {
      "passed": false,
      "errors": [
        "[backend] 5 error(s)",
        "  src/api/routes/incidents.ts(145,7): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.",
        "  src/api/routes/schedules.ts(89,12): error TS2532: Object is possibly 'undefined'.",
        "  src/shared/models/User.ts(34,5): error TS2322: Type 'string | null' is not assignable to type 'string'.",
        "  src/workers/escalation-timer.ts(67,10): error TS2339: Property 'schedule' does not exist on type 'EscalationPolicy'.",
        "  src/api/middleware/auth.ts(23,20): error TS2304: Cannot find name 'AuthRequest'.",
        "[frontend] 2 error(s)",
        "  src/pages/Dashboard.tsx(42,10): error TS2339: Property 'userName' does not exist on type 'User'.",
        "  src/components/IncidentCard.tsx(15,8): error TS2741: Property 'severity' is missing in type..."
      ]
    },
    "healthCheck": {
      "passed": false,
      "error": "Health endpoint unreachable: connect ETIMEDOUT"
    }
  },
  "timestamp": "2026-01-09T21:50:00.000Z"
}
```

### Exit Code
`1` (failure)

---

## CLI Usage Examples

### Basic Validation
```bash
cd backend
npx ts-node ai-worker/execution/validation/validate_deployment.ts
```

### With Output Capture
```bash
cd backend
npx ts-node ai-worker/execution/validation/validate_deployment.ts > validation.log 2>&1
echo "Exit code: $?"
```

### Integration with Shell Script
```bash
#!/bin/bash

cd backend
if npx ts-node ai-worker/execution/validation/validate_deployment.ts; then
  echo "Deployment validated successfully"
  ./scripts/notify-success.sh
else
  echo "Deployment validation failed"
  ./scripts/rollback.sh
  exit 1
fi
```

### Programmatic Usage
```typescript
import { validateDeployment } from './ai-worker/execution/validation';

async function deployAndValidate() {
  console.log('Running deployment...');
  await runDeploymentScript();

  console.log('Validating deployment...');
  const result = await validateDeployment();

  if (result.success) {
    await notifySlack('Deployment validated ✓');
    await updateJiraTicket('Deployment complete and validated');
  } else {
    const errors = result.checks.typescript.errors || [];
    const healthError = result.checks.healthCheck.error;

    await notifySlack(`Deployment validation failed:\n${errors.join('\n')}\n${healthError}`);
    await updateJiraTicket('Deployment validation failed - investigating');

    throw new Error('Deployment validation failed');
  }
}
```

---

## Integration with AI Worker

The AI worker autonomous deployment flow uses validation like this:

```typescript
// Phase 3: Deploy using direct commands (Kaniko + AWS CLI)
// See execution/deploy/run_deploy.ts for the implementation
await runDeployment({ backend: true, frontend: true });

// Phase 4: Validate
const validation = await validateDeployment();

if (!validation.success) {
  // Report failures to Jira
  const errorReport = formatValidationErrors(validation);
  await addJiraComment(taskKey, errorReport);
  await transitionJira(taskKey, 'Failed');
  return;
}

// Phase 5: Update Jira
await addJiraComment(taskKey, 'Deployment validated successfully');
await transitionJira(taskKey, 'Done');
```

---

## Performance Benchmarks

Typical execution times:

| Scenario | TypeScript | Health Check | Total |
|----------|-----------|--------------|-------|
| All Pass | 15-25s | 1-2s | ~20s |
| TypeScript Fail | 15-25s | 1-2s | ~20s |
| Health Slow Start | 15-25s | 15-20s | ~40s |
| All Fail | 15-25s | 30s | ~50s |

**Note:** TypeScript checks dominate execution time. Health checks add 1-30 seconds depending on service startup time.
