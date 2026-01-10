import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ValidationResult {
  success: boolean;
  checks: {
    typescript: { passed: boolean; errors?: string[] };
    healthCheck: { passed: boolean; status?: number; error?: string };
  };
  timestamp: Date;
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

/**
 * Run a shell command and return stdout/stderr
 */
async function runCommand(command: string, options: { cwd: string }): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: options.cwd,
      timeout: 120000, // 2 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
    }) as CommandResult;

    // TypeScript compilation warnings go to stdout, not stderr
    // Return stdout which contains the actual output
    return stdout;
  } catch (error: any) {
    // exec throws on non-zero exit code
    // For tsc, errors are in stdout, not stderr
    if (error.stdout) {
      throw new Error(error.stdout);
    }
    throw error;
  }
}

/**
 * Parse TypeScript compiler errors from tsc output
 */
function parseTypescriptErrors(error: Error): string[] {
  const errorMessage = error.message;
  const lines = errorMessage.split('\n');
  const errors: string[] = [];

  // tsc outputs errors in format: path/to/file.ts(line,col): error TS####: message
  // We want to capture distinct error messages
  const errorPattern = /error TS\d+:/;

  for (const line of lines) {
    if (errorPattern.test(line)) {
      // Trim and add to errors if it's a new error
      const trimmed = line.trim();
      if (trimmed && !errors.includes(trimmed)) {
        errors.push(trimmed);
      }
    }
  }

  // If no specific errors found, return the first few lines of output
  if (errors.length === 0 && errorMessage.length > 0) {
    const summaryLines = lines.slice(0, 10).filter(l => l.trim());
    return summaryLines.length > 0 ? summaryLines : ['TypeScript compilation failed'];
  }

  return errors;
}

/**
 * Check TypeScript compilation across all projects
 */
async function checkTypescript(): Promise<{ passed: boolean; errors?: string[] }> {
  const projectRoot = process.cwd().includes('/backend')
    ? process.cwd().replace('/backend', '')
    : process.cwd();

  const checks = [
    { name: 'backend', cwd: `${projectRoot}/backend`, command: 'npx tsc --noEmit' },
    { name: 'frontend', cwd: `${projectRoot}/frontend`, command: 'npx tsc -b' },
    { name: 'mobile', cwd: `${projectRoot}/mobile`, command: 'npx tsc --noEmit' },
  ];

  const allErrors: string[] = [];

  for (const check of checks) {
    try {
      await runCommand(check.command, { cwd: check.cwd });
      console.log(`✓ TypeScript check passed: ${check.name}`);
    } catch (error: any) {
      const errors = parseTypescriptErrors(error);
      console.error(`✗ TypeScript check failed: ${check.name}`);
      allErrors.push(`[${check.name}] ${errors.length} error(s)`);

      // Add first 5 errors from this project to overall list
      errors.slice(0, 5).forEach(err => {
        allErrors.push(`  ${err}`);
      });
    }
  }

  return {
    passed: allErrors.length === 0,
    errors: allErrors.length > 0 ? allErrors : undefined,
  };
}

/**
 * Check health endpoint with retries
 */
async function checkHealthEndpoint(): Promise<{ passed: boolean; status?: number; error?: string }> {
  const healthUrl = 'https://oncallshift.com/api/v1/health';
  const maxRetries = 6;
  const retryInterval = 5000; // 5 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Health check attempt ${attempt}/${maxRetries}...`);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`✓ Health check passed (status: ${response.status})`);
        return { passed: true, status: response.status };
      }

      console.warn(`Health check returned status ${response.status}`);

      // If not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      } else {
        return {
          passed: false,
          status: response.status,
          error: `Health endpoint returned ${response.status} after ${maxRetries} attempts`,
        };
      }
    } catch (error: any) {
      console.error(`Health check attempt ${attempt} failed:`, error.message);

      // If not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      } else {
        return {
          passed: false,
          error: `Health endpoint unreachable: ${error.message}`,
        };
      }
    }
  }

  // Fallback (should never reach here)
  return { passed: false, error: 'Health check failed for unknown reason' };
}

/**
 * Validate deployment by checking TypeScript compilation and health endpoint
 */
export async function validateDeployment(): Promise<ValidationResult> {
  console.log('Starting deployment validation...');

  const result: ValidationResult = {
    success: false,
    checks: {
      typescript: { passed: false },
      healthCheck: { passed: false },
    },
    timestamp: new Date(),
  };

  // 1. TypeScript compilation check
  console.log('\n=== TypeScript Compilation Check ===');
  result.checks.typescript = await checkTypescript();

  // 2. Health endpoint check with retries
  console.log('\n=== Health Endpoint Check ===');
  result.checks.healthCheck = await checkHealthEndpoint();

  // Overall success requires both checks to pass
  result.success = result.checks.typescript.passed && result.checks.healthCheck.passed;

  console.log('\n=== Validation Summary ===');
  console.log(`TypeScript: ${result.checks.typescript.passed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Health Check: ${result.checks.healthCheck.passed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Overall: ${result.success ? '✓ PASS' : '✗ FAIL'}`);

  return result;
}

/**
 * CLI entry point for testing
 */
if (require.main === module) {
  validateDeployment()
    .then((result) => {
      console.log('\nFinal Result:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation crashed:', error);
      process.exit(1);
    });
}
