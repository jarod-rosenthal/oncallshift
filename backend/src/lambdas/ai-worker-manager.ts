/**
 * AI Worker Manager Lambda
 *
 * Virtual Manager that reviews PRs created by AI Workers.
 * Uses Claude Opus 4.5 for high-quality code review decisions.
 *
 * Invocation modes:
 * 1. Direct invoke with { taskId } - Reviews specific task immediately
 * 2. Scheduled (no payload) - Sweeps for any missed pr_created tasks
 *
 * Flow:
 * 1. Fetch task by ID (or find tasks with status 'pr_created')
 * 2. Claim the task and set status to 'manager_review'
 * 3. Fetch PR diff from GitHub
 * 4. Review code using Opus 4.5
 * 5. Decide: approve, reject, or request revision
 * 6. Update task status and provide feedback
 */

import Anthropic from "@anthropic-ai/sdk";
import { Client } from "pg";
import { v4 as uuidv4 } from "uuid";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const secretsManager = new SecretsManagerClient({
  region: process.env.REGION || "us-east-1",
});

interface DatabaseCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

async function getSecretValue(secretArn: string): Promise<string> {
  const response = await secretsManager.send(
    new GetSecretValueCommand({
      SecretId: secretArn,
    }),
  );
  if (!response.SecretString) {
    throw new Error(`Secret ${secretArn} is empty`);
  }
  return response.SecretString;
}

async function getDatabaseCredentials(): Promise<DatabaseCredentials> {
  const secretArn = process.env.DATABASE_SECRET_ARN;

  // If individual env vars are set (local dev), use those
  if (process.env.DATABASE_HOST) {
    return {
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || "5432"),
      database: process.env.DATABASE_NAME || "pagerduty_lite",
      username: process.env.DATABASE_USER || "postgres",
      password: process.env.DATABASE_PASSWORD || "",
    };
  }

  // Otherwise fetch from Secrets Manager
  if (!secretArn) {
    throw new Error("DATABASE_SECRET_ARN or DATABASE_HOST must be set");
  }

  const secretValue = await getSecretValue(secretArn);

  // Handle postgres:// URL format
  if (secretValue.startsWith("postgres://")) {
    const url = new URL(secretValue);
    return {
      host: url.hostname,
      port: parseInt(url.port || "5432"),
      database: url.pathname.slice(1), // Remove leading /
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    };
  }

  // Handle JSON format
  const secret = JSON.parse(secretValue);
  return {
    host: secret.host,
    port: secret.port || 5432,
    database: secret.dbname || secret.database,
    username: secret.username,
    password: secret.password,
  };
}

async function getGitHubToken(): Promise<string> {
  // Local dev: use env var directly
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  // Production: fetch from Secrets Manager
  const secretArn = process.env.GITHUB_TOKEN_SECRET_ARN;
  if (!secretArn) {
    throw new Error("GITHUB_TOKEN or GITHUB_TOKEN_SECRET_ARN must be set");
  }
  return getSecretValue(secretArn);
}

async function getAnthropicApiKey(): Promise<string> {
  // Local dev: use env var directly
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }
  // Production: fetch from Secrets Manager
  const secretArn = process.env.ANTHROPIC_API_KEY_SECRET_ARN;
  if (!secretArn) {
    throw new Error(
      "ANTHROPIC_API_KEY or ANTHROPIC_API_KEY_SECRET_ARN must be set",
    );
  }
  return getSecretValue(secretArn);
}

interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

async function getJiraCredentials(): Promise<JiraCredentials | null> {
  // Check env vars first (local dev)
  if (process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
    return {
      baseUrl: process.env.JIRA_BASE_URL || "https://oncallshift.atlassian.net",
      email: process.env.JIRA_EMAIL,
      apiToken: process.env.JIRA_API_TOKEN,
    };
  }

  // Production: fetch from Secrets Manager
  const secretArn = process.env.JIRA_CREDENTIALS_SECRET_ARN;
  if (!secretArn) {
    console.warn(
      "[Manager] Jira credentials not configured, skipping Jira updates",
    );
    return null;
  }

  try {
    const secret = JSON.parse(await getSecretValue(secretArn));
    return {
      baseUrl:
        secret.base_url ||
        secret.baseUrl ||
        "https://oncallshift.atlassian.net",
      email: secret.email,
      apiToken: secret.api_token || secret.apiToken,
    };
  } catch (error) {
    console.error("[Manager] Failed to get Jira credentials:", error);
    return null;
  }
}

