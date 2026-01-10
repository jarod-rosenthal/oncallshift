/**
 * AI Worker Webhooks API Routes
 *
 * Handle incoming webhooks from Jira and GitHub
 */

import { Router, Request, Response } from 'express';
import { Not, In, MoreThan } from 'typeorm';
import { getDataSource } from '../../shared/db/data-source';
import { AIWorkerTask, AIWorkerPersona } from '../../shared/models/AIWorkerTask';
import { AIWorkerTaskLog } from '../../shared/models/AIWorkerTaskLog';
import { AIWorkerApproval } from '../../shared/models/AIWorkerApproval';
import { Organization } from '../../shared/models/Organization';
import { logger } from '../../shared/utils/logger';
import { SQS, SendMessageCommand } from '@aws-sdk/client-sqs';
import crypto from 'crypto';

const router = Router();

// Initialize SQS client
const sqs = new SQS({ region: process.env.AWS_REGION || 'us-east-1' });
const queueUrl = process.env.AI_WORKER_QUEUE_URL;

// GitHub webhook secret
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
// Jira webhook secret - TODO: re-enable after debugging HMAC verification
// const JIRA_WEBHOOK_SECRET = process.env.JIRA_WEBHOOK_SECRET;

// ============================================================================
// CONFIGURATION - Adjust these values as needed
// ============================================================================

/**
 * Default cooldown period (in minutes) after a task completes before allowing
 * the same Jira issue to trigger a new task via webhook.
 * This prevents tight webhook loops when Jira transitions fire.
 * Can be overridden per-org via org.settings.aiWorkerCooldownMinutes
 */
const DEFAULT_COOLDOWN_MINUTES = 10;

/**
 * Get the cooldown minutes for an organization
 * Falls back to DEFAULT_COOLDOWN_MINUTES if not set
 */
function getCooldownMinutes(org: Organization): number {
  const customCooldown = org.settings?.aiWorkerCooldownMinutes;
  if (typeof customCooldown === 'number' && customCooldown >= 0) {
    return customCooldown;
  }
  return DEFAULT_COOLDOWN_MINUTES;
}

// ============================================================================

// ============================================================================
// PERSONA CONFIGURATION
// ============================================================================

// Label to persona mapping (highest priority - explicit user intent)
// These labels can be added to Jira issues to force a specific persona
const LABEL_PERSONA_MAPPING: Record<string, AIWorkerPersona> = {
  // Direct persona labels
  'frontend': 'frontend_developer',
  'backend': 'backend_developer',
  'devops': 'devops_engineer',
  'infra': 'devops_engineer',
  'infrastructure': 'devops_engineer',
  'security': 'security_engineer',
  'qa': 'qa_engineer',
  'test': 'qa_engineer',
  'testing': 'qa_engineer',
  'docs': 'tech_writer',
  'documentation': 'tech_writer',
  'manager': 'project_manager',
  'pm': 'project_manager',

  // Technology-specific labels -> devops
  'terraform': 'devops_engineer',
  'aws': 'devops_engineer',
  'gcp': 'devops_engineer',
  'azure': 'devops_engineer',
  'kubernetes': 'devops_engineer',
  'k8s': 'devops_engineer',
  'docker': 'devops_engineer',
  'ci': 'devops_engineer',
  'cd': 'devops_engineer',
  'cicd': 'devops_engineer',
  'pipeline': 'devops_engineer',
  'ecs': 'devops_engineer',
  'ec2': 'devops_engineer',
  'lambda': 'devops_engineer',
  's3': 'devops_engineer',
  'cloudfront': 'devops_engineer',
  'rds': 'devops_engineer',

  // Technology-specific labels -> frontend
  'react': 'frontend_developer',
  'vue': 'frontend_developer',
  'angular': 'frontend_developer',
  'css': 'frontend_developer',
  'ui': 'frontend_developer',
  'ux': 'frontend_developer',
  'mobile': 'frontend_developer',

  // Technology-specific labels -> backend
  'api': 'backend_developer',
  'database': 'backend_developer',
  'db': 'backend_developer',
  'graphql': 'backend_developer',
  'rest': 'backend_developer',

  // Technology-specific labels -> security
  'auth': 'security_engineer',
  'authentication': 'security_engineer',
  'authorization': 'security_engineer',
  'encryption': 'security_engineer',
  'vulnerability': 'security_engineer',
  'cve': 'security_engineer',
  'owasp': 'security_engineer',
};

