/**
 * AI Worker Tasks API Routes
 *
 * Manage AI worker tasks (Jira issues being processed)
 */

import { Router, Request, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
import { authenticateRequest } from "../../shared/auth/middleware";
import { getDataSource } from "../../shared/db/data-source";
import {
  AIWorkerTask,
  AIWorkerTaskStatus,
} from "../../shared/models/AIWorkerTask";
import { AIWorkerTaskLog } from "../../shared/models/AIWorkerTaskLog";
import { AIWorkerConversation } from "../../shared/models/AIWorkerConversation";
import { AIWorkerInstance } from "../../shared/models/AIWorkerInstance";
import { Organization } from "../../shared/models/Organization";
import { logger } from "../../shared/utils/logger";
import { setLocationHeader } from "../../shared/utils/location-header";
import {
  parsePaginationParams,
  paginatedResponse,
} from "../../shared/utils/pagination";
import { paginationValidators } from "../../shared/validators/pagination";
import { SQS, SendMessageCommand } from "@aws-sdk/client-sqs";
import { In } from "typeorm";
import { calculateTotalCost, type TokenUsage } from "../../shared/config/pricing";
import { inferPersonaFromJiraIssue, getPersonaRationale } from "../../shared/services/persona-inference";

const router = Router();

// Internal service key for worker-to-API communication
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY;

// Model label mapping (same as webhook handler)
const LABEL_MODEL_MAPPING: Record<string, string> = {
  'opus': 'opus',
  'opus4': 'opus',
  'opus45': 'opus',
  'haiku': 'haiku',
  'claudehaiku': 'haiku',
  'sonnet': 'sonnet',
  'sonnet4': 'sonnet',
};

/**
 * POST /api/v1/ai-worker-tasks/:id/usage
 * Report token usage from Claude Code (called by running ECS tasks)
 *
 * This endpoint accepts internal service key auth (X-Internal-Key header)
 * to allow workers to report usage without org API keys.
 *
 * MUST be defined BEFORE router.use(authenticateRequest) to bypass normal auth.
 */
router.post(
  "/:id/usage",
  [
    param("id").isUUID(),
    body("model").isString(),
    body("inputTokens").isInt({ min: 0 }),
    body("outputTokens").isInt({ min: 0 }),
    body("cacheCreationTokens").optional().isInt({ min: 0 }),
    body("cacheReadTokens").optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check for internal service key (worker-to-API auth)
      const internalKey = req.headers["x-internal-key"] as string;
      const isInternalCall = INTERNAL_SERVICE_KEY && internalKey === INTERNAL_SERVICE_KEY;

      // Also accept org API key auth (Bearer org_*)
      const authHeader = req.headers.authorization;
      const isOrgApiKey = authHeader?.startsWith("Bearer org_");

      if (!isInternalCall && !isOrgApiKey) {
        return res.status(401).json({
          error: "Unauthorized. Provide X-Internal-Key header or Bearer org_* token.",
        });
      }

      const { id } = req.params;
      const {
        model,
        inputTokens,
        outputTokens,
        cacheCreationTokens = 0,
        cacheReadTokens = 0,
      } = req.body;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const orgRepo = dataSource.getRepository(Organization);

      // For internal calls, look up task by ID only (no org scoping)
      const task = await taskRepo.findOne({
        where: { id },
      });

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Idempotency check: reject if usage already reported
      if (task.usageReportedAt) {
        logger.warn("Duplicate usage report rejected", {
          taskId: id,
          previouslyReportedAt: task.usageReportedAt,
        });
        return res.status(409).json({
          error: "Usage already reported for this task",
          usageReportedAt: task.usageReportedAt,
        });
      }

      // Update token counts
      task.claudeInputTokens = inputTokens;
      task.claudeOutputTokens = outputTokens;
      task.claudeCacheCreationTokens = cacheCreationTokens;
      task.claudeCacheReadTokens = cacheReadTokens;
      task.workerModel = model;
      task.usageReportedAt = new Date();

      // Calculate ECS duration
      if (task.startedAt) {
        const durationSeconds = Math.floor(
          (Date.now() - task.startedAt.getTime()) / 1000,
        );
        task.ecsTaskSeconds = durationSeconds;
      }

      // Calculate cost using shared pricing config
      const tokens: TokenUsage = {
        inputTokens,
        outputTokens,
        cacheCreationTokens,
        cacheReadTokens,
      };
      const totalCost = calculateTotalCost(tokens, model, task.ecsTaskSeconds);
      task.estimatedCostUsd = totalCost;

      // Save task
      await taskRepo.save(task);

      // Update org cumulative cost (always, even for failed runs)
      const org = await orgRepo.findOne({ where: { id: task.orgId } });
      if (org) {
        org.aiWorkerCumulativeCost =
          Number(org.aiWorkerCumulativeCost || 0) + totalCost;
        await orgRepo.save(org);
      }

      logger.info("Token usage reported for task", {
        taskId: id,
        model,
        inputTokens,
        outputTokens,
        cacheCreationTokens,
        cacheReadTokens,
        ecsTaskSeconds: task.ecsTaskSeconds,
        totalCost: totalCost.toFixed(4),
        orgCumulativeCost: org?.aiWorkerCumulativeCost?.toFixed(4),
        authMethod: isInternalCall ? "internal_key" : "org_api_key",
      });

      return res.json({
        success: true,
        taskId: id,
        cost: totalCost,
        tokens: { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens },
      });
    } catch (error) {
      logger.error("Error reporting token usage:", error);
      return res.status(500).json({ error: "Failed to report token usage" });
    }
  },
);

