/**
 * Super Admin API Routes
 *
 * Control Center endpoints for monitoring and managing AI Workers
 * Only accessible by users with role='super_admin'
 */

import { Router, Request, Response } from "express";
import { authenticateRequest } from "../../shared/auth/middleware";
import { getDataSource } from "../../shared/db/data-source";
import { AIWorkerInstance } from "../../shared/models/AIWorkerInstance";
import {
  AIWorkerTask,
  AIWorkerTaskStatus,
} from "../../shared/models/AIWorkerTask";
import { AIWorkerTaskLog } from "../../shared/models/AIWorkerTaskLog";
import { AIWorkerTaskRun } from "../../shared/models/AIWorkerTaskRun";
import { AIWorkerConversation } from "../../shared/models/AIWorkerConversation";
import { AIWorkerReview } from "../../shared/models/AIWorkerReview";
import { AIWorkerToolEvent } from "../../shared/models/AIWorkerToolEvent";
import { AIWorkerToolPattern } from "../../shared/models/AIWorkerToolPattern";
import { AIWorkerPatternApplication } from "../../shared/models/AIWorkerPatternApplication";
import { logger } from "../../shared/utils/logger";
import {
  SQS,
  GetQueueAttributesCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { ECS, StopTaskCommand, UpdateServiceCommand, ListTasksCommand } from "@aws-sdk/client-ecs";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { MoreThan, In } from "typeorm";
import { body, param, query, validationResult } from "express-validator";

const router = Router();

// Initialize AWS clients
const awsRegion = process.env.AWS_REGION || "us-east-1";
const sqs = new SQS({ region: awsRegion });
const ecs = new ECS({ region: awsRegion });
const lambda = new LambdaClient({ region: awsRegion });
const queueUrl = process.env.AI_WORKER_QUEUE_URL;
const ecsCluster = process.env.ECS_CLUSTER_NAME || "pagerduty-lite-dev";
const orchestratorServiceName =
  process.env.AI_WORKER_ORCHESTRATOR_SERVICE || `${ecsCluster}-aiw-orch`;
const managerLambdaName =
  process.env.AI_WORKER_MANAGER_LAMBDA ||
  "pagerduty-lite-dev-ai-worker-manager";

// Middleware to check super admin role
// Supports both user JWT auth (req.user) and org API key auth (req.orgId)
const requireSuperAdmin = async (
  req: Request,
  res: Response,
  next: Function,
): Promise<void> => {
  // If authenticated via org API key, allow access (org admins can use control center)
  if (req.authMethod === "api_key" && req.orgId) {
    return next();
  }

  // If authenticated via user JWT, check for super_admin role
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "super_admin") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  next();
};

// All routes require authentication + super admin role
router.use(authenticateRequest);
router.use(requireSuperAdmin);

/**
 * GET /api/v1/super-admin/control-center
 * Get aggregated data for the AI Workers Control Center
 */
router.get("/control-center", async (_req: Request, res: Response) => {
  try {
    const dataSource = await getDataSource();
    const workerRepo = dataSource.getRepository(AIWorkerInstance);
    const taskRepo = dataSource.getRepository(AIWorkerTask);
    const logRepo = dataSource.getRepository(AIWorkerTaskLog);
    const conversationRepo = dataSource.getRepository(AIWorkerConversation);

    // Get today's start (midnight)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get all workers
    const workers = await workerRepo.find({
      order: { displayName: "ASC" },
    });

    // Get active tasks (not completed/failed/cancelled) + recently completed (last 10 min)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const activeTasks = await taskRepo.find({
      where: [
        // Truly active tasks (including Manager review stages)
        {
          status: In([
            "queued",
            "dispatching",
            "claimed",
            "environment_setup",
            "executing",
            "pr_created",
            "manager_review",
            "revision_needed",
            "review_pending",
            "review_approved",
          ]),
        },
        // Recently completed tasks (show for 10 minutes after completion)
        {
          status: In(["completed", "failed", "cancelled", "review_rejected"]),
          completedAt: MoreThan(tenMinutesAgo),
        },
      ],
      order: { createdAt: "DESC" },
    });

    // Get recent completed tasks (today)
    const recentCompleted = await taskRepo.find({
      where: {
        status: In(["completed", "failed", "cancelled"]),
        completedAt: MoreThan(todayStart),
      },
      order: { completedAt: "DESC" },
      take: 15,
    });

    // Calculate today's cost (use dynamic calculation if estimatedCostUsd is 0)
    const todayTasks = await taskRepo.find({
      where: {
        createdAt: MoreThan(todayStart),
      },
    });
    const todayCost = todayTasks.reduce((sum, t) => {
      // If we have a stored cost, use it
      if (Number(t.estimatedCostUsd) > 0) {
        return sum + Number(t.estimatedCostUsd);
      }
      // Otherwise calculate from duration if available
      if (t.startedAt) {
        const endTime = t.completedAt || new Date();
        const durationSeconds = Math.floor(
          (endTime.getTime() - t.startedAt.getTime()) / 1000,
        );
        // Fargate Spot: ~$0.015/hour
        const ecsCost = (durationSeconds / 3600) * 0.015;
        return sum + ecsCost;
      }
      return sum;
    }, 0);

    // Get queue depth from SQS
    let queueDepth = 0;
    if (queueUrl) {
      try {
        const queueAttrs = await sqs.send(
          new GetQueueAttributesCommand({
            QueueUrl: queueUrl,
            AttributeNames: ["ApproximateNumberOfMessages"],
          }),
        );
        queueDepth = parseInt(
          queueAttrs.Attributes?.ApproximateNumberOfMessages || "0",
          10,
        );
      } catch (err) {
        logger.warn("Failed to get SQS queue depth:", err);
      }
    }

    // Get logs for active tasks
    const activeTaskIds = activeTasks.map((t) => t.id);
    let taskLogs: AIWorkerTaskLog[] = [];
    if (activeTaskIds.length > 0) {
      taskLogs = await logRepo.find({
        where: {
          taskId: In(activeTaskIds),
        },
        order: { createdAt: "DESC" },
        take: 100, // Last 100 logs across all active tasks
      });
    }

    // Get conversations for turn counts
    let conversations: AIWorkerConversation[] = [];
    if (activeTaskIds.length > 0) {
      conversations = await conversationRepo.find({
        where: {
          taskId: In(activeTaskIds),
        },
      });
    }

    // Build response
    const stats = {
      totalWorkers: workers.length,
      activeWorkers: workers.filter((w) => w.status === "working").length,
      queueDepth,
      todayCost: Math.round(todayCost * 100) / 100,
      todayCompleted: todayTasks.filter((t) => t.status === "completed").length,
      todayFailed: todayTasks.filter((t) => t.status === "failed").length,
    };

    // Map workers with current task info
    // Filter to show only workers that are currently working OR were active in last 10 min
    const workersData = workers
      .filter((w) => {
        // Always show workers that are currently working
        if (w.status === "working") return true;
        // Show workers with recent activity (last 10 minutes)
        if (w.lastTaskAt && w.lastTaskAt > tenMinutesAgo) return true;
        // Hide idle workers with no recent activity
        return false;
      })
      .map((w) => {
        const currentTask = activeTasks.find((t) => t.assignedWorkerId === w.id);
        const conversation = currentTask
          ? conversations.find((c) => c.taskId === currentTask.id)
          : null;

        return {
          id: w.id,
          displayName: w.displayName,
          persona: w.persona,
          role: w.role,
          status: w.status,
          tasksCompleted: w.tasksCompleted,
          tasksFailed: w.tasksFailed,
          totalCostUsd: Number(w.totalCostUsd),
          // Manager-specific stats
          reviewCount: w.reviewCount,
          approvalsCount: w.approvalsCount,
          rejectionsCount: w.rejectionsCount,
          revisionsRequestedCount: w.revisionsRequestedCount,
          currentTask: currentTask
            ? {
                id: currentTask.id,
                jiraKey: currentTask.jiraIssueKey,
                summary: currentTask.summary,
                status: currentTask.status,
                turnCount: conversation?.turnCount || 0,
                maxTurns: 50, // Default max turns
              }
            : null,
        };
      });

    // Map active tasks with logs and progress
    const activeTasksData = activeTasks.map((t) => {
      // For Manager review tasks, use the Manager worker instance
      // For regular tasks, use the assigned worker
      const isManagerTask = ["manager_review"].includes(t.status) && t.reviewerManagerId;
      const workerId = isManagerTask ? t.reviewerManagerId : t.assignedWorkerId;
      const worker = workers.find((w) => w.id === workerId);
      const conversation = conversations.find((c) => c.taskId === t.id);
      const logs = taskLogs.filter((l) => l.taskId === t.id).slice(0, 10);

      // Calculate step progress
      const steps = getTaskSteps(t.status);

      // For Manager tasks, use Manager model; otherwise use worker model
      const displayModel = isManagerTask ? (t.managerReviewModel || "sonnet") : t.workerModel;

      return {
        id: t.id,
        jiraIssueKey: t.jiraIssueKey,
        summary: t.summary,
        status: t.status,
        workerName: worker?.displayName || (isManagerTask ? "Virtual Manager" : "Unassigned"),
        workerPersona: isManagerTask ? "manager" : t.workerPersona,
        workerModel: displayModel,
        workerRole: isManagerTask ? "manager" : (worker?.role || "worker"),
        turnCount: conversation?.turnCount || 0,
        maxTurns: 50,
        estimatedCostUsd: Number(t.estimatedCostUsd),
        startedAt: t.startedAt,
        hasPr: !!t.githubPrUrl,
        githubPrUrl: t.githubPrUrl,
        recentLogs: logs.map((l) => ({
          timestamp: l.createdAt,
          message: l.message,
          type: l.type,
          severity: l.severity,
        })),
        steps,
      };
    });

    // Map recent completed tasks (with dynamic cost calculation)
    const recentCompletedData = recentCompleted.map((t) => {
      let costUsd = Number(t.estimatedCostUsd);
      // Calculate cost dynamically if not stored
      if (costUsd === 0 && t.startedAt) {
        const endTime = t.completedAt || new Date();
        const durationSeconds = Math.floor(
          (endTime.getTime() - t.startedAt.getTime()) / 1000,
        );
        costUsd = (durationSeconds / 3600) * 0.015; // Fargate Spot rate
      }
      return {
        id: t.id,
        jiraIssueKey: t.jiraIssueKey,
        summary: t.summary,
        status: t.status,
        workerModel: t.workerModel,
        costUsd,
        durationMinutes:
          t.completedAt && t.startedAt
            ? Math.round(
                (t.completedAt.getTime() - t.startedAt.getTime()) / 60000,
              )
            : null,
        completedAt: t.completedAt,
        githubPrUrl: t.githubPrUrl,
      };
    });

    return res.json({
      stats,
      workers: workersData,
      activeTasks: activeTasksData,
      recentCompleted: recentCompletedData,
    });
  } catch (error) {
    logger.error("Error fetching control center data:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch control center data" });
  }
});

