#!/usr/bin/env npx ts-node

/**
 * Stage and commit all changes
 *
 * Inputs (environment variables):
 * - MESSAGE: Required. The commit message
 * - REPO_PATH: Optional. Path to the repository. Defaults to current directory
 * - AUTHOR_NAME: Optional. Git author name. Defaults to "AI Worker"
 * - AUTHOR_EMAIL: Optional. Git author email. Defaults to "ai-worker@oncallshift.com"
 *
 * Outputs (JSON to stdout):
 * - success: boolean
 * - commitHash: string - The short commit hash
 * - filesChanged: number - Number of files changed
 * - insertions: number - Lines added
 * - deletions: number - Lines deleted
 * - error?: string - Error message if failed
 */

import { execSync } from "child_process";

interface Output {
  success: boolean;
  commitHash?: string;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
  error?: string;
}

function exec(cmd: string, cwd?: string, env?: NodeJS.ProcessEnv): string {
  return execSync(cmd, {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...env },
  }).trim();
}

async function main(): Promise<void> {
  const output: Output = { success: false };

  try {
    const message = process.env.MESSAGE;
    if (!message) {
      throw new Error("MESSAGE environment variable is required");
    }

    const repoPath = process.env.REPO_PATH || process.cwd();
    const authorName = process.env.AUTHOR_NAME || "AI Worker";
    const authorEmail = process.env.AUTHOR_EMAIL || "ai-worker@oncallshift.com";

    // Check if there are changes to commit
    const status = exec("git status --porcelain", repoPath);
    if (!status) {
      throw new Error("No changes to commit");
    }

    // Stage all changes
    exec("git add -A", repoPath);

    // Commit with the message
    const gitEnv = {
      GIT_AUTHOR_NAME: authorName,
      GIT_AUTHOR_EMAIL: authorEmail,
      GIT_COMMITTER_NAME: authorName,
      GIT_COMMITTER_EMAIL: authorEmail,
    };

    // Use a file for commit message to handle special characters
    const commitCmd = `git commit -m "${message.replace(/"/g, '\\"')}"`;
    exec(commitCmd, repoPath, gitEnv);

    // Get the commit hash
    const commitHash = exec("git rev-parse --short HEAD", repoPath);
    output.commitHash = commitHash;

    // Get stats from the commit
    const stats = exec(
      "git diff --shortstat HEAD~1 HEAD 2>/dev/null || echo '0 files changed'",
      repoPath,
    );

    // Parse stats like "3 files changed, 10 insertions(+), 5 deletions(-)"
    const filesMatch = stats.match(/(\d+) files? changed/);
    const insertMatch = stats.match(/(\d+) insertions?\(\+\)/);
    const deleteMatch = stats.match(/(\d+) deletions?\(-\)/);

    output.filesChanged = filesMatch ? parseInt(filesMatch[1], 10) : 0;
    output.insertions = insertMatch ? parseInt(insertMatch[1], 10) : 0;
    output.deletions = deleteMatch ? parseInt(deleteMatch[1], 10) : 0;

    output.success = true;
  } catch (error: unknown) {
    output.error = error instanceof Error ? error.message : String(error);
  }

  console.log(JSON.stringify(output));
  process.exit(output.success ? 0 : 1);
}

main();
