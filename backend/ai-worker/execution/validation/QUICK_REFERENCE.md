# Validation Engine Quick Reference

## One-Liner

Validate deployment by checking TypeScript compilation and health endpoint.

## Quick Start

```bash
cd backend
npx ts-node ai-worker/execution/validation/validate_deployment.ts
```

## Import

```typescript
import { validateDeployment, ValidationResult } from './validation';
```

## Function Signature

```typescript
async function validateDeployment(): Promise<ValidationResult>
```

## Result Interface

```typescript
interface ValidationResult {
  success: boolean;                    // Overall pass/fail
  checks: {
    typescript: {
      passed: boolean;                 // All projects compiled
      errors?: string[];               // Error messages if failed
    };
    healthCheck: {
      passed: boolean;                 // Health endpoint responded
      status?: number;                 // HTTP status code
      error?: string;                  // Error message if failed
    };
  };
  timestamp: Date;                     // When validation ran
}
```

## What It Checks

| Check | Command | Location | Timeout |
|-------|---------|----------|---------|
| Backend TS | `npx tsc --noEmit` | `backend/` | 2 min |
| Frontend TS | `npx tsc -b` | `frontend/` | 2 min |
| Mobile TS | `npx tsc --noEmit` | `mobile/` | 2 min |
| Health | `GET /api/v1/health` | Production | 6 retries × 5s |

## Exit Codes

- `0` - All checks passed
- `1` - One or more checks failed

## Timeouts

- TypeScript: 2 minutes per project
- Health check: 10 seconds per attempt
- Total health check: 30 seconds (6 retries)

## Dependencies

- Node.js 18+ (native fetch)
- TypeScript installed
- All projects have node_modules

## Common Usage

### CLI
```bash
npx ts-node ai-worker/execution/validation/validate_deployment.ts
```

### Programmatic
```typescript
const result = await validateDeployment();
if (!result.success) {
  console.error('Validation failed:', result.checks);
}
```

### Shell Script
```bash
if npx ts-node ai-worker/execution/validation/validate_deployment.ts; then
  echo "Success"
else
  echo "Failed"
  exit 1
fi
```

## Example Results

### Success
```json
{
  "success": true,
  "checks": {
    "typescript": { "passed": true },
    "healthCheck": { "passed": true, "status": 200 }
  },
  "timestamp": "2026-01-09T21:30:00.000Z"
}
```

### TypeScript Failed
```json
{
  "success": false,
  "checks": {
    "typescript": {
      "passed": false,
      "errors": ["[backend] 2 error(s)", "  src/api/..."]
    },
    "healthCheck": { "passed": true, "status": 200 }
  },
  "timestamp": "2026-01-09T21:35:00.000Z"
}
```

### Health Check Failed
```json
{
  "success": false,
  "checks": {
    "typescript": { "passed": true },
    "healthCheck": {
      "passed": false,
      "error": "Health endpoint unreachable: ECONNREFUSED"
    }
  },
  "timestamp": "2026-01-09T21:40:00.000Z"
}
```

## Error Handling

**Never throws exceptions** - All errors captured in result object.

## Retries

Health check retries automatically:
- 6 attempts
- 5-second intervals
- Succeeds on first 200 response
- Returns error after all retries exhausted

## Files

```
validation/
├── validate_deployment.ts    # Main implementation
├── index.ts                  # Module exports
├── example.ts                # Usage example
├── README.md                 # Full documentation
├── IMPLEMENTATION.md         # Technical details
├── SAMPLE_OUTPUT.md          # Output examples
└── QUICK_REFERENCE.md        # This file
```

## See Also

- `README.md` - Full documentation
- `IMPLEMENTATION.md` - Technical details
- `SAMPLE_OUTPUT.md` - Example outputs
- `example.ts` - Runnable example
