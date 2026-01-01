import { getDataSource } from '../db/data-source';
import { IncidentWorkflow, TriggerEvent } from '../models/IncidentWorkflow';
import { WorkflowAction } from '../models/WorkflowAction';
import { WorkflowExecution } from '../models/WorkflowExecution';
import { Incident } from '../models/Incident';
import { IncidentEvent } from '../models/IncidentEvent';
import { IncidentResponder } from '../models/IncidentResponder';
import { Schedule } from '../models/Schedule';
import { sendNotificationMessage } from '../queues/sqs-client';
import { logger } from '../utils/logger';

export class WorkflowEngine {
  /**
   * Process an incident event and trigger any matching automatic workflows
   */
  async processEvent(
    orgId: string,
    incidentId: string,
    event: TriggerEvent,
    triggeredById?: string
  ): Promise<WorkflowExecution[]> {
    const dataSource = await getDataSource();
    const workflowRepo = dataSource.getRepository(IncidentWorkflow);
    const incidentRepo = dataSource.getRepository(Incident);

    // Get the incident with relations
    const incident = await incidentRepo.findOne({
      where: { id: incidentId },
      relations: ['service', 'service.team', 'priority', 'assignedToUser'],
    });

    if (!incident) {
      logger.warn('Incident not found for workflow processing', { incidentId });
      return [];
    }

    // Find all enabled automatic workflows for this org
    const workflows = await workflowRepo.find({
      where: {
        orgId,
        enabled: true,
        triggerType: 'automatic',
      },
      relations: ['actions'],
      order: { createdAt: 'ASC' },
    });

    // Filter to workflows that should trigger
    const matchingWorkflows = workflows.filter(w =>
      w.shouldTrigger(event, this.incidentToRecord(incident))
    );

    if (matchingWorkflows.length === 0) {
      return [];
    }

    logger.info('Found matching workflows to execute', {
      incidentId,
      event,
      workflowCount: matchingWorkflows.length,
    });

    // Execute each matching workflow
    const executions: WorkflowExecution[] = [];
    for (const workflow of matchingWorkflows) {
      const execution = await this.executeWorkflow(
        workflow,
        incident,
        'automatic',
        event,
        triggeredById
      );
      executions.push(execution);
    }

    return executions;
  }

  /**
   * Manually trigger a workflow for an incident
   */
  async triggerManually(
    workflowId: string,
    incidentId: string,
    triggeredById: string
  ): Promise<WorkflowExecution> {
    const dataSource = await getDataSource();
    const workflowRepo = dataSource.getRepository(IncidentWorkflow);
    const incidentRepo = dataSource.getRepository(Incident);

    const workflow = await workflowRepo.findOne({
      where: { id: workflowId },
      relations: ['actions'],
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (!workflow.enabled) {
      throw new Error('Workflow is disabled');
    }

    const incident = await incidentRepo.findOne({
      where: { id: incidentId },
      relations: ['service', 'service.team', 'priority', 'assignedToUser'],
    });

    if (!incident) {
      throw new Error('Incident not found');
    }

    return this.executeWorkflow(workflow, incident, 'manual', null, triggeredById);
  }

  /**
   * Execute a workflow for an incident
   */
  private async executeWorkflow(
    workflow: IncidentWorkflow,
    incident: Incident,
    triggerType: 'manual' | 'automatic',
    triggerEvent: TriggerEvent | null,
    triggeredById?: string
  ): Promise<WorkflowExecution> {
    const dataSource = await getDataSource();
    const executionRepo = dataSource.getRepository(WorkflowExecution);

    // Create execution record
    const execution = executionRepo.create({
      workflowId: workflow.id,
      incidentId: incident.id,
      orgId: workflow.orgId,
      triggerType,
      triggerEvent,
      triggeredBy: triggeredById || null,
      status: 'pending',
      actionResults: [],
    });
    await executionRepo.save(execution);

    // Start execution
    execution.start();
    await executionRepo.save(execution);

    const incidentRecord = this.incidentToRecord(incident);
    const sortedActions = (workflow.actions || []).sort((a, b) => a.actionOrder - b.actionOrder);

    let hasFailures = false;

    for (const action of sortedActions) {
      try {
        // Check action-level condition
        if (!action.shouldExecute(incidentRecord)) {
          execution.addActionResult({
            actionId: action.id,
            actionType: action.actionType,
            status: 'skipped',
            message: 'Action condition not met',
            executedAt: new Date().toISOString(),
          });
          continue;
        }

        // Execute the action
        await this.executeAction(action, incident, triggeredById);

        execution.addActionResult({
          actionId: action.id,
          actionType: action.actionType,
          status: 'success',
          executedAt: new Date().toISOString(),
        });
      } catch (error) {
        hasFailures = true;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Workflow action failed', {
          workflowId: workflow.id,
          actionId: action.id,
          actionType: action.actionType,
          error: errorMessage,
        });

        execution.addActionResult({
          actionId: action.id,
          actionType: action.actionType,
          status: 'failed',
          error: errorMessage,
          executedAt: new Date().toISOString(),
        });
      }
    }

    // Finalize execution status
    if (hasFailures) {
      if (execution.getSuccessCount() > 0) {
        execution.markPartial();
      } else {
        execution.fail('All actions failed');
      }
    } else {
      execution.complete();
    }

    await executionRepo.save(execution);

    // Create incident event for the workflow execution
    await this.createWorkflowEvent(incident, workflow, execution, triggeredById);

    return execution;
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: WorkflowAction,
    incident: Incident,
    triggeredById?: string
  ): Promise<void> {
    switch (action.actionType) {
      case 'add_responders':
        await this.executeAddResponders(action, incident, triggeredById);
        break;
      case 'add_on_call':
        await this.executeAddOnCall(action, incident, triggeredById);
        break;
      case 'set_conference_bridge':
        await this.executeSetConferenceBridge(action, incident);
        break;
      case 'add_note':
        await this.executeAddNote(action, incident, triggeredById);
        break;
      case 'post_to_slack':
        await this.executePostToSlack(action, incident);
        break;
      case 'webhook':
        await this.executeWebhook(action, incident);
        break;
      default:
        logger.warn('Unsupported action type', { actionType: action.actionType });
    }
  }