// Model label mapping
const LABEL_MODEL_MAPPING: Record<string, string> = {
  'opus': 'opus',
  'opus4': 'opus',
  'opus45': 'opus',
  'haiku': 'haiku',
  'claudehaiku': 'haiku',
  'sonnet': 'sonnet',
  'sonnet4': 'sonnet',
};

// Default persona mapping for Jira issue types (fallback if no label match)
const PERSONA_MAPPING: Record<string, AIWorkerPersona> = {
  'Story': 'backend_developer',
  'Bug': 'backend_developer',
  'Task': 'backend_developer',
  'Sub-task': 'backend_developer',
  'Epic': 'project_manager',
  'Initiative': 'project_manager',
  'Test': 'qa_engineer',
  'Test Task': 'qa_engineer',
  'Infrastructure': 'devops_engineer',
  'CI/CD': 'devops_engineer',
  'Documentation': 'tech_writer',
  'Docs': 'tech_writer',
};

/*
 * Verify Jira webhook HMAC signature - TODO: re-enable after debugging
 *
function verifyJiraSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expected = hmac.digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}
*/

/**
 * POST /api/v1/ai-worker/jira/webhook
 * Receive Jira webhooks for issue events
 */
router.post('/jira/webhook', async (req: Request, res: Response) => {
  try {
    // TODO: Re-enable auth after testing - Jira HMAC signature verification needs debugging
    // For now, we rely on the JQL filter (labels in ai-worker, ai-task) to limit which issues trigger this
    logger.info('Jira webhook received (auth temporarily disabled for testing)');

    const payload = req.body;
    const webhookEvent = payload.webhookEvent;
    const issue = payload.issue;

    logger.info('Received Jira webhook', {
      event: webhookEvent,
      issueKey: issue?.key,
      issueType: issue?.fields?.issuetype?.name,
    });

    // Only process issue_created and issue_updated events
    if (!['jira:issue_created', 'jira:issue_updated'].includes(webhookEvent)) {
      return res.json({ message: 'Event ignored', event: webhookEvent });
    }

    if (!issue) {
      return res.status(400).json({ error: 'No issue in payload' });
    }

    // Ignore webhooks for issues already in Done/Closed status
    // This prevents creating new tasks when tickets are transitioned to Done
    const issueStatus = issue.fields?.status?.name?.toLowerCase() || '';
    if (issueStatus === 'done' || issueStatus === 'closed' || issueStatus === 'resolved') {
      logger.info('Ignoring webhook - Jira issue is in terminal status', {
        issueKey: issue.key,
        status: issue.fields?.status?.name,
      });
      return res.json({
        message: 'Issue in terminal status, ignoring webhook',
        issueKey: issue.key,
        status: issue.fields?.status?.name,
      });
    }

    // Check if the issue has the AI worker label or is assigned to AI
    const labels = issue.fields?.labels || [];
    const assignee = issue.fields?.assignee;
    const hasAiLabel = labels.some((l: string) =>
      l.toLowerCase().includes('ai-worker') || l.toLowerCase().includes('ai-task')
    );
    const isAssignedToAi = assignee?.displayName?.toLowerCase().includes('ai') ||
                          assignee?.emailAddress?.toLowerCase().includes('ai');

    if (!hasAiLabel && !isAssignedToAi) {
      return res.json({ message: 'Issue not marked for AI worker', issueKey: issue.key });
    }

    // Get organization from Jira project key
    // For now, use the default org - in production, this would be configurable
    const dataSource = await getDataSource();
    const orgRepo = dataSource.getRepository(Organization);
    const org = await orgRepo.findOne({ where: {} }); // Get first org for now

    if (!org) {
      logger.error('No organization found for Jira webhook');
      return res.status(500).json({ error: 'No organization configured' });
    }

    const taskRepo = dataSource.getRepository(AIWorkerTask);

    // Check for existing active task (any non-terminal status)
    // Include review_approved as terminal since it means PR was approved
    const existingTask = await taskRepo.findOne({
      where: {
        orgId: org.id,
        jiraIssueKey: issue.key,
        status: Not(In(['completed', 'failed', 'cancelled', 'review_approved'])),
      },
    });

    if (existingTask) {
      // Update the task's jiraFields with latest data from webhook (e.g., label changes)
      // This allows adding 'review' label after task creation to trigger Manager review
      const updatedFields = {
        priority: issue.fields?.priority?.name,
        labels: issue.fields?.labels,
        components: issue.fields?.components?.map((c: any) => c.name),
        sprint: issue.fields?.customfield_10020?.[0]?.name,
      };

      await taskRepo.update(existingTask.id, {
        jiraFields: updatedFields,
        summary: issue.fields?.summary || existingTask.summary,
        description: extractDescription(issue.fields?.description) || existingTask.description,
      });

      logger.info('Updated existing task with latest Jira data', {
        taskId: existingTask.id,
        issueKey: issue.key,
        labels: updatedFields.labels,
      });

      return res.json({
        message: 'Task updated with latest Jira data',
        taskId: existingTask.id,
        issueKey: issue.key,
      });
    }

    // Check for recently completed task (cooldown to avoid tight webhook loops).
    // Configurable per-org via settings.aiWorkerCooldownMinutes.
    // Include pr_created and review_pending since they're quasi-terminal states.
    const cooldownMinutes = getCooldownMinutes(org);
    const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000);

    // First check by completedAt (for tasks that set it)
    let recentlyCompletedTask = await taskRepo.findOne({
      where: {
        orgId: org.id,
        jiraIssueKey: issue.key,
        status: In(['completed', 'failed', 'cancelled', 'review_approved']),
        completedAt: MoreThan(cooldownTime),
      },
      order: { completedAt: 'DESC' },
    });

    // Also check by updatedAt for pr_created/review_pending (they don't set completedAt)
    if (!recentlyCompletedTask) {
      recentlyCompletedTask = await taskRepo.findOne({
        where: {
          orgId: org.id,
          jiraIssueKey: issue.key,
          status: In(['pr_created', 'review_pending', 'manager_review']),
          updatedAt: MoreThan(cooldownTime),
        },
        order: { updatedAt: 'DESC' },
      });
    }

    if (recentlyCompletedTask) {
      const timestamp = recentlyCompletedTask.completedAt || recentlyCompletedTask.updatedAt;
      logger.info('Ignoring webhook - task recently completed or in progress (cooldown period)', {
        issueKey: issue.key,
        taskId: recentlyCompletedTask.id,
        status: recentlyCompletedTask.status,
        completedAt: recentlyCompletedTask.completedAt,
        updatedAt: recentlyCompletedTask.updatedAt,
        cooldownMinutes,
      });
      return res.json({
        message: `Task recently active (cooldown period - ${cooldownMinutes} minutes)`,
        taskId: recentlyCompletedTask.id,
        issueKey: issue.key,
        status: recentlyCompletedTask.status,
        timestamp,
      });
    }

    // Determine persona - check labels first, then issue type
    const issueType = issue.fields?.issuetype?.name || 'Task';
    const issueLabels: string[] = issue.fields?.labels || [];

    // Priority 1: Check for explicit persona label
    let persona: AIWorkerPersona = 'backend_developer'; // default
    let personaSource = 'default';

    for (const label of issueLabels) {
      const normalizedLabel = label.toLowerCase().replace(/[-_\s]/g, '');
      const labelPersona = LABEL_PERSONA_MAPPING[normalizedLabel] || LABEL_PERSONA_MAPPING[label.toLowerCase()];
      if (labelPersona) {
        persona = labelPersona;
        personaSource = `label:${label}`;
        break;
      }
    }

    // Priority 2: Fall back to issue type mapping
    if (personaSource === 'default' && PERSONA_MAPPING[issueType]) {
      persona = PERSONA_MAPPING[issueType];
      personaSource = `issueType:${issueType}`;
    }

    // Determine model from labels (default to sonnet)
    let workerModel = 'sonnet';
    for (const label of issueLabels) {
      const normalizedLabel = label.toLowerCase().replace(/[-_\s.]/g, '');
      const labelModel = LABEL_MODEL_MAPPING[normalizedLabel] || LABEL_MODEL_MAPPING[label.toLowerCase()];
      if (labelModel) {
        workerModel = labelModel;
        break;
      }
    }

    // Check for review label - enables manager review
    const hasReviewLabel = issueLabels.some(
      (l: string) => l.toLowerCase() === 'review'
    );

    // Check if deployment is enabled via label
    const deploymentEnabled = issueLabels.includes('ai-worker-deploy');

    logger.info('Determined persona and model for task', {
      issueKey: issue.key,
      persona,
      personaSource,
      workerModel,
      labels: issueLabels,
      issueType,
      hasReviewLabel,
      deploymentEnabled,
    });

    // Create new task
    const taskData = {
      orgId: org.id,
      jiraIssueKey: issue.key,
      jiraIssueId: issue.id,
      jiraProjectKey: issue.fields?.project?.key || issue.key.split('-')[0],
      jiraProjectType: issue.fields?.project?.projectTypeKey || 'software',
      jiraIssueType: issueType,
      summary: issue.fields?.summary || 'No summary',
      description: extractDescription(issue.fields?.description),
      jiraFields: {
        priority: issue.fields?.priority?.name,
        labels: issue.fields?.labels,
        components: issue.fields?.components?.map((c: any) => c.name),
        sprint: issue.fields?.customfield_10020?.[0]?.name, // Sprint field
      },
      workerPersona: persona,
      workerModel,
      githubRepo: process.env.DEFAULT_GITHUB_REPO || 'jarod-rosenthal/pagerduty-lite',
      priority: mapJiraPriority(issue.fields?.priority?.name),
      status: 'queued' as const,
      skipManagerReview: !hasReviewLabel, // Enable manager review when "review" label is present
      deploymentEnabled, // Enable autonomous deployment if label present
    };
    const task = taskRepo.create(taskData);

    await taskRepo.save(task);

    logger.info('Created AI worker task from Jira webhook', {
      taskId: task.id,
      issueKey: issue.key,
      persona,
    });

    // Queue the task for execution (for durability)
    if (queueUrl) {
      await sqs.send(new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ taskId: task.id, action: 'execute' }),
      }));
    }

    // PUSH-BASED: Immediately trigger task processing
    try {
      const triggerUrl = `http://localhost:${process.env.PORT || 3000}/api/v1/ai-worker-tasks/${task.id}/trigger`;
      const internalKey = process.env.INTERNAL_SERVICE_KEY;

      const triggerResponse = await fetch(triggerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': internalKey || '',
        },
      });

      if (!triggerResponse.ok) {
        logger.warn('Failed to immediately trigger task, will be picked up by orchestrator', {
          taskId: task.id,
          status: triggerResponse.status,
        });
      } else {
        logger.info('Task triggered immediately (push-based)', { taskId: task.id });
      }
    } catch (triggerError) {
      logger.warn('Error triggering task immediately, will be picked up by orchestrator', {
        taskId: task.id,
        error: triggerError,
      });
      // Non-fatal - task will be processed by orchestrator poll if this fails
    }

    return res.status(201).json({
      message: 'Task created',
      taskId: task.id,
      issueKey: issue.key,
      persona,
    });
  } catch (error) {
    logger.error('Error processing Jira webhook:', error);
    return res.status(500).json({ error: 'Failed to process Jira webhook' });
  }
});

