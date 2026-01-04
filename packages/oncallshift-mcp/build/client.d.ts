/**
 * OnCallShift API Client
 *
 * A wrapper around the OnCallShift REST API for use by the MCP server.
 */
/**
 * Configuration options for the OnCallShift client
 */
export interface OnCallShiftClientConfig {
    apiKey: string;
    baseUrl?: string;
}
/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}
/**
 * Incident filters for listing
 */
export interface ListIncidentsParams {
    status?: 'triggered' | 'acknowledged' | 'resolved';
    service_id?: string;
    limit?: number;
    offset?: number;
}
/**
 * Service filters for listing
 */
export interface ListServicesParams {
    team_id?: string;
    limit?: number;
    offset?: number;
}
/**
 * Team filters for listing
 */
export interface ListTeamsParams {
    limit?: number;
    offset?: number;
}
/**
 * Schedule filters for listing
 */
export interface ListSchedulesParams {
    team_id?: string;
    limit?: number;
    offset?: number;
}
/**
 * User filters for listing
 */
export interface ListUsersParams {
    team_id?: string;
    limit?: number;
    offset?: number;
}
/**
 * Team creation payload
 */
export interface CreateTeamPayload {
    name: string;
    description?: string;
}
/**
 * Service creation payload
 */
export interface CreateServicePayload {
    name: string;
    description?: string;
    team_id?: string;
    escalation_policy_id?: string;
    schedule_id?: string;
}
/**
 * Schedule creation payload
 */
export interface CreateSchedulePayload {
    name: string;
    description?: string;
    timezone?: string;
    team_id?: string;
    layers?: ScheduleLayer[];
}
/**
 * Schedule layer configuration
 */
export interface ScheduleLayer {
    name: string;
    rotation_type: 'daily' | 'weekly';
    users: string[];
    start_time: string;
}
/**
 * Escalation policy creation payload
 */
export interface CreateEscalationPolicyPayload {
    name: string;
    description?: string;
    steps: EscalationStep[];
    repeat_count?: number;
}
/**
 * Escalation step configuration
 */
export interface EscalationStep {
    delay_minutes: number;
    targets: EscalationTarget[];
}
/**
 * Escalation target (user or schedule)
 */
export interface EscalationTarget {
    type: 'user' | 'schedule';
    id: string;
}
/**
 * User invitation payload
 */
export interface InviteUserPayload {
    email: string;
    full_name: string;
    role?: 'admin' | 'user';
    team_ids?: string[];
}
/**
 * Runbook creation payload
 */
export interface CreateRunbookPayload {
    name: string;
    description?: string;
    service_id?: string;
    steps: RunbookStep[];
}
/**
 * Runbook step configuration
 */
export interface RunbookStep {
    order: number;
    title: string;
    description?: string;
    type: 'manual' | 'command' | 'api_call' | 'conditional';
    content?: string;
    expected_duration_minutes?: number;
}
/**
 * Import options for platform migration
 */
export interface ImportOptions {
    preserve_keys?: boolean;
    dry_run?: boolean;
}
/**
 * Integration creation payload
 */
