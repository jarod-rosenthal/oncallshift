#!/usr/bin/env npx ts-node

/**
 * Rebase current branch onto latest origin/main
 *
 * This ensures the branch includes all changes that have been merged to main
 * since the branch was created. Critical for preventing deploy conflicts when
 * multiple AI workers are operating in parallel.
 *
 * Inputs (environment variables):
 * - REPO_PATH: Optional. Path to the repository. Defaults to current directory
 * - BASE_BRANCH: Optional. Base branch to rebase onto. Defaults to "main"
 *
 * Outputs (JSON to stdout):
 * - success: boolean
 * - hadConflicts: boolean - True if rebase failed due to conflicts
 * - conflictFiles?: string[] - List of files with conflicts (if any)
 * - commitsRebased: number - Number of commits that were rebased
 * - wasAlreadyUpToDate: boolean - True if branch was already up to date
 * - error?: string - Error message if failed
 */

import { execSync, ExecSyncOptionsWithStringEncoding } from "child_process";

interface Output {
  success: boolean;
  hadConflicts: boolean;
  conflictFiles?: string[];
  commitsRebased?: number;
  wasAlreadyUpToDate?: boolean;
  error?: string;
}

function exec(cmd: string, cwd?: string): string {
  const options: ExecSyncOptionsWithStringEncoding = {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  };
  return execSync(cmd, options).trim();
}

function execSafe(cmd: string, cwd?: string): { success: boolean; output: string; error?: string } {
  try {
    return { success: true, output: exec(cmd, cwd) };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, output: "", error: errorMsg };
  }
}

async function main(): Promise<void> {
  const output: Output = { success: false, hadConflicts: false };

  try {
    const repoPath = process.env.REPO_PATH || process.cwd();
    const baseBranch = process.env.BASE_BRANCH || "main";

    // Get current branch
    const currentBranch = exec("git rev-parse --abbrev-ref HEAD", repoPath);

    if (currentBranch === baseBranch) {
      throw new Error(`Cannot rebase ${baseBranch} onto itself. Switch to a feature branch first.`);
    }

    // Fetch latest from origin
    exec(`git fetch origin ${baseBranch}`, repoPath);

    // Check how many commits we're behind/ahead
    const behindCount = parseInt(
      exec(`git rev-list --count HEAD..origin/${baseBranch}`, repoPath) || "0",
      10
    );
    const aheadCount = parseInt(
      exec(`git rev-list --count origin/${baseBranch}..HEAD`, repoPath) || "0",
      10
    );

    // If we're not behind, we're already up to date
    if (behindCount === 0) {
      output.success = true;
      output.wasAlreadyUpToDate = true;
      output.commitsRebased = 0;
      console.log(JSON.stringify(output));
      process.exit(0);
      return;
    }

    console.error(`[rebase] Branch is ${behindCount} commits behind origin/${baseBranch}, ${aheadCount} commits ahead`);
    console.error(`[rebase] Attempting rebase onto origin/${baseBranch}...`);

    // Attempt rebase
    const rebaseResult = execSafe(`git rebase origin/${baseBranch}`, repoPath);

    if (!rebaseResult.success) {
      // Rebase failed - check if it's due to conflicts
      const statusResult = execSafe("git status --porcelain", repoPath);

      // Check for unmerged files (conflicts)
      const unmergedFiles = statusResult.output
        .split("\n")
        .filter((line) => line.startsWith("UU") || line.startsWith("AA") || line.startsWith("DD"))
        .map((line) => line.substring(3).trim());

      if (unmergedFiles.length > 0) {
        // Abort the rebase to restore clean state
        execSafe("git rebase --abort", repoPath);

        output.hadConflicts = true;
        output.conflictFiles = unmergedFiles;
        output.error = `Rebase conflict in files: ${unmergedFiles.join(", ")}`;

        console.error(`[rebase] CONFLICT detected in ${unmergedFiles.length} files:`);
        unmergedFiles.forEach((f) => console.error(`  - ${f}`));
        console.error(`[rebase] Rebase aborted. Manual intervention required or retry from scratch.`);

        // Output tagged markers for orchestrator to parse
        console.error(`::result::rebase_conflict`);
        console.error(`::conflict_files::${unmergedFiles.join(",")}`);
      } else {
        // Some other error
        execSafe("git rebase --abort", repoPath);
        output.error = rebaseResult.error || "Rebase failed for unknown reason";
        console.error(`[rebase] Rebase failed: ${output.error}`);
      }

      console.log(JSON.stringify(output));
      process.exit(1);
      return;
    }

    // Rebase succeeded
    output.success = true;
    output.wasAlreadyUpToDate = false;
    output.commitsRebased = aheadCount;

    console.error(`[rebase] Successfully rebased ${aheadCount} commits onto origin/${baseBranch}`);
    console.error(`::result::rebase_success`);
  } catch (error: unknown) {
    output.error = error instanceof Error ? error.message : String(error);
    console.error(`[rebase] Error: ${output.error}`);
  }

  console.log(JSON.stringify(output));
  process.exit(output.success ? 0 : 1);
}

main();
