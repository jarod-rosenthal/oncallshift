#!/usr/bin/env npx ts-node

/**
 * Create a new git branch for AI worker task
 *
 * Inputs (environment variables):
 * - JIRA_ISSUE_KEY: Required. The Jira issue key (e.g., "OCS-123")
 * - BRANCH_NAME: Optional. Custom branch name. Defaults to "ai/{jira-key}"
 * - REPO_PATH: Optional. Path to the repository. Defaults to current directory
 *
 * Outputs (JSON to stdout):
 * - success: boolean
 * - branch: string - The created branch name
 * - previousBranch: string - The branch we were on before
 * - error?: string - Error message if failed
 */

import { execSync } from "child_process";

interface Output {
  success: boolean;
  branch?: string;
  previousBranch?: string;
  error?: string;
}

function exec(cmd: string, cwd?: string): string {
  return execSync(cmd, {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

async function main(): Promise<void> {
  const output: Output = { success: false };

  try {
    const jiraKey = process.env.JIRA_ISSUE_KEY;
    if (!jiraKey) {
      throw new Error("JIRA_ISSUE_KEY environment variable is required");
    }

    const repoPath = process.env.REPO_PATH || process.cwd();
    const branchName = process.env.BRANCH_NAME || `ai/${jiraKey.toLowerCase()}`;

    // Get current branch
    const previousBranch = exec("git rev-parse --abbrev-ref HEAD", repoPath);
    output.previousBranch = previousBranch;

    // Fetch latest from origin
    exec("git fetch origin main", repoPath);

    // Check if branch already exists
    try {
      exec(`git rev-parse --verify ${branchName}`, repoPath);
      // Branch exists, check it out
      exec(`git checkout ${branchName}`, repoPath);
    } catch {
      // Branch doesn't exist, create it from origin/main
      exec(`git checkout -b ${branchName} origin/main`, repoPath);
    }

    output.branch = branchName;
    output.success = true;
  } catch (error: unknown) {
    output.error = error instanceof Error ? error.message : String(error);
  }

  console.log(JSON.stringify(output));
  process.exit(output.success ? 0 : 1);
}

main();
