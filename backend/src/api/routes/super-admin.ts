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
  AIWorkerPersona,
} from "../../shared/models/AIWorkerTask";
import { AIWorkerTaskLog } from "../../shared/models/AIWorkerTaskLog";
import { AIWorkerTaskRun } from "../../shared/models/AIWorkerTaskRun";
import { AIWorkerConversation } from "../../shared/models/AIWorkerConversation";
import { AIWorkerReview } from "../../shared/models/AIWorkerReview";
import { AIWorkerToolEvent } from "../../shared/models/AIWorkerToolEvent";
import { AIWorkerToolPattern } from "../../shared/models/AIWorkerToolPattern";
import { AIWorkerPatternApplication } from "../../shared/models/AIWorkerPatternApplication";
import { Organization } from "../../shared/models/Organization";
import { logger } from "../../shared/utils/logger";
import { calculateTotalCost, type TokenUsage } from "../../shared/config/pricing";
import { getCostTracker } from "../../shared/services/cost-tracker";
import {
  SQS,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { ECS, StopTaskCommand, UpdateServiceCommand, ListTasksCommand } from "@aws-sdk/client-ecs";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { EventBridgeClient, EnableRuleCommand, DisableRuleCommand, DescribeRuleCommand } from "@aws-sdk/client-eventbridge";
import { MoreThan, In, LessThan } from "typeorm";
import { body, param, query, validationResult } from "express-validator";

const router = Router();

// Initialize AWS clients
const awsRegion = process.env.AWS_REGION || "us-east-1";
const sqs = new SQS({ region: awsRegion });
const ecs = new ECS({ region: awsRegion });
const lambda = new LambdaClient({ region: awsRegion });
const eventBridge = new EventBridgeClient({ region: awsRegion });
const queueUrl = process.env.AI_WORKER_QUEUE_URL;
const ecsCluster = process.env.ECS_CLUSTER_NAME || "pagerduty-lite-dev";
const orchestratorServiceName =
  process.env.AI_WORKER_ORCHESTRATOR_SERVICE || `${ecsCluster}-aiw-orch`;
const managerLambdaName =
  process.env.AI_WORKER_MANAGER_LAMBDA ||
  "pagerduty-lite-dev-ai-worker-manager";
const watcherRuleName =
  process.env.AI_WORKER_WATCHER_RULE || `${ecsCluster}-ai-worker-watcher-schedule`;

// Shared builders so SSE and REST endpoints stay in sync
async function buildControlCenterData(orgId: string, isSuperAdmin: boolean = false) {
  const dataSource = await getDataSource();
  const workerRepo = dataSource.getRepository(AIWorkerInstance);
  const taskRepo = dataSource.getRepository(AIWorkerTask);
  const logRepo = dataSource.getRepository(AIWorkerTaskLog);
  const conversationRepo = dataSource.getRepository(AIWorkerConversation);
  const orgRepo = dataSource.getRepository(Organization);

  // Super admins see all orgs' data; regular users see only their org
  const orgFilter = isSuperAdmin ? {} : { orgId };

  const org = await orgRepo.findOne({ where: { id: orgId } });

  // Calculate midnight Eastern time for today's stats reset
  const getEasternMidnight = (): Date => {
    const now = new Date();
    // Get current time in Eastern timezone
    const easternFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = easternFormatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

    // Create midnight in Eastern time
    const midnightEastern = new Date(`${year}-${month}-${day}T00:00:00-05:00`);

    // Adjust for DST: check if we're in EDT (UTC-4) or EST (UTC-5)
    const janOffset = new Date(`${year}-01-15T12:00:00`).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
    const julOffset = new Date(`${year}-07-15T12:00:00`).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
    const isDST = janOffset !== julOffset && now.getMonth() >= 2 && now.getMonth() <= 10;

    if (isDST) {
      // EDT: UTC-4
      return new Date(`${year}-${month}-${day}T00:00:00-04:00`);
    }
    return midnightEastern;
  };

  const todayStart = getEasternMidnight();

  const workers = await workerRepo.find({
    order: { displayName: "ASC" },
  });

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const activeTasks = await taskRepo.find({
    where: [
      {
        ...orgFilter,
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
          "deployment_pending",
          "deploying",
          "deployed_validating",
          "awaiting_destructive_approval",
        ]),
      },
      {
        ...orgFilter,
        status: In([
          "completed",
          "failed",
          "cancelled",
          "review_rejected",
          "review_approved",
          "deployment_failed",
          "validation_failed",
        ]),
        completedAt: MoreThan(tenMinutesAgo),
      },
    ],
    order: { createdAt: "DESC" },
  });

  const recentCompleted = await taskRepo.find({
    where: {
      ...orgFilter,
      status: In(["completed", "failed", "cancelled"]),
      completedAt: MoreThan(todayStart),
    },
    order: { completedAt: "DESC" },
    take: 15,
  });

  const todayTasks = await taskRepo.find({
    where: {
      ...orgFilter,
      createdAt: MoreThan(todayStart),
    },
  });
  const todayCost = todayTasks.reduce((sum, t) => {
    if (Number(t.estimatedCostUsd) > 0) {
      return sum + Number(t.estimatedCostUsd);
    }
    // Fallback: recalculate using shared pricing (includes Claude API + ECS cost)
    if (t.startedAt) {
      const endTime = t.completedAt || new Date();
      const durationSeconds = Math.floor(
        (endTime.getTime() - t.startedAt.getTime()) / 1000,
      );
      const tokens: TokenUsage = {
        inputTokens: t.claudeInputTokens || 0,
        outputTokens: t.claudeOutputTokens || 0,
        cacheCreationTokens: t.claudeCacheCreationTokens || 0,
        cacheReadTokens: t.claudeCacheReadTokens || 0,
      };
      return sum + calculateTotalCost(tokens, t.workerModel || 'sonnet', durationSeconds);
    }
    return sum;
  }, 0);

  // Get queue depth from database (count of tasks in 'queued' status)
  // This is more reliable than SQS ApproximateNumberOfMessages
  const queueDepthQuery = taskRepo
    .createQueryBuilder("task")
    .andWhere("task.status = :status", { status: "queued" });
  if (!isSuperAdmin) {
    queueDepthQuery.andWhere("task.org_id = :orgId", { orgId });
  }
  const queueDepth = await queueDepthQuery.getCount();

  const activeTaskIds = activeTasks.map((t) => t.id);
  let taskLogs: AIWorkerTaskLog[] = [];
  if (activeTaskIds.length > 0) {
    taskLogs = await logRepo.find({
      where: {
        taskId: In(activeTaskIds),
      },
      order: { createdAt: "DESC" },
      take: 100,
    });
  }

  let conversations: AIWorkerConversation[] = [];
  if (activeTaskIds.length > 0) {
    conversations = await conversationRepo.find({
      where: {
        taskId: In(activeTaskIds),
      },
    });
  }

  // ALWAYS calculate cumulative cost from task sum (single source of truth)
  // This ensures consistency even if org.aiWorkerCumulativeCost gets out of sync
  const costSumQuery = taskRepo
    .createQueryBuilder("task")
    .select("COALESCE(SUM(task.estimated_cost_usd), 0)", "sum");
  if (!isSuperAdmin) {
    costSumQuery.where("task.org_id = :orgId", { orgId });
  }
  const costSumRow = await costSumQuery.getRawOne<{ sum: string }>();
  const derivedCumulativeCost = Number(costSumRow?.sum || 0);

  const stats = {
    totalWorkers: workers.length,
    activeWorkers: workers.filter((w) => w.status === "working").length,
    queueDepth,
    todayCost: Math.round(todayCost * 100) / 100,
    todayCompleted: todayTasks.filter((t) => ["completed", "review_approved"].includes(t.status)).length,
    todayFailed: todayTasks.filter((t) => t.status === "failed").length,
    cumulativeCost: derivedCumulativeCost,
    cumulativeCostResetAt: org?.aiWorkerCostResetAt || null,
  };

  const workersData = workers
    .filter((w) => {
      if (w.status === "working") return true;
      if (w.lastTaskAt && w.lastTaskAt > tenMinutesAgo) return true;
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
              maxTurns: 50,
            }
          : null,
      };
    });

  const activeTasksData = activeTasks.map((t) => {
    const isManagerTask = ["manager_review"].includes(t.status) && t.reviewerManagerId;
    const workerId = isManagerTask ? t.reviewerManagerId : t.assignedWorkerId;
    const worker = workers.find((w) => w.id === workerId);
    const conversation = conversations.find((c) => c.taskId === t.id);
    const logs = taskLogs.filter((l) => l.taskId === t.id).slice(0, 10);

    const steps = getTaskSteps(t.status);
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
      // Deployment fields
      deploymentEnabled: t.deploymentEnabled,
      deployRetryCount: t.deployRetryCount,
      maxDeployRetries: t.maxDeployRetries,
      validationAttemptCount: t.validationAttemptCount,
      lastValidationError: t.lastValidationError,
      lastDeploymentAt: t.lastDeploymentAt,
      requiresApproval: t.requiresApproval,
      approvalReason: t.approvalReason,
    };
  });

  const recentCompletedData = recentCompleted.map((t) => {
    let costUsd = Number(t.estimatedCostUsd);
    // Fallback: recalculate using shared pricing (includes Claude API + ECS cost)
    if (costUsd === 0 && t.startedAt) {
      const endTime = t.completedAt || new Date();
      const durationSeconds = Math.floor(
        (endTime.getTime() - t.startedAt.getTime()) / 1000,
      );
      const tokens: TokenUsage = {
        inputTokens: t.claudeInputTokens || 0,
        outputTokens: t.claudeOutputTokens || 0,
        cacheCreationTokens: t.claudeCacheCreationTokens || 0,
        cacheReadTokens: t.claudeCacheReadTokens || 0,
      };
      costUsd = calculateTotalCost(tokens, t.workerModel || 'sonnet', durationSeconds);
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
      githubApprovedBy: t.githubApprovedBy,
    };
  });

  return {
    stats,
    workers: workersData,
    activeTasks: activeTasksData,
    recentCompleted: recentCompletedData,
  };
}