async function addJiraComment(
  issueKey: string,
  comment: string,
  credentials: JiraCredentials,
): Promise<void> {
  try {
    const auth = Buffer.from(
      `${credentials.email}:${credentials.apiToken}`,
    ).toString("base64");

    const response = await fetch(
      `${credentials.baseUrl}/rest/api/3/issue/${issueKey}/comment`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          body: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: comment }],
              },
            ],
          },
        }),
      },
    );

    if (!response.ok) {
      console.warn(
        `[Manager] Failed to add Jira comment to ${issueKey}: ${response.status}`,
      );
    } else {
      console.log(`[Manager] Added Jira comment to ${issueKey}`);
    }
  } catch (error) {
    console.error(`[Manager] Error adding Jira comment to ${issueKey}:`, error);
  }
}

/**
 * Transition a Jira issue to a target status (e.g., "Done")
 */
async function transitionJiraIssue(
  issueKey: string,
  targetStatus: string,
  credentials: JiraCredentials,
): Promise<boolean> {
  try {
    const auth = Buffer.from(
      `${credentials.email}:${credentials.apiToken}`,
    ).toString("base64");

    // Get available transitions
    const transitionsResponse = await fetch(
      `${credentials.baseUrl}/rest/api/3/issue/${issueKey}/transitions`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      },
    );

    if (!transitionsResponse.ok) {
      console.warn(`[Manager] Failed to get transitions for ${issueKey}`);
      return false;
    }

    const transitionsData = (await transitionsResponse.json()) as {
      transitions?: Array<{ id: string; name: string }>;
    };
    const transitions = transitionsData.transitions || [];

    // Find transition matching target status (case-insensitive)
    const transition = transitions.find((t) =>
      t.name.toLowerCase().includes(targetStatus.toLowerCase())
    );

    if (!transition) {
      console.warn(`[Manager] No "${targetStatus}" transition found for ${issueKey}`);
      return false;
    }

    // Execute the transition
    const response = await fetch(
      `${credentials.baseUrl}/rest/api/3/issue/${issueKey}/transitions`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transition: { id: transition.id } }),
      },
    );

    if (response.ok) {
      console.log(`[Manager] Transitioned ${issueKey} to "${targetStatus}"`);
      return true;
    } else {
      console.warn(`[Manager] Failed to transition ${issueKey}: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`[Manager] Error transitioning ${issueKey}:`, error);
    return false;
  }
}

// Configuration
// Using haiku (cheapest model) until system is stable
const CONFIG = {
  managerModel: "claude-3-5-haiku-20241022",
  maxTokens: 8192,
  maxConcurrentReviews: 3,
  maxRevisions: 3, // Max times a task can be sent back for revision
};

// Event payload for direct invocation
interface ManagerEvent {
  taskId?: string; // If provided, review this specific task
}

// GitHub API setup
const GITHUB_API = "https://api.github.com";

// Identity signatures for AI attribution
const MANAGER_SIGNATURE = "👔 **Virtual Manager** (AI Code Reviewer)";

/**
 * Post a comment on a GitHub PR
 */
async function addGitHubPRComment(
  repo: string,
  prNumber: number,
  comment: string,
): Promise<void> {
  try {
    const githubToken = await getGitHubToken();
    const response = await fetch(
      `${GITHUB_API}/repos/${repo}/issues/${prNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "OnCallShift-AI-Manager",
        },
        body: JSON.stringify({ body: comment }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.warn(
        `[Manager] Failed to add GitHub PR comment to ${repo}#${prNumber}: ${response.status} - ${error}`,
      );
    } else {
      console.log(`[Manager] Added GitHub PR comment to ${repo}#${prNumber}`);
    }
  } catch (error) {
    console.error(
      `[Manager] Error adding GitHub PR comment to ${repo}#${prNumber}:`,
      error,
    );
  }
}

interface ManagerResult {
  tasksReviewed: number;
  approved: number;
  rejected: number;
  revisionsRequested: number;
  errors: string[];
}