/**
 * GET /api/v1/super-admin/control-center/logs/:taskId
 * Stream logs for a specific task (for CLI tool)
 */
router.get(
  "/control-center/logs/:taskId",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const since = req.query.since
        ? new Date(req.query.since as string)
        : undefined;
      const limit = parseInt(req.query.limit as string) || 100;

      const dataSource = await getDataSource();
      const logRepo = dataSource.getRepository(AIWorkerTaskLog);
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      // Verify task exists
      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Get logs
      const whereClause: any = { taskId };
      if (since) {
        whereClause.createdAt = MoreThan(since);
      }

      const logs = await logRepo.find({
        where: whereClause,
        order: { createdAt: "DESC" },
        take: limit,
      });

      return res.json({
        taskId,
        taskStatus: task.status,
        logs: logs.reverse().map((l) => ({
          id: l.id,
          timestamp: l.createdAt,
          type: l.type,
          message: l.message,
          severity: l.severity,
          command: l.command,
          exitCode: l.exitCode,
          filePath: l.filePath,
          durationMs: l.durationMs,
        })),
      });
    } catch (error) {
      logger.error("Error fetching task logs:", error);
      return res.status(500).json({ error: "Failed to fetch task logs" });
    }
  },
);

/**
 * POST /api/v1/super-admin/control-center/logs
 * Receive logs from the executor container
 */
router.post(
  "/control-center/logs",
  [
    body("taskId").isUUID(),
    body("type").isIn([
      "system",
      "claude_output",
      "tool_use",
      "file_edit",
      "bash_command",
      "test_run",
      "git_operation",
      "error",
      "warning",
      "info",
      "manager",         // Manager system messages
      "manager_output",  // Manager Claude output
    ]),
    body("message").isString().notEmpty(),
    body("severity").optional().isIn(["info", "warning", "error"]),
    body("command").optional().isString(),
    body("exitCode").optional().isInt(),
    body("stdout").optional().isString(),
    body("stderr").optional().isString(),
    body("filePath").optional().isString(),
    body("durationMs").optional().isInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        taskId,
        type,
        message,
        severity,
        command,
        exitCode,
        stdout,
        stderr,
        filePath,
        durationMs,
      } = req.body;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const logRepo = dataSource.getRepository(AIWorkerTaskLog);

      // Verify task exists
      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Create and save log entry
      const logData = AIWorkerTaskLog.create(taskId, type, message, {
        severity: severity || "info",
        command,
        exitCode,
        stdout,
        stderr,
        filePath,
        durationMs,
      });

      const log = logRepo.create(logData);
      await logRepo.save(log);

      // Also update task heartbeat
      task.lastHeartbeatAt = new Date();
      await taskRepo.save(task);

      return res.status(201).json({
        id: log.id,
        taskId: log.taskId,
        timestamp: log.createdAt,
      });
    } catch (error) {
      logger.error("Error saving task log:", error);
      return res.status(500).json({ error: "Failed to save log" });
    }
  },
);

/**
 * GET /api/v1/super-admin/control-center/logs/:taskId/stream
 * SSE endpoint for real-time log streaming
 * Note: Supports token in query param since EventSource doesn't support headers
 */
