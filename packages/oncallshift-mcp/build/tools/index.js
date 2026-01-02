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
// ============================================
// Tool Definitions
// ============================================
export const TOOL_DEFINITIONS = [
    {
        name: 'get_oncall_now',
        description: 'Get a list of users who are currently on-call across all services. Optionally filter by service ID.',
        inputSchema: {
            type: 'object',
            properties: {
                service_id: {
                    type: 'string',
                    description: 'Optional service ID to filter on-call users',
                },
            },
        },
    },
    {
        name: 'list_incidents',
        description: 'List incidents with optional filters for status and service. Returns active incidents by default.',
        inputSchema: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    enum: ['triggered', 'acknowledged', 'resolved'],
                    description: 'Filter by incident status',
                },
                service_id: {
                    type: 'string',
                    description: 'Filter by service ID',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of incidents to return (1-100)',
                },
            },
        },
    },
    {
        name: 'get_incident',
        description: 'Get detailed information about a specific incident by ID.',
        inputSchema: {
            type: 'object',
            properties: {
                incident_id: {
                    type: 'string',
                    description: 'The ID of the incident to retrieve',
                },
            },
            required: ['incident_id'],
        },
    },
    {
        name: 'list_services',
        description: 'List all services configured in OnCallShift. Optionally filter by team.',
        inputSchema: {
            type: 'object',
            properties: {
                team_id: {
                    type: 'string',
                    description: 'Filter by team ID',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of services to return (1-100)',
                },
            },
        },
    },
    {
        name: 'acknowledge_incident',
        description: 'Acknowledge an incident to indicate someone is working on it. This stops further escalations.',
        inputSchema: {
            type: 'object',
            properties: {
                incident_id: {
                    type: 'string',
                    description: 'The ID of the incident to acknowledge',
                },
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
                incident_id: {
                    type: 'string',
                    description: 'The ID of the incident to resolve',
                },
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
                incident_id: {
                    type: 'string',
                    description: 'The ID of the incident to escalate',
                },
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
                incident_id: {
                    type: 'string',
                    description: 'The ID of the incident',
                },
                content: {
                    type: 'string',
                    description: 'The note content',
                },
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
                name: {
                    type: 'string',
                    description: 'Name of the team',
                },
                description: {
                    type: 'string',
                    description: 'Description of the team',
                },
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
                limit: {
                    type: 'number',
                    description: 'Maximum number of teams to return (1-100)',
                },
            },
        },
    },
    {
        name: 'setup_schedule',
        description: 'Create a new on-call schedule with rotation configuration.',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Name of the schedule',
                },
                description: {
                    type: 'string',
                    description: 'Description of the schedule',
                },
                timezone: {
                    type: 'string',
                    description: 'Timezone for the schedule (e.g., America/New_York, UTC)',
                },
                team_id: {
                    type: 'string',
                    description: 'Team ID to associate with the schedule',
                },
                rotation_type: {
                    type: 'string',
                    enum: ['daily', 'weekly'],
                    description: 'Type of rotation (daily or weekly)',
                },
                user_ids: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'User IDs to add to the rotation',
                },
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
                team_id: {
                    type: 'string',
                    description: 'Filter by team ID',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of schedules to return (1-100)',
                },
            },
        },
    },
];
// ============================================
// Tool Handlers
// ============================================
export const TOOL_HANDLERS = {
    get_oncall_now: async (client, args) => {
        const params = GetOnCallNowSchema.parse(args);
        const result = await client.getOnCallNow();
        if (!result.success) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${result.error}` }],
            };
        }
        let oncallData = result.data?.oncall || [];
        // Filter by service_id if provided
        if (params.service_id) {
            oncallData = oncallData.filter(item => item.service.id === params.service_id);
        }
        return {
            content: [{
                    type: 'text',
                    text: formatOnCallData(oncallData),
                }],
        };
    },
    list_incidents: async (client, args) => {
        const params = ListIncidentsSchema.parse(args);
        const result = await client.listIncidents(params);
        if (!result.success) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${result.error}` }],
            };
        }
        const incidents = result.data?.incidents || [];
        if (incidents.length === 0) {
            return {
                content: [{ type: 'text', text: 'No incidents found matching the criteria.' }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: formatIncidents(incidents),
                }],
        };
    },
    get_incident: async (client, args) => {
        const params = GetIncidentSchema.parse(args);
        const result = await client.getIncident(params.incident_id);
        if (!result.success) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${result.error}` }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: formatIncidentDetail(result.data),
                }],
        };
    },
    list_services: async (client, args) => {
        const params = ListServicesSchema.parse(args);
        const result = await client.listServices(params);
        if (!result.success) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${result.error}` }],
            };
        }
        const services = result.data?.services || [];
        if (services.length === 0) {
            return {
                content: [{ type: 'text', text: 'No services found.' }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: formatServices(services),
                }],
        };
    },
    acknowledge_incident: async (client, args) => {
        const params = AcknowledgeIncidentSchema.parse(args);
        const result = await client.acknowledgeIncident(params.incident_id);
        if (!result.success) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${result.error}` }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `Incident ${params.incident_id} has been acknowledged successfully.`,
                }],
        };
    },
    resolve_incident: async (client, args) => {
        const params = ResolveIncidentSchema.parse(args);
        const result = await client.resolveIncident(params.incident_id);
        if (!result.success) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${result.error}` }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `Incident ${params.incident_id} has been resolved successfully.`,
                }],
        };
    },
    escalate_incident: async (client, args) => {
        const params = EscalateIncidentSchema.parse(args);
        const result = await client.escalateIncident(params.incident_id);
        if (!result.success) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${result.error}` }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `Incident ${params.incident_id} has been escalated to the next level.`,
                }],
        };
    },
    add_incident_note: async (client, args) => {
        const params = AddIncidentNoteSchema.parse(args);
        const result = await client.addIncidentNote(params.incident_id, params.content);
        if (!result.success) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${result.error}` }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `Note added to incident ${params.incident_id} successfully.`,
                }],
        };
    },
    create_team: async (client, args) => {
        const params = CreateTeamSchema.parse(args);
        const result = await client.createTeam(params);
        if (!result.success) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${result.error}` }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `Team "${params.name}" created successfully with ID: ${result.data?.id}`,
                }],
        };
    },
    list_teams: async (client, args) => {
        const params = ListTeamsSchema.parse(args);
        const result = await client.listTeams(params);
        if (!result.success) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${result.error}` }],
            };
        }
        const teams = result.data?.teams || [];
        if (teams.length === 0) {
            return {
                content: [{ type: 'text', text: 'No teams found.' }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: formatTeams(teams),
                }],
        };
    },
    setup_schedule: async (client, args) => {
        const params = SetupScheduleSchema.parse(args);
        const scheduleData = {
            name: params.name,
            description: params.description,
            timezone: params.timezone,
            team_id: params.team_id,
        };
        // Add rotation layer if user_ids provided
        if (params.user_ids && params.user_ids.length > 0) {
            scheduleData.layers = [{
                    name: 'Primary',
                    rotation_type: params.rotation_type,
                    users: params.user_ids,
                    start_time: new Date().toISOString(),
                }];
        }
        const result = await client.createSchedule(scheduleData);
        if (!result.success) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${result.error}` }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `Schedule "${params.name}" created successfully with ID: ${result.data?.id}`,
                }],
        };
    },
    list_schedules: async (client, args) => {
        const params = ListSchedulesSchema.parse(args);
        const result = await client.listSchedules(params);
        if (!result.success) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${result.error}` }],
            };
        }
        const schedules = result.data?.schedules || [];
        if (schedules.length === 0) {
            return {
                content: [{ type: 'text', text: 'No schedules found.' }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: formatSchedules(schedules),
                }],
        };
    },
};
function formatOnCallData(oncallData) {
    if (oncallData.length === 0) {
        return 'No services with on-call schedules found.';
    }
    const lines = ['Currently On-Call:', ''];
    for (const item of oncallData) {
        const serviceLine = `Service: ${item.service.name}`;
        lines.push(serviceLine);
        lines.push(`  Schedule: ${item.schedule.name}`);
        if (item.oncallUser) {
            lines.push(`  On-Call: ${item.oncallUser.fullName} (${item.oncallUser.email})`);
            if (item.isOverride && item.overrideUntil) {
                lines.push(`  [OVERRIDE until ${formatDate(item.overrideUntil)}]`);
            }
        }
        else {
            lines.push(`  On-Call: No one currently on-call`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
function formatIncidents(incidents) {
    const lines = [`Found ${incidents.length} incident(s):`, ''];
    for (const incident of incidents) {
        const statusIcon = getStatusIcon(incident.state);
        const severityIcon = getSeverityIcon(incident.severity);
        lines.push(`${statusIcon} #${incident.incidentNumber} ${severityIcon} ${incident.summary}`);
        lines.push(`   State: ${incident.state} | Service: ${incident.service.name}`);
        lines.push(`   Triggered: ${formatDate(incident.triggeredAt)}`);
        if (incident.acknowledgedBy) {
            lines.push(`   Acknowledged by: ${incident.acknowledgedBy.fullName || incident.acknowledgedBy.email}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
function formatIncidentDetail(incident) {
    const lines = [
        `Incident #${incident.incidentNumber}: ${incident.summary}`,
        `ID: ${incident.id}`,
        `State: ${incident.state}`,
        `Severity: ${incident.severity}`,
        `Urgency: ${incident.urgency}`,
        `Service: ${incident.service.name}`,
        `Triggered: ${formatDate(incident.triggeredAt)}`,
    ];
    if (incident.details) {
        lines.push('', 'Details:', incident.details);
    }
    if (incident.acknowledgedAt && incident.acknowledgedBy) {
        lines.push(`Acknowledged: ${formatDate(incident.acknowledgedAt)} by ${incident.acknowledgedBy.fullName || incident.acknowledgedBy.email}`);
    }
    if (incident.resolvedAt && incident.resolvedBy) {
        lines.push(`Resolved: ${formatDate(incident.resolvedAt)} by ${incident.resolvedBy.fullName || incident.resolvedBy.email}`);
    }
    if (incident.assignedTo) {
        lines.push(`Assigned to: ${incident.assignedTo.fullName || incident.assignedTo.email}`);
    }
    lines.push(`Escalation Step: ${incident.currentEscalationStep}`);
    return lines.join('\n');
}
function formatServices(services) {
    const lines = [`Found ${services.length} service(s):`, ''];
    for (const service of services) {
        lines.push(`- ${service.name} [${service.id}]`);
        if (service.description) {
            lines.push(`  ${service.description}`);
        }
        lines.push(`  Status: ${service.status}`);
        if (service.schedule) {
            lines.push(`  Schedule: ${service.schedule.name}`);
        }
        if (service.escalationPolicy) {
            lines.push(`  Escalation Policy: ${service.escalationPolicy.name}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
function formatTeams(teams) {
    const lines = [`Found ${teams.length} team(s):`, ''];
    for (const team of teams) {
        lines.push(`- ${team.name} [${team.id}]`);
        if (team.description) {
            lines.push(`  ${team.description}`);
        }
        if (team.memberCount !== undefined) {
            lines.push(`  Members: ${team.memberCount}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
function formatSchedules(schedules) {
    const lines = [`Found ${schedules.length} schedule(s):`, ''];
    for (const schedule of schedules) {
        lines.push(`- ${schedule.name} [${schedule.id}]`);
        if (schedule.description) {
            lines.push(`  ${schedule.description}`);
        }
        lines.push(`  Type: ${schedule.type}`);
        lines.push(`  Timezone: ${schedule.timezone}`);
        if (schedule.isOverride && schedule.overrideUntil) {
            lines.push(`  [OVERRIDE active until ${formatDate(schedule.overrideUntil)}]`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
function getStatusIcon(status) {
    switch (status) {
        case 'triggered':
            return '[!]';
        case 'acknowledged':
            return '[~]';
        case 'resolved':
            return '[+]';
        default:
            return '[ ]';
    }
}
function getSeverityIcon(severity) {
    switch (severity) {
        case 'critical':
            return '[CRITICAL]';
        case 'error':
            return '[ERROR]';
        case 'warning':
            return '[WARN]';
        case 'info':
            return '[INFO]';
        default:
            return '';
    }
}
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleString();
    }
    catch {
        return dateString;
    }
}
//# sourceMappingURL=index.js.map