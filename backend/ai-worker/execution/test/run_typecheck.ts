#!/usr/bin/env npx ts-node

/**
 * Run TypeScript type checking on the backend
 *
 * Inputs (environment variables):
 * - PROJECT_PATH: Optional. Path to the project. Defaults to backend/
 * - REPO_PATH: Optional. Path to the repository root. Defaults to current directory
 *
 * Outputs (JSON to stdout):
 * - success: boolean - True if no type errors
 * - errorCount: number - Number of type errors
 * - errors: array - List of error objects with file, line, message
 * - error?: string - Error message if execution failed
 */

import { execSync } from "child_process";
import * as path from "path";

interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

interface Output {
  success: boolean;
  errorCount?: number;
  errors?: TypeScriptError[];
  error?: string;
}

function parseTypeScriptErrors(output: string): TypeScriptError[] {
  const errors: TypeScriptError[] = [];
  const lines = output.split("\n");

  // TypeScript error format: file.ts(line,col): error TS1234: message
  const errorRegex = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(errorRegex);
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        code: match[4],
        message: match[5],
      });
    }
  }

  return errors;
}

async function main(): Promise<void> {
  const output: Output = { success: false };

  try {
    const repoPath = process.env.REPO_PATH || process.cwd();
    const projectPath =
      process.env.PROJECT_PATH || path.join(repoPath, "backend");

    let tscOutput = "";
    let exitCode = 0;

    try {
      tscOutput = execSync("npx tsc --noEmit 2>&1", {
        cwd: projectPath,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (execError: unknown) {
      // tsc returns non-zero exit code when there are errors
      if (execError && typeof execError === "object" && "stdout" in execError) {
        tscOutput = (execError as { stdout: string }).stdout || "";
      }
      if (execError && typeof execError === "object" && "status" in execError) {
        exitCode = (execError as { status: number }).status || 1;
      }
    }

    const errors = parseTypeScriptErrors(tscOutput);
    output.errors = errors;
    output.errorCount = errors.length;
    output.success = exitCode === 0 && errors.length === 0;
  } catch (error: unknown) {
    output.error = error instanceof Error ? error.message : String(error);
    output.success = false;
  }

  console.log(JSON.stringify(output));
  process.exit(output.success ? 0 : 1);
}

main();