  /**
   * Add responders action
   */
  private async executeAddResponders(
    action: WorkflowAction,
    incident: Incident,
    triggeredById?: string
  ): Promise<void> {
    const config = action.config as { userIds: string[]; message?: string };
    const dataSource = await getDataSource();
    const responderRepo = dataSource.getRepository(IncidentResponder);

    for (const userId of config.userIds) {
      // Check if already a responder
      const existing = await responderRepo.findOne({
        where: { incidentId: incident.id, userId },
      });

      if (!existing) {
        const responder = responderRepo.create({
          incidentId: incident.id,
          userId,
          requestedById: triggeredById || incident.assignedToUserId || userId,
          status: 'pending',
          message: config.message || 'Added by workflow',
        });
        await responderRepo.save(responder);

        // Send notification
        await sendNotificationMessage({
          incidentId: incident.id,
          userId,
          channel: 'push',
          priority: 'high',
          incidentState: incident.state,
        });
      }
    }
  }

  /**
   * Add on-call from schedules
   */
  private async executeAddOnCall(
    action: WorkflowAction,
    incident: Incident,
    triggeredById?: string
  ): Promise<void> {
    const config = action.config as { scheduleIds: string[]; message?: string };
    const dataSource = await getDataSource();
    const scheduleRepo = dataSource.getRepository(Schedule);
    const responderRepo = dataSource.getRepository(IncidentResponder);

    for (const scheduleId of config.scheduleIds) {
      const schedule = await scheduleRepo.findOne({
        where: { id: scheduleId },
        relations: ['overrides', 'layers', 'layers.members'],
      });

      if (schedule) {
        const userId = schedule.getEffectiveOncallUserId();

        if (userId) {
          // Check if already a responder
          const existing = await responderRepo.findOne({
            where: { incidentId: incident.id, userId },
          });

          if (!existing) {
            const responder = responderRepo.create({
              incidentId: incident.id,
              userId,
              requestedById: triggeredById || incident.assignedToUserId || userId,
              status: 'pending',
              message: config.message || `Added from schedule: ${schedule.name}`,
            });
            await responderRepo.save(responder);

            // Send notification
            await sendNotificationMessage({
              incidentId: incident.id,
              userId,
              channel: 'push',
              priority: 'high',
              incidentState: incident.state,
            });
          }
        }
      }
    }
  }