// All other routes require authentication
router.use(authenticateRequest);

// Initialize SQS client
const sqs = new SQS({ region: process.env.AWS_REGION || "us-east-1" });
const queueUrl = process.env.AI_WORKER_QUEUE_URL;

/**
 * GET /api/v1/ai-worker-tasks/summary
 * Get summary statistics for tasks
 * NOTE: This route MUST be defined before /:id to avoid "summary" being matched as a UUID
 */
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const taskRepo = dataSource.getRepository(AIWorkerTask);
    const workerRepo = dataSource.getRepository(AIWorkerInstance);

    // Count tasks by status
    const statusCounts = await taskRepo
      .createQueryBuilder("task")
      .select("task.status", "status")
      .addSelect("COUNT(*)", "count")
      .where("task.org_id = :orgId", { orgId })
      .groupBy("task.status")
      .getRawMany();

    // Calculate total cost
    const costResult = await taskRepo
      .createQueryBuilder("task")
      .select("SUM(task.estimated_cost_usd)", "totalCost")
      .where("task.org_id = :orgId", { orgId })
      .getRawOne();

    // Get worker counts
    const workerCounts = await workerRepo
      .createQueryBuilder("worker")
      .select("worker.status", "status")
      .addSelect("COUNT(*)", "count")
      .where("worker.org_id = :orgId", { orgId })
      .groupBy("worker.status")
      .getRawMany();

    return res.json({
      tasks: {
        byStatus: statusCounts.reduce(
          (acc, { status, count }) => {
            acc[status] = parseInt(count, 10);
            return acc;
          },
          {} as Record<string, number>,
        ),
        totalCostUsd: parseFloat(costResult?.totalCost || "0"),
      },
      workers: {
        byStatus: workerCounts.reduce(
          (acc, { status, count }) => {
            acc[status] = parseInt(count, 10);
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    });
  } catch (error) {
    logger.error("Error fetching task summary:", error);
    return res.status(500).json({ error: "Failed to fetch task summary" });
  }
});