export interface CreateIntegrationPayload {
    type: 'slack' | 'teams' | 'jira' | 'servicenow' | 'webhook' | 'datadog' | 'cloudwatch' | 'prometheus' | 'github';
    name: string;
    config?: Record<string, unknown>;
    features?: Record<string, boolean>;
}
export declare class OnCallShiftClient {
    private apiKey;
    private baseUrl;
    constructor(config: OnCallShiftClientConfig);
    /**
     * Make an authenticated request to the OnCallShift API
     */
    private request;
    /**
     * List incidents with optional filters
     */
    listIncidents(params?: ListIncidentsParams): Promise<ApiResponse>;
    /**
     * Get a single incident by ID
     */
    getIncident(incidentId: string): Promise<ApiResponse>;
    /**
     * Acknowledge an incident
     */
    acknowledgeIncident(incidentId: string): Promise<ApiResponse>;
    /**
     * Resolve an incident
     */
    resolveIncident(incidentId: string): Promise<ApiResponse>;
    /**
     * Reassign an incident to different users
     */
    reassignIncident(incidentId: string, userIds: string[]): Promise<ApiResponse>;
    /**
     * Escalate an incident to the next level
     */
    escalateIncident(incidentId: string): Promise<ApiResponse>;
    /**
     * Add a note to an incident
     */
    addIncidentNote(incidentId: string, content: string): Promise<ApiResponse>;
    /**
     * Create a new incident
     */
    createIncident(incident: {
        title: string;
        service_id: string;
        severity?: 'critical' | 'error' | 'warning' | 'info';
        description?: string;
    }): Promise<ApiResponse>;
    /**
     * Add responders to an incident
     */
    addResponders(incidentId: string, userIds: string[], message?: string): Promise<ApiResponse>;
    /**
     * List all services
     */
    listServices(params?: ListServicesParams): Promise<ApiResponse>;
    /**
     * Get a single service by ID
     */
    getService(serviceId: string): Promise<ApiResponse>;
    /**
     * Create a new service
     */
    createService(service: CreateServicePayload): Promise<ApiResponse>;
    /**
     * List all teams
     */
    listTeams(params?: ListTeamsParams): Promise<ApiResponse>;
    /**
     * Get a single team by ID
     */
    getTeam(teamId: string): Promise<ApiResponse>;
    /**
     * Create a new team
     */
    createTeam(team: CreateTeamPayload): Promise<ApiResponse>;
    /**
     * Add a user to a team
     */
    addTeamMember(teamId: string, userId: string, role?: 'manager' | 'member'): Promise<ApiResponse>;
    /**
     * Remove a user from a team
     */
    removeTeamMember(teamId: string, userId: string): Promise<ApiResponse>;
    /**
     * List all schedules
     */
    listSchedules(params?: ListSchedulesParams): Promise<ApiResponse>;
    /**
     * Get a single schedule by ID
     */
    getSchedule(scheduleId: string): Promise<ApiResponse>;
    /**
     * Create a new schedule
     */
    createSchedule(schedule: CreateSchedulePayload): Promise<ApiResponse>;
    /**
     * Get current on-call users for a schedule
     */
    getOnCallForSchedule(scheduleId: string): Promise<ApiResponse>;
    /**
     * Create a schedule override (temporary assignment)
     */
    createScheduleOverride(scheduleId: string, override: {
        user_id: string;
        start_time: string;
        end_time: string;
    }): Promise<ApiResponse>;
    /**
     * Get all currently on-call users across all schedules/services
     */
    getOnCallNow(): Promise<ApiResponse>;
    /**
     * List all users
     */
    listUsers(params?: ListUsersParams): Promise<ApiResponse>;
    /**
     * Get current authenticated user
     */
    getCurrentUser(): Promise<ApiResponse>;
    /**
     * Get a specific user by ID
     */
    getUser(userId: string): Promise<ApiResponse>;
    /**
     * List all escalation policies
     */
    listEscalationPolicies(params?: {
        limit?: number;
        offset?: number;
    }): Promise<ApiResponse>;
    /**
     * Create a new escalation policy
     */
    createEscalationPolicy(policy: CreateEscalationPolicyPayload): Promise<ApiResponse>;
    /**
     * Get a single escalation policy by ID
     */
    getEscalationPolicy(policyId: string): Promise<ApiResponse>;
    /**
     * Invite a new user to the organization
     */
    inviteUser(invitation: InviteUserPayload): Promise<ApiResponse>;
    /**
     * Add user to teams
     */
    addUserToTeams(userId: string, teamIds: string[]): Promise<ApiResponse>;
    /**
     * List all runbooks
     */
    listRunbooks(params?: {
        service_id?: string;
        limit?: number;
        offset?: number;
    }): Promise<ApiResponse>;
    /**
     * Create a new runbook
     */
    createRunbook(runbook: CreateRunbookPayload): Promise<ApiResponse>;
    /**
     * Get a single runbook by ID
     */
    getRunbook(runbookId: string): Promise<ApiResponse>;
    /**
     * Import data from another platform (PagerDuty, Opsgenie)
     */
    importFromPlatform(platform: 'pagerduty' | 'opsgenie', data: unknown, options?: ImportOptions): Promise<ApiResponse>;
    /**
     * Validate import data before importing (dry-run)
     */
    validateImport(platform: 'pagerduty' | 'opsgenie', data: unknown): Promise<ApiResponse>;
    /**
     * List all integrations
     */
    listIntegrations(params?: {
        type?: string;
        limit?: number;
    }): Promise<ApiResponse>;
    /**
     * Create a new integration
     */
    createIntegration(integration: CreateIntegrationPayload): Promise<ApiResponse>;
    /**
     * Get a single integration by ID
     */
    getIntegration(integrationId: string): Promise<ApiResponse>;
    /**
     * Link a service to an integration
     */
    linkServiceToIntegration(integrationId: string, serviceId: string, configOverrides?: Record<string, unknown>): Promise<ApiResponse>;
    /**
     * Get analytics overview with incident metrics
     */
    getAnalyticsOverview(params?: {
        startDate?: string;
        endDate?: string;
    }): Promise<ApiResponse>;
    /**
     * Get analytics for a specific team
     */
    getTeamAnalytics(teamId: string, params?: {
        startDate?: string;
        endDate?: string;
    }): Promise<ApiResponse>;
    /**
     * Get analytics for a specific user
     */
    getUserAnalytics(userId: string, params?: {
        startDate?: string;
        endDate?: string;
    }): Promise<ApiResponse>;
    /**
     * Get top responders analytics
     */
    getTopResponders(params?: {
        startDate?: string;
        endDate?: string;
        limit?: number;
    }): Promise<ApiResponse>;
    /**
     * Get SLA compliance analytics
     */
    getSlaAnalytics(params?: {
        startDate?: string;
        endDate?: string;
        ackTargetMinutes?: number;
        resolveTargetMinutes?: number;
    }): Promise<ApiResponse>;
    /**
     * Get incident metrics (alias for getAnalyticsOverview with grouping support)
     */
    getIncidentMetrics(params?: {
        startDate?: string;
        endDate?: string;
        groupBy?: 'service' | 'team' | 'severity' | 'user';
    }): Promise<ApiResponse>;
}
//# sourceMappingURL=client.d.ts.map