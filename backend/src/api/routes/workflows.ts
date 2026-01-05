import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { authenticateUser } from "../../shared/auth/middleware";
import { getDataSource } from "../../shared/db/data-source";
import {
  IncidentWorkflow,
  WorkflowAction,
  WorkflowExecution,
  Service,
  Team,
  User,
  Schedule,
} from "../../shared/models";
import { workflowEngine } from "../../shared/services/workflow-engine";
import { logger } from "../../shared/utils/logger";
import {
  parsePaginationParams,
  paginatedResponse,
  validateSortField,
} from "../../shared/utils/pagination";
import {
  paginationValidators,
  searchFilterValidator,
} from "../../shared/validators/pagination";
import { query as queryValidator } from "express-validator";
import {
  notFound,
  badRequest,
  internalError,
  validationError,
  fromExpressValidator,
} from "../../shared/utils/problem-details";

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/workflows
 * List all workflows for the organization
 */
router.get(
  "/",
  [
    ...paginationValidators,
    searchFilterValidator,
    queryValidator("enabled")
      .optional()
      .isIn(["true", "false"])
      .withMessage("enabled must be true or false"),
    queryValidator("trigger_type")
      .optional()
      .isIn(["manual", "automatic"])
      .withMessage("trigger_type must be manual or automatic"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const pagination = parsePaginationParams(req.query);
      const sortField = validateSortField(
        "workflows",
        pagination.sort,
        "createdAt",
      );
      const sortOrder =
        (pagination.order?.toUpperCase() as "ASC" | "DESC") || "DESC";

      // Parse filters
      const { search, enabled, trigger_type } = req.query;

      const dataSource = await getDataSource();
      const workflowRepo = dataSource.getRepository(IncidentWorkflow);

      // Build query
      const queryBuilder = workflowRepo
        .createQueryBuilder("workflow")
        .leftJoinAndSelect("workflow.actions", "actions")
        .leftJoinAndSelect("workflow.createdByUser", "createdByUser")
        .where("workflow.orgId = :orgId", { orgId });

      // Apply filters
      if (search) {
        queryBuilder.andWhere(
          "(workflow.name ILIKE :search OR workflow.description ILIKE :search)",
          { search: `%${search}%` },
        );
      }

      if (enabled !== undefined) {
        queryBuilder.andWhere("workflow.enabled = :enabled", {
          enabled: enabled === "true",
        });
      }

      if (trigger_type) {
        queryBuilder.andWhere("workflow.triggerType = :triggerType", {
          triggerType: trigger_type,
        });
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply sorting and pagination
      queryBuilder
        .orderBy(`workflow.${sortField}`, sortOrder)
        .skip(pagination.offset)
        .take(pagination.limit);

      const workflows = await queryBuilder.getMany();

      const mappedWorkflows = workflows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        enabled: w.enabled,
        triggerType: w.triggerType,
        triggerEvents: w.triggerEvents,
        matchType: w.matchType,
        conditions: w.conditions,
        serviceIds: w.serviceIds,
        teamIds: w.teamIds,
        actions: (w.actions || [])
          .map((a) => ({
            id: a.id,
            actionOrder: a.actionOrder,
            actionType: a.actionType,
            config: a.config,
            conditionField: a.conditionField,
            conditionOperator: a.conditionOperator,
            conditionValue: a.conditionValue,
          }))
          .sort((a, b) => a.actionOrder - b.actionOrder),
        createdBy: w.createdByUser
          ? {
              id: w.createdByUser.id,
              fullName: w.createdByUser.fullName,
            }
          : null,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      }));

      const lastItem = workflows[workflows.length - 1];
      return res.json(
        paginatedResponse(
          mappedWorkflows,
          total,
          pagination,
          lastItem
            ? { id: lastItem.id, createdAt: lastItem.createdAt }
            : undefined,
          "workflows",
        ),
      );
    } catch (error) {
      logger.error("Error fetching workflows:", error);
      return internalError(res);
    }
  },
);

/**
 * GET /api/v1/workflows/available-options
 * Get available options for building workflows (services, teams, schedules, users)
 * NOTE: This route MUST be defined BEFORE /:id to avoid "available-options" being treated as an ID
 */