// Helper to fetch Jira issue details
async function fetchJiraIssue(issueKey: string): Promise<{
  id: string;
  summary: string;
  description: string | null;
  issueType: string;
  projectKey: string;
  priority: string | null;
  fields: Record<string, any>;
} | null> {
  try {
    const jiraBaseUrl =
      process.env.JIRA_BASE_URL || "https://oncallshift.atlassian.net";
    const jiraEmail = process.env.JIRA_EMAIL;
    const jiraApiToken = process.env.JIRA_API_TOKEN;

    if (!jiraEmail || !jiraApiToken) {
      logger.warn("Jira credentials not configured, using defaults");
      return null;
    }

    const credentials = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString(
      "base64",
    );
    const response = await fetch(
      `${jiraBaseUrl}/rest/api/3/issue/${issueKey}`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      logger.warn(`Failed to fetch Jira issue ${issueKey}: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      id: string;
      fields: {
        summary: string;
        description?: { content?: any[] };
        issuetype?: { name: string };
        project?: { key: string };
        priority?: { name: string };
        [key: string]: any;
      };
    };

    // Extract plain text from Atlassian Document Format
    let description: string | null = null;
    if (data.fields.description?.content) {
      description = extractTextFromADF(data.fields.description.content);
    }

    return {
      id: data.id,
      summary: data.fields.summary,
      description,
      issueType: data.fields.issuetype?.name || "Task",
      projectKey: data.fields.project?.key || issueKey.split("-")[0],
      priority: data.fields.priority?.name || null,
      fields: data.fields,
    };
  } catch (error) {
    logger.error("Error fetching Jira issue:", error);
    return null;
  }
}

// Extract plain text from Atlassian Document Format
function extractTextFromADF(content: any[]): string {
  const parts: string[] = [];

  for (const node of content) {
    if (node.type === "paragraph" && node.content) {
      for (const child of node.content) {
        if (child.type === "text") {
          parts.push(child.text);
        }
      }
      parts.push("\n");
    } else if (node.type === "bulletList" && node.content) {
      for (const item of node.content) {
        if (item.type === "listItem" && item.content) {
          parts.push("• " + extractTextFromADF(item.content).trim());
          parts.push("\n");
        }
      }
    } else if (node.type === "orderedList" && node.content) {
      let i = 1;
      for (const item of node.content) {
        if (item.type === "listItem" && item.content) {
          parts.push(`${i}. ` + extractTextFromADF(item.content).trim());
          parts.push("\n");
          i++;
        }
      }
    } else if (node.type === "heading" && node.content) {
      const level = node.attrs?.level || 1;
      parts.push("#".repeat(level) + " ");
      for (const child of node.content) {
        if (child.type === "text") {
          parts.push(child.text);
        }
      }
      parts.push("\n\n");
    } else if (node.type === "codeBlock" && node.content) {
      parts.push("```\n");
      for (const child of node.content) {
        if (child.type === "text") {
          parts.push(child.text);
        }
      }
      parts.push("\n```\n");
    }
  }

  return parts.join("").trim();
}

// Priority mapping (Jira priority to 1-5 scale)
const PRIORITY_MAPPING: Record<string, number> = {
  Highest: 1,
  High: 2,
  Medium: 3,
  Low: 4,
  Lowest: 5,
};

/**
 * POST /api/v1/ai-worker-tasks/trigger
 * Quick trigger to create and queue a task from just a Jira issue key
 * Fetches issue details from Jira automatically
 */
router.post(
  "/trigger",
  [
    body("jiraIssueKey")
      .isString()
      .matches(/^[A-Z]+-\d+$/)
      .withMessage("Invalid Jira issue key format (e.g., OCS-30)"),
    body("workerPersona")
      .optional()
      .isIn([
        "frontend_developer",
        "backend_developer",
        "devops_engineer",
        "security_engineer",
        "qa_engineer",
        "tech_writer",
        "project_manager",
      ])
      .withMessage("Invalid persona"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { jiraIssueKey, workerPersona: explicitPersona } = req.body;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      // Fetch Jira issue details first (needed for persona inference and duplicate check)
      const jiraIssue = await fetchJiraIssue(jiraIssueKey);

      // Infer the appropriate persona from Jira metadata
      const workerPersona = inferPersonaFromJiraIssue(jiraIssue || undefined, explicitPersona);
      const personaRationale = getPersonaRationale(jiraIssue || undefined, workerPersona);

      logger.info("Persona inference for task", {
        jiraIssueKey,
        inferredPersona: workerPersona,
        rationale: personaRationale,
        wasExplicit: !!explicitPersona,
      });

      // Check for existing active task (race condition prevention)
      const existing = await taskRepo.findOne({
        where: {
          orgId,
          jiraIssueKey,
          status: In([
            "queued",
            "claimed",
            "environment_setup",
            "executing",
            "pr_created",
            "manager_review",
            "revision_needed",
          ]),
        },
      });

      if (existing) {
        return res.status(409).json({
          error: "Task already in progress for this Jira issue",
          existingTaskId: existing.id,
          status: existing.status,
          assignedPersona: existing.workerPersona,
        });
      }

      // Check if the Jira issue has the 'ai-worker-deploy' label
      const labels = (jiraIssue?.fields?.labels as string[]) || [];
      const deploymentEnabled = labels.includes('ai-worker-deploy');

      // Determine model from labels (default to haiku for cost optimization)
      let workerModel = 'haiku';
      for (const label of labels) {
        const normalizedLabel = label.toLowerCase().replace(/[-_\s.]/g, '');
        const labelModel = LABEL_MODEL_MAPPING[normalizedLabel] || LABEL_MODEL_MAPPING[label.toLowerCase()];
        if (labelModel) {
          workerModel = labelModel;
          break;
        }
      }

      logger.info("Model selection for task", {
        jiraIssueKey,
        workerModel,
        labels,
      });

      // Create the task with Jira details if available
      const task = taskRepo.create({
        orgId,
        jiraIssueKey,
        jiraIssueId: jiraIssue?.id || jiraIssueKey,
        jiraProjectKey: jiraIssue?.projectKey || jiraIssueKey.split("-")[0],
        jiraProjectType: "software",
        jiraIssueType: jiraIssue?.issueType || "Task",
        summary: jiraIssue?.summary || `Task for ${jiraIssueKey}`,
        description: jiraIssue?.description || null,
        jiraFields: jiraIssue?.fields || {},
        workerPersona,
        workerModel, // Set model from label (haiku, sonnet, opus)
        githubRepo: "jarod-rosenthal/pagerduty-lite",
        priority: jiraIssue?.priority
          ? PRIORITY_MAPPING[jiraIssue.priority] || 3
          : 3,
        status: "queued",
        deploymentEnabled, // Enable autonomous deployment if label present
      });

      await taskRepo.save(task);

      // Queue the task for execution
      if (queueUrl) {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({ taskId: task.id, action: "execute" }),
          }),
        );
        logger.info(`Task ${task.id} queued for execution`, {
          jiraIssueKey,
          workerPersona,
          workerModel,
          deploymentEnabled,
        });
      } else {
        logger.warn("No queue URL configured, task created but not queued", {
          taskId: task.id,
        });
      }

      setLocationHeader(res, req, "/api/v1/ai-worker-tasks", task.id);
      return res.status(201).json({
        message: "Task created and queued",
        taskId: task.id,
        jiraIssueKey,
        workerPersona,
        workerModel,
        deploymentEnabled,
        status: task.status,
      });
    } catch (error) {
      logger.error("Error triggering AI worker task:", error);
      return res.status(500).json({ error: "Failed to trigger task" });
    }
  },
);