router.get(
  "/control-center/logs/:taskId/stream",
  async (req: Request, res: Response) => {
    const { taskId } = req.params;

    // EventSource doesn't support Authorization headers, so we also accept token in query
    // The authenticateRequest middleware already ran, but for SSE we may need query param fallback
    // This is handled by the middleware, but we log it for debugging
    if (req.query.token && !req.user && !req.orgId) {
      // Token was in query but auth failed - return error
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const logRepo = dataSource.getRepository(AIWorkerTaskLog);

      // Verify task exists
      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
      res.flushHeaders();

      // Send initial connection event
      res.write(
        `data: ${JSON.stringify({ type: "connected", taskId, status: task.status })}\n\n`,
      );

      let lastLogId: string | null = null;
      let lastStatus = task.status;

      // Poll for new logs every second
      const intervalId = setInterval(async () => {
        try {
          // Get task status
          const currentTask = await taskRepo.findOne({ where: { id: taskId } });
          if (!currentTask) {
            res.write(
              `data: ${JSON.stringify({ type: "error", message: "Task not found" })}\n\n`,
            );
            clearInterval(intervalId);
            res.end();
            return;
          }

          // Send status update if changed
          if (currentTask.status !== lastStatus) {
            res.write(
              `data: ${JSON.stringify({ type: "status", status: currentTask.status })}\n\n`,
            );
            lastStatus = currentTask.status;
          }

          // Get new logs since last check
          const queryBuilder = logRepo
            .createQueryBuilder("log")
            .where("log.taskId = :taskId", { taskId })
            .orderBy("log.createdAt", "ASC");

          if (lastLogId) {
            queryBuilder.andWhere("log.id > :lastLogId", { lastLogId });
          }

          const newLogs = await queryBuilder.getMany();

          for (const log of newLogs) {
            res.write(
              `data: ${JSON.stringify({
                type: "log",
                id: log.id,
                timestamp: log.createdAt,
                logType: log.type,
                message: log.message,
                severity: log.severity,
                command: log.command,
                exitCode: log.exitCode,
                filePath: log.filePath,
                durationMs: log.durationMs,
              })}\n\n`,
            );
            lastLogId = log.id;
          }

          // End stream if task is complete
          if (["completed", "failed", "cancelled"].includes(currentTask.status)) {
            res.write(
              `data: ${JSON.stringify({ type: "complete", status: currentTask.status })}\n\n`,
            );
            clearInterval(intervalId);
            res.end();
          }
        } catch (err) {
          logger.error("Error in SSE loop:", err);
        }
      }, 1000);

      // Clean up on client disconnect
      req.on("close", () => {
        clearInterval(intervalId);
      });

      // SSE connection is now open - no return needed (connection stays open)
      return;
    } catch (error) {
      logger.error("Error setting up SSE stream:", error);
      return res.status(500).json({ error: "Failed to set up log stream" });
    }
  },
);

/**
 * GET /api/v1/super-admin/control-center/tasks
 * List tasks with filtering and pagination
 */
router.get(
  "/control-center/tasks",
  [
    query("status")
      .optional()
      .isIn([
        "queued",
        "claimed",
        "environment_setup",
        "executing",
        "pr_created",
        "review_pending",
        "review_approved",
        "review_rejected",
        "completed",
        "failed",
        "blocked",
        "cancelled",
      ]),
    query("search").optional().isString(),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const status = req.query.status as AIWorkerTaskStatus | undefined;
      const search = req.query.search as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const queryBuilder = taskRepo
        .createQueryBuilder("task")
        .leftJoinAndSelect("task.assignedWorker", "worker")
        .orderBy("task.createdAt", "DESC")
        .take(limit)
        .skip(offset);

      if (status) {
        queryBuilder.andWhere("task.status = :status", { status });
      }

      if (search) {
        queryBuilder.andWhere(
          "(task.jiraIssueKey ILIKE :search OR task.summary ILIKE :search)",
          {
            search: `%${search}%`,
          },
        );
      }

      const [tasks, total] = await queryBuilder.getManyAndCount();

      return res.json({
        tasks: tasks.map((t) => ({
          id: t.id,
          jiraIssueKey: t.jiraIssueKey,
          summary: t.summary,
          status: t.status,
          workerModel: t.workerModel,
          workerPersona: t.workerPersona,
          workerName: t.assignedWorker?.displayName || "Unassigned",
          retryCount: t.retryCount,
          maxRetries: t.maxRetries,
          estimatedCostUsd: Number(t.estimatedCostUsd),
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          errorMessage: t.errorMessage,
          failureCategory: t.failureCategory,
          lastHeartbeatAt: t.lastHeartbeatAt,
          nextRetryAt: t.nextRetryAt,
          globalTimeoutAt: t.globalTimeoutAt,
          retryBackoffSeconds: t.retryBackoffSeconds,
          watcherNotes: t.watcherNotes,
          ecsTaskArn: t.ecsTaskArn,
          githubPrUrl: t.githubPrUrl,
          githubPrNumber: t.githubPrNumber,
          githubBranch: t.githubBranch,
          createdAt: t.createdAt,
        })),
        total,
        limit,
        offset,
      });
    } catch (error) {
      logger.error("Error fetching tasks:", error);
      return res.status(500).json({ error: "Failed to fetch tasks" });
    }
  },
);

/**
 * GET /api/v1/super-admin/control-center/tasks/:id/runs
 * Get all run attempts for a task
 */
router.get(
  "/control-center/tasks/:taskId/runs",
  [param("taskId").isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { taskId } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const runRepo = dataSource.getRepository(AIWorkerTaskRun);

      // Verify task exists
      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Get all runs
      const runs = await runRepo.find({
        where: { taskId },
        order: { runNumber: "ASC" },
      });

      return res.json({
        taskId,
        taskStatus: task.status,
        runs: runs.map((r) => ({
          id: r.id,
          runNumber: r.runNumber,
          outcome: r.outcome,
          startedAt: r.startedAt,
          endedAt: r.endedAt,
          durationSeconds: r.durationSeconds,
          errorMessage: r.errorMessage,
          errorCategory: r.errorCategory,
          ecsTaskId: r.ecsTaskId,
          claudeInputTokens: r.claudeInputTokens,
          claudeOutputTokens: r.claudeOutputTokens,
          estimatedCostUsd: Number(r.estimatedCostUsd),
          filesModified: r.filesModified,
          gitBranch: r.gitBranch,
          gitCommitSha: r.gitCommitSha,
        })),
      });
    } catch (error) {
      logger.error("Error fetching task runs:", error);
      return res.status(500).json({ error: "Failed to fetch task runs" });
    }
  },
);

/**
 * POST /api/v1/super-admin/control-center/tasks/:id/retry
 * Enhanced retry with options to reset retry count and provide custom context
 */
router.post(
  "/control-center/tasks/:taskId/retry",
  [
    param("taskId").isUUID(),
    body("resetRetryCount").optional().isBoolean(),
    body("customContext").optional().isString().isLength({ max: 10000 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { taskId } = req.params;
      const { resetRetryCount, customContext } = req.body;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (!["failed", "cancelled", "blocked"].includes(task.status)) {
        return res
          .status(400)
          .json({
            error: "Only failed, cancelled, or blocked tasks can be retried",
          });
      }

      // Reset retry count if requested
      if (resetRetryCount) {
        task.retryCount = 0;
        task.retryBackoffSeconds = 60;
      }

      // Add custom context if provided
      if (customContext) {
        const existingContext = task.previousRunContext || "";
        task.previousRunContext =
          existingContext + "\n\n## Manual Retry Context\n" + customContext;
      }

      // Set global timeout if not already set (4 hours from now)
      if (!task.globalTimeoutAt) {
        task.globalTimeoutAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
      }

      // Update task state for retry
      task.status = "queued";
      task.errorMessage = null;
      task.failureCategory = null;
      task.nextRetryAt = null;
      task.watcherNotes =
        (task.watcherNotes || "") +
        `\n[${new Date().toISOString()}] Manual retry triggered`;

      await taskRepo.save(task);

      // Send retry message to queue
      if (queueUrl) {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({ taskId: task.id, action: "retry" }),
          }),
        );
      }

      logger.info("Manual retry triggered for task", {
        taskId,
        resetRetryCount,
        hasCustomContext: !!customContext,
      });

      return res.json({
        message: "Retry initiated",
        taskId: task.id,
        retryCount: task.retryCount,
        globalTimeoutAt: task.globalTimeoutAt,
      });
    } catch (error) {
      logger.error("Error retrying task:", error);
      return res.status(500).json({ error: "Failed to retry task" });
    }
  },
);

/**
 * POST /api/v1/super-admin/control-center/tasks/reset-by-key
 * Reset a failed task back to queued status by Jira key
 */
