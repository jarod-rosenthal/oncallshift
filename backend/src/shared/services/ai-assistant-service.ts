import Anthropic from '@anthropic-ai/sdk';
import { getDataSource } from '../db/data-source';
import { Incident, IncidentEvent, Alert, Service, ServiceDependency, CloudCredential } from '../models';
import { runCloudInvestigation } from './cloud-investigation';
import { decryptCredentials } from './credential-encryption';
import { logger } from '../utils/logger';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { ECSClient, ListServicesCommand, DescribeServicesCommand, UpdateServiceCommand } from '@aws-sdk/client-ecs';

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
  {
    name: 'get_cloudwatch_logs',
    description: 'Fetch logs directly from AWS CloudWatch for a specific log group. Use this to get real-time logs from AWS services.',
    input_schema: {
      type: 'object' as const,
      properties: {
        credential_id: {
          type: 'string',
          description: 'The UUID of the AWS cloud credential to use',
        },
        log_group_name: {
          type: 'string',
          description: 'The CloudWatch log group name (e.g., /ecs/my-service, /aws/lambda/my-function)',
        },
        filter_pattern: {
          type: 'string',
          description: 'Optional CloudWatch filter pattern (e.g., "ERROR", "Exception")',
        },
        lookback_minutes: {
          type: 'number',
          description: 'How many minutes of logs to fetch. Default is 30.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of log events to return. Default is 100.',
        },
      },
      required: ['credential_id', 'log_group_name'],
    },
  },
  {
    name: 'restart_ecs_service',
    description: 'Restart an AWS ECS service by forcing a new deployment. This will gradually replace running tasks with new ones. Use with caution - requires user confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        credential_id: {
          type: 'string',
          description: 'The UUID of the AWS cloud credential to use',
        },
        cluster_name: {
          type: 'string',
          description: 'The ECS cluster name',
        },
        service_name: {
          type: 'string',
          description: 'The ECS service name to restart',
        },
        confirmed: {
          type: 'boolean',
          description: 'Must be true to execute. Ask user for confirmation first.',
        },
      },
      required: ['credential_id', 'cluster_name', 'service_name', 'confirmed'],
    },
  },
  {
    name: 'list_ecs_services',
    description: 'List ECS services in a cluster to help identify which service to investigate or restart.',
    input_schema: {
      type: 'object' as const,
      properties: {
        credential_id: {
          type: 'string',
          description: 'The UUID of the AWS cloud credential to use',
        },
        cluster_name: {
          type: 'string',
          description: 'The ECS cluster name',
        },
      },
      required: ['credential_id', 'cluster_name'],
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

/**
 * Get the Anthropic API key for an organization
 * First checks for org-specific credential, falls back to env var
 */
export async function getAnthropicApiKey(orgId: string): Promise<string | null> {
  try {
    const dataSource = await getDataSource();
    const credentialRepo = dataSource.getRepository(CloudCredential);

    // Look for an enabled Anthropic credential for this org
    const credential = await credentialRepo.findOne({
      where: { orgId, provider: 'anthropic', enabled: true },
    });

    if (credential) {
      const decrypted = decryptCredentials<{ api_key: string }>(
        credential.credentialsEncrypted,
        orgId
      );
      if (decrypted.api_key) {
        logger.info('Using org-specific Anthropic API key', { orgId });
        return decrypted.api_key;
      }
    }
  } catch (error) {
    logger.warn('Failed to fetch org Anthropic credential, falling back to env var', { orgId, error });
  }

  // Fall back to environment variable
  return process.env.ANTHROPIC_API_KEY || null;
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
    ? context.availableCredentials.map(c => `${c.name} (${c.provider.toUpperCase()})`).join(', ')
    : 'None';

  return `You are an SRE helping diagnose production incidents. Be extremely concise - users are on mobile devices.

Tools available: investigate_cloud, get_incident_details, get_application_logs, get_cloudwatch_logs, list_ecs_services, restart_ecs_service
Cloud credentials: ${credentialList}

You have access to tools that let you:
1. **Investigate cloud infrastructure** - Query AWS, Azure, or GCP for service health, logs, errors, and resource status
2. **Get incident details** - Fetch the complete incident timeline, alerts, and events
3. **Get application logs** - Review logs from around the incident time
4. **Get CloudWatch logs** - Fetch logs directly from AWS CloudWatch log groups
5. **List ECS services** - View services running in an ECS cluster with their status
6. **Restart ECS services** - Force a new deployment to restart an ECS service (requires confirmation)

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

- Use \`get_cloudwatch_logs\` when:
  - You need real-time logs from a specific AWS service
  - The user mentions a specific log group
  - You need to filter logs for specific errors

- Use \`list_ecs_services\` when:
  - You need to see what services are running in a cluster
  - You want to check service health status
  - You need to identify which service to restart

- Use \`restart_ecs_service\` when:
  - The user explicitly asks to restart a service
  - You've identified a service that needs to be restarted
  - ALWAYS ask for user confirmation before restarting

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

  parts.push(`Incident #${incident.incidentNumber}: ${incident.summary}`);
  parts.push(`${incident.severity} | ${service?.name || 'Unknown'} | ${incident.state}`);
  parts.push(`Triggered: ${new Date(incident.triggeredAt).toLocaleString()}`);

  if (incident.details && Object.keys(incident.details).length > 0) {
    parts.push(`Details: ${JSON.stringify(incident.details)}`);
  }

  parts.push('\nAnalyze root cause and provide brief recommendations.');

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

      case 'get_cloudwatch_logs':
        return await handleGetCloudWatchLogs(toolInput, context);

      case 'restart_ecs_service':
        return await handleRestartECSService(toolInput, context);

      case 'list_ecs_services':
        return await handleListECSServices(toolInput, context);

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
 * Helper to get AWS credentials from a cloud credential
 */
async function getAWSCredentials(credentialId: string, context: AssistantContext): Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
} | null> {
  const dataSource = await getDataSource();
  const credentialRepo = dataSource.getRepository(CloudCredential);

  const credential = await credentialRepo.findOne({
    where: { id: credentialId, orgId: context.orgId, provider: 'aws', enabled: true },
  });

  if (!credential) {
    return null;
  }

  const decrypted = decryptCredentials<{
    aws_access_key_id?: string;
    aws_secret_access_key?: string;
    aws_region?: string;
  }>(credential.credentialsEncrypted, context.orgId);

  if (!decrypted.aws_access_key_id || !decrypted.aws_secret_access_key) {
    return null;
  }

  return {
    accessKeyId: decrypted.aws_access_key_id,
    secretAccessKey: decrypted.aws_secret_access_key,
    region: decrypted.aws_region || 'us-east-1',
  };
}

/**
 * Handle get_cloudwatch_logs tool
 */
async function handleGetCloudWatchLogs(
  input: Record<string, any>,
  context: AssistantContext
): Promise<ToolResult> {
  const { credential_id, log_group_name, filter_pattern, lookback_minutes = 30, limit = 100 } = input;

  // Verify credential is available
  const credential = context.availableCredentials.find(c => c.id === credential_id);
  if (!credential) {
    return { success: false, error: `Cloud credential ${credential_id} is not available` };
  }

  if (credential.provider !== 'aws') {
    return { success: false, error: 'CloudWatch logs are only available for AWS credentials' };
  }

  // Get AWS credentials
  const awsCreds = await getAWSCredentials(credential_id, context);
  if (!awsCreds) {
    return { success: false, error: 'Failed to retrieve AWS credentials' };
  }

  try {
    const client = new CloudWatchLogsClient({
      region: awsCreds.region,
      credentials: {
        accessKeyId: awsCreds.accessKeyId,
        secretAccessKey: awsCreds.secretAccessKey,
      },
    });

    const endTime = Date.now();
    const startTime = endTime - (lookback_minutes * 60 * 1000);

    const command = new FilterLogEventsCommand({
      logGroupName: log_group_name,
      startTime,
      endTime,
      filterPattern: filter_pattern || undefined,
      limit: Math.min(limit, 500),
    });

    const response = await client.send(command);

    const logs = (response.events || []).map(event => ({
      timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : null,
      message: event.message,
      logStreamName: event.logStreamName,
    }));

    return {
      success: true,
      data: {
        log_group: log_group_name,
        time_range: {
          start: new Date(startTime).toISOString(),
          end: new Date(endTime).toISOString(),
        },
        filter_pattern: filter_pattern || null,
        total_events: logs.length,
        logs,
      },
    };
  } catch (error: any) {
    logger.error('CloudWatch logs fetch failed', { error: error.message, log_group_name });
    return { success: false, error: `Failed to fetch CloudWatch logs: ${error.message}` };
  }
}

/**
 * Handle list_ecs_services tool
 */
async function handleListECSServices(
  input: Record<string, any>,
  context: AssistantContext
): Promise<ToolResult> {
  const { credential_id, cluster_name } = input;

  // Verify credential is available
  const credential = context.availableCredentials.find(c => c.id === credential_id);
  if (!credential) {
    return { success: false, error: `Cloud credential ${credential_id} is not available` };
  }

  if (credential.provider !== 'aws') {
    return { success: false, error: 'ECS services are only available for AWS credentials' };
  }

  // Get AWS credentials
  const awsCreds = await getAWSCredentials(credential_id, context);
  if (!awsCreds) {
    return { success: false, error: 'Failed to retrieve AWS credentials' };
  }

  try {
    const client = new ECSClient({
      region: awsCreds.region,
      credentials: {
        accessKeyId: awsCreds.accessKeyId,
        secretAccessKey: awsCreds.secretAccessKey,
      },
    });

    // List service ARNs
    const listCommand = new ListServicesCommand({ cluster: cluster_name });
    const listResponse = await client.send(listCommand);

    if (!listResponse.serviceArns || listResponse.serviceArns.length === 0) {
      return {
        success: true,
        data: {
          cluster: cluster_name,
          services: [],
          message: 'No services found in this cluster',
        },
      };
    }

    // Describe services for more details
    const describeCommand = new DescribeServicesCommand({
      cluster: cluster_name,
      services: listResponse.serviceArns,
    });
    const describeResponse = await client.send(describeCommand);

    const services = (describeResponse.services || []).map(svc => ({
      name: svc.serviceName,
      status: svc.status,
      desiredCount: svc.desiredCount,
      runningCount: svc.runningCount,
      pendingCount: svc.pendingCount,
      launchType: svc.launchType,
      taskDefinition: svc.taskDefinition?.split('/').pop(),
      deployments: svc.deployments?.length || 0,
      events: svc.events?.slice(0, 3).map(e => ({
        timestamp: e.createdAt?.toISOString(),
        message: e.message,
      })),
    }));

    return {
      success: true,
      data: {
        cluster: cluster_name,
        total_services: services.length,
        services,
      },
    };
  } catch (error: any) {
    logger.error('ECS list services failed', { error: error.message, cluster_name });
    return { success: false, error: `Failed to list ECS services: ${error.message}` };
  }
}

/**
 * Handle restart_ecs_service tool
 */
async function handleRestartECSService(
  input: Record<string, any>,
  context: AssistantContext
): Promise<ToolResult> {
  const { credential_id, cluster_name, service_name, confirmed } = input;

  // Safety check - require explicit confirmation
  if (!confirmed) {
    return {
      success: false,
      error: 'Service restart requires confirmation. Set confirmed=true after getting user approval.',
    };
  }

  // Verify credential is available
  const credential = context.availableCredentials.find(c => c.id === credential_id);
  if (!credential) {
    return { success: false, error: `Cloud credential ${credential_id} is not available` };
  }

  if (credential.provider !== 'aws') {
    return { success: false, error: 'ECS services are only available for AWS credentials' };
  }

  // Get AWS credentials
  const awsCreds = await getAWSCredentials(credential_id, context);
  if (!awsCreds) {
    return { success: false, error: 'Failed to retrieve AWS credentials' };
  }

  try {
    const client = new ECSClient({
      region: awsCreds.region,
      credentials: {
        accessKeyId: awsCreds.accessKeyId,
        secretAccessKey: awsCreds.secretAccessKey,
      },
    });

    // Force new deployment
    const command = new UpdateServiceCommand({
      cluster: cluster_name,
      service: service_name,
      forceNewDeployment: true,
    });

    const response = await client.send(command);

    logger.info('ECS service restart initiated', {
      cluster: cluster_name,
      service: service_name,
      userId: context.userId,
      incidentId: context.incidentId,
    });

    return {
      success: true,
      data: {
        cluster: cluster_name,
        service: service_name,
        status: response.service?.status,
        deploymentId: response.service?.deployments?.[0]?.id,
        message: `Service ${service_name} restart initiated. New tasks will be deployed gradually.`,
        current_state: {
          desiredCount: response.service?.desiredCount,
          runningCount: response.service?.runningCount,
          pendingCount: response.service?.pendingCount,
        },
      },
    };
  } catch (error: any) {
    logger.error('ECS service restart failed', { error: error.message, cluster_name, service_name });
    return { success: false, error: `Failed to restart ECS service: ${error.message}` };
  }
}

/**
 * Stream a chat response using Claude with tools
 */
export async function* streamAssistantChat(
  messages: Anthropic.MessageParam[],
  context: AssistantContext,
  systemPrompt: string,
  modelName: string = 'claude-sonnet-4-20250514'
): AsyncGenerator<AssistantStreamEvent> {
  // Get API key - org-specific or fall back to env var
  const apiKey = await getAnthropicApiKey(context.orgId);

  if (!apiKey) {
    yield { type: 'error', error: 'Anthropic API key is not configured. Add one in Settings > Cloud Credentials.' };
    return;
  }

  const anthropic = new Anthropic({
    apiKey,
  });

  logger.info('Starting assistant chat stream', {
    incidentId: context.incidentId,
    messageCount: messages.length,
    credentialCount: context.availableCredentials.length,
    model: modelName,
  });

  let currentMessages = [...messages];
  let iteration = 0;
  const maxIterations = 25; // Prevent infinite tool loops (high for dev, lower in production)

  while (iteration < maxIterations) {
    iteration++;

    // Create streaming request
    const stream = await anthropic.messages.stream({
      model: modelName,
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