  /**
   * Set conference bridge URL
   */
  private async executeSetConferenceBridge(
    action: WorkflowAction,
    incident: Incident
  ): Promise<void> {
    const config = action.config as { url: string; meetingId?: string; passcode?: string };
    const dataSource = await getDataSource();
    const incidentRepo = dataSource.getRepository(Incident);

    await incidentRepo.update(incident.id, {
      conferenceBridgeUrl: config.url,
    });
  }

  /**
   * Add a note to the incident
   */
  private async executeAddNote(
    action: WorkflowAction,
    incident: Incident,
    triggeredById?: string
  ): Promise<void> {
    const config = action.config as { noteTemplate: string };
    const dataSource = await getDataSource();
    const eventRepo = dataSource.getRepository(IncidentEvent);

    const note = WorkflowAction.interpolateTemplate(
      config.noteTemplate,
      this.incidentToRecord(incident)
    );

    const event = eventRepo.create({
      incidentId: incident.id,
      type: 'note',
      actorId: triggeredById || null,
      message: note,
      payload: { addedByWorkflow: true },
    });
    await eventRepo.save(event);
  }

  /**
   * Post to Slack channel
   */
  private async executePostToSlack(
    action: WorkflowAction,
    incident: Incident
  ): Promise<void> {
    // This would integrate with the existing Slack integration service
    // For now, just log that we would post
    const config = action.config as { integrationId: string; channel?: string; message?: string };
    logger.info('Would post to Slack', {
      incidentId: incident.id,
      integrationId: config.integrationId,
      channel: config.channel,
    });
    // TODO: Integrate with slack-integration.ts service
  }

  /**
   * Call external webhook
   */
  private async executeWebhook(
    action: WorkflowAction,
    incident: Incident
  ): Promise<void> {
    const config = action.config as {
      url: string;
      method: 'GET' | 'POST' | 'PUT';
      headers?: Record<string, string>;
      bodyTemplate?: string;
    };

    const body = config.bodyTemplate
      ? WorkflowAction.interpolateTemplate(config.bodyTemplate, this.incidentToRecord(incident))
      : JSON.stringify({
          incident: {
            id: incident.id,
            summary: incident.summary,
            severity: incident.severity,
            state: incident.state,
            triggeredAt: incident.triggeredAt,
          },
        });

    const response = await fetch(config.url, {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: config.method !== 'GET' ? body : undefined,
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`);
    }
  }

  /**
   * Create an incident event for the workflow execution
   */
  private async createWorkflowEvent(
    incident: Incident,
    workflow: IncidentWorkflow,
    execution: WorkflowExecution,
    triggeredById?: string
  ): Promise<void> {
    const dataSource = await getDataSource();
    const eventRepo = dataSource.getRepository(IncidentEvent);

    const event = eventRepo.create({
      incidentId: incident.id,
      type: 'workflow_executed',
      actorId: triggeredById || null,
      message: `Workflow "${workflow.name}" executed`,
      payload: {
        workflowId: workflow.id,
        workflowName: workflow.name,
        executionId: execution.id,
        status: execution.status,
        successCount: execution.getSuccessCount(),
        failureCount: execution.getFailureCount(),
        skippedCount: execution.getSkippedCount(),
      },
    });
    await eventRepo.save(event);
  }

  /**
   * Convert incident entity to plain object for condition evaluation
   */
  private incidentToRecord(incident: Incident): Record<string, any> {
    return {
      id: incident.id,
      summary: incident.summary,
      details: incident.details,
      severity: incident.severity,
      urgency: incident.urgency,
      state: incident.state,
      triggeredAt: incident.triggeredAt,
      acknowledgedAt: incident.acknowledgedAt,
      resolvedAt: incident.resolvedAt,
      serviceId: incident.serviceId,
      service: incident.service ? {
        id: incident.service.id,
        name: incident.service.name,
        teamId: incident.service.teamId,
      } : null,
      priority: incident.priority ? {
        id: incident.priority.id,
        name: incident.priority.name,
      } : null,
      assignedTo: incident.assignedToUser ? {
        id: incident.assignedToUser.id,
        fullName: incident.assignedToUser.fullName,
      } : null,
    };
  }
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine();