router.post(
  "/control-center/tasks/reset-by-key",
  [body("jiraKey").isString().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { jiraKey } = req.body;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      // Find the most recent task for this Jira key
      const task = await taskRepo.findOne({
        where: { jiraIssueKey: jiraKey },
        order: { createdAt: "DESC" },
      });

      if (!task) {
        return res.status(404).json({ error: `Task not found for ${jiraKey}` });
      }

      if (!["failed", "cancelled", "blocked"].includes(task.status)) {
        return res.status(400).json({
          error: `Task is in ${task.status} status, can only reset failed/cancelled/blocked tasks`,
        });
      }

      // Reset the task
      task.status = "queued";
      task.errorMessage = null;
      task.ecsTaskArn = null;
      task.ecsTaskId = null;
      task.startedAt = null;
      task.lastHeartbeatAt = null;
      task.nextRetryAt = null;
      task.retryCount = 0;
      task.retryBackoffSeconds = 60;
      await taskRepo.save(task);

      logger.info(`Reset task ${jiraKey} (${task.id}) to queued`);
      return res.json({
        message: `Task ${jiraKey} reset to queued`,
        taskId: task.id,
        previousStatus: task.status,
      });
    } catch (error) {
      logger.error("Error resetting task:", error);
      return res.status(500).json({ error: "Failed to reset task" });
    }
  },
);

/**
 * POST /api/v1/super-admin/control-center/tasks/reset-to-pr-created
 * Reset a cancelled task to pr_created so Virtual Manager can review
 */
router.post(
  "/control-center/tasks/reset-to-pr-created",
  [body("jiraKey").isString().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { jiraKey } = req.body;
      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({
        where: { jiraIssueKey: jiraKey },
        order: { createdAt: "DESC" },
      });

      if (!task) {
        return res.status(404).json({ error: `Task not found for ${jiraKey}` });
      }

      if (!task.githubPrUrl) {
        return res.status(400).json({
          error: `Task has no PR URL, cannot reset to pr_created`,
        });
      }

      const previousStatus = task.status;
      task.status = "pr_created";
      task.reviewRequestedAt = null;
      task.reviewFeedback = null;
      await taskRepo.save(task);

      logger.info(`Reset task ${jiraKey} (${task.id}) to pr_created for VM review`);
      return res.json({
        message: `Task ${jiraKey} reset to pr_created - Virtual Manager will review on next sweep`,
        taskId: task.id,
        previousStatus,
        prUrl: task.githubPrUrl,
      });
    } catch (error) {
      logger.error("Error resetting task to pr_created:", error);
      return res.status(500).json({ error: "Failed to reset task" });
    }
  },
);

/**
 * POST /api/v1/super-admin/control-center/tasks/:id/cancel
 * Cancel a running task with reason
 */
router.post(
  "/control-center/tasks/:taskId/cancel",
  [
    param("taskId").isUUID(),
    body("reason").optional().isString().isLength({ max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { taskId } = req.params;
      const { reason } = req.body;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (["completed", "failed", "cancelled"].includes(task.status)) {
        return res.status(400).json({ error: "Task is already finished" });
      }

      // Stop ECS task if running
      if (task.ecsTaskArn) {
        try {
          await ecs.send(
            new StopTaskCommand({
              cluster: ecsCluster,
              task: task.ecsTaskArn,
              reason: reason || "Cancelled via Control Center",
            }),
          );
          logger.info("Stopped ECS task", {
            taskId,
            ecsTaskArn: task.ecsTaskArn,
          });
        } catch (err) {
          logger.warn("Failed to stop ECS task (may already be stopped):", err);
        }
      }

      // Update task state
      task.status = "cancelled";
      task.completedAt = new Date();
      task.errorMessage = reason || "Cancelled via Control Center";
      task.watcherNotes =
        (task.watcherNotes || "") +
        `\n[${new Date().toISOString()}] Cancelled: ${reason || "No reason provided"}`;

      // Calculate cost from duration
      if (task.startedAt) {
        task.ecsTaskSeconds = Math.floor(
          (task.completedAt.getTime() - task.startedAt.getTime()) / 1000,
        );
        task.estimatedCostUsd = task.calculateCost();
      }

      await taskRepo.save(task);

      logger.info("Task cancelled via Control Center", { taskId, reason });

      return res.json({
        message: "Task cancelled",
        taskId: task.id,
        status: task.status,
      });
    } catch (error) {
      logger.error("Error cancelling task:", error);
      return res.status(500).json({ error: "Failed to cancel task" });
    }
  },
);

/**
 * GET /api/v1/super-admin/control-center/watcher/status
 * Get watcher Lambda status and metrics
 */
router.get(
  "/control-center/watcher/status",
  async (_req: Request, res: Response) => {
    try {
      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      // Count tasks in various states that watcher monitors
      const stuckThreshold = new Date(Date.now() - 3 * 60 * 1000); // 3 mins ago (fast cleanup)

      const [
        monitoringCount,
        stuckCount,
        pendingRetryCount,
        globalTimeoutCount,
        loopCount,
      ] = await Promise.all([
        // Active tasks being monitored
        taskRepo.count({
          where: { status: In(["executing", "environment_setup"]) },
        }),
        // Stuck tasks (no heartbeat for 15+ mins)
        taskRepo
          .createQueryBuilder("task")
          .where("task.status IN (:...statuses)", {
            statuses: ["executing", "environment_setup"],
          })
          .andWhere("task.lastHeartbeatAt < :threshold", {
            threshold: stuckThreshold,
          })
          .getCount(),
        // Tasks pending retry
        taskRepo.count({
          where: {
            status: In(["failed", "blocked"]),
            nextRetryAt: MoreThan(new Date()),
          },
        }),
        // Tasks that hit global timeout
        taskRepo.count({
          where: {
            failureCategory: "timeout",
          },
        }),
        // Tasks with loop detection
        taskRepo.count({
          where: {
            failureCategory: "loop",
          },
        }),
      ]);

      // Return in format frontend expects
      return res.json({
        enabled: true,
        lastRunAt: null, // Would need CloudWatch Logs API to get this
        stuckTasks: stuckCount,
        pendingRetries: pendingRetryCount,
        loopsDetected: loopCount,
        globalTimeouts: globalTimeoutCount,
        tasksMonitored: monitoringCount,
      });
    } catch (error) {
      logger.error("Error fetching watcher status:", error);
      return res.status(500).json({ error: "Failed to fetch watcher status" });
    }
  },
);

/**
 * GET /api/v1/super-admin/control-center/manager/status
 * Get Virtual Manager status and metrics
 */
router.get(
  "/control-center/manager/status",
  async (_req: Request, res: Response) => {
    try {
      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const reviewRepo = dataSource.getRepository(AIWorkerReview);
      const instanceRepo = dataSource.getRepository(AIWorkerInstance);

      // Get manager instances
      const managers = await instanceRepo.find({
        where: { role: "manager" },
      });

      // Count tasks in manager review states
      const [awaitingReviewCount, underReviewCount, revisionNeededCount] =
        await Promise.all([
          taskRepo.count({
            where: { status: "pr_created" as AIWorkerTaskStatus },
          }),
          taskRepo.count({
            where: { status: "manager_review" as AIWorkerTaskStatus },
          }),
          taskRepo.count({
            where: { status: "revision_needed" as AIWorkerTaskStatus },
          }),
        ]);

      // Get recent reviews (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentReviews = await reviewRepo.find({
        where: { createdAt: MoreThan(oneDayAgo) },
        order: { createdAt: "DESC" },
      });

      // Calculate review stats
      const approvedCount = recentReviews.filter(
        (r) => r.decision === "approved",
      ).length;
      const rejectedCount = recentReviews.filter(
        (r) => r.decision === "rejected",
      ).length;
      const revisionRequestedCount = recentReviews.filter(
        (r) => r.decision === "revision_needed",
      ).length;
      const totalReviewCost = recentReviews.reduce(
        (sum, r) => sum + Number(r.estimatedCostUsd),
        0,
      );
      const avgReviewDuration =
        recentReviews.length > 0
          ? recentReviews.reduce(
              (sum, r) => sum + (r.durationSeconds || 0),
              0,
            ) / recentReviews.length
          : 0;

      return res.json({
        enabled: true,
        managers: managers.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          modelId: m.modelId,
          status: m.status,
          reviewCount: m.reviewCount,
          approvalsCount: m.approvalsCount,
          rejectionsCount: m.rejectionsCount,
          revisionsRequestedCount: m.revisionsRequestedCount,
          approvalRate: m.getApprovalRate(),
        })),
        queue: {
          awaitingReview: awaitingReviewCount,
          underReview: underReviewCount,
          revisionNeeded: revisionNeededCount,
        },
        last24Hours: {
          totalReviews: recentReviews.length,
          approved: approvedCount,
          rejected: rejectedCount,
          revisionsRequested: revisionRequestedCount,
          totalCost: Math.round(totalReviewCost * 100) / 100,
          avgDurationSeconds: Math.round(avgReviewDuration),
        },
      });
    } catch (error) {
      logger.error("Error fetching manager status:", error);
      return res.status(500).json({ error: "Failed to fetch manager status" });
    }
  },
);

