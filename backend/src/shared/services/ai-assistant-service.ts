import Anthropic from '@anthropic-ai/sdk';
import { getDataSource } from '../db/data-source';
import { Incident, IncidentEvent, Alert, Service, ServiceDependency } from '../models';
import { runCloudInvestigation } from './cloud-investigation';
import { logger } from '../utils/logger';

// Tool definitions for Claude API
export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'investigate_cloud',
    description: 'Query cloud infrastructure (AWS/Azure/GCP) for service health, errors, logs, and resource status. Use this when you need to investigate cloud resources related to the incident.',
    input_schema: {
      type: 'object' as const,
      properties: {
        credential_id: {
          type: 'string',
          description: 'The UUID of the cloud credential to use for investigation',
        },
        focus_areas: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional areas to focus on: "logs", "services", "instances", "containers". Defaults to all.',
        },
      },
      required: ['credential_id'],
    },
  },
  {
    name: 'get_incident_details',
    description: 'Get comprehensive incident details including timeline, alerts, events, and service dependencies. Use this to understand the full context of the incident.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_application_logs',
    description: 'Fetch application logs from the incident timeline and associated alerts. Shows recent log entries and error messages.',
    input_schema: {
      type: 'object' as const,
      properties: {
        lookback_minutes: {
          type: 'number',
          description: 'How many minutes of logs to fetch before the incident. Default is 60.',
        },
        severity_filter: {
          type: 'string',
          enum: ['all', 'error', 'warning', 'info'],
          description: 'Filter logs by severity level. Default is "all".',
        },
      },
      required: [],
    },
  },
];

// Context passed to tool handlers
export interface AssistantContext {
  incidentId: string;
  userId: string;
  orgId: string;
  availableCredentials: Array<{
    id: string;
    name: string;
    provider: 'aws' | 'azure' | 'gcp';
  }>;
}

// Tool execution results
interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

// System prompt for the AI assistant
export function buildSystemPrompt(context: AssistantContext): string {
  const credentialList = context.availableCredentials.length > 0
    ? context.availableCredentials.map(c => `  - ${c.name} (${c.provider.toUpperCase()}): ${c.id}`).join('\n')
    : '  No cloud credentials configured.';

  return `You are an expert Site Reliability Engineer (SRE) helping to diagnose and resolve production incidents. You have deep expertise in AWS, Azure, and GCP infrastructure, distributed systems, and incident management.

## Your Capabilities

You have access to tools that let you:
1. **Investigate cloud infrastructure** - Query AWS, Azure, or GCP for service health, logs, errors, and resource status
2. **Get incident details** - Fetch the complete incident timeline, alerts, and events
3. **Get application logs** - Review logs from around the incident time

## Available Cloud Credentials
${credentialList}

## When to Use Tools

- Use \`investigate_cloud\` when:
  - The user asks about cloud resources, services, or infrastructure
  - You need more data to determine root cause
  - The incident appears related to cloud services (ECS, Lambda, VMs, Kubernetes, etc.)

- Use \`get_incident_details\` when:
  - You need the full incident timeline
  - You want to see all associated alerts
  - You need to understand service dependencies

- Use \`get_application_logs\` when:
  - You need to review error messages
  - You want to see what happened before the incident

## Response Guidelines

1. **Be concise but thorough** - Explain your findings clearly
2. **Prioritize actionable insights** - Focus on what can be done to resolve the incident
3. **Provide specific commands** - When suggesting fixes, give exact CLI commands
4. **Assess confidence** - Be honest about certainty levels
5. **Consider cascading effects** - Think about how issues in one service affect others

## Format

When providing analysis:
- Start with a brief summary of your findings
- List affected resources
- Provide prioritized recommendations
- Include specific remediation commands when applicable
- Note any areas requiring further investigation`;
}

/**
 * Build the initial user prompt with incident context
 */
export function buildInitialPrompt(incident: Incident, service: Service | null): string {
  const parts: string[] = [];

  parts.push('# Incident Context\n');
  parts.push(`**Incident #${incident.incidentNumber}**: ${incident.summary}`);
  parts.push(`- **Severity**: ${incident.severity}`);
  parts.push(`- **Service**: ${service?.name || 'Unknown'}`);
  parts.push(`- **State**: ${incident.state}`);
  parts.push(`- **Triggered**: ${incident.triggeredAt.toISOString()}`);

  if (incident.details && Object.keys(incident.details).length > 0) {
    parts.push(`- **Details**: ${JSON.stringify(incident.details, null, 2)}`);
  }

  parts.push('\n# Request\n');
  parts.push('Please analyze this incident and help me understand the root cause. If needed, use the available tools to investigate cloud infrastructure or get more details.');

  return parts.join('\n');
}

/**
 * Execute a tool call and return the result
 */
