#!/usr/bin/env npx ts-node

/**
 * Run Jest tests with optional pattern filtering
 *
 * Inputs (environment variables):
 * - TEST_PATTERN: Optional. Pattern to filter tests (e.g., "webhooks", "auth")
 * - PROJECT_PATH: Optional. Path to the project. Defaults to backend/
 * - REPO_PATH: Optional. Path to the repository root. Defaults to current directory
 * - COVERAGE: Optional. Run with coverage if "true"
 * - TIMEOUT: Optional. Test timeout in ms. Defaults to 30000
 *
 * Outputs (JSON to stdout):
 * - success: boolean - True if all tests passed
 * - passed: number - Number of passed tests
 * - failed: number - Number of failed tests
 * - skipped: number - Number of skipped tests
 * - total: number - Total number of tests
 * - duration: number - Total duration in seconds
 * - errors: array - List of failed test details
 * - error?: string - Error message if execution failed
 */

import { execSync } from "child_process";
import * as path from "path";

interface TestError {
  testName: string;
  testSuite: string;
  message: string;
}

interface Output {
  success: boolean;
  passed?: number;
  failed?: number;
  skipped?: number;
  total?: number;
  duration?: number;
  errors?: TestError[];
  error?: string;
}

interface JestResults {
  success: boolean;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTotalTests: number;
  testResults: Array<{
    name: string;
    status: string;
    message: string;
    assertionResults: Array<{
      fullName: string;
      status: string;
      failureMessages: string[];
    }>;
  }>;
}

async function main(): Promise<void> {
  const output: Output = { success: false };

  try {
    const repoPath = process.env.REPO_PATH || process.cwd();
    const projectPath =
      process.env.PROJECT_PATH || path.join(repoPath, "backend");
    const testPattern = process.env.TEST_PATTERN || "";
    const withCoverage = process.env.COVERAGE === "true";
    const timeout = process.env.TIMEOUT || "30000";

    // Build jest command
    let jestCmd = "npx jest --json --outputFile=/tmp/jest-results.json";

    if (testPattern) {
      jestCmd += ` --testPathPattern="${testPattern}"`;
    }

    if (withCoverage) {
      jestCmd += " --coverage";
    }

    jestCmd += ` --testTimeout=${timeout}`;
    jestCmd += " --forceExit";

    const startTime = Date.now();

    try {
      execSync(jestCmd, {
        cwd: projectPath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // Jest returns non-zero when tests fail, but we still want the results
    }

    const endTime = Date.now();
    output.duration = (endTime - startTime) / 1000;

    // Read JSON results
    try {
      const resultsJson = execSync("cat /tmp/jest-results.json", {
        encoding: "utf-8",
      });
      const results: JestResults = JSON.parse(resultsJson);

      output.passed = results.numPassedTests;
      output.failed = results.numFailedTests;
      output.skipped = results.numPendingTests;
      output.total = results.numTotalTests;
      output.success = results.success;

      // Extract failure details
      const errors: TestError[] = [];
      for (const suite of results.testResults) {
        for (const assertion of suite.assertionResults) {
          if (assertion.status === "failed") {
            errors.push({
              testSuite: path.basename(suite.name),
              testName: assertion.fullName,
              message: assertion.failureMessages.join("\n").slice(0, 500),
            });
          }
        }
      }
      output.errors = errors;
    } catch {
      // If JSON parsing fails, try to get basic info from console output
      output.error = "Failed to parse Jest results. Tests may have crashed.";
    }
  } catch (error: unknown) {
    output.error = error instanceof Error ? error.message : String(error);
    output.success = false;
  }

  console.log(JSON.stringify(output));
  process.exit(output.success ? 0 : 1);
}

main();