/**
 * GET /api/v1/super-admin/control-center/reviews
 * List recent PR reviews
 */
router.get(
  "/control-center/reviews",
  [
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const dataSource = await getDataSource();
      const reviewRepo = dataSource.getRepository(AIWorkerReview);

      const [reviews, total] = await reviewRepo.findAndCount({
        relations: ["task", "manager"],
        order: { createdAt: "DESC" },
        take: limit,
        skip: offset,
      });

      return res.json({
        reviews: reviews.map((r) => ({
          id: r.id,
          taskId: r.taskId,
          jiraIssueKey: r.task?.jiraIssueKey,
          managerId: r.managerId,
          managerName: r.manager?.displayName,
          reviewNumber: r.reviewNumber,
          decision: r.decision,
          feedback: r.feedback,
          codeQualityScore: r.codeQualityScore,
          durationSeconds: r.durationSeconds,
          estimatedCostUsd: Number(r.estimatedCostUsd),
          createdAt: r.createdAt,
        })),
        total,
        limit,
        offset,
      });
    } catch (error) {
      logger.error("Error fetching reviews:", error);
      return res.status(500).json({ error: "Failed to fetch reviews" });
    }
  },
);

/**
 * GET /api/v1/super-admin/control-center/tasks/:taskId/reviews
 * Get all reviews for a specific task
 */
router.get(
  "/control-center/tasks/:taskId/reviews",
  [param("taskId").isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { taskId } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const reviewRepo = dataSource.getRepository(AIWorkerReview);

      // Verify task exists
      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const reviews = await reviewRepo.find({
        where: { taskId },
        relations: ["manager"],
        order: { reviewNumber: "ASC" },
      });

      return res.json({
        taskId,
        jiraIssueKey: task.jiraIssueKey,
        revisionCount: task.revisionCount,
        currentStatus: task.status,
        reviews: reviews.map((r) => ({
          id: r.id,
          reviewNumber: r.reviewNumber,
          decision: r.decision,
          feedback: r.feedback,
          managerName: r.manager?.displayName,
          codeQualityScore: r.codeQualityScore,
          testCoverageAssessment: r.testCoverageAssessment,
          securityConcerns: r.securityConcerns,
          styleIssues: r.styleIssues,
          filesReviewed: r.filesReviewed,
          durationSeconds: r.durationSeconds,
          estimatedCostUsd: Number(r.estimatedCostUsd),
          createdAt: r.createdAt,
        })),
      });
    } catch (error) {
      logger.error("Error fetching task reviews:", error);
      return res.status(500).json({ error: "Failed to fetch task reviews" });
    }
  },
);

/**
 * Helper: Get task step progress based on status
 */
function getTaskSteps(
  status: string,
): Array<{ name: string; status: "done" | "active" | "pending" }> {
  const statusOrder = [
    "queued",
    "claimed",
    "environment_setup",
    "executing",
    "pr_created",
    "review_pending",
    "review_approved",
    "completed",
  ];

  const statusIndex = statusOrder.indexOf(status);
  const steps = [
    { name: "Queued", statuses: ["queued"] },
    { name: "Claimed", statuses: ["claimed"] },
    { name: "Environment Setup", statuses: ["environment_setup"] },
    { name: "Executing", statuses: ["executing"] },
    {
      name: "PR Created",
      statuses: ["pr_created", "review_pending", "review_approved"],
    },
    { name: "Completed", statuses: ["completed"] },
  ];

  return steps.map((step) => {
    const isActive = step.statuses.includes(status);
    const isDone =
      !isActive && statusOrder.indexOf(step.statuses[0]) < statusIndex;

    return {
      name: step.name,
      status: isActive
        ? ("active" as const)
        : isDone
          ? ("done" as const)
          : ("pending" as const),
    };
  });
}

/**
 * PATCH /api/v1/super-admin/control-center/tasks/:taskId/complete
 * Mark a task as completed with PR info (for when orchestrator isn't running)
 */
router.patch(
  "/control-center/tasks/:taskId/complete",
  [
    param("taskId").isUUID(),
    body("status").isIn(["pr_created", "completed", "failed"]),
    body("githubPrUrl").optional().isURL(),
    body("githubPrNumber").optional().isInt(),
    body("githubBranch").optional().isString(),
    body("errorMessage").optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { taskId } = req.params;
      const {
        status,
        githubPrUrl,
        githubPrNumber,
        githubBranch,
        errorMessage,
      } = req.body;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Update task
      task.status = status as AIWorkerTaskStatus;
      if (githubPrUrl) task.githubPrUrl = githubPrUrl;
      if (githubPrNumber) task.githubPrNumber = githubPrNumber;
      if (githubBranch) task.githubBranch = githubBranch;
      if (errorMessage) task.errorMessage = errorMessage;
      if (status === "completed" || status === "failed") {
        task.completedAt = new Date();

        // Calculate cost from duration
        if (task.startedAt) {
          task.ecsTaskSeconds = Math.floor(
            (task.completedAt.getTime() - task.startedAt.getTime()) / 1000,
          );
          // Use the model's calculateCost method which factors in ECS time
          task.estimatedCostUsd = task.calculateCost();
        }
      }

      await taskRepo.save(task);

      logger.info("Task status updated via control center", { taskId, status });

      // If status is pr_created, invoke the Manager Lambda to review immediately
      let managerInvoked = false;
      if (status === "pr_created") {
        try {
          logger.info("Invoking Manager Lambda for PR review", {
            taskId,
            managerLambdaName,
          });
          await lambda.send(
            new InvokeCommand({
              FunctionName: managerLambdaName,
              InvocationType: "Event", // Async invocation
              Payload: Buffer.from(JSON.stringify({ taskId })),
            }),
          );
          managerInvoked = true;
          logger.info("Manager Lambda invoked successfully", { taskId });
        } catch (lambdaError) {
          // Log but don't fail - the sweep Lambda will catch it
          logger.warn("Failed to invoke Manager Lambda (sweep will catch it)", {
            taskId,
            error:
              lambdaError instanceof Error
                ? lambdaError.message
                : "Unknown error",
          });
        }
      }

      return res.json({
        id: task.id,
        status: task.status,
        githubPrUrl: task.githubPrUrl,
        githubPrNumber: task.githubPrNumber,
        managerInvoked,
      });
    } catch (error) {
      logger.error("Error updating task status:", error);
      return res.status(500).json({ error: "Failed to update task status" });
    }
  },
);

