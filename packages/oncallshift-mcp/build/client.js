/**
 * OnCallShift API Client
 *
 * A wrapper around the OnCallShift REST API for use by the MCP server.
 */
export class OnCallShiftClient {
    apiKey;
    baseUrl;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://oncallshift.com/api/v1';
    }
    /**
     * Make an authenticated request to the OnCallShift API
     */
    async request(method, endpoint, body) {
        const url = `${this.baseUrl}${endpoint}`;
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorJson.error || `HTTP ${response.status}`;
                }
                catch {
                    errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
                }
                return {
                    success: false,
                    error: errorMessage,
                };
            }
            const data = await response.json();
            return {
                success: true,
                data,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
    // ============================================
    // Incidents
    // ============================================
    /**
     * List incidents with optional filters
     */
    async listIncidents(params) {
        const queryParams = new URLSearchParams();
        // API uses 'state' parameter
        if (params?.status)
            queryParams.set('state', params.status);
        if (params?.service_id)
            queryParams.set('service_id', params.service_id);
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.offset)
            queryParams.set('offset', params.offset.toString());
        const query = queryParams.toString();
        const endpoint = `/incidents${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get a single incident by ID
     */
    async getIncident(incidentId) {
        return this.request('GET', `/incidents/${incidentId}`);
    }
    /**
     * Acknowledge an incident
     */
    async acknowledgeIncident(incidentId) {
        return this.request('POST', `/incidents/${incidentId}/acknowledge`);
    }
    /**
     * Resolve an incident
     */
    async resolveIncident(incidentId) {
        return this.request('POST', `/incidents/${incidentId}/resolve`);
    }
    /**
     * Reassign an incident to different users
     */
    async reassignIncident(incidentId, userIds) {
        return this.request('POST', `/incidents/${incidentId}/reassign`, {
            user_ids: userIds,
        });
    }
    /**
     * Escalate an incident to the next level
     */
    async escalateIncident(incidentId) {
        return this.request('POST', `/incidents/${incidentId}/escalate`);
    }
    /**
     * Add a note to an incident
     */
    async addIncidentNote(incidentId, content) {
        return this.request('POST', `/incidents/${incidentId}/notes`, { content });
    }
    // ============================================
    // Services
    // ============================================
    /**
     * List all services
     */
    async listServices(params) {
        const queryParams = new URLSearchParams();
        if (params?.team_id)
            queryParams.set('team_id', params.team_id);
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.offset)
            queryParams.set('offset', params.offset.toString());
        const query = queryParams.toString();
        const endpoint = `/services${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get a single service by ID
     */
    async getService(serviceId) {
        return this.request('GET', `/services/${serviceId}`);
    }
    /**
     * Create a new service
     */
    async createService(service) {
        return this.request('POST', '/services', service);
    }
    // ============================================
    // Teams
    // ============================================
    /**
     * List all teams
     */
    async listTeams(params) {
        const queryParams = new URLSearchParams();
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.offset)
            queryParams.set('offset', params.offset.toString());
        const query = queryParams.toString();
        const endpoint = `/teams${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get a single team by ID
     */
    async getTeam(teamId) {
        return this.request('GET', `/teams/${teamId}`);
    }
    /**
     * Create a new team
     */
    async createTeam(team) {
        return this.request('POST', '/teams', team);
    }
    // ============================================
    // Schedules
    // ============================================
    /**
     * List all schedules
     */
    async listSchedules(params) {
        const queryParams = new URLSearchParams();
        if (params?.team_id)
            queryParams.set('team_id', params.team_id);
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.offset)
            queryParams.set('offset', params.offset.toString());
        const query = queryParams.toString();
        const endpoint = `/schedules${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get a single schedule by ID
     */
    async getSchedule(scheduleId) {
        return this.request('GET', `/schedules/${scheduleId}`);
    }
    /**
     * Create a new schedule
     */
    async createSchedule(schedule) {
        return this.request('POST', '/schedules', schedule);
    }
    /**
     * Get current on-call users for a schedule
     */
    async getOnCallForSchedule(scheduleId) {
        return this.request('GET', `/schedules/${scheduleId}/oncall`);
    }
    // ============================================
    // On-Call
    // ============================================
    /**
     * Get all currently on-call users across all schedules/services
     */
    async getOnCallNow() {
        return this.request('GET', '/schedules/oncall');
    }
    // ============================================
    // Users
    // ============================================
    /**
     * List all users
     */
    async listUsers(params) {
        const queryParams = new URLSearchParams();
        if (params?.team_id)
            queryParams.set('team_id', params.team_id);
        if (params?.limit)
            queryParams.set('limit', params.limit.toString());
        if (params?.offset)
            queryParams.set('offset', params.offset.toString());
        const query = queryParams.toString();
        const endpoint = `/users${query ? `?${query}` : ''}`;
        return this.request('GET', endpoint);
    }
    /**
     * Get current authenticated user
     */
    async getCurrentUser() {
        return this.request('GET', '/users/me');
    }
}
//# sourceMappingURL=client.js.map