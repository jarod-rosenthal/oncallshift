# Deployment Validation Engine

This module validates successful deployments by checking TypeScript compilation and health endpoint status.

## Overview

The validation engine performs two critical checks:
1. **TypeScript Compilation**: Verifies all projects (backend, frontend, mobile) compile without errors
2. **Health Endpoint**: Confirms the deployed API is responding correctly

## Usage

### Programmatic

```typescript
import { validateDeployment, ValidationResult } from './validation';

const result: ValidationResult = await validateDeployment();

if (result.success) {
  console.log('Deployment validated successfully!');
} else {
  console.error('Deployment validation failed');
  if (!result.checks.typescript.passed) {
    console.error('TypeScript errors:', result.checks.typescript.errors);
  }
  if (!result.checks.healthCheck.passed) {
    console.error('Health check failed:', result.checks.healthCheck.error);
  }
}
```

### CLI

```bash
cd backend
npx ts-node ai-worker/execution/validation/validate_deployment.ts
```

Exit code:
- `0`: All checks passed
- `1`: One or more checks failed

## ValidationResult Interface

```typescript
interface ValidationResult {
  success: boolean;                    // Overall success (both checks must pass)
  checks: {
    typescript: {
      passed: boolean;                 // TypeScript compilation succeeded
      errors?: string[];               // Array of error messages (if failed)
    };
    healthCheck: {
      passed: boolean;                 // Health endpoint responded with 200
      status?: number;                 // HTTP status code
      error?: string;                  // Error message (if failed)
    };
  };
  timestamp: Date;                     // When validation ran
}
```

## TypeScript Checks

Runs `tsc` across all three projects:
- `backend/`: `npx tsc --noEmit`
- `frontend/`: `npx tsc -b`
- `mobile/`: `npx tsc --noEmit`

Errors are parsed from compiler output and returned in structured format.

## Health Endpoint Check

- **URL**: `https://oncallshift.com/api/v1/health`
- **Method**: GET
- **Retries**: 6 attempts with 5-second intervals (30s total wait)
- **Timeout**: 10 seconds per attempt
- **Success**: HTTP 200 status

The retry logic allows time for ECS tasks to start and become healthy after deployment.

## Timeouts

- **TypeScript compilation**: 2 minutes per project
- **Health check request**: 10 seconds per attempt
- **Total health check**: Up to 30 seconds with retries

## Error Handling

The validation engine never throws exceptions—all errors are captured in the `ValidationResult`:

```typescript
// TypeScript errors
{
  success: false,
  checks: {
    typescript: {
      passed: false,
      errors: [
        "[backend] 3 error(s)",
        "  src/api/routes/example.ts(42,10): error TS2345: Argument of type...",
        "  src/api/routes/example.ts(55,3): error TS2532: Object is possibly..."
      ]
    },
    healthCheck: { passed: true, status: 200 }
  },
  timestamp: "2026-01-09T..."
}

// Health check errors
{
  success: false,
  checks: {
    typescript: { passed: true },
    healthCheck: {
      passed: false,
      error: "Health endpoint unreachable: connect ECONNREFUSED"
    }
  },
  timestamp: "2026-01-09T..."
}
```

## Integration

This module is used by:
- AI Worker autonomous deployment flow (Phase 4)
- `/verify` skill for manual validation
- CI/CD deployment verification

## Dependencies

- Node.js 18+ (for native `fetch` API)
- All three project directories must exist with `node_modules` installed
- Health endpoint must be accessible at `https://oncallshift.com/api/v1/health`