async function buildTaskList(
  status?: AIWorkerTaskStatus,
  search?: string,
  limit = 20,
  offset = 0,
) {
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

  return {
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
      revisionCount: t.revisionCount || 0,
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
      githubApprovedBy: t.githubApprovedBy,
      createdAt: t.createdAt,
    })),
    total,
    limit,
    offset,
  };
}

async function buildWatcherStatus() {
  const dataSource = await getDataSource();
  const taskRepo = dataSource.getRepository(AIWorkerTask);
  const stuckThreshold = new Date(Date.now() - 3 * 60 * 1000);

  const [
    monitoringCount,
    stuckCount,
    pendingRetryCount,
    globalTimeoutCount,
    loopCount,
  ] = await Promise.all([
    taskRepo.count({
      where: { status: In(["executing", "environment_setup"]) },
    }),
    taskRepo
      .createQueryBuilder("task")
      .where("task.status IN (:...statuses)", {
        statuses: ["executing", "environment_setup"],
      })
      .andWhere("task.lastHeartbeatAt < :threshold", {
        threshold: stuckThreshold,
      })
      .getCount(),
    taskRepo.count({
      where: {
        status: In(["failed", "blocked"]),
        nextRetryAt: MoreThan(new Date()),
      },
    }),
    taskRepo.count({
      where: {
        failureCategory: "timeout",
      },
    }),
    taskRepo.count({
      where: {
        failureCategory: "loop",
      },
    }),
  ]);

  let watcherEnabled = false;
  try {
    const ruleStatus = await eventBridge.send(
      new DescribeRuleCommand({
        Name: watcherRuleName,
      })
    );
    watcherEnabled = ruleStatus.State === "ENABLED";
  } catch (err) {
    logger.warn("Failed to get watcher rule status:", err);
  }

  return {
    enabled: watcherEnabled,
    lastRunAt: null,
    stuckTasks: stuckCount,
    pendingRetries: pendingRetryCount,
    loopsDetected: loopCount,
    globalTimeouts: globalTimeoutCount,
    tasksMonitored: monitoringCount,
  };
}