interface TaskToReview {
  id: string;
  jiraIssueKey: string;
  summary: string;
  description: string | null;
  githubRepo: string;
  githubPrNumber: number;
  githubPrUrl: string;
  revisionCount: number;
  previousRunContext: string | null;
  reviewFeedback: string | null;
}

interface PRDiff {
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch: string;
  }>;
  totalAdditions: number;
  totalDeletions: number;
  commits: number;
}

interface ReviewResult {
  decision: "approved" | "rejected" | "revision_needed";
  feedback: string;
  codeQualityScore: number;
  testCoverageAssessment: string;
  securityConcerns: string | null;
  styleIssues: string | null;
  inputTokens: number;
  outputTokens: number;
}

export async function handler(
  event: ManagerEvent = {},
): Promise<ManagerResult> {
  const result: ManagerResult = {
    tasksReviewed: 0,
    approved: 0,
    rejected: 0,
    revisionsRequested: 0,
    errors: [],
  };

  // Get database credentials (from Secrets Manager or env vars)
  const dbCreds = await getDatabaseCredentials();
  const client = new Client({
    host: dbCreds.host,
    port: dbCreds.port,
    database: dbCreds.database,
    user: dbCreds.username,
    password: dbCreds.password,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("[Manager] Connected to database");

    let tasksToReview: TaskToReview[];

    // If taskId provided, fetch that specific task
    if (event.taskId) {
      console.log(`[Manager] Direct invoke for task ${event.taskId}`);
      const task = await findTaskById(client, event.taskId);
      tasksToReview = task ? [task] : [];
      if (!task) {
        console.warn(
          `[Manager] Task ${event.taskId} not found or not ready for review`,
        );
      }
    } else {
      // Sweep mode: find any tasks ready for review
      console.log("[Manager] Sweep mode: finding tasks ready for review");
      tasksToReview = await findTasksForReview(client);
    }

    console.log(`[Manager] Found ${tasksToReview.length} tasks to review`);

    // Process each task (limit concurrent reviews in sweep mode)
    const tasksToProcess = event.taskId
      ? tasksToReview
      : tasksToReview.slice(0, CONFIG.maxConcurrentReviews);

    for (const task of tasksToProcess) {
      try {
        await reviewTask(client, task, result);
        result.tasksReviewed++;
      } catch (error: any) {
        console.error(`[Manager] Error reviewing task ${task.id}:`, error);
        result.errors.push(`Task ${task.jiraIssueKey}: ${error.message}`);

        // Release the task back to pr_created status
        await client.query(
          `
          UPDATE ai_worker_tasks
          SET status = 'pr_created',
              reviewer_manager_id = NULL
          WHERE id = $1
        `,
          [task.id],
        );
      }
    }

    console.log("[Manager] Completed", result);
    return result;
  } catch (error: any) {
    console.error("[Manager] Error:", error);
    result.errors.push(error.message);
    return result;
  } finally {
    await client.end();
  }
}

async function findTaskById(
  client: Client,
  taskId: string,
): Promise<TaskToReview | null> {
  const { rows } = await client.query(
    `
    SELECT id, jira_issue_key, summary, description,
           github_repo, github_pr_number, github_pr_url,
           revision_count, previous_run_context, review_feedback
    FROM ai_worker_tasks
    WHERE id = $1
      AND status = 'pr_created'
      AND github_pr_url IS NOT NULL
      AND github_pr_number IS NOT NULL
  `,
    [taskId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    jiraIssueKey: row.jira_issue_key,
    summary: row.summary,
    description: row.description,
    githubRepo: row.github_repo,
    githubPrNumber: row.github_pr_number,
    githubPrUrl: row.github_pr_url,
    revisionCount: row.revision_count,
    previousRunContext: row.previous_run_context,
    reviewFeedback: row.review_feedback,
  };
}

async function findTasksForReview(client: Client): Promise<TaskToReview[]> {
  const { rows } = await client.query(
    `
    SELECT id, jira_issue_key, summary, description,
           github_repo, github_pr_number, github_pr_url,
           revision_count, previous_run_context, review_feedback
    FROM ai_worker_tasks
    WHERE status = 'pr_created'
      AND github_pr_url IS NOT NULL
      AND github_pr_number IS NOT NULL
    ORDER BY created_at ASC
    LIMIT $1
  `,
    [CONFIG.maxConcurrentReviews],
  );

  return rows.map((row) => ({
    id: row.id,
    jiraIssueKey: row.jira_issue_key,
    summary: row.summary,
    description: row.description,
    githubRepo: row.github_repo,
    githubPrNumber: row.github_pr_number,
    githubPrUrl: row.github_pr_url,
    revisionCount: row.revision_count,
    previousRunContext: row.previous_run_context,
    reviewFeedback: row.review_feedback,
  }));
}

async function reviewTask(
  client: Client,
  task: TaskToReview,
  result: ManagerResult,
): Promise<void> {
  console.log(
    `[Manager] Reviewing ${task.jiraIssueKey} (PR #${task.githubPrNumber})`,
  );

  const reviewStartedAt = new Date();

  // Claim the task
  await client.query(
    `
    UPDATE ai_worker_tasks
    SET status = 'manager_review',
        review_requested_at = NOW(),
        manager_review_model = $1
    WHERE id = $2
  `,
    [CONFIG.managerModel, task.id],
  );

  // Fetch PR diff from GitHub
  const prDiff = await fetchPRDiff(task.githubRepo, task.githubPrNumber);

  // Review the PR using Opus 4.5
  const review = await performReview(task, prDiff);

  const reviewEndedAt = new Date();
  const durationSeconds = Math.floor(
    (reviewEndedAt.getTime() - reviewStartedAt.getTime()) / 1000,
  );

  // Calculate cost (Opus 4.5 pricing)
  const estimatedCost =
    (review.inputTokens / 1000) * 0.015 + (review.outputTokens / 1000) * 0.075;

  // Record the review
  const reviewNumber = task.revisionCount + 1;
  await client.query(
    `
    INSERT INTO ai_worker_reviews
    (id, task_id, review_number, decision, feedback, pr_url, pr_diff_summary,
     files_reviewed, code_quality_score, test_coverage_assessment,
     security_concerns, style_issues, claude_input_tokens, claude_output_tokens,
     estimated_cost_usd, started_at, completed_at, duration_seconds)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
  `,
    [
      uuidv4(),
      task.id,
      reviewNumber,
      review.decision,
      review.feedback,
      task.githubPrUrl,
      `+${prDiff.totalAdditions} -${prDiff.totalDeletions} in ${prDiff.files.length} files`,
      JSON.stringify(prDiff.files.map((f) => f.filename)),
      review.codeQualityScore,
      review.testCoverageAssessment,
      review.securityConcerns,
      review.styleIssues,
      review.inputTokens,
      review.outputTokens,
      estimatedCost,
      reviewStartedAt,
      reviewEndedAt,
      durationSeconds,
    ],
  );

  // Get Jira credentials for posting feedback
  const jiraCreds = await getJiraCredentials();

  // Update task based on decision
  if (review.decision === "approved") {
    await client.query(
      `
      UPDATE ai_worker_tasks
      SET status = 'review_approved',
          review_feedback = $1,
          estimated_cost_usd = estimated_cost_usd + $2
      WHERE id = $3
    `,
      [review.feedback, estimatedCost, task.id],
    );

    result.approved++;
    console.log(`[Manager] Approved ${task.jiraIssueKey}`);

    // Build approval message with identity signature
    const approvalMessage =
      `${MANAGER_SIGNATURE}\n\n` +
      `✅ **APPROVED** the pull request!\n\n` +
      `🔀 PR: ${task.githubPrUrl}\n` +
      `📊 Code Quality Score: ${review.codeQualityScore}/10\n\n` +
      `**Feedback:**\n${review.feedback}\n\n` +
      `⏳ **Awaiting manual merge** - Please review and merge the PR when ready.`;

    // Post approval to Jira
    if (jiraCreds) {
      await addJiraComment(task.jiraIssueKey, approvalMessage, jiraCreds);
      // Transition to Done after approval
      await transitionJiraIssue(task.jiraIssueKey, "done", jiraCreds);
    }

    // Post approval to GitHub PR
    if (task.githubRepo && task.githubPrNumber) {
      await addGitHubPRComment(task.githubRepo, task.githubPrNumber, approvalMessage);
    }

    // NOTE: Auto-merge disabled - human reviews and merges PRs manually
  } else if (review.decision === "revision_needed") {
    // Check if max revisions exceeded
    if (task.revisionCount >= CONFIG.maxRevisions) {
      await client.query(
        `
        UPDATE ai_worker_tasks
        SET status = 'failed',
            completed_at = NOW(),
            error_message = 'Max revisions exceeded',
            failure_category = 'revision_limit',
            review_feedback = $1,
            estimated_cost_usd = estimated_cost_usd + $2
        WHERE id = $3
      `,
        [review.feedback, estimatedCost, task.id],
      );

      result.rejected++;
      console.log(
        `[Manager] Failed ${task.jiraIssueKey} - max revisions exceeded`,
      );

      // Build failure message with identity signature
      const failureMessage =
        `${MANAGER_SIGNATURE}\n\n` +
        `❌ **FAILED** - Max revisions exceeded (${CONFIG.maxRevisions})\n\n` +
        `🔀 PR: ${task.githubPrUrl}\n` +
        `📊 Code Quality Score: ${review.codeQualityScore}/10\n\n` +
        `**Final Feedback:**\n${review.feedback}\n\n` +
        `This task requires human intervention.`;

      // Post failure to Jira
      if (jiraCreds) {
        await addJiraComment(task.jiraIssueKey, failureMessage, jiraCreds);
      }

      // Post failure to GitHub PR
      if (task.githubRepo && task.githubPrNumber) {
        await addGitHubPRComment(task.githubRepo, task.githubPrNumber, failureMessage);
      }
    } else {
      // Set next_retry_at so watcher will pick up and re-queue for execution
      await client.query(
        `
        UPDATE ai_worker_tasks
        SET status = 'revision_needed',
            review_feedback = $1,
            revision_count = revision_count + 1,
            previous_run_context = COALESCE(previous_run_context, '') || $2,
            estimated_cost_usd = estimated_cost_usd + $3,
            next_retry_at = NOW() + INTERVAL '30 seconds'
        WHERE id = $4
      `,
        [
          review.feedback,
          `\n\n## Manager Review Feedback (Revision ${reviewNumber})\n${review.feedback}`,
          estimatedCost,
          task.id,
        ],
      );

      result.revisionsRequested++;
      console.log(`[Manager] Requested revision for ${task.jiraIssueKey}`);

      // Build revision message with identity signature
      const revisionMessage =
        `${MANAGER_SIGNATURE}\n\n` +
        `🔄 **REVISION REQUESTED** (#${task.revisionCount + 1})\n\n` +
        `🔀 PR: ${task.githubPrUrl}\n` +
        `📊 Code Quality Score: ${review.codeQualityScore}/10\n\n` +
        `**Feedback - Please address:**\n${review.feedback}\n\n` +
        (review.securityConcerns
          ? `⚠️ **Security Concerns:** ${review.securityConcerns}\n\n`
          : "") +
        (review.styleIssues
          ? `📝 **Style Issues:** ${review.styleIssues}\n\n`
          : "") +
        `The AI worker will automatically retry with this feedback.`;

      // Post revision request to Jira
      if (jiraCreds) {
        await addJiraComment(task.jiraIssueKey, revisionMessage, jiraCreds);
      }

      // Post revision request to GitHub PR
      if (task.githubRepo && task.githubPrNumber) {
        await addGitHubPRComment(task.githubRepo, task.githubPrNumber, revisionMessage);
      }
    }
  } else {
    // rejected
    await client.query(
      `
      UPDATE ai_worker_tasks
      SET status = 'review_rejected',
          completed_at = NOW(),
          error_message = 'PR rejected by manager',
          review_feedback = $1,
          estimated_cost_usd = estimated_cost_usd + $2
      WHERE id = $3
    `,
      [review.feedback, estimatedCost, task.id],
    );

    result.rejected++;
    console.log(`[Manager] Rejected ${task.jiraIssueKey}`);

    // Build rejection message with identity signature
    const rejectionMessage =
      `${MANAGER_SIGNATURE}\n\n` +
      `❌ **REJECTED** the pull request.\n\n` +
      `🔀 PR: ${task.githubPrUrl}\n` +
      `📊 Code Quality Score: ${review.codeQualityScore}/10\n\n` +
      `**Reason for Rejection:**\n${review.feedback}\n\n` +
      (review.securityConcerns
        ? `⚠️ **Security Concerns:** ${review.securityConcerns}\n\n`
        : "") +
      `This task requires human intervention or a different approach.`;

    // Post rejection to Jira
    if (jiraCreds) {
      await addJiraComment(task.jiraIssueKey, rejectionMessage, jiraCreds);
    }

    // Post rejection to GitHub PR
    if (task.githubRepo && task.githubPrNumber) {
      await addGitHubPRComment(task.githubRepo, task.githubPrNumber, rejectionMessage);
    }

    // TODO: Close PR via GitHub API
  }
}

async function fetchPRDiff(repo: string, prNumber: number): Promise<PRDiff> {
  const githubToken = await getGitHubToken();

  try {
    // Fetch PR files
    const filesResponse = await fetch(
      `${GITHUB_API}/repos/${repo}/pulls/${prNumber}/files`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!filesResponse.ok) {
      throw new Error(`GitHub API error: ${filesResponse.status}`);
    }

    const files = (await filesResponse.json()) as Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
      patch?: string;
    }>;

    // Fetch PR details for commit count
    const prResponse = await fetch(
      `${GITHUB_API}/repos/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    const prDetails = (await prResponse.json()) as { commits?: number };

    return {
      files: files.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || "",
      })),
      totalAdditions: files.reduce((sum, f) => sum + f.additions, 0),
      totalDeletions: files.reduce((sum, f) => sum + f.deletions, 0),
      commits: prDetails.commits || 1,
    };
  } catch (error: any) {
    console.error("[Manager] Error fetching PR diff:", error);
    throw error;
  }
}

async function performReview(
  task: TaskToReview,
  prDiff: PRDiff,
): Promise<ReviewResult> {
  const apiKey = await getAnthropicApiKey();
  const anthropic = new Anthropic({ apiKey });

  // Build the review prompt
  const diffContent = prDiff.files
    .map(
      (f) =>
        `### ${f.filename} (${f.status})\n+${f.additions} -${f.deletions}\n\`\`\`diff\n${f.patch}\n\`\`\``,
    )
    .join("\n\n");

  const previousFeedback = task.reviewFeedback
    ? `\n\n## Previous Review Feedback\n${task.reviewFeedback}\n\nThis is revision #${task.revisionCount + 1}. Check if the worker addressed the feedback.`
    : "";

  const prompt = `You are a Senior Engineering Manager reviewing a Pull Request created by an AI worker.

## Task Context
- **Jira Issue**: ${task.jiraIssueKey}
- **Summary**: ${task.summary}
- **Description**: ${task.description || "No description provided"}
${previousFeedback}

## Pull Request Changes
- **Files Changed**: ${prDiff.files.length}
- **Additions**: +${prDiff.totalAdditions}
- **Deletions**: -${prDiff.totalDeletions}
- **Commits**: ${prDiff.commits}

## Diff
${diffContent || "No diff available"}

## Your Task
Review this PR and decide:
1. **APPROVE** - Code is correct, follows best practices, tests pass, ready to merge
2. **REVISION_NEEDED** - Code has issues that can be fixed, provide specific feedback
3. **REJECT** - Fundamental issues, wrong approach, or task cannot be completed this way

Evaluate:
- Does the code correctly implement the Jira task requirements?
- Is the code quality acceptable (clean, readable, maintainable)?
- Are there security vulnerabilities?
- Are there test coverage gaps?
- Does it follow the project's coding standards?

Respond in this exact JSON format:
{
  "decision": "approved" | "revision_needed" | "rejected",
  "feedback": "Detailed explanation of your decision with specific line references if applicable",
  "codeQualityScore": 1-10,
  "testCoverageAssessment": "Brief assessment of test coverage",
  "securityConcerns": "Any security issues found, or null if none",
  "styleIssues": "Any style/formatting issues, or null if none"
}`;

  const response = await anthropic.messages.create({
    model: CONFIG.managerModel,
    max_tokens: CONFIG.maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  // Parse the response
  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Extract JSON from the response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON response from Claude");
  }

  const reviewData = JSON.parse(jsonMatch[0]);

  return {
    decision: reviewData.decision,
    feedback: reviewData.feedback,
    codeQualityScore: reviewData.codeQualityScore,
    testCoverageAssessment: reviewData.testCoverageAssessment,
    securityConcerns: reviewData.securityConcerns,
    styleIssues: reviewData.styleIssues,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