router.get("/available-options", async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const serviceRepo = dataSource.getRepository(Service);
    const teamRepo = dataSource.getRepository(Team);
    const scheduleRepo = dataSource.getRepository(Schedule);
    const userRepo = dataSource.getRepository(User);

    const [services, teams, schedules, users] = await Promise.all([
      serviceRepo.find({ where: { orgId }, select: ["id", "name"] }),
      teamRepo.find({ where: { orgId }, select: ["id", "name"] }),
      scheduleRepo.find({ where: { orgId }, select: ["id", "name"] }),
      userRepo.find({ where: { orgId }, select: ["id", "fullName", "email"] }),
    ]);

    return res.json({
      services: services.map((s) => ({ id: s.id, name: s.name })),
      teams: teams.map((t) => ({ id: t.id, name: t.name })),
      schedules: schedules.map((s) => ({ id: s.id, name: s.name })),
      users: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
      })),
      actionTypes: [
        {
          type: "add_responders",
          label: "Add Responders",
          description: "Add specific users as responders",
        },
        {
          type: "add_on_call",
          label: "Add On-Call",
          description: "Add current on-call from a schedule",
        },
        {
          type: "subscribe_users",
          label: "Subscribe Users",
          description: "Subscribe users to incident updates",
        },
        {
          type: "subscribe_team",
          label: "Subscribe Team",
          description: "Subscribe entire team to updates",
        },
        {
          type: "set_conference_bridge",
          label: "Set Conference Bridge",
          description: "Set a conference/war room URL",
        },
        {
          type: "post_to_slack",
          label: "Post to Slack",
          description: "Post message to Slack channel",
        },
        {
          type: "post_to_teams",
          label: "Post to Teams",
          description: "Post message to Microsoft Teams",
        },
        {
          type: "webhook",
          label: "Call Webhook",
          description: "Call an external webhook URL",
        },
        {
          type: "set_priority",
          label: "Set Priority",
          description: "Change incident priority",
        },
        {
          type: "add_note",
          label: "Add Note",
          description: "Add a note to the incident",
        },
      ],
      triggerEvents: [
        { event: "incident.created", label: "Incident Created" },
        { event: "incident.acknowledged", label: "Incident Acknowledged" },
        { event: "incident.escalated", label: "Incident Escalated" },
        { event: "incident.reassigned", label: "Incident Reassigned" },
        { event: "incident.priority_changed", label: "Priority Changed" },
        { event: "incident.urgency_changed", label: "Urgency Changed" },
      ],
      conditionFields: [
        {
          field: "severity",
          label: "Severity",
          type: "select",
          options: ["info", "warning", "error", "critical"],
        },
        {
          field: "urgency",
          label: "Urgency",
          type: "select",
          options: ["high", "low"],
        },
        {
          field: "state",
          label: "State",
          type: "select",
          options: ["triggered", "acknowledged", "resolved"],
        },
        { field: "service.name", label: "Service Name", type: "string" },
        { field: "priority.name", label: "Priority Name", type: "string" },
        { field: "summary", label: "Summary", type: "string" },
      ],
    });
  } catch (error) {
    logger.error("Error fetching workflow options:", error);
    return internalError(res);
  }
});

/**
 * GET /api/v1/workflows/:id
 * Get a single workflow by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const { id } = req.params;

    const dataSource = await getDataSource();
    const workflowRepo = dataSource.getRepository(IncidentWorkflow);

    const workflow = await workflowRepo.findOne({
      where: { id, orgId },
      relations: ["actions", "createdByUser"],
    });

    if (!workflow) {
      return notFound(res, "Workflow", id);
    }

    return res.json({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      enabled: workflow.enabled,
      triggerType: workflow.triggerType,
      triggerEvents: workflow.triggerEvents,
      matchType: workflow.matchType,
      conditions: workflow.conditions,
      serviceIds: workflow.serviceIds,
      teamIds: workflow.teamIds,
      actions: (workflow.actions || [])
        .map((a) => ({
          id: a.id,
          actionOrder: a.actionOrder,
          actionType: a.actionType,
          config: a.config,
          conditionField: a.conditionField,
          conditionOperator: a.conditionOperator,
          conditionValue: a.conditionValue,
        }))
        .sort((a, b) => a.actionOrder - b.actionOrder),
      createdBy: workflow.createdByUser
        ? {
            id: workflow.createdByUser.id,
            fullName: workflow.createdByUser.fullName,
          }
        : null,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    });
  } catch (error) {
    logger.error("Error fetching workflow:", error);
    return internalError(res);
  }
});

/**
 * POST /api/v1/workflows
 * Create a new workflow
 */
