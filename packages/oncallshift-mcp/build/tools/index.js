/**
 * OnCallShift MCP Tool Definitions
 *
 * This module defines all the tools available through the MCP server
 * for interacting with the OnCallShift platform.
 */
import { z } from 'zod';
// ============================================
// Zod Schemas for Input Validation
// ============================================
export const GetOnCallNowSchema = z.object({
    service_id: z.string().optional().describe('Optional service ID to filter on-call users'),
});
export const ListIncidentsSchema = z.object({
    status: z.enum(['triggered', 'acknowledged', 'resolved']).optional()
        .describe('Filter by incident status'),
    service_id: z.string().optional().describe('Filter by service ID'),
    limit: z.number().min(1).max(100).optional().default(25)
        .describe('Maximum number of incidents to return'),
});
export const ListServicesSchema = z.object({
    team_id: z.string().optional().describe('Filter by team ID'),
    limit: z.number().min(1).max(100).optional().default(25)
        .describe('Maximum number of services to return'),
});
export const AcknowledgeIncidentSchema = z.object({
    incident_id: z.string().describe('The ID of the incident to acknowledge'),
});
export const ResolveIncidentSchema = z.object({
    incident_id: z.string().describe('The ID of the incident to resolve'),
});
export const CreateTeamSchema = z.object({
    name: z.string().min(1).max(100).describe('Name of the team'),
    description: z.string().max(500).optional().describe('Description of the team'),
});
export const SetupScheduleSchema = z.object({
    name: z.string().min(1).max(100).describe('Name of the schedule'),
    description: z.string().max(500).optional().describe('Description of the schedule'),
    timezone: z.string().default('UTC').describe('Timezone for the schedule (e.g., America/New_York)'),
    team_id: z.string().optional().describe('Team ID to associate with the schedule'),
    rotation_type: z.enum(['daily', 'weekly']).default('weekly')
        .describe('Type of rotation for the schedule'),
    user_ids: z.array(z.string()).optional()
        .describe('User IDs to add to the rotation'),
});
export const GetIncidentSchema = z.object({
    incident_id: z.string().describe('The ID of the incident to retrieve'),
});
export const EscalateIncidentSchema = z.object({
    incident_id: z.string().describe('The ID of the incident to escalate'),
});
export const AddIncidentNoteSchema = z.object({
    incident_id: z.string().describe('The ID of the incident'),
    content: z.string().min(1).max(10000).describe('The note content'),
});
export const ListTeamsSchema = z.object({
    limit: z.number().min(1).max(100).optional().default(25)
        .describe('Maximum number of teams to return'),
});
export const ListSchedulesSchema = z.object({
    team_id: z.string().optional().describe('Filter by team ID'),
    limit: z.number().min(1).max(100).optional().default(25)
        .describe('Maximum number of schedules to return'),
});
// New configuration tool schemas
export const CreateEscalationPolicySchema = z.object({
    name: z.string().min(1).max(100).describe('Name of the escalation policy'),
    description: z.string().max(1000).optional()
        .describe('Natural language description of the escalation policy'),
    service_name: z.string().optional()
        .describe('Name of the service to associate with this policy'),
    steps: z.array(z.object({
        delay_minutes: z.number().min(0).max(1440).describe('Minutes to wait before escalating'),
        target_type: z.enum(['user', 'schedule']).describe('Type of escalation target'),
        target_id: z.string().describe('ID of the user or schedule to notify'),
    })).optional().describe('Explicit escalation steps'),
});
export const CreateServiceSchema = z.object({
    name: z.string().min(1).max(100).describe('Name of the service'),
    description: z.string().max(500).optional().describe('Description of the service'),
    escalation_policy_id: z.string().optional().describe('ID of the escalation policy to use'),
    team_id: z.string().optional().describe('ID of the team that owns this service'),
});
export const InviteUserSchema = z.object({
    email: z.string().email().describe('Email address of the user to invite'),
    full_name: z.string().min(1).max(100).describe('Full name of the user'),
    role: z.enum(['admin', 'user']).default('user').describe('Role to assign to the user'),
    team_ids: z.array(z.string()).optional().describe('Team IDs to add the user to'),
});
export const CreateRunbookSchema = z.object({
    name: z.string().min(1).max(100).describe('Name of the runbook'),
    description: z.string().max(1000).optional()
        .describe('Description of what this runbook does'),
    service_name: z.string().optional()
        .describe('Name of the service to associate with this runbook'),
    steps: z.string()
        .describe('Natural language description of runbook steps'),
});
export const ImportFromPlatformSchema = z.object({
    platform: z.enum(['pagerduty', 'opsgenie']).describe('The platform to import from'),
    export_data: z.unknown().describe('The exported JSON data from the source platform'),
    preserve_keys: z.boolean().default(true).optional()
        .describe('Whether to preserve original integration keys'),
    dry_run: z.boolean().default(false).optional()
        .describe('If true, validate the import without making changes'),
});
export const ConnectIntegrationSchema = z.object({
    integration_type: z.enum(['slack', 'datadog', 'cloudwatch', 'prometheus', 'jira', 'github'])
        .describe('Type of integration to connect'),
    name: z.string().min(1).max(100).describe('Name for this integration'),
    configuration: z.record(z.unknown()).optional()
        .describe('Integration-specific configuration options'),
});
// ============================================
// Tool Definitions
// ============================================
export const TOOL_DEFINITIONS = [
    {
        name: 'get_oncall_now',
        description: 'Get a list of users who are currently on-call across all services.',
        inputSchema: {
            type: 'object',
            properties: {
                service_id: { type: 'string', description: 'Optional service ID to filter on-call users' },
            },
        },
    },
    {
        name: 'list_incidents',
        description: 'List incidents with optional filters for status and service.',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['triggered', 'acknowledged', 'resolved'], description: 'Filter by incident status' },
                service_id: { type: 'string', description: 'Filter by service ID' },
                limit: { type: 'number', description: 'Maximum number of incidents to return (1-100)' },
            },
        },
    },
    {
        name: 'get_incident',
        description: 'Get detailed information about a specific incident by ID.',
        inputSchema: {
            type: 'object',
            properties: {
                incident_id: { type: 'string', description: 'The ID of the incident to retrieve' },
            },
            required: ['incident_id'],
        },
    },
    {
        name: 'list_services',
        description: 'List all services configured in OnCallShift.',
        inputSchema: {
            type: 'object',
            properties: {
                team_id: { type: 'string', description: 'Filter by team ID' },
                limit: { type: 'number', description: 'Maximum number of services to return (1-100)' },
            },
        },
    },
    {
        name: 'acknowledge_incident',
        description: 'Acknowledge an incident to indicate someone is working on it.',
        inputSchema: {
            type: 'object',
            properties: {
                incident_id: { type: 'string', description: 'The ID of the incident to acknowledge' },
            },
            required: ['incident_id'],
        },
    },
    {
        name: 'resolve_incident',
        description: 'Resolve an incident to mark it as fixed/completed.',
        inputSchema: {
            type: 'object',
            properties: {
                incident_id: { type: 'string', description: 'The ID of the incident to resolve' },
            },
            required: ['incident_id'],
        },
    },
    {
        name: 'escalate_incident',
        description: 'Escalate an incident to the next level in the escalation policy.',
        inputSchema: {
            type: 'object',
            properties: {
                incident_id: { type: 'string', description: 'The ID of the incident to escalate' },
            },
            required: ['incident_id'],
        },
    },
    {
        name: 'add_incident_note',
        description: 'Add a note or update to an incident for tracking investigation progress.',
        inputSchema: {
            type: 'object',
            properties: {
                incident_id: { type: 'string', description: 'The ID of the incident' },
                content: { type: 'string', description: 'The note content' },
            },
            required: ['incident_id', 'content'],
        },
    },
    {
        name: 'create_team',
        description: 'Create a new team in OnCallShift for organizing users and services.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name of the team' },
                description: { type: 'string', description: 'Description of the team' },
            },
            required: ['name'],
        },
    },
    {
        name: 'list_teams',
        description: 'List all teams in the organization.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum number of teams to return (1-100)' },
            },
        },
    },
    {
        name: 'setup_schedule',
        description: 'Create a new on-call schedule with rotation configuration.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name of the schedule' },
                description: { type: 'string', description: 'Description of the schedule' },
                timezone: { type: 'string', description: 'Timezone for the schedule (e.g., America/New_York, UTC)' },
                team_id: { type: 'string', description: 'Team ID to associate with the schedule' },
                rotation_type: { type: 'string', enum: ['daily', 'weekly'], description: 'Type of rotation (daily or weekly)' },
                user_ids: { type: 'array', items: { type: 'string' }, description: 'User IDs to add to the rotation' },
            },
            required: ['name'],
        },
    },
    {
        name: 'list_schedules',
        description: 'List all on-call schedules. Optionally filter by team.',
        inputSchema: {
            type: 'object',
            properties: {
                team_id: { type: 'string', description: 'Filter by team ID' },
                limit: { type: 'number', description: 'Maximum number of schedules to return (1-100)' },
            },
        },
    },
    // New configuration tools
    {
        name: 'create_escalation_policy',
        description: 'Create an escalation policy from a natural language description. Parses descriptions like "Notify on-call immediately, then team lead after 15 minutes" into structured escalation steps.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name of the escalation policy' },
                description: { type: 'string', description: 'Natural language description of escalation flow' },
                service_name: { type: 'string', description: 'Optional service name to associate with this policy' },
                steps: {
                    type: 'array',
                    description: 'Explicit escalation steps (alternative to description parsing)',
                    items: {
                        type: 'object',
                        properties: {
                            delay_minutes: { type: 'number', description: 'Minutes before escalating' },
                            target_type: { type: 'string', enum: ['user', 'schedule'] },
                            target_id: { type: 'string', description: 'User or schedule ID' },
                        },
                    },
                },
            },
            required: ['name'],
        },
    },
    {
        name: 'create_service',
        description: 'Create a new service in OnCallShift. Services represent systems, applications, or components that can generate incidents.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name of the service' },
                description: { type: 'string', description: 'Description of what this service does' },
                escalation_policy_id: { type: 'string', description: 'ID of the escalation policy to use for incidents' },
                team_id: { type: 'string', description: 'ID of the team that owns this service' },
            },
            required: ['name'],
        },
    },
    {
        name: 'invite_user',
        description: 'Invite a new user to the OnCallShift organization. Sends an invitation email to the specified address.',
        inputSchema: {
            type: 'object',
            properties: {
                email: { type: 'string', description: 'Email address to send the invitation to' },
                full_name: { type: 'string', description: 'Full name of the user being invited' },
                role: { type: 'string', enum: ['admin', 'user'], description: 'Role to assign (admin or user)' },
                team_ids: { type: 'array', items: { type: 'string' }, description: 'Team IDs to add the user to upon joining' },
            },
            required: ['email', 'full_name'],
        },
    },
    {
        name: 'create_runbook',
        description: 'Create a runbook from a natural language description of steps. Runbooks guide responders through incident resolution procedures.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name of the runbook' },
                description: { type: 'string', description: 'Brief description of what this runbook addresses' },
                service_name: { type: 'string', description: 'Service to associate with this runbook' },
                steps: { type: 'string', description: 'Natural language description of steps (e.g., "1. Check logs 2. Restart service")' },
            },
            required: ['name', 'steps'],
        },
    },
    {
        name: 'import_from_platform',
        description: 'Import configuration from PagerDuty or Opsgenie. Migrates users, teams, schedules, escalation policies, and services from an exported JSON file.',
        inputSchema: {
            type: 'object',
            properties: {
                platform: { type: 'string', enum: ['pagerduty', 'opsgenie'], description: 'Source platform to import from' },
                export_data: { type: 'object', description: 'The JSON data exported from the source platform' },
                preserve_keys: { type: 'boolean', description: 'Keep original integration keys for zero-config migration (default: true)' },
                dry_run: { type: 'boolean', description: 'Validate import without making changes (default: false)' },
            },
            required: ['platform', 'export_data'],
        },
    },
    {
        name: 'connect_integration',
        description: 'Connect a monitoring or collaboration integration. Returns webhook URL or setup instructions for the specified integration type.',
        inputSchema: {
            type: 'object',
            properties: {
                integration_type: { type: 'string', enum: ['slack', 'datadog', 'cloudwatch', 'prometheus', 'jira', 'github'], description: 'Type of integration to connect' },
                name: { type: 'string', description: 'A friendly name for this integration' },
                configuration: { type: 'object', description: 'Integration-specific configuration options' },
            },
            required: ['integration_type', 'name'],
        },
    },
];
// ============================================
// Helper Functions
// ============================================
function parseEscalationDescription(description) {
    const steps = [];
    const parts = description.split(/,|then|and/).map(s => s.trim().toLowerCase());
    let currentDelay = 0;
    for (const part of parts) {
        if (!part)
            continue;
        const timeMatch = part.match(/after\s+(\d+)\s*(minutes?|mins?|m)/);
        if (timeMatch) {
            currentDelay = parseInt(timeMatch[1], 10);
        }
        else if (part.includes('immediately') || part.includes('first')) {
            currentDelay = 0;
        }
        steps.push({ delay_minutes: currentDelay, targets: [{ type: 'schedule', id: 'primary' }] });
    }
    if (steps.length === 0) {
        steps.push({ delay_minutes: 0, targets: [{ type: 'schedule', id: 'primary' }] });
    }
    return steps;
}
function parseRunbookSteps(stepsText) {
    const steps = [];
    const lines = stepsText.split(/\n|\d+\.\s+/).filter(s => s.trim());
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line)
            continue;
        let stepType = 'manual';
        if (line.toLowerCase().includes('run ') || line.toLowerCase().includes('execute ') || line.includes('`')) {
            stepType = 'command';
        }
        else if (line.toLowerCase().includes('api') || line.toLowerCase().includes('curl')) {
            stepType = 'api_call';
        }
        else if (line.toLowerCase().includes('if ') || line.toLowerCase().includes('check ') || line.toLowerCase().includes('verify ')) {
            stepType = 'conditional';
        }
        steps.push({
            order: i + 1,
            title: line.length > 100 ? line.substring(0, 97) + '...' : line,
            description: line.length > 100 ? line : undefined,
            type: stepType,
            content: line,
        });
    }
    return steps;
}
function getIntegrationInstructions(integrationType) {
    const baseUrl = 'https://oncallshift.com';
    switch (integrationType) {
        case 'slack':
            return `Slack Integration Setup:
1. Go to your Slack App settings at https://api.slack.com/apps
2. Add the OnCallShift Slack App, or create a new app
3. Enable Incoming Webhooks and copy the webhook URL
4. Configure the webhook URL in OnCallShift`;
        case 'datadog':
            return `Datadog Integration Setup:
1. In Datadog, go to Integrations > Webhooks
2. Add a new webhook with URL: ${baseUrl}/api/v1/alerts/webhook
3. Use the service's API key as the authentication header`;
        case 'cloudwatch':
            return `AWS CloudWatch Integration Setup:
1. Create an SNS topic for CloudWatch alarms
2. Add an HTTPS subscription to: ${baseUrl}/api/v1/alerts/webhook
3. Configure CloudWatch alarms to publish to this SNS topic`;
        case 'prometheus':
            return `Prometheus/Alertmanager Integration Setup:
1. Configure Alertmanager webhook receiver with URL: ${baseUrl}/api/v1/alerts/webhook
2. Route alerts to the oncallshift receiver`;
        case 'jira':
            return `Jira Integration Setup:
1. Create a Jira API token
2. Configure the integration with your Jira instance URL
3. Select the project and issue type for incident tickets`;
        case 'github':
            return `GitHub Integration Setup:
1. Create a GitHub App or personal access token
2. Configure webhook to: ${baseUrl}/api/v1/integrations/github/webhook`;
        default:
            return `To complete setup for ${integrationType}, please refer to the OnCallShift documentation.`;
    }
}
function formatOnCallData(oncallData) {
    if (oncallData.length === 0)
        return 'No services with on-call schedules found.';
    const lines = ['Currently On-Call:', ''];
    for (const item of oncallData) {
        lines.push(`Service: ${item.service.name}`);
        lines.push(`  Schedule: ${item.schedule.name}`);
        if (item.oncallUser) {
            lines.push(`  On-Call: ${item.oncallUser.fullName} (${item.oncallUser.email})`);
        }
        else {
            lines.push('  On-Call: No one currently on-call');
        }
        lines.push('');
    }
    return lines.join('\n');
}
function formatIncidents(incidents) {
    const lines = [`Found ${incidents.length} incident(s):`, ''];
    for (const incident of incidents) {
        lines.push(`[${getStatusIcon(incident.state)}] #${incident.incidentNumber} [${incident.severity.toUpperCase()}] ${incident.summary}`);
        lines.push(`   State: ${incident.state} | Service: ${incident.service.name}`);
        lines.push('');
    }
    return lines.join('\n');
}
function formatIncidentDetail(incident) {
    return [
        `Incident #${incident.incidentNumber}: ${incident.summary}`,
        `ID: ${incident.id}`,
        `State: ${incident.state}`,
        `Severity: ${incident.severity}`,
        `Service: ${incident.service.name}`,
        `Escalation Step: ${incident.currentEscalationStep}`,
    ].join('\n');
}
function formatServices(services) {
    const lines = [`Found ${services.length} service(s):`, ''];
    for (const service of services) {
        lines.push(`- ${service.name} [${service.id}]`);
        if (service.description)
            lines.push(`  ${service.description}`);
        lines.push(`  Status: ${service.status}`);
        lines.push('');
    }
    return lines.join('\n');
}
function formatTeams(teams) {
    const lines = [`Found ${teams.length} team(s):`, ''];
    for (const team of teams) {
        lines.push(`- ${team.name} [${team.id}]`);
        if (team.description)
            lines.push(`  ${team.description}`);
        lines.push('');
    }
    return lines.join('\n');
}
function formatSchedules(schedules) {
    const lines = [`Found ${schedules.length} schedule(s):`, ''];
    for (const schedule of schedules) {
        lines.push(`- ${schedule.name} [${schedule.id}]`);
        lines.push(`  Timezone: ${schedule.timezone}`);
        lines.push('');
    }
    return lines.join('\n');
}
function getStatusIcon(status) {
    switch (status) {
        case 'triggered': return '!';
        case 'acknowledged': return '~';
        case 'resolved': return '+';
        default: return ' ';
    }
}
// ============================================
// Tool Handlers
// ============================================
export const TOOL_HANDLERS = {
    get_oncall_now: async (client, args) => {
        const params = GetOnCallNowSchema.parse(args);
        const result = await client.getOnCallNow();
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        let oncallData = result.data?.oncall || [];
        if (params.service_id)
            oncallData = oncallData.filter((item) => item.service.id === params.service_id);
        return { content: [{ type: 'text', text: formatOnCallData(oncallData) }] };
    },
    list_incidents: async (client, args) => {
        const params = ListIncidentsSchema.parse(args);
        const result = await client.listIncidents(params);
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        const incidents = result.data?.incidents || [];
        if (incidents.length === 0)
            return { content: [{ type: 'text', text: 'No incidents found.' }] };
        return { content: [{ type: 'text', text: formatIncidents(incidents) }] };
    },
    get_incident: async (client, args) => {
        const params = GetIncidentSchema.parse(args);
        const result = await client.getIncident(params.incident_id);
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        return { content: [{ type: 'text', text: formatIncidentDetail(result.data) }] };
    },
    list_services: async (client, args) => {
        const params = ListServicesSchema.parse(args);
        const result = await client.listServices(params);
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        const services = result.data?.services || [];
        if (services.length === 0)
            return { content: [{ type: 'text', text: 'No services found.' }] };
        return { content: [{ type: 'text', text: formatServices(services) }] };
    },
    acknowledge_incident: async (client, args) => {
        const params = AcknowledgeIncidentSchema.parse(args);
        const result = await client.acknowledgeIncident(params.incident_id);
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        return { content: [{ type: 'text', text: `Incident ${params.incident_id} acknowledged.` }] };
    },
    resolve_incident: async (client, args) => {
        const params = ResolveIncidentSchema.parse(args);
        const result = await client.resolveIncident(params.incident_id);
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        return { content: [{ type: 'text', text: `Incident ${params.incident_id} resolved.` }] };
    },
    escalate_incident: async (client, args) => {
        const params = EscalateIncidentSchema.parse(args);
        const result = await client.escalateIncident(params.incident_id);
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        return { content: [{ type: 'text', text: `Incident ${params.incident_id} escalated.` }] };
    },
    add_incident_note: async (client, args) => {
        const params = AddIncidentNoteSchema.parse(args);
        const result = await client.addIncidentNote(params.incident_id, params.content);
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        return { content: [{ type: 'text', text: `Note added to incident ${params.incident_id}.` }] };
    },
    create_team: async (client, args) => {
        const params = CreateTeamSchema.parse(args);
        const result = await client.createTeam(params);
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        return { content: [{ type: 'text', text: `Team "${params.name}" created with ID: ${result.data?.id}` }] };
    },
    list_teams: async (client, args) => {
        const params = ListTeamsSchema.parse(args);
        const result = await client.listTeams(params);
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        const teams = result.data?.teams || [];
        if (teams.length === 0)
            return { content: [{ type: 'text', text: 'No teams found.' }] };
        return { content: [{ type: 'text', text: formatTeams(teams) }] };
    },
    setup_schedule: async (client, args) => {
        const params = SetupScheduleSchema.parse(args);
        const scheduleData = { name: params.name, description: params.description, timezone: params.timezone, team_id: params.team_id };
        if (params.user_ids && params.user_ids.length > 0) {
            scheduleData.layers = [{ name: 'Primary', rotation_type: params.rotation_type, users: params.user_ids, start_time: new Date().toISOString() }];
        }
        const result = await client.createSchedule(scheduleData);
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        return { content: [{ type: 'text', text: `Schedule "${params.name}" created with ID: ${result.data?.id}` }] };
    },
    list_schedules: async (client, args) => {
        const params = ListSchedulesSchema.parse(args);
        const result = await client.listSchedules(params);
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        const schedules = result.data?.schedules || [];
        if (schedules.length === 0)
            return { content: [{ type: 'text', text: 'No schedules found.' }] };
        return { content: [{ type: 'text', text: formatSchedules(schedules) }] };
    },
    // New configuration tool handlers
    create_escalation_policy: async (client, args) => {
        const params = CreateEscalationPolicySchema.parse(args);
        let steps;
        if (params.steps && params.steps.length > 0) {
            steps = params.steps.map(step => ({ delay_minutes: step.delay_minutes, targets: [{ type: step.target_type, id: step.target_id }] }));
        }
        else if (params.description) {
            steps = parseEscalationDescription(params.description);
        }
        else {
            steps = [{ delay_minutes: 0, targets: [{ type: 'schedule', id: 'primary' }] }];
        }
        const result = await client.createEscalationPolicy({ name: params.name, description: params.description, steps });
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        const policyData = result.data;
        let text = `Escalation policy "${params.name}" created with ID: ${policyData.id}`;
        if (params.service_name)
            text += `\n\nTo link to service "${params.service_name}", use escalation_policy_id: ${policyData.id}`;
        return { content: [{ type: 'text', text }] };
    },
    create_service: async (client, args) => {
        const params = CreateServiceSchema.parse(args);
        const result = await client.createService({ name: params.name, description: params.description, escalation_policy_id: params.escalation_policy_id, team_id: params.team_id });
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        const serviceData = result.data;
        return { content: [{ type: 'text', text: `Service "${params.name}" created!\nID: ${serviceData.service.id}\nAPI Key: ${serviceData.service.apiKey}\n\nWebhook URL: https://oncallshift.com/api/v1/alerts/webhook` }] };
    },
    invite_user: async (client, args) => {
        const params = InviteUserSchema.parse(args);
        const result = await client.inviteUser({ email: params.email, full_name: params.full_name, role: params.role, team_ids: params.team_ids });
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        let text = `Invitation sent to ${params.email} (${params.full_name}) as ${params.role}.`;
        if (params.team_ids?.length)
            text += `\nWill be added to ${params.team_ids.length} team(s).`;
        return { content: [{ type: 'text', text }] };
    },
    create_runbook: async (client, args) => {
        const params = CreateRunbookSchema.parse(args);
        const parsedSteps = parseRunbookSteps(params.steps);
        let serviceId;
        if (params.service_name) {
            const servicesResult = await client.listServices({ limit: 100 });
            if (servicesResult.success) {
                const services = servicesResult.data?.services || [];
                const match = services.find(s => s.name.toLowerCase() === params.service_name.toLowerCase());
                if (match)
                    serviceId = match.id;
            }
        }
        const result = await client.createRunbook({ name: params.name, description: params.description, service_id: serviceId, steps: parsedSteps });
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        const runbookData = result.data;
        let text = `Runbook "${params.name}" created with ID: ${runbookData.id}\n\nParsed ${parsedSteps.length} step(s):`;
        for (const step of parsedSteps)
            text += `\n  ${step.order}. [${step.type}] ${step.title}`;
        if (params.service_name && !serviceId)
            text += `\n\nNote: Service "${params.service_name}" not found.`;
        return { content: [{ type: 'text', text }] };
    },
    import_from_platform: async (client, args) => {
        const params = ImportFromPlatformSchema.parse(args);
        if (params.dry_run) {
            const validateResult = await client.validateImport(params.platform, params.export_data);
            if (!validateResult.success)
                return { isError: true, content: [{ type: 'text', text: `Validation Error: ${validateResult.error}` }] };
            const validationData = validateResult.data;
            let text = `Import Validation (Dry Run) for ${params.platform}:\nStatus: ${validationData.isValid ? 'VALID' : 'INVALID'}\n\nSummary:`;
            for (const [entity, stats] of Object.entries(validationData.summary)) {
                text += `\n  ${entity}: ${stats.willCreate} to create, ${stats.willSkip} to skip`;
            }
            return { content: [{ type: 'text', text }] };
        }
        const result = await client.importFromPlatform(params.platform, params.export_data, { preserve_keys: params.preserve_keys });
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Import Error: ${result.error}` }] };
        const importData = result.data;
        let text = `Import from ${params.platform} completed!\n\nImported:`;
        for (const [entity, count] of Object.entries(importData.imported)) {
            if (count > 0)
                text += `\n  ${entity}: ${count}`;
        }
        if (params.preserve_keys)
            text += '\n\nIntegration keys preserved for zero-config migration.';
        return { content: [{ type: 'text', text }] };
    },
    connect_integration: async (client, args) => {
        const params = ConnectIntegrationSchema.parse(args);
        const result = await client.createIntegration({ type: params.integration_type, name: params.name, config: params.configuration });
        if (!result.success)
            return { isError: true, content: [{ type: 'text', text: `Error: ${result.error}` }] };
        const integrationData = result.data;
        let text = `Integration "${params.name}" (${params.integration_type}) created!\nID: ${integrationData.integration.id}\nStatus: ${integrationData.integration.status}\n\n`;
        text += getIntegrationInstructions(params.integration_type);
        return { content: [{ type: 'text', text }] };
    },
};
//# sourceMappingURL=index.js.map