/**
 * POST /api/v1/ai-worker/github/webhook
 * Receive GitHub webhooks for PR events
 */
router.post('/github/webhook', async (req: Request, res: Response) => {
  try {
    // Verify GitHub webhook signature
    if (GITHUB_WEBHOOK_SECRET) {
      const signature = req.headers['x-hub-signature-256'] as string;
      const payload = JSON.stringify(req.body);

      if (!signature || !verifyGitHubSignature(payload, signature, GITHUB_WEBHOOK_SECRET)) {
        logger.warn('Invalid GitHub webhook signature');
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const event = req.headers['x-github-event'] as string;
    const payload = req.body;

    logger.info('Received GitHub webhook', {
      event,
      action: payload.action,
      prNumber: payload.pull_request?.number,
    });

    // Handle different events
    switch (event) {
      case 'pull_request':
        await handlePullRequestEvent(payload);
        break;
      case 'pull_request_review':
        await handlePullRequestReviewEvent(payload);
        break;
      case 'check_run':
        await handleCheckRunEvent(payload);
        break;
      default:
        logger.info('Ignoring GitHub event', { event });
    }

    return res.json({ message: 'Webhook processed', event });
  } catch (error) {
    logger.error('Error processing GitHub webhook:', error);
    return res.status(500).json({ error: 'Failed to process GitHub webhook' });
  }
});

/**
 * Handle pull_request events
 */
async function handlePullRequestEvent(payload: any): Promise<void> {
  const { action, pull_request: pr } = payload;

  if (!pr) return;

  // Find task by PR number or branch name (handles race condition where webhook arrives before worker reports PR number)
  const dataSource = await getDataSource();
  const taskRepo = dataSource.getRepository(AIWorkerTask);
  const logRepo = dataSource.getRepository(AIWorkerTaskLog);

  let task = await taskRepo.findOne({
    where: { githubPrNumber: pr.number },
  });

  // Fallback: If PR number not found, try finding by branch name
  // This handles the race condition where GitHub webhook arrives before worker reports the PR number
  if (!task && pr.head?.ref) {
    const branchName = pr.head.ref;
    task = await taskRepo.findOne({
      where: { githubBranch: branchName },
    });

    // If found by branch, update the task with the PR number
    if (task) {
      task.githubPrNumber = pr.number;
      task.githubPrUrl = pr.html_url;
      await taskRepo.save(task);
      logger.info('Task found by branch and updated with PR number', {
        taskId: task.id,
        prNumber: pr.number,
        branch: branchName
      });
    }
  }

  if (!task) {
    logger.info('No task found for PR', { prNumber: pr.number, branch: pr.head?.ref });
    return;
  }

  switch (action) {
    case 'opened':
      // PR was created - trigger deployment if enabled (dev environment workflow)
      // In dev, we deploy immediately to test, then approve PR for merge to main
      if (task.deploymentEnabled) {
        logger.info('PR created with deployment enabled, queuing deployment', {
          taskId: task.id,
          jiraKey: task.jiraIssueKey,
          prNumber: pr.number,
        });

        const SQS = (await import('@aws-sdk/client-sqs')).SQS;
        const SendMessageCommand = (await import('@aws-sdk/client-sqs')).SendMessageCommand;
        const sqs = new SQS({ region: process.env.AWS_REGION || 'us-east-1' });
        const queueUrl = process.env.AI_WORKER_QUEUE_URL;

        if (!queueUrl) {
          logger.error('AI_WORKER_QUEUE_URL not set, cannot trigger deployment', { taskId: task.id });
        } else {
          await sqs.send(new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({ taskId: task.id, action: 'deploy' }),
          }));

          logger.info('Deployment queued successfully after PR creation', { taskId: task.id, prNumber: pr.number });
        }
      }
      break;

    case 'closed':
      if (pr.merged) {
        // PR was merged - set terminal status based on previous state
        if (task.status === 'review_requested' || task.status === 'pr_approved') {
          // Risky PR was approved and merged
          task.status = 'pr_merged';
        } else {
          // Safe PR was auto-merged or legacy completed task
          task.status = 'pr_merged';
        }
        task.completedAt = new Date();
        await taskRepo.save(task);

        const log = AIWorkerTaskLog.create(task.id, 'git_operation', `PR #${pr.number} was merged`, { severity: 'info' });
        await logRepo.save(logRepo.create(log));

        logger.info('PR merged, task completed', {
          taskId: task.id,
          prNumber: pr.number,
          finalStatus: task.status
        });
      } else {
        // PR was closed without merge
        const log = AIWorkerTaskLog.create(task.id, 'warning', `PR #${pr.number} was closed without merge`, { severity: 'warning' });
        await logRepo.save(logRepo.create(log));
      }
      break;

    case 'reopened':
      const log = AIWorkerTaskLog.create(task.id, 'git_operation', `PR #${pr.number} was reopened`, { severity: 'info' });
      await logRepo.save(logRepo.create(log));
      break;
  }
}