router.post(
  "/",
  [
    body("name").isString().notEmpty().withMessage("Workflow name is required"),
    body("description").optional().isString(),
    body("triggerType").optional().isIn(["manual", "automatic"]),
    body("triggerEvents").optional().isArray(),
    body("matchType").optional().isIn(["all", "any"]),
    body("conditions").optional().isArray(),
    body("serviceIds").optional().isArray(),
    body("teamIds").optional().isArray(),
    body("enabled").optional().isBoolean(),
    body("actions")
      .isArray({ min: 1 })
      .withMessage("At least one action is required"),
    body("actions.*.actionType").isString().notEmpty(),
    body("actions.*.config").isObject(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const {
        name,
        description,
        triggerType = "manual",
        triggerEvents = [],
        matchType = "all",
        conditions = [],
        serviceIds,
        teamIds,
        enabled = true,
        actions,
      } = req.body;

      const dataSource = await getDataSource();
      const workflowRepo = dataSource.getRepository(IncidentWorkflow);
      const actionRepo = dataSource.getRepository(WorkflowAction);

      // Create workflow
      const workflow = workflowRepo.create({
        orgId,
        name,
        description,
        triggerType,
        triggerEvents,
        matchType,
        conditions,
        serviceIds: serviceIds || null,
        teamIds: teamIds || null,
        enabled,
        createdBy: userId,
      });
      await workflowRepo.save(workflow);

      // Create actions
      const workflowActions: WorkflowAction[] = [];
      for (let i = 0; i < actions.length; i++) {
        const actionData = actions[i];
        const action = actionRepo.create({
          workflowId: workflow.id,
          actionOrder: actionData.actionOrder ?? i,
          actionType: actionData.actionType,
          config: actionData.config,
          conditionField: actionData.conditionField || null,
          conditionOperator: actionData.conditionOperator || null,
          conditionValue: actionData.conditionValue || null,
        });
        await actionRepo.save(action);
        workflowActions.push(action);
      }

      logger.info("Workflow created", {
        workflowId: workflow.id,
        name,
        userId,
      });

      return res.status(201).json({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        enabled: workflow.enabled,
        triggerType: workflow.triggerType,
        triggerEvents: workflow.triggerEvents,
        matchType: workflow.matchType,
        conditions: workflow.conditions,
        serviceIds: workflow.serviceIds,
        teamIds: workflow.teamIds,
        actions: workflowActions.map((a) => ({
          id: a.id,
          actionOrder: a.actionOrder,
          actionType: a.actionType,
          config: a.config,
        })),
        createdAt: workflow.createdAt,
      });
    } catch (error) {
      logger.error("Error creating workflow:", error);
      return internalError(res);
    }
  },
);

/**
 * PUT /api/v1/workflows/:id
 * Update a workflow
 */
router.put(
  "/:id",
  [
    body("name").optional().isString().notEmpty(),
    body("description").optional().isString(),
    body("triggerType").optional().isIn(["manual", "automatic"]),
    body("triggerEvents").optional().isArray(),
    body("matchType").optional().isIn(["all", "any"]),
    body("conditions").optional().isArray(),
    body("serviceIds").optional({ nullable: true }).isArray(),
    body("teamIds").optional({ nullable: true }).isArray(),
    body("enabled").optional().isBoolean(),
    body("actions").optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const { id } = req.params;
      const {
        name,
        description,
        triggerType,
        triggerEvents,
        matchType,
        conditions,
        serviceIds,
        teamIds,
        enabled,
        actions,
      } = req.body;

      const dataSource = await getDataSource();
      const workflowRepo = dataSource.getRepository(IncidentWorkflow);
      const actionRepo = dataSource.getRepository(WorkflowAction);

      const workflow = await workflowRepo.findOne({
        where: { id, orgId },
      });

      if (!workflow) {
        return notFound(res, "Workflow", id);
      }

      // Update workflow fields
      if (name !== undefined) workflow.name = name;
      if (description !== undefined) workflow.description = description;
      if (triggerType !== undefined) workflow.triggerType = triggerType;
      if (triggerEvents !== undefined) workflow.triggerEvents = triggerEvents;
      if (matchType !== undefined) workflow.matchType = matchType;
      if (conditions !== undefined) workflow.conditions = conditions;
      if (serviceIds !== undefined) workflow.serviceIds = serviceIds;
      if (teamIds !== undefined) workflow.teamIds = teamIds;
      if (enabled !== undefined) workflow.enabled = enabled;

      await workflowRepo.save(workflow);

      // Update actions if provided
      if (actions !== undefined) {
        // Delete existing actions
        await actionRepo.delete({ workflowId: workflow.id });

        // Create new actions
        for (let i = 0; i < actions.length; i++) {
          const actionData = actions[i];
          const action = actionRepo.create({
            workflowId: workflow.id,
            actionOrder: actionData.actionOrder ?? i,
            actionType: actionData.actionType,
            config: actionData.config,
            conditionField: actionData.conditionField || null,
            conditionOperator: actionData.conditionOperator || null,
            conditionValue: actionData.conditionValue || null,
          });
          await actionRepo.save(action);
        }
      }

      // Fetch updated workflow with actions
      const updated = await workflowRepo.findOne({
        where: { id },
        relations: ["actions", "createdByUser"],
      });

      logger.info("Workflow updated", { workflowId: id });

      return res.json({
        id: updated!.id,
        name: updated!.name,
        description: updated!.description,
        enabled: updated!.enabled,
        triggerType: updated!.triggerType,
        triggerEvents: updated!.triggerEvents,
        matchType: updated!.matchType,
        conditions: updated!.conditions,
        serviceIds: updated!.serviceIds,
        teamIds: updated!.teamIds,
        actions: (updated!.actions || [])
          .map((a) => ({
            id: a.id,
            actionOrder: a.actionOrder,
            actionType: a.actionType,
            config: a.config,
          }))
          .sort((a, b) => a.actionOrder - b.actionOrder),
        updatedAt: updated!.updatedAt,
      });
    } catch (error) {
      logger.error("Error updating workflow:", error);
      return internalError(res);
    }
  },
);