/**
 * DELETE /api/v1/super-admin/control-center/workers
 * Remove all worker instances from the database (except managers)
 */
router.delete(
  "/control-center/workers",
  async (_req: Request, res: Response) => {
    try {
      const dataSource = await getDataSource();
      const workerRepo = dataSource.getRepository(AIWorkerInstance);

      // Delete all workers except managers
      const result = await workerRepo
        .createQueryBuilder()
        .delete()
        .from(AIWorkerInstance)
        .where("role != :role OR role IS NULL", { role: "manager" })
        .execute();

      logger.info("Cleaned up workers", { count: result.affected });

      return res.json({
        success: true,
        message: `Removed ${result.affected || 0} workers`,
        count: result.affected || 0,
      });
    } catch (error) {
      logger.error("Error cleaning up workers:", error);
      return res.status(500).json({ error: "Failed to clean up workers" });
    }
  },
);

/**
 * GET /api/v1/super-admin/control-center/system/status
 * Get current AI Workers system running state
 */
router.get(
  "/control-center/system/status",
  async (_req: Request, res: Response) => {
    try {
      // Check orchestrator service status
      let orchestratorRunning = false;
      let orchestratorDesiredCount = 0;
      let executorTaskCount = 0;

      try {
        const describeResult = await ecs.describeServices({
          cluster: ecsCluster,
          services: [orchestratorServiceName],
        });

        if (describeResult.services && describeResult.services.length > 0) {
          const service = describeResult.services[0];
          orchestratorDesiredCount = service.desiredCount || 0;
          orchestratorRunning = (service.runningCount || 0) > 0;
        }
      } catch (err) {
        logger.warn("Failed to get orchestrator status:", err);
      }

      // Count running executor tasks
      try {
        const listResult = await ecs.send(
          new ListTasksCommand({
            cluster: ecsCluster,
            family: `${ecsCluster}-ai-worker-executor`,
            desiredStatus: "RUNNING",
          }),
        );
        executorTaskCount = listResult.taskArns?.length || 0;
      } catch (err) {
        logger.warn("Failed to list executor tasks:", err);
      }

      return res.json({
        systemEnabled: orchestratorDesiredCount > 0,
        orchestrator: {
          running: orchestratorRunning,
          desiredCount: orchestratorDesiredCount,
        },
        executors: {
          running: executorTaskCount,
        },
      });
    } catch (error) {
      logger.error("Error fetching system status:", error);
      return res.status(500).json({ error: "Failed to fetch system status" });
    }
  },
);

/**
 * POST /api/v1/super-admin/control-center/system/start
 * Scale up the orchestrator service to start processing tasks
 */
router.post(
  "/control-center/system/start",
  async (_req: Request, res: Response) => {
    try {
      // Scale up orchestrator to 1
      await ecs.send(
        new UpdateServiceCommand({
          cluster: ecsCluster,
          service: orchestratorServiceName,
          desiredCount: 1,
        }),
      );

      logger.info("AI Workers system started - orchestrator scaled to 1");

      return res.json({
        success: true,
        message: "AI Workers system started",
        orchestratorDesiredCount: 1,
      });
    } catch (error) {
      logger.error("Error starting AI Workers system:", error);
      return res
        .status(500)
        .json({ error: "Failed to start AI Workers system" });
    }
  },
);

/**
 * POST /api/v1/super-admin/control-center/system/stop
 * Scale down orchestrator and stop all executor tasks
 */
router.post(
  "/control-center/system/stop",
  async (_req: Request, res: Response) => {
    try {
      const stoppedTasks: string[] = [];

      // 1. Scale down orchestrator to 0
      await ecs.send(
        new UpdateServiceCommand({
          cluster: ecsCluster,
          service: orchestratorServiceName,
          desiredCount: 0,
        }),
      );

      logger.info("Orchestrator scaled to 0");

      // 2. Stop all running executor tasks
      try {
        const listResult = await ecs.send(
          new ListTasksCommand({
            cluster: ecsCluster,
            family: `${ecsCluster}-ai-worker-executor`,
            desiredStatus: "RUNNING",
          }),
        );

        const taskArns = listResult.taskArns || [];
        for (const taskArn of taskArns) {
          try {
            await ecs.send(
              new StopTaskCommand({
                cluster: ecsCluster,
                task: taskArn,
                reason: "Stopped via Control Center system shutdown",
              }),
            );
            stoppedTasks.push(taskArn);
            logger.info("Stopped executor task", { taskArn });
          } catch (stopErr) {
            logger.warn("Failed to stop task:", { taskArn, error: stopErr });
          }
        }
      } catch (listErr) {
        logger.warn("Failed to list executor tasks for stopping:", listErr);
      }

      // 3. Update any executing tasks in DB to cancelled
      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const cancelResult = await taskRepo
        .createQueryBuilder()
        .update(AIWorkerTask)
        .set({
          status: "cancelled" as AIWorkerTaskStatus,
          completedAt: new Date(),
          errorMessage: "System shutdown via Control Center",
          watcherNotes: () =>
            `COALESCE(watcher_notes, '') || '\n[${new Date().toISOString()}] Cancelled: System shutdown'`,
        })
        .where("status IN (:...statuses)", {
          statuses: [
            "queued",
            "claimed",
            "environment_setup",
            "executing",
            "pr_created",
          ],
        })
        .execute();

      // 4. Clean up ALL workers (they are ephemeral, created per-task)
      // First, clear the assigned_worker_id from tasks (to avoid FK constraint)
      await taskRepo
        .createQueryBuilder()
        .update(AIWorkerTask)
        .set({ assignedWorkerId: null })
        .where("assigned_worker_id IS NOT NULL")
        .execute();

      // Now delete all non-manager workers
      const workerRepo = dataSource.getRepository(AIWorkerInstance);
      const cleanupResult = await workerRepo
        .createQueryBuilder()
        .delete()
        .from(AIWorkerInstance)
        .where("role != :role OR role IS NULL", { role: "manager" }) // Keep manager instances
        .execute();

      logger.info("AI Workers system stopped", {
        stoppedExecutorTasks: stoppedTasks.length,
        cancelledDbTasks: cancelResult.affected,
        cleanedUpWorkers: cleanupResult.affected,
      });

      return res.json({
        success: true,
        message: "AI Workers system stopped",
        orchestratorDesiredCount: 0,
        stoppedExecutorTasks: stoppedTasks.length,
        cancelledTasks: cancelResult.affected || 0,
        cleanedUpWorkers: cleanupResult.affected || 0,
      });
    } catch (error) {
      logger.error("Error stopping AI Workers system:", error);
      return res
        .status(500)
        .json({ error: "Failed to stop AI Workers system" });
    }
  },
);

/**
 * POST /api/v1/super-admin/workers
 * Create a new persistent worker
 */
router.post(
  "/workers",
  [
    body("persona")
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
    body("displayName")
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Display name required (1-100 chars)"),
    body("description")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const dataSource = await getDataSource();
      const workerRepo = dataSource.getRepository(AIWorkerInstance);

      // Get org ID from request (API key auth or user auth)
      const orgId = req.orgId || req.user?.orgId;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const { persona, displayName, description } = req.body;

      // Check if a worker with this persona already exists
      const existing = await workerRepo.findOne({
        where: { orgId, persona },
      });

      if (existing) {
        return res.status(409).json({
          error: "Worker with this persona already exists",
          existingWorkerId: existing.id,
        });
      }

      // Create the worker
      const worker = workerRepo.create({
        orgId,
        persona,
        displayName,
        description: description || null,
        status: "idle",
        role: "worker",
      });

      await workerRepo.save(worker);

      logger.info("Worker created", {
        workerId: worker.id,
        persona: worker.persona,
        displayName: worker.displayName,
      });

      return res.status(201).json(worker);
    } catch (error) {
      logger.error("Error creating worker:", error);
      return res.status(500).json({ error: "Failed to create worker" });
    }
  },
);

