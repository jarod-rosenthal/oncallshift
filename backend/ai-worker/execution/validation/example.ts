/**
 * Example usage of the deployment validation engine
 *
 * This demonstrates how to use validateDeployment() in your code.
 */

import { validateDeployment, ValidationResult } from './validate_deployment.js';

async function main() {
  console.log('='.repeat(60));
  console.log('Deployment Validation Example');
  console.log('='.repeat(60));

  // Run validation
  const result: ValidationResult = await validateDeployment();

  console.log('\n' + '='.repeat(60));
  console.log('Validation Results');
  console.log('='.repeat(60));

  // Display structured results
  console.log('\nOverall Success:', result.success ? '✓ PASS' : '✗ FAIL');
  console.log('Timestamp:', result.timestamp.toISOString());

  // TypeScript check details
  console.log('\n--- TypeScript Compilation ---');
  console.log('Status:', result.checks.typescript.passed ? '✓ PASS' : '✗ FAIL');
  if (result.checks.typescript.errors && result.checks.typescript.errors.length > 0) {
    console.log('Errors:');
    result.checks.typescript.errors.forEach((err: string) => console.log(`  ${err}`));
  }

  // Health check details
  console.log('\n--- Health Endpoint ---');
  console.log('Status:', result.checks.healthCheck.passed ? '✓ PASS' : '✗ FAIL');
  if (result.checks.healthCheck.status) {
    console.log('HTTP Status:', result.checks.healthCheck.status);
  }
  if (result.checks.healthCheck.error) {
    console.log('Error:', result.checks.healthCheck.error);
  }

  // Sample validation result structure
  console.log('\n--- Sample Result Structure ---');
  console.log(JSON.stringify(result, null, 2));

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