/**
 * DELETE /api/v1/workflows/:id
 * Delete a workflow
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const { id } = req.params;

    const dataSource = await getDataSource();
    const workflowRepo = dataSource.getRepository(IncidentWorkflow);

    const workflow = await workflowRepo.findOne({
      where: { id, orgId },
    });

    if (!workflow) {
      return notFound(res, "Workflow", id);
    }

    await workflowRepo.remove(workflow);

    logger.info("Workflow deleted", { workflowId: id });

    return res.status(204).send();
  } catch (error) {
    logger.error("Error deleting workflow:", error);
    return internalError(res);
  }
});

/**
 * POST /api/v1/workflows/:id/run
 * Manually run a workflow for an incident
 */
router.post(
  "/:id/run",
  [body("incidentId").isUUID().withMessage("Incident ID is required")],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const userId = req.user!.id;
      const { id } = req.params;
      const { incidentId } = req.body;

      // Verify workflow belongs to org
      const dataSource = await getDataSource();
      const workflowRepo = dataSource.getRepository(IncidentWorkflow);
      const workflow = await workflowRepo.findOne({
        where: { id, orgId },
      });

      if (!workflow) {
        return notFound(res, "Workflow", id);
      }

      // Run the workflow
      const execution = await workflowEngine.triggerManually(
        id,
        incidentId,
        userId,
      );

      logger.info("Workflow manually triggered", {
        workflowId: id,
        incidentId,
        userId,
      });

      return res.json({
        executionId: execution.id,
        status: execution.status,
        actionResults: execution.actionResults,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to run workflow";
      logger.error("Error running workflow:", error);
      return badRequest(res, message);
    }
  },
);

/**
 * GET /api/v1/workflows/:id/executions
 * Get execution history for a workflow
 */
router.get(
  "/:id/executions",
  [...paginationValidators],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return validationError(res, fromExpressValidator(errors.array()));
      }

      const orgId = req.orgId!;
      const { id } = req.params;
      const pagination = parsePaginationParams(req.query);

      const dataSource = await getDataSource();
      const workflowRepo = dataSource.getRepository(IncidentWorkflow);
      const executionRepo = dataSource.getRepository(WorkflowExecution);

      // Verify workflow belongs to org
      const workflow = await workflowRepo.findOne({
        where: { id, orgId },
      });

      if (!workflow) {
        return notFound(res, "Workflow", id);
      }

      const [executions, total] = await executionRepo.findAndCount({
        where: { workflowId: id },
        relations: ["incident", "triggeredByUser"],
        order: { createdAt: "DESC" },
        take: pagination.limit,
        skip: pagination.offset,
      });

      const mappedExecutions = executions.map((e) => ({
        id: e.id,
        incidentId: e.incidentId,
        incident: e.incident
          ? {
              id: e.incident.id,
              summary: e.incident.summary,
              incidentNumber: e.incident.incidentNumber,
            }
          : null,
        status: e.status,
        triggerType: e.triggerType,
        triggerEvent: e.triggerEvent,
        triggeredBy: e.triggeredByUser
          ? {
              id: e.triggeredByUser.id,
              fullName: e.triggeredByUser.fullName,
            }
          : null,
        actionResults: e.actionResults,
        errorMessage: e.errorMessage,
        createdAt: e.createdAt,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        durationMs: e.getDurationMs(),
      }));

      const lastItem = executions[executions.length - 1];
      return res.json(
        paginatedResponse(
          mappedExecutions,
          total,
          pagination,
          lastItem
            ? { id: lastItem.id, createdAt: lastItem.createdAt }
            : undefined,
          "executions",
        ),
      );
    } catch (error) {
      logger.error("Error fetching workflow executions:", error);
      return internalError(res);
    }
  },
);

export default router;