/**
 * DELETE /api/v1/super-admin/workers/:id
 * Delete a worker (only if idle)
 */
router.delete(
  "/workers/:id",
  [param("id").isUUID().withMessage("Valid worker ID required")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const dataSource = await getDataSource();
      const workerRepo = dataSource.getRepository(AIWorkerInstance);
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const workerId = req.params.id;

      // Find the worker
      const worker = await workerRepo.findOne({ where: { id: workerId } });
      if (!worker) {
        return res.status(404).json({ error: "Worker not found" });
      }

      // Check if worker is currently working
      if (worker.status === "working" || worker.currentTaskId) {
        return res.status(409).json({
          error: "Cannot delete worker while it is working on a task",
          currentTaskId: worker.currentTaskId,
        });
      }

      // Clear any task references to this worker
      await taskRepo
        .createQueryBuilder()
        .update(AIWorkerTask)
        .set({ assignedWorkerId: null })
        .where("assigned_worker_id = :workerId", { workerId })
        .execute();

      // Delete the worker
      await workerRepo.delete({ id: workerId });

      logger.info("Worker deleted", {
        workerId,
        persona: worker.persona,
        displayName: worker.displayName,
      });

      return res.json({
        success: true,
        message: "Worker deleted",
        deletedWorkerId: workerId,
      });
    } catch (error) {
      logger.error("Error deleting worker:", error);
      return res.status(500).json({ error: "Failed to delete worker" });
    }
  },
);

// ============================================
// Learning System Endpoints (Phase 4)
// ============================================

/**
 * POST /api/v1/super-admin/control-center/tool-events
 * Batch insert tool events (called by log-parser.js during task execution)
 */
router.post(
  "/control-center/tool-events",
  [
    body("events").isArray({ min: 1, max: 100 }),
    body("events.*.taskId").isUUID(),
    body("events.*.orgId").isUUID(),
    body("events.*.toolName").isString().notEmpty(),
    body("events.*.success").isBoolean(),
    body("events.*.sequenceNumber").isInt({ min: 1 }),
    body("events.*.startedAt").isISO8601(),
    body("events.*.completedAt").isISO8601(),
    body("events.*.durationMs").isInt({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { events } = req.body;

      const dataSource = await getDataSource();
      const eventRepo = dataSource.getRepository(AIWorkerToolEvent);

      // Map events to entities
      const entities = events.map(
        (e: {
          taskId: string;
          orgId: string;
          toolName: string;
          toolCategory?: string;
          inputSummary?: string;
          inputHash?: string;
          outputSummary?: string;
          success: boolean;
          errorType?: string;
          errorMessage?: string;
          sequenceNumber: number;
          attemptNumber?: number;
          startedAt: string;
          completedAt: string;
          durationMs: number;
        }) => {
          const event = new AIWorkerToolEvent();
          event.taskId = e.taskId;
          event.orgId = e.orgId;
          event.toolName = e.toolName;
          event.toolCategory = (e.toolCategory ||
            AIWorkerToolEvent.classifyToolCategory(e.toolName)) as any;
          event.inputSummary = e.inputSummary || null;
          event.inputHash = e.inputHash || null;
          event.outputSummary = e.outputSummary || null;
          event.success = e.success;
          event.errorType = (e.errorType || null) as any;
          event.errorMessage = e.errorMessage || null;
          event.sequenceNumber = e.sequenceNumber;
          event.attemptNumber = e.attemptNumber || 1;
          event.startedAt = new Date(e.startedAt);
          event.completedAt = new Date(e.completedAt);
          event.durationMs = e.durationMs;
          return event;
        },
      );

      // Bulk insert
      await eventRepo.insert(entities);

      logger.debug("Tool events saved", { count: entities.length });

      return res.status(201).json({
        success: true,
        count: entities.length,
      });
    } catch (error) {
      logger.error("Error saving tool events:", error);
      return res.status(500).json({ error: "Failed to save tool events" });
    }
  },
);

/**
 * PATCH /api/v1/super-admin/control-center/tasks/:taskId/tool-summary
 * Update tool error/retry counts on task (called by log-parser.js on completion)
 */
router.patch(
  "/control-center/tasks/:taskId/tool-summary",
  [
    param("taskId").isUUID(),
    body("toolErrorCount").optional().isInt({ min: 0 }),
    body("toolRetryCount").optional().isInt({ min: 0 }),
    body("totalToolCalls").optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { taskId } = req.params;
      const { toolErrorCount, toolRetryCount } = req.body;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (toolErrorCount !== undefined) {
        task.toolErrorCount = toolErrorCount;
      }
      if (toolRetryCount !== undefined) {
        task.toolRetryCount = toolRetryCount;
      }

      await taskRepo.save(task);

      return res.json({
        success: true,
        taskId,
        toolErrorCount: task.toolErrorCount,
        toolRetryCount: task.toolRetryCount,
      });
    } catch (error) {
      logger.error("Error updating tool summary:", error);
      return res.status(500).json({ error: "Failed to update tool summary" });
    }
  },
);

/**
 * GET /api/v1/super-admin/control-center/patterns/relevant
 * Get relevant patterns for a new task (for context injection)
 */