/**
 * GET /api/v1/ai-worker-tasks
 * List all AI worker tasks for the organization
 */
router.get(
  "/",
  [...paginationValidators],
  async (req: Request, res: Response) => {
    try {
      const orgId = req.orgId!;
      const pagination = parsePaginationParams(req.query);
      const sortField = pagination.sort || "createdAt";
      const sortOrder = pagination.order === "asc" ? "ASC" : "DESC";

      // Filters
      const status = req.query.status as AIWorkerTaskStatus | undefined;
      const persona = req.query.persona as string | undefined;
      const jiraProjectKey = req.query.project as string | undefined;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const where: any = { orgId };
      if (status) where.status = status;
      if (persona) where.workerPersona = persona;
      if (jiraProjectKey) where.jiraProjectKey = jiraProjectKey;

      const [tasks, total] = await taskRepo.findAndCount({
        where,
        relations: ["assignedWorker"],
        order: { [sortField]: sortOrder },
        skip: pagination.offset,
        take: pagination.limit,
      });

      const lastItem = tasks[tasks.length - 1];
      return res.json(
        paginatedResponse(
          tasks.map(formatTask),
          total,
          pagination,
          lastItem
            ? { id: lastItem.id, createdAt: lastItem.createdAt }
            : undefined,
          "tasks",
        ),
      );
    } catch (error) {
      logger.error("Error fetching AI worker tasks:", error);
      return res.status(500).json({ error: "Failed to fetch AI worker tasks" });
    }
  },
);

/**
 * POST /api/v1/ai-worker-tasks
 * Manually create a task (bypassing Jira webhook)
 */