async function buildSystemStatus() {
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
      orchestratorRunning = (service.runningCount || 0) > 0;
      orchestratorDesiredCount = service.desiredCount || 0;
    }
  } catch (err) {
    logger.warn("Failed to describe orchestrator service:", err);
  }

  try {
    const listTasksResult = await ecs.send(
      new ListTasksCommand({
        cluster: ecsCluster,
        serviceName: process.env.AI_WORKER_EXECUTOR_SERVICE || "pagerduty-lite-dev-ai-worker",
        desiredStatus: "RUNNING",
      }),
    );
    executorTaskCount = listTasksResult.taskArns?.length || 0;
  } catch (err) {
    logger.warn("Failed to list executor tasks:", err);
  }

  return {
    systemEnabled: orchestratorRunning,
    orchestrator: { running: orchestratorRunning, desiredCount: orchestratorDesiredCount },
    executors: { running: executorTaskCount },
  };
}

async function buildManagerStatus() {
  const dataSource = await getDataSource();
  const taskRepo = dataSource.getRepository(AIWorkerTask);
  const reviewRepo = dataSource.getRepository(AIWorkerReview);
  const instanceRepo = dataSource.getRepository(AIWorkerInstance);

  // Manager instances
  const managers = await instanceRepo.find({
    where: { role: "manager" },
  });

  // Queue counts
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

  // Last 24h review stats
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentReviews = await reviewRepo.find({
    where: { createdAt: MoreThan(oneDayAgo) },
    order: { createdAt: "DESC" },
  });

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
      ? recentReviews.reduce((sum, r) => sum + (r.durationSeconds || 0), 0) /
        recentReviews.length
      : 0;

  return {
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
  };
}

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
router.get("/control-center", async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const isSuperAdmin = req.user?.role === "super_admin";
    const data = await buildControlCenterData(orgId, isSuperAdmin);
    return res.json(data);
  } catch (error) {
    logger.error("Error fetching control center data:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch control center data" });
  }
});

/**
 * GET /api/v1/super-admin/control-center/stream
 * SSE stream for AI Workers Control Center updates
 */
router.get("/control-center/stream", async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.orgId!;
    if (!orgId) {
      res.status(401).end();
      return;
    }
    const isSuperAdmin = req.user?.role === "super_admin";

    const statusFilter = (req.query.status as AIWorkerTaskStatus | undefined) || undefined;
    const search = (req.query.search as string | undefined) || undefined;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if ((res as any).flushHeaders) {
      (res as any).flushHeaders();
    }

    let isClosed = false;

    const sendUpdate = async () => {
      if (isClosed) return;
      try {
        const [controlCenter, systemStatus, watcherStatus, managerStatus, tasks] =
          await Promise.all([
            buildControlCenterData(orgId, isSuperAdmin),
            buildSystemStatus(),
            buildWatcherStatus(),
            buildManagerStatus(),
            buildTaskList(statusFilter, search, 20, 0),
          ]);

        res.write("event: control_center_update\n");
        res.write(
          `data: ${JSON.stringify({
            controlCenter,
            systemStatus,
            watcherStatus,
            managerStatus,
            taskList: tasks,
            lastUpdated: new Date().toISOString(),
          })}\n\n`,
        );
      } catch (err) {
        logger.error("Failed to stream control center update", { err });
      }
    };

    const sendPing = () => {
      if (isClosed) return;
      res.write("event: ping\n");
      res.write("data: {}\n\n");
    };

    const updateInterval = setInterval(sendUpdate, 5000);
    const pingInterval = setInterval(sendPing, 20000);

    req.on("close", () => {
      isClosed = true;
      clearInterval(updateInterval);
      clearInterval(pingInterval);
      res.end();
    });

    // initial connection
    res.write("event: connected\n");
    res.write("data: {}\n\n");
    await sendUpdate();
  } catch (error) {
    logger.error("Failed to establish control center stream", { error });
    res.status(500).json({ error: "Failed to start control center stream" });
  }
});

/**
 * POST /api/v1/super-admin/control-center/reset-cost
 * Reset the cumulative cost counter to zero
 */
router.post("/control-center/reset-cost", async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const orgRepo = dataSource.getRepository(Organization);

    const org = await orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const previousCost = Number(org.aiWorkerCumulativeCost || 0);
    org.aiWorkerCumulativeCost = 0;
    org.aiWorkerCostResetAt = new Date();
    await orgRepo.save(org);

    logger.info("AI Worker cumulative cost reset", {
      orgId,
      previousCost,
      resetAt: org.aiWorkerCostResetAt,
    });

    return res.json({
      success: true,
      previousCost,
      resetAt: org.aiWorkerCostResetAt,
    });
  } catch (error) {
    logger.error("Error resetting cumulative cost:", error);
    return res.status(500).json({ error: "Failed to reset cumulative cost" });
  }
});

/**
 * GET /api/v1/super-admin/control-center/settings
 * Get AI Worker settings for the organization
 */
router.get("/control-center/settings", async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const orgRepo = dataSource.getRepository(Organization);

    const org = await orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const settings = org.settings || {};
    return res.json({
      aiWorkerCooldownMinutes: settings.aiWorkerCooldownMinutes ?? 10,
    });
  } catch (error) {
    logger.error("Error fetching AI Worker settings:", error);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
});

/**
 * PUT /api/v1/super-admin/control-center/settings
 * Update AI Worker settings for the organization
 */
router.put(
  "/control-center/settings",
  [
    body("aiWorkerCooldownMinutes")
      .optional()
      .isInt({ min: 0, max: 1440 })
      .withMessage("Cooldown must be between 0 and 1440 minutes (24 hours)"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { aiWorkerCooldownMinutes } = req.body;

      const dataSource = await getDataSource();
      const orgRepo = dataSource.getRepository(Organization);

      const org = await orgRepo.findOne({ where: { id: orgId } });
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Update settings
      const currentSettings = org.settings || {};
      if (aiWorkerCooldownMinutes !== undefined) {
        currentSettings.aiWorkerCooldownMinutes = aiWorkerCooldownMinutes;
      }
      org.settings = currentSettings;
      await orgRepo.save(org);

      logger.info("AI Worker settings updated", {
        orgId,
        aiWorkerCooldownMinutes: currentSettings.aiWorkerCooldownMinutes,
      });

      return res.json({
        success: true,
        aiWorkerCooldownMinutes: currentSettings.aiWorkerCooldownMinutes ?? 10,
      });
    } catch (error) {
      logger.error("Error updating AI Worker settings:", error);
      return res.status(500).json({ error: "Failed to update settings" });
    }
  }
);