/**
 * Handle pull_request_review events
 */
async function handlePullRequestReviewEvent(payload: any): Promise<void> {
  const { action, review, pull_request: pr } = payload;

  logger.info('Processing pull_request_review event', {
    action,
    prNumber: pr?.number,
    reviewState: review?.state,
    hasReview: !!review,
    hasPr: !!pr
  });

  if (!pr || !review) {
    logger.info('Missing PR or review in payload', { hasPr: !!pr, hasReview: !!review });
    return;
  }

  // Only process submitted reviews
  if (action !== 'submitted') {
    logger.info('Ignoring non-submitted review', { action });
    return;
  }

  const dataSource = await getDataSource();
  const taskRepo = dataSource.getRepository(AIWorkerTask);
  const approvalRepo = dataSource.getRepository(AIWorkerApproval);
  const logRepo = dataSource.getRepository(AIWorkerTaskLog);

  const task = await taskRepo.findOne({
    where: { githubPrNumber: pr.number },
  });

  if (!task) {
    logger.info('No task found for PR review', { prNumber: pr.number });
    return;
  }

  logger.info('Found task for PR review', {
    taskId: task.id,
    jiraKey: task.jiraIssueKey,
    currentStatus: task.status,
    prNumber: pr.number
  });

  const reviewState = review.state?.toUpperCase();
  const reviewer = review.user?.login;

  const log = AIWorkerTaskLog.create(
    task.id,
    'info',
    `PR review from ${reviewer}: ${reviewState}`,
    { severity: reviewState === 'APPROVED' ? 'info' : 'warning' }
  );
  await logRepo.save(logRepo.create(log));

  // Find pending approval for this task
  const approval = await approvalRepo.findOne({
    where: {
      taskId: task.id,
      approvalType: 'pr_review',
      status: 'pending',
    },
  });

  if (reviewState === 'APPROVED') {
    logger.info('PR approved, updating task', {
      taskId: task.id,
      currentStatus: task.status,
      reviewer
    });

    if (approval) {
      approval.autoApprove(`GitHub review approved by ${reviewer}`);
      await approvalRepo.save(approval);
    }

    // Check if this was a risky PR waiting for review
    if (task.status === 'review_requested') {
      // Human approved risky PR - transition to pr_approved and REQUEUE for deployment
      task.status = 'pr_approved';
      task.githubApprovedBy = reviewer;
      await taskRepo.save(task);

      logger.info('Risky PR approved, requeueing for deployment', {
        taskId: task.id,
        prNumber: pr.number,
        reviewer
      });

      // Requeue the task for deployment via SQS
      if (queueUrl) {
        await sqs.send(new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({ taskId: task.id, action: 'deploy_approved_pr' }),
        }));
        logger.info('Task requeued for deployment after PR approval', { taskId: task.id });
      }
    } else {
      // Regular approval (legacy workflow or already deployed)
      task.status = 'review_approved';
      task.githubApprovedBy = reviewer;
      await taskRepo.save(task);

      logger.info('Task updated to review_approved', {
        taskId: task.id,
        jiraKey: task.jiraIssueKey,
        approvedBy: reviewer
      });
    }
  } else if (reviewState === 'CHANGES_REQUESTED') {
    // Don't auto-reject, but log it
    const changeLog = AIWorkerTaskLog.create(
      task.id,
      'warning',
      `Changes requested by ${reviewer}: ${review.body || 'No comment'}`,
      { severity: 'warning' }
    );
    await logRepo.save(logRepo.create(changeLog));
  }
}