router.post(
  "/",
  [
    body("jiraIssueKey")
      .isString()
      .matches(/^[A-Z]+-\d+$/)
      .withMessage("Invalid Jira issue key format"),
    body("summary")
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage("Summary is required"),
    body("description").optional().isString(),
    body("workerPersona")
      .isIn([
        "frontend_developer",
        "backend_developer",
        "devops_engineer",
        "security_engineer",
        "qa_engineer",
        "tech_writer",
        "project_manager",
      ])
      .withMessage("Invalid persona"),
    body("githubRepo").isString().withMessage("GitHub repo is required"),
    body("priority").optional().isInt({ min: 1, max: 5 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const {
        jiraIssueKey,
        summary,
        description,
        workerPersona,
        githubRepo,
        priority,
      } = req.body;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      // Check for duplicate active task
      const existing = await taskRepo.findOne({
        where: {
          orgId,
          jiraIssueKey,
          status: In([
            "queued",
            "claimed",
            "environment_setup",
            "executing",
            "pr_created",
            "awaiting_approval",
          ]),
        },
      });

      if (existing) {
        return res.status(409).json({
          error: "Task already exists for this Jira issue",
          existingTaskId: existing.id,
        });
      }

      const task = taskRepo.create({
        orgId,
        jiraIssueKey,
        jiraIssueId: jiraIssueKey, // Placeholder when created manually
        jiraProjectKey: jiraIssueKey.split("-")[0],
        jiraProjectType: "software",
        jiraIssueType: "Task",
        summary,
        description,
        workerPersona,
        githubRepo,
        priority: priority || 3,
        status: "queued",
      });

      await taskRepo.save(task);

      // Queue the task for execution
      if (queueUrl) {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({ taskId: task.id, action: "execute" }),
          }),
        );
      }

      setLocationHeader(res, req, "/api/v1/ai-worker-tasks", task.id);
      return res.status(201).json(formatTask(task));
    } catch (error) {
      logger.error("Error creating AI worker task:", error);
      return res.status(500).json({ error: "Failed to create AI worker task" });
    }
  },
);

/**
 * GET /api/v1/ai-worker-tasks/:id
 * Get a specific task
 */
router.get(
  "/:id",
  [param("id").isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({
        where: { id, orgId },
        relations: ["assignedWorker", "approvals"],
      });

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      return res.json(formatTask(task));
    } catch (error) {
      logger.error("Error fetching AI worker task:", error);
      return res.status(500).json({ error: "Failed to fetch AI worker task" });
    }
  },
);

/**
 * GET /api/v1/ai-worker-tasks/:id/logs
 * Get execution logs for a task
 */
