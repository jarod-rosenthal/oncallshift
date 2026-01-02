/**
 * OnCallShift API Client
 *
 * A wrapper around the OnCallShift REST API for use by the MCP server.
 */
export interface OnCallShiftClientConfig {
    apiKey: string;
    baseUrl?: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface Incident {
    id: string;
    incidentNumber: number;
    summary: string;
    details?: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    state: 'triggered' | 'acknowledged' | 'resolved';
    urgency: 'high' | 'low';
    service: {
        id: string;
        name: string;
    };
    triggeredAt: string;
    acknowledgedAt?: string | null;
    acknowledgedBy?: {
        id: string;
        fullName: string | null;
        email: string;
    } | null;
    resolvedAt?: string | null;
    resolvedBy?: {
        id: string;
        fullName: string | null;
        email: string;
    } | null;
    assignedTo?: {
        id: string;
        fullName: string | null;
        email: string;
    } | null;
    currentEscalationStep: number;
    createdAt: string;
    updatedAt: string;
}
export interface Service {
    id: string;
    name: string;
    description?: string | null;
    apiKey?: string;
    status: 'active' | 'maintenance' | 'disabled';
    schedule?: {
        id: string;
        name: string;
    } | null;
    escalationPolicy?: {
        id: string;
        name: string;
    } | null;
    createdAt: string;
    updatedAt: string;
}
export interface Team {
    id: string;
    name: string;
    description?: string | null;
    slug?: string;
    memberCount?: number;
    members?: Array<{
        id: string;
        userId: string;
        role: string;
        user: {
            id: string;
            fullName: string | null;
            email: string;
        } | null;
    }>;
    createdAt: string;
    updatedAt: string;
}
export interface Schedule {
    id: string;
    name: string;
    description?: string | null;
    type: 'manual' | 'daily' | 'weekly';
    timezone: string;
    currentOncallUserId?: string | null;
    isOverride?: boolean;
    overrideUntil?: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface OnCallUser {
    id: string;
    name: string;
    email: string;
    phone?: string;
    schedule_id: string;
    schedule_name: string;
    start_time: string;
    end_time: string;
}
/**
 * On-call data returned from the schedules/oncall endpoint
 */
export interface OnCallData {
    service: {
        id: string;
        name: string;
    };
    schedule: {
        id: string;
        name: string;
    };
    oncallUser: {
        id: string;
        fullName: string;
        email: string;
        profilePictureUrl?: string | null;
    } | null;
    isOverride: boolean;
    overrideUntil: string | null;
}
export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    created_at: string;
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
    listIncidents(params?: {
        status?: 'triggered' | 'acknowledged' | 'resolved';
        service_id?: string;
        limit?: number;
        offset?: number;
    }): Promise<ApiResponse<{
        incidents: Incident[];
        pagination: {
            total: number;
            limit: number;
            offset: number;
        };
    }>>;
    /**
     * Get a single incident by ID
     */
    getIncident(incidentId: string): Promise<ApiResponse<Incident>>;
    /**
     * Acknowledge an incident
     */
    acknowledgeIncident(incidentId: string): Promise<ApiResponse<Incident>>;
    /**
     * Resolve an incident
     */
    resolveIncident(incidentId: string): Promise<ApiResponse<Incident>>;
    /**
     * Reassign an incident to different users
     */
    reassignIncident(incidentId: string, userIds: string[]): Promise<ApiResponse<Incident>>;
    /**
     * Escalate an incident to the next level
     */
    escalateIncident(incidentId: string): Promise<ApiResponse<Incident>>;
    /**
     * Add a note to an incident
     */
    addIncidentNote(incidentId: string, content: string): Promise<ApiResponse<{
        id: string;
        content: string;
        created_at: string;
    }>>;
    /**
     * List all services
     */
    listServices(params?: {
        team_id?: string;
        limit?: number;
        offset?: number;
    }): Promise<ApiResponse<{
        services: Service[];
    }>>;
    /**
     * Get a single service by ID
     */
    getService(serviceId: string): Promise<ApiResponse<Service>>;
    /**
     * Create a new service
     */
    createService(service: {
        name: string;
        description?: string;
        escalation_policy_id?: string;
        team_id?: string;
    }): Promise<ApiResponse<Service>>;
    /**
     * List all teams
     */
    listTeams(params?: {
        limit?: number;
        offset?: number;
    }): Promise<ApiResponse<{
        teams: Team[];
    }>>;
    /**
     * Get a single team by ID
     */
    getTeam(teamId: string): Promise<ApiResponse<Team>>;
    /**
     * Create a new team
     */
    createTeam(team: {
        name: string;
        description?: string;
    }): Promise<ApiResponse<Team>>;
    /**
     * List all schedules
     */
    listSchedules(params?: {
        team_id?: string;
        limit?: number;
        offset?: number;
    }): Promise<ApiResponse<{
        schedules: Schedule[];
    }>>;
    /**
     * Get a single schedule by ID
     */
    getSchedule(scheduleId: string): Promise<ApiResponse<Schedule>>;
    /**
     * Create a new schedule
     */
    createSchedule(schedule: {
        name: string;
        description?: string;
        timezone: string;
        team_id?: string;
        layers?: Array<{
            name: string;
            rotation_type: 'daily' | 'weekly' | 'custom';
            rotation_interval?: number;
            users: string[];
            start_time: string;
            end_time?: string;
        }>;
    }): Promise<ApiResponse<Schedule>>;
    /**
     * Get current on-call users for a schedule
     */
    getOnCallForSchedule(scheduleId: string): Promise<ApiResponse<OnCallUser[]>>;
    /**
     * Get all currently on-call users across all schedules/services
     */
    getOnCallNow(): Promise<ApiResponse<{
        oncall: OnCallData[];
    }>>;
    /**
     * List all users
     */
    listUsers(params?: {
        team_id?: string;
        limit?: number;
        offset?: number;
    }): Promise<ApiResponse<{
        users: User[];
        total: number;
    }>>;
    /**
     * Get current authenticated user
     */
    getCurrentUser(): Promise<ApiResponse<User>>;
}
//# sourceMappingURL=client.d.ts.map