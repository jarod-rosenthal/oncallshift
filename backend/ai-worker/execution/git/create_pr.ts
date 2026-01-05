#!/usr/bin/env npx ts-node

/**
 * Push current branch and create a pull request using GitHub CLI
 *
 * Inputs (environment variables):
 * - JIRA_KEY: Required. The Jira issue key (e.g., "OCS-123")
 * - JIRA_SUMMARY: Required. The Jira issue summary/title
 * - DESCRIPTION: Optional. Additional PR description
 * - REPO_PATH: Optional. Path to the repository. Defaults to current directory
 * - GITHUB_TOKEN: Optional. GitHub token for authentication (gh cli may use its own auth)
 * - BASE_BRANCH: Optional. Base branch for PR. Defaults to "main"
 * - DRAFT: Optional. Create as draft PR if "true"
 *
 * Outputs (JSON to stdout):
 * - success: boolean
 * - prUrl: string - The PR URL
 * - prNumber: number - The PR number
 * - branch: string - The branch that was pushed
 * - error?: string - Error message if failed
 */

import { execSync } from "child_process";

interface Output {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  branch?: string;
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
    const jiraKey = process.env.JIRA_KEY;
    const jiraSummary = process.env.JIRA_SUMMARY;

    if (!jiraKey) {
      throw new Error("JIRA_KEY environment variable is required");
    }
    if (!jiraSummary) {
      throw new Error("JIRA_SUMMARY environment variable is required");
    }

    const repoPath = process.env.REPO_PATH || process.cwd();
    const description = process.env.DESCRIPTION || "";
    const baseBranch = process.env.BASE_BRANCH || "main";
    const isDraft = process.env.DRAFT === "true";

    // Get current branch
    const currentBranch = exec("git rev-parse --abbrev-ref HEAD", repoPath);
    output.branch = currentBranch;

    if (currentBranch === baseBranch) {
      throw new Error(
        `Cannot create PR from ${baseBranch} branch. Switch to a feature branch first.`,
      );
    }

    // Push the branch
    exec(`git push -u origin ${currentBranch}`, repoPath);

    // Build PR title and body
    const prTitle = `${jiraKey}: ${jiraSummary}`;

    // Create PR body with Jira link and description
    const jiraBaseUrl =
      process.env.JIRA_BASE_URL || "https://oncallshift.atlassian.net";
    const jiraLink = `${jiraBaseUrl}/browse/${jiraKey}`;

    let prBody = `## Summary\n\nImplements [${jiraKey}](${jiraLink}): ${jiraSummary}\n\n`;

    if (description) {
      prBody += `## Description\n\n${description}\n\n`;
    }

    prBody += `## Test Plan\n\n- [ ] TypeScript compiles without errors\n- [ ] Tests pass\n- [ ] Manual verification completed\n\n`;
    prBody += `---\n\n[AI Worker] Generated with Claude Code`;

    // Create the PR using gh cli
    const draftFlag = isDraft ? "--draft" : "";
    const prCommand = `gh pr create --title "${prTitle.replace(/"/g, '\\"')}" --body "${prBody.replace(/"/g, '\\"')}" --base ${baseBranch} ${draftFlag}`;

    const prUrl = exec(prCommand, repoPath);
    output.prUrl = prUrl;

    // Extract PR number from URL
    const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
    if (prNumberMatch) {
      output.prNumber = parseInt(prNumberMatch[1], 10);
    }

    output.success = true;
  } catch (error: unknown) {
    output.error = error instanceof Error ? error.message : String(error);
  }

  console.log(JSON.stringify(output));
  process.exit(output.success ? 0 : 1);
}

main();