router.get(
  "/:id/logs",
  [
    param("id").isUUID(),
    query("type").optional().isString(),
    query("severity").optional().isIn(["debug", "info", "warning", "error"]),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;
      const { type, severity } = req.query;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const logRepo = dataSource.getRepository(AIWorkerTaskLog);

      // Verify task exists and belongs to org
      const task = await taskRepo.findOne({
        where: { id, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const where: any = { taskId: id };
      if (type) where.type = type;
      if (severity) where.severity = severity;

      const logs = await logRepo.find({
        where,
        order: { createdAt: "ASC" },
        take: 500, // Limit to 500 most recent logs
      });

      return res.json({
        taskId: id,
        logs: logs.map((log) => ({
          id: log.id,
          type: log.type,
          message: log.message,
          severity: log.severity,
          metadata: log.metadata,
          command: log.command,
          exitCode: log.exitCode,
          stdout: log.stdout,
          stderr: log.stderr,
          filePath: log.filePath,
          durationMs: log.durationMs,
          createdAt: log.createdAt,
        })),
      });
    } catch (error) {
      logger.error("Error fetching task logs:", error);
      return res.status(500).json({ error: "Failed to fetch task logs" });
    }
  },
);

/**
 * GET /api/v1/ai-worker-tasks/:id/conversation
 * Get Claude conversation history for a task
 */
router.get(
  "/:id/conversation",
  [param("id").isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const conversationRepo = dataSource.getRepository(AIWorkerConversation);

      // Verify task exists and belongs to org
      const task = await taskRepo.findOne({
        where: { id, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const conversation = await conversationRepo.findOne({
        where: { taskId: id },
        order: { createdAt: "DESC" },
      });

      if (!conversation) {
        return res.json({
          taskId: id,
          conversation: null,
        });
      }

      return res.json({
        taskId: id,
        conversation: {
          id: conversation.id,
          status: conversation.status,
          model: conversation.model,
          turnCount: conversation.turnCount,
          inputTokens: conversation.inputTokens,
          outputTokens: conversation.outputTokens,
          messages: conversation.messages,
          errorMessage: conversation.errorMessage,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
      });
    } catch (error) {
      logger.error("Error fetching task conversation:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch task conversation" });
    }
  },
);

/**
 * POST /api/v1/ai-worker-tasks/:id/cancel
 * Cancel a running task
 */
router.post(
  "/:id/cancel",
  [param("id").isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({
        where: { id, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (!task.isActive()) {
        return res
          .status(400)
          .json({ error: "Task is not active and cannot be cancelled" });
      }

      // Send cancel message to orchestrator
      if (queueUrl) {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({ taskId: task.id, action: "cancel" }),
          }),
        );
      }

      return res.json({ message: "Cancel request sent", taskId: task.id });
    } catch (error) {
      logger.error("Error cancelling task:", error);
      return res.status(500).json({ error: "Failed to cancel task" });
    }
  },
);

/**
 * POST /api/v1/ai-worker-tasks/:id/heartbeat
 * Update task heartbeat timestamp (called by running ECS tasks)
 */
router.post(
  "/:id/heartbeat",
  [param("id").isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({
        where: { id, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Update heartbeat timestamp
      task.lastHeartbeatAt = new Date();
      await taskRepo.save(task);

      logger.debug("Heartbeat received for task", { taskId: id });

      return res.json({
        taskId: task.id,
        lastHeartbeatAt: task.lastHeartbeatAt,
        status: task.status,
      });
    } catch (error) {
      logger.error("Error updating task heartbeat:", error);
      return res.status(500).json({ error: "Failed to update heartbeat" });
    }
  },
);

/**
 * POST /api/v1/ai-worker-tasks/:id/retry
 * Retry a failed task
 */
router.post(
  "/:id/retry",
  [param("id").isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { id } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({
        where: { id, orgId },
      });

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (task.status !== "failed" && task.status !== "cancelled") {
        return res
          .status(400)
          .json({ error: "Only failed or cancelled tasks can be retried" });
      }

      if (!task.canRetry()) {
        return res.status(400).json({
          error: "Maximum retries exceeded",
          retryCount: task.retryCount,
          maxRetries: task.maxRetries,
        });
      }

      // Send retry message to orchestrator
      if (queueUrl) {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({ taskId: task.id, action: "retry" }),
          }),
        );
      }

      return res.json({ message: "Retry request sent", taskId: task.id });
    } catch (error) {
      logger.error("Error retrying task:", error);
      return res.status(500).json({ error: "Failed to retry task" });
    }
  },
);

// Helper function to format task response
function formatTask(task: AIWorkerTask) {
  return {
    id: task.id,
    orgId: task.orgId,
    jiraIssueKey: task.jiraIssueKey,
    jiraIssueId: task.jiraIssueId,
    jiraProjectKey: task.jiraProjectKey,
    jiraProjectType: task.jiraProjectType,
    jiraIssueType: task.jiraIssueType,
    summary: task.summary,
    description: task.description,
    jiraFields: task.jiraFields,
    workerPersona: task.workerPersona,
    assignedWorkerId: task.assignedWorkerId,
    assignedWorker: task.assignedWorker
      ? {
          id: task.assignedWorker.id,
          displayName: task.assignedWorker.displayName,
          persona: task.assignedWorker.persona,
        }
      : null,
    status: task.status,
    priority: task.priority,
    githubRepo: task.githubRepo,
    githubBranch: task.githubBranch,
    githubPrNumber: task.githubPrNumber,
    githubPrUrl: task.githubPrUrl,
    ecsTaskArn: task.ecsTaskArn,
    ecsTaskId: task.ecsTaskId,
    claudeInputTokens: task.claudeInputTokens,
    claudeOutputTokens: task.claudeOutputTokens,
    ecsTaskSeconds: task.ecsTaskSeconds,
    estimatedCostUsd: task.estimatedCostUsd,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    errorMessage: task.errorMessage,
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    // Self-recovery fields
    lastHeartbeatAt: task.lastHeartbeatAt,
    previousRunContext: task.previousRunContext,
    globalTimeoutAt: task.globalTimeoutAt,
    nextRetryAt: task.nextRetryAt,
    retryBackoffSeconds: task.retryBackoffSeconds,
    failureCategory: task.failureCategory,
    watcherNotes: task.watcherNotes,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    approvals: task.approvals?.map((a) => ({
      id: a.id,
      approvalType: a.approvalType,
      status: a.status,
      description: a.description,
    })),
  };
}

export default router;