/**
 * GET /api/v1/super-admin/control-center/persona-slots
 * Get persona slot status showing which personas have active tasks
 * Used for monitoring per-persona concurrency limiting
 */
router.get("/control-center/persona-slots", async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const dataSource = await getDataSource();
    const taskRepo = dataSource.getRepository(AIWorkerTask);

    // All possible personas
    const allPersonas: AIWorkerPersona[] = [
      "frontend_developer",
      "backend_developer",
      "devops_engineer",
      "security_engineer",
      "qa_engineer",
      "tech_writer",
      "project_manager",
      "manager",
    ];

    // Active statuses that occupy a persona slot
    const activeStatuses: AIWorkerTaskStatus[] = [
      "claimed",
      "environment_setup",
      "executing",
      "pr_created",
      "manager_review",
    ];

    // Get active tasks grouped by persona
    const activeTasks = await taskRepo.find({
      where: {
        orgId,
        status: In(activeStatuses),
      },
      select: [
        "id",
        "workerPersona",
        "status",
        "jiraIssueKey",
        "summary",
        "startedAt",
        "lastHeartbeatAt",
      ],
    });

    // Get queued tasks grouped by persona
    const queuedTasks = await taskRepo
      .createQueryBuilder("t")
      .select("t.worker_persona", "persona")
      .addSelect("COUNT(*)", "count")
      .where("t.org_id = :orgId", { orgId })
      .andWhere("t.status = :status", { status: "queued" })
      .groupBy("t.worker_persona")
      .getRawMany();

    const queuedByPersona: Record<string, number> = {};
    for (const row of queuedTasks) {
      queuedByPersona[row.persona] = parseInt(row.count, 10);
    }

    // Build slot status for each persona
    const slots = allPersonas.map((persona) => {
      const activeTask = activeTasks.find((t) => t.workerPersona === persona);
      return {
        persona,
        occupied: activeTask
          ? {
              taskId: activeTask.id,
              jiraKey: activeTask.jiraIssueKey,
              summary: activeTask.summary,
              status: activeTask.status,
              startedAt: activeTask.startedAt,
              lastHeartbeat: activeTask.lastHeartbeatAt,
            }
          : null,
        queuedCount: queuedByPersona[persona] || 0,
      };
    });

    // Summary stats
    const occupiedCount = slots.filter((s) => s.occupied).length;
    const totalQueued = Object.values(queuedByPersona).reduce((a, b) => a + b, 0);

    return res.json({
      slots,
      summary: {
        totalSlots: allPersonas.length,
        occupiedSlots: occupiedCount,
        availableSlots: allPersonas.length - occupiedCount,
        totalQueued,
      },
    });
  } catch (error) {
    logger.error("Error fetching persona slots:", error);
    return res.status(500).json({ error: "Failed to fetch persona slots" });
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
 * SSE endpoint for real-time log streaming with heartbeats and cursor-based resume
 * Supports token in query param since EventSource doesn't support headers
 */
router.get(
  "/control-center/logs/:taskId/stream",
  async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const since = req.query.since ? String(req.query.since) : null;

    if (req.query.token && !req.user && !req.orgId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const logRepo = dataSource.getRepository(AIWorkerTaskLog);

      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if ((res as any).flushHeaders) (res as any).flushHeaders();

      // Hint the client how long to wait before reconnect attempts
      res.write("retry: 2000\n\n");

      const parseCursor = (
        raw: string | null,
      ): { lastCreatedAt: Date; lastId: string } | null => {
        if (!raw) return null;
        const parts = raw.split("|");
        if (parts.length !== 2) return null;
        const createdAt = new Date(parts[0]);
        if (Number.isNaN(createdAt.getTime())) return null;
        const id = parts[1];
        if (!id) return null;
        return { lastCreatedAt: createdAt, lastId: id };
      };

      // Prefer Last-Event-ID (auto-managed by EventSource) then query param
      const lastEventIdHeader = req.headers["last-event-id"];
      const headerCursor =
        typeof lastEventIdHeader === "string" ? lastEventIdHeader : null;
      // Default to "now minus 5 minutes" to avoid sending huge history
      let cursor =
        parseCursor(headerCursor) ||
        parseCursor(since) || {
          lastCreatedAt: new Date(Date.now() - 5 * 60 * 1000),
          lastId: "00000000-0000-0000-0000-000000000000",
        };
      let lastStatus = task.status;

      const sendLogs = async () => {
        try {
          const currentTask = await taskRepo.findOne({ where: { id: taskId } });
          if (!currentTask) {
            res.write(`data: ${JSON.stringify({ type: "error", message: "Task not found" })}\n\n`);
            res.end();
            return;
          }

          if (currentTask.status !== lastStatus) {
            res.write(`data: ${JSON.stringify({ type: "status", status: currentTask.status })}\n\n`);
            lastStatus = currentTask.status;
          }

          const qb = logRepo
            .createQueryBuilder("log")
            .where("log.taskId = :taskId", { taskId })
            .orderBy("log.createdAt", "ASC")
            .addOrderBy("log.id", "ASC");

          qb.andWhere(
            "(log.createdAt > :lastCreatedAt OR (log.createdAt = :lastCreatedAt AND log.id > :lastId))",
            {
              lastCreatedAt: cursor.lastCreatedAt,
              lastId: cursor.lastId,
            },
          );

          const newLogs = await qb.getMany();
          for (const log of newLogs) {
            const eventId = `${log.createdAt.toISOString()}|${log.id}`;
            res.write(`id: ${eventId}\n`);
            res.write("event: log\n");
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
                cursor: eventId,
              })}\n\n`,
            );
            cursor = { lastCreatedAt: log.createdAt, lastId: log.id };
          }

          if (["completed", "failed", "cancelled"].includes(currentTask.status)) {
            res.write(`data: ${JSON.stringify({ type: "complete", status: currentTask.status })}\n\n`);
            res.end();
          }
        } catch (err) {
          logger.error("Error in SSE loop:", err);
        }
      };

      const sendPing = () => {
        res.write("event: ping\n");
        res.write("data: {}\n\n");
      };

      // Send initial handshake
      res.write(
        `data: ${JSON.stringify({
          type: "connected",
          taskId,
          status: task.status,
          cursor: `${cursor.lastCreatedAt.toISOString()}|${cursor.lastId}`,
        })}\n\n`,
      );

      let inFlight = false;
      const logInterval = setInterval(async () => {
        if (inFlight) return;
        inFlight = true;
        try {
          await sendLogs();
        } finally {
          inFlight = false;
        }
      }, 1000);
      const pingInterval = setInterval(sendPing, 20000);

      req.on("close", () => {
        clearInterval(logInterval);
        clearInterval(pingInterval);
      });

      // First fetch immediately
      await sendLogs();
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
          revisionCount: t.revisionCount || 0,
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
 * POST /api/v1/super-admin/control-center/tasks/:taskId/mark-manager-complete
 * Mark a manager task as completed (called by manager ECS task before exit)
 * Creates AIWorkerReview record and updates manager stats
 */
router.post(
  "/control-center/tasks/:taskId/mark-manager-complete",
  [
    param("taskId").isUUID(),
    body("decision").optional().isString(),
    body("feedback").optional().isString(),
    body("managerModel").optional().isString(),
    body("codeQualityScore").optional().isInt({ min: 1, max: 10 }),
    body("newTicketsCreated").optional().isInt({ min: 0 }),
    body("inputTokens").optional().isInt({ min: 0 }),
    body("outputTokens").optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { taskId } = req.params;
      const { decision, feedback, managerModel, codeQualityScore, newTicketsCreated, inputTokens, outputTokens } =
        req.body;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);
      const managerRepo = dataSource.getRepository(AIWorkerInstance);
      const reviewRepo = dataSource.getRepository(AIWorkerReview);

      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (task.status !== "manager_review") {
        return res.status(400).json({
          error: `Task is in ${task.status} status, expected manager_review`,
        });
      }

      // Circuit breaker: max 3 revision attempts
      const MAX_REVISIONS = 3;

      // Determine task status based on decision
      let newStatus: AIWorkerTaskStatus = "completed";

      if (decision === "approved") {
        newStatus = "review_approved";
      } else if (decision === "rejected") {
        newStatus = "review_rejected";
      } else if (decision === "revision_needed") {
        // Check circuit breaker before allowing another revision
        if ((task.revisionCount || 0) >= MAX_REVISIONS) {
          logger.warn(`Circuit breaker triggered: task ${taskId} has reached max revisions (${MAX_REVISIONS})`, {
            taskId,
            revisionCount: task.revisionCount,
          });
          newStatus = "review_rejected";
          // Append circuit breaker note to feedback
          const circuitBreakerNote = `\n\n---\n**Circuit Breaker Triggered**: This task has exceeded the maximum of ${MAX_REVISIONS} revision attempts and has been automatically rejected.`;
          req.body.feedback = (feedback || "") + circuitBreakerNote;
        } else {
          newStatus = "revision_needed";
          // Increment revision count
          task.revisionCount = (task.revisionCount || 0) + 1;
        }
      }

      // Update task status
      task.status = newStatus;
      if (newStatus !== "revision_needed") {
        task.completedAt = new Date();
      }

      // Store manager review results
      if (decision) {
        task.reviewDecision = decision;
      }
      if (feedback) {
        task.reviewFeedback = feedback;
      }
      if (managerModel) {
        task.managerReviewModel = managerModel;
      }
      if (codeQualityScore !== undefined) {
        task.codeQualityScore = codeQualityScore;
      }

      await taskRepo.save(task);

      // Event-driven retry: immediately dispatch revision_needed tasks to SQS
      // This eliminates the 5-minute wait for the Watcher to poll
      if (newStatus === "revision_needed" && queueUrl) {
        try {
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: queueUrl,
              MessageBody: JSON.stringify({
                taskId: task.id,
                action: "retry",
              }),
              MessageGroupId: task.id, // FIFO queue deduplication
              MessageDeduplicationId: `revision-${task.id}-${task.revisionCount}`,
            })
          );
          logger.info(`Dispatched revision retry to SQS immediately`, {
            taskId: task.id,
            revisionCount: task.revisionCount,
          });
        } catch (sqsError) {
          // Log but don't fail - Watcher will pick it up eventually
          logger.warn(`Failed to dispatch revision retry to SQS, Watcher will pick up`, {
            taskId: task.id,
            error: sqsError instanceof Error ? sqsError.message : "Unknown error",
          });
        }
      }

      // Create AIWorkerReview record to track this review
      if (decision && task.reviewerManagerId) {
        const reviewNumber = await reviewRepo.count({ where: { taskId } }) + 1;
        const review = reviewRepo.create({
          taskId,
          managerId: task.reviewerManagerId,
          reviewNumber,
          decision: decision as "approved" | "rejected" | "revision_needed",
          feedback: feedback || null,
          prUrl: task.githubPrUrl || null,
          codeQualityScore: codeQualityScore || null,
          claudeInputTokens: inputTokens || 0,
          claudeOutputTokens: outputTokens || 0,
          startedAt: task.reviewRequestedAt || new Date(),
          completedAt: new Date(),
          durationSeconds: task.reviewRequestedAt
            ? Math.floor((Date.now() - task.reviewRequestedAt.getTime()) / 1000)
            : null,
        });
        review.estimatedCostUsd = review.calculateCost();
        await reviewRepo.save(review);

        logger.info(`Created AIWorkerReview record`, { reviewId: review.id, decision });
      }

      // Update manager instance stats
      if (task.reviewerManagerId) {
        const manager = await managerRepo.findOne({
          where: { id: task.reviewerManagerId },
        });
        if (manager) {
          manager.status = newStatus === "revision_needed" ? "idle" : "idle";
          manager.currentTaskId = null;
          manager.reviewCount = (manager.reviewCount || 0) + 1;

          // Update decision-specific counts
          if (decision === "approved") {
            manager.approvalsCount = (manager.approvalsCount || 0) + 1;
          } else if (decision === "rejected") {
            manager.rejectionsCount = (manager.rejectionsCount || 0) + 1;
          } else if (decision === "revision_needed") {
            manager.revisionsRequestedCount = (manager.revisionsRequestedCount || 0) + 1;
          }

          await managerRepo.save(manager);
          logger.info(`Updated manager stats`, {
            managerId: manager.id,
            reviewCount: manager.reviewCount,
            approvalsCount: manager.approvalsCount,
          });
        }
      }

      logger.info(`Manager marked task ${taskId} as ${newStatus}`, {
        taskId,
        decision,
        newStatus,
        newTicketsCreated,
      });

      return res.json({
        message: "Task marked as completed",
        taskId: task.id,
        status: task.status,
        decision,
      });
    } catch (error) {
      logger.error("Error marking manager task as complete:", error);
      return res
        .status(500)
        .json({ error: "Failed to mark task as complete" });
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

      // Calculate ECS duration
      if (task.startedAt) {
        task.ecsTaskSeconds = Math.floor(
          (task.completedAt.getTime() - task.startedAt.getTime()) / 1000,
        );
      }

      await taskRepo.save(task);

      // Record cost via CostTracker (updates org cumulative cost)
      try {
        await getCostTracker(dataSource).recordTaskCost(task.id);
      } catch (costErr) {
        logger.warn("Failed to record cost for cancelled task", { taskId, error: costErr });
        // Fallback: local calculation only
        task.estimatedCostUsd = task.calculateCost();
        await taskRepo.save(task);
      }

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
 * POST /api/v1/super-admin/control-center/tasks/cancel-by-key
 * Cancel a running task by Jira issue key
 */
router.post(
  "/control-center/tasks/cancel-by-key",
  [
    body("jiraKey")
      .isString()
      .matches(/^[A-Z]+-\d+$/)
      .withMessage("Invalid Jira issue key format (e.g., OCS-30)"),
    body("reason").optional().isString().isLength({ max: 500 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { jiraKey, reason } = req.body;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      // Find most recent task for this Jira key
      const task = await taskRepo.findOne({
        where: { jiraIssueKey: jiraKey },
        order: { createdAt: "DESC" },
      });

      if (!task) {
        return res.status(404).json({ error: `Task not found for ${jiraKey}` });
      }

      if (["completed", "failed", "cancelled"].includes(task.status)) {
        return res.status(400).json({
          error: `Task ${jiraKey} is already ${task.status}`,
          taskId: task.id,
          status: task.status,
        });
      }

      // Stop ECS task if running
      if (task.ecsTaskArn) {
        try {
          await ecs.send(
            new StopTaskCommand({
              cluster: ecsCluster,
              task: task.ecsTaskArn,
              reason: reason || `Cancelled via cancel-by-key: ${jiraKey}`,
            }),
          );
          logger.info("Stopped ECS task", {
            jiraKey,
            taskId: task.id,
            ecsTaskArn: task.ecsTaskArn,
          });
        } catch (err) {
          logger.warn("Failed to stop ECS task (may already be stopped):", err);
        }
      }

      // Update task state
      task.status = "failed";
      task.completedAt = new Date();
      task.errorMessage = reason || `Cancelled via cancel-by-key: ${jiraKey}`;
      task.watcherNotes =
        (task.watcherNotes || "") +
        `\n[${new Date().toISOString()}] Cancelled via cancel-by-key: ${reason || "No reason provided"}`;

      // Calculate ECS duration
      if (task.startedAt) {
        task.ecsTaskSeconds = Math.floor(
          (task.completedAt.getTime() - task.startedAt.getTime()) / 1000,
        );
      }

      await taskRepo.save(task);

      // Record cost via CostTracker (updates org cumulative cost)
      try {
        await getCostTracker(dataSource).recordTaskCost(task.id);
      } catch (costErr) {
        logger.warn("Failed to record cost for cancelled task", { jiraKey, error: costErr });
        // Fallback: local calculation only
        task.estimatedCostUsd = task.calculateCost();
        await taskRepo.save(task);
      }

      logger.info("Task cancelled via cancel-by-key", {
        jiraKey,
        taskId: task.id,
        reason,
      });

      return res.json({
        message: `Task ${jiraKey} cancelled`,
        jiraKey,
        taskId: task.id,
        status: task.status,
      });
    } catch (error) {
      logger.error("Error cancelling task by key:", error);
      return res.status(500).json({ error: "Failed to cancel task" });
    }
  },
);

/**
 * POST /api/v1/super-admin/control-center/tasks/:taskId/approve-destructive
 * Approve a destructive change and transition task to deployment_pending
 */
router.post(
  "/control-center/tasks/:taskId/approve-destructive",
  [param("taskId").isUUID()],
  authenticateRequest,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify user is super_admin
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ error: "Forbidden: super_admin role required" });
      }

      const { taskId } = req.params;
      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      // Find task
      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Verify task is awaiting approval
      if (task.status !== "awaiting_destructive_approval") {
        return res.status(400).json({
          error: `Task is not awaiting approval (current status: ${task.status})`,
        });
      }

      // Transition to deployment_pending
      task.status = "deployment_pending";
      task.requiresApproval = false;
      await taskRepo.save(task);

      // Send message to SQS to trigger deployment workflow
      if (queueUrl) {
        try {
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: queueUrl,
              MessageBody: JSON.stringify({
                type: "deployment",
                taskId: task.id,
                jiraIssueKey: task.jiraIssueKey,
                approvedBy: req.user.email,
                approvedAt: new Date().toISOString(),
              }),
            }),
          );
          logger.info("Queued deployment for approved task", {
            taskId: task.id,
            jiraKey: task.jiraIssueKey,
            approvedBy: req.user.email,
          });
        } catch (sqsErr) {
          logger.error("Failed to queue deployment message", { error: sqsErr, taskId });
        }
      }

      logger.info("Destructive change approved", {
        taskId: task.id,
        jiraKey: task.jiraIssueKey,
        approvedBy: req.user.email,
      });

      return res.json({
        message: "Destructive change approved",
        taskId: task.id,
        status: task.status,
      });
    } catch (error) {
      logger.error("Error approving destructive change:", error);
      return res.status(500).json({ error: "Failed to approve destructive change" });
    }
  },
);

/**
 * DELETE /api/v1/super-admin/control-center/tasks/:taskId
 * Delete a task from history (removes from All Tasks view)
 */
router.delete(
  "/control-center/tasks/:taskId",
  [param("taskId").isUUID()],
  authenticateRequest,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { taskId } = req.params;

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      const task = await taskRepo.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Don't allow deleting running tasks
      if (["queued", "dispatching", "claimed", "environment_setup", "executing", "manager_review", "revision_needed"].includes(task.status)) {
        return res.status(400).json({
          error: "Cannot delete a running task. Cancel it first.",
          status: task.status,
        });
      }

      await taskRepo.remove(task);

      logger.info("Task deleted from history", {
        taskId,
        jiraIssueKey: task.jiraIssueKey,
        status: task.status,
      });

      return res.json({
        success: true,
        message: "Task deleted",
        taskId,
      });
    } catch (error) {
      logger.error("Error deleting task:", error);
      return res.status(500).json({ error: "Failed to delete task" });
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

      // Check if watcher rule is enabled
      let watcherEnabled = false;
      try {
        const ruleStatus = await eventBridge.send(
          new DescribeRuleCommand({
            Name: watcherRuleName,
          })
        );
        watcherEnabled = ruleStatus.State === "ENABLED";
      } catch (err) {
        logger.warn("Failed to get watcher rule status:", err);
      }

      // Return in format frontend expects
      return res.json({
        enabled: watcherEnabled,
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
 * POST /api/v1/super-admin/control-center/watcher/enable
 * Enable the watcher CloudWatch Events rule
 */
router.post(
  "/control-center/watcher/enable",
  async (_req: Request, res: Response) => {
    try {
      await eventBridge.send(
        new EnableRuleCommand({
          Name: watcherRuleName,
        })
      );

      logger.info("Watcher enabled");

      return res.json({
        success: true,
        message: "Watcher enabled",
      });
    } catch (error) {
      logger.error("Error enabling watcher:", error);
      return res.status(500).json({ error: "Failed to enable watcher" });
    }
  }
);

/**
 * POST /api/v1/super-admin/control-center/watcher/disable
 * Disable the watcher CloudWatch Events rule
 */
router.post(
  "/control-center/watcher/disable",
  async (_req: Request, res: Response) => {
    try {
      await eventBridge.send(
        new DisableRuleCommand({
          Name: watcherRuleName,
        })
      );

      logger.info("Watcher disabled");

      return res.json({
        success: true,
        message: "Watcher disabled",
      });
    } catch (error) {
      logger.error("Error disabling watcher:", error);
      return res.status(500).json({ error: "Failed to disable watcher" });
    }
  }
);

/**
 * POST /api/v1/super-admin/control-center/orchestrator/start
 * Start the orchestrator service (set desiredCount to 1)
 */
router.post(
  "/control-center/orchestrator/start",
  async (_req: Request, res: Response) => {
    try {
      await ecs.send(
        new UpdateServiceCommand({
          cluster: ecsCluster,
          service: orchestratorServiceName,
          desiredCount: 1,
        })
      );

      logger.info("Orchestrator started");

      return res.json({
        success: true,
        message: "Orchestrator started",
      });
    } catch (error) {
      logger.error("Error starting orchestrator:", error);
      return res.status(500).json({ error: "Failed to start orchestrator" });
    }
  }
);

/**
 * POST /api/v1/super-admin/control-center/orchestrator/stop
 * Stop the orchestrator service (set desiredCount to 0)
 */
router.post(
  "/control-center/orchestrator/stop",
  async (_req: Request, res: Response) => {
    try {
      await ecs.send(
        new UpdateServiceCommand({
          cluster: ecsCluster,
          service: orchestratorServiceName,
          desiredCount: 0,
        })
      );

      logger.info("Orchestrator stopped");

      return res.json({
        success: true,
        message: "Orchestrator stopped",
      });
    } catch (error) {
      logger.error("Error stopping orchestrator:", error);
      return res.status(500).json({ error: "Failed to stop orchestrator" });
    }
  }
);

/**
 * GET /api/v1/super-admin/control-center/manager/status
 * Get Virtual Manager status and metrics
 */
router.get(
  "/control-center/manager/status",
  async (_req: Request, res: Response) => {
    try {
      const status = await buildManagerStatus();
      return res.json(status);
    } catch (error) {
      logger.error("Error fetching manager status:", error);
      return res.status(500).json({ error: "Failed to fetch manager status" });
    }
  },
);

/**
 * PATCH /api/v1/super-admin/control-center/manager/model
 * Update the Virtual Manager's model
 */
router.patch(
  "/control-center/manager/model",
  [body("modelId").isString().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { modelId } = req.body;

      // Validate model ID
      const validModels = [
        "claude-sonnet-4-20250514",
        "claude-opus-4-5-20251101",
        "claude-3-5-haiku-20241022",
      ];
      if (!validModels.includes(modelId)) {
        return res.status(400).json({
          error: "Invalid model ID",
          validModels,
        });
      }

      const dataSource = await getDataSource();
      const instanceRepo = dataSource.getRepository(AIWorkerInstance);

      // Find all manager instances and update their model
      const managers = await instanceRepo.find({ where: { role: "manager" } });

      if (managers.length === 0) {
        return res.status(404).json({ error: "No manager instances found" });
      }

      for (const manager of managers) {
        manager.modelId = modelId;
        await instanceRepo.save(manager);
      }

      logger.info("Manager model updated", {
        modelId,
        managersUpdated: managers.length,
      });

      return res.json({
        success: true,
        message: "Manager model updated",
        modelId,
        managersUpdated: managers.length,
      });
    } catch (error) {
      logger.error("Error updating manager model:", error);
      return res.status(500).json({ error: "Failed to update manager model" });
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

        // Calculate ECS duration
        if (task.startedAt) {
          task.ecsTaskSeconds = Math.floor(
            (task.completedAt.getTime() - task.startedAt.getTime()) / 1000,
          );
        }
      }

      await taskRepo.save(task);

      // Record cost via CostTracker if task is finished (updates org cumulative cost)
      if (status === "completed" || status === "failed") {
        try {
          await getCostTracker(dataSource).recordTaskCost(task.id);
        } catch (costErr) {
          logger.warn("Failed to record cost for task", { taskId, error: costErr });
          // Fallback: local calculation only
          task.estimatedCostUsd = task.calculateCost();
          await taskRepo.save(task);
        }
      }

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
 * POST /api/v1/super-admin/workers/reset-all-stuck
 * Reset all workers in "working" status that have no active ECS task
 */
router.post("/workers/reset-all-stuck", async (_req: Request, res: Response) => {
  try {
    const dataSource = await getDataSource();
    const workerRepo = dataSource.getRepository(AIWorkerInstance);
    const taskRepo = dataSource.getRepository(AIWorkerTask);

    // Find all workers in "working" status
    const stuckWorkers = await workerRepo.find({
      where: { status: "working" },
    });

    if (stuckWorkers.length === 0) {
      return res.json({
        success: true,
        message: "No stuck workers found",
        resetCount: 0,
      });
    }

    const resetWorkers: string[] = [];

    for (const worker of stuckWorkers) {
      // Clear task assignment if any
      if (worker.currentTaskId) {
        await taskRepo
          .createQueryBuilder()
          .update(AIWorkerTask)
          .set({ assignedWorkerId: null })
          .where("id = :taskId AND assigned_worker_id = :workerId", {
            taskId: worker.currentTaskId,
            workerId: worker.id,
          })
          .execute();
      }

      // Reset to idle
      worker.status = "idle";
      worker.currentTaskId = null;
      await workerRepo.save(worker);
      resetWorkers.push(worker.displayName);
    }

    logger.info("Reset all stuck workers", { resetCount: resetWorkers.length, workers: resetWorkers });

    return res.json({
      success: true,
      message: `Reset ${resetWorkers.length} stuck worker(s)`,
      resetCount: resetWorkers.length,
      workers: resetWorkers,
    });
  } catch (error) {
    logger.error("Error resetting stuck workers:", error);
    return res.status(500).json({ error: "Failed to reset stuck workers" });
  }
});

/**
 * PATCH /api/v1/super-admin/workers/:id/reset
 * Force reset a stuck worker to idle status
 */
router.patch(
  "/workers/:id/reset",
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
      const worker = await workerRepo.findOne({ where: { id: workerId } });
      if (!worker) {
        return res.status(404).json({ error: "Worker not found" });
      }

      const previousStatus = worker.status;

      // Clear any task assignments
      if (worker.currentTaskId) {
        await taskRepo
          .createQueryBuilder()
          .update(AIWorkerTask)
          .set({ assignedWorkerId: null })
          .where("id = :taskId AND assigned_worker_id = :workerId", {
            taskId: worker.currentTaskId,
            workerId,
          })
          .execute();
      }

      // Reset worker to idle
      worker.status = "idle";
      worker.currentTaskId = null;
      await workerRepo.save(worker);

      logger.info("Worker reset to idle", {
        workerId,
        previousStatus,
        displayName: worker.displayName,
      });

      return res.json({
        success: true,
        message: "Worker reset to idle",
        workerId,
        previousStatus,
      });
    } catch (error) {
      logger.error("Error resetting worker:", error);
      return res.status(500).json({ error: "Failed to reset worker" });
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

/**
 * POST /api/v1/super-admin/control-center/tasks/cancel-stuck
 * Cancel all stuck tasks (tasks that haven't had activity in X minutes)
 */
router.post(
  "/control-center/tasks/cancel-stuck",
  [
    body("olderThanMinutes").optional().isInt({ min: 5, max: 1440 }),
  ],
  authenticateRequest,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const minutes = req.body.olderThanMinutes || 30;
      const cutoff = new Date(Date.now() - minutes * 60 * 1000);

      const dataSource = await getDataSource();
      const taskRepo = dataSource.getRepository(AIWorkerTask);

      // Find all stuck tasks (active statuses with no recent activity)
      const stuckStatuses: AIWorkerTaskStatus[] = [
        "queued",
        "dispatching",
        "claimed",
        "environment_setup",
        "executing",
        "manager_review",
      ];

      const stuckTasks = await taskRepo.find({
        where: {
          status: In(stuckStatuses),
          updatedAt: LessThan(cutoff),
        },
      });

      if (stuckTasks.length === 0) {
        return res.json({
          message: "No stuck tasks found",
          cancelled: 0,
          cutoffMinutes: minutes,
        });
      }

      // Cancel each stuck task
      const cancelledTasks: Array<{ id: string; jiraKey: string; previousStatus: string }> = [];

      for (const task of stuckTasks) {
        // Stop ECS task if running
        if (task.ecsTaskArn) {
          try {
            await ecs.send(
              new StopTaskCommand({
                cluster: ecsCluster,
                task: task.ecsTaskArn,
                reason: `Stuck job cleanup - no activity for ${minutes} minutes`,
              }),
            );
          } catch (err) {
            logger.warn("Failed to stop ECS task during stuck cleanup:", err);
          }
        }

        const previousStatus = task.status;
        task.status = "cancelled";
        task.completedAt = new Date();
        task.errorMessage = `Stuck job cleanup - no activity for ${minutes} minutes`;
        task.watcherNotes =
          (task.watcherNotes || "") +
          `\n[${new Date().toISOString()}] Cancelled: Stuck job cleanup (${minutes} min timeout)`;

        if (task.startedAt) {
          task.ecsTaskSeconds = Math.floor(
            (task.completedAt.getTime() - task.startedAt.getTime()) / 1000,
          );
        }

        await taskRepo.save(task);

        // Record cost
        try {
          await getCostTracker(dataSource).recordTaskCost(task.id);
        } catch (costErr) {
          logger.warn("Failed to record cost for stuck task", { taskId: task.id });
          task.estimatedCostUsd = task.calculateCost();
          await taskRepo.save(task);
        }

        cancelledTasks.push({
          id: task.id,
          jiraKey: task.jiraIssueKey,
          previousStatus,
        });
      }

      logger.info("Stuck tasks cleanup completed", {
        cancelled: cancelledTasks.length,
        cutoffMinutes: minutes,
        tasks: cancelledTasks.map(t => t.jiraKey),
      });

      return res.json({
        message: `Cancelled ${cancelledTasks.length} stuck task(s)`,
        cancelled: cancelledTasks.length,
        cutoffMinutes: minutes,
        tasks: cancelledTasks,
      });
    } catch (error) {
      logger.error("Error cancelling stuck tasks:", error);
      return res.status(500).json({ error: "Failed to cancel stuck tasks" });
    }
  },
);

export default router;