export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, any>,
  context: AssistantContext
): Promise<ToolResult> {
  logger.info('Executing tool call', { toolName, toolInput, incidentId: context.incidentId });

  try {
    switch (toolName) {
      case 'investigate_cloud':
        return await handleInvestigateCloud(toolInput, context);

      case 'get_incident_details':
        return await handleGetIncidentDetails(context);

      case 'get_application_logs':
        return await handleGetApplicationLogs(toolInput, context);

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    logger.error('Tool execution failed', { toolName, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Handle investigate_cloud tool
 */
async function handleInvestigateCloud(
  input: Record<string, any>,
  context: AssistantContext
): Promise<ToolResult> {
  const { credential_id } = input;

  // Verify credential is available to user
  const credential = context.availableCredentials.find(c => c.id === credential_id);
  if (!credential) {
    return {
      success: false,
      error: `Cloud credential ${credential_id} is not available. Available credentials: ${context.availableCredentials.map(c => c.id).join(', ')}`,
    };
  }

  // Run cloud investigation (without AI analysis - we ARE the AI)
  const result = await runCloudInvestigation(
    credential_id,
    context.incidentId,
    context.userId,
    context.orgId,
    false // Don't run nested AI analysis
  );

  // Format for Claude consumption
  const rawData = (result as any).raw_data;
  return {
    success: result.success,
    data: {
      provider: result.provider,
      findings: result.findings,
      commands_executed: result.commands_executed,
      raw_data_summary: rawData ? {
        logs_count: rawData.logs?.length || 0,
        services_checked: Object.keys(rawData).filter(k => k !== 'logs').length,
      } : null,
      basic_recommendations: result.recommendations,
    },
    error: result.error_message,
  };
}

/**
 * Handle get_incident_details tool
 */
async function handleGetIncidentDetails(context: AssistantContext): Promise<ToolResult> {
  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);
  const eventRepo = dataSource.getRepository(IncidentEvent);
  const alertRepo = dataSource.getRepository(Alert);
  const dependencyRepo = dataSource.getRepository(ServiceDependency);

  // Load incident with relations
  const incident = await incidentRepo.findOne({
    where: { id: context.incidentId, orgId: context.orgId },
    relations: ['service', 'assignedToUser'],
  });

  if (!incident) {
    return { success: false, error: 'Incident not found' };
  }

  // Load timeline events
  const events = await eventRepo.find({
    where: { incidentId: context.incidentId },
    order: { createdAt: 'DESC' },
    take: 50,
  });

  // Load associated alerts
  const alerts = await alertRepo.find({
    where: { incidentId: context.incidentId },
    order: { createdAt: 'DESC' },
    take: 20,
  });

  // Load service dependencies
  let dependencies: ServiceDependency[] = [];
  if (incident.serviceId) {
    dependencies = await dependencyRepo.find({
      where: { dependentServiceId: incident.serviceId },
      relations: ['supportingService'],
    });
  }

  return {
    success: true,
    data: {
      incident: {
        number: incident.incidentNumber,
        summary: incident.summary,
        severity: incident.severity,
        state: incident.state,
        urgency: incident.urgency,
        triggeredAt: incident.triggeredAt,
        acknowledgedAt: incident.acknowledgedAt,
        resolvedAt: incident.resolvedAt,
        details: incident.details,
        assignedTo: incident.assignedToUser?.fullName || null,
      },
      service: incident.service ? {
        name: incident.service.name,
        description: incident.service.description,
      } : null,
      timeline: events.map(e => ({
        type: e.type,
        message: e.message,
        createdAt: e.createdAt,
        actorId: e.actorId,
      })),
      alerts: alerts.map(a => ({
        summary: a.summary,
        severity: a.severity,
        source: a.source,
        payload: a.payload,
        createdAt: a.createdAt,
      })),
      dependencies: dependencies.map(d => ({
        serviceName: d.supportingService?.name,
        type: d.dependencyType,
      })),
    },
  };
}

/**
 * Handle get_application_logs tool
 */
async function handleGetApplicationLogs(
  input: Record<string, any>,
  context: AssistantContext
): Promise<ToolResult> {
  const lookbackMinutes = input.lookback_minutes || 60;
  const severityFilter = input.severity_filter || 'all';

  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);
  const eventRepo = dataSource.getRepository(IncidentEvent);
  const alertRepo = dataSource.getRepository(Alert);

  // Load incident
  const incident = await incidentRepo.findOne({
    where: { id: context.incidentId, orgId: context.orgId },
  });

  if (!incident) {
    return { success: false, error: 'Incident not found' };
  }

  // Calculate time range
  const startTime = new Date(incident.triggeredAt.getTime() - lookbackMinutes * 60 * 1000);
  const endTime = new Date(incident.triggeredAt.getTime() + 30 * 60 * 1000);

  // Get events in time range
  const events = await eventRepo
    .createQueryBuilder('event')
    .where('event.incidentId = :incidentId', { incidentId: context.incidentId })
    .andWhere('event.createdAt >= :startTime', { startTime })
    .andWhere('event.createdAt <= :endTime', { endTime })
    .orderBy('event.createdAt', 'DESC')
    .take(100)
    .getMany();

  // Get alerts with payloads (often contain log data)
  const alerts = await alertRepo
    .createQueryBuilder('alert')
    .where('alert.incidentId = :incidentId', { incidentId: context.incidentId })
    .andWhere('alert.createdAt >= :startTime', { startTime })
    .andWhere('alert.createdAt <= :endTime', { endTime })
    .orderBy('alert.createdAt', 'DESC')
    .take(50)
    .getMany();

  // Extract log-like data from alerts and events
  const logEntries: Array<{
    timestamp: Date;
    level: string;
    message: string;
    source: string;
  }> = [];

  // Process events
  for (const event of events) {
    let level = 'info';
    if (event.type.includes('error') || event.type.includes('fail')) {
      level = 'error';
    } else if (event.type.includes('warn')) {
      level = 'warning';
    }

    if (severityFilter === 'all' || severityFilter === level) {
      logEntries.push({
        timestamp: event.createdAt,
        level,
        message: event.message || event.type,
        source: 'incident_event',
      });
    }
  }

  // Process alerts
  for (const alert of alerts) {
    const level = alert.severity === 'critical' || alert.severity === 'error' ? 'error' :
                  alert.severity === 'warning' ? 'warning' : 'info';

    if (severityFilter === 'all' || severityFilter === level) {
      logEntries.push({
        timestamp: alert.createdAt,
        level,
        message: alert.summary,
        source: alert.source || 'alert',
      });

      // Extract any log data from payload
      if (alert.payload && typeof alert.payload === 'object') {
        const payload = alert.payload as Record<string, any>;
        if (payload.error_message) {
          logEntries.push({
            timestamp: alert.createdAt,
            level: 'error',
            message: payload.error_message,
            source: 'alert_payload',
          });
        }
        if (payload.stack_trace) {
          logEntries.push({
            timestamp: alert.createdAt,
            level: 'error',
            message: `Stack trace: ${String(payload.stack_trace).substring(0, 500)}`,
            source: 'alert_payload',
          });
        }
      }
    }
  }

  // Sort by timestamp
  logEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return {
    success: true,
    data: {
      time_range: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      },
      total_entries: logEntries.length,
      logs: logEntries.slice(0, 100),
    },
  };
}

/**
 * Stream a chat response using Claude with tools
 */
export async function* streamAssistantChat(
  messages: Anthropic.MessageParam[],
  context: AssistantContext,
  systemPrompt: string
): AsyncGenerator<AssistantStreamEvent> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    yield { type: 'error', error: 'ANTHROPIC_API_KEY is not configured' };
    return;
  }

  logger.info('Starting assistant chat stream', {
    incidentId: context.incidentId,
    messageCount: messages.length,
    credentialCount: context.availableCredentials.length,
  });

  let currentMessages = [...messages];
  let iteration = 0;
  const maxIterations = 5; // Prevent infinite tool loops

  while (iteration < maxIterations) {
    iteration++;

    // Create streaming request
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools: ASSISTANT_TOOLS,
      messages: currentMessages,
    });

    let fullResponse: Anthropic.Message | null = null;
    let textContent = '';

    // Stream text content
    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          textContent += event.delta.text;
          yield { type: 'text', content: event.delta.text };
        }
      } else if (event.type === 'message_stop') {
        fullResponse = await stream.finalMessage();
      }
    }

    if (!fullResponse) {
      fullResponse = await stream.finalMessage();
    }

    // Check if we need to handle tool calls
    const toolUseBlocks = fullResponse.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) {
      // No tool calls, we're done
      yield { type: 'done', stopReason: fullResponse.stop_reason || 'end_turn' };
      return;
    }

    // Process tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      yield {
        type: 'tool_call',
        toolName: toolUse.name,
        toolInput: toolUse.input as Record<string, any>,
        toolId: toolUse.id,
      };

      // Execute the tool
      const result = await executeToolCall(
        toolUse.name,
        toolUse.input as Record<string, any>,
        context
      );

      yield {
        type: 'tool_result',
        toolName: toolUse.name,
        toolId: toolUse.id,
        result,
      };

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    // Add assistant response and tool results to messages for next iteration
    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: fullResponse.content },
      { role: 'user', content: toolResults },
    ];
  }

  yield { type: 'error', error: 'Maximum tool iterations exceeded' };
}

// Event types for streaming
export type AssistantStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolName: string; toolInput: Record<string, any>; toolId: string }
  | { type: 'tool_result'; toolName: string; toolId: string; result: ToolResult }
  | { type: 'done'; stopReason: string }
  | { type: 'error'; error: string };