router.get(
  "/control-center/patterns/relevant",
  [
    query("toolNames").optional().isString(),
    query("limit").optional().isInt({ min: 1, max: 50 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const toolNames = req.query.toolNames
        ? (req.query.toolNames as string).split(",")
        : null;
      const limit = parseInt(req.query.limit as string) || 10;
      const orgId = req.orgId || req.user?.orgId;

      const dataSource = await getDataSource();
      const patternRepo = dataSource.getRepository(AIWorkerToolPattern);

      // Query active patterns ordered by effectiveness
      const queryBuilder = patternRepo
        .createQueryBuilder("pattern")
        .where("pattern.status = :status", { status: "active" })
        .andWhere(
          "(pattern.org_id IS NULL OR pattern.org_id = :orgId)",
          { orgId },
        )
        .orderBy("pattern.effectiveness_score", "DESC")
        .take(limit);

      if (toolNames && toolNames.length > 0) {
        queryBuilder.andWhere("pattern.tool_name IN (:...toolNames)", {
          toolNames,
        });
      }

      const patterns = await queryBuilder.getMany();

      return res.json({
        patterns: patterns.map((p) => ({
          id: p.id,
          type: p.patternType,
          toolName: p.toolName,
          errorType: p.errorType,
          title: p.title,
          description: p.description,
          recommendedApproach: p.recommendedApproach,
          effectivenessScore: Number(p.effectivenessScore),
          timesApplied: p.timesApplied,
        })),
        count: patterns.length,
      });
    } catch (error) {
      logger.error("Error fetching relevant patterns:", error);
      return res.status(500).json({ error: "Failed to fetch patterns" });
    }
  },
);

/**
 * GET /api/v1/super-admin/control-center/patterns
 * List all patterns with filtering
 */
router.get(
  "/control-center/patterns",
  [
    query("status").optional().isIn(["active", "deprecated", "pending_review"]),
    query("toolName").optional().isString(),
    query("type").optional().isIn(["error_recovery", "best_practice", "anti_pattern"]),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const status = req.query.status as string | undefined;
      const toolName = req.query.toolName as string | undefined;
      const type = req.query.type as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const dataSource = await getDataSource();
      const patternRepo = dataSource.getRepository(AIWorkerToolPattern);

      const queryBuilder = patternRepo
        .createQueryBuilder("pattern")
        .orderBy("pattern.effectiveness_score", "DESC")
        .addOrderBy("pattern.times_applied", "DESC")
        .take(limit)
        .skip(offset);

      if (status) {
        queryBuilder.andWhere("pattern.status = :status", { status });
      }
      if (toolName) {
        queryBuilder.andWhere("pattern.tool_name = :toolName", { toolName });
      }
      if (type) {
        queryBuilder.andWhere("pattern.pattern_type = :type", { type });
      }

      const [patterns, total] = await queryBuilder.getManyAndCount();

      return res.json({
        patterns: patterns.map((p) => ({
          id: p.id,
          orgId: p.orgId,
          isGlobal: p.orgId === null,
          type: p.patternType,
          toolName: p.toolName,
          errorType: p.errorType,
          title: p.title,
          description: p.description,
          recommendedApproach: p.recommendedApproach,
          triggerConditions: p.triggerConditions,
          effectivenessScore: Number(p.effectivenessScore),
          timesApplied: p.timesApplied,
          timesSucceeded: p.timesSucceeded,
          status: p.status,
          sourceTaskId: p.sourceTaskId,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        total,
        limit,
        offset,
      });
    } catch (error) {
      logger.error("Error fetching patterns:", error);
      return res.status(500).json({ error: "Failed to fetch patterns" });
    }
  },
);

/**
 * POST /api/v1/super-admin/control-center/patterns
 * Create a new pattern (usually done by Manager after learning analysis)
 */
router.post(
  "/control-center/patterns",
  [
    body("patternType").isIn(["error_recovery", "best_practice", "anti_pattern"]),
    body("toolName").isString().notEmpty(),
    body("title").isString().isLength({ min: 1, max: 255 }),
    body("description").isString().notEmpty(),
    body("recommendedApproach").isString().notEmpty(),
    body("errorType").optional().isString(),
    body("triggerConditions").optional().isObject(),
    body("sourceTaskId").optional().isUUID(),
    body("isGlobal").optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        patternType,
        toolName,
        title,
        description,
        recommendedApproach,
        errorType,
        triggerConditions,
        sourceTaskId,
        isGlobal,
      } = req.body;

      const orgId = isGlobal ? null : (req.orgId || req.user?.orgId);

      const dataSource = await getDataSource();
      const patternRepo = dataSource.getRepository(AIWorkerToolPattern);

      // Check for duplicate
      const existing = await patternRepo.findOne({
        where: {
          orgId: orgId as any,
          toolName,
          errorType: errorType || null,
          title,
          status: "active",
        },
      });

      if (existing) {
        return res.status(409).json({
          error: "Pattern with this tool, error type, and title already exists",
          existingPatternId: existing.id,
        });
      }

      const pattern = patternRepo.create({
        orgId,
        patternType,
        toolName,
        errorType: errorType || null,
        title,
        description,
        recommendedApproach,
        triggerConditions: triggerConditions || {},
        sourceTaskId: sourceTaskId || null,
        status: "active",
        effectivenessScore: 0.5, // Start at 50%
      });

      await patternRepo.save(pattern);

      logger.info("Pattern created", {
        patternId: pattern.id,
        toolName,
        title,
        sourceTaskId,
      });

      return res.status(201).json({
        id: pattern.id,
        type: pattern.patternType,
        toolName: pattern.toolName,
        title: pattern.title,
        status: pattern.status,
      });
    } catch (error) {
      logger.error("Error creating pattern:", error);
      return res.status(500).json({ error: "Failed to create pattern" });
    }
  },
);

/**
 * PATCH /api/v1/super-admin/control-center/patterns/:patternId/effectiveness
 * Update pattern effectiveness after a task completes
 */
router.patch(
  "/control-center/patterns/:patternId/effectiveness",
  [
    param("patternId").isUUID(),
    body("succeeded").isBoolean(),
    body("taskId").optional().isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { patternId } = req.params;
      const { succeeded, taskId } = req.body;

      const dataSource = await getDataSource();
      const patternRepo = dataSource.getRepository(AIWorkerToolPattern);

      const pattern = await patternRepo.findOne({ where: { id: patternId } });
      if (!pattern) {
        return res.status(404).json({ error: "Pattern not found" });
      }

      // Record the application
      pattern.recordApplication(succeeded);
      await patternRepo.save(pattern);

      // If taskId provided, also record in pattern_applications
      if (taskId) {
        const appRepo = dataSource.getRepository(AIWorkerPatternApplication);
        await appRepo.update(
          { patternId, taskId },
          {
            taskCompleted: true,
            patternToolUsed: true,
            patternHelped: succeeded,
            verifiedAt: new Date(),
          },
        );
      }

      logger.debug("Pattern effectiveness updated", {
        patternId,
        succeeded,
        newScore: pattern.effectivenessScore,
        status: pattern.status,
      });

      return res.json({
        patternId,
        effectivenessScore: Number(pattern.effectivenessScore),
        timesApplied: pattern.timesApplied,
        timesSucceeded: pattern.timesSucceeded,
        status: pattern.status,
      });
    } catch (error) {
      logger.error("Error updating pattern effectiveness:", error);
      return res.status(500).json({ error: "Failed to update effectiveness" });
    }
  },
);

/**
 * GET /api/v1/super-admin/control-center/tasks/:taskId/tool-events
 * Get tool events for a specific task (for debugging/analysis)
 */
router.get(
  "/control-center/tasks/:taskId/tool-events",
  [
    param("taskId").isUUID(),
    query("limit").optional().isInt({ min: 1, max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { taskId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      const dataSource = await getDataSource();
      const eventRepo = dataSource.getRepository(AIWorkerToolEvent);
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      // Verify task exists
      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const events = await eventRepo.find({
        where: { taskId },
        order: { sequenceNumber: "ASC" },
        take: limit,
      });

      // Identify retry sequences (multiple attempts at same operation)
      const retrySequences: Array<{
        toolName: string;
        attempts: number;
        finalSuccess: boolean;
      }> = [];

      let currentTool = "";
      let currentAttempts: typeof events = [];

      for (const event of events) {
        if (event.toolName !== currentTool || event.attemptNumber === 1) {
          // New operation - save previous if it was a retry
          if (currentAttempts.length > 1) {
            retrySequences.push({
              toolName: currentTool,
              attempts: currentAttempts.length,
              finalSuccess: currentAttempts[currentAttempts.length - 1].success,
            });
          }
          currentTool = event.toolName;
          currentAttempts = [event];
        } else {
          currentAttempts.push(event);
        }
      }
      // Don't forget the last sequence
      if (currentAttempts.length > 1) {
        retrySequences.push({
          toolName: currentTool,
          attempts: currentAttempts.length,
          finalSuccess: currentAttempts[currentAttempts.length - 1].success,
        });
      }

      return res.json({
        taskId,
        taskStatus: task.status,
        totalEvents: events.length,
        errorCount: task.toolErrorCount,
        retryCount: task.toolRetryCount,
        retrySequences,
        events: events.map((e) => ({
          id: e.id,
          toolName: e.toolName,
          toolCategory: e.toolCategory,
          success: e.success,
          errorType: e.errorType,
          errorMessage: e.errorMessage,
          sequenceNumber: e.sequenceNumber,
          attemptNumber: e.attemptNumber,
          durationMs: e.durationMs,
          startedAt: e.startedAt,
          completedAt: e.completedAt,
          inputSummary: e.inputSummary?.substring(0, 200),
          outputSummary: e.outputSummary?.substring(0, 200),
        })),
      });
    } catch (error) {
      logger.error("Error fetching tool events:", error);
      return res.status(500).json({ error: "Failed to fetch tool events" });
    }
  },
);

export default router;