/**
 * Handle check_run events (CI status)
 */
async function handleCheckRunEvent(payload: any): Promise<void> {
  const { action, check_run: checkRun } = payload;

  if (!checkRun) return;

  // Only process completed check runs
  if (action !== 'completed') return;

  // Get PR number from check run
  const prNumbers = checkRun.pull_requests?.map((pr: any) => pr.number) || [];

  if (prNumbers.length === 0) return;

  const dataSource = await getDataSource();
  const taskRepo = dataSource.getRepository(AIWorkerTask);
  const logRepo = dataSource.getRepository(AIWorkerTaskLog);

  for (const prNumber of prNumbers) {
    const task = await taskRepo.findOne({
      where: { githubPrNumber: prNumber },
    });

    if (!task) continue;

    const conclusion = checkRun.conclusion;
    const checkName = checkRun.name;

    const severity = conclusion === 'success' ? 'info' as const :
                    conclusion === 'failure' ? 'error' as const : 'warning' as const;

    // Use 'test_run' for CI checks
    const log = AIWorkerTaskLog.create(
      task.id,
      'test_run',
      `CI check "${checkName}": ${conclusion}`,
      { severity }
    );
    await logRepo.save(logRepo.create(log));

    if (conclusion === 'failure') {
      logger.warn('CI check failed for task', {
        taskId: task.id,
        checkName,
        prNumber,
      });
    }
  }
}

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expected = `sha256=${hmac.digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Extract text from Jira description (handles ADF format)
 */
function extractDescription(description: any): string {
  if (!description) return '';

  // If it's a string, return as-is
  if (typeof description === 'string') return description;

  // If it's ADF (Atlassian Document Format), extract text
  if (description.type === 'doc' && description.content) {
    return extractTextFromADF(description.content);
  }

  return JSON.stringify(description);
}

/**
 * Recursively extract text from ADF content
 */
function extractTextFromADF(content: any[]): string {
  let text = '';

  for (const node of content) {
    if (node.type === 'text') {
      text += node.text || '';
    } else if (node.type === 'paragraph' || node.type === 'heading') {
      text += extractTextFromADF(node.content || []) + '\n';
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      text += extractTextFromADF(node.content || []);
    } else if (node.type === 'listItem') {
      text += '- ' + extractTextFromADF(node.content || []);
    } else if (node.type === 'codeBlock') {
      text += '```\n' + extractTextFromADF(node.content || []) + '\n```\n';
    } else if (node.content) {
      text += extractTextFromADF(node.content);
    }
  }

  return text;
}

/**
 * Map Jira priority to numeric priority (1-5)
 */
function mapJiraPriority(priority: string | undefined): number {
  const mapping: Record<string, number> = {
    'Highest': 1,
    'High': 2,
    'Medium': 3,
    'Low': 4,
    'Lowest': 5,
    // PagerDuty-style
    'P1': 1,
    'P2': 2,
    'P3': 3,
    'P4': 4,
    'P5': 5,
  };

  return mapping[priority || ''] || 3; // Default to medium
}

export default router;
